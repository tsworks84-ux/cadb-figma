/**
 * Built-in exam patterns offered on the New Exam form, as full layouts
 * (paper → sections → subjects → question ranges).
 *
 * Subjects are named, not referenced by id, because every install creates its
 * own Subject rows under Academics → Settings. `resolveSubjectId` matches a
 * preset subject to one of those rows by code or name, so "MAT", "Maths" and
 * "Mathematics" all find the same subject.
 *
 * Patterns as of the 2025 exam cycle:
 *  - JEE Main (Paper 1): per subject, Section A = 20 SCQ and Section B = 5 NAT,
 *    all +4 / −1 — 100 per subject, 300 total, Q1–75.
 *  - NEET UG: 180 SCQ, +4 / −1 — Physics Q1–45, Chemistry Q46–90, Biology
 *    (Botany + Zoology) Q91–180 — 720 total.
 *  - K-CET: four separately timed papers of 60 one-mark SCQ, no negative marking.
 *    Biology is the last paper, so removing it leaves the PCM engineering set.
 */
import type { QuestionType } from "@cadb/types";

export type PresetSubject = "Physics" | "Chemistry" | "Mathematics" | "Biology";

type PresetRange = { from: number; to: number; type: QuestionType; marks: number; negative: number };
export type PresetLayout = {
  papers: { sections: { name: string; subjects: { subject: PresetSubject; ranges: PresetRange[] }[] }[] }[];
};

export type ExamPreset = { key: string; label: string; summary: string; layout: PresetLayout };

const SUBJECT_ALIASES: Record<PresetSubject, string[]> = {
  Physics:     ["physics", "phy", "phys"],
  Chemistry:   ["chemistry", "che", "chem"],
  Mathematics: ["mathematics", "maths", "math", "mat"],
  Biology:     ["biology", "bio"],
};

const scq = (from: number, to: number, marks: number, negative: number): PresetRange => ({ from, to, type: "SCQ", marks, negative });
const nat = (from: number, to: number, marks: number, negative: number): PresetRange => ({ from, to, type: "NAT", marks, negative });

export const EXAM_PRESETS: ExamPreset[] = [
  {
    key: "jee-main", label: "JEE Main", summary: "Sec A 20 SCQ + Sec B 5 NAT per subject · +4/−1 · 300",
    layout: { papers: [{ sections: [
      { name: "Section A", subjects: [
        { subject: "Physics",     ranges: [scq(1, 20, 4, 1)] },
        { subject: "Chemistry",   ranges: [scq(26, 45, 4, 1)] },
        { subject: "Mathematics", ranges: [scq(51, 70, 4, 1)] },
      ] },
      { name: "Section B", subjects: [
        { subject: "Physics",     ranges: [nat(21, 25, 4, 1)] },
        { subject: "Chemistry",   ranges: [nat(46, 50, 4, 1)] },
        { subject: "Mathematics", ranges: [nat(71, 75, 4, 1)] },
      ] },
    ] }] },
  },
  {
    key: "neet", label: "NEET", summary: "180 SCQ · +4/−1 · Physics 180, Chemistry 180, Biology 360 · 720",
    layout: { papers: [{ sections: [
      { name: "Section A", subjects: [
        { subject: "Physics",   ranges: [scq(1, 45, 4, 1)] },
        { subject: "Chemistry", ranges: [scq(46, 90, 4, 1)] },
        { subject: "Biology",   ranges: [scq(91, 180, 4, 1)] },
      ] },
    ] }] },
  },
  {
    key: "k-cet", label: "K-CET", summary: "4 papers × 60 SCQ · +1, no negative · 240",
    layout: {
      papers: (["Physics", "Chemistry", "Mathematics", "Biology"] as PresetSubject[]).map((subject) => ({
        sections: [{ name: "Section A", subjects: [{ subject, ranges: [scq(1, 60, 1, 0)] }] }],
      })),
    },
  },
];

export function resolveSubjectId(subject: PresetSubject, subjects: { id: string; code?: string | null; name?: string | null }[]) {
  const aliases = SUBJECT_ALIASES[subject];
  const norm = (v?: string | null) => (v ?? "").trim().toLowerCase();
  return subjects.find((s) => aliases.includes(norm(s.code)) || aliases.includes(norm(s.name)))?.id ?? null;
}

export const PRESET_LABELS = EXAM_PRESETS.map((p) => p.label.toLowerCase());
