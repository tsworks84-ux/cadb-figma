"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  Plus, Minus, X, Calendar, ChevronDown, Loader2,
  Trash2, Clock, BookOpen, FileCheck2, Pencil, Archive, ArchiveRestore,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { usePermissions } from "@/hooks/usePermissions";
import { hasAcademicsAction } from "@/lib/academicsAccess";
import { useRouter, useSearchParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import { AssessmentStatsPanel } from "./StatsPanel";

// ── Design tokens ─────────────────────────────────────────────────────────────
const D = { line: "#e6e8ef", muted: "#7c8598", ink: "#111827", nav2: "#28245f", bg: "#f4f6fa" };

const inputBase: React.CSSProperties = {
  width: "100%", minHeight: 42, border: `1px solid ${D.line}`,
  borderRadius: 12, padding: "9px 12px", background: "white",
  color: D.ink, font: "inherit", fontSize: 14, outline: "none", boxSizing: "border-box",
};

// ── Primitives ────────────────────────────────────────────────────────────────
function DInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={{ ...inputBase, ...props.style }} />;
}
function DSelect({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} style={{ ...inputBase, ...props.style }}>{children}</select>;
}
function DTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} style={{ ...inputBase, minHeight: 88, resize: "vertical", ...props.style }} />;
}
function DBtn({ primary, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }) {
  return (
    <button {...props} style={{
      minHeight: 42, border: 0, borderRadius: 12, padding: "0 20px",
      font: "inherit", fontWeight: 850, cursor: props.disabled ? "not-allowed" : "pointer",
      ...(primary
        ? { background: "linear-gradient(135deg, #28245f, #4f46e5)", color: "white", boxShadow: "0 12px 24px rgba(79,70,229,.24)" }
        : { background: "white", color: "#374151", boxShadow: `inset 0 0 0 1px ${D.line}` }),
      opacity: props.disabled ? 0.6 : 1, ...props.style,
    }}>{children}</button>
  );
}
function DField({ label, req, children }: { label: string; req?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gap: 7 }}>
      <label style={{ color: "#4b5563", fontSize: 13, fontWeight: 850 }}>
        {label}{req && <span style={{ color: "#ef4444" }}> *</span>}
      </label>
      {children}
    </div>
  );
}
function SCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ border: `1px solid ${D.line}`, borderRadius: 16, padding: 18, background: "#fbfcfe" }}>
      <h2 style={{ margin: "0 0 14px", fontSize: 17, fontWeight: 800 }}>{title}</h2>
      {children}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(iso: string) { try { return format(parseISO(iso), "dd MMM yyyy"); } catch { return iso; } }
function todayStr() { return new Date().toISOString().split("T")[0]; }

const TIME_SLOTS = (() => {
  const slots: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      const hour = h % 12 === 0 ? 12 : h % 12;
      slots.push(`${hour}:${m === 0 ? "00" : "30"} ${h < 12 ? "AM" : "PM"}`);
    }
  }
  return slots;
})();

const STATUS_LABEL: Record<string, string> = {
  DUE: "Due", COMPLETED: "Completed", MARKED: "Marked", CANCELLED: "Cancelled", ARCHIVED: "Archived",
};

function StatusBadge({ status }: { status: string }) {
  const s: Record<string, React.CSSProperties> = {
    DUE:       { background: "#fffbeb", color: "#b45309", border: "1px solid #fde68a" },
    COMPLETED: { background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0" },
    MARKED:    { background: "#eef2ff", color: "#4338ca", border: "1px solid #c7d2fe" },
    CANCELLED: { background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" },
    ARCHIVED:  { background: "#f1f5f9", color: "#64748b", border: "1px solid #e2e8f0" },
  };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, padding: "2px 10px", fontSize: 12, fontWeight: 700, ...(s[status] ?? { background: "#f1f5f9", color: "#64748b" }) }}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

// ── TopicsInput ───────────────────────────────────────────────────────────────
function TopicsInput({ topics, onChange }: { topics: string[]; onChange: (t: string[]) => void }) {
  const [input, setInput] = useState("");
  const add = () => {
    const t = input.trim();
    if (t && !topics.includes(t)) onChange([...topics, t]);
    setInput("");
  };
  return (
    <div>
      <div style={{ minHeight: 42, border: `1px solid ${D.line}`, borderRadius: 12, padding: "8px 12px", background: "white", display: "flex", flexWrap: "wrap", gap: 6 }}>
        {topics.length === 0 && <span style={{ color: D.muted, fontSize: 13, alignSelf: "center" }}>No topics added</span>}
        {topics.map((t) => (
          <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 4, borderRadius: 999, background: "#eef2ff", border: "1px solid #c7d2fe", padding: "2px 10px", fontSize: 12, fontWeight: 700, color: "#4338ca" }}>
            {t}
            <button type="button" onClick={() => onChange(topics.filter((x) => x !== t))} style={{ border: "none", background: "none", cursor: "pointer", color: "#a5b4fc", padding: 0, display: "flex" }}>
              <X style={{ width: 10, height: 10 }} />
            </button>
          </span>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 10, marginTop: 10 }}>
        <DInput placeholder="Type a topic and press Add…" value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <DBtn type="button" onClick={add} style={{ padding: "0 16px" }}>+ Add</DBtn>
      </div>
    </div>
  );
}

// ── BatchMultiSelect ──────────────────────────────────────────────────────────
function BatchMultiSelect({ batches, selected, onChange }: {
  batches: any[]; selected: string[]; onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  const toggle = (id: string) =>
    selected.includes(id) ? onChange(selected.filter((x) => x !== id)) : onChange([...selected, id]);
  const names = batches.filter((b) => selected.includes(b.id)).map((b) => b.name).join(", ");
  return (
    <div style={{ position: "relative" }} ref={ref}>
      <button type="button" onClick={() => setOpen((v) => !v)}
        style={{ ...inputBase, display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, textAlign: "left", color: selected.length === 0 ? D.muted : D.ink }}>
          {selected.length === 0 ? "Select batches…" : names}
        </span>
        <ChevronDown style={{ width: 16, height: 16, color: D.muted, flexShrink: 0, marginLeft: 6, transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
      </button>
      {open && (
        <div style={{ position: "absolute", zIndex: 50, top: "100%", marginTop: 4, width: "100%", background: "white", border: `1px solid ${D.line}`, borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,.12)" }}>
          <div style={{ maxHeight: 200, overflowY: "auto" }}>
            {batches.length === 0 && <p style={{ padding: "10px 14px", fontSize: 13, color: D.muted }}>No batches for this year</p>}
            {batches.map((b) => (
              <label key={b.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", cursor: "pointer", fontSize: 14 }}>
                <input type="checkbox" checked={selected.includes(b.id)} onChange={() => toggle(b.id)} style={{ accentColor: "#4f46e5" }} />
                <span style={{ color: D.ink }}>{b.name}</span>
                {b.grade && <span style={{ marginLeft: "auto", fontSize: 12, color: D.muted, flexShrink: 0 }}>{b.grade.name}</span>}
              </label>
            ))}
          </div>
          <div style={{ borderTop: `1px solid ${D.line}`, padding: "8px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, color: D.muted }}>{selected.length} selected</span>
            <button type="button" onClick={() => setOpen(false)} style={{ border: "none", background: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, color: "#4f46e5" }}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Stepper ───────────────────────────────────────────────────────────────────
function Stepper({ value, min, max, onChange, label }: {
  value: number; min: number; max: number; label: string; onChange: (n: number) => void;
}) {
  return (
    <div>
      <label style={{ color: "#4b5563", fontSize: 13, fontWeight: 850 }}>{label}</label>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
        <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}
          style={{ width: 42, height: 42, border: `1px solid ${D.line}`, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: "white", cursor: value <= min ? "not-allowed" : "pointer", opacity: value <= min ? 0.3 : 1 }}>
          <Minus style={{ width: 16, height: 16 }} />
        </button>
        <strong style={{ fontSize: 22, minWidth: 34, textAlign: "center" }}>{value}</strong>
        <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max}
          style={{ width: 42, height: 42, border: `1px solid ${D.line}`, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: "white", cursor: value >= max ? "not-allowed" : "pointer", opacity: value >= max ? 0.3 : 1 }}>
          <Plus style={{ width: 16, height: 16 }} />
        </button>
      </div>
      <div style={{ marginTop: 8, color: D.muted, fontSize: 13, fontWeight: 850 }}>
        {value} {label.toLowerCase().includes("paper") ? (value === 1 ? "paper" : "papers") : (value === 1 ? "subject" : "subjects")}
      </div>
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────
type SubjectSlot = { subjectId: string; topics: string[]; maxMarks: string };
function resizePS(ps: SubjectSlot[][], np: number, ns: number): SubjectSlot[][] {
  return Array.from({ length: np }, (_, pi) =>
    Array.from({ length: ns }, (_, si) => ps[pi]?.[si] ?? { subjectId: "", topics: [], maxMarks: "" })
  );
}
type ExamForm = {
  academicYear: string; name: string;
  numPapers: number; numSubjects: number; batchIds: string[];
  paperSubjects: SubjectSlot[][];
  examDate: string; startTime: string; endTime: string;
  totalMarks: string; note: string;
};
function emptyForm(defaultYear = ""): ExamForm {
  return {
    academicYear: defaultYear, name: "",
    numPapers: 1, numSubjects: 1, batchIds: [],
    paperSubjects: [[{ subjectId: "", topics: [], maxMarks: "" }]],
    examDate: todayStr(), startTime: "9:00 AM", endTime: "10:00 AM",
    totalMarks: "", note: "",
  };
}

// ── ExamModal ─────────────────────────────────────────────────────────────────
function ExamModal({ open, onClose, initial, examId, batches, subjects, academicYears, defaultYear }: {
  open: boolean; onClose: () => void; initial?: ExamForm; examId?: string;
  batches: any[]; subjects: any[]; academicYears: any[]; defaultYear: string;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<ExamForm>(initial ?? emptyForm(defaultYear));
  useEffect(() => { if (open) setForm(initial ?? emptyForm(defaultYear)); }, [open]); // eslint-disable-line

  const filteredBatches = form.academicYear ? batches.filter((b) => b.academicYear === form.academicYear) : batches;
  const timeError = !!(form.startTime && form.endTime && form.startTime === form.endTime);

  const createMut = useMutation({
    mutationFn: (d: any) => api.post("/api/v1/academics/assessments", d).then((r) => r.data),
    onSuccess: (res) => { if (!res.success) { toast.error(res.error); return; } qc.invalidateQueries({ queryKey: ["assessments"] }); toast.success("Assessment created"); },
  });
  const updateMut = useMutation({
    mutationFn: (d: any) => api.patch(`/api/v1/academics/assessments/${examId}`, d).then((r) => r.data),
    onSuccess: (res) => { if (!res.success) { toast.error(res.error); return; } qc.invalidateQueries({ queryKey: ["assessments"] }); toast.success("Assessment updated"); onClose(); },
  });
  const busy = createMut.isPending || updateMut.isPending;

  const buildPayload = () => {
    if (!form.academicYear)           { toast.error("Academic year is required");   return null; }
    if (!form.name.trim())            { toast.error("Test name is required");       return null; }
    if (form.name.trim().length > 40) { toast.error("Name cannot exceed 40 chars"); return null; }
    if (!form.examDate)               { toast.error("Date is required");            return null; }
    if (!form.startTime)              { toast.error("Start time is required");      return null; }
    if (!form.endTime)                { toast.error("End time is required");        return null; }
    if (form.batchIds.length === 0)   { toast.error("Select at least one batch");   return null; }
    return {
      academicYear: form.academicYear, name: form.name.trim(),
      numPapers: form.numPapers, numSubjects: form.numSubjects, batchIds: form.batchIds,
      paperSubjects: form.paperSubjects.map((paper) =>
        paper.map((slot) => ({
          subjectId: slot.subjectId || null,
          topics: slot.topics.length > 0 ? slot.topics.join(", ") : null,
          maxMarks: slot.maxMarks ? parseFloat(slot.maxMarks) : null,
        }))
      ),
      examDate: new Date(form.examDate).toISOString(),
      startTime: form.startTime, endTime: form.endTime,
      totalMarks: form.totalMarks ? parseInt(form.totalMarks) : null,
      note: form.note.trim() || null,
    };
  };

  const handleSave = () => {
    const p = buildPayload(); if (!p) return;
    if (examId) updateMut.mutate(p);
    else createMut.mutate(p, { onSuccess: (res) => { if (res.success) onClose(); } });
  };
  const handleSaveAnother = () => {
    const p = buildPayload(); if (!p) return;
    createMut.mutate(p, {
      onSuccess: (res) => { if (res.success) setForm({ ...emptyForm(defaultYear), academicYear: form.academicYear, examDate: form.examDate }); },
    });
  };

  if (!open) return null;
  const charLeft = 40 - form.name.trim().length;
  const structureDesc = (() => {
    const { numPapers: np, numSubjects: ns } = form;
    if (np === 1 && ns === 1) return "1 paper · 1 subject";
    if (np === 1)             return `1 paper covering ${ns} subjects`;
    if (ns === 1)             return `${np} papers · 1 subject each`;
    return `${np} papers · ${ns} subjects each (${np * ns} total)`;
  })();

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "grid", placeItems: "center", padding: 28, background: "linear-gradient(135deg, rgba(20,23,53,.72), rgba(40,36,95,.62))" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width: "min(960px, 100%)", background: "white", borderRadius: 22, overflow: "hidden", boxShadow: "0 32px 90px rgba(0,0,0,.28)", maxHeight: "90vh", overflowY: "auto" }}>

        {/* Head */}
        <div style={{ padding: "24px 28px", borderBottom: `1px solid ${D.line}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, display: "grid", placeItems: "center", background: "#eef2ff", color: D.nav2, fontWeight: 900 }}>TE</div>
            <h1 style={{ margin: 0, fontSize: 28 }}>{examId ? "Edit Assessment" : "New Assessment"}</h1>
          </div>
          <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", color: "#9aa3b4", fontSize: 28, lineHeight: 1 }}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 18 }}>

          {/* Test Context */}
          <SCard title="Test Context">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <DField label="Academic Year" req>
                <DSelect value={form.academicYear} onChange={(e) => setForm({ ...form, academicYear: e.target.value, batchIds: [] })}>
                  <option value="">Select academic year</option>
                  {academicYears.filter((y) => !y.isArchived).map((y) => <option key={y.id} value={y.name}>{y.name}</option>)}
                </DSelect>
              </DField>
              <DField label="Test Name" req>
                <div style={{ position: "relative" }}>
                  <DInput placeholder="e.g. Maths Integration, JEE or 10th Unit Test" value={form.name} maxLength={40}
                    onChange={(e) => setForm({ ...form, name: e.target.value })} style={{ paddingRight: 44 }} />
                  <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: charLeft < 5 ? "#ef4444" : D.muted }}>{charLeft}</span>
                </div>
              </DField>
            </div>
            <div style={{ marginTop: 14 }}>
              <DField label="Batch(es)" req>
                <BatchMultiSelect batches={filteredBatches} selected={form.batchIds} onChange={(ids) => setForm({ ...form, batchIds: ids })} />
                {form.batchIds.length > 0 && <p style={{ fontSize: 12, color: "#4f46e5", marginTop: 4 }}>{form.batchIds.length} batch{form.batchIds.length > 1 ? "es" : ""} selected</p>}
              </DField>
            </div>
          </SCard>

          {/* Structure */}
          <SCard title="Structure">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5" style={{ background: "white", border: `1px solid ${D.line}`, borderRadius: 14, padding: 16 }}>
              <Stepper label="No. of Papers" value={form.numPapers} min={1} max={5}
                onChange={(n) => setForm({ ...form, numPapers: n, paperSubjects: resizePS(form.paperSubjects, n, form.numSubjects) })} />
              <Stepper label="Subjects per Paper" value={form.numSubjects} min={1} max={5}
                onChange={(n) => setForm({ ...form, numSubjects: n, paperSubjects: resizePS(form.paperSubjects, form.numPapers, n) })} />
            </div>
            <p style={{ marginTop: 10, fontSize: 13, color: D.muted, fontWeight: 850 }}>{structureDesc}</p>
          </SCard>

          {/* Test Details */}
          <SCard title="Test Details">
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {Array.from({ length: form.numPapers }, (_, pi) => (
                <div key={pi} style={{ border: `1px solid ${D.line}`, borderRadius: 14, background: "white", padding: 16 }}>
                  {form.numPapers > 1 && (
                    <p style={{ margin: "0 0 12px", fontSize: 12, fontWeight: 900, color: "#4f46e5", textTransform: "uppercase", letterSpacing: ".06em" }}>Paper {pi + 1}</p>
                  )}
                  {Array.from({ length: form.numSubjects }, (_, si) => {
                    const slot = form.paperSubjects[pi]?.[si] ?? { subjectId: "", topics: [], maxMarks: "" };
                    const updateSlot = (patch: Partial<SubjectSlot>) =>
                      setForm((prev) => ({
                        ...prev,
                        paperSubjects: prev.paperSubjects.map((row, rIdx) =>
                          rIdx === pi ? row.map((s, cIdx) => cIdx === si ? { ...s, ...patch } : s) : row
                        ),
                      }));
                    return (
                      <div key={si} style={si > 0 ? { borderTop: `1px solid ${D.line}`, paddingTop: 12, marginTop: 12 } : {}}>
                        {form.numSubjects > 1 && (
                          <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 900, color: D.muted, textTransform: "uppercase", letterSpacing: ".06em" }}>Subject {si + 1}</p>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-3">
                          <DField label="Subject">
                            <DSelect value={slot.subjectId} onChange={(e) => updateSlot({ subjectId: e.target.value })}>
                              <option value="">Select subject</option>
                              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </DSelect>
                          </DField>
                          <DField label="Max Marks">
                            <DInput type="number" min={0} placeholder="—" value={slot.maxMarks} onChange={(e) => updateSlot({ maxMarks: e.target.value })} />
                          </DField>
                        </div>
                        <div style={{ marginTop: 12 }}>
                          <DField label="Topics">
                            <TopicsInput topics={slot.topics} onChange={(t) => updateSlot({ topics: t })} />
                          </DField>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-4">
              <DField label="Date" req>
                <DInput type="date" max="2099-12-31" min="1900-01-01" value={form.examDate} onChange={(e) => setForm({ ...form, examDate: e.target.value })} />
              </DField>
              <DField label="Start Time">
                <DSelect value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })}>
                  {TIME_SLOTS.map((t) => <option key={t} value={t}>{t}</option>)}
                </DSelect>
              </DField>
              <DField label="End Time">
                <DSelect value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                  style={timeError ? { borderColor: "#ef4444" } : {}}>
                  {TIME_SLOTS.map((t) => <option key={t} value={t}>{t}</option>)}
                </DSelect>
              </DField>
            </div>
            {timeError && <p style={{ fontSize: 12, color: "#ef4444", marginTop: 4 }}>Start and end time can't be the same</p>}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-4">
              <DField label="Total Marks">
                <DInput type="number" min={0} placeholder="Auto or e.g. 100" value={form.totalMarks} onChange={(e) => setForm({ ...form, totalMarks: e.target.value })} />
              </DField>
              <DField label="Result Visibility">
                <DSelect defaultValue="">
                  <option value="">Keep hidden until published</option>
                  <option value="auto">Publish after marking</option>
                </DSelect>
              </DField>
            </div>

            <div style={{ marginTop: 14 }}>
              <DField label="Note">
                <DTextarea rows={2} placeholder="Additional instructions or notes…" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
              </DField>
            </div>
          </SCard>
        </div>

        {/* Foot */}
        <div style={{ padding: "18px 28px", borderTop: `1px solid ${D.line}`, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <DBtn onClick={onClose} disabled={busy}>Cancel</DBtn>
          <div style={{ display: "flex", gap: 10 }}>
            {!examId && <DBtn onClick={handleSaveAnother} disabled={busy}>Save &amp; Add Another</DBtn>}
            <DBtn primary onClick={handleSave} disabled={busy}>
              {busy && <Loader2 className="inline animate-spin mr-1.5" style={{ width: 14, height: 14 }} />}
              {examId ? "Save Changes" : "Save"}
            </DBtn>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── ExamCard ──────────────────────────────────────────────────────────────────
function ExamCard({ exam, canEdit, onEdit, onDelete, onStatus }: {
  exam: any; canEdit: boolean;
  onEdit: (e: any) => void; onDelete: (id: string) => void; onStatus: (id: string, s: string) => void;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [menuOpen]);

  const batchNames = exam.batches?.map((eb: any) => eb.batch?.name).filter(Boolean).join(", ") ?? "—";
  const city = exam.batches?.[0]?.batch?.location?.name;
  const examSubjects: any[] = exam.subjects ?? [];
  const uniqueNames = [...new Set(examSubjects.map((es: any) => es.subject?.name).filter(Boolean))];
  const subjectDisplay = exam.numPapers > 1
    ? Array.from({ length: exam.numPapers }, (_, pi) => {
        const ps = examSubjects.filter((es: any) => es.paperNum === pi + 1).map((es: any) => es.subject?.name).filter(Boolean).join(", ");
        return ps ? `P${pi + 1}: ${ps}` : null;
      }).filter(Boolean).join(" · ")
    : uniqueNames.join(", ");

  // Status-only menu items (edit/archive/delete are separate visible buttons)
  const statusItems = [
    { label: "Mark as Marked", show: exam.status !== "MARKED",     color: "#4338ca", action: () => { onStatus(exam.id, "MARKED");    setMenuOpen(false); } },
    { label: "Mark Completed", show: exam.status !== "COMPLETED",  color: "#16a34a", action: () => { onStatus(exam.id, "COMPLETED"); setMenuOpen(false); } },
    { label: "Mark Due",       show: exam.status !== "DUE",        color: "#b45309", action: () => { onStatus(exam.id, "DUE");       setMenuOpen(false); } },
    { label: "Cancel",         show: exam.status !== "CANCELLED",  color: "#dc2626", action: () => { onStatus(exam.id, "CANCELLED"); setMenuOpen(false); } },
  ].filter((m) => m.show);

  return (
    <div className="group"
      style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "16px 20px", borderBottom: `1px solid ${D.line}`, transition: "background .15s" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "#f8faff")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
    >
      <div style={{ flexShrink: 0, marginTop: 3 }}><StatusBadge status={exam.status} /></div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Title row */}
        <button onClick={() => router.push(`/dashboard/academics/assessments/${exam.id}`)}
          style={{ border: "none", background: "none", cursor: "pointer", padding: 0, fontSize: 16, fontWeight: 800, color: D.nav2, textAlign: "left", lineHeight: 1.3 }}>
          {exam.name}
        </button>

        {/* Meta row — date / time / batches / subjects */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", marginTop: 6, fontSize: 13, color: D.muted, fontWeight: 600 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <Calendar style={{ width: 13, height: 13, flexShrink: 0 }} />
            <strong style={{ color: D.ink, fontWeight: 700 }}>{fmtDate(exam.examDate)}</strong>
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <Clock style={{ width: 13, height: 13, flexShrink: 0 }} />{exam.startTime} – {exam.endTime}
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <BookOpen style={{ width: 13, height: 13, flexShrink: 0 }} />
            <span style={{ color: "#374151", fontWeight: 700 }}>{batchNames}</span>
            {city && <span style={{ color: "#9ca3af", fontWeight: 500 }}>({city})</span>}
          </span>
          {subjectDisplay && (
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <FileCheck2 style={{ width: 13, height: 13, flexShrink: 0 }} />
              <span style={{ color: "#374151", fontWeight: 600 }}>{subjectDisplay}</span>
            </span>
          )}
          {(exam.totalMarks || exam.passingMarks) && (
            <span style={{ fontWeight: 700, color: "#374151" }}>
              Marks: <strong style={{ color: D.nav2 }}>{exam.passingMarks ?? "—"}/{exam.totalMarks ?? "—"}</strong>
            </span>
          )}
        </div>

        {/* Topic chips */}
        {examSubjects.some((es: any) => es.topics) && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 7 }}>
            {examSubjects.flatMap((es: any) =>
              es.topics ? es.topics.split(",").map((t: string) => t.trim()).filter(Boolean) : []
            ).filter((t: string, i: number, arr: string[]) => arr.indexOf(t) === i).map((t: string) => (
              <span key={t} style={{ borderRadius: 6, background: "#f1f5f9", border: "1px solid #e2e8f0", padding: "3px 10px", fontSize: 12, fontWeight: 700, color: "#475569" }}>{t}</span>
            ))}
          </div>
        )}
        <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 5, fontWeight: 500 }}>created on {format(new Date(exam.createdAt), "d MMM yyyy")}</p>
      </div>

      {canEdit && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }} ref={menuRef}>
          {/* Edit */}
          <button onClick={() => onEdit(exam)} title="Edit"
            style={{ padding: 6, borderRadius: 8, border: `1px solid ${D.line}`, background: "white", cursor: "pointer", color: D.muted, display: "flex" }}>
            <Pencil style={{ width: 13, height: 13 }} />
          </button>
          {/* Archive / Unarchive */}
          <button
            onClick={() => onStatus(exam.id, exam.status === "ARCHIVED" ? "DUE" : "ARCHIVED")}
            title={exam.status === "ARCHIVED" ? "Unarchive" : "Archive"}
            style={{ padding: 6, borderRadius: 8, border: `1px solid ${D.line}`, background: "white", cursor: "pointer", color: exam.status === "ARCHIVED" ? "#4338ca" : D.muted, display: "flex" }}>
            {exam.status === "ARCHIVED"
              ? <ArchiveRestore style={{ width: 13, height: 13 }} />
              : <Archive style={{ width: 13, height: 13 }} />}
          </button>
          {/* Delete */}
          <button onClick={() => onDelete(exam.id)} title="Delete"
            style={{ padding: 6, borderRadius: 8, border: `1px solid ${D.line}`, background: "white", cursor: "pointer", color: "#ef4444", display: "flex" }}>
            <Trash2 style={{ width: 13, height: 13 }} />
          </button>
          {/* 3-dot status menu */}
          {statusItems.length > 0 && (
            <div style={{ position: "relative" }}>
              <button onClick={() => setMenuOpen((v) => !v)} title="Change status"
                style={{ padding: 6, borderRadius: 8, border: `1px solid ${D.line}`, background: "white", cursor: "pointer", color: D.muted, display: "flex" }}>
                <svg style={{ width: 14, height: 14 }} fill="currentColor" viewBox="0 0 20 20">
                  <circle cx="10" cy="4" r="1.5" /><circle cx="10" cy="10" r="1.5" /><circle cx="10" cy="16" r="1.5" />
                </svg>
              </button>
              {menuOpen && (
                <div style={{ position: "absolute", right: 0, top: 36, zIndex: 30, width: 180, background: "white", border: `1px solid ${D.line}`, borderRadius: 14, boxShadow: "0 8px 24px rgba(0,0,0,.12)", padding: "4px 0" }}>
                  {statusItems.map((m) => (
                    <button key={m.label} onClick={m.action}
                      style={{ display: "flex", width: "100%", alignItems: "center", gap: 8, padding: "8px 14px", border: "none", background: "none", cursor: "pointer", fontSize: 13, color: m.color }}>
                      {m.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
function AssessmentsPage() {
  const { user }     = useAuthStore();
  const searchParams = useSearchParams();
  const teacherId    = searchParams.get("teacherId");
  const qc           = useQueryClient();
  const permissions  = usePermissions();
  // Write access comes from the permission matrix; only SUPER_ADMIN bypasses it
  const canEdit = hasAcademicsAction(user?.role, permissions, "STU_ASSESSMENT", "canEdit");

  const [search,           setSearch]           = useState("");
  const [filterStatus,     setFilterStatus]     = useState("ALL");
  const [filterDateFrom,   setFilterDateFrom]   = useState("");
  const [filterDateTo,     setFilterDateTo]     = useState("");
  const [filterYear,       setFilterYear]       = useState("");
  const [filterBatch,      setFilterBatch]      = useState("");
  const [filterGrade,      setFilterGrade]      = useState("");
  const [filterSubject,    setFilterSubject]    = useState("");
  const [showStats,        setShowStats]        = useState(false);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [modalOpen,        setModalOpen]        = useState(false);
  const [editTarget,       setEditTarget]       = useState<any | null>(null);
  const [toolbarSearch,    setToolbarSearch]    = useState("");

  const batchesUrl = teacherId
    ? `/api/v1/academics/batches?teacherId=${teacherId}`
    : "/api/v1/academics/batches";
  const { data: yearsData }    = useQuery({ queryKey: ["academic-years"], queryFn: () => api.get("/api/v1/academics/academic-years").then((r) => r.data.data) });
  const { data: gradesData }   = useQuery({ queryKey: ["grades"],         queryFn: () => api.get("/api/v1/academics/grades").then((r) => r.data) });
  const { data: subjectsData } = useQuery({ queryKey: ["subjects"],       queryFn: () => api.get("/api/v1/academics/subjects").then((r) => r.data.data) });
  const { data: batchesData }  = useQuery({ queryKey: ["batches-all", teacherId ?? "all"], queryFn: () => api.get(batchesUrl).then((r) => r.data) });

  const years    = (yearsData          ?? []) as any[];
  const grades   = (gradesData?.data   ?? []) as any[];
  const subjects = (subjectsData ?? []) as any[];
  const batches  = (batchesData?.data  ?? []) as any[];

  useEffect(() => {
    if (filterYear || years.length === 0) return;
    const active = years.find((y) => y.isActive && !y.isArchived) ?? years.find((y) => !y.isArchived);
    if (active) setFilterYear(active.name);
  }, [years]); // eslint-disable-line

  const defaultYear = years.find((y) => y.isActive && !y.isArchived)?.name ?? years.find((y) => !y.isArchived)?.name ?? "";

  const params = new URLSearchParams();
  if (search)                 params.set("search",       search);
  if (filterStatus !== "ALL") params.set("status",       filterStatus);
  if (filterDateFrom)         params.set("dateFrom",     filterDateFrom);
  if (filterDateTo)           params.set("dateTo",       filterDateTo);
  if (filterYear)             params.set("academicYear", filterYear);
  if (filterBatch)            params.set("batchId",      filterBatch);
  else if (teacherId)         params.set("teacherId",    teacherId);
  if (filterGrade)            params.set("gradeId",      filterGrade);
  if (filterSubject)          params.set("subjectId",    filterSubject);
  params.set("limit", "200");

  const { data: examData, isLoading } = useQuery({
    queryKey: ["assessments", params.toString()],
    queryFn:  () => api.get(`/api/v1/academics/assessments?${params.toString()}`).then((r) => r.data),
  });
  const allExams: any[] = examData?.data ?? [];

  const exams = toolbarSearch
    ? allExams.filter((e) => {
        const q = toolbarSearch.toLowerCase();
        return (
          e.name?.toLowerCase().includes(q) ||
          e.batches?.some((eb: any) => eb.batch?.name?.toLowerCase().includes(q)) ||
          e.subjects?.some((es: any) => es.subject?.name?.toLowerCase().includes(q))
        );
      })
    : allExams;

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const upcomingCount  = allExams.filter((e) => e.status === "DUE" && new Date(e.examDate) >= today).length;
  const dueMarkCount   = allExams.filter((e) => e.status === "COMPLETED").length;
  const completedCount = allExams.filter((e) => e.status === "MARKED").length;

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/api/v1/academics/assessments/${id}/status`, { status }).then((r) => r.data),
    onSuccess: (res) => { if (!res.success) { toast.error(res.error); return; } qc.invalidateQueries({ queryKey: ["assessments"] }); toast.success("Status updated"); },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/academics/assessments/${id}`).then((r) => r.data),
    onSuccess: (res) => { if (!res.success) { toast.error(res.error); return; } qc.invalidateQueries({ queryKey: ["assessments"] }); toast.success("Deleted"); },
  });

  const openEdit = (exam: any) => {
    const np = exam.numPapers ?? 1;
    const ns = exam.numSubjects ?? 1;
    const ps: SubjectSlot[][] = resizePS([], np, ns);
    for (const es of exam.subjects ?? []) {
      const pi = (es.paperNum ?? 1) - 1;
      const si = (es.subjectSlot ?? 1) - 1;
      if (ps[pi] && si < ps[pi].length) {
        ps[pi][si] = {
          subjectId: es.subjectId ?? "",
          topics: es.topics ? es.topics.split(",").map((t: string) => t.trim()).filter(Boolean) : [],
          maxMarks: es.maxMarks != null ? String(es.maxMarks) : "",
        };
      }
    }
    setEditTarget({
      id: exam.id,
      form: {
        academicYear: exam.academicYear, name: exam.name,
        numPapers: np, numSubjects: ns,
        batchIds: exam.batches?.map((eb: any) => eb.batchId) ?? [],
        paperSubjects: ps,
        examDate: exam.examDate?.split("T")[0] ?? "",
        startTime: exam.startTime, endTime: exam.endTime,
        totalMarks: exam.totalMarks != null ? String(exam.totalMarks) : "",
        note: exam.note ?? "",
      } satisfies ExamForm,
    });
    setModalOpen(true);
  };

  const exportCSV = () => {
    const header = ["Name", "Academic Year", "Batches", "Subject", "Date", "Start", "End", "Passing", "Total", "Status", "Topics"];
    const rows = exams.map((e) => [
      e.name, e.academicYear,
      e.batches?.map((eb: any) => eb.batch?.name).join(" | ") ?? "",
      e.subject?.name ?? "", fmtDate(e.examDate), e.startTime, e.endTime,
      e.passingMarks ?? "", e.totalMarks ?? "", e.status, e.topics ?? "",
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "assessments.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const STATUS_CHIPS = [
    { key: "ALL", label: "All" }, { key: "DUE", label: "Due" }, { key: "MARKED", label: "Marked" },
    { key: "COMPLETED", label: "Completed" }, { key: "CANCELLED", label: "Cancelled" },
  ] as const;

  const pageHead = (
    <div style={{ background: "white", borderBottom: `1px solid ${D.line}`, padding: "22px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {!showStats && (
          <button className="lg:hidden" onClick={() => setMobileFilterOpen(true)}
            style={{ minHeight: 36, border: `1px solid ${D.line}`, borderRadius: 10, padding: "0 14px", background: "white", color: D.muted, fontSize: 13, fontWeight: 850, cursor: "pointer" }}>
            Filters
          </button>
        )}
        <div style={{ width: 44, height: 44, borderRadius: 14, display: "grid", placeItems: "center", background: "#eef2ff", color: D.nav2, fontWeight: 900, fontSize: 16, flexShrink: 0 }}>TE</div>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, lineHeight: 1.15, fontWeight: 800 }}>Assessments</h1>
          <div style={{ marginTop: 4, color: D.muted, fontWeight: 700, fontSize: 14 }}>Plan tests, manage marking, and track academic performance</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {!showStats && <DBtn onClick={exportCSV}>Export</DBtn>}
        <DBtn onClick={() => setShowStats((v) => !v)}>{showStats ? "← Tests" : "Stats"}</DBtn>
        {!showStats && canEdit && <DBtn primary onClick={() => { setEditTarget(null); setModalOpen(true); }}>+ New Test</DBtn>}
      </div>
    </div>
  );

  if (showStats) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: D.bg }}>
        {pageHead}
        <div style={{ flex: 1, overflow: "hidden", display: "flex" }}>
          <AssessmentStatsPanel batches={batches} grades={grades} subjects={subjects} academicYears={years} defaultYear={defaultYear} />
        </div>
      </div>
    );
  }

  const sidebarContent = (
    <div style={{ padding: "22px 18px", overflowY: "auto" }}>
      <p style={{ margin: "0 0 14px", color: "#9aa3b4", fontSize: 13, fontWeight: 900, letterSpacing: ".08em", textTransform: "uppercase" }}>Filters</p>

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: "block", marginBottom: 8, color: "#4b5563", fontSize: 13, fontWeight: 850 }}>Search</label>
        <DInput placeholder="Test name…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: "block", marginBottom: 8, color: "#4b5563", fontSize: 13, fontWeight: 850 }}>Status</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {STATUS_CHIPS.map(({ key, label }) => (
            <button key={key} onClick={() => setFilterStatus(key)} style={{
              minHeight: 32, borderRadius: 999, display: "inline-flex", alignItems: "center",
              padding: "0 12px", fontSize: 12, fontWeight: 850, cursor: "pointer", border: "1px solid",
              ...(filterStatus === key
                ? { background: D.nav2, color: "white", borderColor: D.nav2 }
                : { background: "white", color: "#4b5563", borderColor: D.line }),
            }}>{label}</button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: "block", marginBottom: 8, color: "#4b5563", fontSize: 13, fontWeight: 850 }}>Exam Date Range</label>
        <DInput type="date" max="2099-12-31" min="1900-01-01" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} style={{ marginBottom: 8 }} />
        <DInput type="date" max="2099-12-31" min="1900-01-01" value={filterDateTo}   onChange={(e) => setFilterDateTo(e.target.value)} />
      </div>

      {[
        { label: "Academic Year", el: <DSelect value={filterYear} onChange={(e) => { setFilterYear(e.target.value); setFilterBatch(""); }}>
            <option value="">All years</option>
            {years.map((y) => <option key={y.id} value={y.name}>{y.name}</option>)}
          </DSelect> },
        { label: "Grade", el: <DSelect value={filterGrade} onChange={(e) => { setFilterGrade(e.target.value); setFilterBatch(""); }}>
            <option value="">All grades</option>
            {grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </DSelect> },
        { label: "Batch", el: <DSelect value={filterBatch} onChange={(e) => setFilterBatch(e.target.value)}>
            <option value="">All batches</option>
            {batches.filter((b) => (!filterYear || b.academicYear === filterYear) && (!filterGrade || b.gradeId === filterGrade))
              .map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </DSelect> },
        { label: "Subject", el: <DSelect value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)}>
            <option value="">All subjects</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </DSelect> },
      ].map(({ label, el }) => (
        <div key={label} style={{ marginBottom: 20 }}>
          <label style={{ display: "block", marginBottom: 8, color: "#4b5563", fontSize: 13, fontWeight: 850 }}>{label}</label>
          {el}
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: D.bg }}>
      {pageHead}

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {mobileFilterOpen && (
          <div className="lg:hidden" style={{ position: "fixed", inset: 0, zIndex: 30, background: "rgba(0,0,0,.4)" }} onClick={() => setMobileFilterOpen(false)} />
        )}

        <aside className={`${mobileFilterOpen ? "flex" : "hidden"} lg:flex flex-col shrink-0`}
          style={{ width: 300, background: "white", borderRight: `1px solid ${D.line}`, overflowY: "auto", ...(mobileFilterOpen ? { position: "fixed", inset: "0 auto 0 0", zIndex: 40, boxShadow: "4px 0 24px rgba(0,0,0,.12)" } : {}) }}>
          <div className="flex lg:hidden items-center justify-between px-4 pt-4 pb-2">
            <span style={{ fontSize: 14, fontWeight: 700 }}>Filters</span>
            <button onClick={() => setMobileFilterOpen(false)} style={{ border: "none", background: "none", cursor: "pointer", padding: 4 }}>
              <X style={{ width: 18, height: 18, color: D.muted }} />
            </button>
          </div>
          {sidebarContent}
        </aside>

        <main style={{ flex: 1, overflowY: "auto", padding: "26px 30px 38px" }}>
          <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: "minmax(0,1fr) auto auto", alignItems: "center" }}>
            <DInput placeholder="Search assessments by test name, batch, subject, or faculty" value={toolbarSearch}
              onChange={(e) => setToolbarSearch(e.target.value)} style={{ minHeight: 48, borderRadius: 14, fontSize: 15 }} />
            <span style={{ color: D.muted, fontWeight: 850, whiteSpace: "nowrap" }}>{exams.length} test{exams.length !== 1 ? "s" : ""}</span>
            {canEdit && <DBtn primary onClick={() => { setEditTarget(null); setModalOpen(true); }}>+ New Test</DBtn>}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            {[
              { label: "Upcoming Tests",  value: upcomingCount },
              { label: "Due for Marking", value: dueMarkCount },
              { label: "Completed",       value: completedCount },
              { label: "Avg. Score",      value: "—" },
            ].map((s) => (
              <div key={s.label} style={{ background: "white", border: `1px solid ${D.line}`, borderRadius: 16, padding: 18, boxShadow: "0 8px 22px rgba(20,23,53,.05)" }}>
                <span style={{ color: D.muted, fontSize: 12, fontWeight: 850, textTransform: "uppercase", letterSpacing: ".04em" }}>{s.label}</span>
                <strong style={{ display: "block", marginTop: 8, fontSize: 28, lineHeight: 1 }}>{s.value}</strong>
              </div>
            ))}
          </div>

          {isLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[1,2,3,4,5].map((i) => <div key={i} style={{ height: 80, borderRadius: 14, background: "#e9ecf3" }} className="animate-pulse" />)}
            </div>
          ) : exams.length === 0 ? (
            <>
              <div style={{ background: "white", border: "1px dashed #cbd5e1", borderRadius: 18, minHeight: 400, display: "grid", placeItems: "center", textAlign: "center", padding: 36 }}>
                <div>
                  <div style={{ width: 72, height: 72, borderRadius: 22, display: "grid", placeItems: "center", background: "#eef2ff", color: D.nav2, fontSize: 24, fontWeight: 900, margin: "0 auto 16px" }}>TE</div>
                  <h2 style={{ margin: 0, fontSize: 22 }}>No assessments found</h2>
                  <p style={{ margin: "8px auto 18px", color: D.muted, maxWidth: 500, lineHeight: 1.5, fontWeight: 650 }}>
                    Create the first test with papers, subjects, marks, batches, date, and time. Results and marking analytics will appear here once assessments are conducted.
                  </p>
                  {canEdit && <DBtn primary onClick={() => { setEditTarget(null); setModalOpen(true); }}>+ Create Assessment</DBtn>}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
                {[
                  { title: "Test Calendar",      desc: "See upcoming assessments across batches and subjects." },
                  { title: "Marking Queue",       desc: "Track tests that are due for evaluation." },
                  { title: "Performance Reports", desc: "Open score trends after results are published." },
                ].map((q) => (
                  <div key={q.title} style={{ background: "white", border: `1px solid ${D.line}`, borderRadius: 16, padding: 18 }}>
                    <strong style={{ display: "block", fontSize: 15 }}>{q.title}</strong>
                    <span style={{ display: "block", color: D.muted, marginTop: 5, fontSize: 13, fontWeight: 700 }}>{q.desc}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ background: "white", border: `1px solid ${D.line}`, borderRadius: 18, overflow: "hidden", boxShadow: "0 4px 16px rgba(20,23,53,.06)" }}>
              {exams.map((exam) => (
                <ExamCard key={exam.id} exam={exam} canEdit={canEdit}
                  onEdit={openEdit}
                  onDelete={(id) => { if (confirm("Delete this assessment?")) deleteMut.mutate(id); }}
                  onStatus={(id, status) => statusMut.mutate({ id, status })} />
              ))}
            </div>
          )}
        </main>
      </div>

      <ExamModal open={modalOpen} onClose={() => { setModalOpen(false); setEditTarget(null); }}
        initial={editTarget?.form} examId={editTarget?.id}
        batches={batches} subjects={subjects} academicYears={years} defaultYear={defaultYear} />
    </div>
  );
}

export default function AssessmentsPageWrapped() {
  return <Suspense fallback={null}><AssessmentsPage /></Suspense>;
}
