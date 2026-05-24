import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@cadb/db";
import { authenticate } from "../../middleware/authenticate.js";

const batchSchema = z.object({
  name:           z.string().min(1),
  description:    z.string().optional(),
  locationId:     z.string().optional().nullable(),
  academicYear:   z.string().min(1),
  startDate:      z.string().optional(),
  schoolId:       z.string().optional().nullable(),
  gradeId:        z.string().optional().nullable(),
  schoolIds:      z.string().array().optional().default([]),
  courseIds:      z.string().array().optional().default([]),
  targetStrength: z.number().int().positive().optional().nullable(),
  isActive:       z.boolean().optional(),
});

const subjectSchema = z.object({
  code:        z.string().min(1).toUpperCase(),
  name:        z.string().min(1),
  description: z.string().optional(),
  isActive:    z.boolean().optional(),
});

function requireAdmin(request: any, reply: any) {
  const role = request.user?.role;
  if (!["SUPER_ADMIN", "HR_ADMIN"].includes(role)) {
    return reply.status(403).send({ success: false, error: "Insufficient permissions" });
  }
}

export async function academicsRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  // ── OVERVIEW DASHBOARD ─────────────────────────────────────────────────────

  fastify.get("/overview", async (_request, reply) => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const [
      students, batches, examMarkStats, submissionStats, todaySchedules,
      schools, grades, courses,
    ] = await Promise.all([
      prisma.student.findMany({
        where: { isArchived: false },
        select: {
          id: true, status: true,
          schoolId: true, gradeId: true, batchId: true, courseId: true, academicYear: true,
          totalFee: true, paidFee: true,
        },
      }),
      prisma.batch.findMany({
        where: { isArchived: false },
        select: { id: true, name: true, academicYear: true, _count: { select: { students: true } } },
      }),
      prisma.examMark.aggregate({
        _avg: { marks: true },
        where: { marks: { not: null, gt: 0 } },
      }),
      prisma.assignmentSubmission.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      prisma.schedule.findMany({
        where: { date: { gte: todayStart, lt: todayEnd } },
        include: {
          subject:  { select: { id: true, name: true, code: true } },
          employee: { select: { id: true, firstName: true, lastName: true } },
          location: { select: { id: true, name: true } },
          batches:  { include: { batch: { select: { id: true, name: true, academicYear: true } } } },
        },
        orderBy: { startTime: "asc" },
      }),
      prisma.school.findMany({ select: { id: true, name: true, city: true } }),
      prisma.grade.findMany({ select: { id: true, name: true } }),
      prisma.course.findMany({ select: { id: true, name: true } }),
    ]);

    // Build lookup maps
    const schoolMap = Object.fromEntries(schools.map((s) => [s.id, s]));
    const gradeMap  = Object.fromEntries(grades.map((g)  => [g.id, g]));
    const batchMap  = Object.fromEntries(batches.map((b) => [b.id, b]));
    const courseMap = Object.fromEntries(courses.map((c) => [c.id, c]));

    // Student + revenue grouping helper
    function groupStudents(keyFn: (s: typeof students[0]) => string | null, labelFn: (k: string) => string) {
      const m: Record<string, { label: string; count: number; revenue: number; collected: number }> = {};
      for (const st of students) {
        const key = keyFn(st);
        if (!key) continue;
        if (!m[key]) m[key] = { label: labelFn(key), count: 0, revenue: 0, collected: 0 };
        m[key].count++;
        m[key].revenue   += st.totalFee ?? 0;
        m[key].collected += st.paidFee  ?? 0;
      }
      return Object.values(m).filter((g) => g.label).sort((a, b) => b.count - a.count);
    }

    const byGrade   = groupStudents((s) => s.gradeId,      (k) => gradeMap[k]?.name  ?? "");
    const bySchool  = groupStudents((s) => s.schoolId,     (k) => schoolMap[k]?.name ?? "");
    const byBatch   = groupStudents((s) => s.batchId,      (k) => batchMap[k]?.name  ?? "");
    const byCourse  = groupStudents((s) => s.courseId,     (k) => courseMap[k]?.name ?? "");
    const byYear    = groupStudents((s) => s.academicYear,  (k) => k);
    const byCity    = groupStudents(
      (s) => s.schoolId ? (schoolMap[s.schoolId]?.city ?? null) : null,
      (k) => k,
    );

    // Revenue totals
    const totalRevenue     = students.reduce((s, st) => s + (st.totalFee ?? 0), 0);
    const collectedRevenue = students.reduce((s, st) => s + (st.paidFee  ?? 0), 0);

    // Avg batch strength (only batches with at least one student)
    const activeBatches = batches.filter((b) => b._count.students > 0);
    const avgStrength = activeBatches.length > 0
      ? Math.round(activeBatches.reduce((s, b) => s + b._count.students, 0) / activeBatches.length)
      : 0;

    // Performance metrics
    const avgTestScore = examMarkStats._avg.marks !== null
      ? Math.round(examMarkStats._avg.marks ?? 0)
      : null;
    const totalSubs     = submissionStats.reduce((s, r) => s + r._count._all, 0);
    const submittedSubs = submissionStats.filter((r) => r.status !== "NOT_SUBMITTED").reduce((s, r) => s + r._count._all, 0);
    const submissionRate = totalSubs > 0 ? Math.round((submittedSubs / totalSubs) * 100) : null;

    return reply.send({
      success: true,
      data: {
        students: {
          total:  students.length,
          active: students.filter((s) => s.status === "ACTIVE").length,
          byGrade, bySchool, byBatch, byCourse, byYear, byCity,
        },
        batches: {
          total:       batches.length,
          active:      activeBatches.length,
          avgStrength,
        },
        revenue: {
          total:     totalRevenue,
          collected: collectedRevenue,
          due:       totalRevenue - collectedRevenue,
          byGrade:   byGrade.map((g) => ({ label: g.label, total: g.revenue, collected: g.collected })),
          bySchool:  bySchool.map((g) => ({ label: g.label, total: g.revenue, collected: g.collected })),
          byBatch:   byBatch.map((g) => ({ label: g.label, total: g.revenue, collected: g.collected })),
          byCourse:  byCourse.map((g) => ({ label: g.label, total: g.revenue, collected: g.collected })),
          byYear:    byYear.map((g) => ({ label: g.label, total: g.revenue, collected: g.collected })),
          byCity:    byCity.map((g) => ({ label: g.label, total: g.revenue, collected: g.collected })),
        },
        performance: { avgTestScore, submissionRate },
        todaySchedules: { count: todaySchedules.length, list: todaySchedules },
      },
    });
  });

  // ── BATCHES ────────────────────────────────────────────────────────────────

  fastify.get("/batches", async (request, reply) => {
    const { archived, academicYear, locationId, schoolId, gradeId } = request.query as any;

    const where: any = { isArchived: archived === "true" ? true : false };
    if (academicYear) where.academicYear = academicYear;
    if (locationId)   where.locationId   = locationId;
    if (schoolId)     where.OR = [{ schoolId }, { schoolIds: { has: schoolId } }];
    if (gradeId)      where.gradeId      = gradeId;

    const batches = await prisma.batch.findMany({
      where,
      include: {
        _count:    { select: { students: true } },
        location:  { select: { id: true, name: true } },
        school:    { select: { id: true, name: true } },
        grade:     { select: { id: true, name: true } },
      },
      orderBy: [{ academicYear: "desc" }, { name: "asc" }],
    });

    return reply.send({ success: true, data: batches });
  });

  fastify.get("/batches/:id", async (request, reply) => {
    const { id } = request.params as any;
    const batch = await prisma.batch.findUnique({
      where: { id },
      include: {
        _count:   { select: { students: true } },
        location: { select: { id: true, name: true } },
        school:   { select: { id: true, name: true, city: true } },
        grade:    { select: { id: true, name: true } },
        batchSubjects: {
          include: {
            subject:  { select: { id: true, code: true, name: true } },
            employee: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { subject: { name: "asc" } },
        },
      },
    });
    if (!batch) return reply.status(404).send({ success: false, error: "Batch not found" });
    return reply.send({ success: true, data: batch });
  });

  fastify.post("/batches", async (request, reply) => {
    requireAdmin(request, reply);
    const parsed = batchSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ success: false, error: parsed.error.errors[0].message });

    const { startDate, schoolIds, ...rest } = parsed.data;
    // Sync schoolId (primary FK) from first of schoolIds if provided
    const schoolId = rest.schoolId ?? (schoolIds?.length ? schoolIds[0] : undefined);
    const batch = await prisma.batch.create({
      data: { ...rest, schoolId, schoolIds: schoolIds ?? [], startDate: startDate ? new Date(startDate) : undefined },
      include: {
        location: { select: { id: true, name: true } },
        school:   { select: { id: true, name: true } },
        grade:    { select: { id: true, name: true } },
      },
    });
    return reply.status(201).send({ success: true, data: batch });
  });

  fastify.patch("/batches/:id", async (request, reply) => {
    requireAdmin(request, reply);
    const { id } = request.params as any;
    const parsed = batchSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ success: false, error: parsed.error.errors[0].message });

    const { startDate, schoolIds, ...rest } = parsed.data;
    const schoolId = rest.schoolId !== undefined ? rest.schoolId : (schoolIds?.length ? schoolIds[0] : undefined);
    const batch = await prisma.batch.update({
      where: { id },
      data:  { ...rest, ...(schoolId !== undefined ? { schoolId } : {}), ...(schoolIds ? { schoolIds } : {}), startDate: startDate ? new Date(startDate) : undefined },
      include: {
        location: { select: { id: true, name: true } },
        school:   { select: { id: true, name: true } },
        grade:    { select: { id: true, name: true } },
      },
    });
    return reply.send({ success: true, data: batch });
  });

  fastify.patch("/batches/:id/archive", async (request, reply) => {
    requireAdmin(request, reply);
    const { id } = request.params as any;
    const batch = await prisma.batch.findUnique({ where: { id } });
    if (!batch) return reply.status(404).send({ success: false, error: "Batch not found" });

    const updated = await prisma.batch.update({
      where: { id },
      data: { isArchived: !batch.isArchived, isActive: batch.isArchived },
    });
    return reply.send({ success: true, data: updated });
  });

  fastify.delete("/batches/:id", async (request, reply) => {
    requireAdmin(request, reply);
    const { id } = request.params as any;
    const count = await prisma.student.count({ where: { batchId: id } });
    if (count > 0) return reply.status(400).send({ success: false, error: `Cannot delete — ${count} student(s) assigned to this batch` });

    await prisma.batch.delete({ where: { id } });
    return reply.send({ success: true });
  });

  // ── SUBJECTS ───────────────────────────────────────────────────────────────

  fastify.get("/subjects", async (request, reply) => {
    const { all } = request.query as any;
    const subjects = await prisma.subject.findMany({
      where:   all === "true" ? {} : { isActive: true },
      include: { _count: { select: { batchSubjects: true } } },
      orderBy: { name: "asc" },
    });
    return reply.send({ success: true, data: subjects });
  });

  fastify.post("/subjects", async (request, reply) => {
    requireAdmin(request, reply);
    const parsed = subjectSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ success: false, error: parsed.error.errors[0].message });

    const exists = await prisma.subject.findUnique({ where: { code: parsed.data.code } });
    if (exists) return reply.status(400).send({ success: false, error: `Subject code "${parsed.data.code}" already exists` });

    const subject = await prisma.subject.create({ data: parsed.data });
    return reply.status(201).send({ success: true, data: subject });
  });

  fastify.patch("/subjects/:id", async (request, reply) => {
    requireAdmin(request, reply);
    const { id } = request.params as any;
    const parsed = subjectSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ success: false, error: parsed.error.errors[0].message });

    if (parsed.data.code) {
      const conflict = await prisma.subject.findFirst({ where: { code: parsed.data.code, NOT: { id } } });
      if (conflict) return reply.status(400).send({ success: false, error: `Subject code "${parsed.data.code}" already exists` });
    }

    const subject = await prisma.subject.update({ where: { id }, data: parsed.data });
    return reply.send({ success: true, data: subject });
  });

  fastify.patch("/subjects/:id/toggle", async (request, reply) => {
    requireAdmin(request, reply);
    const { id } = request.params as any;
    const subject = await prisma.subject.findUnique({ where: { id } });
    if (!subject) return reply.status(404).send({ success: false, error: "Subject not found" });

    const updated = await prisma.subject.update({ where: { id }, data: { isActive: !subject.isActive } });
    return reply.send({ success: true, data: updated });
  });

  fastify.delete("/subjects/:id", async (request, reply) => {
    requireAdmin(request, reply);
    const { id } = request.params as any;
    const count = await prisma.batchSubject.count({ where: { subjectId: id } });
    if (count > 0) return reply.status(400).send({ success: false, error: `Cannot delete — subject is assigned to ${count} batch(es)` });

    await prisma.subject.delete({ where: { id } });
    return reply.send({ success: true });
  });

  // ── BATCH-SUBJECT ASSIGNMENTS ───────────────────────────────────────────────

  fastify.get("/batches/:id/subjects", async (request, reply) => {
    const { id } = request.params as any;
    const assignments = await prisma.batchSubject.findMany({
      where:   { batchId: id },
      include: {
        subject:  { select: { id: true, code: true, name: true } },
        employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
      },
      orderBy: { subject: { name: "asc" } },
    });
    return reply.send({ success: true, data: assignments });
  });

  fastify.put("/batches/:id/subjects", async (request, reply) => {
    requireAdmin(request, reply);
    const { id } = request.params as any;
    const { subjectId, employeeId } = (request.body as any) ?? {};
    if (!subjectId) return reply.status(400).send({ success: false, error: "subjectId required" });

    const assignment = await prisma.batchSubject.upsert({
      where:  { batchId_subjectId: { batchId: id, subjectId } },
      create: { batchId: id, subjectId, employeeId: employeeId ?? null },
      update: { employeeId: employeeId ?? null },
      include: {
        subject:  { select: { id: true, code: true, name: true } },
        employee: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    return reply.send({ success: true, data: assignment });
  });

  fastify.delete("/batches/:id/subjects/:subjectId", async (request, reply) => {
    requireAdmin(request, reply);
    const { id, subjectId } = request.params as any;
    await prisma.batchSubject.deleteMany({ where: { batchId: id, subjectId } });
    return reply.send({ success: true });
  });

  // ── BATCH-STUDENT MANAGEMENT ───────────────────────────────────────────────

  fastify.put("/batches/:id/students/:studentId", async (request, reply) => {
    requireAdmin(request, reply);
    const { id, studentId } = request.params as any;

    const batch = await prisma.batch.findUnique({ where: { id } });
    if (!batch) return reply.status(404).send({ success: false, error: "Batch not found" });

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { batchId: true, batchAssignedAt: true, batch: { select: { name: true, academicYear: true } } },
    });
    if (!student) return reply.status(404).send({ success: false, error: "Student not found" });

    if (student.batchId && student.batchId !== id) {
      await prisma.studentBatchHistory.create({
        data: {
          studentId, batchId: student.batchId,
          batchName: student.batch?.name ?? "",
          academicYear: student.batch?.academicYear,
          assignedAt: student.batchAssignedAt ?? new Date(),
          removedAt: new Date(),
        },
      });
    }

    const updated = await prisma.student.update({
      where: { id: studentId },
      data:  { batchId: id, batchAssignedAt: new Date() },
      select: { id: true, firstName: true, lastName: true, studentCode: true, status: true },
    });
    return reply.send({ success: true, data: updated });
  });

  fastify.delete("/batches/:id/students/:studentId", async (request, reply) => {
    requireAdmin(request, reply);
    const { id, studentId } = request.params as any;

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { batchId: true, batchAssignedAt: true, batch: { select: { name: true, academicYear: true } } },
    });
    if (!student) return reply.status(404).send({ success: false, error: "Student not found" });
    if (student.batchId !== id) return reply.status(400).send({ success: false, error: "Student is not in this batch" });

    await prisma.studentBatchHistory.create({
      data: {
        studentId, batchId: id,
        batchName: student.batch?.name ?? "",
        academicYear: student.batch?.academicYear,
        assignedAt: student.batchAssignedAt ?? new Date(),
        removedAt: new Date(),
      },
    });

    await prisma.student.update({
      where: { id: studentId },
      data:  { batchId: null, batchAssignedAt: null },
    });
    return reply.send({ success: true });
  });

  fastify.patch("/batches/:id/students/:studentId/status", async (request, reply) => {
    requireAdmin(request, reply);
    const { studentId } = request.params as any;
    const { status } = request.body as any;

    const valid = ["ACTIVE", "INACTIVE", "SUSPENDED", "GRADUATED", "DROPPED"];
    if (!valid.includes(status)) return reply.status(400).send({ success: false, error: "Invalid status" });

    const updated = await prisma.student.update({
      where: { id: studentId },
      data:  { status },
      select: { id: true, status: true },
    });
    return reply.send({ success: true, data: updated });
  });

}
