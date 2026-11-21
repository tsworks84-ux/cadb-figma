-- Exam code, and the paper/section/question-range layout behind the New Exam form. Additive only.
ALTER TABLE "Exam" ADD COLUMN "code" TEXT;
ALTER TABLE "Exam" ADD COLUMN "layout" JSONB;
ALTER TABLE "ExamTemplate" ADD COLUMN "layout" JSONB;

CREATE UNIQUE INDEX "Exam_code_key" ON "Exam"("code");
