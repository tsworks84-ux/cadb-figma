/*
  Warnings:

  - You are about to drop the column `passingMarks` on the `Exam` table. All the data in the column will be lost.
  - You are about to drop the column `subjectId` on the `Exam` table. All the data in the column will be lost.
  - You are about to drop the column `testType` on the `Exam` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Exam" DROP CONSTRAINT "Exam_subjectId_fkey";

-- DropIndex
DROP INDEX "Exam_subjectId_idx";

-- AlterTable
ALTER TABLE "Exam" DROP COLUMN "passingMarks",
DROP COLUMN "subjectId",
DROP COLUMN "testType",
ADD COLUMN     "numPapers" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "numSubjects" INTEGER NOT NULL DEFAULT 1;

-- DropEnum
DROP TYPE "ExamType";

-- CreateTable
CREATE TABLE "ExamSubject" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "paperNum" INTEGER NOT NULL,
    "subjectSlot" INTEGER NOT NULL,
    "subjectId" TEXT,

    CONSTRAINT "ExamSubject_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExamSubject_examId_idx" ON "ExamSubject"("examId");

-- CreateIndex
CREATE INDEX "ExamSubject_subjectId_idx" ON "ExamSubject"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamSubject_examId_paperNum_subjectSlot_key" ON "ExamSubject"("examId", "paperNum", "subjectSlot");

-- AddForeignKey
ALTER TABLE "ExamSubject" ADD CONSTRAINT "ExamSubject_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamSubject" ADD CONSTRAINT "ExamSubject_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
