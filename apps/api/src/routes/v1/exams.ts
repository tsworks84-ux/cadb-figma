import { type FastifyPluginAsync, type FastifyReply } from "fastify";
import { prisma } from "@cadb/db";
import { z } from "zod";
import type { JwtPayload } from "@cadb/types";
import { authenticate } from "../../middleware/authenticate.js";
import {
  DEFAULT_STAGES, OPEN_STATUSES, actorFor, daysBetween, isOverdue, openBlockers,
  syncExamStages, todayIST, utcDay, type SyncResult,
} from "../../utils/examTracking.js";
import { notifyExamStaff, notifyExamStudents } from "../../utils/notify/exam.js";

/**
 * Exam operations: who does what for each exam, by when, and whether it's done.
 *
 * Access
 *   • Settings (exam team, exam types, stage timings): Super Admin only.
 *   • Exam board and per-exam setup: Super Admin and the exam team
 *     (Controller of Examinations, Examination Executive).
 *   • My Tasks: everyone — it only ever shows the caller's own stages.
 *   • A stage can be updated by its owner, the exam's Controller/Executive,
 *     any Controller on the team, or a Super Admin. Bypass, reopen and the
 *     results release can only be undone at Controller level.
 */

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
const fmt = (d: Date) => dateFmt.format(d);

type TeamRole = "CONTROLLER" | "EXECUTIVE" | null;

async function teamRoleOf(employeeId: string): Promise<TeamRole> {
  const m = await prisma.examTeamMember.findUnique({ where: { employeeId }, select: { role: true } });
  return (m?.role as TeamRole) ?? null;
}

type Access = { user: JwtPayload; isSA: boolean; teamRole: TeamRole };

async function accessOf(user: JwtPayload): Promise<Access> {
  return { user, isSA: user.role === "SUPER_ADMIN", teamRole: await teamRoleOf(user.sub) };
}

const canViewBoard = (a: Access) => a.isSA || a.teamRole !== null;
/** Controller-level powers on a given exam. */
const isControllerFor = (a: Access, exam: { controllerId: string | null }) =>
  a.isSA || a.teamRole === "CONTROLLER" || exam.controllerId === a.user.sub;
/** May change the exam's setup and reassign owners. */
const canManageExam = (a: Access, exam: { controllerId: string | null; executiveId: string | null }) =>
  isControllerFor(a, exam) || a.teamRole === "EXECUTIVE" || exam.executiveId === a.user.sub;

const forbidden = (reply: FastifyReply, error = "You don't have access to this") =>
  reply.status(403).send({ success: false, error, statusCode: 403 });

const nameSel = { select: { id: true, firstName: true, lastName: true, employeeCode: true } } as const;

const stageDefSchema = z.object({
  sequenceNo:  z.number().int().min(1).max(99),
  name:        z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).nullable().optional(),
  offsetDays:  z.number().int().min(-180).max(180),
  ownerRole:   z.enum(["CONTROLLER", "EXECUTIVE", "PAPER_SETTER", "REVIEWER"]),
  scope:       z.enum(["EXAM", "SUBJECT"]),
  mode:        z.enum(["PEN_PAPER", "ONLINE"]).nullable().optional(),
  action:      z.enum(["NOTIFY_STUDENTS", "RELEASE_RESULTS"]).nullable().optional(),
  canBypass:   z.boolean().optional(),
});

function validateStageList(stages: z.infer<typeof stageDefSchema>[]): string | null {
  if (stages.length === 0) return "Add at least one stage";
  const seqs = new Set<number>();
  for (const s of stages) {
    if (seqs.has(s.sequenceNo)) return `Two stages share step number ${s.sequenceNo}`;
    seqs.add(s.sequenceNo);
  }
  if (stages.filter((s) => s.action === "NOTIFY_STUDENTS").length > 1) return "Only one stage can send the exam notice";
  if (stages.filter((s) => s.action === "RELEASE_RESULTS").length > 1) return "Only one stage can release results";
  if (stages.some((s) => s.action && s.canBypass)) return "Stages that notify students or release results can't be bypassable";
  if (stages.some((s) => s.scope === "EXAM" && (s.ownerRole === "PAPER_SETTER" || s.ownerRole === "REVIEWER"))) {
    return "Paper setter and reviewer stages must be per subject";
  }
  return null;
}

// ─── Stage view model ────────────────────────────────────────────────────────

function stageView(s: any, all: any[], today: Date) {
  const overdue = isOverdue(s, today);
  return {
    id: s.id, sequenceNo: s.sequenceNo, name: s.name, description: s.description,
    ownerRole: s.ownerRole, scope: s.scope, action: s.action, canBypass: s.canBypass,
    paperNum: s.paperNum, subjectSlot: s.subjectSlot, subjectLabel: s.subjectLabel,
    plannedDate: s.plannedDate, status: s.status, startedAt: s.startedAt,
    completedAt: s.completedAt, remarks: s.remarks, evidenceUrl: s.evidenceUrl,
    bypassReason: s.bypassReason, ownerOverridden: s.ownerOverridden,
    owner: s.owner ?? null,
    overdue,
    daysLate: overdue ? daysBetween(s.plannedDate, today)
      : s.completedAt ? Math.max(0, daysBetween(s.plannedDate, utcDay(s.completedAt))) : 0,
    blockedBy: openBlockers(s, all).map((b: any) => ({ id: b.id, name: b.name, subjectLabel: b.subjectLabel })),
    events: s.events,
  };
}

/** Where an exam stands: the earliest open stage, and how many are late. */
function examSummary(stages: any[], today: Date) {
  const sorted = [...stages].sort((a, b) => a.sequenceNo - b.sequenceNo || a.paperNum - b.paperNum || a.subjectSlot - b.subjectSlot);
  const open = sorted.filter((s) => OPEN_STATUSES.includes(s.status));
  const overdue = open.filter((s) => isOverdue(s, today));
  const current = open[0] ?? null;
  return {
    total: stages.length,
    done: stages.length - open.length,
    overdue: overdue.length,
    currentStage: current ? { name: current.name, subjectLabel: current.subjectLabel, plannedDate: current.plannedDate, overdue: isOverdue(current, today) } : null,
    health: overdue.length > 0 ? "LATE" : open.some((s) => daysBetween(today, s.plannedDate) <= 2) ? "DUE_SOON" : open.length === 0 && stages.length > 0 ? "COMPLETE" : "ON_TRACK",
  };
}

// ─── Notifications ───────────────────────────────────────────────────────────

export async function notifyAssignments(examId: string, sync: SyncResult) {
  if (sync.newAssignments.size === 0) return;
  const exam = await prisma.exam.findUnique({ where: { id: examId }, select: { name: true, examDate: true } });
  if (!exam) return;
  const stageIds = [...sync.newAssignments.values()].flat();
  const stages = await prisma.examStage.findMany({ where: { id: { in: stageIds } }, orderBy: { plannedDate: "asc" } });
  const byId = new Map(stages.map((s) => [s.id, s]));
  await notifyExamStaff("EXAM_TASKS_ASSIGNED", {
    examId,
    employeeIds: [...sync.newAssignments.keys()],
    path: "/dashboard/exams/tasks",
    fields: { examName: exam.name, examDate: fmt(exam.examDate) },
    fieldsFor: (id) => {
      const mine = (sync.newAssignments.get(id) ?? []).map((sid) => byId.get(sid)).filter(Boolean) as typeof stages;
      if (mine.length === 0) return null;
      return {
        taskCount: String(mine.length),
        taskSummary: mine.map((s) => `${s.name}${s.subjectLabel ? ` (${s.subjectLabel})` : ""} — due ${fmt(s.plannedDate)}`).join("\n"),
      };
    },
  });
}

/** What happens when a NOTIFY_STUDENTS / RELEASE_RESULTS stage is completed. */
async function runStageAction(action: string, examId: string, actorId: string): Promise<string | null> {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: {
      subjects: { include: { subject: { select: { name: true } } }, orderBy: [{ paperNum: "asc" }, { subjectSlot: "asc" }] },
    },
  });
  if (!exam) return null;
  const subjectName = (p: number, s: number) => {
    const row = exam.subjects.find((x) => x.paperNum === p && x.subjectSlot === s);
    const name = row?.subject?.name ?? `Subject ${s}`;
    return exam.numPapers > 1 ? `Paper ${p} · ${name}` : name;
  };

  if (action === "NOTIFY_STUDENTS") {
    const syllabus = exam.subjects
      .map((s) => `${subjectName(s.paperNum, s.subjectSlot)}: ${s.topics?.trim() || "To be announced"}`)
      .join("\n");
    const res = await notifyExamStudents("EXAM_SCHEDULED", {
      examId,
      fields: { examName: exam.name, examDate: fmt(exam.examDate), examTime: `${exam.startTime} – ${exam.endTime}`, syllabus },
    });
    await prisma.exam.update({ where: { id: examId }, data: { studentsNotifiedAt: new Date() } });
    return res.disabled
      ? "Stage done. Student/parent emails are switched off in Administration → Notifications, so no email was sent."
      : `Exam notice queued: ${res.queued} email(s) to students and parents.`;
  }

  if (action === "RELEASE_RESULTS") {
    await prisma.exam.update({ where: { id: examId }, data: { resultsReleasedAt: new Date(), resultsReleasedById: actorId } });
    const results = await prisma.examResult.findMany({
      where: { examId, isExcluded: false },
      include: { marks: true },
    });
    const byStudent = new Map(results.map((r) => [r.studentId, r]));
    const maxTotal = exam.totalMarks ?? (exam.subjects.every((s) => s.maxMarks != null)
      ? exam.subjects.reduce((sum, s) => sum + (s.maxMarks ?? 0), 0) : null);
    const res = await notifyExamStudents("EXAM_RESULTS_RELEASED", {
      examId,
      fields: { examName: exam.name, examDate: fmt(exam.examDate) },
      fieldsFor: (studentId) => {
        const r = byStudent.get(studentId);
        if (!r) return null; // no marks recorded: nothing to report
        if (!r.attended) return { scoreLine: "Absent" };
        const total = r.marks.reduce((s, m) => s + (m.marks ?? 0), 0);
        const detail = r.marks
          .sort((a, b) => a.paperNum - b.paperNum || a.subjectSlot - b.subjectSlot)
          .map((m) => {
            const max = exam.subjects.find((x) => x.paperNum === m.paperNum && x.subjectSlot === m.subjectSlot)?.maxMarks;
            return `${subjectName(m.paperNum, m.subjectSlot)}: ${m.marks ?? "—"}${max != null ? ` / ${max}` : ""}`;
          }).join("\n");
        return { scoreLine: maxTotal != null ? `${total} / ${maxTotal}` : String(total), scoreDetail: detail };
      },
    });
    return res.disabled
      ? "Results are now visible on the student portal. Result emails are switched off in Administration → Notifications."
      : `Results released and ${res.queued} result email(s) queued.`;
  }
  return null;
}

// ─── Routes ──────────────────────────────────────────────────────────────────

export const examRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", authenticate);

  // ── GET /me — what the caller can open, plus their task counts ──────────────
  fastify.get("/me", async (req, reply) => {
    const a = await accessOf(req.user as JwtPayload);
    const today = todayIST();
    const open = await prisma.examStage.findMany({
      where: { ownerId: a.user.sub, status: { in: [...OPEN_STATUSES] }, exam: { status: { notIn: ["CANCELLED", "ARCHIVED"] } } },
      select: { status: true, plannedDate: true },
    });
    return reply.send({
      success: true,
      data: {
        teamRole: a.teamRole,
        canViewBoard: canViewBoard(a),
        canManageSettings: a.isSA,
        openTasks: open.length,
        overdueTasks: open.filter((s) => isOverdue(s, today)).length,
      },
    });
  });

  // ── Staff picker (exam team may not hold any employee-directory grant) ─────
  fastify.get("/staff", async (req, reply) => {
    const a = await accessOf(req.user as JwtPayload);
    if (!canViewBoard(a)) return forbidden(reply);
    const search = ((req.query as any).search ?? "").trim();
    const data = await prisma.employee.findMany({
      where: {
        deletedAt: null,
        ...(search ? { OR: [
          { firstName: { contains: search, mode: "insensitive" as const } },
          { lastName: { contains: search, mode: "insensitive" as const } },
          { employeeCode: { contains: search, mode: "insensitive" as const } },
        ] } : {}),
      },
      select: { id: true, firstName: true, lastName: true, employeeCode: true, designation: { select: { title: true } } },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      take: 30,
    });
    return reply.send({ success: true, data });
  });

  // ═══ SETTINGS (Super Admin) ═══════════════════════════════════════════════

  fastify.get("/settings/team", async (req, reply) => {
    const a = await accessOf(req.user as JwtPayload);
    if (!canViewBoard(a)) return forbidden(reply);
    const data = await prisma.examTeamMember.findMany({
      include: { employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true, deletedAt: true } } },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    });
    return reply.send({ success: true, data: data.filter((m) => !m.employee.deletedAt) });
  });

  fastify.post("/settings/team", async (req, reply) => {
    const a = await accessOf(req.user as JwtPayload);
    if (!a.isSA) return forbidden(reply, "Only a Super Admin can change the exam team");
    const body = z.object({ employeeId: z.string().min(1), role: z.enum(["CONTROLLER", "EXECUTIVE"]) }).safeParse(req.body);
    if (!body.success) return reply.status(400).send({ success: false, error: body.error.issues[0]?.message });
    const data = await prisma.examTeamMember.upsert({
      where: { employeeId: body.data.employeeId },
      create: body.data,
      update: { role: body.data.role },
    });
    return reply.send({ success: true, data });
  });

  fastify.delete("/settings/team/:id", async (req, reply) => {
    const a = await accessOf(req.user as JwtPayload);
    if (!a.isSA) return forbidden(reply, "Only a Super Admin can change the exam team");
    await prisma.examTeamMember.deleteMany({ where: { id: (req.params as any).id } });
    return reply.send({ success: true });
  });

  fastify.get("/settings/academic-years", async (req, reply) => {
    const a = await accessOf(req.user as JwtPayload);
    if (!canViewBoard(a)) return forbidden(reply);
    const data = await prisma.academicYear.findMany({ where: { isArchived: false }, orderBy: { name: "desc" }, select: { id: true, name: true, isActive: true } });
    return reply.send({ success: true, data });
  });

  fastify.get("/settings/types", async (req, reply) => {
    const a = await accessOf(req.user as JwtPayload);
    if (!canViewBoard(a)) return forbidden(reply);
    const { academicYear } = req.query as { academicYear?: string };
    const data = await prisma.examType.findMany({
      where: academicYear ? { academicYear } : {},
      include: { stages: { orderBy: { sequenceNo: "asc" } }, _count: { select: { exams: true } } },
      orderBy: [{ academicYear: "desc" }, { name: "asc" }],
    });
    return reply.send({ success: true, data });
  });

  fastify.post("/settings/types", async (req, reply) => {
    const a = await accessOf(req.user as JwtPayload);
    if (!a.isSA) return forbidden(reply, "Only a Super Admin can change exam types");
    const body = z.object({
      academicYear: z.string().trim().min(1),
      name: z.string().trim().min(1).max(60),
      description: z.string().trim().max(300).nullable().optional(),
      copyFromTypeId: z.string().optional(),
    }).safeParse(req.body);
    if (!body.success) return reply.status(400).send({ success: false, error: body.error.issues[0]?.message });
    const { copyFromTypeId, ...fields } = body.data;

    const clash = await prisma.examType.findFirst({ where: { academicYear: fields.academicYear, name: { equals: fields.name, mode: "insensitive" } } });
    if (clash) return reply.status(409).send({ success: false, error: `"${fields.name}" already exists for ${fields.academicYear}` });

    const source = copyFromTypeId
      ? await prisma.examStageTemplate.findMany({ where: { examTypeId: copyFromTypeId }, orderBy: { sequenceNo: "asc" } })
      : null;
    const stages = (source ?? DEFAULT_STAGES).map((s: any) => ({
      sequenceNo: s.sequenceNo, name: s.name, description: s.description ?? null, offsetDays: s.offsetDays,
      ownerRole: s.ownerRole, scope: s.scope, mode: s.mode ?? null, action: s.action ?? null, canBypass: s.canBypass ?? false,
    }));
    const data = await prisma.examType.create({
      data: { ...fields, stages: { create: stages } },
      include: { stages: { orderBy: { sequenceNo: "asc" } }, _count: { select: { exams: true } } },
    });
    return reply.status(201).send({ success: true, data });
  });

  /** Copy every type of one academic year into another (skips names that exist). */
  fastify.post("/settings/types/copy-year", async (req, reply) => {
    const a = await accessOf(req.user as JwtPayload);
    if (!a.isSA) return forbidden(reply, "Only a Super Admin can change exam types");
    const body = z.object({ fromYear: z.string().min(1), toYear: z.string().min(1) }).safeParse(req.body);
    if (!body.success) return reply.status(400).send({ success: false, error: body.error.issues[0]?.message });
    const { fromYear, toYear } = body.data;
    if (fromYear === toYear) return reply.status(400).send({ success: false, error: "Pick two different academic years" });

    const [src, existing] = await Promise.all([
      prisma.examType.findMany({ where: { academicYear: fromYear }, include: { stages: true } }),
      prisma.examType.findMany({ where: { academicYear: toYear }, select: { name: true } }),
    ]);
    const taken = new Set(existing.map((e) => e.name.toLowerCase()));
    let copied = 0;
    for (const t of src) {
      if (taken.has(t.name.toLowerCase())) continue;
      await prisma.examType.create({
        data: {
          academicYear: toYear, name: t.name, description: t.description, isActive: t.isActive,
          stages: { create: t.stages.map(({ id: _id, examTypeId: _t, ...s }) => s) },
        },
      });
      copied++;
    }
    return reply.send({ success: true, data: { copied, skipped: src.length - copied } });
  });

  fastify.patch("/settings/types/:id", async (req, reply) => {
    const a = await accessOf(req.user as JwtPayload);
    if (!a.isSA) return forbidden(reply, "Only a Super Admin can change exam types");
    const body = z.object({
      name: z.string().trim().min(1).max(60).optional(),
      description: z.string().trim().max(300).nullable().optional(),
      isActive: z.boolean().optional(),
    }).safeParse(req.body);
    if (!body.success) return reply.status(400).send({ success: false, error: body.error.issues[0]?.message });
    const data = await prisma.examType.update({ where: { id: (req.params as any).id }, data: body.data });
    return reply.send({ success: true, data });
  });

  /**
   * Replace a type's stage list. Exams already set up keep the stages they were
   * created with; only exams set up from now on use the new list.
   */
  fastify.put("/settings/types/:id/stages", async (req, reply) => {
    const a = await accessOf(req.user as JwtPayload);
    if (!a.isSA) return forbidden(reply, "Only a Super Admin can change exam types");
    const body = z.object({ stages: z.array(stageDefSchema).max(60) }).safeParse(req.body);
    if (!body.success) return reply.status(400).send({ success: false, error: body.error.issues[0]?.message });
    const problem = validateStageList(body.data.stages);
    if (problem) return reply.status(400).send({ success: false, error: problem });

    const id = (req.params as any).id as string;
    const data = await prisma.$transaction(async (tx) => {
      await tx.examStageTemplate.deleteMany({ where: { examTypeId: id } });
      await tx.examStageTemplate.createMany({
        data: body.data.stages.map((s) => ({
          examTypeId: id, sequenceNo: s.sequenceNo, name: s.name, description: s.description ?? null,
          offsetDays: s.offsetDays, ownerRole: s.ownerRole, scope: s.scope, mode: s.mode ?? null,
          action: s.action ?? null, canBypass: s.canBypass ?? false,
        })),
      });
      return tx.examType.findUnique({
        where: { id },
        include: { stages: { orderBy: { sequenceNo: "asc" } }, _count: { select: { exams: true } } },
      });
    });
    return reply.send({ success: true, data });
  });

  fastify.delete("/settings/types/:id", async (req, reply) => {
    const a = await accessOf(req.user as JwtPayload);
    if (!a.isSA) return forbidden(reply, "Only a Super Admin can change exam types");
    const id = (req.params as any).id as string;
    const used = await prisma.exam.count({ where: { examTypeId: id } });
    if (used > 0) return reply.status(409).send({ success: false, error: `Used by ${used} exam(s) — deactivate it instead` });
    await prisma.examType.deleteMany({ where: { id } });
    return reply.send({ success: true });
  });

  // ═══ BOARD ═════════════════════════════════════════════════════════════════

  fastify.get("/board", async (req, reply) => {
    const a = await accessOf(req.user as JwtPayload);
    if (!canViewBoard(a)) return forbidden(reply);
    const q = req.query as { academicYear?: string; days?: string };
    const today = todayIST();
    const ahead = Math.min(Math.max(parseInt(q.days ?? "45") || 45, 7), 180);
    const horizon = new Date(today.getTime() + ahead * 86400000);
    const lookback = new Date(today.getTime() - 30 * 86400000);

    const exams = await prisma.exam.findMany({
      where: {
        status: { notIn: ["CANCELLED", "ARCHIVED"] },
        ...(q.academicYear ? { academicYear: q.academicYear } : {}),
        OR: [
          { examDate: { gte: lookback, lte: horizon } },
          // Older tracked exams stay on the board until every stage is closed.
          { examTypeId: { not: null }, stages: { some: { status: { in: [...OPEN_STATUSES] } } } },
        ],
      },
      include: {
        examType: { select: { id: true, name: true } },
        controller: nameSel,
        executive: nameSel,
        batches: { include: { batch: { select: { id: true, name: true } } } },
        stages: { include: { owner: nameSel } },
      },
      orderBy: { examDate: "asc" },
    });

    const rows = exams.map((e) => ({
      id: e.id, name: e.name, examDate: e.examDate, startTime: e.startTime, endTime: e.endTime,
      academicYear: e.academicYear, status: e.status, mode: e.mode,
      examType: e.examType, controller: e.controller, executive: e.executive,
      batches: e.batches.map((b) => b.batch.name),
      tracked: !!e.examTypeId,
      resultsReleasedAt: e.resultsReleasedAt,
      daysToExam: daysBetween(today, e.examDate),
      summary: e.examTypeId ? examSummary(e.stages, today) : null,
      overdueStages: e.stages
        .filter((s) => isOverdue(s, today))
        .sort((x, y) => x.plannedDate.getTime() - y.plannedDate.getTime())
        .map((s) => ({ id: s.id, name: s.name, subjectLabel: s.subjectLabel, plannedDate: s.plannedDate, owner: s.owner, daysLate: daysBetween(s.plannedDate, today) })),
    }));

    // KPIs over tracked exams held in the last 90 days.
    const since = new Date(today.getTime() - 90 * 86400000);
    const recent = await prisma.exam.findMany({
      where: { examTypeId: { not: null }, examDate: { gte: since, lte: today }, status: { notIn: ["CANCELLED"] } },
      select: { examDate: true, resultsReleasedAt: true, stages: { select: { status: true, plannedDate: true, completedAt: true } } },
    });
    const closed = recent.flatMap((e) => e.stages).filter((s) => s.status === "DONE" && s.completedAt);
    const onTime = closed.filter((s) => utcDay(s.completedAt!) <= utcDay(s.plannedDate)).length;
    const released = recent.filter((e) => e.resultsReleasedAt);
    const kpis = {
      windowDays: 90,
      examsHeld: recent.length,
      stagesOnTimePct: closed.length ? Math.round((onTime / closed.length) * 100) : null,
      avgDaysToResults: released.length
        ? Math.round((released.reduce((s, e) => s + daysBetween(e.examDate, e.resultsReleasedAt!), 0) / released.length) * 10) / 10
        : null,
      openOverdue: rows.reduce((s, r) => s + r.overdueStages.length, 0),
      untrackedUpcoming: rows.filter((r) => !r.tracked && r.daysToExam >= 0).length,
    };

    return reply.send({ success: true, data: { exams: rows, kpis } });
  });

  // ═══ MY TASKS ══════════════════════════════════════════════════════════════

  fastify.get("/tasks", async (req, reply) => {
    const user = req.user as JwtPayload;
    const today = todayIST();
    const recentCutoff = new Date(Date.now() - 14 * 86400000);
    const stages = await prisma.examStage.findMany({
      where: {
        ownerId: user.sub,
        exam: { status: { notIn: ["CANCELLED", "ARCHIVED"] } },
        OR: [{ status: { in: [...OPEN_STATUSES] } }, { completedAt: { gte: recentCutoff } }],
      },
      include: {
        exam: {
          select: {
            id: true, name: true, examDate: true, mode: true,
            stages: { select: { id: true, sequenceNo: true, scope: true, paperNum: true, subjectSlot: true, status: true, name: true, subjectLabel: true } },
          },
        },
      },
      orderBy: [{ plannedDate: "asc" }, { sequenceNo: "asc" }],
    });
    const data = stages.map((s) => ({
      id: s.id, name: s.name, description: s.description, subjectLabel: s.subjectLabel,
      plannedDate: s.plannedDate, status: s.status, action: s.action, remarks: s.remarks,
      evidenceUrl: s.evidenceUrl, completedAt: s.completedAt,
      overdue: isOverdue(s, today),
      daysLeft: daysBetween(today, s.plannedDate),
      blockedBy: openBlockers(s, s.exam.stages).map((b) => ({ id: b.id, name: b.name, subjectLabel: b.subjectLabel })),
      exam: { id: s.exam.id, name: s.exam.name, examDate: s.exam.examDate, mode: s.exam.mode },
    }));
    return reply.send({ success: true, data });
  });

  // ═══ ONE EXAM ══════════════════════════════════════════════════════════════

  fastify.get("/:examId", async (req, reply) => {
    const a = await accessOf(req.user as JwtPayload);
    const examId = (req.params as any).examId as string;
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: {
        examType: { select: { id: true, name: true, academicYear: true } },
        controller: nameSel,
        executive: nameSel,
        batches: { include: { batch: { select: { id: true, name: true } } } },
        subjects: { include: { subject: { select: { id: true, name: true } } }, orderBy: [{ paperNum: "asc" }, { subjectSlot: "asc" }] },
        subjectTeams: { include: { setter: nameSel, reviewer: nameSel } },
        stages: {
          include: { owner: nameSel, events: { orderBy: { createdAt: "desc" }, take: 20 } },
          orderBy: [{ sequenceNo: "asc" }, { paperNum: "asc" }, { subjectSlot: "asc" }],
        },
      },
    });
    if (!exam) return reply.status(404).send({ success: false, error: "Exam not found" });

    // Board viewers see everything; anyone else only an exam they own a stage in.
    const ownsStage = exam.stages.some((s) => s.ownerId === a.user.sub);
    if (!canViewBoard(a) && !ownsStage && exam.controllerId !== a.user.sub && exam.executiveId !== a.user.sub) {
      return forbidden(reply);
    }

    const today = todayIST();
    const { stages, ...rest } = exam;
    return reply.send({
      success: true,
      data: {
        ...rest,
        daysToExam: daysBetween(today, exam.examDate),
        summary: exam.examTypeId ? examSummary(stages, today) : null,
        stages: stages.map((s) => stageView(s, stages, today)),
        permissions: {
          canManage: canManageExam(a, exam),
          isController: isControllerFor(a, exam),
          userId: a.user.sub,
        },
      },
    });
  });

  /** Set or change the exam's type, mode and team, then sync its stages. */
  fastify.put("/:examId/setup", async (req, reply) => {
    const a = await accessOf(req.user as JwtPayload);
    const examId = (req.params as any).examId as string;
    const body = z.object({
      examTypeId: z.string().min(1),
      mode: z.enum(["PEN_PAPER", "ONLINE"]),
      controllerId: z.string().min(1, "Pick the Controller for this exam"),
      executiveId: z.string().min(1, "Pick the Examination Executive for this exam"),
      subjectTeams: z.array(z.object({
        paperNum: z.number().int().min(1),
        subjectSlot: z.number().int().min(1),
        setterId: z.string().nullable().optional(),
        reviewerId: z.string().nullable().optional(),
      })).default([]),
    }).safeParse(req.body);
    if (!body.success) return reply.status(400).send({ success: false, error: body.error.issues[0]?.message });

    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      select: { id: true, academicYear: true, examTypeId: true, controllerId: true, executiveId: true, resultsReleasedAt: true, stages: { select: { status: true } } },
    });
    if (!exam) return reply.status(404).send({ success: false, error: "Exam not found" });
    if (!canManageExam(a, exam)) return forbidden(reply, "Only the exam team can set up an exam");

    const { examTypeId, mode, controllerId, executiveId, subjectTeams } = body.data;
    const type = await prisma.examType.findUnique({ where: { id: examTypeId }, include: { stages: { select: { action: true } } } });
    if (!type) return reply.status(400).send({ success: false, error: "Exam type not found" });
    if (type.academicYear !== exam.academicYear) {
      return reply.status(400).send({ success: false, error: `This exam is in ${exam.academicYear}; pick an exam type set up for that year` });
    }
    for (const t of subjectTeams) {
      if (t.setterId && t.reviewerId && t.setterId === t.reviewerId) {
        return reply.status(400).send({ success: false, error: `Paper ${t.paperNum}, subject ${t.subjectSlot}: the reviewer must be a different person from the setter` });
      }
    }
    const progressed = exam.stages.some((s) => s.status !== "NOT_STARTED");
    if (exam.examTypeId && exam.examTypeId !== examTypeId && progressed) {
      return reply.status(409).send({ success: false, error: "Work has started on this exam, so its type can't be changed" });
    }

    const actor = await actorFor(a.user.sub);
    const firstSetup = !exam.examTypeId;
    const sync = await prisma.$transaction(async (tx) => {
      if (exam.examTypeId && exam.examTypeId !== examTypeId) {
        await tx.examStage.deleteMany({ where: { examId } });
      }
      await tx.exam.update({
        where: { id: examId },
        data: {
          examTypeId, mode, controllerId, executiveId,
          // A tracked exam's marks stay hidden until its release stage is done.
          ...(firstSetup && type.stages.some((s) => s.action === "RELEASE_RESULTS") ? { resultsReleasedAt: null, resultsReleasedById: null } : {}),
        },
      });
      for (const t of subjectTeams) {
        await tx.examSubjectTeam.upsert({
          where: { examId_paperNum_subjectSlot: { examId, paperNum: t.paperNum, subjectSlot: t.subjectSlot } },
          create: { examId, paperNum: t.paperNum, subjectSlot: t.subjectSlot, setterId: t.setterId ?? null, reviewerId: t.reviewerId ?? null },
          update: { setterId: t.setterId ?? null, reviewerId: t.reviewerId ?? null },
        });
      }
      return syncExamStages(tx, examId, actor);
    });
    await notifyAssignments(examId, sync);
    return reply.send({ success: true, data: { rescheduled: sync.rescheduled, assigned: sync.newAssignments.size } });
  });

  // ═══ STAGES ════════════════════════════════════════════════════════════════

  async function loadStage(stageId: string) {
    return prisma.examStage.findUnique({
      where: { id: stageId },
      include: {
        exam: {
          select: {
            id: true, name: true, status: true, controllerId: true, executiveId: true,
            stages: { select: { id: true, sequenceNo: true, scope: true, paperNum: true, subjectSlot: true, status: true, name: true, subjectLabel: true } },
          },
        },
      },
    });
  }

  /** Start, complete, or add remarks/evidence. Reopening is Controller-level. */
  fastify.patch("/stages/:stageId", async (req, reply) => {
    const a = await accessOf(req.user as JwtPayload);
    const body = z.object({
      status: z.enum(["IN_PROGRESS", "DONE", "NOT_STARTED"]).optional(),
      remarks: z.string().trim().max(2000).nullable().optional(),
      evidenceUrl: z.string().trim().max(1000).nullable().optional()
        .refine((v) => !v || /^https?:\/\//i.test(v), "Evidence must be a link starting with http:// or https://"),
    }).safeParse(req.body);
    if (!body.success) return reply.status(400).send({ success: false, error: body.error.issues[0]?.message });

    const stage = await loadStage((req.params as any).stageId);
    if (!stage) return reply.status(404).send({ success: false, error: "Stage not found" });
    const isOwner = stage.ownerId === a.user.sub;
    if (!isOwner && !canManageExam(a, stage.exam)) return forbidden(reply, "Only the stage owner or the exam team can update this");
    if (["CANCELLED", "ARCHIVED"].includes(stage.exam.status)) {
      return reply.status(409).send({ success: false, error: "This exam is cancelled or archived" });
    }

    const { status, remarks, evidenceUrl } = body.data;
    const data: Record<string, any> = {};
    if (remarks !== undefined) data.remarks = remarks || null;
    if (evidenceUrl !== undefined) data.evidenceUrl = evidenceUrl || null;

    const wasClosed = stage.status === "DONE" || stage.status === "BYPASSED";
    let eventAction = "UPDATED";

    if (status && status !== stage.status) {
      if (wasClosed) {
        // Reopening undoes accountability, so it's Controller-level and logged.
        if (!isControllerFor(a, stage.exam)) return forbidden(reply, "Only the Controller can reopen a completed stage");
        data.completedAt = null; data.completedById = null; data.bypassReason = null;
        eventAction = "REOPENED";
      }
      if (status === "DONE") {
        if (stage.action === "RELEASE_RESULTS" && !isControllerFor(a, stage.exam)) {
          return forbidden(reply, "Only the Controller can release results");
        }
        const blockers = openBlockers(stage, stage.exam.stages);
        if (blockers.length) {
          return reply.status(409).send({
            success: false,
            error: `Finish the earlier step(s) first: ${blockers.slice(0, 3).map((b) => b.name + (b.subjectLabel ? ` (${b.subjectLabel})` : "")).join(", ")}${blockers.length > 3 ? ` and ${blockers.length - 3} more` : ""}`,
          });
        }
        data.completedAt = new Date();
        data.completedById = a.user.sub;
        data.startedAt = stage.startedAt ?? new Date();
        eventAction = "DONE";
      }
      if (status === "IN_PROGRESS") {
        data.startedAt = stage.startedAt ?? new Date();
        if (!wasClosed) eventAction = "STARTED";
      }
      data.status = status;
    }
    if (Object.keys(data).length === 0) return reply.send({ success: true, data: stage });

    const actor = await actorFor(a.user.sub);
    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.examStage.update({ where: { id: stage.id }, data });
      await tx.examStageEvent.create({
        data: {
          stageId: stage.id, actorId: actor.id, actorName: actor.name, action: eventAction,
          fromStatus: stage.status, toStatus: u.status,
          note: [remarks ? `Remarks: ${remarks}` : null, evidenceUrl ? `Evidence: ${evidenceUrl}` : null].filter(Boolean).join(" · ") || null,
        },
      });
      // Pulling a release back hides the marks again.
      if (eventAction === "REOPENED" && stage.action === "RELEASE_RESULTS") {
        await tx.exam.update({ where: { id: stage.exam.id }, data: { resultsReleasedAt: null, resultsReleasedById: null } });
      }
      return u;
    });

    let message: string | null = null;
    if (eventAction === "DONE" && stage.action) message = await runStageAction(stage.action, stage.exam.id, a.user.sub);
    if (eventAction === "REOPENED" && stage.action === "RELEASE_RESULTS") message = "Results are hidden from students again until this stage is done.";
    return reply.send({ success: true, data: updated, message });
  });

  /** Skip a stage with a reason. Controller-level, and only where the type allows it. */
  fastify.post("/stages/:stageId/bypass", async (req, reply) => {
    const a = await accessOf(req.user as JwtPayload);
    const body = z.object({ reason: z.string().trim().min(5, "Give a reason (at least 5 characters)").max(1000) }).safeParse(req.body);
    if (!body.success) return reply.status(400).send({ success: false, error: body.error.issues[0]?.message });
    const stage = await loadStage((req.params as any).stageId);
    if (!stage) return reply.status(404).send({ success: false, error: "Stage not found" });
    if (!isControllerFor(a, stage.exam)) return forbidden(reply, "Only the Controller can bypass a stage");
    if (!stage.canBypass && !a.isSA) return reply.status(409).send({ success: false, error: "This stage can't be bypassed" });
    if (stage.action) return reply.status(409).send({ success: false, error: "Stages that notify students or release results can't be bypassed" });
    if (stage.status === "DONE" || stage.status === "BYPASSED") return reply.status(409).send({ success: false, error: "This stage is already closed" });

    const actor = await actorFor(a.user.sub);
    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.examStage.update({
        where: { id: stage.id },
        data: { status: "BYPASSED", bypassReason: body.data.reason, completedAt: new Date(), completedById: a.user.sub },
      });
      await tx.examStageEvent.create({
        data: { stageId: stage.id, actorId: actor.id, actorName: actor.name, action: "BYPASSED", fromStatus: stage.status, toStatus: "BYPASSED", note: body.data.reason },
      });
      return u;
    });
    return reply.send({ success: true, data: updated });
  });

  /** Hand a stage to someone else. Sticks even if the exam team changes later. */
  fastify.patch("/stages/:stageId/owner", async (req, reply) => {
    const a = await accessOf(req.user as JwtPayload);
    const body = z.object({ ownerId: z.string().min(1) }).safeParse(req.body);
    if (!body.success) return reply.status(400).send({ success: false, error: "Pick a person" });
    const stage = await loadStage((req.params as any).stageId);
    if (!stage) return reply.status(404).send({ success: false, error: "Stage not found" });
    if (!canManageExam(a, stage.exam)) return forbidden(reply, "Only the exam team can reassign a stage");
    if (stage.status === "DONE" || stage.status === "BYPASSED") return reply.status(409).send({ success: false, error: "This stage is already closed" });
    if (stage.ownerId === body.data.ownerId) return reply.send({ success: true, data: stage });

    const [actor, next] = await Promise.all([actorFor(a.user.sub), actorFor(body.data.ownerId)]);
    const prev = stage.ownerId ? await actorFor(stage.ownerId) : null;
    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.examStage.update({
        where: { id: stage.id },
        data: { ownerId: body.data.ownerId, ownerOverridden: true, reminderSentAt: null, overdueAlertSentAt: null },
      });
      await tx.examStageEvent.create({
        data: { stageId: stage.id, actorId: actor.id, actorName: actor.name, action: "OWNER_CHANGED", note: `${prev?.name ?? "Nobody"} → ${next.name}` },
      });
      return u;
    });
    await notifyAssignments(stage.exam.id, { newAssignments: new Map([[body.data.ownerId, [stage.id]]]), rescheduled: 0 });
    return reply.send({ success: true, data: updated });
  });
};
