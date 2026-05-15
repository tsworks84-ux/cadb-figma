/*
  Warnings:

  - You are about to drop the column `topics` on the `Exam` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Exam" DROP COLUMN "topics";

-- AlterTable
ALTER TABLE "ExamSubject" ADD COLUMN     "topics" TEXT;
