import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@cadb/db";
import { authenticate } from "../../middleware/authenticate.js";

function requireAdmin(request: any, reply: any) {
  const role = request.user?.role;
  if (!["SUPER_ADMIN", "HR_ADMIN"].includes(role)) {
    return reply.status(403).send({ success: false, error: "Insufficient permissions" });
  }
}

// ── Academic Years ─────────────────────────────────────────────────────────────
const academicYearSchema = z.object({
  name: z.string().min(1),
  isActive: z.boolean().optional(),
});

// ── Target Exams ───────────────────────────────────────────────────────────────
const targetExamSchema = z.object({
  code: z.string().min(1).toUpperCase(),
  name: z.string().min(1),
  category: z.enum(["BOARD", "COMPETITIVE", "ENTRANCE"]).default("BOARD"),
  isActive: z.boolean().optional(),
});

// ── Grades ─────────────────────────────────────────────────────────────────────
const gradeSchema = z.object({
  name: z.string().min(1),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

// ── Schools ────────────────────────────────────────────────────────────────────
const schoolSchema = z.object({
  name: z.string().min(1),
  city: z.string().optional(),
  board: z.string().optional(),
  isActive: z.boolean().optional(),
});

// ── Locations ──────────────────────────────────────────────────────────────────
const locationSchema = z.object({
  name:     z.string().min(1),
  isActive: z.boolean().optional(),
});

// ── Centres ────────────────────────────────────────────────────────────────────
const centreSchema = z.object({
  name:     z.string().min(1),
  cityId:   z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export async function academicSettingsRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  // ── ACADEMIC YEARS ─────────────────────────────────────────────────────────

  fastify.get("/academic-years", async (request, reply) => {
    const { all } = request.query as any;
    const years = await prisma.academicYear.findMany({
      where: all === "true" ? {} : { isArchived: false },
      orderBy: { name: "desc" },
    });
    return reply.send({ success: true, data: years });
  });

  fastify.post("/academic-years", async (request, reply) => {
    requireAdmin(request, reply);
    const parsed = academicYearSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ success: false, error: parsed.error.errors[0].message });

    const exists = await prisma.academicYear.findUnique({ where: { name: parsed.data.name } });
    if (exists) return reply.status(400).send({ success: false, error: `Academic year "${parsed.data.name}" already exists` });

    const year = await prisma.academicYear.create({ data: parsed.data });
    return reply.status(201).send({ success: true, data: year });
  });

  fastify.patch("/academic-years/:id", async (request, reply) => {
    requireAdmin(request, reply);
    const { id } = request.params as any;
    const parsed = academicYearSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ success: false, error: parsed.error.errors[0].message });

    if (parsed.data.name) {
      const conflict = await prisma.academicYear.findFirst({ where: { name: parsed.data.name, NOT: { id } } });
      if (conflict) return reply.status(400).send({ success: false, error: `Academic year "${parsed.data.name}" already exists` });
    }

    const year = await prisma.academicYear.update({ where: { id }, data: parsed.data });
    return reply.send({ success: true, data: year });
  });

  fastify.patch("/academic-years/:id/archive", async (request, reply) => {
    requireAdmin(request, reply);
    const { id } = request.params as any;
    const year = await prisma.academicYear.findUnique({ where: { id } });
    if (!year) return reply.status(404).send({ success: false, error: "Academic year not found" });

    const updated = await prisma.academicYear.update({
      where: { id },
      data: { isArchived: !year.isArchived, isActive: year.isArchived },
    });
    return reply.send({ success: true, data: updated });
  });

  fastify.delete("/academic-years/:id", async (request, reply) => {
    requireAdmin(request, reply);
    const { id } = request.params as any;
    await prisma.academicYear.delete({ where: { id } });
    return reply.send({ success: true });
  });

  // ── TARGET EXAMS ───────────────────────────────────────────────────────────

  fastify.get("/target-exams", async (request, reply) => {
    const { all } = request.query as any;
    const exams = await prisma.targetExam.findMany({
      where: all === "true" ? {} : { isActive: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });
    return reply.send({ success: true, data: exams });
  });

  fastify.post("/target-exams", async (request, reply) => {
    requireAdmin(request, reply);
    const parsed = targetExamSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ success: false, error: parsed.error.errors[0].message });

    const exists = await prisma.targetExam.findUnique({ where: { code: parsed.data.code } });
    if (exists) return reply.status(400).send({ success: false, error: `Exam code "${parsed.data.code}" already exists` });

    const exam = await prisma.targetExam.create({ data: parsed.data });
    return reply.status(201).send({ success: true, data: exam });
  });

  fastify.patch("/target-exams/:id", async (request, reply) => {
    requireAdmin(request, reply);
    const { id } = request.params as any;
    const parsed = targetExamSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ success: false, error: parsed.error.errors[0].message });

    if (parsed.data.code) {
      const conflict = await prisma.targetExam.findFirst({ where: { code: parsed.data.code, NOT: { id } } });
      if (conflict) return reply.status(400).send({ success: false, error: `Exam code "${parsed.data.code}" already exists` });
    }

    const exam = await prisma.targetExam.update({ where: { id }, data: parsed.data });
    return reply.send({ success: true, data: exam });
  });

  fastify.patch("/target-exams/:id/toggle", async (request, reply) => {
    requireAdmin(request, reply);
    const { id } = request.params as any;
    const exam = await prisma.targetExam.findUnique({ where: { id } });
    if (!exam) return reply.status(404).send({ success: false, error: "Exam not found" });

    const updated = await prisma.targetExam.update({ where: { id }, data: { isActive: !exam.isActive } });
    return reply.send({ success: true, data: updated });
  });

  fastify.delete("/target-exams/:id", async (request, reply) => {
    requireAdmin(request, reply);
    const { id } = request.params as any;
    await prisma.targetExam.delete({ where: { id } });
    return reply.send({ success: true });
  });

  // ── GRADES ─────────────────────────────────────────────────────────────────

  fastify.get("/grades", async (request, reply) => {
    const { all } = request.query as any;
    const grades = await prisma.grade.findMany({
      where: all === "true" ? {} : { isActive: true },
      orderBy: { sortOrder: "asc" },
    });
    return reply.send({ success: true, data: grades });
  });

  fastify.post("/grades", async (request, reply) => {
    requireAdmin(request, reply);
    const parsed = gradeSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ success: false, error: parsed.error.errors[0].message });

    const exists = await prisma.grade.findUnique({ where: { name: parsed.data.name } });
    if (exists) return reply.status(400).send({ success: false, error: `Grade "${parsed.data.name}" already exists` });

    const grade = await prisma.grade.create({ data: parsed.data });
    return reply.status(201).send({ success: true, data: grade });
  });

  fastify.patch("/grades/:id", async (request, reply) => {
    requireAdmin(request, reply);
    const { id } = request.params as any;
    const parsed = gradeSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ success: false, error: parsed.error.errors[0].message });

    if (parsed.data.name) {
      const conflict = await prisma.grade.findFirst({ where: { name: parsed.data.name, NOT: { id } } });
      if (conflict) return reply.status(400).send({ success: false, error: `Grade "${parsed.data.name}" already exists` });
    }

    const grade = await prisma.grade.update({ where: { id }, data: parsed.data });
    return reply.send({ success: true, data: grade });
  });

  fastify.patch("/grades/:id/toggle", async (request, reply) => {
    requireAdmin(request, reply);
    const { id } = request.params as any;
    const grade = await prisma.grade.findUnique({ where: { id } });
    if (!grade) return reply.status(404).send({ success: false, error: "Grade not found" });

    const updated = await prisma.grade.update({ where: { id }, data: { isActive: !grade.isActive } });
    return reply.send({ success: true, data: updated });
  });

  fastify.delete("/grades/:id", async (request, reply) => {
    requireAdmin(request, reply);
    const { id } = request.params as any;
    await prisma.grade.delete({ where: { id } });
    return reply.send({ success: true });
  });

  // ── SCHOOLS ────────────────────────────────────────────────────────────────

  fastify.get("/schools", async (request, reply) => {
    const { all } = request.query as any;
    const schools = await prisma.school.findMany({
      where: all === "true" ? {} : { isActive: true },
      orderBy: { name: "asc" },
    });
    return reply.send({ success: true, data: schools });
  });

  fastify.post("/schools", async (request, reply) => {
    requireAdmin(request, reply);
    const parsed = schoolSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ success: false, error: parsed.error.errors[0].message });

    const school = await prisma.school.create({ data: parsed.data });
    return reply.status(201).send({ success: true, data: school });
  });

  fastify.patch("/schools/:id", async (request, reply) => {
    requireAdmin(request, reply);
    const { id } = request.params as any;
    const parsed = schoolSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ success: false, error: parsed.error.errors[0].message });

    const school = await prisma.school.update({ where: { id }, data: parsed.data });
    return reply.send({ success: true, data: school });
  });

  fastify.patch("/schools/:id/toggle", async (request, reply) => {
    requireAdmin(request, reply);
    const { id } = request.params as any;
    const school = await prisma.school.findUnique({ where: { id } });
    if (!school) return reply.status(404).send({ success: false, error: "School not found" });

    const updated = await prisma.school.update({ where: { id }, data: { isActive: !school.isActive } });
    return reply.send({ success: true, data: updated });
  });

  fastify.delete("/schools/:id", async (request, reply) => {
    requireAdmin(request, reply);
    const { id } = request.params as any;
    await prisma.school.delete({ where: { id } });
    return reply.send({ success: true });
  });

  // ── LOCATIONS ─────────────────────────────────────────────────────────────

  fastify.get("/locations", async (request, reply) => {
    const { all } = request.query as any;
    const locations = await prisma.location.findMany({
      where: all === "true" ? {} : { isActive: true },
      orderBy: { name: "asc" },
    });
    return reply.send({ success: true, data: locations });
  });

  fastify.post("/locations", async (request, reply) => {
    requireAdmin(request, reply);
    const parsed = locationSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ success: false, error: parsed.error.errors[0].message });

    const exists = await prisma.location.findUnique({ where: { name: parsed.data.name } });
    if (exists) return reply.status(400).send({ success: false, error: `Location "${parsed.data.name}" already exists` });

    const location = await prisma.location.create({ data: parsed.data });
    return reply.status(201).send({ success: true, data: location });
  });

  fastify.patch("/locations/:id", async (request, reply) => {
    requireAdmin(request, reply);
    const { id } = request.params as any;
    const parsed = locationSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ success: false, error: parsed.error.errors[0].message });

    if (parsed.data.name) {
      const conflict = await prisma.location.findFirst({ where: { name: parsed.data.name, NOT: { id } } });
      if (conflict) return reply.status(400).send({ success: false, error: `Location "${parsed.data.name}" already exists` });
    }

    const location = await prisma.location.update({ where: { id }, data: parsed.data });
    return reply.send({ success: true, data: location });
  });

  fastify.patch("/locations/:id/toggle", async (request, reply) => {
    requireAdmin(request, reply);
    const { id } = request.params as any;
    const loc = await prisma.location.findUnique({ where: { id } });
    if (!loc) return reply.status(404).send({ success: false, error: "Location not found" });

    const updated = await prisma.location.update({ where: { id }, data: { isActive: !loc.isActive } });
    return reply.send({ success: true, data: updated });
  });

  fastify.delete("/locations/:id", async (request, reply) => {
    requireAdmin(request, reply);
    const { id } = request.params as any;
    const count = await prisma.batch.count({ where: { locationId: id } });
    if (count > 0) return reply.status(400).send({ success: false, error: `Cannot delete — ${count} batch(es) use this location` });

    await prisma.location.delete({ where: { id } });
    return reply.send({ success: true });
  });

  // ── CENTRES ───────────────────────────────────────────────────────────────

  fastify.get("/centres", async (request, reply) => {
    const { all } = request.query as any;
    const centres = await prisma.centre.findMany({
      where: all === "true" ? {} : { isActive: true },
      include: { city: { select: { id: true, name: true } } },
      orderBy: { name: "asc" },
    });
    return reply.send({ success: true, data: centres });
  });

  fastify.post("/centres", async (request, reply) => {
    requireAdmin(request, reply);
    const parsed = centreSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ success: false, error: parsed.error.errors[0].message });

    const exists = await prisma.centre.findUnique({ where: { name: parsed.data.name } });
    if (exists) return reply.status(400).send({ success: false, error: `Centre "${parsed.data.name}" already exists` });

    const { cityId, ...rest } = parsed.data;
    const centre = await prisma.centre.create({
      data: { ...rest, cityId: cityId || null },
      include: { city: { select: { id: true, name: true } } },
    });
    return reply.status(201).send({ success: true, data: centre });
  });

  fastify.patch("/centres/:id", async (request, reply) => {
    requireAdmin(request, reply);
    const { id } = request.params as any;
    const parsed = centreSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ success: false, error: parsed.error.errors[0].message });

    if (parsed.data.name) {
      const conflict = await prisma.centre.findFirst({ where: { name: parsed.data.name, NOT: { id } } });
      if (conflict) return reply.status(400).send({ success: false, error: `Centre "${parsed.data.name}" already exists` });
    }

    const { cityId, ...rest } = parsed.data;
    const centre = await prisma.centre.update({
      where: { id },
      data: { ...rest, ...(cityId !== undefined ? { cityId: cityId || null } : {}) },
      include: { city: { select: { id: true, name: true } } },
    });
    return reply.send({ success: true, data: centre });
  });

  fastify.patch("/centres/:id/toggle", async (request, reply) => {
    requireAdmin(request, reply);
    const { id } = request.params as any;
    const centre = await prisma.centre.findUnique({ where: { id } });
    if (!centre) return reply.status(404).send({ success: false, error: "Centre not found" });

    const updated = await prisma.centre.update({
      where: { id },
      data: { isActive: !centre.isActive },
      include: { city: { select: { id: true, name: true } } },
    });
    return reply.send({ success: true, data: updated });
  });

  fastify.delete("/centres/:id", async (request, reply) => {
    requireAdmin(request, reply);
    const { id } = request.params as any;
    await prisma.centre.delete({ where: { id } });
    return reply.send({ success: true });
  });

  // ── Courses ────────────────────────────────────────────────────────────────

  const courseSchema = z.object({
    name:        z.string().min(1),
    code:        z.string().optional(),
    description: z.string().optional(),
    duration:    z.string().optional(),
    fee:         z.number().min(0).optional(),
    isActive:    z.boolean().optional(),
  });

  fastify.get("/courses", async (request, reply) => {
    const courses = await prisma.course.findMany({ orderBy: { name: "asc" } });
    return reply.send({ success: true, data: courses });
  });

  fastify.post("/courses", async (request, reply) => {
    requireAdmin(request, reply);
    const parsed = courseSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ success: false, error: parsed.error.errors[0].message });

    if (parsed.data.code) {
      const exists = await prisma.course.findUnique({ where: { code: parsed.data.code } });
      if (exists) return reply.status(400).send({ success: false, error: `Course code "${parsed.data.code}" already exists` });
    }

    const course = await prisma.course.create({ data: parsed.data });
    return reply.status(201).send({ success: true, data: course });
  });

  fastify.patch("/courses/:id", async (request, reply) => {
    requireAdmin(request, reply);
    const { id } = request.params as any;
    const parsed = courseSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ success: false, error: parsed.error.errors[0].message });

    const course = await prisma.course.update({ where: { id }, data: parsed.data });
    return reply.send({ success: true, data: course });
  });

  fastify.patch("/courses/:id/toggle", async (request, reply) => {
    requireAdmin(request, reply);
    const { id } = request.params as any;
    const course = await prisma.course.findUnique({ where: { id } });
    if (!course) return reply.status(404).send({ success: false, error: "Course not found" });

    const updated = await prisma.course.update({ where: { id }, data: { isActive: !course.isActive } });
    return reply.send({ success: true, data: updated });
  });

  fastify.delete("/courses/:id", async (request, reply) => {
    requireAdmin(request, reply);
    const { id } = request.params as any;
    await prisma.course.delete({ where: { id } });
    return reply.send({ success: true });
  });

  // ── Instalment Plans ───────────────────────────────────────────────────────

  const planItemSchema = z.object({
    instalmentNo:      z.number().int().positive(),
    label:             z.string().optional(),
    amount:            z.number().min(0),
    daysFromAdmission: z.number().int().min(0).optional(),
    dueDate:           z.string().optional(),
  });

  const planSchema = z.object({
    name:        z.string().min(1),
    courseId:    z.string().optional().nullable(),
    description: z.string().optional(),
    isActive:    z.boolean().optional(),
    items:       z.array(planItemSchema).optional(),
  });

  // List — optionally filter by courseId; always include generic (no course) plans
  fastify.get("/instalment-plans", async (request, reply) => {
    const { courseId } = request.query as any;
    const plans = await prisma.instalmentPlan.findMany({
      where: courseId
        ? { OR: [{ courseId }, { courseId: null }] }
        : {},
      orderBy: { name: "asc" },
      include: {
        course: { select: { id: true, name: true } },
        items:  { orderBy: { instalmentNo: "asc" } },
      },
    });
    return reply.send({ success: true, data: plans });
  });

  fastify.get("/instalment-plans/:id", async (request, reply) => {
    const { id } = request.params as any;
    const plan = await prisma.instalmentPlan.findUnique({
      where: { id },
      include: {
        course: { select: { id: true, name: true } },
        items:  { orderBy: { instalmentNo: "asc" } },
      },
    });
    if (!plan) return reply.status(404).send({ success: false, error: "Plan not found" });
    return reply.send({ success: true, data: plan });
  });

  fastify.post("/instalment-plans", async (request, reply) => {
    requireAdmin(request, reply);
    const parsed = planSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ success: false, error: parsed.error.errors[0].message });

    const { items, courseId, ...rest } = parsed.data;
    const plan = await prisma.instalmentPlan.create({
      data: {
        ...rest,
        courseId: courseId || null,
        items: items?.length
          ? { createMany: { data: items.map((it) => ({ ...it, dueDate: it.dueDate ? new Date(it.dueDate) : undefined })) } }
          : undefined,
      },
      include: { items: { orderBy: { instalmentNo: "asc" } } },
    });
    return reply.status(201).send({ success: true, data: plan });
  });

  fastify.patch("/instalment-plans/:id", async (request, reply) => {
    requireAdmin(request, reply);
    const { id } = request.params as any;
    const parsed = planSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ success: false, error: parsed.error.errors[0].message });

    const { items, courseId, ...rest } = parsed.data;

    // Replace items if provided
    if (items !== undefined) {
      await prisma.instalmentPlanItem.deleteMany({ where: { planId: id } });
      if (items.length) {
        await prisma.instalmentPlanItem.createMany({
          data: items.map((it) => ({ ...it, planId: id, dueDate: it.dueDate ? new Date(it.dueDate) : undefined })),
        });
      }
    }

    const plan = await prisma.instalmentPlan.update({
      where: { id },
      data: { ...rest, ...(courseId !== undefined ? { courseId: courseId || null } : {}) },
      include: { items: { orderBy: { instalmentNo: "asc" } } },
    });
    return reply.send({ success: true, data: plan });
  });

  fastify.patch("/instalment-plans/:id/toggle", async (request, reply) => {
    requireAdmin(request, reply);
    const { id } = request.params as any;
    const plan = await prisma.instalmentPlan.findUnique({ where: { id } });
    if (!plan) return reply.status(404).send({ success: false, error: "Plan not found" });
    const updated = await prisma.instalmentPlan.update({ where: { id }, data: { isActive: !plan.isActive } });
    return reply.send({ success: true, data: updated });
  });

  fastify.delete("/instalment-plans/:id", async (request, reply) => {
    requireAdmin(request, reply);
    const { id } = request.params as any;
    await prisma.instalmentPlan.delete({ where: { id } });
    return reply.send({ success: true });
  });
}
