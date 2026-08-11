import { prisma } from "@cadb/db";
import type { FastifyRequest } from "fastify";
import type { JwtPayload } from "@cadb/types";

/**
 * Append-only trail for destructive and override actions.
 *
 * Deletions are the reason this exists: once an admin removes a leave
 * application or a reimbursement claim the row is gone, so the whole record is
 * snapshotted into `oldValues` and summarised into `summary`. Force-cancels are
 * logged the same way — the row survives, but somebody overrode a decision and
 * that should be answerable for.
 *
 * Never throws: an audit write must not be able to fail the operation it
 * describes, and the caller has already committed by the time we get here.
 */
export type AuditAction = "DELETE" | "FORCE_CANCEL";
export type AuditEntity = "LeaveApplication" | "ReimbursementClaim";

export async function recordAudit(opts: {
  request: FastifyRequest;
  action: AuditAction;
  entity: AuditEntity;
  entityId: string;
  summary: string;
  /** Full snapshot of the record as it stood before the action. */
  oldValues: unknown;
  /** Context for the action — typically `{ reason }`. */
  newValues?: unknown;
}): Promise<void> {
  const user = opts.request.user as JwtPayload | undefined;
  try {
    await prisma.auditLog.create({
      data: {
        employeeId: user?.sub ?? null,
        action: opts.action,
        entity: opts.entity,
        entityId: opts.entityId,
        summary: opts.summary,
        oldValues: JSON.parse(JSON.stringify(opts.oldValues ?? null)),
        newValues: opts.newValues == null
          ? undefined
          : JSON.parse(JSON.stringify(opts.newValues)),
        ipAddress: opts.request.ip,
        userAgent: opts.request.headers["user-agent"] ?? null,
      },
    });
  } catch (err) {
    opts.request.log.error({ err }, "Failed to write audit log entry");
  }
}

/** "Rahul Verma (EMP012)" — falls back gracefully when the join wasn't loaded. */
export function describeEmployee(
  employee?: { firstName?: string; lastName?: string; employeeCode?: string } | null,
): string {
  if (!employee) return "Unknown employee";
  const name = [employee.firstName, employee.lastName].filter(Boolean).join(" ").trim();
  return employee.employeeCode ? `${name || "Unknown"} (${employee.employeeCode})` : name || "Unknown";
}
