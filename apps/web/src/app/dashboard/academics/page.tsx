"use client";

import Link from "next/link";
import {
  Users2, ClipboardList, CalendarDays, School,
  BookOpen, FileCheck2, SlidersHorizontal,
  GraduationCap, TrendingUp, BarChart2, UserCheck,
  UserX, AlertTriangle, Award, UserMinus,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

const SECTIONS = [
  {
    name: "Students",
    desc: "Student profiles, contact info, parent details",
    href: "/dashboard/academics/students",
    icon: Users2,
    color: "bg-blue-50 text-blue-600 border-blue-100",
    iconBg: "bg-blue-100",
  },
  {
    name: "Admission",
    desc: "Manage admissions, documents, and enrolment status",
    href: "/dashboard/academics/admission",
    icon: ClipboardList,
    color: "bg-purple-50 text-purple-600 border-purple-100",
    iconBg: "bg-purple-100",
  },
  {
    name: "Schedule",
    desc: "Lecture timetables and faculty scheduling",
    href: "/dashboard/academics/schedule",
    icon: CalendarDays,
    color: "bg-emerald-50 text-emerald-600 border-emerald-100",
    iconBg: "bg-emerald-100",
  },
  {
    name: "Batches",
    desc: "Manage batches, assign students and subjects",
    href: "/dashboard/academics/batches",
    icon: School,
    color: "bg-amber-50 text-amber-600 border-amber-100",
    iconBg: "bg-amber-100",
  },
  {
    name: "Assignments",
    desc: "Create and track student assignments",
    href: "/dashboard/academics/assignments",
    icon: BookOpen,
    color: "bg-rose-50 text-rose-600 border-rose-100",
    iconBg: "bg-rose-100",
  },
  {
    name: "Assessments",
    desc: "Tests, exams, results and analytics",
    href: "/dashboard/academics/assessments",
    icon: FileCheck2,
    color: "bg-cyan-50 text-cyan-600 border-cyan-100",
    iconBg: "bg-cyan-100",
  },
  {
    name: "Academic Settings",
    desc: "Academic years, target exams, grades, schools, subjects",
    href: "/dashboard/academics/settings",
    icon: SlidersHorizontal,
    color: "bg-slate-50 text-slate-600 border-slate-200",
    iconBg: "bg-slate-100",
  },
];

const STATUS_DOT: Record<string, string> = {
  ACTIVE:    "bg-green-500",
  INACTIVE:  "bg-gray-400",
  SUSPENDED: "bg-red-500",
  GRADUATED: "bg-blue-500",
  DROPPED:   "bg-amber-500",
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Active", INACTIVE: "Inactive", SUSPENDED: "Suspended",
  GRADUATED: "Graduated", DROPPED: "Dropped",
};

function StatTile({
  label, value, sub, icon: Icon, color = "indigo",
}: {
  label: string; value: string | number; sub?: string;
  icon: any; color?: "indigo" | "green" | "amber" | "blue" | "red" | "slate";
}) {
  const schemes: Record<string, { tile: string; icon: string; val: string }> = {
    indigo: { tile: "border-indigo-100 bg-indigo-50", icon: "bg-indigo-100 text-indigo-600", val: "text-indigo-700" },
    green:  { tile: "border-green-100 bg-green-50",   icon: "bg-green-100 text-green-600",   val: "text-green-700"  },
    amber:  { tile: "border-amber-100 bg-amber-50",   icon: "bg-amber-100 text-amber-600",   val: "text-amber-700"  },
    blue:   { tile: "border-blue-100 bg-blue-50",     icon: "bg-blue-100 text-blue-600",     val: "text-blue-700"   },
    red:    { tile: "border-red-100 bg-red-50",       icon: "bg-red-100 text-red-500",       val: "text-red-600"    },
    slate:  { tile: "border-slate-100 bg-slate-50",   icon: "bg-slate-100 text-slate-500",   val: "text-slate-700"  },
  };
  const s = schemes[color];
  return (
    <div className={`rounded-2xl border p-4 flex items-center gap-4 ${s.tile}`}>
      <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${s.icon}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className={`text-2xl font-bold leading-none ${s.val}`}>{value}</p>
        <p className="text-xs font-medium text-gray-500 mt-1">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function AcademicsOverviewPage() {
  const { data: batchesData = [] } = useQuery({
    queryKey: ["batches", false],
    queryFn: () => api.get("/api/v1/academics/batches?archived=false").then((r) => r.data.data),
    staleTime: 5 * 60 * 1000,
  });

  const { data: studentData } = useQuery({
    queryKey: ["students-stats"],
    queryFn: () => api.get("/api/v1/academics/students?limit=1").then((r) => r.data),
    staleTime: 2 * 60 * 1000,
  });

  const batches: any[] = batchesData;
  const stats = studentData?.stats ?? { total: 0, byStatus: {}, batchCount: 0, avgBatchStrength: 0 };

  const activeBatches = batches.filter((b) => b.isActive).length;
  const totalBatches  = batches.length;

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Academics Dashboard</h1>
        <p className="text-sm text-gray-400 mt-1">Manage all academic operations from one place.</p>
      </div>

      {/* ── Statistics ───────────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
          <BarChart2 className="h-3.5 w-3.5" /> Overview Statistics
        </p>

        {/* Primary stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Total Students"   value={stats.total}            icon={Users2}         color="indigo" />
          <StatTile label="Active Students"  value={stats.byStatus.ACTIVE ?? 0} icon={UserCheck}  color="green"  />
          <StatTile label="Active Batches"   value={activeBatches}          icon={GraduationCap}  color="amber"  />
          <StatTile label="Avg. Strength"    value={stats.avgBatchStrength} icon={TrendingUp}     color="blue"
                    sub={stats.batchCount > 0 ? `across ${stats.batchCount} batch${stats.batchCount !== 1 ? "es" : ""}` : undefined} />
        </div>

        {/* Status + Batch breakdown */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Student status breakdown */}
          <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-50 bg-gray-50/60">
              <p className="text-xs font-semibold text-gray-600">Student Status Breakdown</p>
            </div>
            {Object.keys(stats.byStatus).length === 0 ? (
              <p className="px-5 py-6 text-sm text-gray-400 text-center">No students yet</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {Object.entries(stats.byStatus as Record<string, number>)
                  .sort(([, a], [, b]) => b - a)
                  .map(([status, count]) => {
                    const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                    return (
                      <div key={status} className="flex items-center gap-3 px-5 py-3">
                        <span className={`h-2 w-2 rounded-full shrink-0 ${STATUS_DOT[status] ?? "bg-gray-400"}`} />
                        <span className="text-sm text-gray-700 flex-1">{STATUS_LABEL[status] ?? status}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                            <div className="h-full rounded-full bg-indigo-400" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-sm font-semibold text-gray-700 tabular-nums w-6 text-right">{count}</span>
                          <span className="text-xs text-gray-400 tabular-nums w-8 text-right">{pct}%</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* Batch strength breakdown */}
          <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-50 bg-gray-50/60">
              <p className="text-xs font-semibold text-gray-600">Batch Strength</p>
            </div>
            {batches.length === 0 ? (
              <p className="px-5 py-6 text-sm text-gray-400 text-center">No batches yet</p>
            ) : (
              <div className="divide-y divide-gray-50 max-h-48 overflow-y-auto">
                {batches
                  .filter((b) => !b.isArchived)
                  .sort((a, b) => (b._count?.students ?? 0) - (a._count?.students ?? 0))
                  .slice(0, 8)
                  .map((b) => {
                    const max = Math.max(...batches.map((x) => x._count?.students ?? 0), 1);
                    const pct = Math.round(((b._count?.students ?? 0) / max) * 100);
                    return (
                      <div key={b.id} className="flex items-center gap-3 px-5 py-2.5">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-700 truncate">{b.name}</p>
                          <p className="text-xs text-gray-400">{b.academicYear}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                            <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-sm font-semibold text-gray-700 tabular-nums w-6 text-right">
                            {b._count?.students ?? 0}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Section grid ─────────────────────────────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Sections</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {SECTIONS.map(({ name, desc, href, icon: Icon, color, iconBg }) => (
            <Link
              key={href}
              href={href}
              className={`group flex items-start gap-4 rounded-2xl border p-5 bg-white transition-all hover:shadow-md hover:-translate-y-0.5 ${color}`}
            >
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 group-hover:text-current text-sm">{name}</p>
                <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
