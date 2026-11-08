-- CreateEnum
CREATE TYPE "ExamStageApprover" AS ENUM ('SUBJECT_HEAD', 'CONTROLLER');

-- CreateEnum
CREATE TYPE "ExamStageForm" AS ENUM ('BLUEPRINT');

-- AlterEnum
ALTER TYPE "ExamStageStatus" ADD VALUE 'PENDING_APPROVAL';

-- AlterTable
ALTER TABLE "ExamStage" ADD COLUMN     "approver" "ExamStageApprover",
ADD COLUMN     "approverId" TEXT,
ADD COLUMN     "form" "ExamStageForm",
ADD COLUMN     "formData" JSONB,
ADD COLUMN     "submittedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ExamStageTemplate" ADD COLUMN     "approver" "ExamStageApprover",
ADD COLUMN     "form" "ExamStageForm";

-- AlterTable
ALTER TABLE "ExamSubjectTeam" ADD COLUMN     "approverId" TEXT;

-- AlterTable
ALTER TABLE "Subject" ADD COLUMN     "headId" TEXT;

-- CreateIndex
CREATE INDEX "ExamStage_approverId_status_idx" ON "ExamStage"("approverId", "status");

-- CreateIndex
CREATE INDEX "ExamSubjectTeam_approverId_idx" ON "ExamSubjectTeam"("approverId");

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_headId_fkey" FOREIGN KEY ("headId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamSubjectTeam" ADD CONSTRAINT "ExamSubjectTeam_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamStage" ADD CONSTRAINT "ExamStage_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Data: the standard "Syllabus & blueprint finalised" step becomes a blueprint
-- form approved by the subject head. The syllabus itself is entered when the
-- exam is created, so the step only covers the blueprint now. Stages already
-- closed keep their name and history; open ones switch over.
UPDATE "ExamStageTemplate"
SET "name" = 'Blueprint finalised',
    "description" = 'Marks, question count and question type for each syllabus chapter, plus the difficulty mix. Approved by the subject head.',
    "form" = 'BLUEPRINT',
    "approver" = 'SUBJECT_HEAD'
WHERE "name" = 'Syllabus & blueprint finalised' AND "ownerRole" = 'PAPER_SETTER' AND "scope" = 'SUBJECT';

UPDATE "ExamStage"
SET "name" = 'Blueprint finalised',
    "description" = 'Marks, question count and question type for each syllabus chapter, plus the difficulty mix. Approved by the subject head.',
    "form" = 'BLUEPRINT',
    "approver" = 'SUBJECT_HEAD'
WHERE "name" = 'Syllabus & blueprint finalised' AND "ownerRole" = 'PAPER_SETTER' AND "scope" = 'SUBJECT'
  AND "status" IN ('NOT_STARTED', 'IN_PROGRESS');
