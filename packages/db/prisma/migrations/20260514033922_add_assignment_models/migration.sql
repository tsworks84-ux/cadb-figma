-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('DUE', 'COMPLETED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "assignmentDate" DATE NOT NULL,
    "submissionDate" DATE NOT NULL,
    "subjectId" TEXT,
    "employeeId" TEXT,
    "topics" TEXT,
    "note" TEXT,
    "attachmentUrl" TEXT,
    "attachmentName" TEXT,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'DUE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignmentBatch" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,

    CONSTRAINT "AssignmentBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Assignment_academicYear_idx" ON "Assignment"("academicYear");

-- CreateIndex
CREATE INDEX "Assignment_status_idx" ON "Assignment"("status");

-- CreateIndex
CREATE INDEX "Assignment_submissionDate_idx" ON "Assignment"("submissionDate");

-- CreateIndex
CREATE INDEX "Assignment_subjectId_idx" ON "Assignment"("subjectId");

-- CreateIndex
CREATE INDEX "Assignment_employeeId_idx" ON "Assignment"("employeeId");

-- CreateIndex
CREATE INDEX "AssignmentBatch_assignmentId_idx" ON "AssignmentBatch"("assignmentId");

-- CreateIndex
CREATE INDEX "AssignmentBatch_batchId_idx" ON "AssignmentBatch"("batchId");

-- CreateIndex
CREATE UNIQUE INDEX "AssignmentBatch_assignmentId_batchId_key" ON "AssignmentBatch"("assignmentId", "batchId");

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentBatch" ADD CONSTRAINT "AssignmentBatch_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentBatch" ADD CONSTRAINT "AssignmentBatch_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
