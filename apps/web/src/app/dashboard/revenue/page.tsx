"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import Link from "next/link";
import {
  IndianRupee, TrendingUp, TrendingDown, Tag, Users,
  ChevronRight, Search, X, Loader2,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface RevenueSummary {
  studentCount: number;
  totalFee: number;
  totalDiscount: number;
  netReceivable: number;
  totalReceived: number;
  totalDue: number;
}

interface RevenueGroup {
  id?: string;
  label: string;
  studentCount: number;
  totalFee: number;
  totalDiscount: number;
  netReceivable: number;
  totalReceived: number;
  totalDue: number;
}

interface StudentRow {
  id: string;
  studentCode: string;
  name: string;
  school: string;
  academicYear: string;
  admissionDate: string | null;
  batches: { id: string; name: string }[];
  totalFee: number;
  discountAmount: number;
  netReceivable: number;
  paidFee: number;
  balanceDue: number;
}

interface ReportData {
  summary: RevenueSummary;
  byBatch: RevenueGroup[];
  bySchool: RevenueGroup[];
  byAcademicYear: RevenueGroup[];
  students: StudentRow[];
}

interface Meta {
  academicYears: { id: string; name: string; isActive: boolean }[];
  batches: { id: string; name: string; academicYear: string }[];
  schools: { id: string; name: string }[];
}

type GroupDim = "batch" | "school" | "year";

// ── Helpers ───────────────────────────────────────────────────────────────────

function pct(received: number, receivable: number) {
  if (receivable <= 0) return 0;
  return Math.round((received / receivable) * 100);
}

function collectionColor(p: number) {
  if (p >= 80) return "#16a34a";
  if (p >= 50) return "#d97706";
  return "#dc2626";
}

// ── Summary Card ──────────────────────────────────────────────────────────────

function SummaryCard({
  icon: Icon, label, value, sub, accent, iconBg,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub: string;
  accent: string;
  iconBg: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-start gap-4">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
        <Icon className="h-5 w-5" style={{ color: accent }} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-black text-gray-900 leading-tight mt-0.5">{value}</p>
        <p className="text-xs text-gray-400 mt-1">{sub}</p>
      </div>
    </div>
  );
}

// ── Group Table ───────────────────────────────────────────────────────────────

function GroupTable({ rows }: { rows: RevenueGroup[] }) {
  if (rows.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400 text-sm">No data available</div>
    );
  }
  const maxReceivable = Math.max(...rows.map((r) => r.netReceivable), 1);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[700px]">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Name</th>
            <th className="text-right py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Students</th>
            <th className="text-right py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Total Fee</th>
            <th className="text-right py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Discount</th>
            <th className="text-right py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Net Receivable</th>
            <th className="text-right py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Received</th>
            <th className="text-right py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Balance Due</th>
            <th className="text-right py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide w-32">Collection</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map((row) => {
            const p = pct(row.totalReceived, row.netReceivable);
            const color = collectionColor(p);
            const barW = row.netReceivable > 0
              ? Math.round((row.totalReceived / maxReceivable) * 100)
              : 0;
            return (
              <tr key={row.label} className="hover:bg-gray-50 transition-colors">
                <td className="py-3.5 px-4 font-semibold text-gray-800">{row.label}</td>
                <td className="py-3.5 px-4 text-right text-gray-600">{row.studentCount}</td>
                <td className="py-3.5 px-4 text-right text-gray-600">{formatCurrency(row.totalFee)}</td>
                <td className="py-3.5 px-4 text-right text-amber-600">{formatCurrency(row.totalDiscount)}</td>
                <td className="py-3.5 px-4 text-right font-semibold text-gray-800">{formatCurrency(row.netReceivable)}</td>
                <td className="py-3.5 px-4 text-right text-green-700 font-semibold">{formatCurrency(row.totalReceived)}</td>
                <td className="py-3.5 px-4 text-right font-semibold" style={{ color: row.totalDue > 0 ? "#dc2626" : "#16a34a" }}>
                  {formatCurrency(row.totalDue)}
                </td>
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-2 justify-end">
                    <div className="h-1.5 w-20 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${barW}%`, background: color }}
                      />
                    </div>
                    <span className="text-xs font-bold w-9 text-right" style={{ color }}>{p}%</span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Student Table ─────────────────────────────────────────────────────────────

function StudentTable({ students, search }: { students: StudentRow[]; search: string }) {
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.studentCode.toLowerCase().includes(q) ||
        s.school.toLowerCase().includes(q) ||
        s.batches.some((b) => b.name.toLowerCase().includes(q)),
    );
  }, [students, search]);

  if (filtered.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400 text-sm">
        {search ? "No students match your search" : "No students found"}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[900px]">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Student</th>
            <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden md:table-cell">School</th>
            <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden lg:table-cell">Batch(es)</th>
            <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden lg:table-cell">Year</th>
            <th className="text-right py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Total Fee</th>
            <th className="text-right py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden md:table-cell">Discount</th>
            <th className="text-right py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Net Receivable</th>
            <th className="text-right py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Received</th>
            <th className="text-right py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Balance Due</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {filtered.map((st) => (
            <tr key={st.id} className="hover:bg-gray-50 transition-colors group">
              <td className="py-3 px-4">
                <Link
                  href={`/dashboard/academics/students/${st.id}`}
                  className="flex items-center gap-2 group-hover:text-blue-600 transition-colors"
                >
                  <div>
                    <p className="font-semibold text-gray-800 group-hover:text-blue-700">{st.name}</p>
                    <p className="text-xs text-gray-400">{st.studentCode}</p>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-blue-400 shrink-0 ml-auto" />
                </Link>
              </td>
              <td className="py-3 px-4 text-gray-600 hidden md:table-cell">{st.school}</td>
              <td className="py-3 px-4 hidden lg:table-cell">
                {st.batches.length === 0 ? (
                  <span className="text-gray-300 text-xs">—</span>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {st.batches.map((b) => (
                      <span key={b.id} className="text-xs bg-blue-50 text-blue-700 rounded-full px-2 py-0.5 font-medium">
                        {b.name}
                      </span>
                    ))}
                  </div>
                )}
              </td>
              <td className="py-3 px-4 text-gray-500 text-xs hidden lg:table-cell">{st.academicYear}</td>
              <td className="py-3 px-4 text-right text-gray-600">{formatCurrency(st.totalFee)}</td>
              <td className="py-3 px-4 text-right text-amber-600 hidden md:table-cell">{formatCurrency(st.discountAmount)}</td>
              <td className="py-3 px-4 text-right font-semibold text-gray-800">{formatCurrency(st.netReceivable)}</td>
              <td className="py-3 px-4 text-right text-green-700 font-semibold">{formatCurrency(st.paidFee)}</td>
              <td className="py-3 px-4 text-right font-semibold" style={{ color: st.balanceDue > 0 ? "#dc2626" : "#16a34a" }}>
                {formatCurrency(st.balanceDue)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function RevenuePage() {
  const { user } = useAuthStore();
  const role = user?.role ?? "";

  // Filters
  const [academicYear, setAcademicYear] = useState("");
  const [batchId, setBatchId]           = useState("");
  const [schoolId, setSchoolId]         = useState("");
  const [dateFrom, setDateFrom]         = useState("");
  const [dateTo, setDateTo]             = useState("");
  const [groupDim, setGroupDim]         = useState<GroupDim>("batch");
  const [studentSearch, setStudentSearch] = useState("");
  const [showStudents, setShowStudents] = useState(false);

  // Guard: only SUPER_ADMIN
  if (!["SUPER_ADMIN", "HR_ADMIN"].includes(role)) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-400 text-sm">
        You do not have permission to view this page.
      </div>
    );
  }

  // Filter metadata
  const { data: meta } = useQuery<Meta>({
    queryKey: ["revenue-meta"],
    queryFn: () => api.get("/api/v1/revenue/meta").then((r) => r.data.data),
    staleTime: 5 * 60 * 1000,
  });

  // Report data
  const reportParams = useMemo(() => {
    const p: Record<string, string> = {};
    if (academicYear) p.academicYear = academicYear;
    if (batchId)      p.batchId      = batchId;
    if (schoolId)     p.schoolId     = schoolId;
    if (dateFrom)     p.dateFrom     = dateFrom;
    if (dateTo)       p.dateTo       = dateTo;
    return p;
  }, [academicYear, batchId, schoolId, dateFrom, dateTo]);

  const { data: report, isLoading } = useQuery<ReportData>({
    queryKey: ["revenue-report", reportParams],
    queryFn: () => {
      const qs = new URLSearchParams(reportParams).toString();
      return api.get(`/api/v1/revenue/report${qs ? `?${qs}` : ""}`).then((r) => r.data.data);
    },
    staleTime: 2 * 60 * 1000,
  });

  const summary = report?.summary;

  const groupRows: RevenueGroup[] =
    groupDim === "batch"  ? (report?.byBatch        ?? []) :
    groupDim === "school" ? (report?.bySchool        ?? []) :
                            (report?.byAcademicYear  ?? []);

  function clearFilters() {
    setAcademicYear("");
    setBatchId("");
    setSchoolId("");
    setDateFrom("");
    setDateTo("");
  }

  const hasFilters = !!(academicYear || batchId || schoolId || dateFrom || dateTo);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Revenue Report</h1>
          <p className="text-sm text-gray-400 mt-0.5">Fee receivable, collected, outstanding and discounts</p>
        </div>
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        )}
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-wrap gap-3 items-end">
          {/* Academic Year */}
          <div className="flex flex-col gap-1 min-w-[140px]">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Academic Year</label>
            <select
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Years</option>
              {meta?.academicYears.map((y) => (
                <option key={y.id} value={y.name}>{y.name}</option>
              ))}
            </select>
          </div>

          {/* Batch */}
          <div className="flex flex-col gap-1 min-w-[160px]">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Batch</label>
            <select
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Batches</option>
              {meta?.batches.map((b) => (
                <option key={b.id} value={b.id}>{b.name} ({b.academicYear})</option>
              ))}
            </select>
          </div>

          {/* School */}
          <div className="flex flex-col gap-1 min-w-[160px]">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">School</label>
            <select
              value={schoolId}
              onChange={(e) => setSchoolId(e.target.value)}
              className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Schools</option>
              {meta?.schools.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Date From */}
          <div className="flex flex-col gap-1 min-w-[140px]">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Admission From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Date To */}
          <div className="flex flex-col gap-1 min-w-[140px]">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Admission To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors self-end"
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          icon={IndianRupee}
          label="Fee Receivable"
          value={formatCurrency(summary?.netReceivable ?? 0)}
          sub={`${summary?.studentCount ?? 0} students · Gross ${formatCurrency(summary?.totalFee ?? 0)}`}
          accent="#2563eb"
          iconBg="bg-blue-50"
        />
        <SummaryCard
          icon={TrendingUp}
          label="Fee Received"
          value={formatCurrency(summary?.totalReceived ?? 0)}
          sub={`${pct(summary?.totalReceived ?? 0, summary?.netReceivable ?? 0)}% collection rate`}
          accent="#16a34a"
          iconBg="bg-green-50"
        />
        <SummaryCard
          icon={TrendingDown}
          label="Fee Due"
          value={formatCurrency(summary?.totalDue ?? 0)}
          sub="Outstanding balance"
          accent="#dc2626"
          iconBg="bg-red-50"
        />
        <SummaryCard
          icon={Tag}
          label="Discount Given"
          value={formatCurrency(summary?.totalDiscount ?? 0)}
          sub="Total waivers applied"
          accent="#d97706"
          iconBg="bg-amber-50"
        />
      </div>

      {/* Grouped Breakdown */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-black text-gray-900">Breakdown</h2>
          <div className="flex gap-1.5">
            {(["batch", "school", "year"] as GroupDim[]).map((dim) => {
              const labels: Record<GroupDim, string> = { batch: "By Batch", school: "By School", year: "By Year" };
              return (
                <button
                  key={dim}
                  onClick={() => setGroupDim(dim)}
                  className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${
                    groupDim === dim
                      ? "bg-[#1e3464] text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {labels[dim]}
                </button>
              );
            })}
          </div>
        </div>
        <GroupTable rows={groupRows} />
      </div>

      {/* Student Detail Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <h2 className="font-black text-gray-900">Student Details</h2>
            {report && (
              <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2.5 py-1 font-bold">
                {report.students.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                value={studentSearch}
                onChange={(e) => { setStudentSearch(e.target.value); setShowStudents(true); }}
                placeholder="Search students…"
                className="pl-8 pr-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
              />
            </div>
            <button
              onClick={() => setShowStudents((v) => !v)}
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              {showStudents ? "Hide" : "Show"}
            </button>
          </div>
        </div>
        {showStudents && (
          <StudentTable students={report?.students ?? []} search={studentSearch} />
        )}
        {!showStudents && (
          <div className="flex items-center justify-center py-10 gap-2 text-gray-400 text-sm">
            <Users className="h-4 w-4" />
            Click "Show" to view individual student records
          </div>
        )}
      </div>
    </div>
  );
}
