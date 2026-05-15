-- CreateEnum
CREATE TYPE "ExamStatus" AS ENUM ('DUE', 'COMPLETED', 'MARKED', 'CANCELLED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ExamType" AS ENUM ('SINGLE', 'GROUP');

-- CreateTable
CREATE TABLE "Exam" (
    "id" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "testType" "ExamType" NOT NULL DEFAULT 'SINGLE',
    "subjectId" TEXT,
    "topics" TEXT,
    "examDate" DATE NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "passingMarks" INTEGER,
    "totalMarks" INTEGER,
    "status" "ExamStatus" NOT NULL DEFAULT 'DUE',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamBatch" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,

    CONSTRAINT "ExamBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Exam_academicYear_idx" ON "Exam"("academicYear");

-- CreateIndex
CREATE INDEX "Exam_status_idx" ON "Exam"("status");

-- CreateIndex
CREATE INDEX "Exam_examDate_idx" ON "Exam"("examDate");

-- CreateIndex
CREATE INDEX "Exam_subjectId_idx" ON "Exam"("subjectId");

-- CreateIndex
CREATE INDEX "ExamBatch_examId_idx" ON "ExamBatch"("examId");

-- CreateIndex
CREATE INDEX "ExamBatch_batchId_idx" ON "ExamBatch"("batchId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamBatch_examId_batchId_key" ON "ExamBatch"("examId", "batchId");

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamBatch" ADD CONSTRAINT "ExamBatch_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamBatch" ADD CONSTRAINT "ExamBatch_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
