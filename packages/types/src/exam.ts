/**
 * The structure of an exam as built on the New Exam form:
 * paper → sections → subjects → question ranges.
 *
 * Stored on Exam.layout / ExamTemplate.layout. Marks are still entered per
 * (paper, subject slot) — the ExamSubject rows — which are derived from this:
 * every distinct subject within a paper is one slot, so a subject that appears in
 * two sections of the same paper is still one marks column.
 *
 * Types only: this package is imported with `import type` (the API runs compiled
 * JS and the web app doesn't transpile workspace packages), so the runtime pieces
 * — the question-type list and max-marks maths — live in each app.
 */

export type QuestionType =
  | "SCQ" | "MCQ" | "NAT" | "INTEGER" | "MATRIX" | "ASSERTION" | "PARAGRAPH" | "SUBJECTIVE";

export type QuestionRange = {
  /** First and last question number, inclusive. */
  from: number;
  to: number;
  type: QuestionType;
  /** Marks for a correct answer. */
  marks: number;
  /** Marks deducted for a wrong answer, as a positive number (0 = none). */
  negative: number;
};

export type LayoutSubject = {
  subjectId: string | null;
  topics?: string | null;
  /** Used only when the subject has no question ranges (exams made before layouts). */
  maxMarks?: number | null;
  ranges: QuestionRange[];
};

export type LayoutSection = { name: string; subjects: LayoutSubject[] };
export type LayoutPaper = { sections: LayoutSection[] };
export type ExamLayout = { papers: LayoutPaper[] };
