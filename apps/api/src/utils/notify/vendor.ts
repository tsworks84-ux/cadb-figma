import { prisma } from "@cadb/db";
import { EVENT_META, type NotifyChannel, type NotifyEvent } from "./events.js";
import { channelsEnabledFor } from "./settings.js";
import { emailConfigured } from "./channels/email.js";
import type { NotifyPayload } from "./templates.js";
import { WORKING_STATUSES } from "../staffStatus.js";
import type { PermAction } from "../permissions.js";

/**
 * Enqueue side for vendor-management notices.
 *
 * Like exam notices, these have no applicant/approval chain to walk: the
 * approving authority and the Accounts team are whoever the permission matrix
 * says they are. Same outbox rows and Super-Admin channel switches as every
 * other notice. Never throws — a notification problem must not fail the action.
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
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
 * Working staff whose role holds `action` on `module`.
 *
 * Super Admins hold every grant implicitly, but copying them on every vendor
 * notice would bury them once the duty is delegated. So they are the fallback:
 * included only when no other role holds the grant — which is exactly the
 * situation on day one, when nobody else has been given it yet.
 */
export async function employeesWithPermission(module: string, action: PermAction): Promise<string[]> {
  const grants = await prisma.rolePermission.findMany({
    where: { module, [action]: true, role: { not: "SUPER_ADMIN" } },
    select: { role: true },
  });
  const staffWhere = { deletedAt: null, status: { in: [...WORKING_STATUSES] } };
  if (grants.length) {
    const holders = await prisma.employee.findMany({
      where: { ...staffWhere, role: { in: grants.map((g) => g.role) } },
      select: { id: true },
    });
    if (holders.length) return holders.map((e) => e.id);
  }
  const admins = await prisma.employee.findMany({
    where: { ...staffWhere, role: "SUPER_ADMIN" },
    select: { id: true },
  });
  return admins.map((e) => e.id);
}

export async function notifyVendorStaff(
  event: NotifyEvent,
  opts: {
    entityType: "Vendor" | "VendorPayment";
    entityId: string;
    employeeIds: string[];
    /** Never notify the person who caused the event about their own action. */
    excludeId?: string;
    path: string;
    fields: Partial<NotifyPayload>;
  },
): Promise<void> {
  try {
    const ids = [...new Set(opts.employeeIds.filter((id) => id && id !== opts.excludeId))];
    if (ids.length === 0) return;
    const channels = await enabledChannels(event);
    if (channels.length === 0) return;

    const people = await prisma.employee.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: { id: true, firstName: true, email: true },
    });

    const rows: any[] = [];
    for (const person of people) {
      const payload: NotifyPayload = {
        ...BLANK_APPLICANT,
        recipientName: person.firstName,
        link: `${APP_URL}${opts.path}`,
        path: opts.path,
        ...opts.fields,
      };
      const common = {
        event, recipientId: person.id, payload: payload as unknown as object,
        entityType: opts.entityType, entityId: opts.entityId,
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
    console.error(`[notify] failed to queue ${event} for ${opts.entityType} ${opts.entityId}`, err);
  }
}
