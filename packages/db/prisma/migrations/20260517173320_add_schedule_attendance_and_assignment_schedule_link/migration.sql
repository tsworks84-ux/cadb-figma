-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN     "scheduleId" TEXT;

-- CreateTable
CREATE TABLE "ScheduleAttendance" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "isPresent" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduleAttendance_scheduleId_idx" ON "ScheduleAttendance"("scheduleId");

-- CreateIndex
CREATE INDEX "ScheduleAttendance_studentId_idx" ON "ScheduleAttendance"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleAttendance_scheduleId_studentId_key" ON "ScheduleAttendance"("scheduleId", "studentId");

-- CreateIndex
CREATE INDEX "Assignment_scheduleId_idx" ON "Assignment"("scheduleId");

-- AddForeignKey
ALTER TABLE "ScheduleAttendance" ADD CONSTRAINT "ScheduleAttendance_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleAttendance" ADD CONSTRAINT "ScheduleAttendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
