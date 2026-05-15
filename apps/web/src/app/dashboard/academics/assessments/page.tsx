"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  Plus, Minus, X, FileCheck2, Calendar, ChevronDown, Filter,
  Download, SlidersHorizontal, Loader2, Pencil, Trash2,
  Clock, CheckCircle2, Archive, RotateCcw, BookOpen, Ban,
  Star, BarChart2,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { AssessmentStatsPanel } from "./StatsPanel";

// ── Primitives ────────────────────────────────────────────────────────────────

function Input({ className = "", ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input {...props}
      className={`w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 ${className}`}
    />
  );
}

function FSelect({ className = "", children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props}
      className={`w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none bg-white text-gray-700 ${className}`}
    >
      {children}
    </select>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-medium text-gray-600 mb-1">{children}</label>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  try { return format(parseISO(iso), "dd MMM yyyy"); } catch { return iso; }
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

// Build half-hour time slots "12:00 AM" … "11:30 PM"
const TIME_SLOTS = (() => {
  const slots: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      const hour   = h % 12 === 0 ? 12 : h % 12;
      const period = h < 12 ? "AM" : "PM";
      const min    = m === 0 ? "00" : "30";
      slots.push(`${hour}:${min} ${period}`);
    }
  }
  return slots;
})();

// ── Status helpers ─────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  DUE: "Due", COMPLETED: "Completed", MARKED: "Marked", CANCELLED: "Cancelled", ARCHIVED: "Archived",
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    DUE:       "bg-amber-50 text-amber-700 border border-amber-200",
    COMPLETED: "bg-green-50 text-green-700 border border-green-200",
    MARKED:    "bg-indigo-50 text-indigo-700 border border-indigo-200",
    CANCELLED: "bg-red-50 text-red-600 border border-red-200",
    ARCHIVED:  "bg-gray-100 text-gray-500 border border-gray-200",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${map[status] ?? "bg-gray-100 text-gray-600"}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

// ── Topics tag input ──────────────────────────────────────────────────────────

function TopicsInput({ topics, onChange }: { topics: string[]; onChange: (t: string[]) => void }) {
  const [input, setInput] = useState("");
  const add = () => {
    const t = input.trim();
    if (t && !topics.includes(t)) onChange([...topics, t]);
    setInput("");
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5 min-h-[36px] p-2 rounded-lg border border-gray-200 bg-white">
        {topics.map((t) => (
          <span key={t} className="flex items-center gap-1 rounded-md bg-indigo-50 border border-indigo-100 px-2 py-0.5 text-xs text-indigo-700">
            {t}
            <button type="button" onClick={() => onChange(topics.filter((x) => x !== t))}
              className="text-indigo-400 hover:text-indigo-700 ml-0.5">
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
        {topics.length === 0 && <span className="text-xs text-gray-400 self-center">No topics added</span>}
      </div>
      <div className="flex gap-2">
        <Input placeholder="Type a topic and press Add…" value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <button type="button" onClick={add}
          className="shrink-0 flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition-colors">
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>
    </div>
  );
}

// ── Multi-batch selector ──────────────────────────────────────────────────────

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

  const selectedNames = batches.filter((b) => selected.includes(b.id)).map((b) => b.name).join(", ");

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500">
        <span className="truncate text-left flex-1 min-w-0">
          {selected.length === 0 ? <span className="text-gray-400">Select batches…</span> : selectedNames}
        </span>
        <ChevronDown className={`h-4 w-4 text-gray-400 shrink-0 ml-1 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
          <div className="max-h-48 overflow-y-auto">
            {batches.length === 0 && <p className="px-3 py-2 text-xs text-gray-400">No batches for this year</p>}
            {batches.map((b) => (
              <label key={b.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                <input type="checkbox" checked={selected.includes(b.id)} onChange={() => toggle(b.id)} className="accent-indigo-600" />
                <span className="text-sm text-gray-700">{b.name}</span>
                {b.grade && <span className="text-xs text-gray-400 ml-auto shrink-0">{b.grade.name}</span>}
              </label>
            ))}
          </div>
          <div className="border-t border-gray-100 px-3 py-2 flex items-center justify-between">
            <span className="text-xs text-gray-400">{selected.length} selected</span>
            <button type="button" onClick={() => setOpen(false)}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-800 px-2 py-0.5 rounded hover:bg-indigo-50 transition-colors">
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Stepper ───────────────────────────────────────────────────────────────────

function Stepper({ value, min, max, onChange, label }: {
  value: number; min: number; max: number; label: string;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex items-center gap-2 mt-1">
        <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}
          className="h-8 w-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-30 transition-colors">
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className="w-8 text-center text-sm font-bold text-gray-800">{value}</span>
        <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max}
          className="h-8 w-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-30 transition-colors">
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// Each paper-subject slot carries its own subjectId + topics + maxMarks
type SubjectSlot = { subjectId: string; topics: string[]; maxMarks: string };

// Resize 2D array preserving existing slot values
function resizePS(ps: SubjectSlot[][], np: number, ns: number): SubjectSlot[][] {
  return Array.from({ length: np }, (_, pi) =>
    Array.from({ length: ns }, (_, si) => ps[pi]?.[si] ?? { subjectId: "", topics: [], maxMarks: "" })
  );
}

// ── Exam form types ──────────────────────────────────────────────────────────

type ExamForm = {
  academicYear: string; name: string;
  numPapers: number; numSubjects: number;
  batchIds: string[];
  paperSubjects: SubjectSlot[][];   // [paperIdx][subjectSlot]
  examDate: string; startTime: string; endTime: string;
  totalMarks: string; note: string;
};

function emptyForm(defaultYear = ""): ExamForm {
  return {
    academicYear: defaultYear, name: "",
    numPapers: 1, numSubjects: 1,
    batchIds: [],
    paperSubjects: [[{ subjectId: "", topics: [], maxMarks: "" }]],
    examDate: todayStr(), startTime: "9:00 AM", endTime: "10:00 AM",
    totalMarks: "", note: "",
  };
}

// ── Exam modal ────────────────────────────────────────────────────────────────

function ExamModal({
  open, onClose, initial, examId,
  batches, subjects, academicYears, defaultYear,
}: {
  open: boolean; onClose: () => void; initial?: ExamForm; examId?: string;
  batches: any[]; subjects: any[]; academicYears: any[]; defaultYear: string;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<ExamForm>(initial ?? emptyForm(defaultYear));

  useEffect(() => {
    if (open) setForm(initial ?? emptyForm(defaultYear));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const filteredBatches = form.academicYear
    ? batches.filter((b) => b.academicYear === form.academicYear)
    : batches;

  const timeError = Boolean(
    form.startTime && form.endTime && form.startTime === form.endTime
  );

  const createMut = useMutation({
    mutationFn: (d: any) => api.post("/api/v1/academics/assessments", d).then((r) => r.data),
    onSuccess: (res) => {
      if (!res.success) { toast.error(res.error); return; }
      qc.invalidateQueries({ queryKey: ["assessments"] });
      toast.success("Assessment created");
    },
  });
  const updateMut = useMutation({
    mutationFn: (d: any) => api.patch(`/api/v1/academics/assessments/${examId}`, d).then((r) => r.data),
    onSuccess: (res) => {
      if (!res.success) { toast.error(res.error); return; }
      qc.invalidateQueries({ queryKey: ["assessments"] });
      toast.success("Assessment updated");
      onClose();
    },
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
      academicYear:  form.academicYear,
      name:          form.name.trim(),
      numPapers:     form.numPapers,
      numSubjects:   form.numSubjects,
      batchIds:      form.batchIds,
      paperSubjects: form.paperSubjects.map((paper) =>
        paper.map((slot) => ({
          subjectId: slot.subjectId || null,
          topics:    slot.topics.length > 0 ? slot.topics.join(", ") : null,
          maxMarks:  slot.maxMarks ? parseFloat(slot.maxMarks) : null,
        }))
      ),
      examDate:   new Date(form.examDate).toISOString(),
      startTime:  form.startTime,
      endTime:    form.endTime,
      totalMarks: form.totalMarks ? parseInt(form.totalMarks) : null,
      note:       form.note.trim() || null,
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
      onSuccess: (res) => {
        if (res.success) setForm({ ...emptyForm(defaultYear), academicYear: form.academicYear, examDate: form.examDate });
      },
    });
  };

  if (!open) return null;

  const charLeft = 40 - form.name.trim().length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-100 rounded-lg"><FileCheck2 className="h-4 w-4 text-indigo-600" /></div>
            <h2 className="text-base font-semibold text-gray-900">
              {examId ? "Edit Assessment" : "New Assessment"}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-400"><X className="h-4 w-4" /></button>
        </div>

        <div className="px-6 py-5 space-y-4">

          {/* Section: Test is taken for */}
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Test is taken for</p>

          {/* Academic Year */}
          <div>
            <Label>Academic Year <span className="text-red-400">*</span></Label>
            <FSelect value={form.academicYear} onChange={(e) => setForm({ ...form, academicYear: e.target.value, batchIds: [] })}>
              <option value="">Select academic year</option>
              {academicYears.filter((y) => !y.isArchived).map((y) => <option key={y.id} value={y.name}>{y.name}</option>)}
            </FSelect>
          </div>

          {/* Name */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label>Test Name <span className="text-red-400">*</span></Label>
              <span className={`text-[10px] ${charLeft < 5 ? "text-red-400" : "text-gray-300"}`}>{charLeft} left</span>
            </div>
            <Input placeholder="e.g. Maths Integration, JEE or 10th Unit Test"
              value={form.name} maxLength={40}
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>

          {/* Batch */}
          <div>
            <Label>Batch(es) <span className="text-red-400">*</span></Label>
            <BatchMultiSelect batches={filteredBatches} selected={form.batchIds}
              onChange={(ids) => setForm({ ...form, batchIds: ids })} />
            {form.batchIds.length > 0 && (
              <p className="text-xs text-indigo-600 mt-1">{form.batchIds.length} batch{form.batchIds.length > 1 ? "es" : ""} selected</p>
            )}
          </div>

          {/* Papers + Subjects steppers */}
          <div className="grid grid-cols-2 gap-4 p-3 rounded-xl bg-gray-50 border border-gray-100">
            <Stepper label="No. of Papers" value={form.numPapers} min={1} max={5}
              onChange={(n) => setForm({ ...form, numPapers: n, paperSubjects: resizePS(form.paperSubjects, n, form.numSubjects) })} />
            <Stepper label="Subjects per Paper" value={form.numSubjects} min={1} max={5}
              onChange={(n) => setForm({ ...form, numSubjects: n, paperSubjects: resizePS(form.paperSubjects, form.numPapers, n) })} />
            <p className="col-span-2 text-[11px] text-gray-400 -mt-2">
              {form.numPapers === 1 && form.numSubjects === 1 && "1 paper · 1 subject"}
              {form.numPapers === 1 && form.numSubjects > 1 && `1 paper covering ${form.numSubjects} subjects`}
              {form.numPapers > 1 && form.numSubjects === 1 && `${form.numPapers} papers · 1 subject each`}
              {form.numPapers > 1 && form.numSubjects > 1 && `${form.numPapers} papers · ${form.numSubjects} subjects each (${form.numPapers * form.numSubjects} total)`}
            </p>
          </div>

          {/* Section: Test details */}
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Test Details</p>
          </div>

          {/* Dynamic paper × subject × topics grid */}
          <div className="space-y-3">
            {Array.from({ length: form.numPapers }, (_, pi) => (
              <div key={pi} className="rounded-xl border border-gray-200 bg-gray-50/40 px-4 py-3 space-y-3">
                {form.numPapers > 1 && (
                  <p className="text-xs font-bold text-indigo-600 uppercase tracking-wide">Paper {pi + 1}</p>
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
                    <div key={si} className={form.numSubjects > 1 ? "border-t border-gray-100 pt-3 first:border-t-0 first:pt-0" : ""}>
                      {form.numSubjects > 1 && (
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Subject {si + 1}</p>
                      )}
                      <div className="flex gap-2 items-end">
                        <div className="flex-1">
                          <FSelect value={slot.subjectId}
                            onChange={(e) => updateSlot({ subjectId: e.target.value })}>
                            <option value="">Select subject</option>
                            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </FSelect>
                        </div>
                        <div className="w-24 shrink-0">
                          <p className="text-[10px] text-gray-400 mb-1">Max Marks</p>
                          <Input type="number" min={0} placeholder="—" value={slot.maxMarks}
                            onChange={(e) => updateSlot({ maxMarks: e.target.value })} />
                        </div>
                      </div>
                      <div className="mt-2">
                        <p className="text-[10px] text-gray-400 mb-1">Topics</p>
                        <TopicsInput
                          topics={slot.topics}
                          onChange={(t) => updateSlot({ topics: t })}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Date + Times */}
          <div>
            <Label>Date &amp; Time <span className="text-red-400">*</span></Label>
            <div className="grid grid-cols-3 gap-2">
              <Input type="date" value={form.examDate}
                onChange={(e) => setForm({ ...form, examDate: e.target.value })} />
              <FSelect value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })}>
                {TIME_SLOTS.map((t) => <option key={t} value={t}>{t}</option>)}
              </FSelect>
              <FSelect value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                className={timeError ? "border-red-400" : ""}>
                {TIME_SLOTS.map((t) => <option key={t} value={t}>{t}</option>)}
              </FSelect>
            </div>
            {timeError && <p className="text-xs text-red-500 mt-1">Start and end time can't be the same</p>}
          </div>

          {/* Total Marks */}
          <div>
            <Label>Total Marks</Label>
            <Input type="number" min={0} placeholder="e.g. 100" value={form.totalMarks}
              onChange={(e) => setForm({ ...form, totalMarks: e.target.value })} />
          </div>

          {/* Note */}
          <div>
            <Label>Note</Label>
            <textarea rows={2} placeholder="Additional instructions or notes…" value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none" />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-6 pb-5 pt-2 border-t border-gray-100">
          <button onClick={onClose} disabled={busy}
            className="px-4 py-2 text-sm text-gray-500 rounded-lg hover:bg-gray-100 transition-colors">
            Cancel
          </button>
          <div className="flex items-center gap-2">
            {!examId && (
              <button onClick={handleSaveAnother} disabled={busy}
                className="px-4 py-2 text-sm text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors disabled:opacity-50">
                Save &amp; Add Another
              </button>
            )}
            <button onClick={handleSave} disabled={busy}
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50">
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {examId ? "Save Changes" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Exam card ────────────────────────────────────────────────────────────────

function ExamCard({
  exam, canEdit, onEdit, onDelete, onStatus,
}: {
  exam: any; canEdit: boolean;
  onEdit: (e: any) => void; onDelete: (id: string) => void; onStatus: (id: string, s: string) => void;
}) {
  const router   = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [menuOpen]);

  const batchNames = exam.batches?.map((eb: any) => eb.batch?.name).filter(Boolean).join(", ") ?? "—";
  const city       = exam.batches?.[0]?.batch?.location?.name;

  // Build subject display: "Paper 1: Math · Paper 2: Physics" or just "Math, Physics"
  const examSubjects: any[] = exam.subjects ?? [];
  const uniqueSubjectNames = [...new Set(examSubjects.map((es: any) => es.subject?.name).filter(Boolean))];
  const subjectDisplay = exam.numPapers > 1
    ? Array.from({ length: exam.numPapers }, (_, pi) => {
        const paperSubs = examSubjects
          .filter((es: any) => es.paperNum === pi + 1)
          .map((es: any) => es.subject?.name)
          .filter(Boolean)
          .join(", ");
        return paperSubs ? `P${pi + 1}: ${paperSubs}` : null;
      }).filter(Boolean).join(" · ")
    : uniqueSubjectNames.join(", ");

  return (
    <div className="group flex items-start gap-3 px-4 py-3.5 border-b border-gray-100 last:border-0 hover:bg-gray-50/60 transition-colors first:rounded-t-2xl last:rounded-b-2xl">

      {/* Status badge */}
      <div className="shrink-0 mt-0.5"><StatusBadge status={exam.status} /></div>

      {/* Main */}
      <div className="flex-1 min-w-0">
        <button onClick={() => router.push(`/dashboard/academics/assessments/${exam.id}`)}
          className="text-sm font-semibold text-indigo-700 hover:text-indigo-900 hover:underline text-left truncate">
          {exam.name}
        </button>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3 shrink-0" />{fmtDate(exam.examDate)}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3 shrink-0" />{exam.startTime} – {exam.endTime}
          </span>
          <span className="flex items-center gap-1">
            <BookOpen className="h-3 w-3 shrink-0 text-gray-400" />{batchNames}
            {city && <span className="text-gray-400">({city})</span>}
          </span>
          {subjectDisplay && (
            <span className="flex items-center gap-1 text-gray-400">
              <FileCheck2 className="h-3 w-3 shrink-0" />{subjectDisplay}
            </span>
          )}
          {(exam.totalMarks || exam.passingMarks) && (
            <span className="text-gray-400">
              Marks: {exam.passingMarks ?? "—"}/{exam.totalMarks ?? "—"}
            </span>
          )}
        </div>

        {examSubjects.some((es: any) => es.topics) && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {examSubjects.flatMap((es: any) =>
              es.topics ? es.topics.split(",").map((t: string) => t.trim()).filter(Boolean) : []
            ).filter((t: string, i: number, arr: string[]) => arr.indexOf(t) === i).map((t: string) => (
              <span key={t} className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">{t}</span>
            ))}
          </div>
        )}

        <p className="text-[11px] text-gray-400 mt-1">
          created on {format(new Date(exam.createdAt), "d MMM yyyy")}
        </p>
      </div>

      {/* Three-dot menu */}
      {canEdit && (
        <div className="relative shrink-0" ref={menuRef}>
          <button onClick={() => setMenuOpen((v) => !v)}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 opacity-0 group-hover:opacity-100 transition-all">
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <circle cx="10" cy="4" r="1.5" /><circle cx="10" cy="10" r="1.5" /><circle cx="10" cy="16" r="1.5" />
            </svg>
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-8 z-30 w-48 rounded-xl border border-gray-100 bg-white shadow-xl py-1">
              <button onClick={() => { onEdit(exam); setMenuOpen(false); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50">
                <Pencil className="h-3.5 w-3.5 text-gray-400" /> Edit
              </button>
              {exam.status !== "MARKED" && (
                <button onClick={() => { onStatus(exam.id, "MARKED"); setMenuOpen(false); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-indigo-700 hover:bg-indigo-50">
                  <Star className="h-3.5 w-3.5" /> Mark as Marked
                </button>
              )}
              {exam.status !== "COMPLETED" && (
                <button onClick={() => { onStatus(exam.id, "COMPLETED"); setMenuOpen(false); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-green-700 hover:bg-green-50">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Mark Completed
                </button>
              )}
              {exam.status !== "DUE" && (
                <button onClick={() => { onStatus(exam.id, "DUE"); setMenuOpen(false); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-amber-700 hover:bg-amber-50">
                  <RotateCcw className="h-3.5 w-3.5" /> Mark Due
                </button>
              )}
              {exam.status !== "CANCELLED" && (
                <button onClick={() => { onStatus(exam.id, "CANCELLED"); setMenuOpen(false); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50">
                  <Ban className="h-3.5 w-3.5" /> Cancel
                </button>
              )}
              {exam.status !== "ARCHIVED" && (
                <button onClick={() => { onStatus(exam.id, "ARCHIVED"); setMenuOpen(false); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-600 hover:bg-gray-50">
                  <Archive className="h-3.5 w-3.5" /> Archive
                </button>
              )}
              <div className="my-1 border-t border-gray-100" />
              <button onClick={() => { onDelete(exam.id); setMenuOpen(false); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50">
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AssessmentsPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const canEdit = user?.role === "SUPER_ADMIN" || user?.role === "HR_ADMIN";

  // Filters
  const [search,         setSearch]         = useState("");
  const [filterStatus,   setFilterStatus]   = useState("ALL");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo,   setFilterDateTo]   = useState("");
  const [filterYear,     setFilterYear]     = useState("");
  const [filterBatch,    setFilterBatch]    = useState("");
  const [filterGrade,    setFilterGrade]    = useState("");
  const [filterSubject,  setFilterSubject]  = useState("");

  // UI
  const [showStats,          setShowStats]         = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [modalOpen,          setModalOpen]         = useState(false);
  const [editTarget,         setEditTarget]        = useState<any | null>(null);

  // Reference data
  const { data: yearsData }    = useQuery({ queryKey: ["academic-years"],   queryFn: () => api.get("/api/v1/academics/academic-years").then((r) => r.data.data) });
  const { data: gradesData }   = useQuery({ queryKey: ["grades"],           queryFn: () => api.get("/api/v1/academics/grades").then((r) => r.data) });
  const { data: subjectsData } = useQuery({ queryKey: ["subjects"],         queryFn: () => api.get("/api/v1/academics/subjects").then((r) => r.data) });
  const { data: batchesData }  = useQuery({ queryKey: ["batches-all"],      queryFn: () => api.get("/api/v1/academics/batches").then((r) => r.data) });

  const years    = (yearsData    ?? []) as any[];
  const grades   = (gradesData?.data   ?? []) as any[];
  const subjects = (subjectsData?.data ?? []) as any[];
  const batches  = (batchesData?.data  ?? []) as any[];

  // Auto-set active AY
  useEffect(() => {
    if (filterYear || years.length === 0) return;
    const active = years.find((y) => y.isActive && !y.isArchived) ?? years.find((y) => !y.isArchived);
    if (active) setFilterYear(active.name);
  }, [years]); // eslint-disable-line react-hooks/exhaustive-deps

  const defaultYear = years.find((y) => y.isActive && !y.isArchived)?.name ?? years.find((y) => !y.isArchived)?.name ?? "";

  // Query params
  const params = new URLSearchParams();
  if (search)                  params.set("search",       search);
  if (filterStatus !== "ALL")  params.set("status",       filterStatus);
  if (filterDateFrom)          params.set("dateFrom",     filterDateFrom);
  if (filterDateTo)            params.set("dateTo",       filterDateTo);
  if (filterYear)              params.set("academicYear", filterYear);
  if (filterBatch)             params.set("batchId",      filterBatch);
  if (filterGrade)             params.set("gradeId",      filterGrade);
  if (filterSubject)           params.set("subjectId",    filterSubject);
  params.set("limit", "200");

  const { data: examData, isLoading } = useQuery({
    queryKey: ["assessments", params.toString()],
    queryFn:  () => api.get(`/api/v1/academics/assessments?${params.toString()}`).then((r) => r.data),
  });

  const exams: any[] = examData?.data ?? [];
  const total: number = examData?.meta?.total ?? 0;

  // Mutations
  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/api/v1/academics/assessments/${id}/status`, { status }).then((r) => r.data),
    onSuccess: (res) => {
      if (!res.success) { toast.error(res.error); return; }
      qc.invalidateQueries({ queryKey: ["assessments"] });
      toast.success("Status updated");
    },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/academics/assessments/${id}`).then((r) => r.data),
    onSuccess: (res) => {
      if (!res.success) { toast.error(res.error); return; }
      qc.invalidateQueries({ queryKey: ["assessments"] });
      toast.success("Deleted");
    },
  });

  const openEdit = (exam: any) => {
    const np = exam.numPapers   ?? 1;
    const ns = exam.numSubjects ?? 1;
    // Reconstruct SubjectSlot[][] from ExamSubject records
    const ps: SubjectSlot[][] = resizePS([], np, ns);
    for (const es of exam.subjects ?? []) {
      const pi = (es.paperNum    ?? 1) - 1;
      const si = (es.subjectSlot ?? 1) - 1;
      if (ps[pi] && si < ps[pi].length) {
        ps[pi][si] = {
          subjectId: es.subjectId ?? "",
          topics:    es.topics ? es.topics.split(",").map((t: string) => t.trim()).filter(Boolean) : [],
          maxMarks:  es.maxMarks != null ? String(es.maxMarks) : "",
        };
      }
    }
    setEditTarget({
      id: exam.id,
      form: {
        academicYear:  exam.academicYear,
        name:          exam.name,
        numPapers:     np,
        numSubjects:   ns,
        batchIds:      exam.batches?.map((eb: any) => eb.batchId) ?? [],
        paperSubjects: ps,
        examDate:      exam.examDate?.split("T")[0] ?? "",
        startTime:     exam.startTime,
        endTime:       exam.endTime,
        totalMarks:    exam.totalMarks != null ? String(exam.totalMarks) : "",
        note:          exam.note ?? "",
      } satisfies ExamForm,
    });
    setModalOpen(true);
  };

  // Export CSV
  const exportCSV = () => {
    const header = ["Name", "Academic Year", "Batches", "Subject", "Date", "Start", "End", "Passing", "Total", "Status", "Topics"];
    const rows = exams.map((e) => [
      e.name, e.academicYear,
      e.batches?.map((eb: any) => eb.batch?.name).join(" | ") ?? "",
      e.subject?.name ?? "",
      fmtDate(e.examDate), e.startTime, e.endTime,
      e.passingMarks ?? "", e.totalMarks ?? "",
      e.status, e.topics ?? "",
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a"); a.href = url; a.download = "assessments.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const STATUS_TABS = ["ALL", "DUE", "MARKED", "COMPLETED", "CANCELLED", "ARCHIVED"] as const;
  const STATUS_COLORS: Record<string, string> = {
    ALL:       "bg-gray-100 text-gray-700 border-gray-200",
    DUE:       "bg-amber-50 text-amber-700 border-amber-200",
    MARKED:    "bg-indigo-50 text-indigo-700 border-indigo-200",
    COMPLETED: "bg-green-50 text-green-700 border-green-200",
    CANCELLED: "bg-red-50 text-red-600 border-red-200",
    ARCHIVED:  "bg-gray-100 text-gray-500 border-gray-200",
  };

  const filterPanel = (
    <div className="flex flex-col gap-5 p-4">

      <div>
        <Label>Search</Label>
        <div className="relative">
          <Input placeholder="Test name…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
          <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-300 pointer-events-none" />
        </div>
      </div>

      <div>
        <Label>Status</Label>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {STATUS_TABS.map((s) => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                filterStatus === s ? STATUS_COLORS[s] + " ring-1 ring-offset-1 ring-current" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
              }`}>
              {s === "ALL" ? "All" : STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label>Exam date range</Label>
        <div className="space-y-1.5">
          <Input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} />
          <Input type="date" value={filterDateTo}   onChange={(e) => setFilterDateTo(e.target.value)}   />
        </div>
      </div>

      <div>
        <Label>Academic Year</Label>
        <FSelect value={filterYear} onChange={(e) => { setFilterYear(e.target.value); setFilterBatch(""); }}>
          <option value="">All years</option>
          {years.map((y) => <option key={y.id} value={y.name}>{y.name}</option>)}
        </FSelect>
      </div>

      <div>
        <Label>Grade</Label>
        <FSelect value={filterGrade} onChange={(e) => { setFilterGrade(e.target.value); setFilterBatch(""); }}>
          <option value="">All grades</option>
          {grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </FSelect>
      </div>

      <div>
        <Label>Batch</Label>
        <FSelect value={filterBatch} onChange={(e) => setFilterBatch(e.target.value)}>
          <option value="">All batches</option>
          {batches
            .filter((b) => (!filterYear || b.academicYear === filterYear) && (!filterGrade || b.gradeId === filterGrade))
            .map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </FSelect>
      </div>

      <div>
        <Label>Subject</Label>
        <FSelect value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)}>
          <option value="">All subjects</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </FSelect>
      </div>

      {(search || filterStatus !== "ALL" || filterDateFrom || filterDateTo || filterBatch || filterGrade || filterSubject) && (
        <button onClick={() => { setSearch(""); setFilterStatus("ALL"); setFilterDateFrom(""); setFilterDateTo(""); setFilterBatch(""); setFilterGrade(""); setFilterSubject(""); }}
          className="w-full rounded-lg border border-gray-200 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50 transition-colors">
          Clear filters
        </button>
      )}
    </div>
  );

  return (
    <div className="flex h-full">

      {/* Mobile backdrop */}
      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setMobileFiltersOpen(false)} />
      )}

      {/* ── Stats panel (full-width when active) ────────────────────────────── */}
      {showStats && (
        <AssessmentStatsPanel
          batches={batches} grades={grades} subjects={subjects}
          academicYears={years} defaultYear={defaultYear}
        />
      )}

      {/* ── Left filter sidebar ───────────────────────────────────────────────── */}
      {!showStats && (
        <aside className={`
          shrink-0 border-r border-gray-100 bg-white overflow-y-auto
          md:relative md:w-52 md:flex md:flex-col md:h-full
          ${mobileFiltersOpen ? "fixed inset-y-0 left-0 z-40 w-64 shadow-xl h-full flex flex-col" : "hidden md:flex"}
        `}>
          <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-100 md:hidden shrink-0">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-indigo-500" />
              <span className="text-sm font-semibold text-gray-800">Filters</span>
            </div>
            <button onClick={() => setMobileFiltersOpen(false)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="hidden md:flex items-center gap-2 px-4 py-3.5 border-b border-gray-100 shrink-0">
            <SlidersHorizontal className="h-4 w-4 text-indigo-500 shrink-0" />
            <span className="text-sm font-semibold text-gray-800">Filters</span>
          </div>
          <div className="flex-1 overflow-y-auto">{filterPanel}</div>
        </aside>
      )}

      {/* ── Main content ──────────────────────────────────────────────────────── */}
      {!showStats && (<div className="flex-1 flex flex-col overflow-hidden">

        {/* Top bar */}
        <div className="shrink-0 bg-white border-b border-gray-100 px-4 sm:px-6 py-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button onClick={() => setMobileFiltersOpen(true)}
                className="md:hidden flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
                <Filter className="h-3.5 w-3.5" />
              </button>
              <div>
                <h1 className="text-base font-bold text-gray-900">Assessments</h1>
                {total > 0 && <p className="text-xs text-gray-400 mt-0.5">{total} test{total !== 1 ? "s" : ""}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!showStats && (
                <button onClick={exportCSV}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                  <Download className="h-3.5 w-3.5" /> Export
                </button>
              )}
              <button onClick={() => setShowStats((v) => !v)}
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                  showStats
                    ? "bg-violet-600 text-white border-violet-600 hover:bg-violet-700"
                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                }`}>
                <BarChart2 className="h-3.5 w-3.5" /> Stats
              </button>
              {!showStats && canEdit && (
                <button onClick={() => { setEditTarget(null); setModalOpen(true); }}
                  className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors">
                  <Plus className="h-3.5 w-3.5" /> New Test
                </button>
              )}
            </div>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-20 rounded-2xl bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : exams.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center px-8">
              <FileCheck2 className="h-10 w-10 text-gray-200 mb-3" />
              <p className="font-semibold text-gray-400">No assessments found</p>
              <p className="text-sm text-gray-300 mt-1">Adjust filters or create a new test</p>
            </div>
          ) : (
            <div className="m-4 sm:m-6 rounded-2xl border border-gray-100 bg-white shadow-sm">
              {exams.map((exam) => (
                <ExamCard key={exam.id} exam={exam} canEdit={canEdit}
                  onEdit={openEdit}
                  onDelete={(id) => { if (confirm("Delete this assessment?")) deleteMut.mutate(id); }}
                  onStatus={(id, status) => statusMut.mutate({ id, status })} />
              ))}
            </div>
          )}
        </div>
      </div>)}

      {/* Modal */}
      <ExamModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditTarget(null); }}
        initial={editTarget?.form}
        examId={editTarget?.id}
        batches={batches}
        subjects={subjects}
        academicYears={years}
        defaultYear={defaultYear}
      />
    </div>
  );
}
