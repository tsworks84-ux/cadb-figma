"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  Plus, X, BookOpen, User, Calendar, ChevronDown, Filter,
  Download, SlidersHorizontal, Loader2, Pencil, Trash2,
  Paperclip, CheckCircle2, Archive, Clock, RotateCcw, BarChart2,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ComposedChart, Area, PieChart, Pie, Cell,
} from "recharts";
import { useAuthStore } from "@/store/auth";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";

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

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    DUE:       "bg-amber-50 text-amber-700 border border-amber-200",
    COMPLETED: "bg-green-50 text-green-700 border border-green-200",
    ARCHIVED:  "bg-gray-100 text-gray-500 border border-gray-200",
  };
  const label: Record<string, string> = {
    DUE: "Due", COMPLETED: "Completed", ARCHIVED: "Archived",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${map[status] ?? "bg-gray-100 text-gray-600"}`}>
      {label[status] ?? status}
    </span>
  );
}

// ── Date helpers ───────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  try { return format(parseISO(iso), "dd MMM yyyy"); } catch { return iso; }
}
function todayStr() {
  return new Date().toISOString().split("T")[0];
}

// ── Topic tags input ──────────────────────────────────────────────────────────

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
        <Input placeholder="Type a topic and click Add…" value={input}
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
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
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

// ── Assignment modal ──────────────────────────────────────────────────────────

type AssignmentForm = {
  academicYear: string; name: string; assignmentDate: string; submissionDate: string;
  batchIds: string[]; subjectId: string; employeeId: string;
  topics: string[]; note: string;
};

function AssignmentModal({
  open, onClose, initial, assignmentId,
  batches, subjects, employees, academicYears, defaultYear,
}: {
  open: boolean; onClose: () => void; initial?: AssignmentForm; assignmentId?: string;
  batches: any[]; subjects: any[]; employees: any[]; academicYears: any[]; defaultYear: string;
}) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const emptyForm = (): AssignmentForm => ({
    academicYear: defaultYear, name: "", assignmentDate: todayStr(),
    submissionDate: "", batchIds: [], subjectId: "", employeeId: "", topics: [], note: "",
  });

  const [form, setForm]         = useState<AssignmentForm>(initial ?? emptyForm());
  const [file, setFile]         = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (open) { setForm(initial ?? emptyForm()); setFile(null); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const filteredBatches = form.academicYear
    ? batches.filter((b) => b.academicYear === form.academicYear)
    : batches;

  const submissionError = Boolean(
    form.assignmentDate && form.submissionDate &&
    new Date(form.submissionDate) < new Date(form.assignmentDate)
  );

  const createMut = useMutation({
    mutationFn: (d: any) => api.post("/api/v1/academics/assignments", d).then((r) => r.data),
    onSuccess: async (res) => {
      if (!res.success) { toast.error(res.error); return; }
      if (file && res.data?.id) {
        setUploading(true);
        try {
          const fd = new FormData(); fd.append("file", file);
          await api.post(`/api/v1/academics/assignments/${res.data.id}/attachment`, fd, {
            headers: { "Content-Type": "multipart/form-data" },
          });
        } catch { toast.error("Assignment saved but attachment upload failed"); }
        setUploading(false);
      }
      qc.invalidateQueries({ queryKey: ["assignments"] });
      toast.success("Assignment created");
    },
  });
  const updateMut = useMutation({
    mutationFn: (d: any) => api.patch(`/api/v1/academics/assignments/${assignmentId}`, d).then((r) => r.data),
    onSuccess: async (res) => {
      if (!res.success) { toast.error(res.error); return; }
      if (file && assignmentId) {
        setUploading(true);
        try {
          const fd = new FormData(); fd.append("file", file);
          await api.post(`/api/v1/academics/assignments/${assignmentId}/attachment`, fd, {
            headers: { "Content-Type": "multipart/form-data" },
          });
        } catch { toast.error("Saved but attachment upload failed"); }
        setUploading(false);
      }
      qc.invalidateQueries({ queryKey: ["assignments"] });
      toast.success("Assignment updated");
      onClose();
    },
  });
  const busy = createMut.isPending || updateMut.isPending || uploading;

  const buildPayload = () => {
    if (!form.academicYear)          { toast.error("Academic year is required");   return null; }
    if (!form.name.trim())           { toast.error("Assignment name is required"); return null; }
    if (!form.assignmentDate)        { toast.error("Assignment date is required"); return null; }
    if (!form.submissionDate)        { toast.error("Submission date is required"); return null; }
    if (submissionError)             { toast.error("Submission date can't be before assignment date"); return null; }
    if (form.batchIds.length === 0)  { toast.error("Select at least one batch");   return null; }
    if (!form.subjectId)             { toast.error("Subject is required");         return null; }
    if (!form.employeeId)            { toast.error("Faculty is required");         return null; }
    return {
      academicYear:   form.academicYear,
      name:           form.name.trim(),
      assignmentDate: new Date(form.assignmentDate).toISOString(),
      submissionDate: new Date(form.submissionDate).toISOString(),
      batchIds:       form.batchIds,
      subjectId:      form.subjectId  || null,
      employeeId:     form.employeeId || null,
      topics:         form.topics.length > 0 ? form.topics.join(", ") : null,
      note:           form.note.trim() || null,
    };
  };

  const handleSave = () => {
    const p = buildPayload(); if (!p) return;
    if (assignmentId) updateMut.mutate(p);
    else createMut.mutate(p, { onSuccess: (res) => { if (res.success) onClose(); } });
  };
  const handleSaveAnother = () => {
    const p = buildPayload(); if (!p) return;
    createMut.mutate(p, {
      onSuccess: (res) => {
        if (res.success) setForm({ ...emptyForm(), academicYear: form.academicYear, assignmentDate: form.assignmentDate });
      },
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-100 rounded-lg"><BookOpen className="h-4 w-4 text-indigo-600" /></div>
            <h2 className="text-base font-semibold text-gray-900">
              {assignmentId ? "Edit Assignment" : "New Assignment"}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-400"><X className="h-4 w-4" /></button>
        </div>

        <div className="px-6 py-5 space-y-4">

          {/* Academic Year */}
          <div>
            <Label>Academic Year <span className="text-red-400">*</span></Label>
            <FSelect value={form.academicYear} onChange={(e) => setForm({ ...form, academicYear: e.target.value, batchIds: [] })}>
              <option value="">Select academic year</option>
              {academicYears.filter((y) => !y.isArchived).map((y) => <option key={y.id} value={y.name}>{y.name}</option>)}
            </FSelect>
          </div>

          {/* Assignment Name */}
          <div>
            <Label>Assignment Name <span className="text-red-400">*</span></Label>
            <Input placeholder="e.g. Assignment on Calculus" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Assignment Date <span className="text-red-400">*</span></Label>
              <Input type="date" value={form.assignmentDate}
                onChange={(e) => setForm({ ...form, assignmentDate: e.target.value })} />
            </div>
            <div>
              <Label>Submission Date <span className="text-red-400">*</span></Label>
              <input type="date" value={form.submissionDate}
                onChange={(e) => setForm({ ...form, submissionDate: e.target.value })}
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${submissionError ? "border-red-400 focus:border-red-400 focus:ring-red-300 bg-red-50" : "border-gray-200 focus:border-indigo-500 focus:ring-indigo-500"}`}
              />
              {submissionError && <p className="text-xs text-red-500 mt-1">Can't be before assignment date</p>}
            </div>
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

          {/* Subject + Faculty */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Subject <span className="text-red-400">*</span></Label>
              <FSelect value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })}>
                <option value="">Select subject</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </FSelect>
            </div>
            <div>
              <Label>Faculty <span className="text-red-400">*</span></Label>
              <FSelect value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}>
                <option value="">Select faculty</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
              </FSelect>
            </div>
          </div>

          {/* Topics */}
          <div>
            <Label>Topics</Label>
            <TopicsInput topics={form.topics} onChange={(t) => setForm({ ...form, topics: t })} />
          </div>

          {/* Attachment */}
          <div>
            <Label>Attachment</Label>
            <div className="flex items-center gap-3">
              <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.ppt,.pptx,.xls,.xlsx"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="hidden" />
              <button type="button" onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                <Paperclip className="h-3.5 w-3.5" /> Choose file
              </button>
              {file
                ? <span className="text-xs text-indigo-700 truncate max-w-[200px]">{file.name}</span>
                : initial && (initial as any).attachmentName
                  ? <span className="text-xs text-gray-500">{(initial as any).attachmentName} (keep or replace)</span>
                  : <span className="text-xs text-gray-400">No file chosen</span>}
            </div>
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
            {!assignmentId && (
              <button onClick={handleSaveAnother} disabled={busy || submissionError}
                className="px-4 py-2 text-sm text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors disabled:opacity-50">
                Save & Add Another
              </button>
            )}
            <button onClick={handleSave} disabled={busy || submissionError}
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50">
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {assignmentId ? "Save Changes" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Assignment card ───────────────────────────────────────────────────────────

function AssignmentCard({
  a, canEdit, onEdit, onDelete, onStatus,
}: {
  a: any; canEdit: boolean;
  onEdit: (a: any) => void;
  onDelete: (id: string) => void;
  onStatus: (id: string, status: string) => void;
}) {
  const router  = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [menuOpen]);

  const batchNames = a.batches?.map((ab: any) => ab.batch?.name).filter(Boolean).join(", ") ?? "—";

  return (
    <div className="group flex items-start gap-3 px-4 py-3.5 border-b border-gray-100 last:border-0 hover:bg-gray-50/60 transition-colors first:rounded-t-2xl last:rounded-b-2xl">
      {/* Status badge */}
      <div className="shrink-0 mt-0.5"><StatusBadge status={a.status} /></div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <button onClick={() => router.push(`/dashboard/academics/assignments/${a.id}`)}
          className="text-sm font-semibold text-indigo-700 hover:text-indigo-900 hover:underline truncate text-left">
          {a.name}
        </button>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-gray-500">
          {a.subject && (
            <span className="flex items-center gap-1">
              <BookOpen className="h-3 w-3 shrink-0" />{a.subject.name}
            </span>
          )}
          <span className="flex items-center gap-1">
            <User className="h-3 w-3 shrink-0 text-gray-400" />
            {batchNames}
          </span>
          {a.employee && (
            <span className="flex items-center gap-1 text-gray-400">
              <User className="h-3 w-3 shrink-0" />
              {a.employee.firstName} {a.employee.lastName}
            </span>
          )}
          {a.attachmentUrl && (
            <a href={a.attachmentUrl} target="_blank" rel="noreferrer"
              className="flex items-center gap-1 text-indigo-600 hover:underline">
              <Paperclip className="h-3 w-3 shrink-0" />
              {a.attachmentName ?? "Attachment"}
            </a>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-400">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            Given: {fmtDate(a.assignmentDate)}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Due: {fmtDate(a.submissionDate)}
          </span>
        </div>
        {a.topics && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {a.topics.split(",").map((t: string) => t.trim()).filter(Boolean).map((t: string) => (
              <span key={t} className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">{t}</span>
            ))}
          </div>
        )}
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
            <div className="absolute right-0 top-8 z-30 w-44 rounded-xl border border-gray-100 bg-white shadow-xl py-1">
              <button onClick={() => { onEdit(a); setMenuOpen(false); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50">
                <Pencil className="h-3.5 w-3.5 text-gray-400" /> Edit
              </button>
              {a.status !== "COMPLETED" && (
                <button onClick={() => { onStatus(a.id, "COMPLETED"); setMenuOpen(false); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-green-700 hover:bg-green-50">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Mark Completed
                </button>
              )}
              {a.status !== "DUE" && (
                <button onClick={() => { onStatus(a.id, "DUE"); setMenuOpen(false); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-amber-700 hover:bg-amber-50">
                  <RotateCcw className="h-3.5 w-3.5" /> Mark Due
                </button>
              )}
              {a.status !== "ARCHIVED" && (
                <button onClick={() => { onStatus(a.id, "ARCHIVED"); setMenuOpen(false); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-600 hover:bg-gray-50">
                  <Archive className="h-3.5 w-3.5" /> Archive
                </button>
              )}
              <div className="my-1 border-t border-gray-100" />
              <button onClick={() => { onDelete(a.id); setMenuOpen(false); }}
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

// ── Stats helpers ─────────────────────────────────────────────────────────────

const CHART_COLORS = ["#6366f1","#8b5cf6","#ec4899","#14b8a6","#f59e0b","#10b981","#3b82f6","#f97316","#a855f7","#06b6d4"];

function SummaryCard({ label, value, sub, color }: { label: string; value: string | number; sub: string; color: "indigo"|"violet"|"green"|"amber" }) {
  const c = {
    indigo: { wrap: "border-indigo-100 bg-indigo-50", val: "text-indigo-700", sub: "text-indigo-400" },
    violet: { wrap: "border-violet-100 bg-violet-50", val: "text-violet-700", sub: "text-violet-400" },
    green:  { wrap: "border-green-100 bg-green-50",   val: "text-green-700",  sub: "text-green-400"  },
    amber:  { wrap: "border-amber-100 bg-amber-50",   val: "text-amber-700",  sub: "text-amber-400"  },
  }[color];
  return (
    <div className={`rounded-xl border p-4 ${c.wrap}`}>
      <p className="text-xs font-medium text-gray-500 mb-0.5">{label}</p>
      <p className={`text-2xl font-bold ${c.val}`}>{value}</p>
      <p className={`text-xs mt-0.5 ${c.sub}`}>{sub}</p>
    </div>
  );
}

function EmptyChart() {
  return <div className="flex items-center justify-center h-28 text-gray-300"><p className="text-sm">No data</p></div>;
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-3 text-xs min-w-[140px]">
      <p className="font-semibold text-gray-700 mb-1.5">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2 mb-0.5">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: p.color ?? p.fill }} />
          <span className="text-gray-500">{p.name}:</span>
          <span className="font-medium text-gray-800">{typeof p.value === "number" ? (String(p.value).includes(".") ? p.value.toFixed(1) : p.value) : p.value}</span>
        </div>
      ))}
    </div>
  );
}

function NSelector({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(Number(e.target.value))}
      className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs focus:outline-none focus:border-indigo-500">
      {[5, 10, 15, 20].map((n) => <option key={n} value={n}>Top {n}</option>)}
    </select>
  );
}

function StatsPanel({
  assignments, submissionStats, subjects,
}: {
  assignments: any[];
  submissionStats: { studentStats: any[]; batchStats: any[]; cityStats: any[]; weeklySubmissions: any[] } | null;
  subjects: any[];
}) {
  const [topN,    setTopN]    = useState(10);
  const [bottomN, setBottomN] = useState(10);
  const [trendSubject, setTrendSubject] = useState("");

  const studentStats      = submissionStats?.studentStats      ?? [];
  const batchStats        = submissionStats?.batchStats        ?? [];
  const cityStats         = submissionStats?.cityStats         ?? [];
  const weeklySubmissions = submissionStats?.weeklySubmissions ?? [];

  // ── 1. Assignments per subject ─────────────────────────────────────────────
  const subjectMap = new Map<string, { name: string; count: number }>();
  for (const a of assignments) {
    const key  = a.subjectId ?? "__none__";
    const name = a.subject?.name ?? "No Subject";
    if (!subjectMap.has(key)) subjectMap.set(key, { name, count: 0 });
    subjectMap.get(key)!.count++;
  }
  const subjectStats = [...subjectMap.values()].sort((a, b) => b.count - a.count);

  // ── 2. Faculty assignment giving ───────────────────────────────────────────
  const facultyMap = new Map<string, { name: string; count: number }>();
  for (const a of assignments) {
    if (!a.employee) continue;
    const k = a.employeeId;
    if (!facultyMap.has(k)) facultyMap.set(k, { name: `${a.employee.firstName} ${a.employee.lastName}`, count: 0 });
    facultyMap.get(k)!.count++;
  }
  const facultyStats = [...facultyMap.values()].sort((a, b) => b.count - a.count);

  // ── 3. Weekly trend (merge giving + submissions) ───────────────────────────
  const weekGivingMap = new Map<string, { week: string; label: string; given: number; submitted: number }>();
  for (const a of assignments) {
    if (trendSubject && a.subjectId !== trendSubject) continue;
    const d   = new Date(a.assignmentDate);
    const day = d.getDay();
    d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
    const key = d.toISOString().split("T")[0];
    const lbl = `${d.getDate()}/${d.getMonth() + 1}`;
    if (!weekGivingMap.has(key)) weekGivingMap.set(key, { week: key, label: lbl, given: 0, submitted: 0 });
    weekGivingMap.get(key)!.given++;
  }
  for (const ws of weeklySubmissions) {
    if (weekGivingMap.has(ws.week)) weekGivingMap.get(ws.week)!.submitted = ws.submitted;
    else weekGivingMap.set(ws.week, { week: ws.week, label: ws.label, given: 0, submitted: ws.submitted });
  }
  const weeklyTrend = [...weekGivingMap.values()].sort((a, b) => a.week.localeCompare(b.week));

  // ── 4. Summary numbers ─────────────────────────────────────────────────────
  const totalGiven     = assignments.length;
  const totalSubmitted = studentStats.reduce((s, x) => s + x.submitted, 0);
  const grandTotal     = studentStats.reduce((s, x) => s + x.total, 0);
  const totalWeeks     = weeklyTrend.length || 1;
  const avgWeeklyGiving     = (totalGiven / totalWeeks).toFixed(1);
  const avgWeeklySubmission = (totalSubmitted / totalWeeks).toFixed(1);
  const overallRate         = grandTotal > 0 ? Math.round((totalSubmitted / grandTotal) * 100) : 0;

  // ── 5. Top/bottom students ─────────────────────────────────────────────────
  const sortedStudents = [...studentStats]
    .filter((s) => s.total > 0)
    .map((s) => ({ ...s, rate: Math.round((s.submitted / s.total) * 100) }))
    .sort((a, b) => b.rate - a.rate || b.submitted - a.submitted);

  const topStudents    = sortedStudents.slice(0, topN);
  const bottomStudents = [...sortedStudents].sort((a, b) => a.rate - b.rate || a.submitted - b.submitted).slice(0, bottomN);

  if (totalGiven === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center p-8">
        <BarChart2 className="h-10 w-10 text-gray-200 mb-3" />
        <p className="font-semibold text-gray-400">No data for current filters</p>
        <p className="text-sm text-gray-300 mt-1">Adjust the sidebar filters to see analytics</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-5 overflow-y-auto">

      {/* ── Summary cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard label="Assignments Given"    value={totalGiven}           sub="total across filters"             color="indigo" />
        <SummaryCard label="Submissions Received" value={totalSubmitted}       sub={`of ${grandTotal} expected`}      color="green"  />
        <SummaryCard label="Submission Rate"      value={`${overallRate}%`}    sub="across all students"              color="violet" />
        <SummaryCard label="Avg Weekly Giving"    value={`${avgWeeklyGiving}`} sub={`${avgWeeklySubmission}/wk received`} color="amber" />
      </div>

      {/* ── Row: Subject breakdown + Status donut ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Assignments per subject */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-sm font-semibold text-gray-800">Assignments per Subject</p>
          <p className="text-xs text-gray-400 mb-4">Total assignments given, grouped by subject</p>
          {subjectStats.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={Math.max(180, subjectStats.length * 46 + 48)}>
              <BarChart data={subjectStats} layout="vertical" margin={{ left: 0, right: 24, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 12, fill: "#475569" }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" name="Assignments" fill="#6366f1" radius={[0, 4, 4, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Batch submission rate donut */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-sm font-semibold text-gray-800">Submission Rate by Batch</p>
          <p className="text-xs text-gray-400 mb-3">% submitted per batch</p>
          {batchStats.length === 0 ? <EmptyChart /> : (
            <div className="space-y-2 mt-2">
              {batchStats.slice(0, 8).map((b, i) => {
                const rate = b.total > 0 ? Math.round((b.submitted / b.total) * 100) : 0;
                return (
                  <div key={b.id}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-gray-600 font-medium truncate max-w-[140px]">{b.name}</span>
                      <span className="text-gray-500 shrink-0 ml-2">{rate}% <span className="text-gray-300">({b.submitted}/{b.total})</span></span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-gray-100">
                      <div className="h-1.5 rounded-full transition-all" style={{ width: `${rate}%`, background: CHART_COLORS[i % CHART_COLORS.length] }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Weekly trend ─────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <p className="text-sm font-semibold text-gray-800">Weekly Trend</p>
            <p className="text-xs text-gray-400">Assignments given (bars) vs submissions received (line) per week</p>
          </div>
          <FSelect value={trendSubject} onChange={(e) => setTrendSubject(e.target.value)} className="!w-auto text-xs !py-1.5">
            <option value="">All Subjects</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </FSelect>
        </div>
        {weeklyTrend.length === 0 ? <EmptyChart /> : (
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={weeklyTrend} margin={{ left: 0, right: 24, top: 4, bottom: 4 }}>
              <defs>
                <linearGradient id="subGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#10b981" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="l" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              <Bar  yAxisId="l" dataKey="given"     name="Given"     fill="#6366f1"           radius={[4, 4, 0, 0]} maxBarSize={36} />
              <Area yAxisId="r" dataKey="submitted" name="Submitted" stroke="#10b981" fill="url(#subGrad)" strokeWidth={2.5} dot={{ r: 3.5, fill: "#10b981", strokeWidth: 0 }} type="monotone" />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Faculty assignment giving ─────────────────────────────────────────── */}
      {facultyStats.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-semibold text-gray-800">Faculty Assignment Giving</p>
            <NSelector value={topN} onChange={setTopN} />
          </div>
          <p className="text-xs text-gray-400 mb-4">Number of assignments given per faculty member</p>
          <ResponsiveContainer width="100%" height={Math.max(180, Math.min(facultyStats.length, topN) * 46 + 48)}>
            <BarChart data={facultyStats.slice(0, topN)} layout="vertical" margin={{ left: 0, right: 24, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
              <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 12, fill: "#475569" }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="count" name="Assignments Given" fill="#8b5cf6" radius={[0, 4, 4, 0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── City submission rate ──────────────────────────────────────────────── */}
      {cityStats.length > 1 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-sm font-semibold text-gray-800">Submission Rate by City</p>
          <p className="text-xs text-gray-400 mb-4">Aggregate submission performance across cities</p>
          <ResponsiveContainer width="100%" height={Math.max(160, cityStats.length * 56 + 48)}>
            <BarChart data={cityStats.map((c) => ({ ...c, rate: c.total > 0 ? parseFloat(((c.submitted / c.total) * 100).toFixed(1)) : 0 }))}
              layout="vertical" margin={{ left: 0, right: 48, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
              <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12, fill: "#475569" }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} formatter={(v: any) => [`${v}%`, "Submission Rate"]} />
              <Bar dataKey="rate" name="Submission Rate %" fill="#14b8a6" radius={[0, 4, 4, 0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Top students (performers) ─────────────────────────────────────────── */}
      {topStudents.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-semibold text-gray-800">Top Performers — Students</p>
            <NSelector value={topN} onChange={setTopN} />
          </div>
          <p className="text-xs text-gray-400 mb-4">Students with highest assignment submission rate</p>
          <div className="space-y-1.5">
            {topStudents.map((s, i) => (
              <div key={s.id} className="flex items-center gap-3">
                <span className="shrink-0 w-6 text-center text-xs font-bold text-gray-300">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-medium text-gray-700 truncate max-w-[200px]">{s.name}</span>
                    <span className="text-xs text-gray-500 shrink-0 ml-2">{s.submitted}/{s.total} <span className="font-semibold text-green-600">({s.rate}%)</span></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-gray-100">
                      <div className="h-1.5 rounded-full bg-green-500 transition-all" style={{ width: `${s.rate}%` }} />
                    </div>
                    <span className="text-[10px] text-gray-400 shrink-0">{s.batchName}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Bottom students (poor performers) ────────────────────────────────── */}
      {bottomStudents.length > 0 && (
        <div className="bg-white rounded-xl border border-red-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-semibold text-gray-800">Poor Performers — Students</p>
            <select value={bottomN} onChange={(e) => setBottomN(Number(e.target.value))}
              className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs focus:outline-none focus:border-indigo-500">
              {[5, 10, 15, 20].map((n) => <option key={n} value={n}>Bottom {n}</option>)}
            </select>
          </div>
          <p className="text-xs text-gray-400 mb-4">Students with lowest assignment submission rate</p>
          <div className="space-y-1.5">
            {bottomStudents.map((s, i) => (
              <div key={s.id} className="flex items-center gap-3">
                <span className="shrink-0 w-6 text-center text-xs font-bold text-gray-300">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-medium text-gray-700 truncate max-w-[200px]">{s.name}</span>
                    <span className="text-xs text-gray-500 shrink-0 ml-2">{s.submitted}/{s.total} <span className="font-semibold text-red-500">({s.rate}%)</span></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-gray-100">
                      <div className="h-1.5 rounded-full bg-red-400 transition-all" style={{ width: `${s.rate}%` }} />
                    </div>
                    <span className="text-[10px] text-gray-400 shrink-0">{s.batchName}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AssignmentsPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const canEdit = user?.role === "SUPER_ADMIN" || user?.role === "HR_ADMIN";

  // Filter state
  const [search,         setSearch]         = useState("");
  const [filterStatus,   setFilterStatus]   = useState("ALL");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo,   setFilterDateTo]   = useState("");
  const [filterYear,     setFilterYear]     = useState("");
  const [filterBatch,    setFilterBatch]    = useState("");
  const [filterGrade,    setFilterGrade]    = useState("");
  const [filterSubject,  setFilterSubject]  = useState("");
  const [filterFaculty,  setFilterFaculty]  = useState("");

  // UI state
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [modalOpen,          setModalOpen]          = useState(false);
  const [editTarget,         setEditTarget]          = useState<any | null>(null);
  const [showStats,          setShowStats]          = useState(false);

  // Reference data
  const { data: yearsData }    = useQuery({ queryKey: ["academic-years"],   queryFn: () => api.get("/api/v1/academics/academic-years").then((r) => r.data.data) });
  const { data: gradesData }   = useQuery({ queryKey: ["grades"],           queryFn: () => api.get("/api/v1/academics/grades").then((r) => r.data) });
  const { data: subjectsData } = useQuery({ queryKey: ["subjects"],         queryFn: () => api.get("/api/v1/academics/subjects").then((r) => r.data) });
  const { data: batchesData }  = useQuery({ queryKey: ["batches-all"],      queryFn: () => api.get("/api/v1/academics/batches").then((r) => r.data) });
  const { data: empData }      = useQuery({ queryKey: ["employees-select"], queryFn: () => api.get("/api/v1/employees?limit=500").then((r) => r.data) });

  const years     = (yearsData    ?? []) as any[];
  const grades    = (gradesData?.data   ?? []) as any[];
  const subjects  = (subjectsData?.data ?? []) as any[];
  const batches   = (batchesData?.data  ?? []) as any[];
  const employees = (empData?.data      ?? []) as any[];

  // Auto-set filter to active AY
  useEffect(() => {
    if (filterYear || years.length === 0) return;
    const active = years.find((y) => y.isActive && !y.isArchived) ?? years.find((y) => !y.isArchived);
    if (active) setFilterYear(active.name);
  }, [years]); // eslint-disable-line react-hooks/exhaustive-deps

  const defaultYear = years.find((y) => y.isActive && !y.isArchived)?.name ?? years.find((y) => !y.isArchived)?.name ?? "";

  // Query params
  const params = new URLSearchParams();
  if (search)              params.set("search",       search);
  if (filterStatus !== "ALL") params.set("status",    filterStatus);
  if (filterDateFrom)      params.set("dateFrom",     filterDateFrom);
  if (filterDateTo)        params.set("dateTo",       filterDateTo);
  if (filterYear)          params.set("academicYear", filterYear);
  if (filterBatch)         params.set("batchId",      filterBatch);
  if (filterGrade)         params.set("gradeId",      filterGrade);
  if (filterSubject)       params.set("subjectId",    filterSubject);
  if (filterFaculty)       params.set("employeeId",   filterFaculty);
  params.set("limit", "200");

  const { data: assignmentData, isLoading } = useQuery({
    queryKey: ["assignments", params.toString()],
    queryFn:  () => api.get(`/api/v1/academics/assignments?${params.toString()}`).then((r) => r.data),
  });

  const assignments: any[] = assignmentData?.data ?? [];
  const total: number      = assignmentData?.meta?.total ?? 0;

  // Stats queries — skip status filter, raise limit for aggregation
  const statsParams = new URLSearchParams(params);
  statsParams.delete("status");
  statsParams.set("limit", "2000");

  const { data: statsData } = useQuery({
    queryKey: ["assignments-stats-list", statsParams.toString()],
    queryFn:  () => api.get(`/api/v1/academics/assignments?${statsParams.toString()}`).then((r) => r.data),
    enabled: showStats,
  });
  const { data: statsSubData } = useQuery({
    queryKey: ["assignments-stats-sub", statsParams.toString()],
    queryFn:  () => api.get(`/api/v1/academics/assignments/stats?${statsParams.toString()}`).then((r) => r.data),
    enabled: showStats,
  });

  // Mutations
  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/api/v1/academics/assignments/${id}/status`, { status }).then((r) => r.data),
    onSuccess: (res) => {
      if (!res.success) { toast.error(res.error); return; }
      qc.invalidateQueries({ queryKey: ["assignments"] });
      toast.success("Status updated");
    },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/academics/assignments/${id}`).then((r) => r.data),
    onSuccess: (res) => {
      if (!res.success) { toast.error(res.error); return; }
      qc.invalidateQueries({ queryKey: ["assignments"] });
      toast.success("Deleted");
    },
  });

  const openEdit = (a: any) => {
    setEditTarget({
      id: a.id,
      form: {
        academicYear:   a.academicYear,
        name:           a.name,
        assignmentDate: a.assignmentDate?.split("T")[0] ?? "",
        submissionDate: a.submissionDate?.split("T")[0] ?? "",
        batchIds:       a.batches?.map((ab: any) => ab.batchId) ?? [],
        subjectId:      a.subjectId  ?? "",
        employeeId:     a.employeeId ?? "",
        topics:         a.topics ? a.topics.split(",").map((t: string) => t.trim()).filter(Boolean) : [],
        note:           a.note ?? "",
        attachmentName: a.attachmentName,
        attachmentUrl:  a.attachmentUrl,
      },
    });
    setModalOpen(true);
  };

  // Export CSV
  const exportCSV = () => {
    const header = ["Name", "Academic Year", "Batches", "Subject", "Faculty", "Assigned", "Due", "Status", "Topics"];
    const rows = assignments.map((a) => [
      a.name,
      a.academicYear,
      a.batches?.map((ab: any) => ab.batch?.name).join(" | ") ?? "",
      a.subject?.name ?? "",
      a.employee ? `${a.employee.firstName} ${a.employee.lastName}` : "",
      fmtDate(a.assignmentDate),
      fmtDate(a.submissionDate),
      a.status,
      a.topics ?? "",
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a"); a.href = url; a.download = "assignments.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  // Filter panels (shared desktop/mobile)
  const STATUS_TABS = ["ALL", "DUE", "COMPLETED", "ARCHIVED"] as const;
  const STATUS_COLORS: Record<string, string> = {
    ALL:       "bg-gray-100 text-gray-700 border-gray-200",
    DUE:       "bg-amber-50 text-amber-700 border-amber-200",
    COMPLETED: "bg-green-50 text-green-700 border-green-200",
    ARCHIVED:  "bg-gray-100 text-gray-500 border-gray-200",
  };

  const filterPanel = (
    <div className="flex flex-col gap-5 p-4">

      {/* Search */}
      <div>
        <Label>Search</Label>
        <div className="relative">
          <Input placeholder="Assignment name…" value={search} onChange={(e) => setSearch(e.target.value)}
            className="pl-8" />
          <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-300 pointer-events-none" />
        </div>
      </div>

      {/* Status */}
      <div>
        <Label>Status</Label>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {STATUS_TABS.map((s) => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                filterStatus === s ? STATUS_COLORS[s] + " ring-1 ring-offset-1 ring-current" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
              }`}>
              {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Due date range */}
      <div>
        <Label>Due date range</Label>
        <div className="space-y-1.5">
          <Input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} />
          <Input type="date" value={filterDateTo}   onChange={(e) => setFilterDateTo(e.target.value)}   />
        </div>
      </div>

      {/* Academic Year */}
      <div>
        <Label>Academic Year</Label>
        <FSelect value={filterYear} onChange={(e) => { setFilterYear(e.target.value); setFilterBatch(""); }}>
          <option value="">All years</option>
          {years.map((y) => <option key={y.id} value={y.name}>{y.name}</option>)}
        </FSelect>
      </div>

      {/* Grade */}
      <div>
        <Label>Grade</Label>
        <FSelect value={filterGrade} onChange={(e) => { setFilterGrade(e.target.value); setFilterBatch(""); }}>
          <option value="">All grades</option>
          {grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </FSelect>
      </div>

      {/* Batch */}
      <div>
        <Label>Batch</Label>
        <FSelect value={filterBatch} onChange={(e) => setFilterBatch(e.target.value)}>
          <option value="">All batches</option>
          {batches
            .filter((b) => (!filterYear || b.academicYear === filterYear) && (!filterGrade || b.gradeId === filterGrade))
            .map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </FSelect>
      </div>

      {/* Subject */}
      <div>
        <Label>Subject</Label>
        <FSelect value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)}>
          <option value="">All subjects</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </FSelect>
      </div>

      {/* Faculty */}
      <div>
        <Label>Faculty</Label>
        <FSelect value={filterFaculty} onChange={(e) => setFilterFaculty(e.target.value)}>
          <option value="">All faculty</option>
          {employees.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
        </FSelect>
      </div>

      {/* Clear */}
      {(search || filterStatus !== "ALL" || filterDateFrom || filterDateTo || filterBatch || filterGrade || filterSubject || filterFaculty) && (
        <button onClick={() => { setSearch(""); setFilterStatus("ALL"); setFilterDateFrom(""); setFilterDateTo(""); setFilterBatch(""); setFilterGrade(""); setFilterSubject(""); setFilterFaculty(""); }}
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

      {/* ── Left filter sidebar ──────────────────────────────────────────────── */}
      <aside className={`
        shrink-0 border-r border-gray-100 bg-white overflow-y-auto
        md:relative md:w-52 md:flex md:flex-col md:h-full
        ${mobileFiltersOpen ? "fixed inset-y-0 left-0 z-40 w-64 shadow-xl h-full flex flex-col" : "hidden md:flex"}
      `}>
        {/* Mobile header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-100 md:hidden shrink-0">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-indigo-500" />
            <span className="text-sm font-semibold text-gray-800">Filters</span>
          </div>
          <button onClick={() => setMobileFiltersOpen(false)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        {/* Desktop header */}
        <div className="hidden md:flex items-center gap-2 px-4 py-3.5 border-b border-gray-100 shrink-0">
          <SlidersHorizontal className="h-4 w-4 text-indigo-500 shrink-0" />
          <span className="text-sm font-semibold text-gray-800">Filters</span>
        </div>
        <div className="flex-1 overflow-y-auto">{filterPanel}</div>
      </aside>

      {/* ── Main content ──────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top bar */}
        <div className="shrink-0 bg-white border-b border-gray-100 px-4 sm:px-6 py-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {/* Mobile filter toggle */}
              <button onClick={() => setMobileFiltersOpen(true)}
                className="md:hidden flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
                <Filter className="h-3.5 w-3.5" />
              </button>
              <div>
                <h1 className="text-base font-bold text-gray-900">Assignments</h1>
                {total > 0 && <p className="text-xs text-gray-400 mt-0.5">{total} assignment{total !== 1 ? "s" : ""}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowStats((v) => !v)}
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  showStats
                    ? "bg-violet-600 text-white border-violet-600 hover:bg-violet-700"
                    : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                }`}>
                <BarChart2 className="h-3.5 w-3.5" /> Stats
              </button>
              {!showStats && (
                <button onClick={exportCSV}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                  <Download className="h-3.5 w-3.5" /> Export
                </button>
              )}
              {canEdit && !showStats && (
                <button onClick={() => { setEditTarget(null); setModalOpen(true); }}
                  className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors">
                  <Plus className="h-3.5 w-3.5" /> New Assignment
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Content: stats panel or assignment list */}
        <div className="flex-1 overflow-y-auto">
          {showStats ? (
            <StatsPanel
              assignments={statsData?.data ?? []}
              submissionStats={statsSubData?.data ?? null}
              subjects={subjects}
            />
          ) : isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-20 rounded-2xl bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : assignments.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center px-8">
              <BookOpen className="h-10 w-10 text-gray-200 mb-3" />
              <p className="font-semibold text-gray-400">No assignments found</p>
              <p className="text-sm text-gray-300 mt-1">Adjust filters or create a new assignment</p>
            </div>
          ) : (
            <div className="m-4 sm:m-6 rounded-2xl border border-gray-100 bg-white shadow-sm">
              {assignments.map((a) => (
                <AssignmentCard key={a.id} a={a} canEdit={canEdit}
                  onEdit={openEdit}
                  onDelete={(id) => { if (confirm("Delete this assignment?")) deleteMut.mutate(id); }}
                  onStatus={(id, status) => statusMut.mutate({ id, status })} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      <AssignmentModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditTarget(null); }}
        initial={editTarget?.form}
        assignmentId={editTarget?.id}
        batches={batches}
        subjects={subjects}
        employees={employees}
        academicYears={years}
        defaultYear={defaultYear}
      />
    </div>
  );
}
