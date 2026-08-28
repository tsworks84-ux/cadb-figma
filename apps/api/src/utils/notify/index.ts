import { prisma } from "@cadb/db";
import { whatsappNumberFor } from "../phone.js";
import {
  resolveApprovalRecipients, resolveSelfRecipient, resolveEveryoneElse, type Recipient,
} from "./recipients.js";
import { EVENT_META, GOES_TO_APPLICANT, type NotifyChannel, type NotifyEvent } from "./events.js";
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

export async function notifyLeaveEvent(event: NotifyEvent, leave: LeaveLike, opts?: NotifyOptions): Promise<void> {
  const from = fmtDate(leave.fromDate);
  const to = fmtDate(leave.toDate);

  await enqueue(event, {
    ...opts,
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

export async function notifyCompOffEvent(event: NotifyEvent, compOff: CompOffLike, opts?: NotifyOptions): Promise<void> {
  // The weekday is the whole point of the notice — an approver deciding whether
  // a day was really an off day needs to see "Sunday", not a date they have to
  // look up. Read in UTC: comp-off dates are stored at UTC midnight, and local
  // accessors report the previous day west of Greenwich.
  const weekday = WEEKDAYS[compOff.workDate.getUTCDay()];
  const isWeeklyOff = compOff.workDate.getUTCDay() === 0;

  await enqueue(event, {
    ...opts,
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

type AnnouncementLike = {
  id: string;
  title: string;
  body: string;
  type: string;
  postedById: string;
};

/**
 * Fans a published notice out to every active employee's bell.
 *
 * Unlike the leave and claim events this has no approval chain — the audience
 * is the whole company — so it resolves its own recipients rather than going
 * through `enqueue`'s supervisor/HR routing.
 */
export async function notifyAnnouncementPosted(announcement: AnnouncementLike): Promise<void> {
  await enqueue("ANNOUNCEMENT_POSTED", {
    entityType: "Announcement",
    entityId: announcement.id,
    // The poster is the "applicant" for payload purposes; they are excluded
    // from their own fan-out, same as an applicant never notifies themselves.
    employeeId: announcement.postedById,
    approverId: null,
    path: "/dashboard/announcements",
    audience: "EVERYONE",
    fields: {
      announcementTitle: announcement.title,
      // The bell shows two clamped lines; the full text is one click away.
      announcementBody: announcement.body.replace(/\s+/g, " ").trim().slice(0, 300),
      announcementType: announcement.type,
    },
  });
}

export async function notifyClaimEvent(event: NotifyEvent, claim: ClaimLike, opts?: NotifyOptions): Promise<void> {
  await enqueue(event, {
    ...opts,
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

/**
 * Overrides for a one-off enqueue. Normal application code passes nothing —
 * these exist for the bell backfill, which has to reach the in-app channel for
 * requests raised weeks ago without re-emailing anyone about them.
 */
export type NotifyOptions = {
  /** Narrow delivery to these channels, on top of the event's own list. */
  onlyChannels?: NotifyChannel[];
  /** Skip a recipient who already has a row for this event and entity. */
  dedupe?: boolean;
};

type EnqueueSpec = NotifyOptions & {
  entityType: string;
  entityId: string;
  employeeId: string;
  approverId: string | null;
  path: string;
  fields: Partial<NotifyPayload>;
  /**
   * Who hears about it. The default routes by event: decisions go back to the
   * applicant, everything else up the approval chain. `EVERYONE` is for
   * company-wide notices that have no chain at all.
   */
  audience?: "EVERYONE";
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
    // An event only ever uses the channels its metadata claims — an
    // announcement is bell-only however the Super-Admin toggles are set.
    const supported = new Set<NotifyChannel>(EVENT_META[event].channels);
    const wanted = spec.onlyChannels ? new Set(spec.onlyChannels) : null;
    const on = (c: NotifyChannel) => supported.has(c) && (!wanted || wanted.has(c));
    const channels: NotifyChannel[] = [
      ...(on("EMAIL") && allowed.emailEnabled && emailConfigured() ? ["EMAIL" as const] : []),
      ...(on("WHATSAPP") && allowed.whatsappEnabled && whatsappConfigured() ? ["WHATSAPP" as const] : []),
      // In-app needs nothing configured: writing the row *is* the delivery.
      ...(on("IN_APP") && allowed.inAppEnabled ? ["IN_APP" as const] : []),
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

    const recipients =
      spec.audience === "EVERYONE" ? await resolveEveryoneElse(spec.employeeId)
      : GOES_TO_APPLICANT.has(event) ? await resolveSelfRecipient(spec.employeeId)
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
      path: spec.path,
      ...spec.fields,
    };

    let rows = recipients.flatMap((r) => buildRows(event, spec, r, base, channels));

    if (spec.dedupe && rows.length > 0) {
      const existing = await prisma.notification.findMany({
        where: { event, entityType: spec.entityType, entityId: spec.entityId },
        select: { recipientId: true, channel: true },
      });
      const seen = new Set(existing.map((e) => `${e.recipientId}:${e.channel}`));
      rows = rows.filter((r) => !seen.has(`${r.recipientId}:${r.channel}`));
    }

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
  channels: NotifyChannel[],
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

  if (channels.includes("IN_APP")) {
    // Born SENT: the bell reads this table, so the row is the delivery. Leaving
    // it PENDING would park an undeliverable row in the dispatcher's queue.
    rows.push({
      ...common,
      channel: "IN_APP" as const,
      destination: recipient.id,
      status: "SENT" as const,
      sentAt: new Date(),
    });
  }

  return rows;
}
