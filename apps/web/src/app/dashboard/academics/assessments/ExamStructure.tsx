"use client";

/**
 * The paper → sections → subjects → question-range editor on the New Exam form,
 * plus the conversions between its string-typed form state and ExamLayout.
 *
 * The API derives the marks slots (ExamSubject rows) from the layout: one per
 * distinct subject within a paper, max marks = Σ questions × marks.
 */
import { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight, X } from "lucide-react";
import type { ExamLayout, QuestionType } from "@cadb/types";
import { D, DInput, DSelect, TopicsInput } from "./formKit";
import { resolveSubjectId, type PresetLayout } from "./examPresets";

export const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: "SCQ",        label: "SCQ (single correct)" },
  { value: "MCQ",        label: "MCQ (multiple correct)" },
  { value: "NAT",        label: "NAT (numerical)" },
  { value: "INTEGER",    label: "Integer" },
  { value: "MATRIX",     label: "Matrix match" },
  { value: "ASSERTION",  label: "Assertion–reason" },
  { value: "PARAGRAPH",  label: "Paragraph / comprehension" },
  { value: "SUBJECTIVE", label: "Subjective" },
];

// ── Form state (strings, so half-typed numbers survive) ──────────────────────
export type RangeF   = { from: string; to: string; type: QuestionType; marks: string; negative: string };
export type SubjectF = { subjectId: string; topics: string[]; maxMarks: string; ranges: RangeF[] };
export type SectionF = { name: string; subjects: SubjectF[] };
export type PaperF   = { sections: SectionF[]; collapsed?: boolean };

const num = (v: string | number | null | undefined) => (v == null || String(v).trim() === "" ? NaN : Number(v));
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, ""));
export const sectionName = (i: number) => `Section ${String.fromCharCode(65 + i)}`;

export function rangeCount(r: RangeF) {
  const f = num(r.from), t = num(r.to);
  return Number.isInteger(f) && Number.isInteger(t) && t >= f ? t - f + 1 : 0;
}
export function subjectMax(s: SubjectF): number | null {
  if (s.ranges.length === 0) { const m = num(s.maxMarks); return isNaN(m) ? null : m; }
  return s.ranges.reduce((n, r) => n + rangeCount(r) * (num(r.marks) || 0), 0);
}
function sectionTotals(sec: SectionF) {
  return {
    questions: sec.subjects.reduce((n, s) => n + s.ranges.reduce((m, r) => m + rangeCount(r), 0), 0),
    marks:     sec.subjects.reduce((n, s) => n + (subjectMax(s) ?? 0), 0),
  };
}
function paperTotals(p: PaperF) {
  const t = p.sections.map(sectionTotals);
  return {
    questions: t.reduce((n, x) => n + x.questions, 0),
    marks:     t.reduce((n, x) => n + x.marks, 0),
    subjects:  p.sections.reduce((n, s) => n + s.subjects.length, 0),
  };
}
export function structureTotals(papers: PaperF[]) {
  const t = papers.map(paperTotals);
  return { questions: t.reduce((n, x) => n + x.questions, 0), marks: t.reduce((n, x) => n + x.marks, 0) };
}

const lastQ = (ranges: RangeF[]) => ranges.reduce((m, r) => Math.max(m, Number.isFinite(num(r.to)) ? num(r.to) : 0), 0);
const sectionLastQ = (sec: SectionF) => lastQ(sec.subjects.flatMap((s) => s.ranges));
const paperLastQ = (p: PaperF) => Math.max(0, ...p.sections.map(sectionLastQ));

/** A new range carries on from the last question and copies the previous range's type and marks. */
function newRange(from: number, like?: RangeF): RangeF {
  return { from: String(from), to: "", type: like?.type ?? "SCQ", marks: like?.marks ?? "", negative: like?.negative ?? "0" };
}
const emptySubject = (startQ = 1, like?: RangeF): SubjectF => ({ subjectId: "", topics: [], maxMarks: "", ranges: [newRange(startQ, like)] });
const emptySection = (i: number, startQ = 1): SectionF => ({ name: sectionName(i), subjects: [emptySubject(startQ)] });
export const emptyPaper = (): PaperF => ({ sections: [emptySection(0)] });

// ── Conversions ───────────────────────────────────────────────────────────────
export function papersToLayout(papers: PaperF[]): ExamLayout {
  return {
    papers: papers.map((p) => ({
      sections: p.sections.map((sec, si) => ({
        name: sec.name.trim() || sectionName(si),
        subjects: sec.subjects.map((sub) => ({
          subjectId: sub.subjectId || null,
          topics: sub.topics.length ? sub.topics.join(", ") : null,
          maxMarks: sub.ranges.length ? null : (isNaN(num(sub.maxMarks)) ? null : num(sub.maxMarks)),
          ranges: sub.ranges.map((r) => ({
            from: num(r.from), to: num(r.to), type: r.type, marks: num(r.marks), negative: num(r.negative) || 0,
          })),
        })),
      })),
    })),
  };
}

/** `isActive` blanks subjects deactivated since the layout was saved (they're not in the dropdown). */
export function layoutToPapers(layout: ExamLayout, isActive: (id: string) => boolean = () => true): PaperF[] {
  return layout.papers.map((p) => ({
    sections: p.sections.map((sec) => ({
      name: sec.name,
      subjects: sec.subjects.map((sub) => ({
        subjectId: sub.subjectId && isActive(sub.subjectId) ? sub.subjectId : "",
        topics: sub.topics ? sub.topics.split(",").map((t) => t.trim()).filter(Boolean) : [],
        maxMarks: sub.maxMarks != null ? String(sub.maxMarks) : "",
        ranges: sub.ranges.map((r) => ({
          from: String(r.from), to: String(r.to), type: r.type, marks: String(r.marks), negative: String(r.negative ?? 0),
        })),
      })),
    })),
  }));
}

/** Exams and templates saved before layouts: one section per paper, subjects with a plain max-marks figure. */
export function legacyPapers(
  rows: { paperNum: number; subjectSlot: number; subjectId: string | null; topics?: string | null; maxMarks: number | null }[],
  numPapers: number, isActive: (id: string) => boolean = () => true,
): PaperF[] {
  return Array.from({ length: Math.max(1, numPapers) }, (_, pi) => {
    const subs = rows.filter((r) => r.paperNum === pi + 1).sort((a, b) => a.subjectSlot - b.subjectSlot);
    return {
      sections: [{
        name: sectionName(0),
        subjects: subs.length
          ? subs.map((r) => ({
              subjectId: r.subjectId && isActive(r.subjectId) ? r.subjectId : "",
              topics: r.topics ? r.topics.split(",").map((t) => t.trim()).filter(Boolean) : [],
              maxMarks: r.maxMarks != null ? String(r.maxMarks) : "",
              ranges: [],
            }))
          : [emptySubject()],
      }],
    };
  });
}

export function presetToLayout(preset: PresetLayout, subjects: any[]): { layout: ExamLayout; missing: string[] } {
  const missing = new Set<string>();
  const layout: ExamLayout = {
    papers: preset.papers.map((p) => ({
      sections: p.sections.map((sec) => ({
        name: sec.name,
        subjects: sec.subjects.map((s) => {
          const subjectId = resolveSubjectId(s.subject, subjects);
          if (!subjectId) missing.add(s.subject);
          return { subjectId, topics: null, maxMarks: null, ranges: s.ranges.map((r) => ({ ...r })) };
        }),
      })),
    })),
  };
  return { layout, missing: [...missing] };
}

/** First problem found, worded for a toast — or null when the structure is valid. */
export function validatePapers(papers: PaperF[], subjects: any[]): string | null {
  const subjName = (id: string, i: number) => subjects.find((s) => s.id === id)?.name ?? `Subject ${i + 1}`;
  for (const [pi, p] of papers.entries()) {
    for (const [si, sec] of p.sections.entries()) {
      const where = `Paper ${pi + 1} · ${sec.name.trim() || sectionName(si)}`;
      const seen: { from: number; to: number }[] = [];
      for (const [ui, sub] of sec.subjects.entries()) {
        const at = `${where} · ${subjName(sub.subjectId, ui)}`;
        if (sub.ranges.length === 0 && sub.maxMarks && !(num(sub.maxMarks) >= 0)) return `${at}: max marks must be a number`;
        for (const r of sub.ranges) {
          const f = num(r.from), t = num(r.to);
          if (!Number.isInteger(f) || f < 1)  return `${at}: enter the first question number of every range`;
          if (!Number.isInteger(t) || t < 1)  return `${at}: enter the last question number of Q${f}–…`;
          if (t < f)                          return `${at}: Q${f}–${t} ends before it starts`;
          if (!(num(r.marks) > 0))            return `${at}: enter the marks per question for Q${f}–${t}`;
          if (!(num(r.negative || "0") >= 0)) return `${at}: negative marks for Q${f}–${t} are entered as a positive number (e.g. 1)`;
          const clash = seen.find((x) => f <= x.to && t >= x.from);
          if (clash) return `${where}: Q${f}–${t} overlaps Q${clash.from}–${clash.to}`;
          seen.push({ from: f, to: t });
        }
      }
    }
  }
  return null;
}

// ── Editor ────────────────────────────────────────────────────────────────────
const sm: React.CSSProperties = { minHeight: 36, padding: "6px 10px", fontSize: 13, borderRadius: 10 };
const miniLabel = "sm:hidden block mb-1 text-[11px] font-extrabold uppercase tracking-wide text-gray-500";
const RANGE_GRID = "grid grid-cols-2 sm:grid-cols-[150px_minmax(0,1fr)_76px_76px_32px] gap-2 items-end";

function AddBtn({ children, onClick, strong }: { children: React.ReactNode; onClick: () => void; strong?: boolean }) {
  return (
    <button type="button" onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", font: "inherit",
        fontSize: 13, fontWeight: 800, color: "#4f46e5", borderRadius: 10,
        padding: strong ? "8px 14px" : "4px 2px",
        border: strong ? "1px dashed #a5b4fc" : "none", background: strong ? "#f5f7ff" : "none",
      }}>
      <Plus style={{ width: 14, height: 14 }} />{children}
    </button>
  );
}

function RemoveBtn({ label, onClick, size = 15 }: { label: string; onClick: () => void; size?: number }) {
  return (
    <button type="button" onClick={onClick} title={label} aria-label={label}
      style={{ border: "none", background: "none", cursor: "pointer", color: "#ef4444", padding: 6, display: "flex", borderRadius: 8 }}>
      <Trash2 style={{ width: size, height: size }} />
    </button>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <span style={{ fontSize: 13, fontWeight: 850, color: "#4b5563" }}>
      {label}: <strong style={{ color: D.nav2 }}>{value}</strong>
    </span>
  );
}

export function StructureEditor({ papers, onChange, subjects }: {
  papers: PaperF[]; onChange: (p: PaperF[]) => void; subjects: any[];
}) {
  // Every edit clones the tree and mutates the copy — the nesting is too deep
  // for spread-based updates to stay readable.
  const edit = (fn: (draft: PaperF[]) => void) => { const d = structuredClone(papers); fn(d); onChange(d); };
  const totals = structureTotals(papers);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <Count label="Number of Papers" value={papers.length} />
        <span style={{ fontSize: 13, fontWeight: 750, color: D.muted }}>
          {totals.questions} questions · <strong style={{ color: D.nav2 }}>{fmt(totals.marks)} marks</strong>
        </span>
      </div>

      {papers.map((paper, pi) => {
        const t = paperTotals(paper);
        return (
          <div key={pi} style={{ border: `1px solid ${D.line}`, borderRadius: 14, background: "white" }}>
            {/* Paper header — click to collapse */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderBottom: paper.collapsed ? "none" : `1px solid ${D.line}` }}>
              <button type="button" onClick={() => edit((d) => { d[pi].collapsed = !d[pi].collapsed; })}
                aria-expanded={!paper.collapsed}
                style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8, border: "none", background: "none", cursor: "pointer", font: "inherit", textAlign: "left", padding: 0 }}>
                {paper.collapsed ? <ChevronRight style={{ width: 16, height: 16, color: D.muted, flexShrink: 0 }} /> : <ChevronDown style={{ width: 16, height: 16, color: D.muted, flexShrink: 0 }} />}
                <span style={{ fontSize: 13, fontWeight: 900, color: "#4f46e5", textTransform: "uppercase", letterSpacing: ".06em", flexShrink: 0 }}>Paper {pi + 1}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: D.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {paper.sections.length} section{paper.sections.length === 1 ? "" : "s"} · {t.subjects} subject{t.subjects === 1 ? "" : "s"} · {t.questions} Q · {fmt(t.marks)} marks
                </span>
              </button>
              {papers.length > 1 && (
                <RemoveBtn label={`Remove paper ${pi + 1}`} onClick={() => {
                  if (t.questions > 0 && !confirm(`Remove Paper ${pi + 1} and everything in it?`)) return;
                  edit((d) => { d.splice(pi, 1); });
                }} />
              )}
            </div>

            {!paper.collapsed && (
              <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
                <Count label="Number of Sections" value={paper.sections.length} />

                {paper.sections.map((sec, si) => (
                  <div key={si} style={{ border: `1px solid ${D.line}`, borderRadius: 12, background: "#fbfcfe", padding: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <DInput aria-label={`Paper ${pi + 1} section ${si + 1} name`} value={sec.name} maxLength={40} placeholder={sectionName(si)}
                        onChange={(e) => edit((d) => { d[pi].sections[si].name = e.target.value; })}
                        style={{ ...sm, fontWeight: 800, maxWidth: 220, minWidth: 0, flex: "1 1 120px" }} />
                      <span style={{ flex: "0 1 auto", marginLeft: "auto", fontSize: 12, fontWeight: 700, color: D.muted, textAlign: "right", whiteSpace: "nowrap" }}>
                        {sectionTotals(sec).questions} Q · {fmt(sectionTotals(sec).marks)} marks
                      </span>
                      {paper.sections.length > 1 && (
                        <RemoveBtn label={`Remove ${sec.name || sectionName(si)}`} onClick={() => edit((d) => { d[pi].sections.splice(si, 1); })} />
                      )}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {sec.subjects.map((sub, ui) => (
                        <SubjectBlock key={ui} sub={sub} subjects={subjects}
                          canRemove={sec.subjects.length > 1}
                          onRemove={() => edit((d) => { d[pi].sections[si].subjects.splice(ui, 1); })}
                          onEdit={(fn) => edit((d) => fn(d[pi].sections[si].subjects[ui]))}
                          nextQ={() => sectionLastQ(sec) + 1} />
                      ))}
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <AddBtn onClick={() => edit((d) => {
                        const s = d[pi].sections[si];
                        const prev = s.subjects.at(-1)?.ranges.at(-1);
                        s.subjects.push(emptySubject(sectionLastQ(s) + 1, prev));
                      })}>Add Subject</AddBtn>
                    </div>
                  </div>
                ))}

                <div>
                  <AddBtn strong onClick={() => edit((d) => {
                    d[pi].sections.push(emptySection(d[pi].sections.length, paperLastQ(d[pi]) + 1));
                  })}>Add Section</AddBtn>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <div>
        <AddBtn strong onClick={() => edit((d) => { d.forEach((p) => { p.collapsed = true; }); d.push(emptyPaper()); })}>Add Paper</AddBtn>
      </div>
    </div>
  );
}

function SubjectBlock({ sub, subjects, canRemove, onRemove, onEdit, nextQ }: {
  sub: SubjectF; subjects: any[]; canRemove: boolean; onRemove: () => void;
  onEdit: (fn: (s: SubjectF) => void) => void; nextQ: () => number;
}) {
  const [topicsOpen, setTopicsOpen] = useState(sub.topics.length > 0);
  const max = subjectMax(sub);
  const questions = sub.ranges.reduce((n, r) => n + rangeCount(r), 0);

  return (
    <div style={{ border: `1px solid ${D.line}`, borderRadius: 12, background: "white", padding: 10 }}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 items-center">
        <DSelect aria-label="Subject" value={sub.subjectId} onChange={(e) => onEdit((s) => { s.subjectId = e.target.value; })} style={sm}>
          <option value="">Select subject</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </DSelect>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {sub.ranges.length === 0 ? (
            <DInput aria-label="Max marks" type="number" min={0} placeholder="Max" value={sub.maxMarks}
              onChange={(e) => onEdit((s) => { s.maxMarks = e.target.value; })} style={{ ...sm, width: 84 }} />
          ) : (
            <span style={{ fontSize: 12, fontWeight: 800, color: D.nav2, whiteSpace: "nowrap", padding: "0 4px" }}>
              {questions} Q · {fmt(max ?? 0)} marks
            </span>
          )}
          {canRemove && <RemoveBtn label="Remove subject" onClick={onRemove} />}
        </div>
      </div>

      {sub.ranges.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div className={`hidden sm:grid ${RANGE_GRID}`} style={{ marginBottom: 4 }}>
            {["Questions", "Type", "Marks", "Negative", ""].map((h) => (
              <span key={h} style={{ fontSize: 11, fontWeight: 800, color: D.muted, textTransform: "uppercase", letterSpacing: ".05em" }}>{h}</span>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {sub.ranges.map((r, ri) => {
              const set = (patch: Partial<RangeF>) => onEdit((s) => { Object.assign(s.ranges[ri], patch); });
              const bad = r.from && r.to && num(r.to) < num(r.from);
              return (
                <div key={ri} className={RANGE_GRID} style={ri > 0 ? { paddingTop: 8, borderTop: `1px dashed ${D.line}` } : undefined}>
                  <div className="col-span-2 sm:col-span-1">
                    <span className={miniLabel}>Questions</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: D.muted }}>Q</span>
                      <DInput aria-label="From question" type="number" min={1} value={r.from} onChange={(e) => set({ from: e.target.value })}
                        style={{ ...sm, padding: "6px 6px", textAlign: "center", ...(bad ? { borderColor: "#ef4444" } : {}) }} />
                      <span style={{ color: D.muted }}>–</span>
                      <DInput aria-label="To question" type="number" min={1} placeholder="n" value={r.to} onChange={(e) => set({ to: e.target.value })}
                        style={{ ...sm, padding: "6px 6px", textAlign: "center", ...(bad ? { borderColor: "#ef4444" } : {}) }} />
                    </div>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <span className={miniLabel}>Type</span>
                    <DSelect aria-label="Question type" value={r.type} onChange={(e) => set({ type: e.target.value as QuestionType })} style={sm}>
                      {QUESTION_TYPES.map((q) => <option key={q.value} value={q.value}>{q.label}</option>)}
                    </DSelect>
                  </div>
                  <div>
                    <span className={miniLabel}>Marks</span>
                    <DInput aria-label="Marks per question" type="number" min={0} step="any" placeholder="+4" value={r.marks}
                      onChange={(e) => set({ marks: e.target.value })} style={sm} />
                  </div>
                  <div>
                    <span className={miniLabel}>Negative</span>
                    <DInput aria-label="Negative marks per wrong answer" type="number" min={0} step="any" placeholder="0" value={r.negative}
                      onChange={(e) => set({ negative: e.target.value.replace("-", "") })} style={sm} />
                  </div>
                  <div className="col-span-2 sm:col-span-1 flex justify-end">
                    <button type="button" aria-label="Remove range" title="Remove range"
                      onClick={() => onEdit((s) => { s.ranges.splice(ri, 1); })}
                      style={{ border: "none", background: "none", cursor: "pointer", color: "#9aa3b4", padding: 6, display: "flex" }}>
                      <X style={{ width: 15, height: 15 }} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 8 }}>
        <AddBtn onClick={() => onEdit((s) => { s.ranges.push(newRange(s.ranges.length ? lastQ(s.ranges) + 1 : nextQ(), s.ranges.at(-1))); })}>
          {sub.ranges.length ? "Add another range" : "Add question range"}
        </AddBtn>
        <button type="button" onClick={() => setTopicsOpen((v) => !v)}
          style={{ border: "none", background: "none", cursor: "pointer", font: "inherit", fontSize: 13, fontWeight: 700, color: D.muted, padding: "4px 2px" }}>
          {topicsOpen ? "Hide topics" : `Topics${sub.topics.length ? ` (${sub.topics.length})` : ""}`}
        </button>
      </div>
      {topicsOpen && (
        <div style={{ marginTop: 8 }}>
          <TopicsInput topics={sub.topics} onChange={(t) => onEdit((s) => { s.topics = t; })} />
        </div>
      )}
    </div>
  );
}
