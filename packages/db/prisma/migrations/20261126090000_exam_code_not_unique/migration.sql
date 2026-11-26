-- Exam codes are optional and may repeat (one exam per centre for the same paper).
DROP INDEX "Exam_code_key";

CREATE INDEX "Exam_code_idx" ON "Exam"("code");
