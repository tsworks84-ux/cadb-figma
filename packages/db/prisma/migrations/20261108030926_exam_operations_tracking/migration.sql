-- CreateEnum
CREATE TYPE "ExamMode" AS ENUM ('PEN_PAPER', 'ONLINE');

-- CreateEnum
CREATE TYPE "ExamTeamRole" AS ENUM ('CONTROLLER', 'EXECUTIVE');

-- CreateEnum
CREATE TYPE "ExamStageOwnerRole" AS ENUM ('CONTROLLER', 'EXECUTIVE', 'PAPER_SETTER', 'REVIEWER');

-- CreateEnum
CREATE TYPE "ExamStageScope" AS ENUM ('EXAM', 'SUBJECT');

-- CreateEnum
CREATE TYPE "ExamStageStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'DONE', 'BYPASSED');

-- CreateEnum
CREATE TYPE "ExamStageAction" AS ENUM ('NOTIFY_STUDENTS', 'RELEASE_RESULTS');

-- AlterTable
ALTER TABLE "Exam" ADD COLUMN     "controllerId" TEXT,
ADD COLUMN     "examTypeId" TEXT,
ADD COLUMN     "executiveId" TEXT,
ADD COLUMN     "mode" "ExamMode",
ADD COLUMN     "resultsReleasedAt" TIMESTAMP(3),
ADD COLUMN     "resultsReleasedById" TEXT,
ADD COLUMN     "studentsNotifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ExamTeamMember" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "role" "ExamTeamRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExamTeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamType" (
    "id" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamStageTemplate" (
    "id" TEXT NOT NULL,
    "examTypeId" TEXT NOT NULL,
    "sequenceNo" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "offsetDays" INTEGER NOT NULL,
    "ownerRole" "ExamStageOwnerRole" NOT NULL,
    "scope" "ExamStageScope" NOT NULL DEFAULT 'EXAM',
    "mode" "ExamMode",
    "action" "ExamStageAction",
    "canBypass" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ExamStageTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamSubjectTeam" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "paperNum" INTEGER NOT NULL,
    "subjectSlot" INTEGER NOT NULL,
    "setterId" TEXT,
    "reviewerId" TEXT,

    CONSTRAINT "ExamSubjectTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamStage" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "templateId" TEXT,
    "sequenceNo" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ownerRole" "ExamStageOwnerRole" NOT NULL,
    "scope" "ExamStageScope" NOT NULL,
    "action" "ExamStageAction",
    "canBypass" BOOLEAN NOT NULL DEFAULT false,
    "offsetDays" INTEGER NOT NULL,
    "paperNum" INTEGER NOT NULL DEFAULT 0,
    "subjectSlot" INTEGER NOT NULL DEFAULT 0,
    "subjectLabel" TEXT,
    "plannedDate" DATE NOT NULL,
    "ownerId" TEXT,
    "ownerOverridden" BOOLEAN NOT NULL DEFAULT false,
    "status" "ExamStageStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "remarks" TEXT,
    "evidenceUrl" TEXT,
    "bypassReason" TEXT,
    "reminderSentAt" TIMESTAMP(3),
    "overdueAlertSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamStageEvent" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExamStageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExamTeamMember_employeeId_key" ON "ExamTeamMember"("employeeId");

-- CreateIndex
CREATE INDEX "ExamType_academicYear_idx" ON "ExamType"("academicYear");

-- CreateIndex
CREATE UNIQUE INDEX "ExamType_academicYear_name_key" ON "ExamType"("academicYear", "name");

-- CreateIndex
CREATE INDEX "ExamStageTemplate_examTypeId_idx" ON "ExamStageTemplate"("examTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamStageTemplate_examTypeId_sequenceNo_key" ON "ExamStageTemplate"("examTypeId", "sequenceNo");

-- CreateIndex
CREATE INDEX "ExamSubjectTeam_examId_idx" ON "ExamSubjectTeam"("examId");

-- CreateIndex
CREATE INDEX "ExamSubjectTeam_setterId_idx" ON "ExamSubjectTeam"("setterId");

-- CreateIndex
CREATE INDEX "ExamSubjectTeam_reviewerId_idx" ON "ExamSubjectTeam"("reviewerId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamSubjectTeam_examId_paperNum_subjectSlot_key" ON "ExamSubjectTeam"("examId", "paperNum", "subjectSlot");

-- CreateIndex
CREATE INDEX "ExamStage_examId_idx" ON "ExamStage"("examId");

-- CreateIndex
CREATE INDEX "ExamStage_ownerId_status_idx" ON "ExamStage"("ownerId", "status");

-- CreateIndex
CREATE INDEX "ExamStage_plannedDate_idx" ON "ExamStage"("plannedDate");

-- CreateIndex
CREATE UNIQUE INDEX "ExamStage_examId_sequenceNo_paperNum_subjectSlot_key" ON "ExamStage"("examId", "sequenceNo", "paperNum", "subjectSlot");

-- CreateIndex
CREATE INDEX "ExamStageEvent_stageId_idx" ON "ExamStageEvent"("stageId");

-- CreateIndex
CREATE INDEX "Exam_examTypeId_idx" ON "Exam"("examTypeId");

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_examTypeId_fkey" FOREIGN KEY ("examTypeId") REFERENCES "ExamType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_controllerId_fkey" FOREIGN KEY ("controllerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_executiveId_fkey" FOREIGN KEY ("executiveId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamTeamMember" ADD CONSTRAINT "ExamTeamMember_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamStageTemplate" ADD CONSTRAINT "ExamStageTemplate_examTypeId_fkey" FOREIGN KEY ("examTypeId") REFERENCES "ExamType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamSubjectTeam" ADD CONSTRAINT "ExamSubjectTeam_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamSubjectTeam" ADD CONSTRAINT "ExamSubjectTeam_setterId_fkey" FOREIGN KEY ("setterId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamSubjectTeam" ADD CONSTRAINT "ExamSubjectTeam_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamStage" ADD CONSTRAINT "ExamStage_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamStage" ADD CONSTRAINT "ExamStage_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamStageEvent" ADD CONSTRAINT "ExamStageEvent_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "ExamStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Every existing exam keeps showing its marks to students exactly as before.
UPDATE "Exam" SET "resultsReleasedAt" = "updatedAt" WHERE "resultsReleasedAt" IS NULL;

-- Student/parent exam emails ship switched OFF. A Super Admin turns them on
-- under Administration → Notifications once the wording and sender are agreed.
INSERT INTO "NotificationSetting" ("event", "emailEnabled", "whatsappEnabled", "inAppEnabled", "updatedAt")
VALUES
  ('EXAM_SCHEDULED',        false, false, false, CURRENT_TIMESTAMP),
  ('EXAM_RESULTS_RELEASED', false, false, false, CURRENT_TIMESTAMP)
ON CONFLICT ("event") DO NOTHING;
