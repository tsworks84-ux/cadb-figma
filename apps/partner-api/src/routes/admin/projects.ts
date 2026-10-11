import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import type { Prisma } from "@cadb/partner-db";
import { partnerDb } from "../../db.js";
import { requireAdmin } from "../../lib/auth.js";
import { recordAdminAudit } from "../../lib/audit.js";
import { academicYearMap, gradeMap, missingIds, schoolMap } from "../../lib/cadbLookups.js";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.").refine((d) => !Number.isNaN(Date.parse(d)), "Not a real date.");
const toDate = (d: string) => new Date(`${d}T00:00:00.000Z`);

const structureSchema = z.object({
  gradeIds: z.array(z.string().min(1)).max(30),
  schools: z
    .array(
      z.object({
        schoolId: z.string().min(1),
        grades: z.array(z.object({ gradeId: z.string().min(1), boardId: z.string().min(1) })).max(30),
      }),
    )
    .max(200),
});
type Structure = z.infer<typeof structureSchema>;

const baseFields = {
  type: z.enum(["SIP", "ASP"]),
  internalName: z.string().trim().min(2).max(120),
  displayName: z.string().trim().min(2).max(120),
  startDate: isoDate,
  startAcademicYearId: z.string().min(1),
};

const createBody = z.object({ partnerId: z.string().min(1), ...baseFields }).merge(structureSchema);
const updateBody = z.object(baseFields).partial();

const listQuery = z.object({
  partnerId: z.string().optional(),
  type: z.enum(["SIP", "ASP"]).optional(),
  status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
  search: z.string().trim().max(100).optional(),
});

type Tx = Prisma.TransactionClient;

/** Checks a structure against CADB and the board list. Returns an error message or null. */
async function validateStructure(s: Structure): Promise<string | null> {
  const gradeSet = new Set(s.gradeIds);
  if (gradeSet.size !== s.gradeIds.length) return "A grade is listed twice.";
  const schoolIds = s.schools.map((x) => x.schoolId);
  if (new Set(schoolIds).size !== schoolIds.length) return "A school is listed twice.";

  for (const school of s.schools) {
    const seen = new Set<string>();
    for (const g of school.grades) {
      if (!gradeSet.has(g.gradeId)) return "A school has a board for a grade the project doesn't cover.";
      if (seen.has(g.gradeId)) return "A school has two boards for the same grade.";
      seen.add(g.gradeId);
    }
  }

  if ((await missingIds("grade", s.gradeIds)).length) return "One of the grades no longer exists in CADB.";
  if ((await missingIds("school", schoolIds)).length) return "One of the schools no longer exists in CADB.";

  const boardIds = [...new Set(s.schools.flatMap((x) => x.grades.map((g) => g.boardId)))];
  if (boardIds.length) {
    const boards = await partnerDb.board.findMany({ where: { id: { in: boardIds } }, select: { id: true } });
    if (boards.length !== boardIds.length) return "One of the boards does not exist.";
  }
  return null;
}

/** Replace a project's grades, schools and per-grade boards, keeping ids of schools that stay. */
async function applyStructure(tx: Tx, projectId: string, s: Structure) {
  await tx.projectGrade.deleteMany({ where: { projectId, gradeId: { notIn: s.gradeIds } } });
  await tx.projectGrade.createMany({ data: s.gradeIds.map((gradeId) => ({ projectId, gradeId })), skipDuplicates: true });

  const keep = s.schools.map((x) => x.schoolId);
  await tx.projectSchool.deleteMany({ where: { projectId, schoolId: { notIn: keep } } });
  // A school leaving the project takes its partner access grants with it.
  await tx.partnerSchoolGrant.deleteMany({ where: { projectId, schoolId: { notIn: keep } } });

  for (const school of s.schools) {
    const ps = await tx.projectSchool.upsert({
      where: { projectId_schoolId: { projectId, schoolId: school.schoolId } },
      create: { projectId, schoolId: school.schoolId },
      update: {},
    });
    await tx.projectSchoolGrade.deleteMany({ where: { projectSchoolId: ps.id } });
    if (school.grades.length) {
      await tx.projectSchoolGrade.createMany({
        data: school.grades.map((g) => ({ projectSchoolId: ps.id, gradeId: g.gradeId, boardId: g.boardId })),
      });
    }
  }
}

async function loadProject(id: string) {
  const project = await partnerDb.project.findUnique({
    where: { id },
    include: {
      partner: { select: { id: true, name: true, displayName: true, isInternal: true, isArchived: true } },
      grades: true,
      schools: { include: { grades: { include: { board: { select: { id: true, code: true, name: true } } } } } },
      _count: { select: { batches: true, projectGrants: true } },
    },
  });
  if (!project) return null;

  const [grades, schools, years] = await Promise.all([
    gradeMap(),
    schoolMap(project.schools.map((s) => s.schoolId)),
    academicYearMap(),
  ]);
  const gradeOrder = (gradeId: string) => grades.get(gradeId)?.sortOrder ?? 9999;

  return {
    id: project.id,
    partner: project.partner,
    type: project.type,
    internalName: project.internalName,
    displayName: project.displayName,
    startDate: project.startDate.toISOString().slice(0, 10),
    startAcademicYear: { id: project.startAcademicYearId, name: years.get(project.startAcademicYearId)?.name ?? null },
    status: project.status,
    archivedAt: project.archivedAt,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    batchCount: project._count.batches,
    userCount: project._count.projectGrants,
    grades: project.grades
      .map((g) => ({ id: g.gradeId, name: grades.get(g.gradeId)?.name ?? null, sortOrder: gradeOrder(g.gradeId) }))
      .sort((a, b) => a.sortOrder - b.sortOrder),
    schools: project.schools
      .map((s) => {
        const school = schools.get(s.schoolId);
        return {
          schoolId: s.schoolId,
          name: school?.name ?? null, // null = no longer in CADB
          city: school?.city ?? null,
          isActive: school?.isActive ?? false,
          grades: s.grades
            .map((g) => ({ gradeId: g.gradeId, gradeName: grades.get(g.gradeId)?.name ?? null, board: g.board }))
            .sort((a, b) => gradeOrder(a.gradeId) - gradeOrder(b.gradeId)),
        };
      })
      .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "")),
  };
}

function notFound(reply: FastifyReply) {
  return reply.status(404).send({ error: "Project not found." });
}

export async function adminProjectRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAdmin);

  app.get("/projects", async (request) => {
    const q = listQuery.parse(request.query);
    const projects = await partnerDb.project.findMany({
      where: {
        partnerId: q.partnerId,
        type: q.type,
        status: q.status,
        ...(q.search
          ? { OR: [{ internalName: { contains: q.search, mode: "insensitive" } }, { displayName: { contains: q.search, mode: "insensitive" } }] }
          : {}),
      },
      orderBy: [{ status: "asc" }, { startDate: "desc" }, { internalName: "asc" }],
      include: {
        partner: { select: { id: true, name: true } },
        _count: { select: { grades: true, schools: true, batches: true, projectGrants: true } },
      },
    });
    const years = await academicYearMap();
    return projects.map((p) => ({
      id: p.id,
      partner: p.partner,
      type: p.type,
      internalName: p.internalName,
      displayName: p.displayName,
      startDate: p.startDate.toISOString().slice(0, 10),
      startAcademicYear: years.get(p.startAcademicYearId)?.name ?? null,
      status: p.status,
      gradeCount: p._count.grades,
      schoolCount: p._count.schools,
      batchCount: p._count.batches,
      userCount: p._count.projectGrants,
    }));
  });

  app.get<{ Params: { id: string } }>("/projects/:id", async (request, reply) => {
    const project = await loadProject(request.params.id);
    return project ?? notFound(reply);
  });

  app.post("/projects", async (request, reply) => {
    const body = createBody.parse(request.body);
    const partner = await partnerDb.partner.findUnique({ where: { id: body.partnerId } });
    if (!partner || partner.isArchived) return reply.status(400).send({ error: "Choose an active partner." });
    if ((await missingIds("academicYear", [body.startAcademicYearId])).length) {
      return reply.status(400).send({ error: "That academic year no longer exists in CADB." });
    }
    const problem = await validateStructure(body);
    if (problem) return reply.status(400).send({ error: problem });
    if (await partnerDb.project.findFirst({ where: { partnerId: body.partnerId, internalName: body.internalName } })) {
      return reply.status(409).send({ error: "This partner already has a project with that internal name." });
    }

    const id = await partnerDb.$transaction(async (tx) => {
      const created = await tx.project.create({
        data: {
          partnerId: body.partnerId,
          type: body.type,
          internalName: body.internalName,
          displayName: body.displayName,
          startDate: toDate(body.startDate),
          startAcademicYearId: body.startAcademicYearId,
        },
      });
      await applyStructure(tx, created.id, body);
      await recordAdminAudit(request.admin!.id, "project.create", "Project", created.id, { after: body }, tx);
      return created.id;
    });
    return reply.status(201).send(await loadProject(id));
  });

  app.patch<{ Params: { id: string } }>("/projects/:id", async (request, reply) => {
    const body = updateBody.parse(request.body);
    const before = await partnerDb.project.findUnique({ where: { id: request.params.id } });
    if (!before) return notFound(reply);
    if (body.startAcademicYearId && (await missingIds("academicYear", [body.startAcademicYearId])).length) {
      return reply.status(400).send({ error: "That academic year no longer exists in CADB." });
    }
    if (body.internalName && body.internalName !== before.internalName) {
      const clash = await partnerDb.project.findFirst({
        where: { partnerId: before.partnerId, internalName: body.internalName, id: { not: before.id } },
      });
      if (clash) return reply.status(409).send({ error: "This partner already has a project with that internal name." });
    }

    await partnerDb.$transaction(async (tx) => {
      const after = await tx.project.update({
        where: { id: before.id },
        data: { ...body, startDate: body.startDate ? toDate(body.startDate) : undefined },
      });
      await recordAdminAudit(request.admin!.id, "project.update", "Project", before.id, { before, after }, tx);
    });
    return loadProject(before.id);
  });

  app.put<{ Params: { id: string } }>("/projects/:id/structure", async (request, reply) => {
    const body = structureSchema.parse(request.body);
    const before = await loadProject(request.params.id);
    if (!before) return notFound(reply);
    const problem = await validateStructure(body);
    if (problem) return reply.status(400).send({ error: problem });

    await partnerDb.$transaction(async (tx) => {
      await applyStructure(tx, before.id, body);
      await recordAdminAudit(
        request.admin!.id,
        "project.structure.update",
        "Project",
        before.id,
        { before: { grades: before.grades, schools: before.schools }, after: body },
        tx,
      );
    });
    return loadProject(before.id);
  });

  app.post<{ Params: { id: string } }>("/projects/:id/archive", async (request, reply) => {
    const before = await partnerDb.project.findUnique({ where: { id: request.params.id } });
    if (!before) return notFound(reply);
    if (before.status === "ARCHIVED") return loadProject(before.id);
    await partnerDb.$transaction(async (tx) => {
      await tx.project.update({ where: { id: before.id }, data: { status: "ARCHIVED", archivedAt: new Date() } });
      await recordAdminAudit(request.admin!.id, "project.archive", "Project", before.id, {}, tx);
    });
    return loadProject(before.id);
  });

  app.post<{ Params: { id: string } }>("/projects/:id/unarchive", async (request, reply) => {
    const before = await partnerDb.project.findUnique({ where: { id: request.params.id }, include: { partner: true } });
    if (!before) return notFound(reply);
    if (before.partner.isArchived) return reply.status(409).send({ error: "Restore the partner before restoring its project." });
    await partnerDb.$transaction(async (tx) => {
      await tx.project.update({ where: { id: before.id }, data: { status: "ACTIVE", archivedAt: null } });
      await recordAdminAudit(request.admin!.id, "project.unarchive", "Project", before.id, {}, tx);
    });
    return loadProject(before.id);
  });

  // Hard delete only for a project that never got batches (e.g. created by mistake).
  app.delete<{ Params: { id: string } }>("/projects/:id", async (request, reply) => {
    const before = await loadProject(request.params.id);
    if (!before) return notFound(reply);
    if (before.batchCount > 0) {
      return reply.status(409).send({ error: `This project has ${before.batchCount} batch(es). Archive it instead, or unassign the batches first.` });
    }
    await partnerDb.$transaction(async (tx) => {
      await tx.project.delete({ where: { id: before.id } });
      await recordAdminAudit(request.admin!.id, "project.delete", "Project", before.id, { before }, tx);
    });
    return reply.status(204).send();
  });
}
