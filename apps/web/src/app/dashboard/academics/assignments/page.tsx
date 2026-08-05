"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  Plus, X, BookOpen, User, Calendar, ChevronDown,
  Download, Loader2, Pencil, Trash2, Paperclip,
  CheckCircle2, Archive, Clock, RotateCcw, BarChart2,
  SlidersHorizontal, Search,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ComposedChart, Area,
} from "recharts";
import { useAuthStore } from "@/store/auth";
import { usePermissions } from "@/hooks/usePermissions";
import { hasAcademicsAction } from "@/lib/academicsAccess";
import { useRouter, useSearchParams } from "next/navigation";
import { format, parseISO, startOfWeek, endOfWeek } from "date-fns";

// ── Design tokens ─────────────────────────────────────────────────────────────

const D = {
  line:  "#e6e8ef",
  muted: "#7c8598",
  ink:   "#111827",
  nav2:  "#28245f",
  bg:    "#f4f6fa",
};

const inputBase: React.CSSProperties = {
  width: "100%", minHeight: 42, border: `1px solid ${D.line}`,
  borderRadius: 12, padding: "9px 12px", background: "white",
  color: D.ink, font: "inherit", fontSize: 14, outline: "none",
  boxSizing: "border-box",
};

function DInput({
  error, style, ...p
}: React.InputHTMLAttributes<HTMLInputElement> & { error?: boolean }) {
  return (
    <input {...p}
      style={{
        ...inputBase,
        ...(error ? { border: "1px solid #ef4444", background: "#fef2f2" } : {}),
        ...style,
      }}
    />
  );
}

function DSelect({ style, children, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...p} style={{ ...inputBase, ...style }}>{children}</select>;
}

function DTextarea({ style, ...p }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea {...p}
      style={{ ...inputBase, minHeight: 96, resize: "vertical", ...style }}
    />
  );
}

function DBtn({
  primary, children, style, ...p
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }) {
  return (
    <button {...p}
      style={{
        minHeight: 42, border: 0, borderRadius: 12, padding: "0 18px",
        font: "inherit", fontWeight: 850,
        cursor: p.disabled ? "not-allowed" : "pointer",
        opacity: p.disabled ? 0.5 : 1,
        display: "inline-flex", alignItems: "center", gap: 6,
        color:      primary ? "white"  : "#374151",
        background: primary ? "linear-gradient(135deg,#28245f,#4f46e5)" : "white",
        boxShadow:  primary ? "0 12px 24px rgba(79,70,229,.24)" : `inset 0 0 0 1px ${D.line}`,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function DField({
  label, required, children,
}: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gap: 7 }}>
      <label style={{ color: "#4b5563", fontSize: 13, fontWeight: 850 }}>
        {label}{required && <span style={{ color: "#ef4444" }}> *</span>}
      </label>
      {children}
    </div>
  );
}

// FSelect kept for StatsPanel
function FSelect({ className = "", children, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...p}
      className={`w-full rounded-lg border border-gray-200 px-3 py-2 text-sm
                  focus:border-indigo-500 focus:outline-none bg-white text-gray-700 ${className}`}
    >
      {children}
    </select>
  );
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
    <span className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold w-[82px] ${map[status] ?? "bg-gray-100 text-gray-600"}`}>
      {label[status] ?? status}
    </span>
  );
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  try { return format(parseISO(iso), "dd MMM yyyy"); } catch { return iso; }
}
function todayStr() {
  return new Date().toISOString().split("T")[0];
}

// ── Topics input ──────────────────────────────────────────────────────────────

function TopicsInput({ topics, onChange }: { topics: string[]; onChange: (t: string[]) => void }) {
  const [input, setInput] = useState("");
  const add = () => {
    const t = input.trim();
    if (t && !topics.includes(t)) onChange([...topics, t]);
    setInput("");
  };

  return (
    <div>
      {/* Display */}
      <div style={{
        ...inputBase, minHeight: 42, display: "flex", flexWrap: "wrap",
        gap: 6, padding: "8px 12px", alignItems: "center",
      }}>
        {topics.length === 0 && (
          <span style={{ color: D.muted, fontSize: 13 }}>No topics added</span>
        )}
        {topics.map((t) => (
          <span key={t} style={{
            background: "#eef2ff", color: D.nav2, borderRadius: 6,
            padding: "2px 8px", fontSize: 12, fontWeight: 700,
            display: "inline-flex", alignItems: "center", gap: 4,
          }}>
            {t}
            <button
              type="button"
              onClick={() => onChange(topics.filter((x) => x !== t))}
              style={{ border: 0, background: "transparent", cursor: "pointer", color: D.nav2, padding: 0, lineHeight: 1 }}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      {/* Input + Add */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 12, marginTop: 12 }}>
        <DInput
          placeholder="Type a topic and click Add…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
        />
        <DBtn type="button" onClick={add}>+ Add</DBtn>
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
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          ...inputBase, display: "flex", alignItems: "center",
          justifyContent: "space-between", cursor: "pointer", textAlign: "left",
        }}
      >
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {selected.length === 0
            ? <span style={{ color: D.muted }}>Select batches…</span>
            : selectedNames}
        </span>
        <ChevronDown style={{
          width: 16, height: 16, color: D.muted, flexShrink: 0, marginLeft: 4,
          transform: open ? "rotate(180deg)" : "none", transition: "transform .15s",
        }} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-xl bg-white shadow-lg border" style={{ borderColor: D.line }}>
          <div className="max-h-48 overflow-y-auto">
            {batches.length === 0 && (
              <p className="px-3 py-2 text-xs" style={{ color: D.muted }}>No batches for this year</p>
            )}
            {batches.map((b) => (
              <label key={b.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                <input type="checkbox" checked={selected.includes(b.id)} onChange={() => toggle(b.id)} className="accent-indigo-600" />
                <span className="text-sm" style={{ color: D.ink }}>{b.name}</span>
                {b.grade && <span className="text-xs ml-auto shrink-0" style={{ color: D.muted }}>{b.grade.name}</span>}
              </label>
            ))}
          </div>
          <div className="border-t px-3 py-2 flex items-center justify-between" style={{ borderColor: D.line }}>
            <span className="text-xs" style={{ color: D.muted }}>{selected.length} selected</span>
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

// ── Assignment modal (redesigned) ─────────────────────────────────────────────

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

  const [form, setForm]           = useState<AssignmentForm>(initial ?? emptyForm());
  const [file, setFile]           = useState<File | null>(null);
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

  const sectionStyle: React.CSSProperties = {
    border: `1px solid ${D.line}`, borderRadius: 16, padding: 18, background: "#fbfcfe",
  };
  const sectionHeadStyle: React.CSSProperties = {
    margin: "0 0 14px", fontSize: 17, fontWeight: 700, color: D.ink,
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-7"
      style={{ background: "linear-gradient(135deg,rgba(20,23,53,.72),rgba(40,36,95,.62))" }}
    >
      <div
        className="w-full bg-white flex flex-col"
        style={{ maxWidth: 960, borderRadius: 22, boxShadow: "0 32px 90px rgba(0,0,0,.28)", maxHeight: "92vh", overflow: "hidden" }}
      >
        {/* head */}
        <div
          className="flex items-center justify-between gap-5 border-b shrink-0"
          style={{ padding: "24px 28px", borderColor: D.line }}
        >
          <div className="flex items-center gap-4">
            <div style={{
              width: 44, height: 44, borderRadius: 14, display: "grid", placeItems: "center",
              background: "#eef2ff", color: D.nav2, fontWeight: 900, fontSize: 15, flexShrink: 0,
            }}>AS</div>
            <h2 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: D.ink }}>
              {assignmentId ? "Edit Assignment" : "New Assignment"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="border-0 bg-transparent cursor-pointer leading-none text-3xl"
            style={{ color: "#9aa3b4" }}
          >
            ×
          </button>
        </div>

        {/* body */}
        <div className="overflow-y-auto flex-1" style={{ padding: "24px 28px" }}>
          <div style={{ display: "grid", gap: 18 }}>

            {/* Section 1: Assignment Basics */}
            <section style={sectionStyle}>
              <h3 style={sectionHeadStyle}>Assignment Basics</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-[14px]">
                <DField label="Academic Year" required>
                  <DSelect
                    value={form.academicYear}
                    onChange={(e) => setForm({ ...form, academicYear: e.target.value, batchIds: [] })}
                  >
                    <option value="">Select academic year</option>
                    {academicYears.filter((y) => !y.isArchived).map((y) => (
                      <option key={y.id} value={y.name}>{y.name}</option>
                    ))}
                  </DSelect>
                </DField>
                <DField label="Assignment Name" required>
                  <DInput
                    placeholder="e.g. Assignment on Calculus"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </DField>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-[14px]" style={{ marginTop: 14 }}>
                <DField label="Assignment Date" required>
                  <DInput
                    type="date" max="2099-12-31" min="1900-01-01"
                    value={form.assignmentDate}
                    onChange={(e) => setForm({ ...form, assignmentDate: e.target.value })}
                  />
                </DField>
                <DField label="Submission Date" required>
                  <DInput
                    type="date" max="2099-12-31" min="1900-01-01"
                    error={submissionError}
                    value={form.submissionDate}
                    onChange={(e) => setForm({ ...form, submissionDate: e.target.value })}
                  />
                  {submissionError && (
                    <p style={{ fontSize: 12, color: "#ef4444", margin: 0 }}>
                      Can&apos;t be before assignment date
                    </p>
                  )}
                </DField>
              </div>
            </section>

            {/* Section 2: Audience & Subject */}
            <section style={sectionStyle}>
              <h3 style={sectionHeadStyle}>Audience &amp; Subject</h3>
              <DField label="Batch(es)" required>
                <BatchMultiSelect
                  batches={filteredBatches}
                  selected={form.batchIds}
                  onChange={(ids) => setForm({ ...form, batchIds: ids })}
                />
                {form.batchIds.length > 0 && (
                  <p style={{ fontSize: 12, color: "#4f46e5", margin: 0 }}>
                    {form.batchIds.length} batch{form.batchIds.length > 1 ? "es" : ""} selected
                  </p>
                )}
              </DField>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-[14px]" style={{ marginTop: 14 }}>
                <DField label="Subject" required>
                  <DSelect value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })}>
                    <option value="">Select subject</option>
                    {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </DSelect>
                </DField>
                <DField label="Faculty" required>
                  <DSelect value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}>
                    <option value="">Select faculty</option>
                    {employees.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
                  </DSelect>
                </DField>
              </div>
            </section>

            {/* Section 3: Topics, Attachment & Notes */}
            <section style={sectionStyle}>
              <h3 style={sectionHeadStyle}>Topics, Attachment &amp; Notes</h3>
              <DField label="Topics">
                <TopicsInput topics={form.topics} onChange={(t) => setForm({ ...form, topics: t })} />
              </DField>

              {/* Attachment */}
              <div style={{ marginTop: 14 }}>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.ppt,.pptx,.xls,.xlsx"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="hidden"
                />
                <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                  <DBtn type="button" onClick={() => fileRef.current?.click()}>
                    <Paperclip style={{ width: 15, height: 15 }} />
                    Choose File
                  </DBtn>
                  <span style={{ fontSize: 13, color: file ? D.nav2 : D.muted, fontWeight: file ? 700 : 500 }}>
                    {file
                      ? file.name
                      : initial && (initial as any).attachmentName
                        ? `${(initial as any).attachmentName} (keep or replace)`
                        : "No file chosen"}
                  </span>
                </div>
              </div>

              {/* Note */}
              <div style={{ marginTop: 14 }}>
                <DField label="Note">
                  <DTextarea
                    placeholder="Additional instructions or notes…"
                    value={form.note}
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                  />
                </DField>
              </div>
            </section>
          </div>
        </div>

        {/* foot */}
        <div
          className="flex flex-wrap items-center justify-between gap-3 border-t shrink-0"
          style={{ padding: "18px 28px", borderColor: D.line }}
        >
          <DBtn onClick={onClose} disabled={busy}>Cancel</DBtn>
          <div className="flex flex-wrap items-center gap-3">
            {!assignmentId && (
              <DBtn onClick={handleSaveAnother} disabled={busy || submissionError}>
                Save &amp; Add Another
              </DBtn>
            )}
            <DBtn primary onClick={handleSave} disabled={busy || submissionError}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {assignmentId ? "Save Changes" : "Save"}
            </DBtn>
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
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [menuOpen]);

  const batchNames = a.batches?.map((ab: any) => ab.batch?.name).filter(Boolean).join(", ") ?? "—";

  return (
    <div
      className="group flex items-start gap-3 px-4 py-3.5 border-b last:border-0 hover:bg-gray-50/60 transition-colors"
      style={{ borderColor: D.line }}
    >
      <div className="shrink-0 mt-0.5"><StatusBadge status={a.status} /></div>

      <div className="flex-1 min-w-0">
        <button
          onClick={() => router.push(`/dashboard/academics/assignments/${a.id}`)}
          className="text-sm font-semibold hover:underline truncate text-left block max-w-full"
          style={{ color: D.nav2 }}
        >
          {a.name}
        </button>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs" style={{ color: D.muted }}>
          {a.subject && (
            <span className="flex items-center gap-1">
              <BookOpen className="h-3 w-3 shrink-0" />{a.subject.name}
            </span>
          )}
          <span className="flex items-center gap-1">
            <User className="h-3 w-3 shrink-0" />{batchNames}
          </span>
          {a.employee && (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3 shrink-0" />
              {a.employee.firstName} {a.employee.lastName}
            </span>
          )}
          {a.attachmentUrl && (
            <a
              href={a.attachmentUrl} target="_blank" rel="noreferrer"
              className="flex items-center gap-1 hover:underline"
              style={{ color: D.nav2 }}
            >
              <Paperclip className="h-3 w-3 shrink-0" />
              {a.attachmentName ?? "Attachment"}
            </a>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1 text-[11px]" style={{ color: "#9aa3b4" }}>
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            Given: {fmtDate(a.assignmentDate)}
          </span>
        </div>
        {a.topics && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {a.topics.split(",").map((t: string) => t.trim()).filter(Boolean).map((t: string) => (
              <span
                key={t}
                className="rounded-md px-1.5 py-0.5 text-[10px]"
                style={{ background: "#f1f5f9", color: D.muted }}
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      {canEdit && (
        <div className="relative shrink-0" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all border-0 bg-transparent cursor-pointer"
            style={{ color: D.muted }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <circle cx="10" cy="4" r="1.5" /><circle cx="10" cy="10" r="1.5" /><circle cx="10" cy="16" r="1.5" />
            </svg>
          </button>
          {menuOpen && (
            <div
              className="absolute right-0 top-8 z-30 w-44 rounded-xl bg-white py-1 shadow-xl border"
              style={{ borderColor: D.line }}
            >
              <button
                onClick={() => { onEdit(a); setMenuOpen(false); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 border-0 bg-transparent cursor-pointer text-left"
              >
                <Pencil className="h-3.5 w-3.5 text-gray-400" /> Edit
              </button>
              {a.status !== "COMPLETED" && (
                <button
                  onClick={() => { onStatus(a.id, "COMPLETED"); setMenuOpen(false); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-green-700 hover:bg-green-50 border-0 bg-transparent cursor-pointer text-left"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Mark Completed
                </button>
              )}
              {a.status !== "DUE" && (
                <button
                  onClick={() => { onStatus(a.id, "DUE"); setMenuOpen(false); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-amber-700 hover:bg-amber-50 border-0 bg-transparent cursor-pointer text-left"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Mark Due
                </button>
              )}
              {a.status !== "ARCHIVED" && (
                <button
                  onClick={() => { onStatus(a.id, "ARCHIVED"); setMenuOpen(false); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 border-0 bg-transparent cursor-pointer text-left"
                >
                  <Archive className="h-3.5 w-3.5" /> Archive
                </button>
              )}
              <div className="my-1 border-t" style={{ borderColor: D.line }} />
              <button
                onClick={() => { onDelete(a.id); setMenuOpen(false); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 border-0 bg-transparent cursor-pointer text-left"
              >
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

const CHART_COLORS = [
  "#6366f1","#8b5cf6","#ec4899","#14b8a6","#f59e0b",
  "#10b981","#3b82f6","#f97316","#a855f7","#06b6d4",
];

function SummaryCard({ label, value, sub, color }: {
  label: string; value: string | number; sub: string;
  color: "indigo" | "violet" | "green" | "amber";
}) {
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
          <span className="font-medium text-gray-800">
            {typeof p.value === "number" ? (String(p.value).includes(".") ? p.value.toFixed(1) : p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function NSelector({ value, onChange, prefix = "Top" }: { value: number; onChange: (n: number) => void; prefix?: string }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs focus:outline-none focus:border-indigo-500"
    >
      {[5, 10, 15, 20].map((n) => <option key={n} value={n}>{prefix} {n}</option>)}
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
  const [topN,         setTopN]         = useState(10);
  const [bottomN,      setBottomN]      = useState(10);
  const [trendSubject, setTrendSubject] = useState("");

  const studentStats      = submissionStats?.studentStats      ?? [];
  const batchStats        = submissionStats?.batchStats        ?? [];
  const cityStats         = submissionStats?.cityStats         ?? [];
  const weeklySubmissions = submissionStats?.weeklySubmissions ?? [];

  const subjectMap = new Map<string, { name: string; count: number }>();
  for (const a of assignments) {
    const key  = a.subjectId ?? "__none__";
    const name = a.subject?.name ?? "No Subject";
    if (!subjectMap.has(key)) subjectMap.set(key, { name, count: 0 });
    subjectMap.get(key)!.count++;
  }
  const subjectStats = [...subjectMap.values()].sort((a, b) => b.count - a.count);

  const facultyMap = new Map<string, { name: string; count: number }>();
  for (const a of assignments) {
    if (!a.employee) continue;
    const k = a.employeeId;
    if (!facultyMap.has(k)) facultyMap.set(k, { name: `${a.employee.firstName} ${a.employee.lastName}`, count: 0 });
    facultyMap.get(k)!.count++;
  }
  const facultyStats = [...facultyMap.values()].sort((a, b) => b.count - a.count);

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

  const totalGiven          = assignments.length;
  const totalSubmitted      = studentStats.reduce((s, x) => s + x.submitted, 0);
  const grandTotal          = studentStats.reduce((s, x) => s + x.total, 0);
  const totalWeeks          = weeklyTrend.length || 1;
  const avgWeeklyGiving     = (totalGiven / totalWeeks).toFixed(1);
  const avgWeeklySubmission = (totalSubmitted / totalWeeks).toFixed(1);
  const overallRate         = grandTotal > 0 ? Math.round((totalSubmitted / grandTotal) * 100) : 0;

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
    <div className="p-4 sm:p-6 space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard label="Assignments Given"    value={totalGiven}           sub="total across filters"              color="indigo" />
        <SummaryCard label="Submissions Received" value={totalSubmitted}       sub={`of ${grandTotal} expected`}       color="green"  />
        <SummaryCard label="Submission Rate"      value={`${overallRate}%`}    sub="across all students"               color="violet" />
        <SummaryCard label="Avg Weekly Giving"    value={avgWeeklyGiving}      sub={`${avgWeeklySubmission}/wk received`} color="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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

      {cityStats.length > 1 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-sm font-semibold text-gray-800">Submission Rate by City</p>
          <p className="text-xs text-gray-400 mb-4">Aggregate submission performance across cities</p>
          <ResponsiveContainer width="100%" height={Math.max(160, cityStats.length * 56 + 48)}>
            <BarChart
              data={cityStats.map((c) => ({ ...c, rate: c.total > 0 ? parseFloat(((c.submitted / c.total) * 100).toFixed(1)) : 0 }))}
              layout="vertical" margin={{ left: 0, right: 48, top: 4, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
              <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12, fill: "#475569" }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} formatter={(v: any) => [`${v}%`, "Submission Rate"]} />
              <Bar dataKey="rate" name="Submission Rate %" fill="#14b8a6" radius={[0, 4, 4, 0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

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

      {bottomStudents.length > 0 && (
        <div className="bg-white rounded-xl border border-red-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-semibold text-gray-800">Poor Performers — Students</p>
            <NSelector value={bottomN} onChange={setBottomN} prefix="Bottom" />
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

function AssignmentsPage() {
  const { user }     = useAuthStore();
  const searchParams = useSearchParams();
  const teacherId    = searchParams.get("teacherId");
  const qc           = useQueryClient();
  const permissions  = usePermissions();
  // Write access comes from the permission matrix; only SUPER_ADMIN bypasses it
  const canEdit = hasAcademicsAction(user?.role, permissions, "STU_ASSIGNMENT", "canEdit");

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
  const [toolbarSearch,      setToolbarSearch]      = useState("");

  // Reference data
  const batchesUrl = teacherId
    ? `/api/v1/academics/batches?teacherId=${teacherId}`
    : "/api/v1/academics/batches";
  const { data: yearsData }    = useQuery({ queryKey: ["academic-years"],   queryFn: () => api.get("/api/v1/academics/academic-years").then((r) => r.data.data) });
  const { data: gradesData }   = useQuery({ queryKey: ["grades"],           queryFn: () => api.get("/api/v1/academics/grades").then((r) => r.data) });
  const { data: subjectsData } = useQuery({ queryKey: ["subjects"],         queryFn: () => api.get("/api/v1/academics/subjects").then((r) => r.data.data) });
  const { data: batchesData }  = useQuery({ queryKey: ["batches-all", teacherId ?? "all"],  queryFn: () => api.get(batchesUrl).then((r) => r.data) });
  const { data: empData }      = useQuery({ queryKey: ["employees-lookup"], queryFn: () => api.get("/api/v1/employees/lookup").then((r) => r.data) });

  const years     = (yearsData          ?? []) as any[];
  const grades    = (gradesData?.data   ?? []) as any[];
  const subjects  = (subjectsData ?? []) as any[];
  const batches   = (batchesData?.data  ?? []) as any[];
  const employees = (empData?.data      ?? []) as any[];

  useEffect(() => {
    if (filterYear || years.length === 0) return;
    const active = years.find((y) => y.isActive && !y.isArchived) ?? years.find((y) => !y.isArchived);
    if (active) setFilterYear(active.name);
  }, [years]); // eslint-disable-line react-hooks/exhaustive-deps

  const defaultYear = years.find((y) => y.isActive && !y.isArchived)?.name ?? years.find((y) => !y.isArchived)?.name ?? "";

  // API params
  const params = new URLSearchParams();
  if (search)                  params.set("search",       search);
  if (filterStatus !== "ALL")  params.set("status",       filterStatus);
  if (filterDateFrom)          params.set("dateFrom",     filterDateFrom);
  if (filterDateTo)            params.set("dateTo",       filterDateTo);
  if (filterYear)              params.set("academicYear", filterYear);
  if (filterBatch)             params.set("batchId",      filterBatch);
  if (filterGrade)             params.set("gradeId",      filterGrade);
  if (filterSubject)           params.set("subjectId",    filterSubject);
  // When scoped to a teacher, filter by their employeeId (unless admin explicitly set faculty filter)
  if (teacherId && !filterFaculty) params.set("employeeId", teacherId);
  else if (filterFaculty)          params.set("employeeId", filterFaculty);
  params.set("limit", "200");

  const { data: assignmentData, isLoading } = useQuery({
    queryKey: ["assignments", params.toString()],
    queryFn:  () => api.get(`/api/v1/academics/assignments?${params.toString()}`).then((r) => r.data),
  });

  const assignments: any[] = assignmentData?.data ?? [];

  // Stats queries
  const statsParams = new URLSearchParams(params);
  statsParams.delete("status");
  statsParams.set("limit", "2000");

  const { data: statsData }    = useQuery({
    queryKey: ["assignments-stats-list", statsParams.toString()],
    queryFn:  () => api.get(`/api/v1/academics/assignments?${statsParams.toString()}`).then((r) => r.data),
    enabled: showStats,
  });
  const { data: statsSubData } = useQuery({
    queryKey: ["assignments-stats-sub", statsParams.toString()],
    queryFn:  () => api.get(`/api/v1/academics/assignments/stats?${statsParams.toString()}`).then((r) => r.data),
    enabled: showStats,
  });

  // Stat card values
  const weekStart   = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd     = endOfWeek(new Date(),   { weekStartsOn: 1 });
  const dueThisWeek = assignments.filter((a) => {
    try {
      const d = parseISO(a.submissionDate);
      return a.status === "DUE" && d >= weekStart && d <= weekEnd;
    } catch { return false; }
  }).length;
  const completedCount  = assignments.filter((a) => a.status === "COMPLETED").length;
  const activeCount     = assignments.filter((a) => a.status !== "ARCHIVED").length;
  const submissionPct   = activeCount > 0 ? Math.round((completedCount / activeCount) * 100) : 0;
  const pendingReview   = assignments.filter((a) => a.status === "DUE").length;
  const archivedCount   = assignments.filter((a) => a.status === "ARCHIVED").length;

  // Client-side toolbar search
  const displayedAssignments = toolbarSearch.trim()
    ? assignments.filter((a) => {
        const q = toolbarSearch.toLowerCase();
        const batchNames = a.batches?.map((ab: any) => ab.batch?.name ?? "").join(" ") ?? "";
        const faculty = a.employee ? `${a.employee.firstName} ${a.employee.lastName}` : "";
        return (
          a.name.toLowerCase().includes(q) ||
          batchNames.toLowerCase().includes(q) ||
          (a.subject?.name ?? "").toLowerCase().includes(q) ||
          faculty.toLowerCase().includes(q) ||
          (a.topics ?? "").toLowerCase().includes(q)
        );
      })
    : assignments;

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

  const exportCSV = () => {
    const header = ["Name","Academic Year","Batches","Subject","Faculty","Assigned","Due","Status","Topics"];
    const rows = assignments.map((a) => [
      a.name, a.academicYear,
      a.batches?.map((ab: any) => ab.batch?.name).join(" | ") ?? "",
      a.subject?.name ?? "",
      a.employee ? `${a.employee.firstName} ${a.employee.lastName}` : "",
      fmtDate(a.assignmentDate), fmtDate(a.submissionDate),
      a.status, a.topics ?? "",
    ]);
    const csv  = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const el   = document.createElement("a"); el.href = url; el.download = "assignments.csv"; el.click();
    URL.revokeObjectURL(url);
  };

  const hasFilters = search || filterStatus !== "ALL" || filterDateFrom || filterDateTo ||
    filterBatch || filterGrade || filterSubject || filterFaculty;
  const clearFilters = () => {
    setSearch(""); setFilterStatus("ALL"); setFilterDateFrom(""); setFilterDateTo("");
    setFilterBatch(""); setFilterGrade(""); setFilterSubject(""); setFilterFaculty("");
  };

  const filterLabelStyle: React.CSSProperties = {
    display: "block", marginBottom: 8, color: "#4b5563", fontSize: 13, fontWeight: 850,
  };

  const STATUS_CHIPS = [
    { key: "ALL",       label: "All"       },
    { key: "DUE",       label: "Due"       },
    { key: "COMPLETED", label: "Completed" },
    { key: "ARCHIVED",  label: "Archived"  },
  ];

  const filterPanel = (
    <div style={{ display: "grid", gap: 20 }}>
      {/* Search */}
      <div>
        <label style={filterLabelStyle}>Search</label>
        <div style={{ position: "relative" }}>
          <DInput
            placeholder="Assignment name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 36 }}
          />
          <Search style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 15, height: 15, color: D.muted, pointerEvents: "none" }} />
        </div>
      </div>

      {/* Status chips */}
      <div>
        <label style={filterLabelStyle}>Status</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {STATUS_CHIPS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilterStatus(key)}
              style={{
                minHeight: 34, borderRadius: 999, padding: "0 13px",
                border: `1px solid ${filterStatus === key ? D.nav2 : D.line}`,
                background: filterStatus === key ? D.nav2 : "white",
                color: filterStatus === key ? "white" : "#4b5563",
                fontSize: 13, fontWeight: 850, cursor: "pointer", font: "inherit",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Due date range */}
      <div>
        <label style={filterLabelStyle}>Due Date Range</label>
        <DInput type="date" max="2099-12-31" min="1900-01-01" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} />
        <DInput type="date" max="2099-12-31" min="1900-01-01" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} style={{ marginTop: 8 }} />
      </div>

      {/* Academic Year */}
      <div>
        <label style={filterLabelStyle}>Academic Year</label>
        <DSelect value={filterYear} onChange={(e) => { setFilterYear(e.target.value); setFilterBatch(""); }}>
          <option value="">All years</option>
          {years.map((y) => <option key={y.id} value={y.name}>{y.name}</option>)}
        </DSelect>
      </div>

      {/* Grade */}
      <div>
        <label style={filterLabelStyle}>Grade</label>
        <DSelect value={filterGrade} onChange={(e) => { setFilterGrade(e.target.value); setFilterBatch(""); }}>
          <option value="">All grades</option>
          {grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </DSelect>
      </div>

      {/* Batch */}
      <div>
        <label style={filterLabelStyle}>Batch</label>
        <DSelect value={filterBatch} onChange={(e) => setFilterBatch(e.target.value)}>
          <option value="">All batches</option>
          {batches
            .filter((b) => (!filterYear || b.academicYear === filterYear) && (!filterGrade || b.gradeId === filterGrade))
            .map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </DSelect>
      </div>

      {/* Subject */}
      <div>
        <label style={filterLabelStyle}>Subject</label>
        <DSelect value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)}>
          <option value="">All subjects</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </DSelect>
      </div>

      {/* Faculty */}
      <div>
        <label style={filterLabelStyle}>Faculty</label>
        <DSelect value={filterFaculty} onChange={(e) => setFilterFaculty(e.target.value)}>
          <option value="">All faculty</option>
          {employees.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
        </DSelect>
      </div>

      {hasFilters && (
        <button
          onClick={clearFilters}
          style={{
            width: "100%", minHeight: 36, borderRadius: 10,
            border: "1px dashed #fca5a5", background: "white",
            color: "#ef4444", fontSize: 13, fontWeight: 750,
            cursor: "pointer", font: "inherit",
          }}
        >
          Clear All Filters
        </button>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-full min-h-0" style={{ background: D.bg }}>

      {/* ── page-head ─────────────────────────────────────────────────────────── */}
      <div
        className="bg-white border-b shrink-0 flex flex-wrap items-center justify-between gap-4"
        style={{ borderColor: D.line, padding: "22px 32px" }}
      >
        <div className="flex items-center gap-[14px]">
          <div style={{
            width: 44, height: 44, borderRadius: 14, display: "grid", placeItems: "center",
            background: "#eef2ff", color: D.nav2, fontWeight: 900, fontSize: 15, flexShrink: 0,
          }}>AS</div>
          <div>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, lineHeight: 1.15, color: D.ink }}>Assignments</h1>
            <p style={{ margin: "5px 0 0", color: D.muted, fontWeight: 700, fontSize: 14 }}>
              Create, distribute, and track student submissions
            </p>
          </div>
        </div>
        <div className="flex items-center flex-wrap gap-[10px]">
          {/* Mobile: filter icon */}
          <button
            className="sm:hidden"
            onClick={() => setMobileFiltersOpen(true)}
            style={{
              minHeight: 42, border: 0, borderRadius: 12, padding: "0 14px",
              background: "white", boxShadow: `inset 0 0 0 1px ${D.line}`,
              cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
              color: "#374151", font: "inherit", fontWeight: 850,
            }}
          >
            <SlidersHorizontal style={{ width: 16, height: 16 }} />
          </button>
          <DBtn
            onClick={() => setShowStats((v) => !v)}
            style={showStats ? {
              background: "linear-gradient(135deg,#28245f,#4f46e5)",
              color: "white", boxShadow: "0 12px 24px rgba(79,70,229,.24)",
            } : {}}
          >
            <BarChart2 style={{ width: 16, height: 16 }} />
            <span>Stats</span>
          </DBtn>
          <DBtn onClick={exportCSV}>
            <Download style={{ width: 16, height: 16 }} />
            <span className="hidden sm:inline">Export</span>
          </DBtn>
          {canEdit && (
            <DBtn primary onClick={() => { setEditTarget(null); setModalOpen(true); }}>
              <Plus style={{ width: 16, height: 16 }} />
              <span>New Assignment</span>
            </DBtn>
          )}
        </div>
      </div>

      {/* ── layout ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Desktop filter sidebar */}
        <aside
          className="hidden sm:block shrink-0 bg-white border-r overflow-y-auto"
          style={{ width: 300, borderColor: D.line, padding: "22px 18px" }}
        >
          <h2 style={{
            margin: "0 0 18px", color: "#9aa3b4", fontSize: 13, fontWeight: 900,
            letterSpacing: ".08em", textTransform: "uppercase",
          }}>
            Filters
          </h2>
          {filterPanel}
        </aside>

        {/* Mobile filter drawer */}
        {mobileFiltersOpen && (
          <div className="fixed inset-0 z-40 sm:hidden">
            <div className="absolute inset-0 bg-black/30" onClick={() => setMobileFiltersOpen(false)} />
            <div
              className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-xl overflow-y-auto"
              style={{ padding: "16px 18px" }}
            >
              <div className="flex items-center justify-between" style={{ marginBottom: 18 }}>
                <h2 style={{
                  margin: 0, color: "#9aa3b4", fontSize: 13, fontWeight: 900,
                  letterSpacing: ".08em", textTransform: "uppercase",
                }}>Filters</h2>
                <button
                  onClick={() => setMobileFiltersOpen(false)}
                  className="p-1 rounded hover:bg-gray-100 border-0 bg-transparent cursor-pointer"
                >
                  <X className="h-4 w-4 text-gray-400" />
                </button>
              </div>
              {filterPanel}
            </div>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <div className="px-4 py-5 sm:px-8 sm:py-7 pb-10">

            {showStats ? (
              <StatsPanel
                assignments={statsData?.data ?? []}
                submissionStats={statsSubData?.data ?? null}
                subjects={subjects}
              />
            ) : (
              <>
                {/* Toolbar */}
                <div
                  className="grid items-center gap-[14px] mb-[18px]"
                  style={{ gridTemplateColumns: "minmax(0,1fr) auto auto" }}
                >
                  <div style={{
                    minHeight: 48, borderRadius: 14, border: `1px solid ${D.line}`, background: "white",
                    display: "flex", alignItems: "center", gap: 10, padding: "0 16px",
                  }}>
                    <Search style={{ width: 18, height: 18, color: D.muted, flexShrink: 0 }} />
                    <input
                      value={toolbarSearch}
                      onChange={(e) => setToolbarSearch(e.target.value)}
                      placeholder="Search assignment name, batch, subject, faculty, or topic…"
                      style={{
                        flex: 1, border: 0, outline: "none", background: "transparent",
                        fontSize: 14, fontWeight: 700, color: D.ink, fontFamily: "inherit", minWidth: 0,
                      }}
                    />
                    {toolbarSearch && (
                      <button onClick={() => setToolbarSearch("")} className="border-0 bg-transparent cursor-pointer p-0 flex items-center">
                        <X style={{ width: 15, height: 15, color: D.muted }} />
                      </button>
                    )}
                  </div>
                  <span style={{ color: D.muted, fontWeight: 850, whiteSpace: "nowrap", fontSize: 14 }}>
                    {displayedAssignments.length} assignment{displayedAssignments.length !== 1 ? "s" : ""}
                  </span>
                  {canEdit && (
                    <DBtn primary onClick={() => { setEditTarget(null); setModalOpen(true); }}>
                      <Plus style={{ width: 16, height: 16 }} />
                      <span className="hidden sm:inline">New Assignment</span>
                    </DBtn>
                  )}
                </div>

                {/* Stat grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-[14px] mb-[18px]">
                  {[
                    { label: "Due This Week",  value: dueThisWeek   },
                    { label: "Submissions",    value: `${submissionPct}%` },
                    { label: "Pending Review", value: pendingReview  },
                    { label: "Archived",       value: archivedCount  },
                  ].map(({ label, value }) => (
                    <div
                      key={label}
                      style={{
                        background: "white", border: `1px solid ${D.line}`, borderRadius: 16, padding: 18,
                        boxShadow: "0 8px 22px rgba(20,23,53,.05)",
                      }}
                    >
                      <span style={{ color: D.muted, fontSize: 12, fontWeight: 850, textTransform: "uppercase", letterSpacing: ".04em" }}>
                        {label}
                      </span>
                      <strong style={{ display: "block", marginTop: 8, fontSize: 28, lineHeight: 1, color: D.ink }}>
                        {value}
                      </strong>
                    </div>
                  ))}
                </div>

                {isLoading ? (
                  <div className="p-6 space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="h-20 rounded-2xl bg-gray-100 animate-pulse" />
                    ))}
                  </div>
                ) : displayedAssignments.length === 0 ? (
                  <div style={{
                    background: "white", border: "1px dashed #cbd5e1", borderRadius: 18,
                    minHeight: 360, display: "grid", placeItems: "center",
                    textAlign: "center", padding: 36,
                  }}>
                    <div>
                      <div style={{
                        width: 72, height: 72, borderRadius: 22, display: "grid", placeItems: "center",
                        background: "#eef2ff", color: D.nav2, fontSize: 24, fontWeight: 900,
                        margin: "0 auto 16px",
                      }}>AS</div>
                      <h2 style={{ margin: 0, fontSize: 22, color: D.ink }}>No assignments found</h2>
                      <p style={{ margin: "8px auto 18px", color: D.muted, maxWidth: 470, lineHeight: 1.5, fontWeight: 600 }}>
                        Create the first assignment with due date, batch, subject, topics, and attachment. Submission analytics will appear here once students start responding.
                      </p>
                      {canEdit && (
                        <DBtn primary onClick={() => { setEditTarget(null); setModalOpen(true); }} style={{ margin: "0 auto" }}>
                          <Plus style={{ width: 16, height: 16 }} />
                          Create Assignment
                        </DBtn>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {(() => {
                      // Group by submission date (due date)
                      const grouped: Record<string, any[]> = {};
                      for (const a of displayedAssignments) {
                        const key = (a.submissionDate as string).split("T")[0];
                        if (!grouped[key]) grouped[key] = [];
                        grouped[key].push(a);
                      }
                      const todayKey = new Date().toISOString().split("T")[0];
                      return Object.keys(grouped).sort().reverse().map((key) => {
                        const items = grouped[key];
                        const dayLabel = (() => {
                          try { return format(parseISO(key), "EEEE, d MMMM yyyy"); } catch { return key; }
                        })();
                        const isPastDue = key < todayKey;
                        const isToday   = key === todayKey;
                        return (
                          <div key={key}>
                            {/* Date header */}
                            <div className="flex items-center gap-2 mb-2 px-1">
                              <Calendar style={{ width: 15, height: 15, color: "#6366f1", flexShrink: 0 }} />
                              <span style={{ fontSize: 14, fontWeight: 700, color: D.ink }}>{dayLabel}</span>
                              <span style={{ color: D.muted, fontSize: 12 }}>·</span>
                              <span style={{ color: D.muted, fontSize: 12 }}>
                                {items.length} assignment{items.length !== 1 ? "s" : ""}
                              </span>
                              {isToday && (
                                <span className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-600">
                                  Today
                                </span>
                              )}
                              {isPastDue && !isToday && (
                                <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-600 border border-amber-100">
                                  Past Due
                                </span>
                              )}
                            </div>
                            {/* Cards for this date */}
                            <div style={{
                              background: "white", borderRadius: 14, border: `1px solid ${D.line}`,
                              boxShadow: "0 4px 12px rgba(20,23,53,.05)", overflow: "hidden",
                            }}>
                              {items.map((a) => (
                                <AssignmentCard
                                  key={a.id} a={a} canEdit={canEdit}
                                  onEdit={openEdit}
                                  onDelete={(id) => { if (confirm("Delete this assignment?")) deleteMut.mutate(id); }}
                                  onStatus={(id, status) => statusMut.mutate({ id, status })}
                                />
                              ))}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </>
            )}
          </div>
        </main>
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

export default function AssignmentsPageWrapped() {
  return <Suspense fallback={null}><AssignmentsPage /></Suspense>;
}
