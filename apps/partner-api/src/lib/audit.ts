import type { Prisma } from "@cadb/partner-db";
import { partnerDb } from "../db.js";

type Tx = Prisma.TransactionClient;

// Record a partner-admin change. Pass the transaction client when the change
// itself runs in a transaction, so the log entry commits or rolls back with it.
export function recordAdminAudit(
  adminUserId: string,
  action: string,
  entityType: string,
  entityId: string,
  change: { before?: unknown; after?: unknown } = {},
  tx: Tx = partnerDb,
) {
  return tx.adminAuditLog.create({
    data: {
      adminUserId,
      action,
      entityType,
      entityId,
      before: change.before === undefined ? undefined : (JSON.parse(JSON.stringify(change.before)) as Prisma.InputJsonValue),
      after: change.after === undefined ? undefined : (JSON.parse(JSON.stringify(change.after)) as Prisma.InputJsonValue),
    },
  });
}
