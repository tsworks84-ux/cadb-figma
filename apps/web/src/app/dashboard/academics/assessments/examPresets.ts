/**
 * Built-in exam patterns offered on the New Assessment form.
 *
 * Subjects are named, not referenced by id, because every install creates its
 * own Subject rows under Academics → Settings. `resolveSubjectId` matches a
 * preset subject to one of those rows by code or name, so "MAT", "Maths" and
 * "Mathematics" all find the same subject.
 *
 * Patterns as of the 2025 exam cycle:
 *  - JEE Main (Paper 1): Physics, Chemistry, Mathematics — 25 questions × 4 marks = 100 each, 300 total.
 *  - NEET UG: Physics 45 Q and Chemistry 45 Q (180 each), Biology 90 Q (Botany + Zoology, 360) — 720 total.
 *  - K-CET: four separately timed papers of 60 one-mark questions each — 240 total.
 *    Biology is the last paper, so stepping No. of Papers down to 3 leaves the PCM engineering set.
 */

export type PresetSubject = "Physics" | "Chemistry" | "Mathematics" | "Biology";

export type ExamPreset = {
  key: string;
  label: string;
  summary: string;
  numPapers: number;
  numSubjects: number;
  totalMarks: number;
  /** [paper][subject slot] */
  slots: { subject: PresetSubject; maxMarks: number }[][];
};

const SUBJECT_ALIASES: Record<PresetSubject, string[]> = {
  Physics:     ["physics", "phy", "phys"],
  Chemistry:   ["chemistry", "che", "chem"],
  Mathematics: ["mathematics", "maths", "math", "mat"],
  Biology:     ["biology", "bio"],
};

export const EXAM_PRESETS: ExamPreset[] = [
  {
    key: "jee-main", label: "JEE Main", summary: "Physics, Chemistry, Maths · 100 each · 300",
    numPapers: 1, numSubjects: 3, totalMarks: 300,
    slots: [[
      { subject: "Physics",     maxMarks: 100 },
      { subject: "Chemistry",   maxMarks: 100 },
      { subject: "Mathematics", maxMarks: 100 },
    ]],
  },
  {
    key: "neet", label: "NEET", summary: "Physics 180, Chemistry 180, Biology 360 · 720",
    numPapers: 1, numSubjects: 3, totalMarks: 720,
    slots: [[
      { subject: "Physics",   maxMarks: 180 },
      { subject: "Chemistry", maxMarks: 180 },
      { subject: "Biology",   maxMarks: 360 },
    ]],
  },
  {
    key: "k-cet", label: "K-CET", summary: "4 papers · Physics, Chemistry, Maths, Biology · 60 each · 240",
    numPapers: 4, numSubjects: 1, totalMarks: 240,
    slots: [
      [{ subject: "Physics",     maxMarks: 60 }],
      [{ subject: "Chemistry",   maxMarks: 60 }],
      [{ subject: "Mathematics", maxMarks: 60 }],
      [{ subject: "Biology",     maxMarks: 60 }],
    ],
  },
];

export function resolveSubjectId(subject: PresetSubject, subjects: { id: string; code?: string | null; name?: string | null }[]) {
  const aliases = SUBJECT_ALIASES[subject];
  const norm = (v?: string | null) => (v ?? "").trim().toLowerCase();
  return subjects.find((s) => aliases.includes(norm(s.code)) || aliases.includes(norm(s.name)))?.id ?? null;
}

export const PRESET_LABELS = EXAM_PRESETS.map((p) => p.label.toLowerCase());
