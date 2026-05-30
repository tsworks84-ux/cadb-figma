"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  ArrowLeft, Users, School, GraduationCap, MapPin, Calendar,
  Search, X, Plus, UserMinus, UserCheck, Download, Printer,
  ChevronLeft, ChevronRight, AlertCircle, Pencil, Check,
  Archive, BookOpen, Filter, UserCircle2,
  CalendarCheck, ClipboardList, BarChart2, MessageSquare,
  TrendingUp, CheckCircle2, XCircle, Clock,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { usePermissions } from "@/hooks/usePermissions";
import { BatchStatsPanel } from "./BatchStatsPanel";

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_DOT: Record<string, string> = {
  ACTIVE:    "bg-green-500",
  INACTIVE:  "bg-gray-400",
  SUSPENDED: "bg-red-500",
  GRADUATED: "bg-blue-500",
  DROPPED:   "bg-amber-500",
};
const STATUS_BADGE: Record<string, string> = {
  ACTIVE:    "bg-green-50 text-green-700 border-green-100",
  INACTIVE:  "bg-gray-100 text-gray-600 border-gray-200",
  SUSPENDED: "bg-red-50 text-red-600 border-red-100",
  GRADUATED: "bg-blue-50 text-blue-700 border-blue-100",
  DROPPED:   "bg-amber-50 text-amber-700 border-amber-100",
};
const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Active", INACTIVE: "Inactive", SUSPENDED: "Suspended",
  GRADUATED: "Graduated", DROPPED: "Dropped",
};

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
      className={`rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none bg-white text-gray-700 ${className}`}
    >
      {children}
    </select>
  );
}

// ── CSV export ────────────────────────────────────────────────────────────────

function exportCSV(students: any[], batchName: string) {
  const headers = ["#", "Student Code", "Name", "Email", "Phone", "Status", "School", "Grade", "Admission No", "Academic Year"];
  const rows = students.map((s: any, i: number) => [
    i + 1,
    s.studentCode,
    `${s.firstName} ${s.lastName}`,
    s.email,
    s.phone ?? "",
    STATUS_LABEL[s.status] ?? s.status,
    s.school?.name ?? "",
    s.grade?.name ?? "",
    s.admissionNumber ?? "",
    s.academicYear ?? "",
  ]);
  const csv = [headers, ...rows]
    .map((r) => r.map((c: any) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${batchName.replace(/\s+/g, "_")}_students.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const permissions = usePermissions();

  const canEdit =
    user?.role === "SUPER_ADMIN" ||
    user?.role === "HR_ADMIN" ||
    (permissions["ACA_BATCH"]?.canCreate ?? false);

  // ── List state ───────────────────────────────────────────────────────────────
  const [search,       setSearch]       = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page,         setPage]         = useState(1);
  const LIMIT = 25;

  // ── Tab state ─────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"students" | "attendance" | "assignments" | "assessments" | "ptm">("students");
  const [statsOpen, setStatsOpen] = useState(false);

  // ── Add modal state ──────────────────────────────────────────────────────────
  const [addOpen,       setAddOpen]       = useState(false);
  const [addSearch,     setAddSearch]     = useState("");
  const [debouncedAdd,  setDebouncedAdd]  = useState("");

  // ── Confirm modal state ──────────────────────────────────────────────────────
  const [confirmStudent, setConfirmStudent] = useState<{ id: string; name: string; action: "remove" | "drop" } | null>(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedAdd(addSearch), 300);
    return () => clearTimeout(t);
  }, [addSearch]);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [debouncedSearch, statusFilter]);

  // ── Batch details ────────────────────────────────────────────────────────────
  const { data: batch, isLoading: batchLoading } = useQuery({
    queryKey: ["batch", id],
    queryFn: () => api.get(`/api/v1/academics/batches/${id}`).then((r) => r.data.data),
  });

  // ── Tab data queries ─────────────────────────────────────────────────────────
  const { data: attendanceSummary, isLoading: attendanceLoading } = useQuery({
    queryKey: ["batch-attendance-summary", id],
    queryFn: () => api.get(`/api/v1/academics/batches/${id}/attendance-summary`).then((r) => r.data.data),
    enabled: activeTab === "attendance",
  });
  const [attendanceDate, setAttendanceDate] = useState("");
  const attendanceDateClasses: any[] = (attendanceSummary?.classes ?? []).filter((c: any) =>
    attendanceDate ? c.date?.startsWith(attendanceDate) : false
  );

  const { data: assignmentSummary, isLoading: assignmentLoading } = useQuery({
    queryKey: ["batch-assignment-summary", id],
    queryFn: () => api.get(`/api/v1/academics/batches/${id}/assignment-summary`).then((r) => r.data.data),
    enabled: activeTab === "assignments",
  });

  const { data: examSummary, isLoading: examLoading } = useQuery({
    queryKey: ["batch-exam-summary", id],
    queryFn: () => api.get(`/api/v1/academics/batches/${id}/exam-summary`).then((r) => r.data.data),
    enabled: activeTab === "assessments",
  });
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const { data: examResultsRes, isLoading: examResultsLoading } = useQuery({
    queryKey: ["exam-results", selectedExamId],
    queryFn: () => api.get(`/api/v1/academics/assessments/${selectedExamId}/results`).then((r) => r.data),
    enabled: !!selectedExamId,
  });

  // ── Students in batch ────────────────────────────────────────────────────────
  const studentParams = new URLSearchParams({ batchId: id, page: String(page), limit: String(LIMIT) });
  if (debouncedSearch)       studentParams.set("search", debouncedSearch);
  if (statusFilter !== "ALL") studentParams.set("status", statusFilter);

  const { data: studentsRes, isLoading: studentsLoading } = useQuery({
    queryKey: ["batch-students", id, studentParams.toString()],
    queryFn: () => api.get(`/api/v1/academics/students?${studentParams}`).then((r) => r.data),
    placeholderData: (prev) => prev,
  });

  const students: any[] = studentsRes?.data ?? [];
  const meta = studentsRes?.meta ?? { total: 0, page: 1, limit: LIMIT };
  const totalPages = Math.ceil(meta.total / LIMIT);

  // ── Add modal: search students not in this batch ──────────────────────────────
  const addParams = new URLSearchParams({ limit: "20", archived: "false" });
  if (debouncedAdd) addParams.set("search", debouncedAdd);

  const { data: addResults } = useQuery({
    queryKey: ["students-for-add", debouncedAdd],
    queryFn: () => api.get(`/api/v1/academics/students?${addParams}`).then((r) => r.data.data),
    enabled: addOpen,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────────
  const assignMut = useMutation({
    mutationFn: (studentId: string) => api.put(`/api/v1/academics/batches/${id}/students/${studentId}`, {}),
    onSuccess: () => {
      toast.success("Student added to batch");
      qc.invalidateQueries({ queryKey: ["batch-students", id] });
      qc.invalidateQueries({ queryKey: ["batch", id] });
      qc.invalidateQueries({ queryKey: ["students-for-add"] });
      qc.invalidateQueries({ queryKey: ["batches"] });
      qc.invalidateQueries({ queryKey: ["batches-filtered"] });
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });

  const removeMut = useMutation({
    mutationFn: (studentId: string) => api.delete(`/api/v1/academics/batches/${id}/students/${studentId}`),
    onSuccess: () => {
      toast.success("Student removed from batch");
      setConfirmStudent(null);
      qc.invalidateQueries({ queryKey: ["batch-students", id] });
      qc.invalidateQueries({ queryKey: ["batch", id] });
      qc.invalidateQueries({ queryKey: ["batches"] });
      qc.invalidateQueries({ queryKey: ["batches-filtered"] });
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });

  const statusMut = useMutation({
    mutationFn: ({ studentId, status }: { studentId: string; status: string }) =>
      api.patch(`/api/v1/academics/batches/${id}/students/${studentId}/status`, { status }),
    onSuccess: () => {
      toast.success("Status updated");
      setConfirmStudent(null);
      qc.invalidateQueries({ queryKey: ["batch-students", id] });
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });

  function handleConfirm() {
    if (!confirmStudent) return;
    if (confirmStudent.action === "remove") removeMut.mutate(confirmStudent.id);
    else statusMut.mutate({ studentId: confirmStudent.id, status: "DROPPED" });
  }

  // ── Derived ───────────────────────────────────────────────────────────────────
  const batchStartDate = batch?.startDate ? new Date(batch.startDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : null;

  if (batchLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-40 rounded-xl bg-gray-100 animate-pulse" />
        <div className="h-32 rounded-2xl bg-gray-100 animate-pulse" />
        <div className="h-64 rounded-2xl bg-gray-100 animate-pulse" />
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="p-6 text-center">
        <AlertCircle className="h-10 w-10 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-400">Batch not found.</p>
        <button onClick={() => router.back()} className="mt-3 text-xs text-indigo-600 underline">Go back</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-gray-50/40">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100 px-4 sm:px-6 py-4 space-y-3 print:hidden">
        {/* Back + title */}
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-indigo-600 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Batches</span>
          </button>
          <span className="text-gray-300">/</span>
          <h1 className="text-lg font-bold text-gray-900 truncate">{batch.name}</h1>
          {batch.isArchived && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-600 border border-amber-100 shrink-0">
              <Archive className="h-3 w-3" /> Archived
            </span>
          )}
          {!batch.isArchived && batch.isActive && (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-600 border border-green-100 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Active
            </span>
          )}
        </div>

        {/* Info chips */}
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <InfoChip icon={<Calendar className="h-3.5 w-3.5 text-indigo-400" />} label="Academic Year" value={batch.academicYear} />
          {batch.school && <InfoChip icon={<School className="h-3.5 w-3.5 text-blue-400" />} label="School" value={batch.school.name} />}
          {batch.grade  && <InfoChip icon={<GraduationCap className="h-3.5 w-3.5 text-purple-400" />} label="Grade" value={batch.grade.name} />}
          {batch.location && <InfoChip icon={<MapPin className="h-3.5 w-3.5 text-green-400" />} label="Location" value={batch.location.name} />}
          {batchStartDate && <InfoChip icon={<Calendar className="h-3.5 w-3.5 text-amber-400" />} label="Start Date" value={batchStartDate} />}
          <InfoChip icon={<Users className="h-3.5 w-3.5 text-gray-400" />} label="Students" value={batch._count?.students ?? 0} />
          {batch.facultyMentor && (
            <InfoChip
              icon={<UserCircle2 className="h-3.5 w-3.5 text-rose-400" />}
              label="Faculty Mentor"
              value={`${batch.facultyMentor.firstName} ${batch.facultyMentor.lastName}`}
            />
          )}
        </div>

        {/* Subject teachers row */}
        {batch.batchSubjects?.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="flex items-center gap-1 text-xs text-gray-400 shrink-0">
              <BookOpen className="h-3.5 w-3.5" /> Subjects:
            </span>
            {batch.batchSubjects.map((bs: any) => (
              <span
                key={bs.id}
                className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-700"
              >
                {bs.subject?.name ?? "—"}
                {bs.employee && (
                  <span className="text-indigo-400">·</span>
                )}
                {bs.employee && (
                  <span className="text-indigo-500 font-normal">
                    {bs.employee.firstName} {bs.employee.lastName}
                  </span>
                )}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Tab navigation ──────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100 px-4 sm:px-6 print:hidden">
        <div className="flex gap-1 overflow-x-auto">
          {([
            { key: "students",    label: "Students",    icon: Users },
            { key: "attendance",  label: "Attendance",  icon: CalendarCheck },
            { key: "assignments", label: "Assignments", icon: ClipboardList },
            { key: "assessments", label: "Assessments", icon: BarChart2 },
            { key: "ptm",         label: "PTM",         icon: MessageSquare },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === key
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Print-only header ────────────────────────────────────────────────── */}
      <div className="hidden print:block px-6 py-4 border-b">
        <h1 className="text-xl font-bold">{batch.name}</h1>
        <div className="flex gap-6 mt-1 text-sm text-gray-600">
          <span>Academic Year: {batch.academicYear}</span>
          {batch.school    && <span>School: {batch.school.name}</span>}
          {batch.grade     && <span>Grade: {batch.grade.name}</span>}
          {batch.location  && <span>Location: {batch.location.name}</span>}
          {batchStartDate  && <span>Start Date: {batchStartDate}</span>}
        </div>
      </div>

      {/* ── Toolbar (Students tab only) ─────────────────────────────────────── */}
      {activeTab === "students" && <div className="bg-white border-b border-gray-100 px-4 sm:px-6 py-3 print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-0 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search students…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-indigo-500 focus:outline-none"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Status filter */}
          <FSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="ALL">All statuses</option>
            {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </FSelect>

          <div className="flex-1" />

          {/* Export / Print */}
          <button
            onClick={() => exportCSV(students, batch.name)}
            disabled={students.length === 0}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Printer className="h-3.5 w-3.5" /> Print
          </button>

          {canEdit && (
            <button
              onClick={() => setAddOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Add Students
            </button>
          )}
        </div>
      </div>}

      {/* ── Stats toolbar (attendance / assignments / assessments) ────────── */}
      {(activeTab === "attendance" || activeTab === "assignments" || activeTab === "assessments") && (
        <div className="bg-white border-b border-gray-100 px-4 sm:px-6 py-2 print:hidden">
          <div className="flex items-center justify-end">
            <button
              onClick={() => setStatsOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-50 border border-indigo-200 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors"
            >
              <TrendingUp className="h-3.5 w-3.5" /> Stats
            </button>
          </div>
        </div>
      )}

      {/* ── Tab content area ─────────────────────────────────────────────────── */}
      <div className="flex-1 p-4 sm:p-6">

      {/* Students tab */}
      {activeTab === "students" && (<div>
        {studentsLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-14 rounded-xl bg-white animate-pulse" />)}
          </div>
        ) : students.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 py-16 text-center bg-white">
            <Users className="h-10 w-10 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400">
              {search || statusFilter !== "ALL" ? "No students match the current filters." : "No students in this batch yet."}
            </p>
            {canEdit && !search && statusFilter === "ALL" && (
              <button onClick={() => setAddOpen(true)}
                className="mt-3 flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 mx-auto">
                <Plus className="h-3.5 w-3.5" /> Add Students
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-gray-100 overflow-hidden bg-white shadow-sm">
              {/* Desktop table */}
              <table className="w-full text-sm hidden sm:table">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-10">#</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Student</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Phone</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">School / Grade</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    {canEdit && <th className="px-4 py-3 w-24 print:hidden" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {students.map((s: any, idx: number) => (
                    <tr key={s.id}
                      onClick={() => router.push(`/dashboard/academics/students/${s.id}`)}
                      className="hover:bg-indigo-50/40 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3 text-xs text-gray-400 tabular-nums">
                        {(page - 1) * LIMIT + idx + 1}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-semibold text-xs shrink-0">
                            {s.firstName[0]}{s.lastName[0]}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{s.firstName} {s.lastName}</p>
                            <p className="text-xs text-gray-400">{s.studentCode} · {s.admissionNumber ?? "—"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{s.phone ?? "—"}</td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <div className="space-y-0.5">
                          {s.school && <p className="text-xs text-gray-600">{s.school.name}</p>}
                          {s.grade  && <p className="text-xs text-gray-400">{s.grade.name}</p>}
                          {!s.school && !s.grade && <span className="text-gray-300 text-xs">—</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[s.status] ?? "bg-gray-100 text-gray-600"}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[s.status] ?? "bg-gray-400"}`} />
                          {STATUS_LABEL[s.status] ?? s.status}
                        </span>
                      </td>
                      {canEdit && (
                        <td className="px-4 py-3 print:hidden" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1 justify-end">
                            {s.status !== "DROPPED" && (
                              <button
                                onClick={() => setConfirmStudent({ id: s.id, name: `${s.firstName} ${s.lastName}`, action: "drop" })}
                                title="Mark as Dropped"
                                className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-100 transition-colors"
                              >
                                <UserMinus className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {s.status === "DROPPED" && (
                              <button
                                onClick={() => statusMut.mutate({ studentId: s.id, status: "ACTIVE" })}
                                title="Restore to Active"
                                className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:bg-green-50 hover:text-green-600 hover:border-green-100 transition-colors"
                              >
                                <UserCheck className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => setConfirmStudent({ id: s.id, name: `${s.firstName} ${s.lastName}`, action: "remove" })}
                              title="Remove from batch"
                              className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-colors"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Mobile card list */}
              <div className="sm:hidden divide-y divide-gray-50">
                {students.map((s: any, idx: number) => (
                  <div key={s.id}
                    onClick={() => router.push(`/dashboard/academics/students/${s.id}`)}
                    className="px-4 py-3 flex items-start gap-3 hover:bg-indigo-50/40 transition-colors cursor-pointer"
                  >
                    <div className="h-9 w-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-semibold text-xs shrink-0 mt-0.5">
                      {s.firstName[0]}{s.lastName[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{s.firstName} {s.lastName}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{s.studentCode} · {s.phone ?? "—"}</p>
                        </div>
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium shrink-0 ${STATUS_BADGE[s.status] ?? "bg-gray-100 text-gray-600"}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[s.status] ?? "bg-gray-400"}`} />
                          {STATUS_LABEL[s.status] ?? s.status}
                        </span>
                      </div>
                      {(s.school || s.grade) && (
                        <p className="text-xs text-gray-400 mt-1">{[s.school?.name, s.grade?.name].filter(Boolean).join(" · ")}</p>
                      )}
                    </div>
                    {canEdit && (
                      <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        {s.status !== "DROPPED" && (
                          <button onClick={() => setConfirmStudent({ id: s.id, name: `${s.firstName} ${s.lastName}`, action: "drop" })}
                            className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:bg-amber-50 hover:text-amber-600">
                            <UserMinus className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button onClick={() => setConfirmStudent({ id: s.id, name: `${s.firstName} ${s.lastName}`, action: "remove" })}
                          className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:bg-red-50 hover:text-red-600">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 px-1 print:hidden">
                <p className="text-xs text-gray-400">
                  Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, meta.total)} of {meta.total} students
                </p>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-xs text-gray-600 px-2">Page {page} of {totalPages}</span>
                  <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>)}

      {/* ── Attendance tab ───────────────────────────────────────────────────── */}
      {activeTab === "attendance" && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Total Classes" value={attendanceSummary?.totalClasses ?? "—"} loading={attendanceLoading} color="indigo" />
            <StatCard label="With Attendance" value={attendanceSummary?.recordedClasses ?? "—"} loading={attendanceLoading} color="blue" />
            <StatCard label="Avg Attendance" value={attendanceSummary?.avgPct != null ? `${attendanceSummary.avgPct}%` : "—"} loading={attendanceLoading} color="green" />
            <StatCard label="Total Students" value={attendanceSummary?.totalStudents ?? "—"} loading={attendanceLoading} color="purple" />
          </div>

          {/* Date picker */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <p className="font-semibold text-gray-800 text-sm">Class-wise Attendance</p>
              <input type="date" max="2099-12-31" min="1900-01-01" value={attendanceDate} onChange={(e) => setAttendanceDate(e.target.value)}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none" />
            </div>

            {attendanceLoading ? (
              <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 rounded-xl bg-gray-100 animate-pulse" />)}</div>
            ) : attendanceDate && attendanceDateClasses.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No classes scheduled on this date.</p>
            ) : !attendanceDate ? (
              <div className="space-y-2">
                {(attendanceSummary?.classes ?? []).map((c: any) => (
                  <AttendanceClassRow key={c.scheduleId} c={c} />
                ))}
                {(attendanceSummary?.classes ?? []).length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-8">No classes scheduled for this batch yet.</p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {attendanceDateClasses.map((c: any) => <AttendanceClassRow key={c.scheduleId} c={c} />)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Assignments tab ──────────────────────────────────────────────────── */}
      {activeTab === "assignments" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatCard label="Total Assignments" value={assignmentSummary?.totalAssignments ?? "—"} loading={assignmentLoading} color="indigo" />
            <StatCard label="Avg Submission Rate" value={assignmentSummary?.avgSubmissionPct != null ? `${assignmentSummary.avgSubmissionPct}%` : "—"} loading={assignmentLoading} color="green" />
            <StatCard label="Total Students" value={assignmentSummary?.totalStudents ?? "—"} loading={assignmentLoading} color="blue" />
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50">
              <p className="font-semibold text-gray-800 text-sm">Assignment List</p>
            </div>
            {assignmentLoading ? (
              <div className="p-4 space-y-2">{[1,2,3,4].map(i => <div key={i} className="h-12 rounded-xl bg-gray-100 animate-pulse" />)}</div>
            ) : (assignmentSummary?.assignments ?? []).length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-12">No assignments for this batch yet.</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {(assignmentSummary?.assignments ?? []).map((a: any) => (
                  <div key={a.assignmentId} className="px-4 py-3 flex flex-wrap items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{a.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {a.subject ? `${a.subject} · ` : ""}
                        Given: {fmtDate(a.assignmentDate)} · Due: {fmtDate(a.submissionDate)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium border ${
                        a.status === "SUBMITTED" ? "bg-green-50 text-green-700 border-green-100"
                        : a.status === "OVERDUE"  ? "bg-red-50 text-red-600 border-red-100"
                        : "bg-amber-50 text-amber-600 border-amber-100"
                      }`}>{a.status}</span>
                      {a.total > 0 && (
                        <span className="text-xs text-gray-500 tabular-nums">
                          {a.submitted}/{a.total} submitted
                          {a.pct != null && <span className="ml-1 text-indigo-500 font-medium">({a.pct}%)</span>}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Assessments tab ──────────────────────────────────────────────────── */}
      {activeTab === "assessments" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatCard label="Total Exams" value={examSummary?.overall?.totalExams ?? "—"} loading={examLoading} color="indigo" />
            <StatCard label="Avg Score" value={examSummary?.overall?.avgScorePct != null ? `${examSummary.overall.avgScorePct}%` : "—"} loading={examLoading} color="green" />
            <StatCard label="Avg Attendance" value={examSummary?.overall?.avgAttendPct != null ? `${examSummary.overall.avgAttendPct}%` : "—"} loading={examLoading} color="blue" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* Exam list */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50">
                <p className="font-semibold text-gray-800 text-sm">Exams</p>
              </div>
              {examLoading ? (
                <div className="p-4 space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 rounded-xl bg-gray-100 animate-pulse" />)}</div>
              ) : (examSummary?.exams ?? []).length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-12">No assessments for this batch yet.</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {(examSummary?.exams ?? []).map((e: any) => (
                    <button key={e.examId} onClick={() => setSelectedExamId(e.examId === selectedExamId ? null : e.examId)}
                      className={`w-full text-left px-4 py-3 transition-colors ${selectedExamId === e.examId ? "bg-indigo-50" : "hover:bg-gray-50"}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 text-sm truncate">{e.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{fmtDate(e.date)}</p>
                        </div>
                        <div className="text-right shrink-0">
                          {e.avgPct != null && <p className="text-sm font-semibold text-indigo-600">{e.avgPct}%</p>}
                          {e.attendPct != null && <p className="text-xs text-gray-400">{e.attendPct}% attended</p>}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Results panel */}
            <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50">
                <p className="font-semibold text-gray-800 text-sm">
                  {selectedExamId ? `Results — ${(examSummary?.exams ?? []).find((e: any) => e.examId === selectedExamId)?.name ?? ""}` : "Select an exam to view results"}
                </p>
              </div>
              {!selectedExamId ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-300">
                  <BarChart2 className="h-10 w-10 mb-2" />
                  <p className="text-sm">Click an exam on the left</p>
                </div>
              ) : examResultsLoading ? (
                <div className="p-4 space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-10 rounded-xl bg-gray-100 animate-pulse" />)}</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Student</th>
                        <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Attended</th>
                        <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {(examResultsRes?.data ?? []).map((r: any) => {
                        const totalScore = r.result?.marks?.reduce((s: number, m: any) => s + (m.marks ?? 0), 0) ?? null;
                        const exam = (examSummary?.exams ?? []).find((e: any) => e.examId === selectedExamId);
                        const pct = totalScore != null && exam?.totalMarks ? Math.round((totalScore / exam.totalMarks) * 100) : null;
                        return (
                          <tr key={r.student.id} className="hover:bg-indigo-50/30 transition-colors">
                            <td className="px-4 py-2.5">
                              <p className="font-medium text-gray-900">{r.student.firstName} {r.student.lastName}</p>
                              <p className="text-xs text-gray-400">{r.student.studentCode}</p>
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              {r.result ? (
                                r.result.attended
                                  ? <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                                  : <XCircle className="h-4 w-4 text-red-400 mx-auto" />
                              ) : <Clock className="h-4 w-4 text-gray-300 mx-auto" />}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              {totalScore != null ? (
                                <span className="font-semibold text-gray-800">
                                  {totalScore}{exam?.totalMarks ? `/${exam.totalMarks}` : ""}
                                  {pct != null && <span className="ml-1 text-xs text-indigo-500">({pct}%)</span>}
                                </span>
                              ) : <span className="text-gray-300 text-xs">—</span>}
                            </td>
                          </tr>
                        );
                      })}
                      {(examResultsRes?.data ?? []).length === 0 && (
                        <tr><td colSpan={3} className="px-4 py-8 text-center text-sm text-gray-400">No results recorded yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── PTM tab ──────────────────────────────────────────────────────────── */}
      {activeTab === "ptm" && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <MessageSquare className="h-12 w-12 text-gray-200 mb-3" />
          <p className="font-semibold text-gray-600 text-base">PTM Reports</p>
          <p className="text-sm text-gray-400 mt-1 max-w-xs">Parent-Teacher Meeting reports are coming soon. You'll be able to log and review student-wise PTM notes here.</p>
        </div>
      )}

      </div>{/* end tab content area */}

      {/* ── Add Students Modal ───────────────────────────────────────────────── */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 print:hidden">
          <div className="w-full sm:max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <p className="font-semibold text-gray-900">Add Students to Batch</p>
                <p className="text-xs text-gray-400 mt-0.5">{batch.name}</p>
              </div>
              <button onClick={() => { setAddOpen(false); setAddSearch(""); }}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Search */}
            <div className="px-5 py-3 border-b border-gray-50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Search by name or student code…"
                  value={addSearch}
                  onChange={(e) => setAddSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-indigo-500 focus:outline-none"
                />
                {addSearch && (
                  <button onClick={() => setAddSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Results */}
            <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
              {!addResults || addResults.length === 0 ? (
                <p className="px-5 py-8 text-sm text-gray-400 text-center">
                  {addSearch.length > 0 ? "No students found." : "Search for a student above."}
                </p>
              ) : (
                addResults.map((s: any) => {
                  const alreadyInBatch = s.batch?.id === id;
                  return (
                    <div key={s.id} className={`flex items-center gap-3 px-5 py-3 ${alreadyInBatch ? "opacity-40" : "hover:bg-gray-50"}`}>
                      <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-semibold text-xs shrink-0">
                        {s.firstName[0]}{s.lastName[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{s.firstName} {s.lastName}</p>
                        <p className="text-xs text-gray-400">{s.studentCode} {s.batch ? `· Currently in: ${s.batch.name}` : ""}</p>
                      </div>
                      {alreadyInBatch ? (
                        <span className="text-xs text-green-600 font-medium shrink-0">Already enrolled</span>
                      ) : (
                        <button
                          onClick={() => assignMut.mutate(s.id)}
                          disabled={assignMut.isPending}
                          className="flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 shrink-0 transition-colors"
                        >
                          <Plus className="h-3 w-3" /> Add
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="px-5 py-3 border-t border-gray-50">
              <button onClick={() => { setAddOpen(false); setAddSearch(""); }}
                className="w-full rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Batch Stats Panel ────────────────────────────────────────────────── */}
      <BatchStatsPanel batchId={id} open={statsOpen} onClose={() => setStatsOpen(false)} />

      {/* ── Confirm action modal ─────────────────────────────────────────────── */}
      {confirmStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 print:hidden">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 space-y-4">
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center mx-auto ${confirmStudent.action === "remove" ? "bg-red-50" : "bg-amber-50"}`}>
              {confirmStudent.action === "remove"
                ? <X className="h-5 w-5 text-red-500" />
                : <UserMinus className="h-5 w-5 text-amber-500" />
              }
            </div>
            <div className="text-center space-y-1">
              <p className="font-semibold text-gray-900">
                {confirmStudent.action === "remove" ? "Remove from batch?" : "Mark as Dropped?"}
              </p>
              <p className="text-sm text-gray-500">
                {confirmStudent.action === "remove"
                  ? `${confirmStudent.name} will be unassigned from this batch. Their batch history will be preserved.`
                  : `${confirmStudent.name}'s status will be changed to Dropped. They will remain in the batch.`
                }
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setConfirmStudent(null)}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={removeMut.isPending || statusMut.isPending}
                className={`flex-1 rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-60 transition-colors ${
                  confirmStudent.action === "remove" ? "bg-red-500 hover:bg-red-600" : "bg-amber-500 hover:bg-amber-600"
                }`}
              >
                {removeMut.isPending || statusMut.isPending ? "Processing…" : (confirmStudent.action === "remove" ? "Remove" : "Mark Dropped")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab helpers ───────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

const STAT_COLORS: Record<string, string> = {
  indigo: "bg-indigo-50 text-indigo-700",
  green:  "bg-green-50  text-green-700",
  blue:   "bg-blue-50   text-blue-700",
  purple: "bg-purple-50 text-purple-700",
  amber:  "bg-amber-50  text-amber-700",
};

function StatCard({ label, value, loading, color = "indigo" }: { label: string; value: string | number; loading?: boolean; color?: string }) {
  return (
    <div className={`rounded-2xl p-4 border border-gray-100 shadow-sm ${STAT_COLORS[color] ?? STAT_COLORS.indigo}`}>
      {loading ? (
        <div className="h-7 w-16 rounded-lg bg-white/60 animate-pulse mb-1" />
      ) : (
        <p className="text-2xl font-bold tabular-nums">{value}</p>
      )}
      <p className="text-xs font-medium opacity-70 mt-0.5">{label}</p>
    </div>
  );
}

function AttendanceClassRow({ c }: { c: any }) {
  const pct = c.pct;
  const barColor = pct == null ? "bg-gray-200" : pct >= 75 ? "bg-green-400" : pct >= 50 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-3 py-2 px-1">
      <div className="w-20 shrink-0 text-xs text-gray-400 tabular-nums">{fmtDate(c.date)}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-700 font-medium truncate">{c.subject ?? "—"}{c.topic ? ` · ${c.topic}` : ""}</p>
        <div className="mt-1 h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct ?? 0}%` }} />
        </div>
      </div>
      <div className="shrink-0 text-right w-20">
        {c.recorded > 0 ? (
          <span className="text-xs tabular-nums text-gray-600">
            <span className="font-semibold">{c.present}</span>/{c.recorded}
            {pct != null && <span className="ml-1 text-indigo-500">({pct}%)</span>}
          </span>
        ) : (
          <span className="text-xs text-gray-300">Not recorded</span>
        )}
      </div>
    </div>
  );
}

function InfoChip({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-1.5 text-sm">
      {icon}
      <span className="text-gray-400 text-xs">{label}:</span>
      <span className="font-medium text-gray-700 text-xs">{value}</span>
    </div>
  );
}
