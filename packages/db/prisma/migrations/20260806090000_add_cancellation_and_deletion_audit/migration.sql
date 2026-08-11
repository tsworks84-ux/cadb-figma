-- AlterTable
ALTER TABLE "LeaveApplication"
  ADD COLUMN "cancelReason"        TEXT,
  ADD COLUMN "cancelRequestedAt"   TIMESTAMP(3),
  ADD COLUMN "cancelledAt"         TIMESTAMP(3),
  ADD COLUMN "cancelApproverId"    TEXT,
  ADD COLUMN "cancelRejectionNote" TEXT;

-- AlterTable
ALTER TABLE "ReimbursementClaim"
  ADD COLUMN "cancelReason"        TEXT,
  ADD COLUMN "cancelRequestedAt"   TIMESTAMP(3),
  ADD COLUMN "cancelledAt"         TIMESTAMP(3),
  ADD COLUMN "cancelApproverId"    TEXT,
  ADD COLUMN "cancelRejectionNote" TEXT;

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN "summary" TEXT;

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- AddForeignKey
ALTER TABLE "LeaveApplication"
  ADD CONSTRAINT "LeaveApplication_cancelApproverId_fkey"
  FOREIGN KEY ("cancelApproverId") REFERENCES "Employee"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReimbursementClaim"
  ADD CONSTRAINT "ReimbursementClaim_cancelApproverId_fkey"
  FOREIGN KEY ("cancelApproverId") REFERENCES "Employee"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
