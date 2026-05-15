"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, X, Check, Archive, ArchiveRestore,
  School, Users, Filter, SlidersHorizontal, Calendar, MapPin,
  GraduationCap, BarChart2, ChevronRight,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { usePermissions } from "@/hooks/usePermissions";

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
function AYSelect({ value, onChange, years, className = "" }: {
  value: string; onChange: (v: string) => void; years: any[]; className?: string;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className={`w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white ${className}`}
    >
      <option value="">Select academic year</option>
      {years.filter((y: any) => !y.isArchived).map((y: any) => (
        <option key={y.id} value={y.name}>{y.name}</option>
      ))}
    </select>
  );
}

function StatCard({ label, value, color = "indigo" }: {
  label: string; value: string | number; color?: "indigo" | "green" | "amber" | "blue";
}) {
  const ring: Record<string, string> = {
    indigo: "border-indigo-100 bg-indigo-50", green:  "border-green-100 bg-green-50",
    amber:  "border-amber-100 bg-amber-50",   blue:   "border-blue-100 bg-blue-50",
  };
  const txt: Record<string, string> = {
    indigo: "text-indigo-700", green: "text-green-700", amber: "text-amber-700", blue: "text-blue-700",
  };
  return (
    <div className={`rounded-xl border px-3.5 py-3 ${ring[color]}`}>
      <p className="text-xs font-medium text-gray-500 mb-0.5">{label}</p>
      <p className={`text-xl font-bold ${txt[color]}`}>{value}</p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BatchesPage() {
  const { user } = useAuthStore();
  const permissions = usePermissions();
  const qc = useQueryClient();
  const router = useRouter();

  // ── Form state ───────────────────────────────────────────────────────────────
  const [adding, setAdding]     = useState(false);
  const [editId, setEditId]     = useState<string | null>(null);
  const [form, setForm]         = useState({ name: "", description: "", locationId: "", academicYear: "", startDate: "", schoolId: "", gradeId: "" });
  const [editForm, setEditForm] = useState({ name: "", description: "", locationId: "", academicYear: "", startDate: "", schoolId: "", gradeId: "" });

  // ── Filter state ─────────────────────────────────────────────────────────────
  const [filterYear,     setFilterYear]     = useState("");
  const [filterLocation, setFilterLocation] = useState("");   // locationId
  const [filterSchool,   setFilterSchool]   = useState("");   // schoolId
  const [filterGrade,    setFilterGrade]    = useState("");   // gradeId
  const [showArchived,   setShowArchived]   = useState(false);
  const [mobileOpen,     setMobileOpen]     = useState(false);

  const canEdit =
    user?.role === "SUPER_ADMIN" ||
    user?.role === "HR_ADMIN" ||
    (permissions["ACA_BATCH"]?.canCreate ?? false);

  // ── Queries ───────────────────────────────────────────────────────────────────
  const batchParams = new URLSearchParams({ archived: String(showArchived) });
  if (filterYear)     batchParams.set("academicYear", filterYear);
  if (filterLocation) batchParams.set("locationId", filterLocation);
  if (filterSchool)   batchParams.set("schoolId", filterSchool);
  if (filterGrade)    batchParams.set("gradeId", filterGrade);

  const { data: batchRes, isLoading } = useQuery({
    queryKey: ["batches-filtered", batchParams.toString()],
    queryFn: () => api.get(`/api/v1/academics/batches?${batchParams}`).then((r) => r.data),
  });
  const batches: any[] = batchRes?.data ?? [];

  const { data: academicYears = [] } = useQuery({
    queryKey: ["academic-years"],
    queryFn: () => api.get("/api/v1/academics/academic-years").then((r) => r.data.data),
    staleTime: 10 * 60 * 1000,
  });
  const { data: grades = [] } = useQuery({
    queryKey: ["grades"],
    queryFn: () => api.get("/api/v1/academics/grades").then((r) => r.data.data),
    staleTime: 10 * 60 * 1000,
  });
  const { data: schools = [] } = useQuery({
    queryKey: ["schools"],
    queryFn: () => api.get("/api/v1/academics/schools").then((r) => r.data.data),
    staleTime: 10 * 60 * 1000,
  });
  const { data: locations = [] } = useQuery({
    queryKey: ["locations"],
    queryFn: () => api.get("/api/v1/academics/locations").then((r) => r.data.data),
    staleTime: 10 * 60 * 1000,
  });

  // Auto-select active academic year on first load
  useEffect(() => {
    const active = (academicYears as any[]).filter((y) => !y.isArchived);
    if (active.length > 0 && !filterYear) setFilterYear(active[0].name);
  }, [(academicYears as any[]).length]);

  // ── Mutations ─────────────────────────────────────────────────────────────────
  const createMut = useMutation({
    mutationFn: () => api.post("/api/v1/academics/batches", {
      ...form,
      locationId: form.locationId || null,
      schoolId:   form.schoolId   || null,
      gradeId:    form.gradeId    || null,
      startDate:  form.startDate  || undefined,
    }),
    onSuccess: () => {
      toast.success("Batch created");
      setAdding(false);
      setForm({ name: "", description: "", locationId: "", academicYear: "", startDate: "", schoolId: "", gradeId: "" });
      qc.invalidateQueries({ queryKey: ["batches"] });
      qc.invalidateQueries({ queryKey: ["batches-filtered"] });
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });

  const updateMut = useMutation({
    mutationFn: (id: string) => api.patch(`/api/v1/academics/batches/${id}`, {
      ...editForm,
      locationId: editForm.locationId || null,
      schoolId:   editForm.schoolId   || null,
      gradeId:    editForm.gradeId    || null,
      startDate:  editForm.startDate  || undefined,
    }),
    onSuccess: () => {
      toast.success("Updated");
      setEditId(null);
      qc.invalidateQueries({ queryKey: ["batches"] });
      qc.invalidateQueries({ queryKey: ["batches-filtered"] });
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });

  const archiveMut = useMutation({
    mutationFn: (id: string) => api.patch(`/api/v1/academics/batches/${id}/archive`, {}),
    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["batches"] });
      qc.invalidateQueries({ queryKey: ["batches-filtered"] });
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/academics/batches/${id}`),
    onSuccess: () => {
      toast.success("Batch deleted");
      qc.invalidateQueries({ queryKey: ["batches"] });
      qc.invalidateQueries({ queryKey: ["batches-filtered"] });
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });

  // ── Derived stats ─────────────────────────────────────────────────────────────
  const totalStudents = batches.reduce((s, b) => s + (b._count?.students ?? 0), 0);
  const activeBatches = batches.filter((b) => b.isActive && !b.isArchived).length;
  const avgStrength   = batches.length > 0 ? Math.round(totalStudents / batches.length) : 0;
  const hasFilters    = filterYear || filterLocation || filterSchool || filterGrade || showArchived;

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const locName    = (id: string) => (locations as any[]).find((l) => l.id === id)?.name ?? id;
  const schoolName = (id: string) => (schools   as any[]).find((s) => s.id === id)?.name ?? id;
  const gradeName  = (id: string) => (grades    as any[]).find((g) => g.id === id)?.name ?? id;

  // ── Filter panel ──────────────────────────────────────────────────────────────
  const filterPanel = (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Stats */}
      <div className="px-4 py-4 border-b border-gray-100 space-y-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
          <BarChart2 className="h-3.5 w-3.5" /> Statistics
          {hasFilters && <span className="ml-auto text-[10px] font-medium text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded-full">filtered</span>}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <StatCard label="Total Batches"  value={batches.length}  color="indigo" />
          <StatCard label="Active Batches" value={activeBatches}   color="green"  />
          <StatCard label="Total Students" value={totalStudents}   color="blue"   />
          <StatCard label="Avg. Strength"  value={avgStrength}     color="amber"  />
        </div>
      </div>

      {/* Filters */}
      <div className="px-4 py-4 space-y-4 flex-1">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
          <Filter className="h-3.5 w-3.5" /> Filters
        </p>

        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-gray-600">Show</p>
          <div className="flex gap-1.5">
            {([false, true] as const).map((v) => (
              <button key={String(v)} onClick={() => setShowArchived(v)}
                className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                  showArchived === v ? "bg-indigo-600 text-white border-indigo-600" : "border-gray-200 text-gray-600 hover:border-indigo-300"
                }`}>
                {v ? "Archived" : "Active"}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-gray-400" /> Academic Year
          </p>
          <FSelect value={filterYear} onChange={(e) => setFilterYear(e.target.value)}>
            <option value="">All years</option>
            {(academicYears as any[]).filter((y) => !y.isArchived).map((y: any) => (
              <option key={y.id} value={y.name}>{y.name}</option>
            ))}
          </FSelect>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
            <School className="h-3.5 w-3.5 text-gray-400" /> School
          </p>
          <FSelect value={filterSchool} onChange={(e) => setFilterSchool(e.target.value)}>
            <option value="">All schools</option>
            {(schools as any[]).filter((s) => s.isActive).map((s: any) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </FSelect>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
            <GraduationCap className="h-3.5 w-3.5 text-gray-400" /> Grade
          </p>
          <FSelect value={filterGrade} onChange={(e) => setFilterGrade(e.target.value)}>
            <option value="">All grades</option>
            {(grades as any[]).filter((g) => g.isActive).map((g: any) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </FSelect>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-gray-400" /> Location
          </p>
          <FSelect value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)}>
            <option value="">All locations</option>
            {(locations as any[]).filter((l) => l.isActive).map((l: any) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </FSelect>
        </div>

        {hasFilters && (
          <button
            onClick={() => { setFilterYear(""); setFilterLocation(""); setFilterSchool(""); setFilterGrade(""); setShowArchived(false); }}
            className="w-full rounded-lg border border-red-100 bg-red-50 py-1.5 text-xs font-medium text-red-500 hover:bg-red-100 transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-full">
      {mobileOpen && <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Left panel */}
      <aside className={`
        shrink-0 border-r border-gray-100 bg-white
        md:relative md:w-60 md:flex md:flex-col md:h-full
        ${mobileOpen ? "fixed inset-y-0 left-0 z-40 w-72 shadow-xl h-full flex flex-col overflow-hidden" : "hidden md:flex"}
      `}>
        <div className="flex items-center justify-between px-4 pt-4 pb-2 md:hidden shrink-0">
          <span className="text-sm font-semibold text-gray-700">Filters &amp; Stats</span>
          <button onClick={() => setMobileOpen(false)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X className="h-4 w-4" /></button>
        </div>
        {filterPanel}
      </aside>

      {/* Main */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 sm:p-6 space-y-5">

          {/* Header */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <button onClick={() => setMobileOpen(true)}
                className={`md:hidden flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  hasFilters ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}>
                <SlidersHorizontal className="h-3.5 w-3.5" /> Filters{hasFilters ? " •" : ""}
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <School className="h-5 w-5 text-indigo-500" />
                  <h1 className="text-xl font-bold text-gray-900">Batches</h1>
                </div>
                <p className="text-sm text-gray-400">Click a batch to view and manage students.</p>
              </div>
            </div>
            {canEdit && (
              <button onClick={() => setAdding(true)}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors">
                <Plus className="h-3.5 w-3.5" /> New Batch
              </button>
            )}
          </div>

          {/* Add form */}
          {adding && (
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-5 space-y-3">
              <p className="text-sm font-semibold text-indigo-900">New Batch</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Batch Name *</label>
                  <Input placeholder="e.g. JEE Advanced 2026-A" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Academic Year *</label>
                  <AYSelect value={form.academicYear} onChange={(v) => setForm({ ...form, academicYear: v })} years={academicYears as any[]} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">School</label>
                  <FSelect value={form.schoolId} onChange={(e) => setForm({ ...form, schoolId: e.target.value })}>
                    <option value="">None</option>
                    {(schools as any[]).filter((s) => s.isActive).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </FSelect>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Grade</label>
                  <FSelect value={form.gradeId} onChange={(e) => setForm({ ...form, gradeId: e.target.value })}>
                    <option value="">None</option>
                    {(grades as any[]).filter((g) => g.isActive).map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </FSelect>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Location</label>
                  <FSelect value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })}>
                    <option value="">None</option>
                    {(locations as any[]).filter((l) => l.isActive).map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </FSelect>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Start Date</label>
                  <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Description</label>
                  <Input placeholder="Optional" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setAdding(false)}
                  className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
                  <X className="h-3.5 w-3.5" /> Cancel
                </button>
                <button onClick={() => createMut.mutate()} disabled={!form.name || !form.academicYear || createMut.isPending}
                  className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
                  <Check className="h-3.5 w-3.5" /> Create
                </button>
              </div>
            </div>
          )}

          {/* Filter pills */}
          {hasFilters && (
            <div className="flex flex-wrap gap-1.5">
              {filterYear     && <FilterPill label={filterYear}          onRemove={() => setFilterYear("")}     />}
              {filterSchool   && <FilterPill label={schoolName(filterSchool)} onRemove={() => setFilterSchool("")}  icon={<School className="h-3 w-3" />} />}
              {filterGrade    && <FilterPill label={gradeName(filterGrade)}   onRemove={() => setFilterGrade("")}   icon={<GraduationCap className="h-3 w-3" />} />}
              {filterLocation && <FilterPill label={locName(filterLocation)}  onRemove={() => setFilterLocation("")} icon={<MapPin className="h-3 w-3" />} />}
              {showArchived   && <FilterPill label="Archived"             onRemove={() => setShowArchived(false)} />}
            </div>
          )}

          {/* Table */}
          {isLoading ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-2xl bg-gray-100 animate-pulse" />)}</div>
          ) : batches.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 py-14 text-center bg-white">
              <School className="h-10 w-10 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">
                {hasFilters ? "No batches match the current filters." : showArchived ? "No archived batches" : "No batches yet — create one to get started"}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-gray-100 overflow-hidden bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Batch</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Year</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">School / Grade</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Location</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Students</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {batches.map((b: any) => (
                    <tr key={b.id}
                      onClick={() => { if (editId !== b.id) router.push(`/dashboard/academics/batches/${b.id}`); }}
                      className={`hover:bg-indigo-50/40 transition-colors cursor-pointer ${b.isArchived ? "opacity-60" : ""}`}
                    >
                      {/* Batch name */}
                      <td className="px-4 py-3.5" onClick={(e) => editId === b.id && e.stopPropagation()}>
                        {editId === b.id ? (
                          <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="max-w-[180px]" />
                        ) : (
                          <div>
                            <p className="font-semibold text-gray-900">{b.name}</p>
                            {b.description && <p className="text-xs text-gray-400 mt-0.5 hidden md:block">{b.description}</p>}
                            <div className="flex flex-wrap gap-x-3 mt-0.5 sm:hidden text-xs text-gray-400">
                              <span>{b.academicYear}</span>
                              {b.school    && <span>{b.school.name}</span>}
                              {b.grade     && <span>{b.grade.name}</span>}
                              {b.location  && <span className="flex items-center gap-0.5"><MapPin className="h-3 w-3" />{b.location.name}</span>}
                            </div>
                          </div>
                        )}
                      </td>
                      {/* Year */}
                      <td className="px-4 py-3.5 text-gray-600 hidden sm:table-cell" onClick={(e) => editId === b.id && e.stopPropagation()}>
                        {editId === b.id
                          ? <AYSelect value={editForm.academicYear} onChange={(v) => setEditForm({ ...editForm, academicYear: v })} years={academicYears as any[]} className="max-w-[140px]" />
                          : b.academicYear}
                      </td>
                      {/* School / Grade */}
                      <td className="px-4 py-3.5 hidden lg:table-cell" onClick={(e) => editId === b.id && e.stopPropagation()}>
                        {editId === b.id ? (
                          <div className="space-y-1.5">
                            <FSelect value={editForm.schoolId} onChange={(e) => setEditForm({ ...editForm, schoolId: e.target.value })} className="max-w-[140px]">
                              <option value="">None</option>
                              {(schools as any[]).filter((s) => s.isActive).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </FSelect>
                            <FSelect value={editForm.gradeId} onChange={(e) => setEditForm({ ...editForm, gradeId: e.target.value })} className="max-w-[140px]">
                              <option value="">None</option>
                              {(grades as any[]).filter((g) => g.isActive).map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
                            </FSelect>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            {b.school && <p className="text-xs text-gray-600">{b.school.name}</p>}
                            {b.grade  && <p className="text-xs text-gray-400">{b.grade.name}</p>}
                            {!b.school && !b.grade && <span className="text-gray-300 text-xs">—</span>}
                          </div>
                        )}
                      </td>
                      {/* Location */}
                      <td className="px-4 py-3.5 hidden md:table-cell" onClick={(e) => editId === b.id && e.stopPropagation()}>
                        {editId === b.id ? (
                          <FSelect value={editForm.locationId} onChange={(e) => setEditForm({ ...editForm, locationId: e.target.value })} className="max-w-[140px]">
                            <option value="">None</option>
                            {(locations as any[]).filter((l) => l.isActive).map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
                          </FSelect>
                        ) : b.location ? (
                          <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                            <MapPin className="h-3 w-3 text-gray-400 shrink-0" />{b.location.name}
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                      {/* Students */}
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-1 text-gray-600 text-sm">
                          <Users className="h-3.5 w-3.5" /> {b._count.students}
                        </span>
                      </td>
                      {/* Status */}
                      <td className="px-4 py-3.5 hidden sm:table-cell">
                        {b.isArchived
                          ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-600 border border-amber-100"><Archive className="h-3 w-3" />Archived</span>
                          : b.isActive
                            ? <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-600 border border-green-100"><span className="w-1.5 h-1.5 rounded-full bg-green-500" />Active</span>
                            : <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">Inactive</span>
                        }
                      </td>
                      {/* Actions */}
                      <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1 justify-end">
                          {editId === b.id ? (
                            <>
                              <button onClick={() => updateMut.mutate(b.id)} className="p-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"><Check className="h-3.5 w-3.5" /></button>
                              <button onClick={() => setEditId(null)} className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"><X className="h-3.5 w-3.5" /></button>
                            </>
                          ) : canEdit ? (
                            <>
                              <button
                                onClick={() => { setEditId(b.id); setEditForm({ name: b.name, description: b.description ?? "", locationId: b.location?.id ?? "", academicYear: b.academicYear, startDate: b.startDate ? b.startDate.slice(0, 10) : "", schoolId: b.school?.id ?? "", gradeId: b.grade?.id ?? "" }); }}
                                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-indigo-600">
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => archiveMut.mutate(b.id)}
                                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-amber-600"
                                title={b.isArchived ? "Unarchive" : "Archive"}>
                                {b.isArchived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                              </button>
                              {b._count.students > 0 ? (
                                <button disabled title={`Cannot delete — ${b._count.students} student(s) assigned`}
                                  className="p-1.5 rounded-lg border border-gray-100 text-gray-300 cursor-not-allowed">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              ) : (
                                <button onClick={() => { if (confirm(`Delete batch "${b.name}"?`)) deleteMut.mutate(b.id); }}
                                  disabled={deleteMut.isPending}
                                  className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-red-50 hover:text-red-600 hover:border-red-100 disabled:opacity-50">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                              <ChevronRight className="h-4 w-4 text-gray-300 ml-1" />
                            </>
                          ) : (
                            <ChevronRight className="h-4 w-4 text-gray-300" />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterPill({ label, onRemove, icon }: { label: string; onRemove: () => void; icon?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
      {icon}{label}
      <button onClick={onRemove} className="ml-0.5 text-indigo-400 hover:text-indigo-700"><X className="h-3 w-3" /></button>
    </span>
  );
}
