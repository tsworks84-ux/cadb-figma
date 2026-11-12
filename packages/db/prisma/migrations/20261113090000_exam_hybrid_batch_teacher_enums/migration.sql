-- Enum labels in their own migration so they are committed before anything uses them.
ALTER TYPE "ExamMode" ADD VALUE IF NOT EXISTS 'HYBRID';
ALTER TYPE "ExamStageApprover" ADD VALUE IF NOT EXISTS 'BATCH_TEACHERS';
