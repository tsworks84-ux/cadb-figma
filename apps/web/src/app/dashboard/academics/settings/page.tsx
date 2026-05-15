"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, X, Check, Archive, ArchiveRestore,
  SlidersHorizontal, CalendarRange, Target, GraduationCap,
  Building2, BookOpen, ToggleLeft, ToggleRight,
  BookCopy, CreditCard, ChevronDown, ChevronUp, Layers, MapPin, Landmark,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";

// ── Shared helpers ─────────────────────────────────────────────────────────────

function Input({ className = "", ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input {...props}
      className={`w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 ${className}`}
    />
  );
}

function Select({ className = "", children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props}
      className={`w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white ${className}`}
    >
      {children}
    </select>
  );
}

function EmptyState({ icon: Icon, message }: { icon: any; message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 py-14 text-center bg-white">
      <Icon className="h-9 w-9 text-gray-200 mx-auto mb-2" />
      <p className="text-sm text-gray-400">{message}</p>
    </div>
  );
}

function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-100 overflow-hidden bg-white shadow-sm">
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

function THead({ cols }: { cols: string[] }) {
  return (
    <thead className="bg-gray-50 border-b border-gray-100">
      <tr>
        {cols.map((c) => (
          <th key={c} className={`px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider ${c === "" ? "w-24" : ""}`}>{c}</th>
        ))}
      </tr>
    </thead>
  );
}

function ActiveToggle({ isActive, onToggle }: { isActive: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle}
      className={`flex items-center gap-1 text-xs font-medium transition-colors ${isActive ? "text-green-600 hover:text-green-700" : "text-gray-400 hover:text-gray-600"}`}>
      {isActive ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
      {isActive ? "Active" : "Inactive"}
    </button>
  );
}

function ActionButtons({
  onEdit, onDelete, onToggle, canEdit,
}: {
  onEdit: () => void;
  onDelete?: () => void;
  onToggle?: () => void;
  canEdit: boolean;
}) {
  if (!canEdit) return null;
  return (
    <div className="flex items-center gap-1 justify-end">
      <button onClick={onEdit} className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-indigo-600">
        <Pencil className="h-3.5 w-3.5" />
      </button>
      {onDelete && (
        <button onClick={onDelete} className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-red-50 hover:text-red-600 hover:border-red-100">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function SaveCancel({ onSave, onCancel, disabled }: { onSave: () => void; onCancel: () => void; disabled?: boolean }) {
  return (
    <>
      <button onClick={onSave} disabled={disabled} className="p-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60">
        <Check className="h-3.5 w-3.5" />
      </button>
      <button onClick={onCancel} className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
        <X className="h-3.5 w-3.5" />
      </button>
    </>
  );
}

// ── Academic Years Tab ─────────────────────────────────────────────────────────

function AcademicYearsTab({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [editName, setEditName] = useState("");
  const [showAll, setShowAll] = useState(false);

  const { data: years = [], isLoading } = useQuery({
    queryKey: ["academic-years", showAll],
    queryFn: () => api.get(`/api/v1/academics/academic-years?all=${showAll}`).then((r) => r.data.data),
  });

  const createMut = useMutation({
    mutationFn: () => api.post("/api/v1/academics/academic-years", { name }),
    onSuccess: () => { toast.success("Academic year created"); setAdding(false); setName(""); qc.invalidateQueries({ queryKey: ["academic-years"] }); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });
  const updateMut = useMutation({
    mutationFn: (id: string) => api.patch(`/api/v1/academics/academic-years/${id}`, { name: editName }),
    onSuccess: () => { toast.success("Updated"); setEditId(null); qc.invalidateQueries({ queryKey: ["academic-years"] }); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });
  const archiveMut = useMutation({
    mutationFn: (id: string) => api.patch(`/api/v1/academics/academic-years/${id}/archive`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["academic-years"] }),
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/academics/academic-years/${id}`),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["academic-years"] }); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-gray-500">
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600" />
          Show archived
        </label>
        {canEdit && (
          <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700">
            <Plus className="h-3.5 w-3.5" /> New Year
          </button>
        )}
      </div>

      {adding && (
        <div className="flex items-center gap-2 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4">
          <Input placeholder="e.g. 2026-27" value={name} onChange={(e) => setName(e.target.value)} className="max-w-[200px]" />
          <SaveCancel onSave={() => createMut.mutate()} onCancel={() => { setAdding(false); setName(""); }} disabled={!name || createMut.isPending} />
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map((i) => <div key={i} className="h-12 rounded-2xl bg-gray-100 animate-pulse" />)}</div>
      ) : years.length === 0 ? (
        <EmptyState icon={CalendarRange} message="No academic years yet — create one to get started" />
      ) : (
        <Table>
          <THead cols={["Year", "Status", ""]} />
          <tbody className="divide-y divide-gray-50">
            {years.map((y: any) => (
              <tr key={y.id} className={`hover:bg-gray-50/50 ${y.isArchived ? "opacity-60" : ""}`}>
                <td className="px-5 py-3">
                  {editId === y.id
                    ? <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="max-w-[180px]" />
                    : <span className="font-semibold text-gray-900">{y.name}</span>}
                </td>
                <td className="px-5 py-3">
                  {y.isArchived
                    ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-600 border border-amber-100"><Archive className="h-3 w-3" />Archived</span>
                    : y.isActive
                      ? <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-600 border border-green-100"><span className="w-1.5 h-1.5 rounded-full bg-green-500" />Active</span>
                      : <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">Inactive</span>}
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    {editId === y.id ? (
                      <SaveCancel onSave={() => updateMut.mutate(y.id)} onCancel={() => setEditId(null)} disabled={!editName || updateMut.isPending} />
                    ) : canEdit ? (
                      <>
                        <button onClick={() => { setEditId(y.id); setEditName(y.name); }} className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-indigo-600"><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={() => archiveMut.mutate(y.id)} title={y.isArchived ? "Unarchive" : "Archive"} className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-amber-600">
                          {y.isArchived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                        </button>
                        <button onClick={() => { if (confirm(`Delete "${y.name}"?`)) deleteMut.mutate(y.id); }} className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                      </>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}

// ── Target Exams Tab ───────────────────────────────────────────────────────────

const EXAM_CATEGORIES = ["BOARD", "COMPETITIVE", "ENTRANCE"] as const;
type ExamCategory = typeof EXAM_CATEGORIES[number];

const CATEGORY_LABELS: Record<ExamCategory, string> = {
  BOARD: "Board Exam",
  COMPETITIVE: "Competitive",
  ENTRANCE: "Entrance",
};
const CATEGORY_COLORS: Record<ExamCategory, string> = {
  BOARD: "bg-blue-50 text-blue-600 border-blue-100",
  COMPETITIVE: "bg-purple-50 text-purple-600 border-purple-100",
  ENTRANCE: "bg-amber-50 text-amber-600 border-amber-100",
};

function TargetExamsTab({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const [showAll, setShowAll] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ code: "", name: "", category: "BOARD" as ExamCategory });
  const [editForm, setEditForm] = useState({ code: "", name: "", category: "BOARD" as ExamCategory });

  const { data: exams = [], isLoading } = useQuery({
    queryKey: ["target-exams", showAll],
    queryFn: () => api.get(`/api/v1/academics/target-exams?all=${showAll}`).then((r) => r.data.data),
  });

  const createMut = useMutation({
    mutationFn: () => api.post("/api/v1/academics/target-exams", form),
    onSuccess: () => { toast.success("Exam created"); setAdding(false); setForm({ code: "", name: "", category: "BOARD" }); qc.invalidateQueries({ queryKey: ["target-exams"] }); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });
  const updateMut = useMutation({
    mutationFn: (id: string) => api.patch(`/api/v1/academics/target-exams/${id}`, editForm),
    onSuccess: () => { toast.success("Updated"); setEditId(null); qc.invalidateQueries({ queryKey: ["target-exams"] }); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });
  const toggleMut = useMutation({
    mutationFn: (id: string) => api.patch(`/api/v1/academics/target-exams/${id}/toggle`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["target-exams"] }),
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/academics/target-exams/${id}`),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["target-exams"] }); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-gray-500">
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600" />
          Show inactive
        </label>
        {canEdit && (
          <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700">
            <Plus className="h-3.5 w-3.5" /> New Exam
          </button>
        )}
      </div>

      {adding && (
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 space-y-3">
          <p className="text-sm font-semibold text-indigo-900">New Target Exam</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Code *</label>
              <Input placeholder="e.g. JEE_MAIN" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Name *</label>
              <Input placeholder="e.g. JEE Main" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Category *</label>
              <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as ExamCategory })}>
                {EXAM_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
              </Select>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setAdding(false)} className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"><X className="h-3.5 w-3.5" /> Cancel</button>
            <button onClick={() => createMut.mutate()} disabled={!form.code || !form.name || createMut.isPending} className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"><Check className="h-3.5 w-3.5" /> Create</button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{[1,2,3,4].map((i) => <div key={i} className="h-12 rounded-2xl bg-gray-100 animate-pulse" />)}</div>
      ) : exams.length === 0 ? (
        <EmptyState icon={Target} message="No target exams yet — create one to get started" />
      ) : (
        <Table>
          <THead cols={["Code", "Name", "Category", "Status", ""]} />
          <tbody className="divide-y divide-gray-50">
            {exams.map((ex: any) => (
              <tr key={ex.id} className={`hover:bg-gray-50/50 ${!ex.isActive ? "opacity-60" : ""}`}>
                <td className="px-5 py-3">
                  {editId === ex.id
                    ? <Input value={editForm.code} onChange={(e) => setEditForm({ ...editForm, code: e.target.value.toUpperCase() })} className="max-w-[120px]" />
                    : <span className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{ex.code}</span>}
                </td>
                <td className="px-5 py-3">
                  {editId === ex.id
                    ? <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="max-w-[200px]" />
                    : <span className="font-medium text-gray-900">{ex.name}</span>}
                </td>
                <td className="px-5 py-3">
                  {editId === ex.id ? (
                    <Select value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value as ExamCategory })} className="max-w-[150px]">
                      {EXAM_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                    </Select>
                  ) : (
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border ${CATEGORY_COLORS[ex.category as ExamCategory] ?? "bg-gray-50 text-gray-600"}`}>
                      {CATEGORY_LABELS[ex.category as ExamCategory] ?? ex.category}
                    </span>
                  )}
                </td>
                <td className="px-5 py-3">
                  {canEdit
                    ? <ActiveToggle isActive={ex.isActive} onToggle={() => toggleMut.mutate(ex.id)} />
                    : ex.isActive ? <span className="text-xs text-green-600">Active</span> : <span className="text-xs text-gray-400">Inactive</span>}
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    {editId === ex.id ? (
                      <SaveCancel onSave={() => updateMut.mutate(ex.id)} onCancel={() => setEditId(null)} disabled={!editForm.code || !editForm.name || updateMut.isPending} />
                    ) : (
                      <ActionButtons canEdit={canEdit} onEdit={() => { setEditId(ex.id); setEditForm({ code: ex.code, name: ex.name, category: ex.category }); }}
                        onDelete={() => { if (confirm(`Delete "${ex.name}"?`)) deleteMut.mutate(ex.id); }} />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}

// ── Grades Tab ─────────────────────────────────────────────────────────────────

function GradesTab({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const [showAll, setShowAll] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", sortOrder: 0 });
  const [editForm, setEditForm] = useState({ name: "", sortOrder: 0 });

  const { data: grades = [], isLoading } = useQuery({
    queryKey: ["grades", showAll],
    queryFn: () => api.get(`/api/v1/academics/grades?all=${showAll}`).then((r) => r.data.data),
  });

  const createMut = useMutation({
    mutationFn: () => api.post("/api/v1/academics/grades", form),
    onSuccess: () => { toast.success("Grade created"); setAdding(false); setForm({ name: "", sortOrder: 0 }); qc.invalidateQueries({ queryKey: ["grades"] }); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });
  const updateMut = useMutation({
    mutationFn: (id: string) => api.patch(`/api/v1/academics/grades/${id}`, editForm),
    onSuccess: () => { toast.success("Updated"); setEditId(null); qc.invalidateQueries({ queryKey: ["grades"] }); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });
  const toggleMut = useMutation({
    mutationFn: (id: string) => api.patch(`/api/v1/academics/grades/${id}/toggle`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["grades"] }),
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/academics/grades/${id}`),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["grades"] }); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-gray-500">
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600" />
          Show inactive
        </label>
        {canEdit && (
          <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700">
            <Plus className="h-3.5 w-3.5" /> New Grade
          </button>
        )}
      </div>

      {adding && (
        <div className="flex items-center gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4">
          <div className="flex-1 max-w-[200px]">
            <label className="text-xs font-medium text-gray-600 mb-1 block">Grade Name *</label>
            <Input placeholder="e.g. X or Grade 10" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="w-28">
            <label className="text-xs font-medium text-gray-600 mb-1 block">Sort Order</label>
            <Input type="number" min={0} value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })} />
          </div>
          <div className="flex items-end gap-1 pb-0.5">
            <SaveCancel onSave={() => createMut.mutate()} onCancel={() => { setAdding(false); setForm({ name: "", sortOrder: 0 }); }} disabled={!form.name || createMut.isPending} />
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{[1,2,3,4,5].map((i) => <div key={i} className="h-12 rounded-2xl bg-gray-100 animate-pulse" />)}</div>
      ) : grades.length === 0 ? (
        <EmptyState icon={GraduationCap} message="No grades yet — create one to get started" />
      ) : (
        <Table>
          <THead cols={["Grade", "Sort Order", "Status", ""]} />
          <tbody className="divide-y divide-gray-50">
            {grades.map((g: any) => (
              <tr key={g.id} className={`hover:bg-gray-50/50 ${!g.isActive ? "opacity-60" : ""}`}>
                <td className="px-5 py-3">
                  {editId === g.id
                    ? <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="max-w-[150px]" />
                    : <span className="font-semibold text-gray-900">{g.name}</span>}
                </td>
                <td className="px-5 py-3 text-gray-500 text-sm">
                  {editId === g.id
                    ? <Input type="number" min={0} value={editForm.sortOrder} onChange={(e) => setEditForm({ ...editForm, sortOrder: parseInt(e.target.value) || 0 })} className="max-w-[80px]" />
                    : g.sortOrder}
                </td>
                <td className="px-5 py-3">
                  {canEdit
                    ? <ActiveToggle isActive={g.isActive} onToggle={() => toggleMut.mutate(g.id)} />
                    : g.isActive ? <span className="text-xs text-green-600">Active</span> : <span className="text-xs text-gray-400">Inactive</span>}
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    {editId === g.id ? (
                      <SaveCancel onSave={() => updateMut.mutate(g.id)} onCancel={() => setEditId(null)} disabled={!editForm.name || updateMut.isPending} />
                    ) : (
                      <ActionButtons canEdit={canEdit} onEdit={() => { setEditId(g.id); setEditForm({ name: g.name, sortOrder: g.sortOrder }); }}
                        onDelete={() => { if (confirm(`Delete grade "${g.name}"?`)) deleteMut.mutate(g.id); }} />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}

// ── Schools Tab ────────────────────────────────────────────────────────────────

function SchoolsTab({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const [showAll, setShowAll] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", city: "", board: "" });
  const [editForm, setEditForm] = useState({ name: "", city: "", board: "" });

  const { data: schools = [], isLoading } = useQuery({
    queryKey: ["schools", showAll],
    queryFn: () => api.get(`/api/v1/academics/schools?all=${showAll}`).then((r) => r.data.data),
  });

  const createMut = useMutation({
    mutationFn: () => api.post("/api/v1/academics/schools", form),
    onSuccess: () => { toast.success("School created"); setAdding(false); setForm({ name: "", city: "", board: "" }); qc.invalidateQueries({ queryKey: ["schools"] }); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });
  const updateMut = useMutation({
    mutationFn: (id: string) => api.patch(`/api/v1/academics/schools/${id}`, editForm),
    onSuccess: () => { toast.success("Updated"); setEditId(null); qc.invalidateQueries({ queryKey: ["schools"] }); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });
  const toggleMut = useMutation({
    mutationFn: (id: string) => api.patch(`/api/v1/academics/schools/${id}/toggle`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schools"] }),
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/academics/schools/${id}`),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["schools"] }); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-gray-500">
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600" />
          Show inactive
        </label>
        {canEdit && (
          <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700">
            <Plus className="h-3.5 w-3.5" /> New School
          </button>
        )}
      </div>

      {adding && (
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 space-y-3">
          <p className="text-sm font-semibold text-indigo-900">New School</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <label className="text-xs font-medium text-gray-600 mb-1 block">School Name *</label>
              <Input placeholder="e.g. Delhi Public School" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">City</label>
              <Input placeholder="e.g. Mumbai" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Board</label>
              <Input placeholder="e.g. CBSE, ICSE, State" value={form.board} onChange={(e) => setForm({ ...form, board: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setAdding(false)} className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"><X className="h-3.5 w-3.5" /> Cancel</button>
            <button onClick={() => createMut.mutate()} disabled={!form.name || createMut.isPending} className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"><Check className="h-3.5 w-3.5" /> Create</button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map((i) => <div key={i} className="h-12 rounded-2xl bg-gray-100 animate-pulse" />)}</div>
      ) : schools.length === 0 ? (
        <EmptyState icon={Building2} message="No schools yet — create one to get started" />
      ) : (
        <Table>
          <THead cols={["School Name", "City", "Board", "Status", ""]} />
          <tbody className="divide-y divide-gray-50">
            {schools.map((s: any) => (
              <tr key={s.id} className={`hover:bg-gray-50/50 ${!s.isActive ? "opacity-60" : ""}`}>
                <td className="px-5 py-3">
                  {editId === s.id
                    ? <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="max-w-[220px]" />
                    : <span className="font-semibold text-gray-900">{s.name}</span>}
                </td>
                <td className="px-5 py-3 text-gray-500">
                  {editId === s.id
                    ? <Input value={editForm.city} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} className="max-w-[140px]" />
                    : s.city ?? <span className="text-gray-300">—</span>}
                </td>
                <td className="px-5 py-3">
                  {editId === s.id
                    ? <Input value={editForm.board} onChange={(e) => setEditForm({ ...editForm, board: e.target.value })} className="max-w-[120px]" />
                    : s.board
                      ? <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{s.board}</span>
                      : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-5 py-3">
                  {canEdit
                    ? <ActiveToggle isActive={s.isActive} onToggle={() => toggleMut.mutate(s.id)} />
                    : s.isActive ? <span className="text-xs text-green-600">Active</span> : <span className="text-xs text-gray-400">Inactive</span>}
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    {editId === s.id ? (
                      <SaveCancel onSave={() => updateMut.mutate(s.id)} onCancel={() => setEditId(null)} disabled={!editForm.name || updateMut.isPending} />
                    ) : (
                      <ActionButtons canEdit={canEdit} onEdit={() => { setEditId(s.id); setEditForm({ name: s.name, city: s.city ?? "", board: s.board ?? "" }); }}
                        onDelete={() => { if (confirm(`Delete "${s.name}"?`)) deleteMut.mutate(s.id); }} />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}

// ── Subjects Tab ───────────────────────────────────────────────────────────────

function SubjectsTab({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const [showAll, setShowAll] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ code: "", name: "", description: "" });
  const [editForm, setEditForm] = useState({ code: "", name: "", description: "" });

  const { data: subjects = [], isLoading } = useQuery({
    queryKey: ["subjects", showAll],
    queryFn: () => api.get(`/api/v1/academics/subjects?all=${showAll}`).then((r) => r.data.data),
  });

  const createMut = useMutation({
    mutationFn: () => api.post("/api/v1/academics/subjects", form),
    onSuccess: () => { toast.success("Subject created"); setAdding(false); setForm({ code: "", name: "", description: "" }); qc.invalidateQueries({ queryKey: ["subjects"] }); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });
  const updateMut = useMutation({
    mutationFn: (id: string) => api.patch(`/api/v1/academics/subjects/${id}`, editForm),
    onSuccess: () => { toast.success("Updated"); setEditId(null); qc.invalidateQueries({ queryKey: ["subjects"] }); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });
  const toggleMut = useMutation({
    mutationFn: (id: string) => api.patch(`/api/v1/academics/subjects/${id}/toggle`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subjects"] }),
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/academics/subjects/${id}`),
    onSuccess: () => { toast.success("Subject deleted"); qc.invalidateQueries({ queryKey: ["subjects"] }); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-gray-500">
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600" />
          Show inactive
        </label>
        {canEdit && (
          <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700">
            <Plus className="h-3.5 w-3.5" /> New Subject
          </button>
        )}
      </div>

      {adding && (
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 space-y-3">
          <p className="text-sm font-semibold text-indigo-900">New Subject</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Subject Code *</label>
              <Input placeholder="e.g. MATH" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Subject Name *</label>
              <Input placeholder="e.g. Mathematics" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Description</label>
              <Input placeholder="Optional" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setAdding(false)} className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"><X className="h-3.5 w-3.5" /> Cancel</button>
            <button onClick={() => createMut.mutate()} disabled={!form.code || !form.name || createMut.isPending} className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"><Check className="h-3.5 w-3.5" /> Create</button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map((i) => <div key={i} className="h-12 rounded-2xl bg-gray-100 animate-pulse" />)}</div>
      ) : subjects.length === 0 ? (
        <EmptyState icon={BookOpen} message="No subjects yet — create one to get started" />
      ) : (
        <Table>
          <THead cols={["Code", "Subject Name", "Batches", "Status", ""]} />
          <tbody className="divide-y divide-gray-50">
            {subjects.map((s: any) => (
              <tr key={s.id} className={`hover:bg-gray-50/50 ${!s.isActive ? "opacity-60" : ""}`}>
                <td className="px-5 py-3">
                  {editId === s.id
                    ? <Input value={editForm.code} onChange={(e) => setEditForm({ ...editForm, code: e.target.value.toUpperCase() })} className="max-w-[100px]" />
                    : <span className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{s.code}</span>}
                </td>
                <td className="px-5 py-3">
                  {editId === s.id ? (
                    <div className="space-y-1">
                      <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="max-w-[220px]" />
                      <Input value={editForm.description} placeholder="Description" onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} className="max-w-[220px]" />
                    </div>
                  ) : (
                    <div>
                      <p className="font-medium text-gray-900">{s.name}</p>
                      {s.description && <p className="text-xs text-gray-400 mt-0.5">{s.description}</p>}
                    </div>
                  )}
                </td>
                <td className="px-5 py-3 text-gray-500 text-xs">{s._count.batchSubjects} batch{s._count.batchSubjects !== 1 ? "es" : ""}</td>
                <td className="px-5 py-3">
                  {canEdit
                    ? <ActiveToggle isActive={s.isActive} onToggle={() => toggleMut.mutate(s.id)} />
                    : s.isActive ? <span className="text-xs text-green-600">Active</span> : <span className="text-xs text-gray-400">Inactive</span>}
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    {editId === s.id ? (
                      <SaveCancel onSave={() => updateMut.mutate(s.id)} onCancel={() => setEditId(null)} disabled={!editForm.code || !editForm.name || updateMut.isPending} />
                    ) : (
                      <ActionButtons canEdit={canEdit} onEdit={() => { setEditId(s.id); setEditForm({ code: s.code, name: s.name, description: s.description ?? "" }); }}
                        onDelete={s._count.batchSubjects === 0 ? () => { if (confirm(`Delete subject "${s.name}"?`)) deleteMut.mutate(s.id); } : undefined} />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}

// ── Courses Tab ────────────────────────────────────────────────────────────────

function CoursesTab({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const [showAll, setShowAll] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const emptyForm = () => ({ name: "", code: "", description: "", duration: "", fee: "" });
  const [form, setForm] = useState(emptyForm());
  const [editForm, setEditForm] = useState(emptyForm());

  const { data: courses = [], isLoading } = useQuery({
    queryKey: ["courses", showAll],
    queryFn: () => api.get(`/api/v1/academics/courses?all=${showAll}`).then((r) => r.data.data),
  });

  const createMut = useMutation({
    mutationFn: () => api.post("/api/v1/academics/courses", { ...form, fee: form.fee ? parseFloat(form.fee) : undefined }),
    onSuccess: () => { toast.success("Course created"); setAdding(false); setForm(emptyForm()); qc.invalidateQueries({ queryKey: ["courses"] }); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });
  const updateMut = useMutation({
    mutationFn: (id: string) => api.patch(`/api/v1/academics/courses/${id}`, { ...editForm, fee: editForm.fee ? parseFloat(editForm.fee) : undefined }),
    onSuccess: () => { toast.success("Updated"); setEditId(null); qc.invalidateQueries({ queryKey: ["courses"] }); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });
  const toggleMut = useMutation({
    mutationFn: (id: string) => api.patch(`/api/v1/academics/courses/${id}/toggle`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["courses"] }),
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/academics/courses/${id}`),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["courses"] }); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-gray-500">
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600" />
          Show inactive
        </label>
        {canEdit && (
          <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700">
            <Plus className="h-3.5 w-3.5" /> New Course
          </button>
        )}
      </div>

      {adding && (
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 space-y-3">
          <p className="text-sm font-semibold text-indigo-900">New Course</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Course Name *</label>
              <Input placeholder="e.g. JEE Mains Batch" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Code</label>
              <Input placeholder="e.g. JEE-M-2Y" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Duration</label>
              <Input placeholder="e.g. 2 Years" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Fee (₹)</label>
              <Input type="number" min="0" placeholder="0.00" value={form.fee} onChange={(e) => setForm({ ...form, fee: e.target.value })} />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-600 mb-1 block">Description</label>
              <Input placeholder="Optional" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setAdding(false); setForm(emptyForm()); }} className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"><X className="h-3.5 w-3.5" /> Cancel</button>
            <button onClick={() => createMut.mutate()} disabled={!form.name || createMut.isPending} className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"><Check className="h-3.5 w-3.5" /> Create</button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map((i) => <div key={i} className="h-12 rounded-2xl bg-gray-100 animate-pulse" />)}</div>
      ) : courses.length === 0 ? (
        <EmptyState icon={BookCopy} message="No courses yet — create one to get started" />
      ) : (
        <Table>
          <THead cols={["Course", "Code", "Duration", "Fee", "Status", ""]} />
          <tbody className="divide-y divide-gray-50">
            {courses.map((c: any) => (
              <tr key={c.id} className={`hover:bg-gray-50/50 ${!c.isActive ? "opacity-60" : ""}`}>
                <td className="px-5 py-3">
                  {editId === c.id
                    ? <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="max-w-[220px]" />
                    : (
                      <div>
                        <p className="font-semibold text-gray-900">{c.name}</p>
                        {c.description && <p className="text-xs text-gray-400 mt-0.5">{c.description}</p>}
                      </div>
                    )}
                </td>
                <td className="px-5 py-3">
                  {editId === c.id
                    ? <Input value={editForm.code} onChange={(e) => setEditForm({ ...editForm, code: e.target.value })} className="max-w-[100px]" />
                    : c.code ? <span className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{c.code}</span> : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-5 py-3 text-gray-500 text-sm">
                  {editId === c.id
                    ? <Input value={editForm.duration} onChange={(e) => setEditForm({ ...editForm, duration: e.target.value })} className="max-w-[100px]" />
                    : c.duration ?? <span className="text-gray-300">—</span>}
                </td>
                <td className="px-5 py-3">
                  {editId === c.id
                    ? <Input type="number" min="0" value={editForm.fee} onChange={(e) => setEditForm({ ...editForm, fee: e.target.value })} className="max-w-[100px]" />
                    : c.fee != null ? <span className="font-semibold text-gray-800">₹{Number(c.fee).toLocaleString()}</span> : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-5 py-3">
                  {canEdit
                    ? <ActiveToggle isActive={c.isActive} onToggle={() => toggleMut.mutate(c.id)} />
                    : c.isActive ? <span className="text-xs text-green-600">Active</span> : <span className="text-xs text-gray-400">Inactive</span>}
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    {editId === c.id ? (
                      <SaveCancel onSave={() => updateMut.mutate(c.id)} onCancel={() => setEditId(null)} disabled={!editForm.name || updateMut.isPending} />
                    ) : (
                      <ActionButtons canEdit={canEdit}
                        onEdit={() => { setEditId(c.id); setEditForm({ name: c.name, code: c.code ?? "", description: c.description ?? "", duration: c.duration ?? "", fee: c.fee != null ? String(c.fee) : "" }); }}
                        onDelete={() => { if (confirm(`Delete course "${c.name}"?`)) deleteMut.mutate(c.id); }} />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}

// ── Instalment Plans Tab ───────────────────────────────────────────────────────

type PlanItem = { _id: string; instalmentNo: number; label: string; amount: string; daysFromAdmission: string; dueDate: string; dueDateMode: "days" | "date" };
const mkItem = (no: number): PlanItem => ({ _id: crypto.randomUUID(), instalmentNo: no, label: `Instalment ${no}`, amount: "", daysFromAdmission: "", dueDate: "", dueDateMode: "days" });

function PlanItemsEditor({ items, setItems }: { items: PlanItem[]; setItems: (items: PlanItem[]) => void }) {
  const add = () => setItems([...items, mkItem(items.length + 1)]);
  const remove = (_id: string) => setItems(items.filter((i) => i._id !== _id).map((i, idx) => ({ ...i, instalmentNo: idx + 1 })));
  const update = (_id: string, field: keyof PlanItem, val: string) => setItems(items.map((i) => i._id === _id ? { ...i, [field]: val } : i));
  const toggleMode = (_id: string) => setItems(items.map((i) => i._id === _id ? { ...i, dueDateMode: i.dueDateMode === "days" ? "date" : "days", daysFromAdmission: "", dueDate: "" } : i));

  return (
    <div className="space-y-2">
      {items.length > 0 && (
        <div className="hidden sm:grid grid-cols-[36px_1fr_110px_200px_32px] gap-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-1">
          <span>#</span><span>Label</span><span>Amount (₹)</span><span>Due Date</span><span />
        </div>
      )}
      {items.map((item) => (
        <div key={item._id} className="flex flex-col gap-2 sm:grid sm:grid-cols-[36px_1fr_110px_200px_32px] sm:items-center border border-gray-100 rounded-lg p-2 sm:border-0 sm:rounded-none sm:p-0">
          <div className="flex items-center gap-2 sm:contents">
            <div className="h-7 w-7 shrink-0 rounded-md bg-indigo-50 border border-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600">
              {item.instalmentNo}
            </div>
            <Input placeholder={`Instalment ${item.instalmentNo}`} value={item.label} onChange={(e) => update(item._id, "label", e.target.value)} className="flex-1 sm:flex-none" />
          </div>
          <div className="flex gap-2 sm:contents">
            <Input type="number" min="0" placeholder="0.00" value={item.amount} onChange={(e) => update(item._id, "amount", e.target.value)} className="w-[110px] sm:w-auto" />
            {/* Due date: toggle between relative (days) and absolute (calendar) */}
            <div className="flex flex-1 items-center gap-1.5 sm:flex-none">
              <button
                type="button"
                onClick={() => toggleMode(item._id)}
                title={item.dueDateMode === "days" ? "Switch to specific date" : "Switch to days from admission"}
                className={`shrink-0 flex items-center gap-1 rounded-md border px-2 py-1.5 text-[10px] font-semibold transition-colors ${
                  item.dueDateMode === "date"
                    ? "border-indigo-200 bg-indigo-50 text-indigo-600"
                    : "border-gray-200 bg-white text-gray-500"
                }`}
              >
                {item.dueDateMode === "date" ? "📅 Date" : "⏱ Days"}
              </button>
              {item.dueDateMode === "date" ? (
                <Input type="date" value={item.dueDate} onChange={(e) => update(item._id, "dueDate", e.target.value)} className="flex-1" />
              ) : (
                <Input type="number" min="0" placeholder="e.g. 30" value={item.daysFromAdmission} onChange={(e) => update(item._id, "daysFromAdmission", e.target.value)} className="flex-1" />
              )}
            </div>
            <button type="button" onClick={() => remove(item._id)} className="shrink-0 h-7 w-7 rounded-md border border-gray-200 flex items-center justify-center text-gray-400 hover:text-red-500 hover:border-red-200 transition-colors">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}
      <button type="button" onClick={add} className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 mt-1">
        <Plus className="h-3 w-3" /> Add instalment
      </button>
    </div>
  );
}

function InstalmentPlansTab({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const [filterCourseId, setFilterCourseId] = useState("");
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const emptyPlan = () => ({ name: "", courseId: "", description: "", items: [mkItem(1)] });
  const [form, setForm] = useState(emptyPlan());
  const [editForm, setEditForm] = useState(emptyPlan());

  const { data: courses = [] } = useQuery({
    queryKey: ["courses"],
    queryFn: () => api.get("/api/v1/academics/courses").then((r) => r.data.data),
  });

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["instalment-plans", filterCourseId],
    queryFn: () => api.get(`/api/v1/academics/instalment-plans${filterCourseId ? `?courseId=${filterCourseId}` : ""}`).then((r) => r.data.data),
  });

  const buildPayload = (f: typeof form) => ({
    name: f.name,
    courseId: f.courseId || null,
    description: f.description || undefined,
    items: f.items
      .filter((i) => parseFloat(i.amount) > 0)
      .map((i) => ({
        instalmentNo: i.instalmentNo,
        label: i.label || undefined,
        amount: parseFloat(i.amount),
        daysFromAdmission: i.dueDateMode === "days" && i.daysFromAdmission ? parseInt(i.daysFromAdmission) : undefined,
        dueDate: i.dueDateMode === "date" && i.dueDate ? i.dueDate : undefined,
      })),
  });

  const createMut = useMutation({
    mutationFn: () => api.post("/api/v1/academics/instalment-plans", buildPayload(form)),
    onSuccess: () => { toast.success("Plan created"); setAdding(false); setForm(emptyPlan()); qc.invalidateQueries({ queryKey: ["instalment-plans"] }); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });
  const updateMut = useMutation({
    mutationFn: (id: string) => api.patch(`/api/v1/academics/instalment-plans/${id}`, buildPayload(editForm)),
    onSuccess: () => { toast.success("Updated"); setEditId(null); qc.invalidateQueries({ queryKey: ["instalment-plans"] }); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });
  const toggleMut = useMutation({
    mutationFn: (id: string) => api.patch(`/api/v1/academics/instalment-plans/${id}/toggle`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["instalment-plans"] }),
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/academics/instalment-plans/${id}`),
    onSuccess: () => { toast.success("Plan deleted"); qc.invalidateQueries({ queryKey: ["instalment-plans"] }); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <Select value={filterCourseId} onChange={(e) => setFilterCourseId(e.target.value)} className="max-w-[260px]">
          <option value="">All plans</option>
          {courses.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        {canEdit && (
          <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 shrink-0">
            <Plus className="h-3.5 w-3.5" /> New Plan
          </button>
        )}
      </div>

      {adding && (
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 space-y-4">
          <p className="text-sm font-semibold text-indigo-900">New Instalment Plan</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Plan Name *</label>
              <Input placeholder="e.g. JEE 2-Year Standard" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Course (optional)</label>
              <Select value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value })}>
                <option value="">Generic — applies to all courses</option>
                {courses.filter((c: any) => c.isActive).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-600 mb-1 block">Description</label>
              <Input placeholder="Optional" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Instalment Schedule</p>
            <p className="text-[11px] text-gray-400 mb-3">Use <strong>⏱ Days</strong> to compute the due date relative to admission, or <strong>📅 Date</strong> to set a fixed calendar date per instalment.</p>
            <PlanItemsEditor items={form.items} setItems={(items) => setForm({ ...form, items })} />
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <button onClick={() => { setAdding(false); setForm(emptyPlan()); }} className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"><X className="h-3.5 w-3.5" /> Cancel</button>
            <button onClick={() => createMut.mutate()} disabled={!form.name || createMut.isPending} className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"><Check className="h-3.5 w-3.5" /> Create Plan</button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map((i) => <div key={i} className="h-14 rounded-2xl bg-gray-100 animate-pulse" />)}</div>
      ) : plans.length === 0 ? (
        <EmptyState icon={CreditCard} message="No instalment plans yet — create one to get started" />
      ) : (
        <div className="rounded-2xl border border-gray-100 overflow-hidden bg-white shadow-sm divide-y divide-gray-50">
          {plans.map((plan: any) => (
            <div key={plan.id}>
              {/* Row */}
              <div className={`flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50/50 ${!plan.isActive ? "opacity-60" : ""}`}>
                <button onClick={() => setExpandedId(expandedId === plan.id ? null : plan.id)} className="p-1 rounded text-gray-400 hover:text-gray-600 shrink-0">
                  {expandedId === plan.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                <div className="flex-1 min-w-0">
                  {editId === plan.id
                    ? <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="max-w-[280px]" />
                    : (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900">{plan.name}</span>
                        {plan.course
                          ? <span className="text-xs rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100 px-2 py-0.5 font-medium">{plan.course.name}</span>
                          : <span className="text-xs rounded-full bg-gray-100 text-gray-500 px-2 py-0.5 font-medium">Generic</span>}
                        <span className="text-xs text-gray-400">{plan.items?.length ?? 0} instalment{(plan.items?.length ?? 0) !== 1 ? "s" : ""}</span>
                      </div>
                    )}
                </div>
                <div className="shrink-0">
                  {canEdit
                    ? <ActiveToggle isActive={plan.isActive} onToggle={() => toggleMut.mutate(plan.id)} />
                    : plan.isActive ? <span className="text-xs text-green-600">Active</span> : <span className="text-xs text-gray-400">Inactive</span>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {editId === plan.id ? (
                    <SaveCancel onSave={() => updateMut.mutate(plan.id)} onCancel={() => setEditId(null)} disabled={!editForm.name || updateMut.isPending} />
                  ) : (
                    <ActionButtons canEdit={canEdit}
                      onEdit={() => {
                        setEditId(plan.id);
                        setExpandedId(plan.id);
                        setEditForm({
                          name: plan.name,
                          courseId: plan.courseId ?? "",
                          description: plan.description ?? "",
                          items: (plan.items ?? []).map((i: any) => ({
                            _id: crypto.randomUUID(),
                            instalmentNo: i.instalmentNo,
                            label: i.label ?? `Instalment ${i.instalmentNo}`,
                            amount: String(i.amount),
                            daysFromAdmission: i.daysFromAdmission != null ? String(i.daysFromAdmission) : "",
                            dueDate: i.dueDate ? new Date(i.dueDate).toISOString().split("T")[0] : "",
                            dueDateMode: i.dueDate ? "date" : "days",
                          })),
                        });
                      }}
                      onDelete={() => { if (confirm(`Delete plan "${plan.name}"?`)) deleteMut.mutate(plan.id); }}
                    />
                  )}
                </div>
              </div>

              {/* Expanded detail / edit */}
              {expandedId === plan.id && (
                <div className="bg-gray-50/60 border-t border-gray-100 px-5 py-4 space-y-3">
                  {editId === plan.id ? (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-medium text-gray-600 mb-1 block">Course (optional)</label>
                          <Select value={editForm.courseId} onChange={(e) => setEditForm({ ...editForm, courseId: e.target.value })}>
                            <option value="">Generic — applies to all courses</option>
                            {courses.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </Select>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-600 mb-1 block">Description</label>
                          <Input placeholder="Optional" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
                        </div>
                      </div>
                      <PlanItemsEditor items={editForm.items} setItems={(items) => setEditForm({ ...editForm, items })} />
                    </>
                  ) : (
                    <>
                      {plan.description && <p className="text-sm text-gray-500">{plan.description}</p>}
                      <div className="hidden sm:grid grid-cols-[36px_1fr_120px_160px] gap-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-1">
                        <span>#</span><span>Label</span><span>Amount (₹)</span><span>Due Date</span>
                      </div>
                      {(plan.items ?? []).map((item: any) => (
                        <div key={item.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm sm:grid sm:grid-cols-[36px_1fr_120px_160px] sm:gap-2">
                          <div className="h-7 w-7 shrink-0 rounded-md bg-indigo-50 border border-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600">
                            {item.instalmentNo}
                          </div>
                          <span className="text-gray-700 font-medium">{item.label ?? `Instalment ${item.instalmentNo}`}</span>
                          <span className="font-semibold text-gray-800">₹{Number(item.amount).toLocaleString()}</span>
                          <span className="text-gray-500">
                            {item.dueDate
                              ? new Date(item.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                              : item.daysFromAdmission != null
                                ? `${item.daysFromAdmission} days from admission`
                                : <span className="text-gray-300">—</span>}
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
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

// ── City Tab (formerly Locations) ─────────────────────────────────────────────

function LocationsTab({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const [showAll, setShowAll] = useState(true);
  const [adding, setAdding]   = useState(false);
  const [editId, setEditId]   = useState<string | null>(null);
  const [name, setName]       = useState("");
  const [editName, setEditName] = useState("");

  const { data: locations = [], isLoading } = useQuery({
    queryKey: ["locations", showAll],
    queryFn: () => api.get(`/api/v1/academics/locations?all=${showAll}`).then((r) => r.data.data),
  });

  const createMut = useMutation({
    mutationFn: () => api.post("/api/v1/academics/locations", { name }),
    onSuccess: () => { toast.success("City created"); setAdding(false); setName(""); qc.invalidateQueries({ queryKey: ["locations"] }); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });
  const updateMut = useMutation({
    mutationFn: (id: string) => api.patch(`/api/v1/academics/locations/${id}`, { name: editName }),
    onSuccess: () => { toast.success("Updated"); setEditId(null); qc.invalidateQueries({ queryKey: ["locations"] }); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });
  const toggleMut = useMutation({
    mutationFn: (id: string) => api.patch(`/api/v1/academics/locations/${id}/toggle`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["locations"] }),
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/academics/locations/${id}`),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["locations"] }); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-gray-500">
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600" />
          Show inactive
        </label>
        {canEdit && (
          <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700">
            <Plus className="h-3.5 w-3.5" /> New City
          </button>
        )}
      </div>

      {adding && (
        <div className="flex items-center gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4">
          <div className="flex-1 max-w-xs">
            <label className="text-xs font-medium text-gray-600 mb-1 block">City Name *</label>
            <Input placeholder="e.g. Kota, Jaipur, Delhi" value={name} onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && name && createMut.mutate()} />
          </div>
          <div className="flex items-end gap-1 pb-0.5">
            <SaveCancel onSave={() => createMut.mutate()} onCancel={() => { setAdding(false); setName(""); }} disabled={!name || createMut.isPending} />
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3, 4].map((i) => <div key={i} className="h-12 rounded-2xl bg-gray-100 animate-pulse" />)}</div>
      ) : locations.length === 0 ? (
        <EmptyState icon={MapPin} message="No cities yet — add one to use in batch and centre setup" />
      ) : (
        <Table>
          <THead cols={["City", "Status", ""]} />
          <tbody className="divide-y divide-gray-50">
            {(locations as any[]).map((loc: any) => (
              <tr key={loc.id} className={`hover:bg-gray-50/50 ${!loc.isActive ? "opacity-60" : ""}`}>
                <td className="px-5 py-3">
                  {editId === loc.id ? (
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && editName) updateMut.mutate(loc.id); if (e.key === "Escape") setEditId(null); }}
                      className="max-w-xs" autoFocus />
                  ) : (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                      <span className="font-semibold text-gray-900">{loc.name}</span>
                    </div>
                  )}
                </td>
                <td className="px-5 py-3">
                  {canEdit
                    ? <ActiveToggle isActive={loc.isActive} onToggle={() => toggleMut.mutate(loc.id)} />
                    : loc.isActive ? <span className="text-xs text-green-600">Active</span> : <span className="text-xs text-gray-400">Inactive</span>}
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    {editId === loc.id ? (
                      <SaveCancel onSave={() => updateMut.mutate(loc.id)} onCancel={() => setEditId(null)} disabled={!editName || updateMut.isPending} />
                    ) : (
                      <ActionButtons canEdit={canEdit}
                        onEdit={() => { setEditId(loc.id); setEditName(loc.name); }}
                        onDelete={() => { if (confirm(`Delete city "${loc.name}"?`)) deleteMut.mutate(loc.id); }} />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}

// ── Centre Tab ────────────────────────────────────────────────────────────────

function CentreTab({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const [showAll, setShowAll]   = useState(true);
  const [adding, setAdding]     = useState(false);
  const [editId, setEditId]     = useState<string | null>(null);
  const [form, setForm]         = useState({ name: "", cityId: "" });
  const [editForm, setEditForm] = useState({ name: "", cityId: "" });

  const { data: centres = [], isLoading } = useQuery({
    queryKey: ["centres", showAll],
    queryFn: () => api.get(`/api/v1/academics/centres?all=${showAll}`).then((r) => r.data.data),
  });
  const { data: cities = [] } = useQuery({
    queryKey: ["locations", true],
    queryFn: () => api.get("/api/v1/academics/locations?all=true").then((r) => r.data.data),
  });

  const createMut = useMutation({
    mutationFn: () => api.post("/api/v1/academics/centres", { name: form.name, cityId: form.cityId || null }),
    onSuccess: () => { toast.success("Centre created"); setAdding(false); setForm({ name: "", cityId: "" }); qc.invalidateQueries({ queryKey: ["centres"] }); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });
  const updateMut = useMutation({
    mutationFn: (id: string) => api.patch(`/api/v1/academics/centres/${id}`, { name: editForm.name, cityId: editForm.cityId || null }),
    onSuccess: () => { toast.success("Updated"); setEditId(null); qc.invalidateQueries({ queryKey: ["centres"] }); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });
  const toggleMut = useMutation({
    mutationFn: (id: string) => api.patch(`/api/v1/academics/centres/${id}/toggle`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["centres"] }),
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/academics/centres/${id}`),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["centres"] }); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-gray-500">
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600" />
          Show inactive
        </label>
        {canEdit && (
          <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700">
            <Plus className="h-3.5 w-3.5" /> New Centre
          </button>
        )}
      </div>

      {adding && (
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 space-y-3">
          <p className="text-sm font-semibold text-indigo-900">New Centre</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Centre Name *</label>
              <Input placeholder="e.g. Centum Kota Main, Study Hall B" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && form.name && createMut.mutate()} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">City (optional)</label>
              <Select value={form.cityId} onChange={(e) => setForm({ ...form, cityId: e.target.value })}>
                <option value="">— Select city —</option>
                {(cities as any[]).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setAdding(false); setForm({ name: "", cityId: "" }); }}
              className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
              <X className="h-3.5 w-3.5" /> Cancel
            </button>
            <button onClick={() => createMut.mutate()} disabled={!form.name || createMut.isPending}
              className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
              <Check className="h-3.5 w-3.5" /> Create
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-12 rounded-2xl bg-gray-100 animate-pulse" />)}</div>
      ) : (centres as any[]).length === 0 ? (
        <EmptyState icon={Landmark} message="No centres yet — centres are physical venues where batches run" />
      ) : (
        <Table>
          <THead cols={["Centre", "City", "Status", ""]} />
          <tbody className="divide-y divide-gray-50">
            {(centres as any[]).map((c: any) => (
              <tr key={c.id} className={`hover:bg-gray-50/50 ${!c.isActive ? "opacity-60" : ""}`}>
                <td className="px-5 py-3">
                  {editId === c.id ? (
                    <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="max-w-xs" autoFocus />
                  ) : (
                    <div className="flex items-center gap-2">
                      <Landmark className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                      <span className="font-semibold text-gray-900">{c.name}</span>
                    </div>
                  )}
                </td>
                <td className="px-5 py-3">
                  {editId === c.id ? (
                    <Select value={editForm.cityId} onChange={(e) => setEditForm({ ...editForm, cityId: e.target.value })} className="max-w-[160px]">
                      <option value="">— None —</option>
                      {(cities as any[]).map((city: any) => <option key={city.id} value={city.id}>{city.name}</option>)}
                    </Select>
                  ) : (
                    c.city
                      ? <span className="flex items-center gap-1 text-xs text-gray-600"><MapPin className="h-3 w-3 shrink-0" />{c.city.name}</span>
                      : <span className="text-xs text-gray-300">—</span>
                  )}
                </td>
                <td className="px-5 py-3">
                  {canEdit
                    ? <ActiveToggle isActive={c.isActive} onToggle={() => toggleMut.mutate(c.id)} />
                    : c.isActive ? <span className="text-xs text-green-600">Active</span> : <span className="text-xs text-gray-400">Inactive</span>}
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    {editId === c.id ? (
                      <SaveCancel onSave={() => updateMut.mutate(c.id)} onCancel={() => setEditId(null)} disabled={!editForm.name || updateMut.isPending} />
                    ) : (
                      <ActionButtons canEdit={canEdit}
                        onEdit={() => { setEditId(c.id); setEditForm({ name: c.name, cityId: c.cityId ?? "" }); }}
                        onDelete={() => { if (confirm(`Delete centre "${c.name}"?`)) deleteMut.mutate(c.id); }} />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}

const NAV_GROUPS = [
  {
    label: "Academic Core",
    items: [
      { id: "academic-years",   label: "Academic Years",   desc: "Manage academic year periods",          icon: CalendarRange },
      { id: "grades",           label: "Grades",           desc: "Class grades used across modules",      icon: GraduationCap },
      { id: "subjects",         label: "Subjects",         desc: "Subjects taught in batches",            icon: BookOpen      },
      { id: "courses",          label: "Courses",          desc: "Course offerings and fee structures",   icon: BookCopy      },
    ],
  },
  {
    label: "Organisation",
    items: [
      { id: "schools",   label: "Schools",  desc: "Affiliated schools and boards",          icon: Building2 },
      { id: "locations", label: "City",     desc: "Cities where centres are located",        icon: MapPin    },
      { id: "centres",   label: "Centres",  desc: "Physical venues where batches are held",  icon: Landmark  },
    ],
  },
  {
    label: "Examinations",
    items: [
      { id: "target-exams", label: "Target Exams", desc: "Board and competitive exam categories", icon: Target },
    ],
  },
  {
    label: "Fees",
    items: [
      { id: "instalment-plans", label: "Instalment Plans", desc: "Fee payment schedule templates", icon: CreditCard },
    ],
  },
];

const ALL_TABS = NAV_GROUPS.flatMap((g) => g.items);

export default function AcademicSettingsPage() {
  const { user } = useAuthStore();
  const [tab, setTab]           = useState("academic-years");
  const [mobileOpen, setMobileOpen] = useState(false);

  const canEdit  = user?.role === "SUPER_ADMIN" || user?.role === "HR_ADMIN";
  const current  = ALL_TABS.find((t) => t.id === tab) ?? ALL_TABS[0];
  const Icon     = current.icon;

  const sidebar = (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Sidebar title — desktop only */}
      <div className="hidden md:flex items-center gap-2 px-4 py-4 border-b border-gray-100 shrink-0">
        <SlidersHorizontal className="h-4 w-4 text-indigo-500 shrink-0" />
        <span className="text-sm font-semibold text-gray-800">Academic Settings</span>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 py-2 space-y-0.5">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="px-4 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
              {group.label}
            </p>
            {group.items.map(({ id, label, icon: ItemIcon }) => (
              <button
                key={id}
                onClick={() => { setTab(id); setMobileOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors rounded-none ${
                  tab === id
                    ? "bg-indigo-50 text-indigo-700 border-r-2 border-indigo-600"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <ItemIcon className="h-4 w-4 shrink-0" />
                {label}
              </button>
            ))}
          </div>
        ))}
      </nav>
    </div>
  );

  return (
    <div className="flex h-full">
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* ── Left sidebar ──────────────────────────────────────────────────── */}
      <aside className={`
        shrink-0 border-r border-gray-100 bg-white
        md:relative md:w-52 md:flex md:flex-col md:h-full
        ${mobileOpen ? "fixed inset-y-0 left-0 z-40 w-64 shadow-xl h-full flex flex-col overflow-hidden" : "hidden md:flex"}
      `}>
        {/* Mobile close header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-100 md:hidden shrink-0">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-indigo-500" />
            <span className="text-sm font-semibold text-gray-800">Academic Settings</span>
          </div>
          <button onClick={() => setMobileOpen(false)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        {sidebar}
      </aside>

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto bg-gray-50/30">
        <div className="p-4 sm:p-6 max-w-3xl space-y-5">

          {/* Mobile nav trigger */}
          <div className="flex items-center gap-3 md:hidden">
            <button
              onClick={() => setMobileOpen(true)}
              className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm"
            >
              <SlidersHorizontal className="h-4 w-4 text-indigo-500" />
              <span>{current.label}</span>
              <ChevronDown className="h-3.5 w-3.5 text-gray-400 ml-1" />
            </button>
          </div>

          {/* Content header */}
          <div className="border-b border-gray-100 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                <Icon className="h-4.5 w-4.5 text-indigo-600 h-5 w-5" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">{current.label}</h1>
                <p className="text-xs text-gray-400 mt-0.5">{current.desc}</p>
              </div>
            </div>
          </div>

          {/* Tab content */}
          {tab === "academic-years"   && <AcademicYearsTab   canEdit={canEdit} />}
          {tab === "target-exams"     && <TargetExamsTab     canEdit={canEdit} />}
          {tab === "grades"           && <GradesTab          canEdit={canEdit} />}
          {tab === "schools"          && <SchoolsTab         canEdit={canEdit} />}
          {tab === "locations"        && <LocationsTab       canEdit={canEdit} />}
          {tab === "centres"          && <CentreTab          canEdit={canEdit} />}
          {tab === "subjects"         && <SubjectsTab        canEdit={canEdit} />}
          {tab === "courses"          && <CoursesTab         canEdit={canEdit} />}
          {tab === "instalment-plans" && <InstalmentPlansTab canEdit={canEdit} />}
        </div>
      </div>
    </div>
  );
}
