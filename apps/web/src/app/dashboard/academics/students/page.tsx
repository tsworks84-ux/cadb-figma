"use client";

import { useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  Plus, Search, Phone, Globe, MoreVertical,
  Archive, ArchiveRestore, Trash2, KeyRound,
  X, GraduationCap, School, Calendar, Layers,
  Upload,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { usePermissions } from "@/hooks/usePermissions";
import { useDebounce } from "@/hooks/useDebounce";

// ── helpers ────────────────────────────────────────────────────────────────────

const NAV2 = "#28245f";
const PRIMARY_GRADIENT = "linear-gradient(135deg, #28245f, #4f46e5)";

function FSelect({ className = "", children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none bg-white text-gray-700 ${className}`}
    >
      {children}
    </select>
  );
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:    "bg-green-50 text-green-700 border-green-100",
  INACTIVE:  "bg-gray-100 text-gray-600 border-gray-200",
  SUSPENDED: "bg-red-50 text-red-600 border-red-100",
  GRADUATED: "bg-blue-50 text-blue-600 border-blue-100",
  DROPPED:   "bg-amber-50 text-amber-600 border-amber-100",
};

// ── Student Row ────────────────────────────────────────────────────────────────

function StudentRow({ student, canEdit, onArchive, onDelete, onResetPassword, onView }: {
  student: any;
  canEdit: boolean;
  onArchive: (id: string) => void;
  onDelete: (id: string, name: string) => void;
  onResetPassword: (id: string, name: string) => void;
  onView: (id: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

  const initials = `${student.firstName[0]}${student.lastName[0]}`;

  return (
    <div className={`flex items-start gap-4 px-6 py-4 border-b border-gray-50 hover:bg-gray-50/60 transition-colors ${student.isArchived ? "opacity-60" : ""}`}>
      {/* Avatar */}
      <div
        className="h-11 w-11 rounded-full flex items-center justify-center text-sm font-bold shrink-0 overflow-hidden text-white"
        style={{ background: student.photoUrl ? undefined : "linear-gradient(135deg, #28245f, #7c3aed)" }}
      >
        {student.photoUrl
          ? <img src={`${apiBase}${student.photoUrl}`} alt="photo" className="h-full w-full object-cover" />
          : initials}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            onClick={() => onView(student.id)}
            className="font-bold text-sm hover:underline cursor-pointer"
            style={{ color: NAV2 }}
          >
            {student.firstName} {student.lastName}
          </span>
          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold border ${STATUS_COLORS[student.status] ?? STATUS_COLORS.INACTIVE}`}>
            {student.status}
          </span>
          {student.mustChangePassword && (
            <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold border border-amber-100 bg-amber-50 text-amber-600">
              pwd pending
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 mt-0.5 text-xs text-gray-500">
          {student.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{student.phone}</span>}
          {student.parentPhone && <span className="flex items-center gap-1"><Phone className="h-3 w-3 text-gray-400" />{student.parentPhone}</span>}
          {(student.address as any)?.country && <span className="flex items-center gap-1"><Globe className="h-3 w-3" />{(student.address as any).country}</span>}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 mt-0.5 text-xs text-gray-400">
          <span>added {new Date(student.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>
          {student.batch && <span>Batch: <span className="text-gray-500">{student.batch.academicYear} {student.batch.name}</span></span>}
          {student.studentCode && <span className="font-mono">{student.studentCode}</span>}
        </div>
      </div>

      {/* Actions menu */}
      {canEdit && (
        <div className="relative shrink-0" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-8 z-20 w-44 rounded-xl bg-white shadow-lg border border-gray-100 py-1 text-sm">
                <button onClick={() => { setMenuOpen(false); onResetPassword(student.id, `${student.firstName} ${student.lastName}`); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-50">
                  <KeyRound className="h-3.5 w-3.5" /> Reset Password
                </button>
                <button onClick={() => { setMenuOpen(false); onArchive(student.id); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-50">
                  {student.isArchived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                  {student.isArchived ? "Unarchive" : "Archive"}
                </button>
                <div className="border-t border-gray-100 my-1" />
                <button onClick={() => { setMenuOpen(false); onDelete(student.id, `${student.firstName} ${student.lastName}`); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50">
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Stat Card ──────────────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      className="bg-white border border-gray-200 rounded-2xl p-[18px]"
      style={{ boxShadow: "0 8px 22px rgba(20,23,53,.05)" }}
    >
      <span className="text-[12px] font-black text-gray-400 uppercase tracking-[.04em]">{label}</span>
      <strong className="block mt-2 text-[28px] leading-none font-black text-gray-900">{value}</strong>
    </div>
  );
}

// ── Filter Pill ────────────────────────────────────────────────────────────────

function FilterPill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold text-white" style={{ background: NAV2, borderColor: NAV2 }}>
      {label}
      <button onClick={onRemove} className="ml-0.5 text-white/70 hover:text-white">
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

function StudentsPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const teacherId    = searchParams.get("teacherId");
  const { user }     = useAuthStore();
  const permissions  = usePermissions();
  const qc           = useQueryClient();

  const canEdit =
    user?.role === "SUPER_ADMIN" ||
    user?.role === "HR_ADMIN" ||
    (permissions["STU_PROFILE"]?.canCreate ?? false);

  // ── Filter state ─────────────────────────────────────────────────────────────
  const [search, setSearch]             = useState("");
  const [showFilter, setShowFilter]     = useState<"ALL" | "ACTIVE" | "ARCHIVED">("ALL");
  const [schoolId, setSchoolId]         = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [gradeId, setGradeId]           = useState("");
  const [batchId, setBatchId]           = useState("");
  const [sortBy, setSortBy]             = useState<"createdAt" | "name">("createdAt");

  const debouncedSearch = useDebounce(search, 300);

  const queryParams = new URLSearchParams({
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(showFilter === "ACTIVE"   ? { archived: "false", status: "ACTIVE" } : {}),
    ...(showFilter === "ARCHIVED" ? { archived: "true"  } : {}),
    ...(schoolId     ? { schoolId }     : {}),
    ...(academicYear ? { academicYear } : {}),
    ...(gradeId      ? { gradeId }      : {}),
    ...(batchId      ? { batchId }      : {}),
    // When viewing a teacher's scoped academics, filter to their batches
    ...(teacherId && !batchId ? { teacherId } : {}),
    sortBy,
    sortOrder: sortBy === "name" ? "asc" : "desc",
    limit: "200",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["students", queryParams.toString()],
    queryFn: () => api.get(`/api/v1/academics/students?${queryParams}`).then((r) => r.data),
    staleTime: 30 * 1000,
  });

  const students: any[] = data?.data ?? [];
  const stats            = data?.stats ?? { total: 0, byStatus: {}, batchCount: 0, avgBatchStrength: 0 };

  // ── Reference data ────────────────────────────────────────────────────────────
  // When scoped to a teacher, fetch only their batches for the filter dropdown
  const batchesUrl = teacherId
    ? `/api/v1/academics/batches?archived=false&teacherId=${teacherId}`
    : "/api/v1/academics/batches?archived=false";
  const { data: batches = [] }       = useQuery({ queryKey: ["batches", teacherId ?? false],   queryFn: () => api.get(batchesUrl).then((r) => r.data.data), staleTime: 5 * 60 * 1000 });
  const { data: academicYears = [] } = useQuery({ queryKey: ["academic-years"],   queryFn: () => api.get("/api/v1/academics/academic-years").then((r) => r.data.data), staleTime: 10 * 60 * 1000 });
  const { data: grades = [] }        = useQuery({ queryKey: ["grades"],           queryFn: () => api.get("/api/v1/academics/grades").then((r) => r.data.data), staleTime: 10 * 60 * 1000 });
  const { data: schools = [] }       = useQuery({ queryKey: ["schools"],          queryFn: () => api.get("/api/v1/academics/schools").then((r) => r.data.data), staleTime: 10 * 60 * 1000 });

  // ── Mutations ─────────────────────────────────────────────────────────────────
  const archiveMut = useMutation({
    mutationFn: (id: string) => api.patch(`/api/v1/academics/students/${id}/archive`, {}),
    onSuccess: () => { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["students"] }); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/academics/students/${id}`),
    onSuccess: () => { toast.success("Student deleted"); qc.invalidateQueries({ queryKey: ["students"] }); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });

  const resetPwdMut = useMutation({
    mutationFn: (id: string) => api.post(`/api/v1/academics/students/${id}/reset-password`, {}),
    onSuccess: () => toast.success("Password reset to Welcome@123"),
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });

  const filteredBatches = (batches as any[]).filter(
    (b) => !b.isArchived && (!academicYear || b.academicYear === academicYear)
  );

  const hasActiveFilters = showFilter !== "ALL" || schoolId || academicYear || gradeId || batchId || search;

  const clearFilters = () => {
    setShowFilter("ALL"); setSchoolId(""); setAcademicYear("");
    setGradeId(""); setBatchId(""); setSearch(""); setSortBy("createdAt");
  };

  // ── Chip toggle helper ────────────────────────────────────────────────────────
  function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
    return (
      <button
        onClick={onClick}
        className="min-h-[34px] rounded-full px-[13px] text-sm font-extrabold border transition-colors"
        style={active
          ? { background: NAV2, color: "white", borderColor: NAV2 }
          : { background: "white", color: "#4b5563", borderColor: "#e6e8ef" }
        }
      >
        {label}
      </button>
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ background: "#f4f6fa" }}>

      {/* ── Page Head ─────────────────────────────────────────────────────────── */}
      <div className="shrink-0 bg-white border-b border-gray-200 px-8 py-[22px] flex items-center justify-between gap-6">
        <div className="flex items-center gap-[14px]">
          <button
            onClick={() => router.push("/dashboard/academics")}
            className="w-[42px] h-[42px] rounded-xl border border-gray-200 bg-white flex items-center justify-center text-gray-400 hover:text-gray-700 hover:border-gray-300 transition-all text-xl font-bold"
          >
            ‹
          </button>
          <div>
            <div className="text-[13px] font-extrabold text-gray-400">Academics / Students</div>
            <h1 className="text-[28px] font-black text-gray-900 leading-tight mt-0.5">Students</h1>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <button className="min-h-[42px] rounded-xl border border-gray-200 bg-white px-4 text-sm font-extrabold text-gray-600 hover:bg-gray-50 flex items-center gap-2">
            <Upload className="h-4 w-4" /> Import
          </button>
          {canEdit && (
            <button
              onClick={() => router.push("/dashboard/academics/students/new")}
              className="min-h-[42px] rounded-xl px-4 text-sm font-extrabold text-white flex items-center gap-2"
              style={{ background: PRIMARY_GRADIENT, boxShadow: "0 12px 24px rgba(79,70,229,.25)" }}
            >
              <Plus className="h-4 w-4" /> New Student
            </button>
          )}
        </div>
      </div>

      {/* ── Body layout ───────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Filter Sidebar ────────────────────────────────────────────────── */}
        <aside className="hidden md:flex flex-col w-[300px] shrink-0 bg-white border-r border-gray-200 overflow-y-auto">
          <div className="px-[18px] py-[22px] space-y-[22px]">
            <h2 className="text-[13px] font-black text-gray-400 uppercase tracking-[.08em]">Filters</h2>

            {/* Show */}
            <div className="space-y-2">
              <label className="block text-[13px] font-extrabold text-gray-600">Show</label>
              <div className="flex flex-wrap gap-2">
                {(["ALL", "ACTIVE", "ARCHIVED"] as const).map((v) => (
                  <Chip key={v} label={v === "ALL" ? "All" : v.charAt(0) + v.slice(1).toLowerCase()} active={showFilter === v} onClick={() => setShowFilter(v)} />
                ))}
              </div>
            </div>

            {/* School */}
            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-[13px] font-extrabold text-gray-600">
                <School className="h-3.5 w-3.5 text-gray-400" /> School
              </label>
              <FSelect value={schoolId} onChange={(e) => setSchoolId(e.target.value)}>
                <option value="">All schools</option>
                {(schools as any[]).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </FSelect>
            </div>

            {/* Academic Year */}
            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-[13px] font-extrabold text-gray-600">
                <Calendar className="h-3.5 w-3.5 text-gray-400" /> Academic Year
              </label>
              <FSelect value={academicYear} onChange={(e) => { setAcademicYear(e.target.value); setBatchId(""); }}>
                <option value="">All years</option>
                {(academicYears as any[]).filter((y) => !y.isArchived).map((y) => <option key={y.id} value={y.name}>{y.name}</option>)}
              </FSelect>
            </div>

            {/* Grade */}
            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-[13px] font-extrabold text-gray-600">
                <Layers className="h-3.5 w-3.5 text-gray-400" /> Grade
              </label>
              <FSelect value={gradeId} onChange={(e) => setGradeId(e.target.value)}>
                <option value="">All grades</option>
                {(grades as any[]).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </FSelect>
            </div>

            {/* Batch */}
            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-[13px] font-extrabold text-gray-600">
                <GraduationCap className="h-3.5 w-3.5 text-gray-400" /> Batch
              </label>
              <FSelect value={batchId} onChange={(e) => setBatchId(e.target.value)}>
                <option value="">All batches</option>
                {filteredBatches.map((b: any) => (
                  <option key={b.id} value={b.id}>
                    {b.name}{b.academicYear && !academicYear ? ` (${b.academicYear})` : ""}
                  </option>
                ))}
              </FSelect>
            </div>

            {/* Sort By */}
            <div className="space-y-2">
              <label className="block text-[13px] font-extrabold text-gray-600">Sort By</label>
              <div className="flex gap-2">
                {(["name", "createdAt"] as const).map((v) => (
                  <Chip key={v} label={v === "name" ? "Name" : "Date Added"} active={sortBy === v} onClick={() => setSortBy(v)} />
                ))}
              </div>
            </div>

            {/* Clear */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="w-full rounded-xl border border-red-100 bg-red-50 py-2 text-xs font-extrabold text-red-500 hover:bg-red-100 transition-colors"
              >
                Clear all filters
              </button>
            )}
          </div>
        </aside>

        {/* ── Main Content ──────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Toolbar */}
          <div className="shrink-0 bg-white border-b border-gray-100 px-6 py-[14px] flex items-center gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-0 bg-white rounded-[14px] border border-gray-200 px-4 h-12">
              <Search className="h-4 w-4 text-gray-400 shrink-0" />
              <input
                type="text"
                placeholder="Search by name, roll number, email, school, or batch"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 bg-transparent text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none min-w-0 font-semibold"
              />
              {search && (
                <button onClick={() => setSearch("")} className="text-gray-400 hover:text-gray-600 shrink-0">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <span className="text-sm font-extrabold text-gray-400 shrink-0 tabular-nums">
              {stats.total} student{stats.total !== 1 ? "s" : ""}
            </span>
            {canEdit && (
              <button
                onClick={() => router.push("/dashboard/academics/students/new")}
                className="md:hidden min-h-[42px] rounded-xl px-4 text-sm font-extrabold text-white flex items-center gap-2 shrink-0"
                style={{ background: PRIMARY_GRADIENT, boxShadow: "0 12px 24px rgba(79,70,229,.25)" }}
              >
                <Plus className="h-4 w-4" /> New
              </button>
            )}
          </div>

          {/* Stat Grid */}
          <div className="shrink-0 grid grid-cols-2 sm:grid-cols-4 gap-3.5 px-6 pt-5 pb-3">
            <StatCard label="Total Students"      value={stats.total} />
            <StatCard label="Active"              value={stats.byStatus?.ACTIVE ?? 0} />
            <StatCard label="Admissions Pending"  value={stats.byStatus?.PENDING ?? 0} />
            <StatCard label="Avg. Batch Size"     value={stats.avgBatchStrength ?? 0} />
          </div>

          {/* Active filter pills */}
          {hasActiveFilters && (
            <div className="shrink-0 flex flex-wrap items-center gap-1.5 px-6 py-2">
              {showFilter !== "ALL" && (
                <FilterPill label={showFilter === "ACTIVE" ? "Active only" : "Archived"} onRemove={() => setShowFilter("ALL")} />
              )}
              {schoolId && (
                <FilterPill label={(schools as any[]).find((s) => s.id === schoolId)?.name ?? "School"} onRemove={() => setSchoolId("")} />
              )}
              {academicYear && (
                <FilterPill label={academicYear} onRemove={() => { setAcademicYear(""); setBatchId(""); }} />
              )}
              {gradeId && (
                <FilterPill label={(grades as any[]).find((g) => g.id === gradeId)?.name ?? "Grade"} onRemove={() => setGradeId("")} />
              )}
              {batchId && (
                <FilterPill label={(batches as any[]).find((b) => b.id === batchId)?.name ?? "Batch"} onRemove={() => setBatchId("")} />
              )}
            </div>
          )}

          {/* Student list */}
          <div className="flex-1 overflow-y-auto bg-white rounded-t-2xl mx-6 mb-0 mt-3 border border-gray-200" style={{ boxShadow: "0 10px 28px rgba(20,23,53,.06)", borderColor: "#e6e8ef" }}>
            {isLoading ? (
              <div>
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="flex items-start gap-4 px-6 py-4 border-b border-gray-50">
                    <div className="h-11 w-11 rounded-full bg-gray-100 animate-pulse shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-40 bg-gray-100 rounded animate-pulse" />
                      <div className="h-3 w-64 bg-gray-100 rounded animate-pulse" />
                      <div className="h-3 w-48 bg-gray-100 rounded animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : students.length === 0 ? (
              <div
                className="flex items-center justify-center text-center p-9 m-4 rounded-[18px] border border-dashed border-slate-300"
                style={{ minHeight: 420 }}
              >
                <div>
                  <div
                    className="w-[72px] h-[72px] rounded-[22px] flex items-center justify-center mx-auto mb-4 text-2xl font-black"
                    style={{ background: "#eef2ff", color: NAV2 }}
                  >
                    ST
                  </div>
                  <h2 className="text-[22px] font-black text-gray-800 m-0">No students found</h2>
                  <p className="mt-2 mb-4 text-sm font-semibold text-gray-500 max-w-[460px] leading-relaxed">
                    {hasActiveFilters
                      ? "Try adjusting your filters to see more results."
                      : "Add the first student or adjust filters. Once records exist, this area switches to a dense table with status, school, grade, batch, and last activity."}
                  </p>
                  {canEdit && !hasActiveFilters && (
                    <button
                      onClick={() => router.push("/dashboard/academics/students/new")}
                      className="min-h-[42px] rounded-xl px-5 text-sm font-extrabold text-white"
                      style={{ background: PRIMARY_GRADIENT, boxShadow: "0 12px 24px rgba(79,70,229,.25)" }}
                    >
                      + Add First Student
                    </button>
                  )}
                  {hasActiveFilters && (
                    <button
                      onClick={clearFilters}
                      className="min-h-[42px] rounded-xl border border-gray-200 px-5 text-sm font-extrabold text-gray-600 hover:bg-gray-50"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              </div>
            ) : (
              students.map((s) => (
                <StudentRow
                  key={s.id}
                  student={s}
                  canEdit={canEdit}
                  onView={(id) => router.push(`/dashboard/academics/students/${id}`)}
                  onArchive={(id) => archiveMut.mutate(id)}
                  onDelete={(id, name) => { if (confirm(`Delete student "${name}"? This cannot be undone.`)) deleteMut.mutate(id); }}
                  onResetPassword={(id, name) => { if (confirm(`Reset password for "${name}" to Welcome@123?`)) resetPwdMut.mutate(id); }}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StudentsPageWrapped() {
  return <Suspense fallback={null}><StudentsPage /></Suspense>;
}
