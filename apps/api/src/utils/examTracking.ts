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
  /** Who signs the stage off. Unset = the owner marks it done. */
  approver?: "SUBJECT_HEAD" | "CONTROLLER" | null;
  /** Structured input collected instead of a bare "done". */
  form?: "BLUEPRINT" | null;
};

/**
 * The standard cycle a new exam type starts with. Super Admin edits it per type
 * and per academic year; this is only the starting point.
 */
export const DEFAULT_STAGES: StageDef[] = [
  { sequenceNo: 1,  name: "Exam scheduled on calendar",          offsetDays: -28, ownerRole: "CONTROLLER",   scope: "EXAM",    description: "Date, timing and batches confirmed; no clash with other exams or holidays." },
  { sequenceNo: 2,  name: "Blueprint finalised",                 offsetDays: -21, ownerRole: "PAPER_SETTER", scope: "SUBJECT", form: "BLUEPRINT", approver: "SUBJECT_HEAD", description: "Marks, question count and question type for each syllabus chapter, plus the difficulty mix. Approved by the subject head." },
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

/** Not closed yet. A stage awaiting approval is still open: it can be late. */
export const OPEN_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "PENDING_APPROVAL"] as const;
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
  /** Blueprints sent back to their owner because the exam's syllabus changed. */
  reopened: { stageId: string; reason: string }[];
  /** Submitted stages whose approver changed (the new approver should hear about it). */
  newApprovals: string[];
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
  const result: SyncResult = { newAssignments: new Map(), rescheduled: 0, reopened: [], newApprovals: [] };

  const exam = await tx.exam.findUnique({
    where: { id: examId },
    select: {
      id: true, examDate: true, examTypeId: true, mode: true, numPapers: true,
      controllerId: true, executiveId: true,
      subjects: {
        select: { paperNum: true, subjectSlot: true, topics: true, maxMarks: true, subject: { select: { name: true, headId: true } } },
        orderBy: [{ paperNum: "asc" }, { subjectSlot: "asc" }],
      },
      subjectTeams: { select: { paperNum: true, subjectSlot: true, setterId: true, reviewerId: true, approverId: true } },
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
          approver: w.t.approver, form: w.t.form,
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

    // A submitted stage follows changes to who should approve it.
    if (cur.status === "PENDING_APPROVAL" && cur.approver) {
      const approverId = approverFor(cur.approver, {
        exam, team: teamBySlot.get(`${cur.paperNum}_${cur.subjectSlot}`) ?? null,
        subject: exam.subjects.find((x) => x.paperNum === cur.paperNum && x.subjectSlot === cur.subjectSlot) ?? null,
        ownerId: data.ownerId !== undefined ? data.ownerId : cur.ownerId,
      });
      if (approverId !== cur.approverId) {
        data.approverId = approverId;
        result.newApprovals.push(cur.id);
      }
    }

    // A blueprint that no longer matches the exam's syllabus or max marks goes
    // back to its owner, even if it was already approved.
    if (cur.form === "BLUEPRINT" && (cur.status === "PENDING_APPROVAL" || cur.status === "DONE") && cur.formData) {
      const subj = exam.subjects.find((x) => x.paperNum === cur.paperNum && x.subjectSlot === cur.subjectSlot);
      const why = blueprintDrift(cur.formData as any, syllabusOf(subj?.topics), subj?.maxMarks ?? null);
      if (why) {
        Object.assign(data, { status: "IN_PROGRESS", completedAt: null, completedById: null, submittedAt: null, approverId: null });
        result.reopened.push({ stageId: cur.id, reason: why });
      }
    }

    if (Object.keys(data).length === 0) continue;
    await tx.examStage.update({ where: { id: cur.id }, data });

    if (data.status === "IN_PROGRESS") {
      await tx.examStageEvent.create({
        data: {
          stageId: cur.id, actorId: actor?.id ?? null, actorName: actor?.name ?? "System",
          action: "REOPENED", fromStatus: cur.status, toStatus: "IN_PROGRESS",
          note: result.reopened.find((r) => r.stageId === cur.id)?.reason ?? null,
        },
      });
    }

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

// ─── Approval ────────────────────────────────────────────────────────────────

/**
 * Who approves a stage. For SUBJECT_HEAD: the paper's approver on this exam,
 * else the subject's head, else the exam's Controller. Nobody approves their
 * own work: if that chain lands on the owner, it falls to the Controller.
 * null means nobody is available, and the submit is refused.
 */
export function approverFor(
  kind: string,
  ctx: {
    exam: { controllerId: string | null };
    team: { approverId: string | null } | null;
    subject: { subject: { headId: string | null } | null } | null;
    ownerId: string | null;
  },
): string | null {
  const controller = ctx.exam.controllerId;
  let pick: string | null = null;
  if (kind === "SUBJECT_HEAD") pick = ctx.team?.approverId ?? ctx.subject?.subject?.headId ?? controller;
  if (kind === "CONTROLLER") pick = controller;
  if (pick && pick === ctx.ownerId) pick = controller !== ctx.ownerId ? controller : null;
  return pick ?? null;
}

// ─── Blueprint ───────────────────────────────────────────────────────────────

export const QUESTION_TYPES = ["MCQ", "Multiple correct", "Numerical", "Integer", "Short answer", "Long answer", "Mixed"] as const;

export type BlueprintChapter = { chapter: string; marks: number; questions: number; questionType: string };
export type Blueprint = {
  maxMarks: number | null;
  chapters: BlueprintChapter[];
  difficulty: { easy: number; medium: number; hard: number };
};

/** The exam's syllabus for one subject, as entered on the assessment (comma-separated). */
export function syllabusOf(topics: string | null | undefined): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of (topics ?? "").split(",")) {
    const name = t.trim();
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push(name);
  }
  return out;
}

const norm = (s: string) => s.trim().toLowerCase();

/** Why a saved blueprint no longer fits the exam, or null if it still does. */
export function blueprintDrift(bp: Partial<Blueprint>, chapters: string[], maxMarks: number | null): string | null {
  const have = new Set((bp.chapters ?? []).map((c) => norm(c.chapter)));
  const want = new Set(chapters.map(norm));
  const same = have.size === want.size && [...want].every((c) => have.has(c));
  if (!same) return "The exam's syllabus changed; the blueprint needs updating";
  if ((bp.maxMarks ?? null) !== (maxMarks ?? null)) return "The subject's max marks changed; the blueprint needs updating";
  return null;
}

/** Every problem that stops a blueprint being submitted. Empty = good to go. */
export function blueprintProblems(bp: Blueprint, chapters: string[], maxMarks: number | null): string[] {
  const problems: string[] = [];
  if (chapters.length === 0) return ["This subject has no syllabus on the exam yet. Add the chapters to the exam first."];
  const byName = new Map(bp.chapters.map((c) => [norm(c.chapter), c]));
  for (const ch of chapters) {
    const row = byName.get(norm(ch));
    if (!row || !(row.marks > 0)) problems.push(`${ch}: enter the marks`);
    else if (!(row.questions >= 1)) problems.push(`${ch}: enter the number of questions`);
    else if (!row.questionType) problems.push(`${ch}: pick the question type`);
  }
  const total = round2(chapters.reduce((s, ch) => s + (byName.get(norm(ch))?.marks ?? 0), 0));
  if (maxMarks != null && total !== round2(maxMarks)) problems.push(`Chapter marks add up to ${total}, but the subject is out of ${maxMarks}`);
  const d = bp.difficulty;
  if ([d.easy, d.medium, d.hard].some((x) => !(x >= 0))) problems.push("Difficulty mix: enter easy, medium and hard %");
  else if (round2(d.easy + d.medium + d.hard) !== 100) problems.push(`Difficulty mix adds up to ${round2(d.easy + d.medium + d.hard)}%, not 100%`);
  return problems;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
