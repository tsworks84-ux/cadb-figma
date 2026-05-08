-- CreateEnum
CREATE TYPE "BonusPlanFrequency" AS ENUM ('MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "BonusPlanStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "BonusPayoutStatus" AS ENUM ('SCHEDULED', 'PAID', 'CANCELLED');

-- AlterTable
ALTER TABLE "RolePermission" ADD COLUMN     "canAppraise" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "BonusPlan" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "appraiserId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "frequency" "BonusPlanFrequency" NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "status" "BonusPlanStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BonusPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BonusPayout" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "status" "BonusPayoutStatus" NOT NULL DEFAULT 'SCHEDULED',
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BonusPayout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BonusPlan_employeeId_idx" ON "BonusPlan"("employeeId");

-- CreateIndex
CREATE INDEX "BonusPlan_appraiserId_idx" ON "BonusPlan"("appraiserId");

-- CreateIndex
CREATE INDEX "BonusPlan_status_idx" ON "BonusPlan"("status");

-- CreateIndex
CREATE INDEX "BonusPayout_planId_idx" ON "BonusPayout"("planId");

-- CreateIndex
CREATE INDEX "BonusPayout_employeeId_idx" ON "BonusPayout"("employeeId");

-- CreateIndex
CREATE INDEX "BonusPayout_scheduledDate_idx" ON "BonusPayout"("scheduledDate");

-- CreateIndex
CREATE INDEX "BonusPayout_status_idx" ON "BonusPayout"("status");

-- AddForeignKey
ALTER TABLE "BonusPlan" ADD CONSTRAINT "BonusPlan_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BonusPlan" ADD CONSTRAINT "BonusPlan_appraiserId_fkey" FOREIGN KEY ("appraiserId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BonusPayout" ADD CONSTRAINT "BonusPayout_planId_fkey" FOREIGN KEY ("planId") REFERENCES "BonusPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BonusPayout" ADD CONSTRAINT "BonusPayout_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
