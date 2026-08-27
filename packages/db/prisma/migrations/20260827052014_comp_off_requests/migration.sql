-- CreateEnum
CREATE TYPE "CompOffStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- AlterTable
ALTER TABLE "LeaveBalance" ADD COLUMN     "earned" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "CompOffRequest" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "workDate" TIMESTAMP(3) NOT NULL,
    "days" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "reason" TEXT NOT NULL,
    "status" "CompOffStatus" NOT NULL DEFAULT 'PENDING',
    "approverId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionNote" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompOffRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompOffRequest_employeeId_idx" ON "CompOffRequest"("employeeId");

-- CreateIndex
CREATE INDEX "CompOffRequest_status_idx" ON "CompOffRequest"("status");

-- CreateIndex
CREATE INDEX "CompOffRequest_workDate_idx" ON "CompOffRequest"("workDate");

-- CreateIndex
CREATE INDEX "CompOffRequest_approverId_idx" ON "CompOffRequest"("approverId");

-- AddForeignKey
ALTER TABLE "CompOffRequest" ADD CONSTRAINT "CompOffRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompOffRequest" ADD CONSTRAINT "CompOffRequest_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
