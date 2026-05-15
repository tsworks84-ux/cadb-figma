-- CreateEnum
CREATE TYPE "ScheduleStatus" AS ENUM ('UPCOMING', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Schedule" (
    "id" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "subjectId" TEXT,
    "employeeId" TEXT,
    "locationId" TEXT,
    "date" DATE NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "topics" TEXT,
    "notes" TEXT,
    "status" "ScheduleStatus" NOT NULL DEFAULT 'UPCOMING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleBatch" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,

    CONSTRAINT "ScheduleBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Schedule_date_idx" ON "Schedule"("date");

-- CreateIndex
CREATE INDEX "Schedule_status_idx" ON "Schedule"("status");

-- CreateIndex
CREATE INDEX "Schedule_academicYear_idx" ON "Schedule"("academicYear");

-- CreateIndex
CREATE INDEX "Schedule_employeeId_idx" ON "Schedule"("employeeId");

-- CreateIndex
CREATE INDEX "Schedule_locationId_idx" ON "Schedule"("locationId");

-- CreateIndex
CREATE INDEX "ScheduleBatch_scheduleId_idx" ON "ScheduleBatch"("scheduleId");

-- CreateIndex
CREATE INDEX "ScheduleBatch_batchId_idx" ON "ScheduleBatch"("batchId");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleBatch_scheduleId_batchId_key" ON "ScheduleBatch"("scheduleId", "batchId");

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleBatch" ADD CONSTRAINT "ScheduleBatch_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleBatch" ADD CONSTRAINT "ScheduleBatch_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
