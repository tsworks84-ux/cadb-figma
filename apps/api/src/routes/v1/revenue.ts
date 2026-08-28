import type { FastifyInstance } from "fastify";
import { prisma } from "@cadb/db";
import { authenticate } from "../../middleware/authenticate.js";
import { fullName } from "../../utils/name.js";

function requireAdmin(request: any, reply: any): boolean {
  const role = request.user?.role;
  if (!["SUPER_ADMIN", "HR_ADMIN"].includes(role)) {
    reply.status(403).send({ success: false, error: "Insufficient permissions" });
    return false;
  }
  return true;
}

export async function revenueRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  // ── FILTER METADATA ────────────────────────────────────────────────────────

  fastify.get("/meta", async (request, reply) => {
    if (!requireAdmin(request, reply)) return;

    const [academicYears, batches, schools] = await Promise.all([
      prisma.academicYear.findMany({
        where: { isArchived: false },
        orderBy: { name: "desc" },
      }),
      prisma.batch.findMany({
        where: { isArchived: false },
        select: { id: true, name: true, academicYear: true },
        orderBy: { name: "asc" },
      }),
      prisma.school.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);

    return reply.send({ success: true, data: { academicYears, batches, schools } });
  });

  // ── FEE REPORT ─────────────────────────────────────────────────────────────
  // Query params:
  //   academicYear  — filter by student.academicYear
  //   batchId       — filter to students in that batch
  //   schoolId      — filter by student.schoolId
  //   dateFrom      — filter by student.admissionDate >=
  //   dateTo        — filter by student.admissionDate <=

  fastify.get("/report", async (request, reply) => {
    if (!requireAdmin(request, reply)) return;

    const { academicYear, batchId, schoolId, dateFrom, dateTo } = request.query as any;

    const studentWhere: any = { isArchived: false };
    if (academicYear) studentWhere.academicYear = academicYear;
    if (schoolId)     studentWhere.schoolId = schoolId;
    if (batchId)      studentWhere.studentBatches = { some: { batchId } };
    if (dateFrom || dateTo) {
      studentWhere.admissionDate = {};
      if (dateFrom) studentWhere.admissionDate.gte = new Date(dateFrom);
      if (dateTo)   studentWhere.admissionDate.lte = new Date(dateTo);
    }

    const [students, schools, batches] = await Promise.all([
      prisma.student.findMany({
        where: studentWhere,
        select: {
          id: true,
          studentCode: true,
          firstName: true,
          middleName: true,
          lastName: true,
          academicYear: true,
          admissionDate: true,
          schoolId: true,
          totalFee: true,
          paidFee: true,
          discountAmount: true,
          discountType: true,
          studentBatches: {
            select: {
              batchId: true,
              batch: { select: { name: true, academicYear: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.school.findMany({ select: { id: true, name: true } }),
      prisma.batch.findMany({
        where: { isArchived: false },
        select: { id: true, name: true, academicYear: true },
      }),
    ]);

    const schoolMap = Object.fromEntries(schools.map((s) => [s.id, s.name]));
    const batchMap  = Object.fromEntries(batches.map((b) => [b.id, b]));

    // Per-student computed row
    const studentRows = students.map((st) => {
      const totalFee      = st.totalFee      ?? 0;
      const discount      = st.discountAmount ?? 0;
      const paidFee       = st.paidFee       ?? 0;
      const netReceivable = Math.max(0, totalFee - discount);
      const balanceDue    = Math.max(0, netReceivable - paidFee);
      return {
        id: st.id,
        studentCode: st.studentCode,
        name: fullName(st),
        school: st.schoolId ? (schoolMap[st.schoolId] ?? "Unknown") : "Not Assigned",
        academicYear: st.academicYear ?? "Not Assigned",
        admissionDate: st.admissionDate,
        batches: st.studentBatches.map((sb) => ({
          id: sb.batchId,
          name: batchMap[sb.batchId]?.name ?? "Unknown",
        })),
        totalFee,
        discountAmount: discount,
        netReceivable,
        paidFee,
        balanceDue,
      };
    });

    // Overall summary
    const summary = studentRows.reduce(
      (acc, st) => ({
        studentCount:   acc.studentCount   + 1,
        totalFee:       acc.totalFee       + st.totalFee,
        totalDiscount:  acc.totalDiscount  + st.discountAmount,
        netReceivable:  acc.netReceivable  + st.netReceivable,
        totalReceived:  acc.totalReceived  + st.paidFee,
        totalDue:       acc.totalDue       + st.balanceDue,
      }),
      { studentCount: 0, totalFee: 0, totalDiscount: 0, netReceivable: 0, totalReceived: 0, totalDue: 0 },
    );

    // Group by batch (student counted in each batch they belong to)
    const batchAgg: Record<string, { id: string; label: string; studentCount: number; totalFee: number; totalDiscount: number; netReceivable: number; totalReceived: number; totalDue: number }> = {};
    for (const st of studentRows) {
      const entries = st.batches.length > 0 ? st.batches : [{ id: "__none__", name: "No Batch" }];
      for (const b of entries) {
        if (!batchAgg[b.id]) batchAgg[b.id] = { id: b.id, label: b.name, studentCount: 0, totalFee: 0, totalDiscount: 0, netReceivable: 0, totalReceived: 0, totalDue: 0 };
        batchAgg[b.id].studentCount++;
        batchAgg[b.id].totalFee       += st.totalFee;
        batchAgg[b.id].totalDiscount  += st.discountAmount;
        batchAgg[b.id].netReceivable  += st.netReceivable;
        batchAgg[b.id].totalReceived  += st.paidFee;
        batchAgg[b.id].totalDue       += st.balanceDue;
      }
    }

    // Group by school
    const schoolAgg: Record<string, any> = {};
    for (const st of studentRows) {
      const key = st.school;
      if (!schoolAgg[key]) schoolAgg[key] = { label: key, studentCount: 0, totalFee: 0, totalDiscount: 0, netReceivable: 0, totalReceived: 0, totalDue: 0 };
      schoolAgg[key].studentCount++;
      schoolAgg[key].totalFee       += st.totalFee;
      schoolAgg[key].totalDiscount  += st.discountAmount;
      schoolAgg[key].netReceivable  += st.netReceivable;
      schoolAgg[key].totalReceived  += st.paidFee;
      schoolAgg[key].totalDue       += st.balanceDue;
    }

    // Group by academic year
    const yearAgg: Record<string, any> = {};
    for (const st of studentRows) {
      const key = st.academicYear;
      if (!yearAgg[key]) yearAgg[key] = { label: key, studentCount: 0, totalFee: 0, totalDiscount: 0, netReceivable: 0, totalReceived: 0, totalDue: 0 };
      yearAgg[key].studentCount++;
      yearAgg[key].totalFee       += st.totalFee;
      yearAgg[key].totalDiscount  += st.discountAmount;
      yearAgg[key].netReceivable  += st.netReceivable;
      yearAgg[key].totalReceived  += st.paidFee;
      yearAgg[key].totalDue       += st.balanceDue;
    }

    return reply.send({
      success: true,
      data: {
        summary,
        byBatch:        Object.values(batchAgg).sort((a, b) => b.netReceivable - a.netReceivable),
        bySchool:       Object.values(schoolAgg).sort((a, b) => b.netReceivable - a.netReceivable),
        byAcademicYear: Object.values(yearAgg).sort((a, b) => b.label.localeCompare(a.label)),
        students:       studentRows,
      },
    });
  });
}
