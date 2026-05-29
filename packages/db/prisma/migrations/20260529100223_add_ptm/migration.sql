-- CreateEnum
CREATE TYPE "PTMStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "PTM" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT,
    "venue" TEXT,
    "agenda" TEXT,
    "status" "PTMStatus" NOT NULL DEFAULT 'SCHEDULED',
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PTM_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PTMAttendee" (
    "id" TEXT NOT NULL,
    "ptmId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PTMAttendee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PTM_studentId_idx" ON "PTM"("studentId");

-- CreateIndex
CREATE INDEX "PTM_date_idx" ON "PTM"("date");

-- CreateIndex
CREATE INDEX "PTMAttendee_ptmId_idx" ON "PTMAttendee"("ptmId");

-- CreateIndex
CREATE UNIQUE INDEX "PTMAttendee_ptmId_employeeId_key" ON "PTMAttendee"("ptmId", "employeeId");

-- AddForeignKey
ALTER TABLE "PTM" ADD CONSTRAINT "PTM_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PTM" ADD CONSTRAINT "PTM_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PTMAttendee" ADD CONSTRAINT "PTMAttendee_ptmId_fkey" FOREIGN KEY ("ptmId") REFERENCES "PTM"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PTMAttendee" ADD CONSTRAINT "PTMAttendee_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
