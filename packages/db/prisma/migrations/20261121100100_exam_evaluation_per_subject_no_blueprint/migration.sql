-- ─── Per-subject evaluators and evaluation window ────────────────────────────
ALTER TABLE "ExamSubjectTeam" ADD COLUMN "evaluatorId" TEXT;
ALTER TABLE "ExamSubjectTeam" ADD COLUMN "evalStartDate" DATE;
ALTER TABLE "ExamSubjectTeam" ADD COLUMN "evalEndDate" DATE;

CREATE INDEX "ExamSubjectTeam_evaluatorId_idx" ON "ExamSubjectTeam"("evaluatorId");

ALTER TABLE "ExamSubjectTeam" ADD CONSTRAINT "ExamSubjectTeam_evaluatorId_fkey"
  FOREIGN KEY ("evaluatorId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- The evaluation step becomes one stage per subject, owned by that subject's evaluator.
UPDATE "ExamStageTemplate"
   SET "scope" = 'SUBJECT', "ownerRole" = 'EVALUATOR',
       "description" = 'Each subject''s evaluator marks the answer sheets within the evaluation window set for the subject, and the marks are entered.'
 WHERE "name" = 'Evaluation & marks entered' AND "scope" = 'EXAM';

-- Exams already set up: an untouched exam-wide evaluation stage is split into one
-- stage per subject (no owner until an evaluator is picked). Started ones are kept.
INSERT INTO "ExamStage" ("id", "examId", "templateId", "sequenceNo", "name", "description", "ownerRole", "scope",
                         "canBypass", "offsetDays", "paperNum", "subjectSlot", "subjectLabel", "plannedDate",
                         "overdueAlertSentAt", "createdAt", "updatedAt")
SELECT 'evl_' || md5(st."id" || '_' || es."paperNum" || '_' || es."subjectSlot"),
       st."examId", st."templateId", st."sequenceNo", st."name",
       'Each subject''s evaluator marks the answer sheets within the evaluation window set for the subject, and the marks are entered.',
       'EVALUATOR', 'SUBJECT', st."canBypass", st."offsetDays", es."paperNum", es."subjectSlot",
       CASE WHEN e."numPapers" > 1 THEN 'Paper ' || es."paperNum" || ' · ' ELSE '' END || COALESCE(sub."name", 'Subject ' || es."subjectSlot"),
       st."plannedDate", st."overdueAlertSentAt", NOW(), NOW()
  FROM "ExamStage" st
  JOIN "Exam" e ON e."id" = st."examId"
  JOIN "ExamSubject" es ON es."examId" = st."examId"
  LEFT JOIN "Subject" sub ON sub."id" = es."subjectId"
 WHERE st."name" = 'Evaluation & marks entered' AND st."scope" = 'EXAM' AND st."status" = 'NOT_STARTED'
ON CONFLICT DO NOTHING;

DELETE FROM "ExamStage"
 WHERE "name" = 'Evaluation & marks entered' AND "scope" = 'EXAM' AND "status" = 'NOT_STARTED';

-- ─── Blueprint step removed: the blueprint now comes with the exam template ───
DELETE FROM "ExamStageTemplate" WHERE "form" = 'BLUEPRINT';

-- Untouched blueprint stages go; any in progress or awaiting approval are closed
-- as bypassed with the reason recorded. Finished ones stay as history.
DELETE FROM "ExamStage" WHERE "form" = 'BLUEPRINT' AND "status" = 'NOT_STARTED';

INSERT INTO "ExamStageEvent" ("id", "stageId", "actorName", "action", "fromStatus", "toStatus", "note", "createdAt")
SELECT 'bpx_' || md5("id"), "id", 'System', 'BYPASSED', "status"::text, 'BYPASSED',
       'Blueprint step removed: the blueprint comes with the exam template', NOW()
  FROM "ExamStage" WHERE "form" = 'BLUEPRINT' AND "status" IN ('IN_PROGRESS', 'PENDING_APPROVAL');

UPDATE "ExamStage"
   SET "status" = 'BYPASSED', "completedAt" = NOW(), "submittedAt" = NULL, "approverId" = NULL,
       "bypassReason" = 'Blueprint step removed: the blueprint comes with the exam template'
 WHERE "form" = 'BLUEPRINT' AND "status" IN ('IN_PROGRESS', 'PENDING_APPROVAL');
