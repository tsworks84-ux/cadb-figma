import { prisma } from "@cadb/db";
import { whatsappNumberFor } from "../phone.js";
import { resolveApprovalRecipients, resolveSelfRecipient, type Recipient } from "./recipients.js";
import { GOES_TO_APPLICANT, type NotifyEvent } from "./events.js";
import { channelsEnabledFor } from "./settings.js";
import type { NotifyPayload } from "./templates.js";
import { emailConfigured } from "./channels/email.js";
import { whatsappConfigured } from "./channels/whatsapp.js";

export type { NotifyEvent } from "./events.js";

/**
 * Enqueue side of the notification outbox.
 *
 * Nothing is sent from here. The request writes rows and returns; the
 * dispatcher delivers them out-of-band. That keeps a slow or down SMTP/Meta
 * endpoint from adding seconds to an employee's submission, and means a crash
 * between "saved" and "manager told" is recoverable rather than silent — which
 * is exactly what the old fire-and-forget `sendEmailForLeave` could not offer.
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";

const dateFmt = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata",
});

const moneyFmt = new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", maximumFractionDigits: 2,
});

function fmtDate(d: Date | string): string {
  return dateFmt.format(new Date(d));
}

// ─── PUBLIC ENTRY POINTS ─────────────────────────────────────────────────────

type LeaveLike = {
  id: string;
  employeeId: string;
  leaveType: string;
  fromDate: Date;
  toDate: Date;
  totalDays: number;
  reason: string;
  cancelReason?: string | null;
  rejectionNote?: string | null;
  lopDays?: number | null;
  approverId?: string | null;
};

export async function notifyLeaveEvent(event: NotifyEvent, leave: LeaveLike): Promise<void> {
  const from = fmtDate(leave.fromDate);
  const to = fmtDate(leave.toDate);

  await enqueue(event, {
    entityType: "LeaveApplication",
    entityId: leave.id,
    employeeId: leave.employeeId,
    approverId: leave.approverId ?? null,
    path: "/dashboard/leaves",
    fields: {
      leaveType: leave.leaveType,
      fromDate: from,
      toDate: to,
      dateRange: from === to ? from : `${from} – ${to}`,
      totalDays: String(leave.totalDays),
      reason: leave.reason,
      cancelReason: leave.cancelReason ?? undefined,
      decisionNote: leave.rejectionNote ?? undefined,
      lopDays: leave.lopDays != null ? String(leave.lopDays) : undefined,
    },
  });
}

type CompOffLike = {
  id: string;
  employeeId: string;
  workDate: Date;
  days: number;
  reason: string;
  rejectionNote?: string | null;
  approverId?: string | null;
};

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export async function notifyCompOffEvent(event: NotifyEvent, compOff: CompOffLike): Promise<void> {
  // The weekday is the whole point of the notice — an approver deciding whether
  // a day was really an off day needs to see "Sunday", not a date they have to
  // look up. Read in UTC: comp-off dates are stored at UTC midnight, and local
  // accessors report the previous day west of Greenwich.
  const weekday = WEEKDAYS[compOff.workDate.getUTCDay()];
  const isWeeklyOff = compOff.workDate.getUTCDay() === 0;

  await enqueue(event, {
    entityType: "CompOffRequest",
    entityId: compOff.id,
    employeeId: compOff.employeeId,
    approverId: compOff.approverId ?? null,
    path: "/dashboard/leaves",
    fields: {
      workDate: fmtDate(compOff.workDate),
      weekday,
      dayContext: isWeeklyOff ? `${weekday} — weekly off` : weekday,
      compOffDays: String(compOff.days),
      reason: compOff.reason,
      decisionNote: compOff.rejectionNote ?? undefined,
    },
  });
}

type ClaimLike = {
  id: string;
  claimNumber: string;
  employeeId: string;
  claimType: string;
  title: string;
  claimedAmount: number;
  approvedAmount?: number | null;
  cancelReason?: string | null;
  rejectionNote?: string | null;
  approverId?: string | null;
};

export async function notifyClaimEvent(event: NotifyEvent, claim: ClaimLike): Promise<void> {
  await enqueue(event, {
    entityType: "ReimbursementClaim",
    entityId: claim.id,
    employeeId: claim.employeeId,
    approverId: claim.approverId ?? null,
    path: "/dashboard/claims",
    fields: {
      claimNumber: claim.claimNumber,
      claimType: claim.claimType,
      title: claim.title,
      claimedAmount: moneyFmt.format(claim.claimedAmount),
      approvedAmount: claim.approvedAmount != null ? moneyFmt.format(claim.approvedAmount) : undefined,
      cancelReason: claim.cancelReason ?? undefined,
      decisionNote: claim.rejectionNote ?? undefined,
    },
  });
}

// ─── SHARED CORE ─────────────────────────────────────────────────────────────

type EnqueueSpec = {
  entityType: string;
  entityId: string;
  employeeId: string;
  approverId: string | null;
  path: string;
  fields: Partial<NotifyPayload>;
};

/**
 * Resolve recipients, expand across the enabled channels, write the rows.
 *
 * Never throws: a notification problem must not fail — or worse, roll back —
 * the action that triggered it. Failures are logged and, once a row exists,
 * visible in the outbox.
 */
async function enqueue(event: NotifyEvent, spec: EnqueueSpec): Promise<void> {
  try {
    // Two independent gates: what the Super Admin allows, and what the server
    // is actually able to send. A channel needs both.
    const allowed = await channelsEnabledFor(event);
    const channels = [
      ...(allowed.emailEnabled && emailConfigured() ? ["EMAIL" as const] : []),
      ...(allowed.whatsappEnabled && whatsappConfigured() ? ["WHATSAPP" as const] : []),
    ];
    if (channels.length === 0) return;

    const applicant = await prisma.employee.findUnique({
      where: { id: spec.employeeId },
      select: {
        firstName: true, lastName: true, employeeCode: true,
        department: { select: { name: true } },
      },
    });
    if (!applicant) return;

    const recipients = GOES_TO_APPLICANT.has(event)
      ? await resolveSelfRecipient(spec.employeeId)
      : await resolveApprovalRecipients(spec.employeeId);

    if (recipients.length === 0) {
      // Worth a log line: an employee with no supervisor, no department head
      // and no HR pool is a configuration hole, not a normal state.
      console.warn(`[notify] ${event} for ${spec.entityType} ${spec.entityId}: no recipients resolved`);
      return;
    }

    const approver = spec.approverId
      ? await prisma.employee.findUnique({
          where: { id: spec.approverId },
          select: { firstName: true, lastName: true },
        })
      : null;

    const base: Omit<NotifyPayload, "recipientName"> = {
      applicantName: `${applicant.firstName} ${applicant.lastName}`,
      applicantCode: applicant.employeeCode,
      department: applicant.department?.name ?? "—",
      approverName: approver ? `${approver.firstName} ${approver.lastName}` : "Your approver",
      link: `${APP_URL}${spec.path}`,
      ...spec.fields,
    };

    const rows = recipients.flatMap((r) => buildRows(event, spec, r, base, channels));
    if (rows.length === 0) return;

    await prisma.notification.createMany({ data: rows });
  } catch (err) {
    console.error(`[notify] failed to queue ${event} for ${spec.entityType} ${spec.entityId}`, err);
  }
}

function buildRows(
  event: NotifyEvent,
  spec: EnqueueSpec,
  recipient: Recipient,
  base: Omit<NotifyPayload, "recipientName">,
  channels: Array<"EMAIL" | "WHATSAPP">,
) {
  const payload: NotifyPayload = { ...base, recipientName: recipient.firstName };
  const common = {
    event,
    recipientId: recipient.id,
    payload: payload as unknown as object,
    entityType: spec.entityType,
    entityId: spec.entityId,
  };

  const rows: any[] = [];

  if (channels.includes("EMAIL") && recipient.email) {
    rows.push({ ...common, channel: "EMAIL" as const, destination: recipient.email });
  }

  if (channels.includes("WHATSAPP")) {
    // No usable number, or opted out — no row at all. A SKIPPED row per person
    // per event would bury the rows that actually need attention.
    const number = whatsappNumberFor(recipient);
    if (number) {
      rows.push({ ...common, channel: "WHATSAPP" as const, destination: number });
    }
  }

  return rows;
}
