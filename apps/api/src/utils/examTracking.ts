import { prisma } from "@cadb/db";

/**
 * Exam operations tracking — the rules, kept out of the route file so the
 * assessment routes can call the same sync after an exam is edited.
 *
 *   • An exam with an exam type gets one stage per template row (per paper/
 *     subject slot for SUBJECT-scope rows), filtered by the exam's mode.
 *   • plannedDate = examDate + offsetDays, moved back to the previous working
 *     day if it lands on a Sunday or a holiday (the exam day itself never moves).
 *   • Overdue is worked out on read, never stored: past plannedDate and not done.
 *   • Gate: a stage can't be completed while an earlier stage it depends on is
 *     still open. Subject stages only wait for earlier stages of the same slot
 *     and for earlier exam-wide stages.
 */

/** A transaction client or the root client — both expose the model delegates. */
export type Tx = Omit<typeof prisma, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;

export type StageOwnerRole = "CONTROLLER" | "EXECUTIVE" | "PAPER_SETTER" | "REVIEWER";
export type StageDef = {
  sequenceNo: number;
  name: string;
  description?: string | null;
  offsetDays: number;
  ownerRole: StageOwnerRole;
  scope: "EXAM" | "SUBJECT";
  mode?: "PEN_PAPER" | "ONLINE" | null;
  action?: "NOTIFY_STUDENTS" | "RELEASE_RESULTS" | null;
  canBypass?: boolean;
};

/**
 * The standard cycle a new exam type starts with. Super Admin edits it per type
 * and per academic year; this is only the starting point.
 */
export const DEFAULT_STAGES: StageDef[] = [
  { sequenceNo: 1,  name: "Exam scheduled on calendar",          offsetDays: -28, ownerRole: "CONTROLLER",   scope: "EXAM",    description: "Date, timing and batches confirmed; no clash with other exams or holidays." },
  { sequenceNo: 2,  name: "Syllabus & blueprint finalised",      offsetDays: -21, ownerRole: "PAPER_SETTER", scope: "SUBJECT", description: "Chapters, weightage and difficulty mix for this subject." },
  { sequenceNo: 3,  name: "Exam notice to students & parents",   offsetDays: -14, ownerRole: "EXECUTIVE",    scope: "EXAM",    action: "NOTIFY_STUDENTS", description: "Marking this done emails the date, timing and syllabus to students and parents." },
  { sequenceNo: 4,  name: "Paper set (paper, key, solutions)",   offsetDays: -12, ownerRole: "PAPER_SETTER", scope: "SUBJECT", description: "Question paper, answer key and solutions uploaded. Link the Drive file or Learnyst test as evidence." },
  { sequenceNo: 5,  name: "Paper reviewed",                      offsetDays: -9,  ownerRole: "REVIEWER",     scope: "SUBJECT", description: "Matches syllabus and blueprint, key verified, marks add up, no errors. Note the corrections needed in remarks." },
  { sequenceNo: 6,  name: "Corrections made",                    offsetDays: -7,  ownerRole: "PAPER_SETTER", scope: "SUBJECT", description: "Every review comment addressed in a new version." },
  { sequenceNo: 7,  name: "Final approval & freeze",             offsetDays: -5,  ownerRole: "CONTROLLER",   scope: "SUBJECT", description: "Paper locked. No changes after this without the Controller." },
  { sequenceNo: 8,  name: "Printing & packing",                  offsetDays: -3,  ownerRole: "EXECUTIVE",    scope: "EXAM",    mode: "PEN_PAPER", description: "Copies = batch strength + buffer; packed and sealed per centre." },
  { sequenceNo: 9,  name: "Uploaded to Learnyst & test-run",     offsetDays: -3,  ownerRole: "EXECUTIVE",    scope: "EXAM",    mode: "ONLINE", description: "Test configured on Learnyst, timings set, test-run by a second person." },
  { sequenceNo: 10, name: "Papers delivered to centres",         offsetDays: -1,  ownerRole: "EXECUTIVE",    scope: "EXAM",    mode: "PEN_PAPER", description: "Receipt confirmed by each centre." },
  { sequenceNo: 11, name: "Exam conducted",                      offsetDays: 0,   ownerRole: "EXECUTIVE",    scope: "EXAM",    description: "Attendance taken, incidents noted in remarks, answer sheets / OMRs counted." },
  { sequenceNo: 12, name: "Evaluation & marks entered",          offsetDays: 2,   ownerRole: "EXECUTIVE",    scope: "EXAM",    description: "OMR / manual evaluation done and marks imported." },
  { sequenceNo: 13, name: "Results verified",                    offsetDays: 3,   ownerRole: "CONTROLLER",   scope: "EXAM",    description: "Totals, missing students, absent vs zero and outliers checked." },
  { sequenceNo: 14, name: "Results released to students",        offsetDays: 4,   ownerRole: "CONTROLLER",   scope: "EXAM",    action: "RELEASE_RESULTS", description: "Marking this done shows results on the student portal and emails scores to students and parents." },
  { sequenceNo: 15, name: "Re-evaluation window closed",         offsetDays: 7,   ownerRole: "CONTROLLER",   scope: "EXAM",    canBypass: true, description: "All re-evaluation requests resolved. Can be bypassed with a reason." },
  { sequenceNo: 16, name: "Post-exam review & closure",          offsetDays: 10,  ownerRole: "CONTROLLER",   scope: "EXAM",    description: "Errors and incidents reviewed, action items noted, exam closed." },
];

export const OPEN_STATUSES = ["NOT_STARTED", "IN_PROGRESS"] as const;
const CLOSED = new Set(["DONE", "BYPASSED"]);

// ─── Dates ───────────────────────────────────────────────────────────────────
// Exam.examDate and ExamStage.plannedDate are @db.Date: UTC midnight. All day
// arithmetic here stays in UTC days so nothing drifts by a timezone.

const DAY = 24 * 60 * 60 * 1000;

export function utcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Today's date in India, as a UTC-midnight Date comparable to @db.Date columns. */
export function todayIST(): Date {
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  return new Date(`${ymd}T00:00:00.000Z`);
}

export function daysBetween(from: Date, to: Date): number {
  return Math.round((utcDay(to).getTime() - utcDay(from).getTime()) / DAY);
}

/** Holiday days within a window, as yyyy-mm-dd strings. */
async function holidayDays(tx: Tx, from: Date, to: Date): Promise<Set<string>> {
  const rows = await tx.holiday.findMany({
    where: { fromDate: { lte: to }, toDate: { gte: from } },
    select: { fromDate: true, toDate: true },
  });
  const out = new Set<string>();
  for (const h of rows) {
    for (let t = utcDay(h.fromDate).getTime(); t <= utcDay(h.toDate).getTime(); t += DAY) {
      out.add(new Date(t).toISOString().slice(0, 10));
    }
  }
  return out;
}

/**
 * examDate + offset, moved back to the previous working day (Mon–Sat, not a
 * holiday). A deadline that falls on a day off is due the working day before,
 * never after. The exam day itself (offset 0) is never moved.
 */
export function plannedDateFor(examDate: Date, offsetDays: number, holidays: Set<string>): Date {
  const d = new Date(utcDay(examDate).getTime() + offsetDays * DAY);
  if (offsetDays === 0) return d;
  for (let i = 0; i < 14; i++) {
    const off = d.getUTCDay() === 0 || holidays.has(d.toISOString().slice(0, 10));
    if (!off) break;
    d.setTime(d.getTime() - DAY);
  }
  return d;
}

// ─── Status rules ────────────────────────────────────────────────────────────

export function isOverdue(stage: { status: string; plannedDate: Date }, today = todayIST()): boolean {
  return !CLOSED.has(stage.status) && utcDay(stage.plannedDate) < today;
}

type GateStage = { id: string; sequenceNo: number; scope: string; paperNum: number; subjectSlot: number; status: string; name: string; subjectLabel: string | null };

/** Earlier stages that must be closed before `stage` can be completed. */
export function openBlockers<T extends GateStage>(stage: GateStage, all: T[]): T[] {
  return all.filter((s) =>
    s.id !== stage.id &&
    s.sequenceNo < stage.sequenceNo &&
    !CLOSED.has(s.status) &&
    (s.scope === "EXAM" || stage.scope === "EXAM" ||
      (s.paperNum === stage.paperNum && s.subjectSlot === stage.subjectSlot)),
  );
}

// ─── Sync ────────────────────────────────────────────────────────────────────

export type SyncResult = {
  /** Owners who gained at least one stage in this sync, with those stage ids. */
  newAssignments: Map<string, string[]>;
  rescheduled: number;
};

type Actor = { id: string | null; name: string };

/**
 * Bring an exam's stages in line with its type, mode, date, subjects and team.
 * Idempotent: safe to call after any edit to the exam.
 *
 *   • Missing stages are created (new subject slot, new template row, mode change).
 *   • Stages no longer wanted are deleted only if never started; otherwise kept.
 *   • Open stages follow the exam date; closed stages keep the date they had.
 *   • Owners follow the exam team, unless someone reassigned the stage by hand.
 */
export async function syncExamStages(tx: Tx, examId: string, actor?: Actor): Promise<SyncResult> {
  const result: SyncResult = { newAssignments: new Map(), rescheduled: 0 };

  const exam = await tx.exam.findUnique({
    where: { id: examId },
    select: {
      id: true, examDate: true, examTypeId: true, mode: true, numPapers: true,
      controllerId: true, executiveId: true,
      subjects: { select: { paperNum: true, subjectSlot: true, subject: { select: { name: true } } }, orderBy: [{ paperNum: "asc" }, { subjectSlot: "asc" }] },
      subjectTeams: { select: { paperNum: true, subjectSlot: true, setterId: true, reviewerId: true } },
      examType: { select: { stages: { orderBy: { sequenceNo: "asc" } } } },
      stages: true,
    },
  });
  if (!exam || !exam.examTypeId || !exam.examType) return result;

  const templates = exam.examType.stages.filter((t) => !t.mode || !exam.mode || t.mode === exam.mode);

  const window = { from: new Date(exam.examDate.getTime() - 120 * DAY), to: new Date(exam.examDate.getTime() + 120 * DAY) };
  const holidays = await holidayDays(tx, window.from, window.to);

  const teamBySlot = new Map(exam.subjectTeams.map((t) => [`${t.paperNum}_${t.subjectSlot}`, t]));
  const ownerFor = (role: string, paperNum: number, subjectSlot: number): string | null => {
    if (role === "CONTROLLER") return exam.controllerId;
    if (role === "EXECUTIVE") return exam.executiveId;
    const team = teamBySlot.get(`${paperNum}_${subjectSlot}`);
    if (role === "PAPER_SETTER") return team?.setterId ?? null;
    if (role === "REVIEWER") return team?.reviewerId ?? null;
    return null;
  };
  const labelFor = (paperNum: number, subjectName: string | null | undefined, subjectSlot: number) => {
    const subject = subjectName ?? `Subject ${subjectSlot}`;
    return exam.numPapers > 1 ? `Paper ${paperNum} · ${subject}` : subject;
  };

  type Want = { key: string; t: (typeof templates)[number]; paperNum: number; subjectSlot: number; label: string | null };
  const wanted: Want[] = [];
  for (const t of templates) {
    if (t.scope === "EXAM") {
      wanted.push({ key: `${t.sequenceNo}_0_0`, t, paperNum: 0, subjectSlot: 0, label: null });
    } else {
      for (const s of exam.subjects) {
        wanted.push({
          key: `${t.sequenceNo}_${s.paperNum}_${s.subjectSlot}`, t,
          paperNum: s.paperNum, subjectSlot: s.subjectSlot,
          label: labelFor(s.paperNum, s.subject?.name, s.subjectSlot),
        });
      }
    }
  }

  const existing = new Map(exam.stages.map((s) => [`${s.sequenceNo}_${s.paperNum}_${s.subjectSlot}`, s]));
  const wantedKeys = new Set(wanted.map((w) => w.key));
  const note = (ownerId: string | null, stageId: string) => {
    if (!ownerId) return;
    const list = result.newAssignments.get(ownerId) ?? [];
    list.push(stageId);
    result.newAssignments.set(ownerId, list);
  };

  // Remove stages that no longer apply — only if nobody has touched them.
  for (const [key, s] of existing) {
    if (wantedKeys.has(key)) continue;
    if (s.status === "NOT_STARTED") await tx.examStage.delete({ where: { id: s.id } });
  }

  for (const w of wanted) {
    const planned = plannedDateFor(exam.examDate, w.t.offsetDays, holidays);
    const cur = existing.get(w.key);

    if (!cur) {
      const ownerId = ownerFor(w.t.ownerRole, w.paperNum, w.subjectSlot);
      const created = await tx.examStage.create({
        data: {
          examId, templateId: w.t.id, sequenceNo: w.t.sequenceNo, name: w.t.name,
          description: w.t.description, ownerRole: w.t.ownerRole, scope: w.t.scope,
          action: w.t.action, canBypass: w.t.canBypass, offsetDays: w.t.offsetDays,
          paperNum: w.paperNum, subjectSlot: w.subjectSlot, subjectLabel: w.label,
          plannedDate: planned, ownerId,
          // Already past due when the exam is set up late: it shows red on the
          // board, but nobody is emailed about a deadline they never had.
          ...(planned < todayIST() ? { overdueAlertSentAt: new Date() } : {}),
        },
      });
      note(ownerId, created.id);
      continue;
    }

    const data: Record<string, any> = {};
    const isOpen = !CLOSED.has(cur.status);

    // Dates use the stage's own snapshot offset, not today's template value.
    const curPlanned = plannedDateFor(exam.examDate, cur.offsetDays, holidays);
    if (isOpen && utcDay(cur.plannedDate).getTime() !== curPlanned.getTime()) {
      data.plannedDate = curPlanned;
      // A moved deadline deserves a fresh reminder.
      data.reminderSentAt = null;
      data.overdueAlertSentAt = null;
      result.rescheduled++;
    }
    if (w.label !== cur.subjectLabel) data.subjectLabel = w.label;

    if (isOpen && !cur.ownerOverridden) {
      const ownerId = ownerFor(cur.ownerRole, cur.paperNum, cur.subjectSlot);
      if (ownerId !== cur.ownerId) {
        data.ownerId = ownerId;
        note(ownerId, cur.id);
      }
    }

    if (Object.keys(data).length === 0) continue;
    await tx.examStage.update({ where: { id: cur.id }, data });

    if (actor && (data.plannedDate || data.ownerId !== undefined)) {
      const bits: string[] = [];
      if (data.plannedDate) bits.push(`due ${utcDay(cur.plannedDate).toISOString().slice(0, 10)} → ${curPlanned.toISOString().slice(0, 10)}`);
      if (data.ownerId !== undefined) bits.push("owner updated from exam team");
      await tx.examStageEvent.create({
        data: {
          stageId: cur.id, actorId: actor.id, actorName: actor.name,
          action: data.plannedDate ? "RESCHEDULED" : "OWNER_CHANGED", note: bits.join("; "),
        },
      });
    }
  }

  return result;
}

/** Display name for an employee id, for event logs. */
export async function actorFor(employeeId: string): Promise<Actor> {
  const e = await prisma.employee.findUnique({ where: { id: employeeId }, select: { firstName: true, lastName: true } });
  return { id: employeeId, name: e ? `${e.firstName} ${e.lastName}`.trim() : "Unknown" };
}
