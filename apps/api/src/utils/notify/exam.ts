import { prisma } from "@cadb/db";
import { EVENT_META, type NotifyChannel, type NotifyEvent } from "./events.js";
import { channelsEnabledFor } from "./settings.js";
import { emailConfigured } from "./channels/email.js";
import type { NotifyPayload } from "./templates.js";

/**
 * Enqueue side for exam-operations notices.
 *
 * The leave/claim `enqueue` in index.ts is built around an applicant and an
 * approval chain. Exam notices have neither: staff notices go to named stage
 * owners, and student notices go to students and parents, who are not
 * employees at all. Both still go through the same outbox rows and the same
 * Super-Admin channel switches, so delivery, retries and the kill switch
 * behave exactly like every other notice.
 *
 * Never throws — a notification problem must not fail the action behind it.
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";

/** Payload fields the shared shape requires but exam notices don't use. */
const BLANK_APPLICANT = { applicantName: "", applicantCode: "", department: "" };

async function enabledChannels(event: NotifyEvent): Promise<NotifyChannel[]> {
  const allowed = await channelsEnabledFor(event);
  const supported = new Set<NotifyChannel>(EVENT_META[event].channels);
  return [
    ...(supported.has("EMAIL") && allowed.emailEnabled && emailConfigured() ? ["EMAIL" as const] : []),
    ...(supported.has("IN_APP") && allowed.inAppEnabled ? ["IN_APP" as const] : []),
  ];
}

/**
 * One notice per employee. `fieldsFor` lets each recipient get their own task
 * list; return null to skip someone.
 */
export async function notifyExamStaff(
  event: NotifyEvent,
  opts: {
    examId: string;
    employeeIds: string[];
    path: string;
    fields: Partial<NotifyPayload>;
    fieldsFor?: (employeeId: string) => Partial<NotifyPayload> | null;
  },
): Promise<void> {
  try {
    const ids = [...new Set(opts.employeeIds.filter(Boolean))];
    if (ids.length === 0) return;
    const channels = await enabledChannels(event);
    if (channels.length === 0) return;

    const people = await prisma.employee.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: { id: true, firstName: true, email: true },
    });

    const rows: any[] = [];
    for (const person of people) {
      const own = opts.fieldsFor ? opts.fieldsFor(person.id) : {};
      if (own === null) continue;
      const payload: NotifyPayload = {
        ...BLANK_APPLICANT,
        recipientName: person.firstName,
        link: `${APP_URL}${opts.path}`,
        path: opts.path,
        ...opts.fields,
        ...own,
      };
      const common = {
        event, recipientId: person.id, payload: payload as unknown as object,
        entityType: "Exam", entityId: opts.examId,
      };
      if (channels.includes("EMAIL") && person.email) {
        rows.push({ ...common, channel: "EMAIL", destination: person.email });
      }
      if (channels.includes("IN_APP")) {
        rows.push({ ...common, channel: "IN_APP", destination: person.id, status: "SENT", sentAt: new Date() });
      }
    }
    if (rows.length) await prisma.notification.createMany({ data: rows });
  } catch (err) {
    console.error(`[notify] failed to queue ${event} for Exam ${opts.examId}`, err);
  }
}

type StudentContact = {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  parentEmail: string | null;
  motherEmail: string | null;
  communicationContact: string | null;
};

/**
 * Who hears about a student's exam: the student, plus the parent(s) the family
 * chose as the communication contact (both when unset). Duplicates collapse, so
 * a family sharing one address gets one email.
 */
function addressesFor(s: StudentContact): string[] {
  const parents =
    s.communicationContact === "FATHER" ? [s.parentEmail]
    : s.communicationContact === "MOTHER" ? [s.motherEmail]
    : [s.parentEmail, s.motherEmail];
  const all = [s.email, ...parents]
    .map((e) => e?.trim().toLowerCase())
    .filter((e): e is string => !!e && e.includes("@"));
  return [...new Set(all)];
}

/**
 * Email every student in the exam's batches and their parents. `fieldsFor`
 * builds the per-student part (e.g. their score); return null to skip a student.
 * Returns how many emails were queued, so the caller can report it.
 */
export async function notifyExamStudents(
  event: "EXAM_SCHEDULED" | "EXAM_RESULTS_RELEASED",
  opts: {
    examId: string;
    fields: Partial<NotifyPayload>;
    fieldsFor?: (studentId: string) => Partial<NotifyPayload> | null;
  },
): Promise<{ queued: number; disabled: boolean }> {
  try {
    const channels = await enabledChannels(event);
    if (!channels.includes("EMAIL")) return { queued: 0, disabled: true };

    const students: StudentContact[] = await prisma.student.findMany({
      where: {
        status: "ACTIVE",
        studentBatches: { some: { batch: { examBatches: { some: { examId: opts.examId } } } } },
      },
      select: {
        id: true, firstName: true, lastName: true, email: true,
        parentEmail: true, motherEmail: true, communicationContact: true,
      },
    });

    const path = "/student/dashboard";
    const rows: any[] = [];
    for (const s of students) {
      const own = opts.fieldsFor ? opts.fieldsFor(s.id) : {};
      if (own === null) continue;
      const studentName = [s.firstName, s.lastName].filter(Boolean).join(" ");
      const payload: NotifyPayload = {
        ...BLANK_APPLICANT,
        recipientName: studentName,
        studentName,
        link: `${APP_URL}${path}`,
        path,
        ...opts.fields,
        ...own,
      };
      for (const to of addressesFor(s)) {
        rows.push({
          event, channel: "EMAIL", recipientId: null, destination: to,
          payload: payload as unknown as object, entityType: "Exam", entityId: opts.examId,
        });
      }
    }
    if (rows.length) await prisma.notification.createMany({ data: rows });
    return { queued: rows.length, disabled: false };
  } catch (err) {
    console.error(`[notify] failed to queue ${event} for Exam ${opts.examId}`, err);
    return { queued: 0, disabled: false };
  }
}
