-- Enum additions live in their own migration so the new labels are committed
-- before any later migration (or application code) references them.

-- AlterEnum
ALTER TYPE "LeaveStatus" ADD VALUE IF NOT EXISTS 'CANCELLATION_PENDING';

-- AlterEnum
ALTER TYPE "ClaimStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
ALTER TYPE "ClaimStatus" ADD VALUE IF NOT EXISTS 'CANCELLATION_PENDING';
