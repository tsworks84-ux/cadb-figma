-- CreateEnum
CREATE TYPE "ExamSignoffStatus" AS ENUM ('PENDING', 'APPROVED', 'SENT_BACK', 'BYPASSED');

-- CreateTable
CREATE TABLE "ExamStageSignoff" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "status" "ExamSignoffStatus" NOT NULL DEFAULT 'PENDING',
    "batchNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "fallback" BOOLEAN NOT NULL DEFAULT false,
    "approvedTopics" TEXT,
    "comment" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamStageSignoff_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExamStageSignoff_employeeId_status_idx" ON "ExamStageSignoff"("employeeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ExamStageSignoff_stageId_employeeId_key" ON "ExamStageSignoff"("stageId", "employeeId");

-- AddForeignKey
ALTER TABLE "ExamStageSignoff" ADD CONSTRAINT "ExamStageSignoff_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "ExamStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamStageSignoff" ADD CONSTRAINT "ExamStageSignoff_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data: add "Syllabus approved by batch teachers" as step 2 of every existing
-- exam type that doesn't have a batch-teacher stage yet. Later steps move down
-- one, in the templates and in exams already set up, so stage keys still match.
-- (+1000 then -999 avoids tripping the unique keys mid-update.)
CREATE TEMP TABLE "_syl_types" AS
  SELECT t."id" FROM "ExamType" t
  WHERE NOT EXISTS (SELECT 1 FROM "ExamStageTemplate" s WHERE s."examTypeId" = t."id" AND s."approver" = 'BATCH_TEACHERS');

UPDATE "ExamStageTemplate" SET "sequenceNo" = "sequenceNo" + 1000
  WHERE "sequenceNo" >= 2 AND "examTypeId" IN (SELECT "id" FROM "_syl_types");
UPDATE "ExamStageTemplate" SET "sequenceNo" = "sequenceNo" - 999
  WHERE "sequenceNo" >= 1000 AND "examTypeId" IN (SELECT "id" FROM "_syl_types");

UPDATE "ExamStage" SET "sequenceNo" = "sequenceNo" + 1000
  WHERE "sequenceNo" >= 2 AND "examId" IN (SELECT "id" FROM "Exam" WHERE "examTypeId" IN (SELECT "id" FROM "_syl_types"));
UPDATE "ExamStage" SET "sequenceNo" = "sequenceNo" - 999
  WHERE "sequenceNo" >= 1000 AND "examId" IN (SELECT "id" FROM "Exam" WHERE "examTypeId" IN (SELECT "id" FROM "_syl_types"));

INSERT INTO "ExamStageTemplate" ("id", "examTypeId", "sequenceNo", "name", "description", "offsetDays", "ownerRole", "scope", "canBypass", "approver")
SELECT 'syl_' || md5("id"), "id", 2, 'Syllabus approved by batch teachers',
       'The chapters on the exam for this subject go to the subject''s teacher in every batch writing the exam. Every teacher approves before the blueprint can be submitted.',
       -25, 'EXECUTIVE', 'SUBJECT', false, 'BATCH_TEACHERS'
FROM "_syl_types";

DROP TABLE "_syl_types";
