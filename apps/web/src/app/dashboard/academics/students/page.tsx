"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  Plus, Search, Users2, Phone, Globe, MoreVertical,
  Archive, ArchiveRestore, Trash2, KeyRound,
  X, Filter, UserCircle2, SlidersHorizontal,
  GraduationCap, School, Calendar, Layers,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { usePermissions } from "@/hooks/usePermissions";
import { useDebounce } from "@/hooks/useDebounce";

// ── helpers ────────────────────────────────────────────────────────────────────

function FSelect({ className = "", children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props}
      className={`w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none bg-white text-gray-700 ${className}`}
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

  return (
    <div className={`flex items-start gap-4 px-4 py-4 border-b border-gray-50 hover:bg-gray-50/60 transition-colors ${student.isArchived ? "opacity-60" : ""}`}>
      {/* Avatar */}
      <div className="h-11 w-11 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm font-semibold shrink-0 overflow-hidden">
        {student.photoUrl
          ? <img src={`${apiBase}${student.photoUrl}`} alt="photo" className="h-full w-full object-cover" />
          : `${student.firstName[0]}${student.lastName[0]}`}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            onClick={() => onView(student.id)}
            className="font-semibold text-indigo-700 text-sm hover:underline cursor-pointer"
          >
            {student.firstName} {student.lastName}
          </span>
          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium border ${STATUS_COLORS[student.status] ?? STATUS_COLORS.INACTIVE}`}>
            {student.status}
          </span>
          {student.mustChangePassword && (
            <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium border border-amber-100 bg-amber-50 text-amber-600">
              pwd pending
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 mt-0.5 text-xs text-gray-500">
          {student.phone && (
            <span className="flex items-center gap-1">
              <Phone className="h-3 w-3" />{student.phone}
            </span>
          )}
          {student.parentPhone && (
            <span className="flex items-center gap-1">
              <Phone className="h-3 w-3 text-gray-400" />{student.parentPhone}
            </span>
          )}
          {(student.address as any)?.country && (
            <span className="flex items-center gap-1">
              <Globe className="h-3 w-3" />{(student.address as any).country}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 mt-0.5 text-xs text-gray-400">
          <span>added {new Date(student.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>
          {student.batch && (
            <span>Batch: <span className="text-gray-500">{student.batch.academicYear} {student.batch.name}</span></span>
          )}
          {student.studentCode && (
            <span className="font-mono text-gray-400">{student.studentCode}</span>
          )}
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function StudentsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const permissions = usePermissions();
  const qc = useQueryClient();

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
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const debouncedSearch = useDebounce(search, 300);

  const queryParams = new URLSearchParams({
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(showFilter === "ACTIVE"   ? { archived: "false", status: "ACTIVE" } : {}),
    ...(showFilter === "ARCHIVED" ? { archived: "true"  } : {}),
    ...(schoolId     ? { schoolId }     : {}),
    ...(academicYear ? { academicYear } : {}),
    ...(gradeId      ? { gradeId }      : {}),
    ...(batchId      ? { batchId }      : {}),
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
  const { data: batches = [] } = useQuery({
    queryKey: ["batches", false],
    queryFn: () => api.get("/api/v1/academics/batches?archived=false").then((r) => r.data.data),
    staleTime: 5 * 60 * 1000,
  });

  const { data: academicYears = [] } = useQuery({
    queryKey: ["academic-years"],
    queryFn: () => api.get("/api/v1/academics/academic-years").then((r) => r.data.data),
    staleTime: 10 * 60 * 1000,
  });

  const { data: grades = [] } = useQuery({
    queryKey: ["grades"],
    queryFn: () => api.get("/api/v1/academics/settings/grades").then((r) => r.data.data),
    staleTime: 10 * 60 * 1000,
  });

  const { data: schools = [] } = useQuery({
    queryKey: ["schools"],
    queryFn: () => api.get("/api/v1/academics/settings/schools").then((r) => r.data.data),
    staleTime: 10 * 60 * 1000,
  });

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

  // Batches scoped to selected academic year
  const filteredBatches = (batches as any[]).filter(
    (b) => !b.isArchived && (!academicYear || b.academicYear === academicYear)
  );

  const hasActiveFilters = showFilter !== "ALL" || schoolId || academicYear || gradeId || batchId || search;

  // ── Filter panel content ──────────────────────────────────────────────────────
  const filterContent = (
    <div className="flex flex-col h-full overflow-y-auto">

      {/* ── Filters ───────────────────────────────────────────── */}
      <div className="px-4 py-4 space-y-5 flex-1">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
          <Filter className="h-3.5 w-3.5" /> Filters
        </p>

        {/* Show */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-600">Show</p>
          <div className="flex gap-1.5 flex-wrap">
            {(["ALL", "ACTIVE", "ARCHIVED"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setShowFilter(v)}
                className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                  showFilter === v ? "bg-indigo-600 text-white border-indigo-600" : "border-gray-200 text-gray-600 hover:border-indigo-300"
                }`}
              >
                {v === "ALL" ? "All" : v.charAt(0) + v.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        {/* School */}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
            <School className="h-3.5 w-3.5 text-gray-400" /> School
          </p>
          <FSelect value={schoolId} onChange={(e) => setSchoolId(e.target.value)}>
            <option value="">All schools</option>
            {(schools as any[]).map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </FSelect>
        </div>

        {/* Academic Year */}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-gray-400" /> Academic Year
          </p>
          <FSelect value={academicYear} onChange={(e) => { setAcademicYear(e.target.value); setBatchId(""); }}>
            <option value="">All years</option>
            {(academicYears as any[]).filter((y) => !y.isArchived).map((y) => (
              <option key={y.id} value={y.name}>{y.name}</option>
            ))}
          </FSelect>
        </div>

        {/* Grade */}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-gray-400" /> Grade
          </p>
          <FSelect value={gradeId} onChange={(e) => setGradeId(e.target.value)}>
            <option value="">All grades</option>
            {(grades as any[]).map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </FSelect>
        </div>

        {/* Batch */}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
            <GraduationCap className="h-3.5 w-3.5 text-gray-400" /> Batch
          </p>
          <FSelect value={batchId} onChange={(e) => setBatchId(e.target.value)}>
            <option value="">All batches</option>
            {filteredBatches.map((b: any) => (
              <option key={b.id} value={b.id}>
                {b.name}{b.academicYear && !academicYear ? ` (${b.academicYear})` : ""}
              </option>
            ))}
          </FSelect>
        </div>

        {/* Sort */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-600">Sort By</p>
          <div className="flex gap-1.5">
            {(["name", "createdAt"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setSortBy(v)}
                className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                  sortBy === v ? "bg-indigo-600 text-white border-indigo-600" : "border-gray-200 text-gray-600 hover:border-indigo-300"
                }`}
              >
                {v === "name" ? "Name" : "Date Added"}
              </button>
            ))}
          </div>
        </div>

        {/* Clear */}
        {hasActiveFilters && (
          <button
            onClick={() => { setShowFilter("ALL"); setSchoolId(""); setAcademicYear(""); setGradeId(""); setBatchId(""); setSearch(""); setSortBy("createdAt"); }}
            className="w-full rounded-lg border border-red-100 bg-red-50 py-1.5 text-xs font-medium text-red-500 hover:bg-red-100 transition-colors"
          >
            Clear all filters
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-full">
      {/* ── Mobile filter backdrop ─────────────────────────────────────────── */}
      {mobileFiltersOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setMobileFiltersOpen(false)}
        />
      )}

      {/* ── Left Filter Panel ─────────────────────────────────────────────── */}
      <aside className={`
        shrink-0 border-r border-gray-100 bg-white
        md:relative md:w-64 md:flex md:flex-col md:h-full md:shadow-none md:z-auto
        ${mobileFiltersOpen
          ? "fixed inset-y-0 left-0 z-40 w-72 shadow-xl h-full flex flex-col overflow-hidden"
          : "hidden md:flex"}
      `}>
        {/* Mobile close button */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2 md:hidden shrink-0">
          <span className="text-sm font-semibold text-gray-700">Filters &amp; Stats</span>
          <button onClick={() => setMobileFiltersOpen(false)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        {filterContent}
      </aside>

      {/* ── Main List ─────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top toolbar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-white sm:px-5 sm:gap-3 sm:py-4">
          {/* Mobile filter button */}
          <button
            onClick={() => setMobileFiltersOpen(true)}
            className={`md:hidden flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors shrink-0 ${
              hasActiveFilters
                ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                : "border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filters{hasActiveFilters ? " •" : ""}
          </button>

          <div className="flex items-center gap-2 flex-1 min-w-0 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
            <Search className="h-4 w-4 text-gray-400 shrink-0" />
            <input
              type="text"
              placeholder="Search by name, code, email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none min-w-0"
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-gray-400 hover:text-gray-600 shrink-0"><X className="h-4 w-4" /></button>
            )}
          </div>

          <span className="text-xs text-gray-400 shrink-0 hidden sm:block tabular-nums">{stats.total} student{stats.total !== 1 ? "s" : ""}</span>

          {canEdit && (
            <button
              onClick={() => router.push("/dashboard/academics/students/new")}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors shrink-0 sm:px-4"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New Student</span>
              <span className="sm:hidden">New</span>
            </button>
          )}
        </div>

        {/* Active filter pills */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-1.5 px-4 py-2 bg-white border-b border-gray-50">
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

        {/* List */}
        <div className="flex-1 overflow-y-auto bg-white">
          {isLoading ? (
            <div className="space-y-0">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="flex items-start gap-4 px-4 py-4 border-b border-gray-50">
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
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <UserCircle2 className="h-12 w-12 text-gray-200 mb-3" />
              <p className="font-semibold text-gray-500">No students found</p>
              <p className="text-sm text-gray-400 mt-1">
                {hasActiveFilters ? "Try adjusting your filters." : "Add your first student to get started."}
              </p>
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
  );
}

function FilterPill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
      {label}
      <button onClick={onRemove} className="ml-0.5 text-indigo-400 hover:text-indigo-700">
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
