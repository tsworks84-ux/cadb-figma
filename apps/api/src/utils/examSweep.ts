import { prisma } from "@cadb/db";
import { OPEN_STATUSES, daysBetween, todayIST } from "./examTracking.js";
import { notifyExamStaff } from "./notify/exam.js";

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
const fmt = (d: Date) => dateFmt.format(d);
const DAY = 86400000;

/**
 * Hourly pass over open exam stages:
 *   • due within 2 days → one reminder to the owner
 *   • past due          → one alert to the owner, the exam's Controller and Executive
 *
 * A stage awaiting approval is the approver's to move, so the reminder goes to
 * the approver instead, and the overdue alert includes them.
 *
 * Each is sent once per deadline (reminderSentAt / overdueAlertSentAt). Moving
 * the exam date or reassigning the stage clears both, so the new deadline or
 * new owner gets their own notices.
 */
export async function runExamStageSweep(): Promise<{ reminders: number; overdue: number }> {
  const today = todayIST();
  const soon = new Date(today.getTime() + 2 * DAY);
  const liveExam = { status: { notIn: ["CANCELLED" as const, "ARCHIVED" as const] }, examTypeId: { not: null } };
  const include = {
    owner: { select: { firstName: true, lastName: true } },
    exam: { select: { id: true, name: true, examDate: true, controllerId: true, executiveId: true } },
  } as const;

  const dueSoon = await prisma.examStage.findMany({
    where: {
      reminderSentAt: null, plannedDate: { gte: today, lte: soon }, exam: liveExam,
      OR: [
        { status: { in: ["NOT_STARTED", "IN_PROGRESS"] }, ownerId: { not: null } },
        { status: "PENDING_APPROVAL", approverId: { not: null } },
      ],
    },
    include,
  });
  for (const s of dueSoon) {
    // Claim first: only the run that flips the flag sends the notice.
    const claim = await prisma.examStage.updateMany({ where: { id: s.id, reminderSentAt: null }, data: { reminderSentAt: new Date() } });
    if (claim.count === 0) continue;
    await notifyExamStaff("EXAM_STAGE_DUE_SOON", {
      examId: s.exam.id,
      employeeIds: [s.status === "PENDING_APPROVAL" ? s.approverId! : s.ownerId!],
      path: "/dashboard/exams/tasks",
      fields: {
        examName: s.exam.name, examDate: fmt(s.exam.examDate), stageName: s.name,
        subjectLabel: s.subjectLabel ?? undefined, plannedDate: fmt(s.plannedDate),
      },
    });
  }

  const overdue = await prisma.examStage.findMany({
    where: {
      status: { in: [...OPEN_STATUSES] }, overdueAlertSentAt: null,
      plannedDate: { lt: today }, exam: liveExam,
    },
    include,
  });
  for (const s of overdue) {
    const claim = await prisma.examStage.updateMany({ where: { id: s.id, overdueAlertSentAt: null }, data: { overdueAlertSentAt: new Date() } });
    if (claim.count === 0) continue;
    const ownerName = s.owner ? `${s.owner.firstName} ${s.owner.lastName}`.trim() : "Unassigned";
    await notifyExamStaff("EXAM_STAGE_OVERDUE", {
      examId: s.exam.id,
      employeeIds: [s.ownerId, s.status === "PENDING_APPROVAL" ? s.approverId : null, s.exam.controllerId, s.exam.executiveId]
        .filter((x): x is string => !!x),
      path: `/dashboard/exams/${s.exam.id}`,
      fields: {
        examName: s.exam.name, examDate: fmt(s.exam.examDate), stageName: s.name,
        subjectLabel: s.subjectLabel ?? undefined, plannedDate: fmt(s.plannedDate),
        ownerName, daysOverdue: String(daysBetween(s.plannedDate, today)),
      },
    });
  }

  return { reminders: dueSoon.length, overdue: overdue.length };
}
