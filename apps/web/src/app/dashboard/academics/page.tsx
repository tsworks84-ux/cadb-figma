"use client";

import { useState, useEffect, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { usePermissionsState } from "@/hooks/usePermissions";
import { ACADEMICS_TABS, canViewAcademicsTab, isAcademicsAdmin } from "@/lib/academicsAccess";
import Link from "next/link";
import {
  BarChart2, X, ChevronRight, Clock, MapPin, BookOpen,
  UserCheck, CalendarDays, Plus,
} from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────

const ACCENT = {
  blue:   "#2563eb",
  green:  "#16a34a",
  amber:  "#d97706",
  indigo: "#4338ca",
  cyan:   "#0891b2",
} as const;

const BREAKDOWN_DIMS = [
  { key: "byCity",   label: "City" },
  { key: "byCourse", label: "Program" },
  { key: "bySchool", label: "School" },
  { key: "byGrade",  label: "Grade" },
  { key: "byBatch",  label: "Batch" },
  { key: "byYear",   label: "Year" },
] as const;
type DimKey = typeof BREAKDOWN_DIMS[number]["key"];

// ── Bold Metric Card ──────────────────────────────────────────────────────────

function BoldCard({
  accent, iconLabel, trend, trendUp, label, value, note, chip, href, onClick,
}: {
  accent: string; iconLabel: string; trend?: string; trendUp?: boolean;
  label: string; value: string; note: string; chip: string;
  href?: string; onClick?: () => void;
}) {
  const inner = (
    <div
      className="relative min-h-[210px] bg-white border border-gray-200 rounded-2xl p-5 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow overflow-hidden group"
    >
      <div className="absolute inset-x-0 top-0 h-[5px] rounded-t-2xl" style={{ background: accent }} />

      <div className="flex items-start justify-between pt-1">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-sm font-black"
          style={{ background: `${accent}22`, color: accent }}
        >
          {iconLabel}
        </div>
        {trend && (
          <span className="text-xs font-extrabold" style={{ color: trendUp ? "#16a34a" : "#dc2626" }}>
            {trendUp ? "↗" : "↘"} {trend}
          </span>
        )}
      </div>

      <div className="mt-4">
        <div className="text-sm font-extrabold text-slate-500 leading-tight">{label}</div>
        <div className="text-4xl font-black text-gray-900 leading-none mt-1.5 tracking-tight">{value}</div>
        <div className="text-xs font-bold text-slate-400 mt-2 leading-snug">{note}</div>
      </div>

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
        <span className="text-xs font-extrabold group-hover:underline" style={{ color: accent }}>
          View Details
        </span>
        <span className="text-xs text-slate-400 bg-slate-100 rounded-full px-2.5 py-1 font-bold">{chip}</span>
      </div>
    </div>
  );

  if (href) return <Link href={href} className="block">{inner}</Link>;
  return <button className="w-full text-left" onClick={onClick}>{inner}</button>;
}

// ── Student Stats Modal ───────────────────────────────────────────────────────

function StudentStatsModal({ data, onClose }: { data: any; onClose: () => void }) {
  const [dim, setDim] = useState<DimKey>("byGrade");
  const items: { label: string; count: number }[] = (data?.students?.[dim] ?? []).slice(0, 10);
  const maxCount = Math.max(...items.map((i: any) => i.count), 1);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[85vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-black text-gray-900">Student Breakdown</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {data?.students?.total ?? 0} total · {data?.students?.active ?? 0} active
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex gap-1.5 flex-wrap px-6 py-3 border-b border-gray-100">
          {BREAKDOWN_DIMS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setDim(key)}
              className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${dim === key ? "text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              style={dim === key ? { backgroundColor: ACCENT.blue } : {}}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-3">
          {items.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No data available</p>
          ) : items.map((item: any) => (
            <div key={item.label} className="flex items-center gap-3">
              <span className="text-sm font-bold text-gray-700 w-32 truncate shrink-0">{item.label}</span>
              <div className="flex-1 h-3 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.round((item.count / maxCount) * 100)}%`,
                    background: "linear-gradient(90deg, #2563eb, #22c55e)",
                  }}
                />
              </div>
              <span className="text-sm font-extrabold text-gray-800 w-10 text-right shrink-0">{item.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Revenue Modal ─────────────────────────────────────────────────────────────

function RevenueModal({ revenue, onClose }: { revenue: any; onClose: () => void }) {
  const [dim, setDim] = useState<DimKey>("bySchool");
  const items: { label: string; total: number; collected: number }[] = (revenue?.[dim] ?? []).slice(0, 10);
  const maxTotal = Math.max(...items.map((i: any) => i.total), 1);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-black text-gray-900">Revenue Snapshot</h2>
            <p className="text-xs text-gray-400 mt-0.5">Fee collection overview</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-4 px-6 py-4 bg-gray-50 border-b border-gray-100">
          <div>
            <p className="text-xs text-gray-400">Total Revenue</p>
            <p className="text-lg font-black text-gray-900 mt-0.5">{formatCurrency(revenue?.total ?? 0)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Collected</p>
            <p className="text-lg font-black text-green-700 mt-0.5">{formatCurrency(revenue?.collected ?? 0)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Outstanding</p>
            <p className="text-lg font-black text-red-600 mt-0.5">{formatCurrency(revenue?.due ?? 0)}</p>
          </div>
        </div>
        <div className="flex gap-1.5 flex-wrap px-6 py-3 border-b border-gray-100">
          {BREAKDOWN_DIMS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setDim(key)}
              className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${dim === key ? "text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              style={dim === key ? { backgroundColor: ACCENT.blue } : {}}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-3 space-y-3">
          {items.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No revenue data available</p>
          ) : items.map((item: any) => {
            const pct = item.total > 0 ? Math.round((item.collected / item.total) * 100) : 0;
            const barColor = pct >= 80 ? "#16a34a" : pct >= 50 ? "#d97706" : "#dc2626";
            return (
              <div key={item.label} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-bold text-gray-800">{item.label}</span>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-green-700 font-bold">{formatCurrency(item.collected)}</span>
                    <span className="text-gray-400">/ {formatCurrency(item.total)}</span>
                    <span className="font-extrabold w-9 text-right" style={{ color: barColor }}>{pct}%</span>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.round((item.collected / maxTotal) * 100)}%`,
                      background: barColor,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Schedule Modal ────────────────────────────────────────────────────────────

function ScheduleModal({ schedules, onClose }: { schedules: any[]; onClose: () => void }) {
  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-black text-gray-900">Today's Schedule</h2>
            <p className="text-xs text-gray-400 mt-0.5">{today}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1">
          {schedules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <CalendarDays className="h-10 w-10 mb-3 text-gray-200" />
              <p className="text-sm">No classes scheduled for today</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {schedules.map((s: any) => (
                <li key={s.id} className="px-6 py-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                      <BookOpen className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-gray-900">
                          {s.subject?.name ?? "Class"}
                          {s.subject?.code && (
                            <span className="ml-1 text-xs text-gray-400 font-mono">({s.subject.code})</span>
                          )}
                        </p>
                        {s.batches?.length > 0 && (
                          <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-bold">
                            {s.batches.map((b: any) => b.batch.name).join(", ")}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {s.startTime} – {s.endTime}
                        </span>
                        {s.employee && (
                          <span className="flex items-center gap-1">
                            <UserCheck className="h-3 w-3" /> {s.employee.firstName} {s.employee.lastName}
                          </span>
                        )}
                        {s.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {s.location.name}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${
                      s.status === "COMPLETED" ? "bg-green-100 text-green-700" :
                      s.status === "CANCELLED" ? "bg-red-100 text-red-700" :
                      "bg-blue-100 text-blue-700"
                    }`}>
                      {s.status ?? "SCHEDULED"}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

function AcademicsOverviewPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const teacherId    = searchParams.get("teacherId");
  const { user }     = useAuthStore();
  const { permissions, ready } = usePermissionsState();

  // The overview aggregates org-wide figures, so it stays an admin (or explicitly
  // teacher-scoped) view. Anyone else lands on the first tab they're granted.
  const firstAllowedTab = ACADEMICS_TABS.find(
    (t) => t.module && canViewAcademicsTab(user?.role, permissions, t.module),
  );

  useEffect(() => {
    if (!ready || teacherId || isAcademicsAdmin(user?.role)) return;
    if (firstAllowedTab) router.replace(firstAllowedTab.href);
  }, [ready, teacherId, user?.role, firstAllowedTab, router]);

  const [revenueOpen,      setRevenueOpen]      = useState(false);
  const [scheduleOpen,     setScheduleOpen]     = useState(false);
  const [studentStatsOpen, setStudentStatsOpen] = useState(false);

  const overviewUrl = teacherId
    ? `/api/v1/academics/overview?teacherId=${teacherId}`
    : "/api/v1/academics/overview";

  const { data: overview, isLoading } = useQuery({
    queryKey: ["academics-overview", teacherId ?? "all"],
    queryFn: () => api.get(overviewUrl).then((r) => r.data.data),
    staleTime: 2 * 60 * 1000,
  });

  const students   = overview?.students        ?? {};
  const batches    = overview?.batches         ?? {};
  const revenue    = overview?.revenue         ?? {};
  const todayCount = overview?.todaySchedules?.count ?? 0;
  const todayList  = overview?.todaySchedules?.list  ?? [];

  const topGrade  = [...(students.byGrade  ?? [])].sort((a: any, b: any) => b.count - a.count)[0];
  const topSchool = [...(students.bySchool ?? [])].sort((a: any, b: any) => b.count - a.count)[0];
  const programList = (students.byCourse ?? []).slice(0, 5);
  const maxProgramCount = Math.max(...programList.map((p: any) => p.count), 1);
  const currentYear = [...(students.byYear ?? [])].sort((a: any, b: any) => b.count - a.count)[0]?.label ?? "—";

  if (isLoading) {
    return (
      <div className="px-4 sm:px-8 py-6 space-y-6 animate-pulse">
        <div className="rounded-2xl bg-slate-800 h-56" />
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => <div key={i} className="h-52 bg-gray-100 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="h-56 bg-gray-100 rounded-2xl" />
          <div className="h-56 bg-gray-100 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-8 py-6 space-y-6">

      {/* ── Hero Banner ────────────────────────────────────────────────────── */}
      <section
        className="rounded-2xl overflow-hidden relative"
        style={{
          background: "linear-gradient(135deg, rgba(15,23,42,.96), rgba(30,64,175,.94)), radial-gradient(circle at 80% 10%, rgba(34,197,94,.35), transparent 30%)",
          boxShadow: "0 22px 55px rgba(15,23,42,.22)",
        }}
      >
        <div className="absolute w-80 h-80 rounded-full pointer-events-none" style={{ right: "-6rem", top: "-9rem", background: "rgba(255,255,255,.06)" }} />

        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_.8fr] gap-6 p-7">
          {/* Left */}
          <div>
            <div className="inline-flex items-center gap-2 h-7 rounded-full bg-white/10 px-3 text-blue-100 text-xs font-black uppercase tracking-widest">
              <BarChart2 className="h-3.5 w-3.5" />
              Student Analytics
            </div>
            <h1 className="mt-4 text-3xl sm:text-[42px] font-black text-white leading-tight tracking-tight">
              Academics dashboard built<br className="hidden sm:block" /> for faster decisions.
            </h1>
            <p className="mt-3 text-slate-300 text-sm sm:text-base leading-relaxed font-semibold max-w-xl">
              Monitor student strength, program mix, grade distribution, school contribution, and batch size from one bold, scan-friendly command center.
            </p>
            <div className="flex flex-wrap gap-2.5 mt-5">
              <Link
                href="/dashboard/academics/students/new"
                className="inline-flex items-center gap-2 h-10 rounded-xl px-4 text-sm font-black bg-green-500 text-white hover:bg-green-400 transition-colors"
              >
                <Plus className="h-4 w-4" /> Add Student
              </Link>
              <Link
                href="/dashboard/academics/reports"
                className="inline-flex items-center gap-2 h-10 rounded-xl px-4 text-sm font-black bg-white/10 text-white hover:bg-white/20 border border-white/20 transition-colors"
              >
                View Reports
              </Link>
            </div>
          </div>

          {/* Right: glassmorphism stats panel */}
          <div
            className="rounded-2xl p-5 flex flex-col gap-0 justify-between"
            style={{ background: "rgba(255,255,255,.10)", border: "1px solid rgba(255,255,255,.14)", backdropFilter: "blur(12px)" }}
          >
            <div className="flex justify-between items-center pb-4 border-b border-white/10">
              <span className="text-slate-300 text-sm font-bold">Current Session</span>
              <strong className="text-white text-2xl font-black">{currentYear}</strong>
            </div>
            <button
              className="flex justify-between items-center py-4 border-b border-white/10 text-left w-full hover:opacity-80 transition-opacity group"
              onClick={() => setScheduleOpen(true)}
            >
              <span className="text-slate-300 text-sm font-bold">Today's Lectures</span>
              <strong className="text-white text-2xl font-black group-hover:underline">{todayCount}</strong>
            </button>
            <button
              className="flex justify-between items-center pt-4 text-left w-full hover:opacity-80 transition-opacity group"
              onClick={() => setRevenueOpen(true)}
            >
              <span className="text-slate-300 text-sm font-bold">Revenue Collected</span>
              <strong className="text-white text-2xl font-black group-hover:underline">{formatCurrency(revenue.collected ?? 0)}</strong>
            </button>
          </div>
        </div>
      </section>

      {/* ── Section Heading ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-[22px] font-black text-gray-900 m-0">Student Overview</h2>
          <p className="text-sm font-semibold text-gray-500 mt-1">
            Each card shows one primary value. Click into details for school, batch, city, grade, and course breakdowns.
          </p>
        </div>
        <Link
          href="/dashboard/academics/students"
          className="inline-flex items-center gap-1.5 border border-gray-200 bg-white rounded-xl px-4 h-10 text-sm font-extrabold text-gray-600 hover:bg-gray-50 whitespace-nowrap shrink-0"
        >
          View Details <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      {/* ── 5 Bold Metric Cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
        <BoldCard
          accent={ACCENT.blue}
          iconLabel="TS"
          label="Total Number of Students"
          value={students.total !== undefined ? students.total.toLocaleString() : "—"}
          note="Across all centres and active courses"
          chip="All students"
          onClick={() => setStudentStatsOpen(true)}
        />
        <BoldCard
          accent={ACCENT.green}
          iconLabel="AC"
          trendUp
          label="Active Students"
          value={students.active !== undefined ? students.active.toLocaleString() : "—"}
          note={`${students.total > 0 ? Math.round(((students.active ?? 0) / students.total) * 100) : 0}% of total enrolment`}
          chip="Active"
          onClick={() => setStudentStatsOpen(true)}
        />
        <BoldCard
          accent={ACCENT.amber}
          iconLabel="GR"
          trendUp
          trend={topGrade?.label}
          label="Students — Top Grade"
          value={topGrade ? topGrade.count.toLocaleString() : "—"}
          note={topGrade ? `Highest strength: ${topGrade.label}` : "No grade data yet"}
          chip="Grade"
          onClick={() => setStudentStatsOpen(true)}
        />
        <BoldCard
          accent={ACCENT.indigo}
          iconLabel="SC"
          label="Students — Top School"
          value={topSchool ? topSchool.count.toLocaleString() : "—"}
          note={topSchool ? `Largest school: ${topSchool.label}` : "No school data yet"}
          chip="School"
          onClick={() => setStudentStatsOpen(true)}
        />
        <BoldCard
          accent={ACCENT.cyan}
          iconLabel="BS"
          label="Average Batch Size"
          value={batches.avgStrength !== undefined ? String(batches.avgStrength) : "—"}
          note={`Across ${batches.active ?? 0} active batch${(batches.active ?? 0) !== 1 ? "es" : ""}`}
          chip="Capacity"
          href="/dashboard/academics/batches"
        />
      </div>

      {/* ── Program Mix + Quick Actions ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_.85fr] gap-[18px]">

        {/* Program Mix bar chart */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden" style={{ boxShadow: "0 10px 28px rgba(20,23,53,.06)" }}>
          <div className="flex items-center justify-between px-5 py-[18px] border-b border-gray-100">
            <div>
              <h3 className="text-[18px] font-black text-gray-900 m-0">Program Mix Snapshot</h3>
              <p className="text-xs font-semibold text-gray-400 mt-0.5">
                Preview of student strength by program / course.
              </p>
            </div>
            <Link
              href="/dashboard/academics/students"
              className="inline-flex items-center gap-1 border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-extrabold text-gray-500 hover:bg-gray-50 whitespace-nowrap bg-white"
            >
              View Details <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="px-5 py-[18px] space-y-4">
            {programList.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No program data available</p>
            ) : programList.map((p: any) => (
              <div
                key={p.label}
                className="grid items-center gap-3"
                style={{ gridTemplateColumns: "170px minmax(0,1fr) 54px" }}
              >
                <span className="text-sm font-extrabold text-gray-700 truncate">{p.label}</span>
                <div className="h-3 rounded-full overflow-hidden" style={{ background: "#eef2f7" }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.round((p.count / maxProgramCount) * 100)}%`,
                      background: "linear-gradient(90deg, #2563eb, #22c55e)",
                    }}
                  />
                </div>
                <span className="text-sm font-extrabold text-gray-500 text-right tabular-nums">{p.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden" style={{ boxShadow: "0 10px 28px rgba(20,23,53,.06)" }}>
          <div className="px-5 py-[18px] border-b border-gray-100">
            <h3 className="text-[18px] font-black text-gray-900 m-0">Quick Actions</h3>
            <p className="text-xs font-semibold text-gray-400 mt-0.5">Fast paths for academic teams.</p>
          </div>
          <div className="divide-y" style={{ borderColor: "#eef2f7" }}>
            {([
              { label: "Add New Student",       sub: "Create profile and admission record",  href: "/dashboard/academics/students/new" },
              { label: "Assign to Batch",        sub: "Move students into active batches",    href: "/dashboard/academics/batches" },
              { label: "Open School Report",     sub: "Compare school-wise contribution",     href: "/dashboard/academics/reports" },
              { label: "Download MIS",           sub: "Export student strength and batch data", href: "/dashboard/academics/reports" },
            ] as const).map(({ label, sub, href }) => (
              <Link
                key={label}
                href={href}
                className="flex justify-between items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors group"
              >
                <div>
                  <span className="block text-[15px] font-extrabold text-gray-800">{label}</span>
                  <span className="block text-xs font-semibold text-gray-400 mt-0.5">{sub}</span>
                </div>
                <div className="w-[34px] h-[34px] rounded-[10px] bg-slate-100 group-hover:bg-slate-200 flex items-center justify-center shrink-0 transition-colors text-slate-500 font-black text-base">
                  ›
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Modals */}
      {studentStatsOpen && (
        <StudentStatsModal data={overview} onClose={() => setStudentStatsOpen(false)} />
      )}
      {revenueOpen && (
        <RevenueModal revenue={revenue} onClose={() => setRevenueOpen(false)} />
      )}
      {scheduleOpen && (
        <ScheduleModal schedules={todayList} onClose={() => setScheduleOpen(false)} />
      )}
    </div>
  );
}

export default function AcademicsOverviewPageWrapped() {
  return <Suspense fallback={null}><AcademicsOverviewPage /></Suspense>;
}
