import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { cadb, partnerDb } from "../../db.js";
import { requireAdmin } from "../../lib/auth.js";
import { recordAdminAudit } from "../../lib/audit.js";
import { batchSchoolIds, gradeMap, missingIds, schoolMap } from "../../lib/cadbLookups.js";

const listQuery = z.object({
  academicYear: z.string().trim().max(40).optional(),
  schoolId: z.string().optional(),
  // a project id, "unassigned" or "assigned"
  project: z.string().optional(),
  search: z.string().trim().max(100).optional(),
  includeArchived: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(50),
});

const assignBody = z.object({
  projectId: z.string().min(1),
  batchIds: z.array(z.string().min(1)).min(1).max(500),
});
const unassignBody = z.object({ batchIds: z.array(z.string().min(1)).min(1).max(500) });

export async function adminBatchRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAdmin);

  app.get("/batches", async (request) => {
    const q = listQuery.parse(request.query);

    // Assignments are small (one row per assigned batch), so filter on them in memory.
    const assignments = await partnerDb.projectBatch.findMany({
      include: { project: { select: { id: true, internalName: true, displayName: true, status: true, schools: { select: { schoolId: true } } } } },
    });
    const byBatch = new Map(assignments.map((a) => [a.batchId, a]));
    const assignedIds = assignments.map((a) => a.batchId);

    const idFilter =
      q.project === "unassigned" ? { notIn: assignedIds }
      : q.project === "assigned" ? { in: assignedIds }
      : q.project ? { in: assignments.filter((a) => a.projectId === q.project).map((a) => a.batchId) }
      : undefined;

    const where = {
      ...(idFilter ? { id: idFilter } : {}),
      ...(q.academicYear ? { academicYear: q.academicYear } : {}),
      ...(q.schoolId ? { OR: [{ schoolId: q.schoolId }, { schoolIds: { has: q.schoolId } }] } : {}),
      ...(q.search ? { name: { contains: q.search, mode: "insensitive" as const } } : {}),
      ...(q.includeArchived === "true" ? {} : { isArchived: false }),
    };

    const [total, batches, years] = await Promise.all([
      cadb.batch.count({ where }),
      cadb.batch.findMany({
        where,
        orderBy: [{ academicYear: "desc" }, { name: "asc" }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        select: {
          id: true, name: true, academicYear: true, schoolId: true, schoolIds: true, gradeId: true,
          isActive: true, isArchived: true, _count: { select: { studentBatches: true } },
        },
      }),
      cadb.batch.findMany({ distinct: ["academicYear"], select: { academicYear: true }, orderBy: { academicYear: "desc" } }),
    ]);

    const [schools, grades] = await Promise.all([schoolMap([...new Set(batches.flatMap(batchSchoolIds))]), gradeMap()]);

    return {
      total,
      page: q.page,
      pageSize: q.pageSize,
      academicYears: years.map((y) => y.academicYear),
      rows: batches.map((b) => {
        const assignment = byBatch.get(b.id);
        const ids = batchSchoolIds(b);
        const projectSchools = new Set(assignment?.project.schools.map((s) => s.schoolId) ?? []);
        return {
          id: b.id,
          name: b.name,
          academicYear: b.academicYear,
          grade: b.gradeId ? grades.get(b.gradeId)?.name ?? null : null,
          schools: ids.map((id) => ({ id, name: schools.get(id)?.name ?? null })),
          studentCount: b._count.studentBatches,
          isActive: b.isActive,
          isArchived: b.isArchived,
          project: assignment
            ? { id: assignment.project.id, internalName: assignment.project.internalName, displayName: assignment.project.displayName, status: assignment.project.status }
            : null,
          // Schools of this batch that are not in its project: their students won't show to partners.
          schoolsOutsideProject: assignment ? ids.filter((id) => !projectSchools.has(id)).length : 0,
        };
      }),
    };
  });

  app.post("/batches/assign", async (request, reply) => {
    const { projectId, batchIds } = assignBody.parse(request.body);
    const ids = [...new Set(batchIds)];
    const project = await partnerDb.project.findUnique({ where: { id: projectId } });
    if (!project || project.status !== "ACTIVE") return reply.status(400).send({ error: "Choose an active project." });
    if ((await missingIds("batch", ids)).length) return reply.status(400).send({ error: "Some of those batches no longer exist in CADB." });

    const previous = await partnerDb.projectBatch.findMany({ where: { batchId: { in: ids } } });
    const moved = previous.filter((p) => p.projectId !== projectId);
    const admin = request.admin!;

    await partnerDb.$transaction(async (tx) => {
      for (const batchId of ids) {
        await tx.projectBatch.upsert({
          where: { batchId },
          create: { batchId, projectId, assignedById: admin.id },
          update: { projectId, assignedById: admin.id, assignedAt: new Date() },
        });
      }
      await recordAdminAudit(admin.id, "batches.assign", "Project", projectId, {
        before: moved.map((m) => ({ batchId: m.batchId, projectId: m.projectId })),
        after: { batchIds: ids },
      }, tx);
    });
    return { assigned: ids.length, movedFromOtherProjects: moved.length };
  });

  app.post("/batches/unassign", async (request) => {
    const { batchIds } = unassignBody.parse(request.body);
    const ids = [...new Set(batchIds)];
    const previous = await partnerDb.projectBatch.findMany({ where: { batchId: { in: ids } } });
    if (previous.length === 0) return { unassigned: 0 };
    await partnerDb.$transaction(async (tx) => {
      await tx.projectBatch.deleteMany({ where: { batchId: { in: previous.map((p) => p.batchId) } } });
      await recordAdminAudit(request.admin!.id, "batches.unassign", "ProjectBatch", previous.map((p) => p.batchId).join(","), {
        before: previous.map((p) => ({ batchId: p.batchId, projectId: p.projectId })),
      }, tx);
    });
    return { unassigned: previous.length };
  });
}
