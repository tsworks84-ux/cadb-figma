-- Enum label in its own migration so it is committed before anything uses it.
ALTER TYPE "ExamStageOwnerRole" ADD VALUE IF NOT EXISTS 'EVALUATOR';
