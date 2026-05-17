"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, X, Check, Archive, ArchiveRestore,
  Target, GraduationCap, Building2, BookOpen,
  ToggleLeft, ToggleRight, BookCopy, CreditCard,
  ChevronDown, ChevronUp, MapPin, Landmark,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";

// ── Design tokens ───────────────────────────────────────────────────────────────
const D = { line: "#e6e8ef", muted: "#7c8598", ink: "#111827", nav2: "#28245f", bg: "#f4f6fa", accent: "#eef2ff" };

// ── Shared primitives ───────────────────────────────────────────────────────────
function Input({ style, className = "", ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={className} style={{ width: "100%", borderRadius: 10, border: `1px solid ${D.line}`, padding: "8px 12px", fontSize: 13, outline: "none", background: "#fff", boxSizing: "border-box", ...style }} />;
}

function Select({ style, className = "", children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={className} style={{ width: "100%", borderRadius: 10, border: `1px solid ${D.line}`, padding: "8px 12px", fontSize: 13, background: "#fff", boxSizing: "border-box", ...style }}>
      {children}
    </select>
  );
}

function Table({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ borderRadius: 16, border: `1px solid ${D.line}`, overflow: "hidden", background: "#fff", boxShadow: "0 2px 8px rgba(20,23,53,.04)" }}>
      <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>{children}</table>
    </div>
  );
}

function THead({ cols }: { cols: string[] }) {
  return (
    <thead style={{ background: D.bg, borderBottom: `1px solid ${D.line}` }}>
      <tr>{cols.map(c => <th key={c} style={{ padding: "10px 20px", textAlign: "left", fontSize: 11, fontWeight: 600, color: D.muted, textTransform: "uppercase", letterSpacing: ".05em" }}>{c}</th>)}</tr>
    </thead>
  );
}

function ActiveToggle({ isActive, onToggle }: { isActive: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 500, color: isActive ? "#16a34a" : D.muted, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
      {isActive ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
      {isActive ? "Active" : "Inactive"}
    </button>
  );
}

function ActionButtons({ onEdit, onDelete, canEdit }: { onEdit: () => void; onDelete?: () => void; canEdit: boolean }) {
  if (!canEdit) return null;
  const btn: React.CSSProperties = { padding: 6, borderRadius: 8, border: `1px solid ${D.line}`, background: "#fff", color: D.muted, cursor: "pointer", display: "flex", lineHeight: 1 };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
      <button onClick={onEdit} style={btn}><Pencil size={13} /></button>
      {onDelete && <button onClick={onDelete} style={btn}><Trash2 size={13} /></button>}
    </div>
  );
}

function SaveCancel({ onSave, onCancel, disabled }: { onSave: () => void; onCancel: () => void; disabled?: boolean }) {
  return (
    <>
      <button onClick={onSave} disabled={disabled} style={{ padding: 6, borderRadius: 8, background: D.nav2, color: "#fff", border: "none", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1, display: "flex", lineHeight: 1 }}><Check size={13} /></button>
      <button onClick={onCancel} style={{ padding: 6, borderRadius: 8, border: `1px solid ${D.line}`, background: "#fff", color: D.muted, cursor: "pointer", display: "flex", lineHeight: 1 }}><X size={13} /></button>
    </>
  );
}

function SkeletonRows() {
  return <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{[1, 2, 3].map(i => <div key={i} style={{ height: 48, borderRadius: 12, background: "#f0f2f8" }} />)}</div>;
}

function SectionHero({ icon, title, subtitle, canEdit, onNew, newLabel }: { icon: string; title: string; subtitle: string; canEdit: boolean; onNew: () => void; newLabel: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, background: D.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: D.nav2, flexShrink: 0 }}>{icon}</div>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: D.ink }}>{title}</h1>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: D.muted }}>{subtitle}</p>
        </div>
      </div>
      {canEdit && <button onClick={onNew} style={{ padding: "10px 20px", borderRadius: 12, background: D.nav2, color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>+ {newLabel}</button>}
    </div>
  );
}

function SectionToolbar({ search, onSearch, showAll, onShowAll, showAllLabel = "Show archived" }: { search: string; onSearch: (v: string) => void; showAll: boolean; onShowAll: (v: boolean) => void; showAllLabel?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
      <input value={search} onChange={e => onSearch(e.target.value)} placeholder="Search..." style={{ flex: 1, minWidth: 160, minHeight: 42, borderRadius: 12, border: `1px solid ${D.line}`, padding: "0 14px", fontSize: 13, background: "#fff", outline: "none" }} />
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 500, color: D.muted, cursor: "pointer", whiteSpace: "nowrap" }}>
        <input type="checkbox" checked={showAll} onChange={e => onShowAll(e.target.checked)} style={{ accentColor: D.nav2 }} />
        {showAllLabel}
      </label>
      <button style={{ padding: "0 16px", height: 42, borderRadius: 12, border: `1px solid ${D.line}`, background: "#fff", color: D.muted, fontSize: 13, cursor: "pointer" }}>Export</button>
    </div>
  );
}

function StatCards({ cards }: { cards: { label: string; value: string | number }[] }) {
  return (
    <div className="grid grid-cols-3" style={{ gap: 12, marginBottom: 20 }}>
      {cards.map(c => (
        <div key={c.label} style={{ background: "#fff", border: `1px solid ${D.line}`, borderRadius: 14, padding: "14px 18px" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: D.muted, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4 }}>{c.label}</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: D.ink }}>{c.value}</div>
        </div>
      ))}
    </div>
  );
}

function EmptyBlock({ icon, title, desc, canEdit, onNew, newLabel }: { icon: string; title: string; desc: string; canEdit: boolean; onNew: () => void; newLabel: string }) {
  return (
    <div style={{ borderRadius: 16, border: `1px dashed ${D.line}`, background: "#fff", padding: "48px 24px", textAlign: "center" }}>
      <div style={{ width: 52, height: 52, borderRadius: 16, background: D.accent, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", fontSize: 18, fontWeight: 700, color: D.nav2 }}>{icon}</div>
      <h3 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 700, color: D.ink }}>{title}</h3>
      <p style={{ margin: "0 0 18px", fontSize: 13, color: D.muted, maxWidth: 420, marginLeft: "auto", marginRight: "auto" }}>{desc}</p>
      {canEdit && <button onClick={onNew} style={{ padding: "10px 22px", borderRadius: 12, background: D.nav2, color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ {newLabel}</button>}
    </div>
  );
}

const tdStyle: React.CSSProperties = { padding: "12px 20px" };
const rowStyle = (dim = false): React.CSSProperties => ({ borderTop: `1px solid ${D.line}`, opacity: dim ? 0.6 : 1 });
const addCard: React.CSSProperties = { borderRadius: 14, border: `1px solid ${D.accent}`, background: "#f8f9ff", padding: 16, marginBottom: 16 };
const addTitle: React.CSSProperties = { margin: "0 0 12px", fontSize: 13, fontWeight: 600, color: D.nav2 };
const iconBadge = (text: string, color = "#8b5cf6", bg = "#f5f3ff"): React.CSSProperties => ({});

// ── Academic Years Tab ─────────────────────────────────────────────────────────
function AcademicYearsTab({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [editName, setEditName] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [search, setSearch] = useState("");

  const { data: years = [], isLoading } = useQuery({ queryKey: ["academic-years", showAll], queryFn: () => api.get(`/api/v1/academics/academic-years?all=${showAll}`).then(r => r.data.data) });
  const createMut = useMutation({ mutationFn: () => api.post("/api/v1/academics/academic-years", { name }), onSuccess: () => { toast.success("Academic year created"); setAdding(false); setName(""); qc.invalidateQueries({ queryKey: ["academic-years"] }); }, onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed") });
  const updateMut = useMutation({ mutationFn: (id: string) => api.patch(`/api/v1/academics/academic-years/${id}`, { name: editName }), onSuccess: () => { toast.success("Updated"); setEditId(null); qc.invalidateQueries({ queryKey: ["academic-years"] }); }, onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed") });
  const archiveMut = useMutation({ mutationFn: (id: string) => api.patch(`/api/v1/academics/academic-years/${id}/archive`, {}), onSuccess: () => qc.invalidateQueries({ queryKey: ["academic-years"] }), onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed") });
  const deleteMut = useMutation({ mutationFn: (id: string) => api.delete(`/api/v1/academics/academic-years/${id}`), onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["academic-years"] }); }, onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed") });

  const filtered = (years as any[]).filter(y => y.name.toLowerCase().includes(search.toLowerCase()));
  const activeYr = (years as any[]).find(y => !y.isArchived && y.isActive);
  const archivedCount = (years as any[]).filter(y => y.isArchived).length;
  const ibtn: React.CSSProperties = { padding: 6, borderRadius: 8, border: `1px solid ${D.line}`, background: "#fff", color: D.muted, cursor: "pointer", display: "flex", lineHeight: 1 };

  return (
    <>
      <SectionHero icon="AY" title="Academic Years" subtitle="Manage academic year periods and archival status." canEdit={canEdit} onNew={() => setAdding(true)} newLabel="New Year" />
      <StatCards cards={[{ label: "Active Year", value: activeYr?.name ?? "—" }, { label: "Total Years", value: years.length }, { label: "Archived", value: archivedCount }]} />
      <SectionToolbar search={search} onSearch={setSearch} showAll={showAll} onShowAll={setShowAll} showAllLabel="Show archived" />
      {adding && (
        <div style={addCard}>
          <p style={addTitle}>New Academic Year</p>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Input placeholder="e.g. 2026-27" value={name} onChange={e => setName(e.target.value)} style={{ maxWidth: 200 }} />
            <SaveCancel onSave={() => createMut.mutate()} onCancel={() => { setAdding(false); setName(""); }} disabled={!name || createMut.isPending} />
          </div>
        </div>
      )}
      {isLoading ? <SkeletonRows /> : filtered.length === 0 ? (
        <EmptyBlock icon="AY" title="No academic years yet" desc="Create academic years so admissions, batches, fees, schedules, and reports can be grouped cleanly." canEdit={canEdit} onNew={() => setAdding(true)} newLabel="Create Academic Year" />
      ) : (
        <Table>
          <THead cols={["Year", "Status", ""]} />
          <tbody>
            {filtered.map((y: any) => (
              <tr key={y.id} style={rowStyle(y.isArchived)}>
                <td style={tdStyle}>{editId === y.id ? <Input value={editName} onChange={e => setEditName(e.target.value)} style={{ maxWidth: 180 }} /> : <span style={{ fontWeight: 600, color: D.ink }}>{y.name}</span>}</td>
                <td style={tdStyle}>
                  {y.isArchived
                    ? <span style={{ display: "inline-flex", alignItems: "center", gap: 4, borderRadius: 20, background: "#fef9ed", padding: "2px 8px", fontSize: 11, fontWeight: 500, color: "#d97706", border: "1px solid #fde68a" }}><Archive size={11} />Archived</span>
                    : y.isActive
                      ? <span style={{ display: "inline-flex", alignItems: "center", gap: 4, borderRadius: 20, background: "#f0fdf4", padding: "2px 8px", fontSize: 11, fontWeight: 500, color: "#16a34a", border: "1px solid #bbf7d0" }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: "#16a34a" }} />Active</span>
                      : <span style={{ display: "inline-flex", borderRadius: 20, background: D.bg, padding: "2px 8px", fontSize: 11, fontWeight: 500, color: D.muted }}>Inactive</span>}
                </td>
                <td style={tdStyle}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
                    {editId === y.id ? (
                      <SaveCancel onSave={() => updateMut.mutate(y.id)} onCancel={() => setEditId(null)} disabled={!editName || updateMut.isPending} />
                    ) : canEdit ? (
                      <>
                        <button onClick={() => { setEditId(y.id); setEditName(y.name); }} style={ibtn}><Pencil size={13} /></button>
                        <button onClick={() => archiveMut.mutate(y.id)} title={y.isArchived ? "Unarchive" : "Archive"} style={ibtn}>{y.isArchived ? <ArchiveRestore size={13} /> : <Archive size={13} />}</button>
                        <button onClick={() => { if (confirm(`Delete "${y.name}"?`)) deleteMut.mutate(y.id); }} style={ibtn}><Trash2 size={13} /></button>
                      </>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}

// ── Target Exams Tab ───────────────────────────────────────────────────────────
const EXAM_CATEGORIES = ["BOARD", "COMPETITIVE", "ENTRANCE"] as const;
type ExamCategory = typeof EXAM_CATEGORIES[number];
const CATEGORY_LABELS: Record<ExamCategory, string> = { BOARD: "Board Exam", COMPETITIVE: "Competitive", ENTRANCE: "Entrance" };
const CATEGORY_COLORS: Record<ExamCategory, React.CSSProperties> = {
  BOARD:       { background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe" },
  COMPETITIVE: { background: "#f5f3ff", color: "#7c3aed", border: "1px solid #ddd6fe" },
  ENTRANCE:    { background: "#fffbeb", color: "#d97706", border: "1px solid #fde68a" },
};

function TargetExamsTab({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(true);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ code: "", name: "", category: "BOARD" as ExamCategory });
  const [editForm, setEditForm] = useState({ code: "", name: "", category: "BOARD" as ExamCategory });

  const { data: exams = [], isLoading } = useQuery({ queryKey: ["target-exams", showAll], queryFn: () => api.get(`/api/v1/academics/target-exams?all=${showAll}`).then(r => r.data.data) });
  const createMut = useMutation({ mutationFn: () => api.post("/api/v1/academics/target-exams", form), onSuccess: () => { toast.success("Exam created"); setAdding(false); setForm({ code: "", name: "", category: "BOARD" }); qc.invalidateQueries({ queryKey: ["target-exams"] }); }, onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed") });
  const updateMut = useMutation({ mutationFn: (id: string) => api.patch(`/api/v1/academics/target-exams/${id}`, editForm), onSuccess: () => { toast.success("Updated"); setEditId(null); qc.invalidateQueries({ queryKey: ["target-exams"] }); }, onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed") });
  const toggleMut = useMutation({ mutationFn: (id: string) => api.patch(`/api/v1/academics/target-exams/${id}/toggle`, {}), onSuccess: () => qc.invalidateQueries({ queryKey: ["target-exams"] }), onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed") });
  const deleteMut = useMutation({ mutationFn: (id: string) => api.delete(`/api/v1/academics/target-exams/${id}`), onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["target-exams"] }); }, onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed") });

  const filtered = (exams as any[]).filter(e => `${e.code} ${e.name}`.toLowerCase().includes(search.toLowerCase()));
  const activeCount = (exams as any[]).filter(e => e.isActive).length;
  const inactiveCount = (exams as any[]).filter(e => !e.isActive).length;

  return (
    <>
      <SectionHero icon="TE" title="Target Exams" subtitle="Define JEE, NEET, Foundation, board, and custom exam goals." canEdit={canEdit} onNew={() => setAdding(true)} newLabel="New Exam" />
      <StatCards cards={[{ label: "Active Exams", value: activeCount }, { label: "Total", value: exams.length }, { label: "Inactive", value: inactiveCount }]} />
      <SectionToolbar search={search} onSearch={setSearch} showAll={showAll} onShowAll={setShowAll} showAllLabel="Show inactive" />
      {adding && (
        <div style={addCard}>
          <p style={addTitle}>New Target Exam</p>
          <div className="grid grid-cols-3 gap-3" style={{ marginBottom: 12 }}>
            <div><label style={{ fontSize: 11, fontWeight: 600, color: D.muted, display: "block", marginBottom: 4 }}>Code *</label><Input placeholder="e.g. JEE_MAIN" value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} /></div>
            <div><label style={{ fontSize: 11, fontWeight: 600, color: D.muted, display: "block", marginBottom: 4 }}>Name *</label><Input placeholder="e.g. JEE Main" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><label style={{ fontSize: 11, fontWeight: 600, color: D.muted, display: "block", marginBottom: 4 }}>Category *</label>
              <Select value={form.category} onChange={e => setForm({ ...form, category: e.target.value as ExamCategory })}>{EXAM_CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}</Select>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
            <button onClick={() => setAdding(false)} style={{ padding: "7px 14px", borderRadius: 10, border: `1px solid ${D.line}`, background: "#fff", color: D.muted, fontSize: 12, cursor: "pointer" }}>Cancel</button>
            <button onClick={() => createMut.mutate()} disabled={!form.code || !form.name || createMut.isPending} style={{ padding: "7px 14px", borderRadius: 10, background: D.nav2, color: "#fff", border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: (!form.code || !form.name || createMut.isPending) ? 0.6 : 1 }}>Create</button>
          </div>
        </div>
      )}
      {isLoading ? <SkeletonRows /> : filtered.length === 0 ? (
        <EmptyBlock icon="TE" title="No target exams configured" desc="Add exam goals so courses, batches, assessments, and analytics can be grouped by outcome." canEdit={canEdit} onNew={() => setAdding(true)} newLabel="Create Target Exam" />
      ) : (
        <Table>
          <THead cols={["Code", "Name", "Category", "Status", ""]} />
          <tbody>
            {filtered.map((ex: any) => (
              <tr key={ex.id} style={rowStyle(!ex.isActive)}>
                <td style={tdStyle}>{editId === ex.id ? <Input value={editForm.code} onChange={e => setEditForm({ ...editForm, code: e.target.value.toUpperCase() })} style={{ maxWidth: 120 }} /> : <span style={{ fontFamily: "monospace", fontSize: 12, background: D.bg, padding: "2px 8px", borderRadius: 6, color: D.ink }}>{ex.code}</span>}</td>
                <td style={tdStyle}>{editId === ex.id ? <Input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} style={{ maxWidth: 200 }} /> : <span style={{ fontWeight: 500, color: D.ink }}>{ex.name}</span>}</td>
                <td style={tdStyle}>
                  {editId === ex.id
                    ? <Select value={editForm.category} onChange={e => setEditForm({ ...editForm, category: e.target.value as ExamCategory })} style={{ maxWidth: 150 }}>{EXAM_CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}</Select>
                    : <span style={{ display: "inline-flex", borderRadius: 20, padding: "2px 8px", fontSize: 11, fontWeight: 500, ...CATEGORY_COLORS[ex.category as ExamCategory] }}>{CATEGORY_LABELS[ex.category as ExamCategory] ?? ex.category}</span>}
                </td>
                <td style={tdStyle}>{canEdit ? <ActiveToggle isActive={ex.isActive} onToggle={() => toggleMut.mutate(ex.id)} /> : <span style={{ fontSize: 12, color: ex.isActive ? "#16a34a" : D.muted }}>{ex.isActive ? "Active" : "Inactive"}</span>}</td>
                <td style={tdStyle}>
                  {editId === ex.id
                    ? <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}><SaveCancel onSave={() => updateMut.mutate(ex.id)} onCancel={() => setEditId(null)} disabled={!editForm.code || !editForm.name || updateMut.isPending} /></div>
                    : <ActionButtons canEdit={canEdit} onEdit={() => { setEditId(ex.id); setEditForm({ code: ex.code, name: ex.name, category: ex.category }); }} onDelete={() => { if (confirm(`Delete "${ex.name}"?`)) deleteMut.mutate(ex.id); }} />}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}

// ── Grades Tab ─────────────────────────────────────────────────────────────────
function GradesTab({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(true);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ name: "", sortOrder: 0 });
  const [editForm, setEditForm] = useState({ name: "", sortOrder: 0 });

  const { data: grades = [], isLoading } = useQuery({ queryKey: ["grades", showAll], queryFn: () => api.get(`/api/v1/academics/grades?all=${showAll}`).then(r => r.data.data) });
  const createMut = useMutation({ mutationFn: () => api.post("/api/v1/academics/grades", form), onSuccess: () => { toast.success("Grade created"); setAdding(false); setForm({ name: "", sortOrder: 0 }); qc.invalidateQueries({ queryKey: ["grades"] }); }, onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed") });
  const updateMut = useMutation({ mutationFn: (id: string) => api.patch(`/api/v1/academics/grades/${id}`, editForm), onSuccess: () => { toast.success("Updated"); setEditId(null); qc.invalidateQueries({ queryKey: ["grades"] }); }, onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed") });
  const toggleMut = useMutation({ mutationFn: (id: string) => api.patch(`/api/v1/academics/grades/${id}/toggle`, {}), onSuccess: () => qc.invalidateQueries({ queryKey: ["grades"] }), onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed") });
  const deleteMut = useMutation({ mutationFn: (id: string) => api.delete(`/api/v1/academics/grades/${id}`), onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["grades"] }); }, onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed") });

  const filtered = (grades as any[]).filter(g => g.name.toLowerCase().includes(search.toLowerCase()));
  const activeCount = (grades as any[]).filter(g => g.isActive).length;

  return (
    <>
      <SectionHero icon="GR" title="Grades" subtitle="Set grade levels used for students, batches, courses, and reports." canEdit={canEdit} onNew={() => setAdding(true)} newLabel="New Grade" />
      <StatCards cards={[{ label: "Active Grades", value: activeCount }, { label: "Total Grades", value: grades.length }, { label: "Archived", value: grades.length - activeCount }]} />
      <SectionToolbar search={search} onSearch={setSearch} showAll={showAll} onShowAll={setShowAll} showAllLabel="Show inactive" />
      {adding && (
        <div style={addCard}>
          <p style={addTitle}>New Grade</p>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
            <div style={{ flex: 1, maxWidth: 200 }}><label style={{ fontSize: 11, fontWeight: 600, color: D.muted, display: "block", marginBottom: 4 }}>Grade Name *</label><Input placeholder="e.g. Grade 11" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div style={{ width: 100 }}><label style={{ fontSize: 11, fontWeight: 600, color: D.muted, display: "block", marginBottom: 4 }}>Sort Order</label><Input type="number" min={0} value={form.sortOrder} onChange={e => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })} /></div>
            <SaveCancel onSave={() => createMut.mutate()} onCancel={() => { setAdding(false); setForm({ name: "", sortOrder: 0 }); }} disabled={!form.name || createMut.isPending} />
          </div>
        </div>
      )}
      {isLoading ? <SkeletonRows /> : filtered.length === 0 ? (
        <EmptyBlock icon="GR" title="No grades configured" desc="Add grades like 8, 9, 10, 11, 12, or Foundation levels to classify students and batches." canEdit={canEdit} onNew={() => setAdding(true)} newLabel="Create Grade" />
      ) : (
        <Table>
          <THead cols={["Grade", "Sort Order", "Status", ""]} />
          <tbody>
            {filtered.map((g: any) => (
              <tr key={g.id} style={rowStyle(!g.isActive)}>
                <td style={tdStyle}>{editId === g.id ? <Input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} style={{ maxWidth: 150 }} /> : <span style={{ fontWeight: 600, color: D.ink }}>{g.name}</span>}</td>
                <td style={tdStyle}>{editId === g.id ? <Input type="number" min={0} value={editForm.sortOrder} onChange={e => setEditForm({ ...editForm, sortOrder: parseInt(e.target.value) || 0 })} style={{ maxWidth: 80 }} /> : <span style={{ color: D.muted }}>{g.sortOrder}</span>}</td>
                <td style={tdStyle}>{canEdit ? <ActiveToggle isActive={g.isActive} onToggle={() => toggleMut.mutate(g.id)} /> : <span style={{ fontSize: 12, color: g.isActive ? "#16a34a" : D.muted }}>{g.isActive ? "Active" : "Inactive"}</span>}</td>
                <td style={tdStyle}>
                  {editId === g.id
                    ? <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}><SaveCancel onSave={() => updateMut.mutate(g.id)} onCancel={() => setEditId(null)} disabled={!editForm.name || updateMut.isPending} /></div>
                    : <ActionButtons canEdit={canEdit} onEdit={() => { setEditId(g.id); setEditForm({ name: g.name, sortOrder: g.sortOrder }); }} onDelete={() => { if (confirm(`Delete grade "${g.name}"?`)) deleteMut.mutate(g.id); }} />}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}

// ── Schools Tab ────────────────────────────────────────────────────────────────
function SchoolsTab({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(true);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ name: "", city: "", board: "" });
  const [editForm, setEditForm] = useState({ name: "", city: "", board: "" });

  const { data: schools = [], isLoading } = useQuery({ queryKey: ["schools", showAll], queryFn: () => api.get(`/api/v1/academics/schools?all=${showAll}`).then(r => r.data.data) });
  const createMut = useMutation({ mutationFn: () => api.post("/api/v1/academics/schools", form), onSuccess: () => { toast.success("School created"); setAdding(false); setForm({ name: "", city: "", board: "" }); qc.invalidateQueries({ queryKey: ["schools"] }); }, onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed") });
  const updateMut = useMutation({ mutationFn: (id: string) => api.patch(`/api/v1/academics/schools/${id}`, editForm), onSuccess: () => { toast.success("Updated"); setEditId(null); qc.invalidateQueries({ queryKey: ["schools"] }); }, onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed") });
  const toggleMut = useMutation({ mutationFn: (id: string) => api.patch(`/api/v1/academics/schools/${id}/toggle`, {}), onSuccess: () => qc.invalidateQueries({ queryKey: ["schools"] }), onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed") });
  const deleteMut = useMutation({ mutationFn: (id: string) => api.delete(`/api/v1/academics/schools/${id}`), onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["schools"] }); }, onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed") });

  const filtered = (schools as any[]).filter(s => `${s.name} ${s.city ?? ""} ${s.board ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  const activeCount = (schools as any[]).filter(s => s.isActive).length;

  return (
    <>
      <SectionHero icon="SC" title="Schools" subtitle="Maintain source schools for student profiles and MIS reporting." canEdit={canEdit} onNew={() => setAdding(true)} newLabel="New School" />
      <StatCards cards={[{ label: "Total Schools", value: schools.length }, { label: "Active", value: activeCount }, { label: "Inactive", value: schools.length - activeCount }]} />
      <SectionToolbar search={search} onSearch={setSearch} showAll={showAll} onShowAll={setShowAll} showAllLabel="Show inactive" />
      {adding && (
        <div style={addCard}>
          <p style={addTitle}>New School</p>
          <div className="grid grid-cols-3 gap-3" style={{ marginBottom: 12 }}>
            <div><label style={{ fontSize: 11, fontWeight: 600, color: D.muted, display: "block", marginBottom: 4 }}>School Name *</label><Input placeholder="e.g. Delhi Public School" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><label style={{ fontSize: 11, fontWeight: 600, color: D.muted, display: "block", marginBottom: 4 }}>City</label><Input placeholder="e.g. Mumbai" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} /></div>
            <div><label style={{ fontSize: 11, fontWeight: 600, color: D.muted, display: "block", marginBottom: 4 }}>Board</label><Input placeholder="e.g. CBSE, ICSE" value={form.board} onChange={e => setForm({ ...form, board: e.target.value })} /></div>
          </div>
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
            <button onClick={() => setAdding(false)} style={{ padding: "7px 14px", borderRadius: 10, border: `1px solid ${D.line}`, background: "#fff", color: D.muted, fontSize: 12, cursor: "pointer" }}>Cancel</button>
            <button onClick={() => createMut.mutate()} disabled={!form.name || createMut.isPending} style={{ padding: "7px 14px", borderRadius: 10, background: D.nav2, color: "#fff", border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: (!form.name || createMut.isPending) ? 0.6 : 1 }}>Create</button>
          </div>
        </div>
      )}
      {isLoading ? <SkeletonRows /> : filtered.length === 0 ? (
        <EmptyBlock icon="SC" title="No schools added" desc="Add schools and colleges to analyze student source, partnerships, and school-wise strength." canEdit={canEdit} onNew={() => setAdding(true)} newLabel="Create School" />
      ) : (
        <Table>
          <THead cols={["School Name", "City", "Board", "Status", ""]} />
          <tbody>
            {filtered.map((s: any) => (
              <tr key={s.id} style={rowStyle(!s.isActive)}>
                <td style={tdStyle}>{editId === s.id ? <Input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} style={{ maxWidth: 220 }} /> : <span style={{ fontWeight: 600, color: D.ink }}>{s.name}</span>}</td>
                <td style={tdStyle}>{editId === s.id ? <Input value={editForm.city} onChange={e => setEditForm({ ...editForm, city: e.target.value })} style={{ maxWidth: 140 }} /> : <span style={{ color: D.muted }}>{s.city ?? <span style={{ color: D.line }}>—</span>}</span>}</td>
                <td style={tdStyle}>
                  {editId === s.id ? <Input value={editForm.board} onChange={e => setEditForm({ ...editForm, board: e.target.value })} style={{ maxWidth: 120 }} />
                    : s.board ? <span style={{ display: "inline-flex", borderRadius: 20, background: D.bg, padding: "2px 8px", fontSize: 11, fontWeight: 500, color: D.muted }}>{s.board}</span> : <span style={{ color: D.line }}>—</span>}
                </td>
                <td style={tdStyle}>{canEdit ? <ActiveToggle isActive={s.isActive} onToggle={() => toggleMut.mutate(s.id)} /> : <span style={{ fontSize: 12, color: s.isActive ? "#16a34a" : D.muted }}>{s.isActive ? "Active" : "Inactive"}</span>}</td>
                <td style={tdStyle}>
                  {editId === s.id
                    ? <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}><SaveCancel onSave={() => updateMut.mutate(s.id)} onCancel={() => setEditId(null)} disabled={!editForm.name || updateMut.isPending} /></div>
                    : <ActionButtons canEdit={canEdit} onEdit={() => { setEditId(s.id); setEditForm({ name: s.name, city: s.city ?? "", board: s.board ?? "" }); }} onDelete={() => { if (confirm(`Delete "${s.name}"?`)) deleteMut.mutate(s.id); }} />}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}

// ── Subjects Tab ───────────────────────────────────────────────────────────────
function SubjectsTab({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(true);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ code: "", name: "", description: "" });
  const [editForm, setEditForm] = useState({ code: "", name: "", description: "" });

  const { data: subjects = [], isLoading } = useQuery({ queryKey: ["subjects", showAll], queryFn: () => api.get(`/api/v1/academics/subjects?all=${showAll}`).then(r => r.data.data) });
  const createMut = useMutation({ mutationFn: () => api.post("/api/v1/academics/subjects", form), onSuccess: () => { toast.success("Subject created"); setAdding(false); setForm({ code: "", name: "", description: "" }); qc.invalidateQueries({ queryKey: ["subjects"] }); }, onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed") });
  const updateMut = useMutation({ mutationFn: (id: string) => api.patch(`/api/v1/academics/subjects/${id}`, editForm), onSuccess: () => { toast.success("Updated"); setEditId(null); qc.invalidateQueries({ queryKey: ["subjects"] }); }, onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed") });
  const toggleMut = useMutation({ mutationFn: (id: string) => api.patch(`/api/v1/academics/subjects/${id}/toggle`, {}), onSuccess: () => qc.invalidateQueries({ queryKey: ["subjects"] }), onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed") });
  const deleteMut = useMutation({ mutationFn: (id: string) => api.delete(`/api/v1/academics/subjects/${id}`), onSuccess: () => { toast.success("Subject deleted"); qc.invalidateQueries({ queryKey: ["subjects"] }); }, onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed") });

  const filtered = (subjects as any[]).filter(s => `${s.code} ${s.name}`.toLowerCase().includes(search.toLowerCase()));
  const activeCount = (subjects as any[]).filter(s => s.isActive).length;

  return (
    <>
      <SectionHero icon="SB" title="Subjects" subtitle="Manage subjects used in schedules, assignments, assessments, and batches." canEdit={canEdit} onNew={() => setAdding(true)} newLabel="New Subject" />
      <StatCards cards={[{ label: "Active Subjects", value: activeCount }, { label: "Total Subjects", value: subjects.length }, { label: "Inactive", value: subjects.length - activeCount }]} />
      <SectionToolbar search={search} onSearch={setSearch} showAll={showAll} onShowAll={setShowAll} showAllLabel="Show inactive" />
      {adding && (
        <div style={addCard}>
          <p style={addTitle}>New Subject</p>
          <div className="grid grid-cols-3 gap-3" style={{ marginBottom: 12 }}>
            <div><label style={{ fontSize: 11, fontWeight: 600, color: D.muted, display: "block", marginBottom: 4 }}>Code *</label><Input placeholder="e.g. MATH" value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} /></div>
            <div><label style={{ fontSize: 11, fontWeight: 600, color: D.muted, display: "block", marginBottom: 4 }}>Subject Name *</label><Input placeholder="e.g. Mathematics" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><label style={{ fontSize: 11, fontWeight: 600, color: D.muted, display: "block", marginBottom: 4 }}>Description</label><Input placeholder="Optional" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
          </div>
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
            <button onClick={() => setAdding(false)} style={{ padding: "7px 14px", borderRadius: 10, border: `1px solid ${D.line}`, background: "#fff", color: D.muted, fontSize: 12, cursor: "pointer" }}>Cancel</button>
            <button onClick={() => createMut.mutate()} disabled={!form.code || !form.name || createMut.isPending} style={{ padding: "7px 14px", borderRadius: 10, background: D.nav2, color: "#fff", border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: (!form.code || !form.name || createMut.isPending) ? 0.6 : 1 }}>Create</button>
          </div>
        </div>
      )}
      {isLoading ? <SkeletonRows /> : filtered.length === 0 ? (
        <EmptyBlock icon="SB" title="No subjects yet" desc="Create subjects such as Physics, Chemistry, Mathematics, Biology, or English to power academic operations." canEdit={canEdit} onNew={() => setAdding(true)} newLabel="Create Subject" />
      ) : (
        <Table>
          <THead cols={["Code", "Subject Name", "Batches", "Status", ""]} />
          <tbody>
            {filtered.map((s: any) => (
              <tr key={s.id} style={rowStyle(!s.isActive)}>
                <td style={tdStyle}>{editId === s.id ? <Input value={editForm.code} onChange={e => setEditForm({ ...editForm, code: e.target.value.toUpperCase() })} style={{ maxWidth: 100 }} /> : <span style={{ fontFamily: "monospace", fontSize: 12, background: D.bg, padding: "2px 8px", borderRadius: 6, color: D.ink }}>{s.code}</span>}</td>
                <td style={tdStyle}>
                  {editId === s.id ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <Input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} style={{ maxWidth: 220 }} />
                      <Input value={editForm.description} placeholder="Description" onChange={e => setEditForm({ ...editForm, description: e.target.value })} style={{ maxWidth: 220 }} />
                    </div>
                  ) : (
                    <div><p style={{ margin: 0, fontWeight: 500, color: D.ink }}>{s.name}</p>{s.description && <p style={{ margin: "2px 0 0", fontSize: 11, color: D.muted }}>{s.description}</p>}</div>
                  )}
                </td>
                <td style={tdStyle}><span style={{ fontSize: 12, color: D.muted }}>{s._count?.batchSubjects ?? 0} batch{(s._count?.batchSubjects ?? 0) !== 1 ? "es" : ""}</span></td>
                <td style={tdStyle}>{canEdit ? <ActiveToggle isActive={s.isActive} onToggle={() => toggleMut.mutate(s.id)} /> : <span style={{ fontSize: 12, color: s.isActive ? "#16a34a" : D.muted }}>{s.isActive ? "Active" : "Inactive"}</span>}</td>
                <td style={tdStyle}>
                  {editId === s.id
                    ? <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}><SaveCancel onSave={() => updateMut.mutate(s.id)} onCancel={() => setEditId(null)} disabled={!editForm.code || !editForm.name || updateMut.isPending} /></div>
                    : <ActionButtons canEdit={canEdit} onEdit={() => { setEditId(s.id); setEditForm({ code: s.code, name: s.name, description: s.description ?? "" }); }} onDelete={s._count?.batchSubjects === 0 ? () => { if (confirm(`Delete subject "${s.name}"?`)) deleteMut.mutate(s.id); } : undefined} />}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}

// ── Courses Tab ────────────────────────────────────────────────────────────────
function CoursesTab({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(true);
  const [search, setSearch] = useState("");
  const emptyForm = () => ({ name: "", code: "", description: "", duration: "", fee: "" });
  const [form, setForm] = useState(emptyForm());
  const [editForm, setEditForm] = useState(emptyForm());

  const { data: courses = [], isLoading } = useQuery({ queryKey: ["courses", showAll], queryFn: () => api.get(`/api/v1/academics/courses?all=${showAll}`).then(r => r.data.data) });
  const createMut = useMutation({ mutationFn: () => api.post("/api/v1/academics/courses", { ...form, fee: form.fee ? parseFloat(form.fee) : undefined }), onSuccess: () => { toast.success("Course created"); setAdding(false); setForm(emptyForm()); qc.invalidateQueries({ queryKey: ["courses"] }); }, onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed") });
  const updateMut = useMutation({ mutationFn: (id: string) => api.patch(`/api/v1/academics/courses/${id}`, { ...editForm, fee: editForm.fee ? parseFloat(editForm.fee) : undefined }), onSuccess: () => { toast.success("Updated"); setEditId(null); qc.invalidateQueries({ queryKey: ["courses"] }); }, onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed") });
  const toggleMut = useMutation({ mutationFn: (id: string) => api.patch(`/api/v1/academics/courses/${id}/toggle`, {}), onSuccess: () => qc.invalidateQueries({ queryKey: ["courses"] }), onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed") });
  const deleteMut = useMutation({ mutationFn: (id: string) => api.delete(`/api/v1/academics/courses/${id}`), onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["courses"] }); }, onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed") });

  const filtered = (courses as any[]).filter(c => `${c.name} ${c.code ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  const activeCount = (courses as any[]).filter(c => c.isActive).length;
  const feeMapped = (courses as any[]).filter(c => c.fee != null).length;

  return (
    <>
      <SectionHero icon="CR" title="Courses" subtitle="Build course offerings with grade, subject, target exam, and fee mappings." canEdit={canEdit} onNew={() => setAdding(true)} newLabel="New Course" />
      <StatCards cards={[{ label: "Active Courses", value: activeCount }, { label: "Total", value: courses.length }, { label: "Fee Mapped", value: feeMapped }]} />
      <SectionToolbar search={search} onSearch={setSearch} showAll={showAll} onShowAll={setShowAll} showAllLabel="Show inactive" />
      {adding && (
        <div style={addCard}>
          <p style={addTitle}>New Course</p>
          <div className="grid grid-cols-2 gap-3" style={{ marginBottom: 12 }}>
            <div><label style={{ fontSize: 11, fontWeight: 600, color: D.muted, display: "block", marginBottom: 4 }}>Course Name *</label><Input placeholder="e.g. JEE Mains Batch" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><label style={{ fontSize: 11, fontWeight: 600, color: D.muted, display: "block", marginBottom: 4 }}>Code</label><Input placeholder="e.g. JEE-M-2Y" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} /></div>
            <div><label style={{ fontSize: 11, fontWeight: 600, color: D.muted, display: "block", marginBottom: 4 }}>Duration</label><Input placeholder="e.g. 2 Years" value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })} /></div>
            <div><label style={{ fontSize: 11, fontWeight: 600, color: D.muted, display: "block", marginBottom: 4 }}>Fee (₹)</label><Input type="number" min="0" placeholder="0.00" value={form.fee} onChange={e => setForm({ ...form, fee: e.target.value })} /></div>
            <div className="col-span-2"><label style={{ fontSize: 11, fontWeight: 600, color: D.muted, display: "block", marginBottom: 4 }}>Description</label><Input placeholder="Optional" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
          </div>
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
            <button onClick={() => { setAdding(false); setForm(emptyForm()); }} style={{ padding: "7px 14px", borderRadius: 10, border: `1px solid ${D.line}`, background: "#fff", color: D.muted, fontSize: 12, cursor: "pointer" }}>Cancel</button>
            <button onClick={() => createMut.mutate()} disabled={!form.name || createMut.isPending} style={{ padding: "7px 14px", borderRadius: 10, background: D.nav2, color: "#fff", border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: (!form.name || createMut.isPending) ? 0.6 : 1 }}>Create</button>
          </div>
        </div>
      )}
      {isLoading ? <SkeletonRows /> : filtered.length === 0 ? (
        <EmptyBlock icon="CR" title="No courses created" desc="Courses connect academic year, grade, target exams, subjects, and fees into one admission-ready offering." canEdit={canEdit} onNew={() => setAdding(true)} newLabel="Create Course" />
      ) : (
        <Table>
          <THead cols={["Course", "Code", "Duration", "Fee", "Status", ""]} />
          <tbody>
            {filtered.map((c: any) => (
              <tr key={c.id} style={rowStyle(!c.isActive)}>
                <td style={tdStyle}>
                  {editId === c.id ? <Input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} style={{ maxWidth: 220 }} />
                    : <div><p style={{ margin: 0, fontWeight: 600, color: D.ink }}>{c.name}</p>{c.description && <p style={{ margin: "2px 0 0", fontSize: 11, color: D.muted }}>{c.description}</p>}</div>}
                </td>
                <td style={tdStyle}>{editId === c.id ? <Input value={editForm.code} onChange={e => setEditForm({ ...editForm, code: e.target.value })} style={{ maxWidth: 100 }} /> : c.code ? <span style={{ fontFamily: "monospace", fontSize: 12, background: D.bg, padding: "2px 8px", borderRadius: 6, color: D.ink }}>{c.code}</span> : <span style={{ color: D.line }}>—</span>}</td>
                <td style={tdStyle}>{editId === c.id ? <Input value={editForm.duration} onChange={e => setEditForm({ ...editForm, duration: e.target.value })} style={{ maxWidth: 100 }} /> : <span style={{ color: D.muted }}>{c.duration ?? <span style={{ color: D.line }}>—</span>}</span>}</td>
                <td style={tdStyle}>{editId === c.id ? <Input type="number" min="0" value={editForm.fee} onChange={e => setEditForm({ ...editForm, fee: e.target.value })} style={{ maxWidth: 100 }} /> : c.fee != null ? <span style={{ fontWeight: 600, color: D.ink }}>₹{Number(c.fee).toLocaleString()}</span> : <span style={{ color: D.line }}>—</span>}</td>
                <td style={tdStyle}>{canEdit ? <ActiveToggle isActive={c.isActive} onToggle={() => toggleMut.mutate(c.id)} /> : <span style={{ fontSize: 12, color: c.isActive ? "#16a34a" : D.muted }}>{c.isActive ? "Active" : "Inactive"}</span>}</td>
                <td style={tdStyle}>
                  {editId === c.id
                    ? <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}><SaveCancel onSave={() => updateMut.mutate(c.id)} onCancel={() => setEditId(null)} disabled={!editForm.name || updateMut.isPending} /></div>
                    : <ActionButtons canEdit={canEdit} onEdit={() => { setEditId(c.id); setEditForm({ name: c.name, code: c.code ?? "", description: c.description ?? "", duration: c.duration ?? "", fee: c.fee != null ? String(c.fee) : "" }); }} onDelete={() => { if (confirm(`Delete course "${c.name}"?`)) deleteMut.mutate(c.id); }} />}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}

// ── City (Locations) Tab ───────────────────────────────────────────────────────
function LocationsTab({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(true);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [editName, setEditName] = useState("");

  const { data: locations = [], isLoading } = useQuery({ queryKey: ["locations", showAll], queryFn: () => api.get(`/api/v1/academics/locations?all=${showAll}`).then(r => r.data.data) });
  const createMut = useMutation({ mutationFn: () => api.post("/api/v1/academics/locations", { name }), onSuccess: () => { toast.success("City created"); setAdding(false); setName(""); qc.invalidateQueries({ queryKey: ["locations"] }); }, onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed") });
  const updateMut = useMutation({ mutationFn: (id: string) => api.patch(`/api/v1/academics/locations/${id}`, { name: editName }), onSuccess: () => { toast.success("Updated"); setEditId(null); qc.invalidateQueries({ queryKey: ["locations"] }); }, onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed") });
  const toggleMut = useMutation({ mutationFn: (id: string) => api.patch(`/api/v1/academics/locations/${id}/toggle`, {}), onSuccess: () => qc.invalidateQueries({ queryKey: ["locations"] }), onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed") });
  const deleteMut = useMutation({ mutationFn: (id: string) => api.delete(`/api/v1/academics/locations/${id}`), onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["locations"] }); }, onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed") });

  const filtered = (locations as any[]).filter(l => l.name.toLowerCase().includes(search.toLowerCase()));
  const activeCount = (locations as any[]).filter(l => l.isActive).length;

  return (
    <>
      <SectionHero icon="CT" title="City" subtitle="Manage cities for centres, students, batches, and city-wise reporting." canEdit={canEdit} onNew={() => setAdding(true)} newLabel="New City" />
      <StatCards cards={[{ label: "Active Cities", value: activeCount }, { label: "Total Cities", value: locations.length }, { label: "Inactive", value: locations.length - activeCount }]} />
      <SectionToolbar search={search} onSearch={setSearch} showAll={showAll} onShowAll={setShowAll} showAllLabel="Show inactive" />
      {adding && (
        <div style={addCard}>
          <p style={addTitle}>New City</p>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Input placeholder="e.g. Kota, Jaipur, Delhi" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && name && createMut.mutate()} style={{ maxWidth: 280 }} />
            <SaveCancel onSave={() => createMut.mutate()} onCancel={() => { setAdding(false); setName(""); }} disabled={!name || createMut.isPending} />
          </div>
        </div>
      )}
      {isLoading ? <SkeletonRows /> : filtered.length === 0 ? (
        <EmptyBlock icon="CT" title="No cities configured" desc="Add cities before creating centres, assigning locations, and running city-wise MIS reports." canEdit={canEdit} onNew={() => setAdding(true)} newLabel="Create City" />
      ) : (
        <Table>
          <THead cols={["City", "Status", ""]} />
          <tbody>
            {filtered.map((loc: any) => (
              <tr key={loc.id} style={rowStyle(!loc.isActive)}>
                <td style={tdStyle}>
                  {editId === loc.id
                    ? <Input value={editName} onChange={e => setEditName(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && editName) updateMut.mutate(loc.id); if (e.key === "Escape") setEditId(null); }} style={{ maxWidth: 260 }} autoFocus />
                    : <div style={{ display: "flex", alignItems: "center", gap: 6 }}><MapPin size={13} style={{ color: D.muted, flexShrink: 0 }} /><span style={{ fontWeight: 600, color: D.ink }}>{loc.name}</span></div>}
                </td>
                <td style={tdStyle}>{canEdit ? <ActiveToggle isActive={loc.isActive} onToggle={() => toggleMut.mutate(loc.id)} /> : <span style={{ fontSize: 12, color: loc.isActive ? "#16a34a" : D.muted }}>{loc.isActive ? "Active" : "Inactive"}</span>}</td>
                <td style={tdStyle}>
                  {editId === loc.id
                    ? <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}><SaveCancel onSave={() => updateMut.mutate(loc.id)} onCancel={() => setEditId(null)} disabled={!editName || updateMut.isPending} /></div>
                    : <ActionButtons canEdit={canEdit} onEdit={() => { setEditId(loc.id); setEditName(loc.name); }} onDelete={() => { if (confirm(`Delete city "${loc.name}"?`)) deleteMut.mutate(loc.id); }} />}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}

// ── Centres Tab ────────────────────────────────────────────────────────────────
function CentreTab({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(true);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ name: "", cityId: "" });
  const [editForm, setEditForm] = useState({ name: "", cityId: "" });

  const { data: centres = [], isLoading } = useQuery({ queryKey: ["centres", showAll], queryFn: () => api.get(`/api/v1/academics/centres?all=${showAll}`).then(r => r.data.data) });
  const { data: cities = [] } = useQuery({ queryKey: ["locations", true], queryFn: () => api.get("/api/v1/academics/locations?all=true").then(r => r.data.data) });
  const createMut = useMutation({ mutationFn: () => api.post("/api/v1/academics/centres", { name: form.name, cityId: form.cityId || null }), onSuccess: () => { toast.success("Centre created"); setAdding(false); setForm({ name: "", cityId: "" }); qc.invalidateQueries({ queryKey: ["centres"] }); }, onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed") });
  const updateMut = useMutation({ mutationFn: (id: string) => api.patch(`/api/v1/academics/centres/${id}`, { name: editForm.name, cityId: editForm.cityId || null }), onSuccess: () => { toast.success("Updated"); setEditId(null); qc.invalidateQueries({ queryKey: ["centres"] }); }, onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed") });
  const toggleMut = useMutation({ mutationFn: (id: string) => api.patch(`/api/v1/academics/centres/${id}/toggle`, {}), onSuccess: () => qc.invalidateQueries({ queryKey: ["centres"] }), onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed") });
  const deleteMut = useMutation({ mutationFn: (id: string) => api.delete(`/api/v1/academics/centres/${id}`), onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["centres"] }); }, onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed") });

  const filtered = (centres as any[]).filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
  const activeCount = (centres as any[]).filter(c => c.isActive).length;

  return (
    <>
      <SectionHero icon="CE" title="Centres" subtitle="Configure physical centres, classrooms, and operational locations." canEdit={canEdit} onNew={() => setAdding(true)} newLabel="New Centre" />
      <StatCards cards={[{ label: "Active Centres", value: activeCount }, { label: "Total Centres", value: centres.length }, { label: "Inactive", value: centres.length - activeCount }]} />
      <SectionToolbar search={search} onSearch={setSearch} showAll={showAll} onShowAll={setShowAll} showAllLabel="Show inactive" />
      {adding && (
        <div style={addCard}>
          <p style={addTitle}>New Centre</p>
          <div className="grid grid-cols-2 gap-3" style={{ marginBottom: 12 }}>
            <div><label style={{ fontSize: 11, fontWeight: 600, color: D.muted, display: "block", marginBottom: 4 }}>Centre Name *</label><Input placeholder="e.g. Centum Kota Main" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><label style={{ fontSize: 11, fontWeight: 600, color: D.muted, display: "block", marginBottom: 4 }}>City (optional)</label>
              <Select value={form.cityId} onChange={e => setForm({ ...form, cityId: e.target.value })}>
                <option value="">— Select city —</option>
                {(cities as any[]).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
            <button onClick={() => { setAdding(false); setForm({ name: "", cityId: "" }); }} style={{ padding: "7px 14px", borderRadius: 10, border: `1px solid ${D.line}`, background: "#fff", color: D.muted, fontSize: 12, cursor: "pointer" }}>Cancel</button>
            <button onClick={() => createMut.mutate()} disabled={!form.name || createMut.isPending} style={{ padding: "7px 14px", borderRadius: 10, background: D.nav2, color: "#fff", border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: (!form.name || createMut.isPending) ? 0.6 : 1 }}>Create</button>
          </div>
        </div>
      )}
      {isLoading ? <SkeletonRows /> : filtered.length === 0 ? (
        <EmptyBlock icon="CE" title="No centres added" desc="Create centres to manage classroom scheduling, batch locations, and city-wise operational capacity." canEdit={canEdit} onNew={() => setAdding(true)} newLabel="Create Centre" />
      ) : (
        <Table>
          <THead cols={["Centre", "City", "Status", ""]} />
          <tbody>
            {filtered.map((c: any) => (
              <tr key={c.id} style={rowStyle(!c.isActive)}>
                <td style={tdStyle}>
                  {editId === c.id ? <Input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} style={{ maxWidth: 240 }} autoFocus />
                    : <div style={{ display: "flex", alignItems: "center", gap: 6 }}><Landmark size={13} style={{ color: D.muted, flexShrink: 0 }} /><span style={{ fontWeight: 600, color: D.ink }}>{c.name}</span></div>}
                </td>
                <td style={tdStyle}>
                  {editId === c.id
                    ? <Select value={editForm.cityId} onChange={e => setEditForm({ ...editForm, cityId: e.target.value })} style={{ maxWidth: 160 }}><option value="">— None —</option>{(cities as any[]).map((city: any) => <option key={city.id} value={city.id}>{city.name}</option>)}</Select>
                    : c.city ? <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: D.muted }}><MapPin size={11} />{c.city.name}</span> : <span style={{ color: D.line }}>—</span>}
                </td>
                <td style={tdStyle}>{canEdit ? <ActiveToggle isActive={c.isActive} onToggle={() => toggleMut.mutate(c.id)} /> : <span style={{ fontSize: 12, color: c.isActive ? "#16a34a" : D.muted }}>{c.isActive ? "Active" : "Inactive"}</span>}</td>
                <td style={tdStyle}>
                  {editId === c.id
                    ? <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}><SaveCancel onSave={() => updateMut.mutate(c.id)} onCancel={() => setEditId(null)} disabled={!editForm.name || updateMut.isPending} /></div>
                    : <ActionButtons canEdit={canEdit} onEdit={() => { setEditId(c.id); setEditForm({ name: c.name, cityId: c.cityId ?? "" }); }} onDelete={() => { if (confirm(`Delete centre "${c.name}"?`)) deleteMut.mutate(c.id); }} />}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}

// ── Instalment Plans Tab ───────────────────────────────────────────────────────
type PlanItem = { _id: string; instalmentNo: number; label: string; amount: string; daysFromAdmission: string; dueDate: string; dueDateMode: "days" | "date" };
const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const mkItem = (no: number): PlanItem => ({ _id: genId(), instalmentNo: no, label: `Instalment ${no}`, amount: "", daysFromAdmission: "", dueDate: "", dueDateMode: "days" });

function PlanItemsEditor({ items, setItems }: { items: PlanItem[]; setItems: (items: PlanItem[]) => void }) {
  const add = () => setItems([...items, mkItem(items.length + 1)]);
  const remove = (_id: string) => setItems(items.filter(i => i._id !== _id).map((i, idx) => ({ ...i, instalmentNo: idx + 1 })));
  const update = (_id: string, field: keyof PlanItem, val: string) => setItems(items.map(i => i._id === _id ? { ...i, [field]: val } : i));
  const toggleMode = (_id: string) => setItems(items.map(i => i._id === _id ? { ...i, dueDateMode: i.dueDateMode === "days" ? "date" : "days", daysFromAdmission: "", dueDate: "" } : i));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.length > 0 && (
        <div className="hidden sm:grid grid-cols-[36px_1fr_110px_200px_32px] gap-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-1">
          <span>#</span><span>Label</span><span>Amount (₹)</span><span>Due Date</span><span />
        </div>
      )}
      {items.map(item => (
        <div key={item._id} className="flex flex-col gap-2 sm:grid sm:grid-cols-[36px_1fr_110px_200px_32px] sm:items-center border border-gray-100 rounded-lg p-2 sm:border-0 sm:rounded-none sm:p-0">
          <div className="flex items-center gap-2 sm:contents">
            <div style={{ width: 28, height: 28, borderRadius: 8, background: D.accent, border: `1px solid #c7d2fe`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: D.nav2, flexShrink: 0 }}>{item.instalmentNo}</div>
            <Input placeholder={`Instalment ${item.instalmentNo}`} value={item.label} onChange={e => update(item._id, "label", e.target.value)} className="flex-1 sm:flex-none" />
          </div>
          <div className="flex gap-2 sm:contents">
            <Input type="number" min="0" placeholder="0.00" value={item.amount} onChange={e => update(item._id, "amount", e.target.value)} className="w-[110px] sm:w-auto" />
            <div className="flex flex-1 items-center gap-1.5 sm:flex-none">
              <button type="button" onClick={() => toggleMode(item._id)} style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 4, borderRadius: 8, border: `1px solid ${item.dueDateMode === "date" ? "#c7d2fe" : D.line}`, padding: "6px 8px", fontSize: 10, fontWeight: 600, color: item.dueDateMode === "date" ? D.nav2 : D.muted, background: item.dueDateMode === "date" ? D.accent : "#fff", cursor: "pointer" }}>
                {item.dueDateMode === "date" ? "📅 Date" : "⏱ Days"}
              </button>
              {item.dueDateMode === "date"
                ? <Input type="date" value={item.dueDate} onChange={e => update(item._id, "dueDate", e.target.value)} className="flex-1" />
                : <Input type="number" min="0" placeholder="e.g. 30" value={item.daysFromAdmission} onChange={e => update(item._id, "daysFromAdmission", e.target.value)} className="flex-1" />}
            </div>
            <button type="button" onClick={() => remove(item._id)} style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 8, border: `1px solid ${D.line}`, background: "#fff", color: D.muted, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Trash2 size={13} /></button>
          </div>
        </div>
      ))}
      <button type="button" onClick={add} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 500, color: D.nav2, background: "none", border: "none", cursor: "pointer", padding: "4px 0" }}><Plus size={12} />Add instalment</button>
    </div>
  );
}

function InstalmentPlansTab({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const [filterCourseId, setFilterCourseId] = useState("");
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const emptyPlan = () => ({ name: "", courseId: "", description: "", items: [mkItem(1)] });
  const [form, setForm] = useState(emptyPlan());
  const [editForm, setEditForm] = useState(emptyPlan());

  const { data: courses = [] } = useQuery({ queryKey: ["courses"], queryFn: () => api.get("/api/v1/academics/courses").then(r => r.data.data) });
  const { data: plans = [], isLoading } = useQuery({ queryKey: ["instalment-plans", filterCourseId], queryFn: () => api.get(`/api/v1/academics/instalment-plans${filterCourseId ? `?courseId=${filterCourseId}` : ""}`).then(r => r.data.data) });

  const buildPayload = (f: typeof form) => ({
    name: f.name, courseId: f.courseId || null, description: f.description || undefined,
    items: f.items.filter(i => parseFloat(i.amount) > 0).map(i => ({
      instalmentNo: i.instalmentNo, label: i.label || undefined, amount: parseFloat(i.amount),
      daysFromAdmission: i.dueDateMode === "days" && i.daysFromAdmission ? parseInt(i.daysFromAdmission) : undefined,
      dueDate: i.dueDateMode === "date" && i.dueDate ? i.dueDate : undefined,
    })),
  });

  const createMut = useMutation({ mutationFn: () => api.post("/api/v1/academics/instalment-plans", buildPayload(form)), onSuccess: () => { toast.success("Plan created"); setAdding(false); setForm(emptyPlan()); qc.invalidateQueries({ queryKey: ["instalment-plans"] }); }, onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed") });
  const updateMut = useMutation({ mutationFn: (id: string) => api.patch(`/api/v1/academics/instalment-plans/${id}`, buildPayload(editForm)), onSuccess: () => { toast.success("Updated"); setEditId(null); qc.invalidateQueries({ queryKey: ["instalment-plans"] }); }, onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed") });
  const toggleMut = useMutation({ mutationFn: (id: string) => api.patch(`/api/v1/academics/instalment-plans/${id}/toggle`, {}), onSuccess: () => qc.invalidateQueries({ queryKey: ["instalment-plans"] }), onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed") });
  const deleteMut = useMutation({ mutationFn: (id: string) => api.delete(`/api/v1/academics/instalment-plans/${id}`), onSuccess: () => { toast.success("Plan deleted"); qc.invalidateQueries({ queryKey: ["instalment-plans"] }); }, onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed") });

  const filtered = (plans as any[]).filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
  const activeCount = (plans as any[]).filter(p => p.isActive).length;

  return (
    <>
      <SectionHero icon="IP" title="Instalment Plans" subtitle="Create fee payment schedules for admissions and course billing." canEdit={canEdit} onNew={() => setAdding(true)} newLabel="New Plan" />
      <StatCards cards={[{ label: "Active Plans", value: activeCount }, { label: "Total Plans", value: plans.length }, { label: "Inactive", value: plans.length - activeCount }]} />

      {/* Toolbar with course filter */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search plans..." style={{ flex: 1, minWidth: 160, minHeight: 42, borderRadius: 12, border: `1px solid ${D.line}`, padding: "0 14px", fontSize: 13, background: "#fff", outline: "none" }} />
        <Select value={filterCourseId} onChange={e => setFilterCourseId(e.target.value)} style={{ maxWidth: 220, minHeight: 42, borderRadius: 12 }}>
          <option value="">All courses</option>
          {(courses as any[]).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <button style={{ padding: "0 16px", height: 42, borderRadius: 12, border: `1px solid ${D.line}`, background: "#fff", color: D.muted, fontSize: 13, cursor: "pointer" }}>Export</button>
      </div>

      {adding && (
        <div style={addCard}>
          <p style={addTitle}>New Instalment Plan</p>
          <div className="grid grid-cols-2 gap-3" style={{ marginBottom: 16 }}>
            <div><label style={{ fontSize: 11, fontWeight: 600, color: D.muted, display: "block", marginBottom: 4 }}>Plan Name *</label><Input placeholder="e.g. JEE 2-Year Standard" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><label style={{ fontSize: 11, fontWeight: 600, color: D.muted, display: "block", marginBottom: 4 }}>Course (optional)</label>
              <Select value={form.courseId} onChange={e => setForm({ ...form, courseId: e.target.value })}>
                <option value="">Generic — applies to all courses</option>
                {(courses as any[]).filter((c: any) => c.isActive).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>
            <div className="col-span-2"><label style={{ fontSize: 11, fontWeight: 600, color: D.muted, display: "block", marginBottom: 4 }}>Description</label><Input placeholder="Optional" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: D.muted, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8 }}>Instalment Schedule</p>
            <PlanItemsEditor items={form.items} setItems={items => setForm({ ...form, items })} />
          </div>
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
            <button onClick={() => { setAdding(false); setForm(emptyPlan()); }} style={{ padding: "7px 14px", borderRadius: 10, border: `1px solid ${D.line}`, background: "#fff", color: D.muted, fontSize: 12, cursor: "pointer" }}>Cancel</button>
            <button onClick={() => createMut.mutate()} disabled={!form.name || createMut.isPending} style={{ padding: "7px 14px", borderRadius: 10, background: D.nav2, color: "#fff", border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: (!form.name || createMut.isPending) ? 0.6 : 1 }}>Create Plan</button>
          </div>
        </div>
      )}

      {isLoading ? <SkeletonRows /> : filtered.length === 0 ? (
        <EmptyBlock icon="IP" title="No instalment plans yet" desc="Define 2-part, 3-part, monthly, or custom fee schedules to simplify admission billing." canEdit={canEdit} onNew={() => setAdding(true)} newLabel="Create Instalment Plan" />
      ) : (
        <div style={{ borderRadius: 16, border: `1px solid ${D.line}`, overflow: "hidden", background: "#fff", boxShadow: "0 2px 8px rgba(20,23,53,.04)" }}>
          {filtered.map((plan: any) => (
            <div key={plan.id} style={{ borderTop: plan !== filtered[0] ? `1px solid ${D.line}` : "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", opacity: plan.isActive ? 1 : 0.6 }}>
                <button onClick={() => setExpandedId(expandedId === plan.id ? null : plan.id)} style={{ padding: 4, borderRadius: 6, border: "none", background: "none", cursor: "pointer", color: D.muted, display: "flex" }}>
                  {expandedId === plan.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {editId === plan.id
                    ? <Input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} style={{ maxWidth: 280 }} />
                    : <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 600, color: D.ink }}>{plan.name}</span>
                        {plan.course
                          ? <span style={{ fontSize: 11, borderRadius: 20, background: D.accent, color: D.nav2, border: `1px solid #c7d2fe`, padding: "2px 8px", fontWeight: 500 }}>{plan.course.name}</span>
                          : <span style={{ fontSize: 11, borderRadius: 20, background: D.bg, color: D.muted, padding: "2px 8px", fontWeight: 500 }}>Generic</span>}
                        <span style={{ fontSize: 12, color: D.muted }}>{plan.items?.length ?? 0} instalment{(plan.items?.length ?? 0) !== 1 ? "s" : ""}</span>
                      </div>}
                </div>
                <div style={{ flexShrink: 0 }}>{canEdit ? <ActiveToggle isActive={plan.isActive} onToggle={() => toggleMut.mutate(plan.id)} /> : <span style={{ fontSize: 12, color: plan.isActive ? "#16a34a" : D.muted }}>{plan.isActive ? "Active" : "Inactive"}</span>}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                  {editId === plan.id
                    ? <SaveCancel onSave={() => updateMut.mutate(plan.id)} onCancel={() => setEditId(null)} disabled={!editForm.name || updateMut.isPending} />
                    : <ActionButtons canEdit={canEdit}
                        onEdit={() => { setEditId(plan.id); setExpandedId(plan.id); setEditForm({ name: plan.name, courseId: plan.courseId ?? "", description: plan.description ?? "", items: (plan.items ?? []).map((i: any) => ({ _id: genId(), instalmentNo: i.instalmentNo, label: i.label ?? `Instalment ${i.instalmentNo}`, amount: String(i.amount), daysFromAdmission: i.daysFromAdmission != null ? String(i.daysFromAdmission) : "", dueDate: i.dueDate ? new Date(i.dueDate).toISOString().split("T")[0] : "", dueDateMode: i.dueDate ? "date" : "days" })) }); }}
                        onDelete={() => { if (confirm(`Delete plan "${plan.name}"?`)) deleteMut.mutate(plan.id); }} />}
                </div>
              </div>
              {expandedId === plan.id && (
                <div style={{ background: D.bg, borderTop: `1px solid ${D.line}`, padding: "16px 20px" }}>
                  {editId === plan.id ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      <div className="grid grid-cols-2 gap-3">
                        <div><label style={{ fontSize: 11, fontWeight: 600, color: D.muted, display: "block", marginBottom: 4 }}>Course (optional)</label>
                          <Select value={editForm.courseId} onChange={e => setEditForm({ ...editForm, courseId: e.target.value })}>
                            <option value="">Generic — applies to all courses</option>
                            {(courses as any[]).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </Select>
                        </div>
                        <div><label style={{ fontSize: 11, fontWeight: 600, color: D.muted, display: "block", marginBottom: 4 }}>Description</label><Input placeholder="Optional" value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} /></div>
                      </div>
                      <PlanItemsEditor items={editForm.items} setItems={items => setEditForm({ ...editForm, items })} />
                    </div>
                  ) : (
                    <>
                      {plan.description && <p style={{ margin: "0 0 12px", fontSize: 13, color: D.muted }}>{plan.description}</p>}
                      <div className="hidden sm:grid grid-cols-[36px_1fr_120px_160px] gap-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-1" style={{ marginBottom: 8 }}>
                        <span>#</span><span>Label</span><span>Amount (₹)</span><span>Due Date</span>
                      </div>
                      {(plan.items ?? []).map((item: any) => (
                        <div key={item.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm sm:grid sm:grid-cols-[36px_1fr_120px_160px] sm:gap-2" style={{ marginBottom: 6 }}>
                          <div style={{ width: 28, height: 28, borderRadius: 8, background: D.accent, border: `1px solid #c7d2fe`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: D.nav2 }}>{item.instalmentNo}</div>
                          <span style={{ fontWeight: 500, color: D.ink }}>{item.label ?? `Instalment ${item.instalmentNo}`}</span>
                          <span style={{ fontWeight: 600, color: D.ink }}>₹{Number(item.amount).toLocaleString()}</span>
                          <span style={{ fontSize: 12, color: D.muted }}>
                            {item.dueDate
                              ? new Date(item.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                              : item.daysFromAdmission != null ? `${item.daysFromAdmission} days from admission` : <span style={{ color: D.line }}>—</span>}
                          </span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ── Nav config ─────────────────────────────────────────────────────────────────
const NAV_GROUPS = [
  { label: "Academic Core", items: [{ id: "academic-years", label: "Academic Years" }, { id: "grades", label: "Grades" }, { id: "subjects", label: "Subjects" }, { id: "courses", label: "Courses" }] },
  { label: "Organisation",  items: [{ id: "schools", label: "Schools" }, { id: "locations", label: "City" }, { id: "centres", label: "Centres" }] },
  { label: "Examinations",  items: [{ id: "target-exams", label: "Target Exams" }] },
  { label: "Fees",          items: [{ id: "instalment-plans", label: "Instalment Plans" }] },
];

// ── Page ───────────────────────────────────────────────────────────────────────
export default function AcademicSettingsPage() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState("academic-years");
  const [mobileOpen, setMobileOpen] = useState(false);
  const canEdit = user?.role === "SUPER_ADMIN" || user?.role === "HR_ADMIN";

  const sidebarContent = (
    <>
      <div style={{ padding: "18px 16px 14px", borderBottom: `1px solid ${D.line}`, display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: D.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: D.nav2, flexShrink: 0 }}>ST</div>
        <span style={{ fontSize: 14, fontWeight: 600, color: D.nav2 }}>Academic Settings</span>
      </div>
      <nav style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}>
        {NAV_GROUPS.map(group => (
          <div key={group.label}>
            <p style={{ margin: 0, padding: "14px 16px 4px", fontSize: 10, fontWeight: 700, color: D.muted, textTransform: "uppercase", letterSpacing: ".08em" }}>{group.label}</p>
            {group.items.map(item => (
              <button key={item.id} onClick={() => { setTab(item.id); setMobileOpen(false); }}
                style={{ width: "100%", display: "block", padding: "9px 16px", fontSize: 13, fontWeight: tab === item.id ? 600 : 400, color: tab === item.id ? D.nav2 : D.muted, background: tab === item.id ? D.accent : "transparent", border: "none", cursor: "pointer", textAlign: "left" }}>
                {item.label}
              </button>
            ))}
          </div>
        ))}
      </nav>
    </>
  );

  return (
    <div style={{ display: "flex", height: "100%", background: D.bg }}>
      {mobileOpen && <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Sidebar */}
      <aside className={`shrink-0 bg-white md:relative md:flex md:flex-col md:h-full ${mobileOpen ? "fixed inset-y-0 left-0 z-40 w-60 shadow-xl flex flex-col" : "hidden md:flex md:w-60"}`}
        style={{ borderRight: `1px solid ${D.line}` }}>
        {/* Mobile close */}
        <div className="flex items-center justify-end px-3 py-2 md:hidden" style={{ borderBottom: `1px solid ${D.line}` }}>
          <button onClick={() => setMobileOpen(false)} style={{ padding: 6, borderRadius: 8, border: "none", background: "none", cursor: "pointer", color: D.muted, display: "flex" }}><X size={16} /></button>
        </div>
        {sidebarContent}
      </aside>

      {/* Main content */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {/* Mobile trigger */}
        <div className="md:hidden" style={{ padding: "10px 16px", borderBottom: `1px solid ${D.line}`, background: "#fff" }}>
          <button onClick={() => setMobileOpen(true)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 10, border: `1px solid ${D.line}`, background: "#fff", fontSize: 13, fontWeight: 500, color: D.ink, cursor: "pointer" }}>
            <div style={{ width: 22, height: 22, borderRadius: 6, background: D.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: D.nav2 }}>ST</div>
            Settings
            <ChevronDown size={13} style={{ color: D.muted, marginLeft: "auto" }} />
          </button>
        </div>

        <div style={{ padding: "24px 28px", maxWidth: 900 }}>
          {tab === "academic-years"   && <AcademicYearsTab   canEdit={canEdit} />}
          {tab === "grades"           && <GradesTab          canEdit={canEdit} />}
          {tab === "subjects"         && <SubjectsTab        canEdit={canEdit} />}
          {tab === "courses"          && <CoursesTab         canEdit={canEdit} />}
          {tab === "schools"          && <SchoolsTab         canEdit={canEdit} />}
          {tab === "locations"        && <LocationsTab       canEdit={canEdit} />}
          {tab === "centres"          && <CentreTab          canEdit={canEdit} />}
          {tab === "target-exams"     && <TargetExamsTab     canEdit={canEdit} />}
          {tab === "instalment-plans" && <InstalmentPlansTab canEdit={canEdit} />}
        </div>
      </div>
    </div>
  );
}
