"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  Plus, X, Calendar, User, ChevronDown, ChevronRight,
  Download, Loader2, Pencil, Trash2, CalendarDays,
  BarChart2, AlertTriangle, CheckCircle2, XCircle,
  Search, SlidersHorizontal, ClipboardList, BookOpen,
  Users, Percent, UserCheck, UserX, Check, ExternalLink, Repeat,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { usePermissions } from "@/hooks/usePermissions";
import { hasAcademicsAction } from "@/lib/academicsAccess";
import { useRouter, useSearchParams } from "next/navigation";
import { format, parseISO, startOfWeek, endOfWeek } from "date-fns";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ComposedChart, Area, PieChart, Pie, Cell,
} from "recharts";

// ── Design tokens ─────────────────────────────────────────────────────────────

const D = {
  line:  "#e6e8ef",
  muted: "#7c8598",
  ink:   "#111827",
  nav2:  "#28245f",
  bg:    "#f4f6fa",
  accent: "#eef2ff",
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
    UPCOMING:  "bg-blue-50 text-blue-700 border border-blue-200",
    COMPLETED: "bg-green-50 text-green-700 border border-green-200",
    CONCLUDED: "bg-purple-50 text-purple-700 border border-purple-200",
    CANCELLED: "bg-red-50 text-red-700 border border-red-200",
  };
  const label: Record<string, string> = {
    UPCOMING: "Upcoming", COMPLETED: "Completed", CONCLUDED: "Concluded", CANCELLED: "Cancelled",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${map[status] ?? "bg-gray-100 text-gray-600"}`}>
      {label[status] ?? status}
    </span>
  );
}

// ── Time helpers ──────────────────────────────────────────────────────────────

function fmtTime(iso: string) {
  try { return format(parseISO(iso), "h:mm a"); } catch { return iso; }
}
function fmtDateHeading(dateKey: string) {
  try { return format(new Date(dateKey + "T00:00:00"), "EEEE, dd MMM yyyy"); } catch { return dateKey; }
}
function groupKey(iso: string) {
  try { return format(parseISO(iso), "yyyy-MM-dd"); } catch { return iso; }
}
function calcDuration(start: string, end: string) {
  try {
    const diff = (new Date(end).getTime() - new Date(start).getTime()) / 60000;
    if (diff <= 0) return "";
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ""}` : `${m}m`;
  } catch { return ""; }
}
function lectureDurationHours(s: any) {
  try {
    return (new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / 3600000;
  } catch { return 0; }
}
function todayStr() {
  return new Date().toISOString().split("T")[0];
}

// ── Attendance % helper ────────────────────────────────────────────────────────

function AttendancePct({ attendances }: { attendances: { isPresent: boolean }[] }) {
  if (!attendances || attendances.length === 0) {
    return <span className="text-xs text-gray-300">—</span>;
  }
  const present = attendances.filter((a) => a.isPresent).length;
  const total   = attendances.length;
  const pct     = Math.round((present / total) * 100);
  const color   = pct >= 75 ? "#16a34a" : pct >= 50 ? "#d97706" : "#dc2626";
  return (
    <span style={{
      fontSize: 12, fontWeight: 700, color,
      background: pct >= 75 ? "#dcfce7" : pct >= 50 ? "#fef3c7" : "#fee2e2",
      borderRadius: 999, padding: "2px 8px",
    }}>
      {pct}%
    </span>
  );
}

// ── Assignment column badge ────────────────────────────────────────────────────
// assignments: API now returns { id, name, submissions: [{ status }] }[]

function AssignmentBadge({ assignments }: { assignments: { id: string; submissions: { status: string }[] }[] }) {
  if (!assignments || assignments.length === 0) {
    // No assignment linked
    return (
      <span style={{ display: "inline-flex", alignItems: "center", color: "#d1d5db" }}>
        <X style={{ width: 14, height: 14 }} />
      </span>
    );
  }
  // Aggregate across all linked assignments (usually 1)
  let totalSubs = 0, submittedSubs = 0;
  for (const a of assignments) {
    for (const s of a.submissions) {
      totalSubs++;
      if (s.status !== "NOT_SUBMITTED") submittedSubs++;
    }
  }
  if (submittedSubs === 0) {
    // Assignment exists but no submissions yet
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 20, height: 20, borderRadius: "50%",
        background: "#dcfce7", color: "#16a34a",
      }}>
        <Check style={{ width: 12, height: 12, strokeWidth: 3 }} />
      </span>
    );
  }
  // Has submissions — show %
  const pct = Math.round((submittedSubs / totalSubs) * 100);
  return (
    <span style={{
      fontSize: 11, fontWeight: 800,
      color: pct >= 75 ? "#16a34a" : pct >= 50 ? "#d97706" : "#dc2626",
      background: pct >= 75 ? "#dcfce7" : pct >= 50 ? "#fef3c7" : "#fee2e2",
      borderRadius: 999, padding: "2px 8px",
    }}>
      {pct}%
    </span>
  );
}

// ── BatchMultiSelect ──────────────────────────────────────────────────────────

function BatchMultiSelect({
  batches, selected, onChange,
}: { batches: any[]; selected: string[]; onChange: (ids: string[]) => void }) {
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

  const toggle = (id: string) => {
    if (selected.includes(id)) onChange(selected.filter((x) => x !== id));
    else onChange([...selected, id]);
  };

  const selectedNames = batches.filter((b) => selected.includes(b.id)).map((b) => b.name).join(", ");

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          ...inputBase,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          cursor: "pointer", textAlign: "left",
        }}
      >
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {selected.length === 0
            ? <span style={{ color: D.muted }}>Select batches…</span>
            : selectedNames}
        </span>
        <ChevronDown
          style={{
            width: 16, height: 16, color: D.muted, flexShrink: 0, marginLeft: 4,
            transform: open ? "rotate(180deg)" : "none", transition: "transform .15s",
          }}
        />
      </button>
      {open && (
        <div
          className="absolute z-50 mt-1 w-full rounded-xl bg-white shadow-lg border"
          style={{ borderColor: D.line }}
        >
          <div className="max-h-48 overflow-y-auto">
            {batches.length === 0 && (
              <p className="px-3 py-2 text-xs" style={{ color: D.muted }}>
                No batches available for this year
              </p>
            )}
            {batches.map((b) => (
              <label key={b.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.includes(b.id)}
                  onChange={() => toggle(b.id)}
                  className="accent-indigo-600"
                />
                <span className="text-sm" style={{ color: D.ink }}>{b.name}</span>
                {b.grade && (
                  <span className="text-xs ml-auto shrink-0" style={{ color: D.muted }}>{b.grade.name}</span>
                )}
              </label>
            ))}
          </div>
          <div className="border-t px-3 py-2 flex items-center justify-between" style={{ borderColor: D.line }}>
            <span className="text-xs" style={{ color: D.muted }}>{selected.length} selected</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-800 px-2 py-0.5 rounded hover:bg-indigo-50 transition-colors"
            >
              Done
            </button>
          </div>
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
  return (
    <div className="flex items-center justify-center h-28 text-gray-300">
      <p className="text-sm">No data to display</p>
    </div>
  );
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-3 text-xs min-w-[120px]">
      <p className="font-semibold text-gray-700 mb-1.5">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2 mb-0.5">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: p.color ?? p.fill }} />
          <span className="text-gray-500">{p.name}:</span>
          <span className="font-medium text-gray-800">
            {typeof p.value === "number"
              ? (p.name?.toLowerCase().includes("hour") ? p.value.toFixed(1) : p.value)
              : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Stats Panel ───────────────────────────────────────────────────────────────

function StatsPanel({ schedules, subjects }: { schedules: any[]; subjects: any[] }) {
  const [trendBatch,   setTrendBatch]   = useState("");
  const [trendSubject, setTrendSubject] = useState("");

  const batchMap = new Map<string, { id: string; name: string; count: number; hours: number }>();
  for (const s of schedules) {
    const hrs = lectureDurationHours(s);
    for (const sb of (s.batches ?? [])) {
      const bid = sb.batchId;
      if (!batchMap.has(bid)) batchMap.set(bid, { id: bid, name: sb.batch?.name ?? bid, count: 0, hours: 0 });
      const e = batchMap.get(bid)!;
      e.count++;
      e.hours = parseFloat((e.hours + hrs).toFixed(2));
    }
  }
  const batchStats = [...batchMap.values()].sort((a, b) => b.count - a.count);

  const bsMap = new Map<string, { batchId: string; subjectId: string; subjectName: string; count: number }>();
  for (const s of schedules) {
    const subId   = s.subjectId   ?? "__none__";
    const subName = s.subject?.name ?? "No Subject";
    for (const sb of (s.batches ?? [])) {
      const key = `${sb.batchId}:${subId}`;
      if (!bsMap.has(key)) bsMap.set(key, { batchId: sb.batchId, subjectId: subId, subjectName: subName, count: 0 });
      bsMap.get(key)!.count++;
    }
  }
  const subjectTotals: Record<string, number> = {};
  for (const e of bsMap.values()) subjectTotals[e.subjectName] = (subjectTotals[e.subjectName] ?? 0) + e.count;
  const topSubjects = Object.entries(subjectTotals).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([n]) => n);

  const subjectIdByName = new Map<string, string>();
  for (const e of bsMap.values()) {
    if (!subjectIdByName.has(e.subjectName)) subjectIdByName.set(e.subjectName, e.subjectId);
  }

  const batchSubjectChart = batchStats.slice(0, 15).map((b) => {
    const row: Record<string, any> = { batchName: b.name.length > 16 ? b.name.slice(0, 16) + "…" : b.name };
    for (const sn of topSubjects) {
      const sid = subjectIdByName.get(sn) ?? "__none__";
      row[sn] = bsMap.get(`${b.id}:${sid}`)?.count ?? 0;
    }
    return row;
  });

  const monthMap = new Map<string, { month: string; label: string; count: number; hours: number }>();
  for (const s of schedules) {
    if (trendBatch   && !s.batches?.some((sb: any) => sb.batchId === trendBatch))   continue;
    if (trendSubject && s.subjectId !== trendSubject)                                continue;
    const dt  = parseISO(s.date);
    const key = format(dt, "yyyy-MM");
    const lbl = format(dt, "MMM ''yy");
    if (!monthMap.has(key)) monthMap.set(key, { month: key, label: lbl, count: 0, hours: 0 });
    const e = monthMap.get(key)!;
    e.count++;
    e.hours = parseFloat((e.hours + lectureDurationHours(s)).toFixed(2));
  }
  const monthlyStats = [...monthMap.values()].sort((a, b) => a.month.localeCompare(b.month));

  const sc = { UPCOMING: 0, COMPLETED: 0, CANCELLED: 0 };
  for (const s of schedules) if (s.status in sc) sc[s.status as keyof typeof sc]++;
  const statusData = [
    { name: "Upcoming",  value: sc.UPCOMING,  color: "#6366f1" },
    { name: "Completed", value: sc.COMPLETED, color: "#10b981" },
    { name: "Cancelled", value: sc.CANCELLED, color: "#ef4444" },
  ];

  const facultyMap = new Map<string, { name: string; count: number; hours: number }>();
  for (const s of schedules) {
    if (!s.employee) continue;
    const k = s.employeeId;
    if (!facultyMap.has(k)) facultyMap.set(k, { name: `${s.employee.firstName} ${s.employee.lastName}`, count: 0, hours: 0 });
    const e = facultyMap.get(k)!;
    e.count++;
    e.hours = parseFloat((e.hours + lectureDurationHours(s)).toFixed(2));
  }
  const facultyStats = [...facultyMap.values()].sort((a, b) => b.count - a.count).slice(0, 10);

  const totalLectures  = schedules.length;
  const totalHours     = parseFloat(schedules.reduce((s, x) => s + lectureDurationHours(x), 0).toFixed(1));
  const completionRate = totalLectures > 0 ? Math.round((sc.COMPLETED / totalLectures) * 100) : 0;
  const avgHrs         = totalLectures > 0 ? (totalHours / totalLectures).toFixed(1) : "0.0";

  if (totalLectures === 0) {
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
        <SummaryCard label="Total Lectures"  value={totalLectures}       sub="all statuses"                  color="indigo" />
        <SummaryCard label="Total Hours"     value={`${totalHours}h`}    sub="teaching time"                 color="violet" />
        <SummaryCard label="Completion Rate" value={`${completionRate}%`} sub={`${sc.COMPLETED} completed`} color="green"  />
        <SummaryCard label="Avg Duration"    value={`${avgHrs}h`}        sub="per lecture"                   color="amber"  />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-sm font-semibold text-gray-800">Batch Overview</p>
          <p className="text-xs text-gray-400 mb-4">Lecture count and teaching hours per batch</p>
          {batchStats.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={Math.max(180, batchStats.length * 50 + 48)}>
              <BarChart data={batchStats} layout="vertical" margin={{ left: 0, right: 24, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12, fill: "#475569" }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                <Bar dataKey="count" name="Lectures" fill="#6366f1" radius={[0, 4, 4, 0]} maxBarSize={16} />
                <Bar dataKey="hours" name="Hours"    fill="#a5b4fc" radius={[0, 4, 4, 0]} maxBarSize={16} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-sm font-semibold text-gray-800">Status Breakdown</p>
          <p className="text-xs text-gray-400 mb-3">Distribution across lecture statuses</p>
          <ResponsiveContainer width="100%" height={170}>
            <PieChart>
              <Pie data={statusData} cx="50%" cy="50%" innerRadius={46} outerRadius={72}
                paddingAngle={3} dataKey="value" strokeWidth={0}>
                {statusData.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-1">
            {statusData.map((s) => (
              <div key={s.name} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                  {s.name}
                </span>
                <span className="font-semibold text-gray-700">{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <p className="text-sm font-semibold text-gray-800">Subject Distribution by Batch</p>
        <p className="text-xs text-gray-400 mb-4">Lectures per subject stacked across batches (top 8 subjects)</p>
        {batchSubjectChart.length === 0 ? <EmptyChart /> : (
          <ResponsiveContainer width="100%" height={Math.max(200, batchSubjectChart.length * 46 + 60)}>
            <BarChart data={batchSubjectChart} layout="vertical" margin={{ left: 0, right: 24, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
              <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="batchName" width={120} tick={{ fontSize: 12, fill: "#475569" }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              {topSubjects.map((sub, i) => (
                <Bar key={sub} dataKey={sub} stackId="s" fill={CHART_COLORS[i % CHART_COLORS.length]} maxBarSize={20}
                  radius={i === topSubjects.length - 1 ? [0, 4, 4, 0] : undefined} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <p className="text-sm font-semibold text-gray-800">Monthly Trend</p>
            <p className="text-xs text-gray-400">Lecture count (bars) and teaching hours (line) over time</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <FSelect value={trendBatch} onChange={(e) => setTrendBatch(e.target.value)} className="!w-auto text-xs !py-1.5">
              <option value="">All Batches</option>
              {batchStats.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </FSelect>
            <FSelect value={trendSubject} onChange={(e) => setTrendSubject(e.target.value)} className="!w-auto text-xs !py-1.5">
              <option value="">All Subjects</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </FSelect>
          </div>
        </div>
        {monthlyStats.length === 0 ? <EmptyChart /> : (
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={monthlyStats} margin={{ left: 0, right: 24, top: 4, bottom: 4 }}>
              <defs>
                <linearGradient id="hoursGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#8b5cf6" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="l" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              <Bar   yAxisId="l" dataKey="count" name="Lectures" fill="#6366f1"           radius={[4, 4, 0, 0]} maxBarSize={36} />
              <Area  yAxisId="r" dataKey="hours" name="Hours"    stroke="#8b5cf6" fill="url(#hoursGrad)" strokeWidth={2.5} dot={{ r: 3.5, fill: "#8b5cf6", strokeWidth: 0 }} type="monotone" />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {facultyStats.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-sm font-semibold text-gray-800">Faculty Load</p>
          <p className="text-xs text-gray-400 mb-4">Lectures and hours assigned per faculty member</p>
          <ResponsiveContainer width="100%" height={Math.max(180, facultyStats.length * 46 + 48)}>
            <BarChart data={facultyStats} layout="vertical" margin={{ left: 0, right: 24, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
              <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 12, fill: "#475569" }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              <Bar dataKey="count" name="Lectures" fill="#14b8a6" radius={[0, 4, 4, 0]} maxBarSize={16} />
              <Bar dataKey="hours" name="Hours"    fill="#99f6e4" radius={[0, 4, 4, 0]} maxBarSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ── Schedule modal ────────────────────────────────────────────────────────────

type DayRow = { on: boolean; startTime: string; endTime: string };

type ScheduleForm = {
  academicYear: string; batchIds: string[]; subjectId: string; employeeId: string;
  locationId: string; mode: "ONLINE" | "OFFLINE"; date: string; startTime: string; endTime: string; topics: string; notes: string;
  // "Add multiple schedules" — a date range plus per-weekday times.
  endDate: string; sameTime: boolean;
  commonStart: string; commonEnd: string;
  days: DayRow[]; // indexed 0 = Sunday … 6 = Saturday
  skipConflicts: boolean;
};

// Sunday-first, matching the attached form.
const WEEKDAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Quarter-hour options, rendered "5:00 AM" as in the reference form.
const TIME_OPTIONS: { value: string; label: string }[] = Array.from({ length: 96 }, (_, i) => {
  const h = Math.floor(i / 4), m = (i % 4) * 15;
  const ampm = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return {
    value: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
    label: `${h12}:${String(m).padStart(2, "0")} ${ampm}`,
  };
});

const DEFAULT_TIME = "05:00";

const blankDays = (): DayRow[] =>
  WEEKDAY_LABELS.map(() => ({ on: false, startTime: DEFAULT_TIME, endTime: DEFAULT_TIME }));

/** Left-label row, matching the reference form's layout. Stacks on mobile. */
function MRow({ label, required, children, align = "center" }: {
  label: string; required?: boolean; children: React.ReactNode; align?: "center" | "start";
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:gap-4" style={{ marginBottom: 14 }}>
      <div
        className="sm:w-[110px] sm:text-right shrink-0"
        style={{
          fontSize: 14, fontWeight: 700, color: D.ink,
          paddingTop: align === "start" ? 10 : 10,
          marginBottom: 6,
        }}
      >
        {label}{required && <span style={{ color: "#ef4444" }}>*</span>}
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

const TimeSelect = ({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) => (
  <DSelect
    value={value}
    disabled={disabled}
    onChange={(e) => onChange(e.target.value)}
    style={{ width: "100%", opacity: disabled ? 0.5 : 1 }}
  >
    {TIME_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
  </DSelect>
);

/**
 * Start + end share one two-column grid rather than flowing in a flex row, so the
 * two fields are exactly equal width and every row's start (and end) column lines
 * up with the row above it.
 */
const TimePair = ({ children }: { children: React.ReactNode }) => (
  <div className="grid grid-cols-2 gap-2" style={{ maxWidth: 392 }}>{children}</div>
);

const fmtShortDate = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

/** Payload for a single class. */
function buildSinglePayload(form: ScheduleForm) {
  return {
    academicYear: form.academicYear,
    batchIds: form.batchIds,
    subjectId: form.subjectId || null,
    employeeId: form.employeeId || null,
    locationId: form.locationId || null,
    mode: form.mode,
    date: new Date(form.date).toISOString(),
    startTime: new Date(`${form.date}T${form.startTime}`).toISOString(),
    endTime:   new Date(`${form.date}T${form.endTime}`).toISOString(),
    topics: form.topics || undefined,
    notes: form.notes || undefined,
  };
}

/** Payload for "Add multiple schedules" — date range plus the ticked weekdays. */
function buildMultiPayload(form: ScheduleForm) {
  return {
    academicYear: form.academicYear,
    batchIds: form.batchIds,
    subjectId: form.subjectId || null,
    employeeId: form.employeeId || null,
    locationId: form.locationId || null,
    mode: form.mode,
    topics: form.topics || undefined,
    notes: form.notes || undefined,
    startDate: form.date,
    endDate: form.endDate,
    days: form.days
      .map((d, weekday) => ({ ...d, weekday }))
      .filter((d) => d.on)
      .map((d) => ({
        weekday: d.weekday,
        startTime: form.sameTime ? form.commonStart : d.startTime,
        endTime:   form.sameTime ? form.commonEnd   : d.endTime,
      })),
    skipConflicts: form.skipConflicts,
    // So the server builds instants in the user's zone, not its own (prod is UTC).
    tzOffsetMinutes: new Date().getTimezoneOffset(),
  };
}

function ScheduleModal({
  open, onClose, initial, scheduleId, batches, subjects, employees, locations, academicYears, defaultYear,
}: {
  open: boolean; onClose: () => void; initial?: ScheduleForm; scheduleId?: string;
  batches: any[]; subjects: any[]; employees: any[]; locations: any[];
  academicYears: any[]; defaultYear: string;
}) {
  const qc = useQueryClient();
  const emptyForm = (): ScheduleForm => ({
    academicYear: defaultYear, batchIds: [], subjectId: "", employeeId: "",
    locationId: "", mode: "OFFLINE", date: "", startTime: "", endTime: "", topics: "", notes: "",
    endDate: "", sameTime: true, commonStart: DEFAULT_TIME, commonEnd: DEFAULT_TIME,
    days: blankDays(), skipConflicts: false,
  });
  const [form, setForm] = useState<ScheduleForm>(initial ?? emptyForm());

  useEffect(() => {
    if (open) setForm(initial ?? emptyForm());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const filteredBatches = form.academicYear
    ? batches.filter((b) => b.academicYear === form.academicYear)
    : batches;

  const endTimeError = Boolean(
    form.date && form.startTime && form.endTime &&
    new Date(`${form.date}T${form.endTime}`) <= new Date(`${form.date}T${form.startTime}`)
  );

  // In repeat mode the series preview reports clashes across every occurrence,
  // so the single-date banner would just duplicate it.
  const conflictEnabled = Boolean(form.employeeId && form.date && form.startTime && form.endTime && !endTimeError && Boolean(scheduleId));
  const { data: conflictData } = useQuery({
    queryKey: ["faculty-conflicts", form.employeeId, form.date],
    queryFn: () =>
      api.get(`/api/v1/academics/schedules?employeeId=${form.employeeId}&dateFrom=${form.date}&dateTo=${form.date}&limit=100`)
         .then((r) => r.data),
    enabled: conflictEnabled,
    staleTime: 30_000,
  });

  const conflictWarnings: string[] = [];
  if (conflictEnabled && conflictData?.data) {
    const startDT = new Date(`${form.date}T${form.startTime}`).getTime();
    const endDT   = new Date(`${form.date}T${form.endTime}`).getTime();
    for (const s of conflictData.data as any[]) {
      if (s.id === scheduleId) continue;
      const sBatchIds: string[] = s.batches?.map((sb: any) => sb.batchId) ?? [];
      if (form.batchIds.some((id) => sBatchIds.includes(id))) continue;
      const sStart = new Date(s.startTime).getTime();
      const sEnd   = new Date(s.endTime).getTime();
      if (startDT < sEnd && endDT > sStart) {
        const names = s.batches?.map((sb: any) => sb.batch?.name).filter(Boolean).join(", ") || "Unknown batch";
        conflictWarnings.push(names);
      }
    }
  }

  const updateMut = useMutation({
    mutationFn: (d: any) => api.patch(`/api/v1/academics/schedules/${scheduleId}`, d).then((r) => r.data),
    onSuccess: (res) => {
      if (!res.success) { toast.error(res.error); return; }
      qc.invalidateQueries({ queryKey: ["schedules"] });
      toast.success("Schedule updated");
      onClose();
    },
  });
  const recurringMut = useMutation({
    mutationFn: (d: any) => api.post("/api/v1/academics/schedules/recurring", d).then((r) => r.data),
    onSuccess: (res) => {
      if (!res.success) { toast.error(res.error); return; }
      qc.invalidateQueries({ queryKey: ["schedules"] });
      const { created, skipped, capped } = res.data;
      let msg = `${created} ${created === 1 ? "class" : "classes"} scheduled`;
      if (skipped) msg += ` · ${skipped} skipped for faculty clashes`;
      if (capped)  msg += " · stopped at the 200-class limit";
      toast.success(msg);
    },
  });
  const busy = updateMut.isPending || recurringMut.isPending;

  // The preview is computed by the same server code that creates the classes,
  // so what is listed here is exactly what saving produces.
  const selectedDays = form.days.filter((d) => d.on).length;
  const multiTimesValid = form.sameTime
    ? form.commonEnd > form.commonStart
    : form.days.every((d) => !d.on || d.endTime > d.startTime);
  const previewReady = Boolean(
    !scheduleId && form.academicYear && form.batchIds.length &&
    form.date && form.endDate && selectedDays > 0 && multiTimesValid
  );
  const previewBody = previewReady ? buildMultiPayload(form) : null;
  const { data: previewRes, isFetching: previewLoading } = useQuery({
    queryKey: ["schedule-multi-preview", JSON.stringify(previewBody)],
    queryFn: () => api.post("/api/v1/academics/schedules/recurring/preview", previewBody).then((r) => r.data),
    enabled: previewReady,
    staleTime: 30_000,
    retry: false,
  });
  const preview = previewRes?.success ? previewRes.data : null;
  const previewError = previewRes && !previewRes.success ? previewRes.error : null;

  const buildPayload = () => {
    if (!form.academicYear) { toast.error("Academic year is required"); return null; }
    if (form.batchIds.length === 0) { toast.error("Select at least one batch"); return null; }

    // Creating always goes through the multiple-schedules grid; only editing
    // works on a single date and time.
    if (!scheduleId) {
      if (!form.date || !form.endDate) { toast.error("Start and end date are required"); return null; }
      if (new Date(form.endDate) < new Date(form.date)) { toast.error("End date must be on or after the start date"); return null; }
      if (selectedDays === 0) { toast.error("Tick at least one day"); return null; }
      if (!multiTimesValid) { toast.error("End time must be after start time on every selected day"); return null; }
      return buildMultiPayload(form);
    }

    if (!form.date) { toast.error("Date is required"); return null; }
    if (!form.startTime || !form.endTime) { toast.error("Start and end time required"); return null; }
    if (endTimeError) { toast.error("End time must be after start time"); return null; }
    return buildSinglePayload(form);
  };

  const handleSave = () => {
    const p = buildPayload(); if (!p) return;
    if (scheduleId) updateMut.mutate(p);
    else recurringMut.mutate(p, { onSuccess: (res) => { if (res.success) onClose(); } });
  };
  const handleSaveAnother = () => {
    const p = buildPayload(); if (!p) return;
    recurringMut.mutate(p, {
      onSuccess: (res) => {
        if (res.success) setForm({ ...emptyForm(), academicYear: form.academicYear, date: form.date });
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
        <div
          className="flex items-center justify-between gap-5 border-b shrink-0"
          style={{ padding: "24px 28px", borderColor: D.line }}
        >
          <div className="flex items-center gap-4">
            <div style={{
              width: 44, height: 44, borderRadius: 14, display: "grid", placeItems: "center",
              background: "#eef2ff", color: D.nav2, fontWeight: 900, fontSize: 15, flexShrink: 0,
            }}>SC</div>
            <h2 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: D.ink }}>
              {scheduleId ? "Edit Schedule" : "New Schedule"}
            </h2>
          </div>
          <button onClick={onClose} className="border-0 bg-transparent cursor-pointer leading-none text-3xl" style={{ color: "#9aa3b4" }}>×</button>
        </div>

        <div className="overflow-y-auto flex-1" style={{ padding: "24px 28px" }}>
          <div style={{ display: "grid", gap: 18 }}>
            <section style={sectionStyle}>
              <h3 style={sectionHeadStyle}>Class Context</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-[14px]">
                <DField label="Academic Year" required>
                  <DSelect value={form.academicYear} onChange={(e) => setForm({ ...form, academicYear: e.target.value, batchIds: [] })}>
                    <option value="">Select academic year</option>
                    {academicYears.filter((y) => !y.isArchived).map((y) => (
                      <option key={y.id} value={y.name}>{y.name}</option>
                    ))}
                  </DSelect>
                </DField>
                <DField label="Batch(es)" required>
                  <BatchMultiSelect batches={filteredBatches} selected={form.batchIds} onChange={(ids) => setForm({ ...form, batchIds: ids })} />
                  {form.batchIds.length > 0 && (
                    <p style={{ fontSize: 12, color: "#4f46e5", margin: 0 }}>
                      {form.batchIds.length} batch{form.batchIds.length > 1 ? "es" : ""} selected
                    </p>
                  )}
                </DField>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-[14px]" style={{ marginTop: 14 }}>
                <DField label="Subject">
                  <DSelect value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })}>
                    <option value="">Select subject</option>
                    {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </DSelect>
                </DField>
                <DField label="Faculty">
                  <DSelect value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}>
                    <option value="">Select faculty</option>
                    {employees.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
                  </DSelect>
                </DField>
              </div>
              {/* Mode kept here after the Timing & Location section was removed. */}
              <div style={{ marginTop: 14 }}>
                <DField label="Mode">
                  <div style={{ display: "flex", gap: 8, maxWidth: 420 }}>
                    {(["OFFLINE", "ONLINE"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setForm({ ...form, mode: m })}
                        style={{
                          flex: 1, minHeight: 42, border: `1.5px solid ${form.mode === m ? (m === "ONLINE" ? "#10b981" : "#4f46e5") : "#e6e8ef"}`,
                          borderRadius: 12, background: form.mode === m ? (m === "ONLINE" ? "#ecfdf5" : "#ede9fe") : "white",
                          color: form.mode === m ? (m === "ONLINE" ? "#065f46" : "#3730a3") : "#7c8598",
                          fontWeight: form.mode === m ? 700 : 500, fontSize: 14, cursor: "pointer", transition: "all .15s",
                        }}
                      >
                        {m === "ONLINE" ? "🌐 Online" : "🏫 Offline"}
                      </button>
                    ))}
                  </div>
                </DField>
              </div>
              {conflictWarnings.length > 0 && (
                <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50" style={{ padding: "10px 14px", marginTop: 14 }}>
                  <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#b91c1c", margin: "0 0 2px" }}>Faculty conflict detected</p>
                    <p style={{ fontSize: 12, color: "#ef4444", margin: 0 }}>
                      {employees.find((e) => e.id === form.employeeId)
                        ? `${employees.find((e) => e.id === form.employeeId)!.firstName} ${employees.find((e) => e.id === form.employeeId)!.lastName}`
                        : "This faculty"}{" "}
                      already has a class at this time with: {conflictWarnings.join("; ")}
                    </p>
                  </div>
                </div>
              )}
            </section>

            {/* Editing one class keeps a single date and time — the grid below is
                only for creating a set. */}
            {scheduleId && (
              <section style={sectionStyle}>
                <h3 style={sectionHeadStyle}>Timing</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-[14px]">
                  <DField label="Date" required>
                    <DInput type="date" max="2099-12-31" min="1900-01-01" value={form.date}
                      onChange={(e) => setForm({ ...form, date: e.target.value })} />
                  </DField>
                  <DField label="Start Time" required>
                    <DInput type="time" value={form.startTime}
                      onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
                  </DField>
                  <DField label="End Time" required>
                    <DInput type="time" error={endTimeError} value={form.endTime}
                      onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
                    {endTimeError && <p style={{ fontSize: 12, color: "#ef4444", margin: 0 }}>End time must be after start time</p>}
                  </DField>
                </div>
              </section>
            )}

            {/* Add Multiple Schedules — the only way to create. */}
            {!scheduleId && (
              <section style={sectionStyle}>
                <h3 style={sectionHeadStyle}>Add Multiple Schedules</h3>

                <MRow label="Date" required>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <DInput
                      type="date" placeholder="Start Date" max="2099-12-31" min="1900-01-01"
                      value={form.date}
                      onChange={(e) => setForm({ ...form, date: e.target.value })}
                      style={{ flex: 1, minWidth: 0 }}
                    />
                    <DInput
                      type="date" placeholder="End Date" max="2099-12-31" min={form.date || undefined}
                      value={form.endDate}
                      onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                      style={{ flex: 1, minWidth: 0 }}
                    />
                  </div>
                </MRow>

                {/* Not an MRow: "Apply" belongs to the checkbox, so the box leads the
                    line. Left in the label column it read as a stray box mid-row. */}
                <div className="flex flex-col sm:flex-row sm:gap-4" style={{ marginBottom: 14 }}>
                  <div className="sm:w-[110px] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <label className="flex items-center gap-2 cursor-pointer" style={{ minHeight: 42 }}>
                      <input
                        type="checkbox"
                        checked={form.sameTime}
                        onChange={(e) => setForm({ ...form, sameTime: e.target.checked })}
                        style={{ width: 16, height: 16, accentColor: D.nav2 }}
                      />
                      <span style={{ fontSize: 14, color: D.ink }}>
                        <strong style={{ fontWeight: 700 }}>Apply</strong> Same Time to Schedules
                      </span>
                    </label>
                  </div>
                </div>

                {form.sameTime && (
                  <MRow label="Time" required>
                    <TimePair>
                      <TimeSelect value={form.commonStart} onChange={(v) => setForm({ ...form, commonStart: v })} />
                      <TimeSelect value={form.commonEnd} onChange={(v) => setForm({ ...form, commonEnd: v })} />
                    </TimePair>
                    {/* Both default to 5:00 AM as in the reference form, so hold the
                        error back until a day is actually ticked. */}
                    {selectedDays > 0 && form.commonEnd <= form.commonStart && (
                      <p style={{ fontSize: 12, color: "#ef4444", margin: "6px 0 0" }}>End time must be after start time</p>
                    )}
                  </MRow>
                )}

                <MRow label="Schedules" required align="start">
                  <div style={{ display: "grid", gap: 10 }}>
                    {WEEKDAY_LABELS.map((label, i) => {
                      const row = form.days[i];
                      const bad = row.on && !form.sameTime && row.endTime <= row.startTime;
                      const setRow = (patch: Partial<DayRow>) =>
                        setForm({ ...form, days: form.days.map((d, j) => (j === i ? { ...d, ...patch } : d)) });
                      return (
                        <div key={label} className="flex flex-col sm:flex-row sm:items-center gap-2">
                          <label className="flex items-center gap-2 cursor-pointer shrink-0" style={{ width: 140 }}>
                            <input
                              type="checkbox"
                              checked={row.on}
                              onChange={(e) => setRow({ on: e.target.checked })}
                              style={{ width: 16, height: 16, accentColor: D.nav2 }}
                            />
                            <span style={{ fontSize: 14, color: row.on ? D.ink : D.muted, fontWeight: row.on ? 600 : 400 }}>
                              {label}
                            </span>
                          </label>
                          {!form.sameTime && (
                            <div className="flex-1 min-w-0">
                              <TimePair>
                                <TimeSelect value={row.startTime} disabled={!row.on} onChange={(v) => setRow({ startTime: v })} />
                                <TimeSelect value={row.endTime} disabled={!row.on} onChange={(v) => setRow({ endTime: v })} />
                              </TimePair>
                            </div>
                          )}
                          {bad && <span style={{ fontSize: 12, color: "#ef4444" }} className="shrink-0">End must be after start</span>}
                        </div>
                      );
                    })}
                    {selectedDays === 0 && (
                      <p style={{ fontSize: 12, color: "#b45309", margin: 0 }}>Tick at least one day.</p>
                    )}
                  </div>
                </MRow>

                {/* Preview comes from the server, so it matches what saving creates. */}
                {previewReady && (
                  <MRow label="Preview" align="start">
                    <div style={{ padding: 14, borderRadius: 12, background: "white", border: `1px solid ${D.line}` }}>
                      {previewLoading && <p style={{ fontSize: 13, color: D.muted, margin: 0 }}>Working out the classes…</p>}
                      {previewError && <p style={{ fontSize: 13, color: "#ef4444", margin: 0 }}>{previewError}</p>}
                      {preview && (
                        <>
                          <p style={{ fontSize: 14, fontWeight: 700, color: D.ink, margin: "0 0 6px" }}>
                            Creates {preview.count} {preview.count === 1 ? "class" : "classes"}
                          </p>
                          <p style={{ fontSize: 13, color: D.muted, margin: 0, lineHeight: 1.6 }}>
                            {preview.occurrences.slice(0, 6).map((o: any) => `${fmtShortDate(o.date)} ${o.startTime}`).join(" · ")}
                            {preview.occurrences.length > 6 &&
                              ` … and ${preview.occurrences.length - 6} more, to ${fmtShortDate(preview.occurrences[preview.occurrences.length - 1].date)}`}
                          </p>
                          {preview.capped && (
                            <p style={{ fontSize: 12, color: "#b45309", margin: "8px 0 0" }}>
                              Stops at the 200-class limit. Shorten the date range to cover the rest.
                            </p>
                          )}
                          {preview.conflicts?.length > 0 && (
                            <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: "#fef2f2", border: "1px solid #fecaca" }}>
                              <p style={{ fontSize: 13, fontWeight: 700, color: "#b91c1c", margin: "0 0 4px" }}>
                                {preview.conflicts.length} {preview.conflicts.length === 1 ? "class clashes" : "classes clash"} with this faculty&apos;s other lectures
                              </p>
                              <p style={{ fontSize: 12, color: "#ef4444", margin: "0 0 8px", lineHeight: 1.6 }}>
                                {preview.conflicts.slice(0, 5).map((c: any) => `${fmtShortDate(c.date)} ${c.startTime} (${c.batches})`).join(" · ")}
                                {preview.conflicts.length > 5 && ` … +${preview.conflicts.length - 5} more`}
                              </p>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={form.skipConflicts}
                                  onChange={(e) => setForm({ ...form, skipConflicts: e.target.checked })}
                                  style={{ width: 15, height: 15, accentColor: "#b91c1c" }}
                                />
                                <span style={{ fontSize: 12, color: "#b91c1c" }}>Skip those</span>
                              </label>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </MRow>
                )}
              </section>
            )}

            <section style={sectionStyle}>
              <h3 style={sectionHeadStyle}>Class Plan</h3>
              <DField label="Topics">
                <DInput placeholder="e.g. Quadratic Equations, Chapter 5" value={form.topics} onChange={(e) => setForm({ ...form, topics: e.target.value })} />
              </DField>
              <div style={{ marginTop: 14 }}>
                <DField label="Notes">
                  <DTextarea placeholder="Additional notes…" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </DField>
              </div>
            </section>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t shrink-0" style={{ padding: "18px 28px", borderColor: D.line }}>
          <DBtn onClick={onClose} disabled={busy}>Cancel</DBtn>
          <div className="flex flex-wrap items-center gap-3">
            {!scheduleId && (
              <DBtn
                onClick={handleSaveAnother}
                disabled={busy || endTimeError}
              >
                Save &amp; Add Another
              </DBtn>
            )}
            <DBtn primary onClick={handleSave} disabled={busy || endTimeError}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {scheduleId
                ? "Save Changes"
                : (preview ? `Create ${preview.count} ${preview.count === 1 ? "class" : "classes"}` : "Create Schedules")}
            </DBtn>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Attendance Tab ─────────────────────────────────────────────────────────────

function AttendanceTab({
  scheduleId, batchStudents, existingAttendance, canEdit, onSaved,
}: {
  scheduleId: string;
  batchStudents: any[];
  existingAttendance: { studentId: string; isPresent: boolean; note: string | null }[];
  canEdit: boolean;
  onSaved: () => void;
}) {
  const qc = useQueryClient();

  // Build initial state from existing records OR default all present
  const initialRows = (): Map<string, { isPresent: boolean; note: string; excluded: boolean }> => {
    const m = new Map<string, { isPresent: boolean; note: string; excluded: boolean }>();
    // Start with all batch students (default present)
    for (const st of batchStudents) {
      m.set(st.id, { isPresent: true, note: "", excluded: false });
    }
    // Override with existing attendance
    for (const a of existingAttendance) {
      if (m.has(a.studentId)) {
        m.set(a.studentId, { isPresent: a.isPresent, note: a.note ?? "", excluded: false });
      }
    }
    return m;
  };

  const [rows, setRows] = useState<Map<string, { isPresent: boolean; note: string; excluded: boolean }>>(initialRows);
  const [saving, setSaving] = useState(false);

  const alreadyMarked = existingAttendance.length > 0;

  const saveAttMut = useMutation({
    mutationFn: () => {
      const records: { studentId: string; isPresent: boolean; note?: string }[] = [];
      for (const [studentId, v] of rows) {
        if (!v.excluded) records.push({ studentId, isPresent: v.isPresent, note: v.note || undefined });
      }
      return api.post(`/api/v1/academics/schedules/${scheduleId}/attendance`, { records }).then((r) => r.data);
    },
    onSuccess: (res) => {
      if (!res.success) { toast.error(res.error ?? "Failed to save attendance"); return; }
      toast.success("Attendance saved");
      qc.invalidateQueries({ queryKey: ["schedules"] });
      onSaved();
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed to save attendance"),
  });

  const update = (studentId: string, patch: Partial<{ isPresent: boolean; note: string; excluded: boolean }>) => {
    setRows((prev) => {
      const next = new Map(prev);
      next.set(studentId, { ...prev.get(studentId)!, ...patch });
      return next;
    });
  };

  const activeSts = batchStudents.filter((st) => !rows.get(st.id)?.excluded);
  const presentCount = activeSts.filter((st) => rows.get(st.id)?.isPresent).length;
  const pct = activeSts.length > 0 ? Math.round((presentCount / activeSts.length) * 100) : 0;

  if (batchStudents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Users className="h-10 w-10 text-gray-200 mb-3" />
        <p className="font-semibold text-gray-400">No active students in this batch</p>
        <p className="text-sm text-gray-300 mt-1">Enrol students in the batch first</p>
      </div>
    );
  }

  return (
    <div>
      {/* Summary bar */}
      <div className="flex items-center justify-between gap-3 mb-4 p-3 rounded-xl bg-indigo-50 border border-indigo-100">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-green-700">
            <UserCheck className="h-4 w-4" /> {presentCount} Present
          </span>
          <span className="flex items-center gap-1.5 text-sm font-semibold text-red-600">
            <UserX className="h-4 w-4" /> {activeSts.length - presentCount} Absent
          </span>
        </div>
        <span style={{
          fontSize: 16, fontWeight: 900,
          color: pct >= 75 ? "#16a34a" : pct >= 50 ? "#d97706" : "#dc2626",
        }}>
          {pct}% Attendance
        </span>
      </div>

      {alreadyMarked && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700 font-medium">
          Attendance already marked. You can update it below.
        </div>
      )}

      {/* Student list */}
      <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
        {batchStudents.map((st) => {
          const row = rows.get(st.id) ?? { isPresent: true, note: "", excluded: false };
          if (row.excluded) return null;
          return (
            <div
              key={st.id}
              className="flex items-center gap-3 rounded-xl border px-3 py-2 transition-colors"
              style={{
                borderColor: row.isPresent ? "#bbf7d0" : "#fecaca",
                background:  row.isPresent ? "#f0fdf4"  : "#fff5f5",
              }}
            >
              {/* Presence checkbox */}
              <button
                type="button"
                onClick={() => canEdit && update(st.id, { isPresent: !row.isPresent })}
                style={{
                  width: 28, height: 28, borderRadius: 8, border: 0, cursor: canEdit ? "pointer" : "default",
                  display: "grid", placeItems: "center", flexShrink: 0,
                  background: row.isPresent ? "#16a34a" : "#dc2626",
                  color: "white",
                }}
                title={row.isPresent ? "Mark absent" : "Mark present"}
              >
                {row.isPresent
                  ? <CheckCircle2 style={{ width: 16, height: 16 }} />
                  : <XCircle style={{ width: 16, height: 16 }} />}
              </button>

              {/* Name */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">
                  {st.firstName} {st.lastName}
                </p>
                <p className="text-[11px] text-gray-400">{st.rollNumber ?? st.studentCode}</p>
              </div>

              {/* Note input */}
              {canEdit && (
                <input
                  type="text"
                  placeholder="Note…"
                  value={row.note}
                  onChange={(e) => update(st.id, { note: e.target.value })}
                  style={{
                    flex: "0 0 140px", height: 30, borderRadius: 8,
                    border: `1px solid ${D.line}`, padding: "0 8px", fontSize: 12,
                    background: "white", outline: "none", fontFamily: "inherit",
                  }}
                />
              )}

              {/* Remove from marking */}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => update(st.id, { excluded: true })}
                  title="Remove from attendance"
                  style={{
                    width: 26, height: 26, borderRadius: 8, border: 0,
                    background: "transparent", cursor: "pointer",
                    display: "grid", placeItems: "center", color: "#9ca3af",
                    flexShrink: 0,
                  }}
                  className="hover:bg-red-50 hover:text-red-500 transition-colors"
                >
                  <Trash2 style={{ width: 14, height: 14 }} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {canEdit && (
        <div className="mt-4 flex justify-end">
          <DBtn primary onClick={() => saveAttMut.mutate()} disabled={saveAttMut.isPending}>
            {saveAttMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Attendance
          </DBtn>
        </div>
      )}
    </div>
  );
}

// ── Assignment Tab ─────────────────────────────────────────────────────────────

function AssignmentTab({
  schedule, batches, subjects, employees, academicYears, canEdit, onSaved,
}: {
  schedule: any;
  batches: any[];
  subjects: any[];
  employees: any[];
  academicYears: any[];
  canEdit: boolean;
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const router = useRouter();
  const assignment = schedule.assignments?.[0] ?? null;

  const batchIds = schedule.batches?.map((sb: any) => sb.batchId) ?? [];
  const dateStr  = schedule.date ? schedule.date.split("T")[0] : todayStr();

  // Create assignment form
  const emptyAssignForm = () => ({
    academicYear:   schedule.academicYear ?? "",
    name:           schedule.subject?.name ? `${schedule.subject.name} Assignment` : "",
    assignmentDate: dateStr,
    submissionDate: "",
    batchIds,
    subjectId:      schedule.subjectId ?? "",
    employeeId:     schedule.employeeId ?? "",
    topics:         schedule.topics ?? "",
    note:           "",
    scheduleId:     schedule.id,
  });
  const [assForm, setAssForm] = useState(emptyAssignForm);
  const [submissionError, setSubmissionError] = useState(false);

  useEffect(() => {
    const err = Boolean(
      assForm.assignmentDate && assForm.submissionDate &&
      new Date(assForm.submissionDate) < new Date(assForm.assignmentDate)
    );
    setSubmissionError(err);
  }, [assForm.assignmentDate, assForm.submissionDate]);

  const createAssignmentMut = useMutation({
    mutationFn: (d: any) => api.post("/api/v1/academics/assignments", d).then((r) => r.data),
    onSuccess: (res) => {
      if (!res.success) { toast.error(res.error ?? "Failed to create assignment"); return; }
      toast.success("Assignment created");
      qc.invalidateQueries({ queryKey: ["schedules"] });
      qc.invalidateQueries({ queryKey: ["assignments"] });
      onSaved();
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed to create assignment"),
  });

  const approveSubmissionMut = useMutation({
    mutationFn: (submissionId: string) =>
      api.patch(`/api/v1/academics/assignments/${assignment.id}/submissions/${submissionId}`, { status: "GRADED" }).then((r) => r.data),
    onSuccess: (res) => {
      if (!res.success) { toast.error(res.error ?? "Failed to update"); return; }
      toast.success("Submission approved");
      qc.invalidateQueries({ queryKey: ["schedules"] });
      onSaved();
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed to approve"),
  });

  const handleCreateAssignment = () => {
    if (!assForm.name.trim())       { toast.error("Assignment name is required"); return; }
    if (!assForm.assignmentDate)    { toast.error("Assignment date is required"); return; }
    if (!assForm.submissionDate)    { toast.error("Submission date is required"); return; }
    if (submissionError)            { toast.error("Submission date can't be before assignment date"); return; }
    if (assForm.batchIds.length === 0) { toast.error("At least one batch required"); return; }

    createAssignmentMut.mutate({
      academicYear:   assForm.academicYear,
      name:           assForm.name.trim(),
      assignmentDate: new Date(assForm.assignmentDate).toISOString(),
      submissionDate: new Date(assForm.submissionDate).toISOString(),
      batchIds:       assForm.batchIds,
      subjectId:      assForm.subjectId  || null,
      employeeId:     assForm.employeeId || null,
      topics:         assForm.topics.trim() || null,
      note:           assForm.note.trim()   || null,
      scheduleId:     schedule.id,
    });
  };

  const filteredBatches = assForm.academicYear
    ? batches.filter((b) => b.academicYear === assForm.academicYear)
    : batches;

  if (assignment) {
    // Show linked assignment summary + link to approval page
    const submissions   = assignment.submissions ?? [];
    const totalStudents = submissions.length;
    const submitted     = submissions.filter((s: any) => s.status !== "NOT_SUBMITTED").length;
    const pct           = totalStudents > 0 ? Math.round((submitted / totalStudents) * 100) : 0;
    const allReviewed   = totalStudents > 0 && submissions.every((s: any) => s.status === "GRADED");

    return (
      <div className="space-y-4">
        {/* Assignment card */}
        <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4">
          <div className="flex items-start gap-3">
            <div style={{ width: 38, height: 38, borderRadius: 11, background: "#4f46e5", display: "grid", placeItems: "center", flexShrink: 0 }}>
              <BookOpen style={{ width: 17, height: 17, color: "white" }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900 text-sm truncate">{assignment.name}</p>
              {assignment.submissionDate && (
                <p className="text-xs text-gray-500 mt-0.5">
                  Due: {format(new Date(assignment.submissionDate), "dd MMM yyyy")}
                  {assignment.subject && <> · {assignment.subject.name}</>}
                </p>
              )}
            </div>
          </div>

          {/* Submission progress bar */}
          {totalStudents > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-500">Submissions</span>
                <span style={{
                  fontSize: 13, fontWeight: 800,
                  color: pct >= 75 ? "#16a34a" : pct >= 50 ? "#d97706" : "#dc2626",
                }}>
                  {submitted}/{totalStudents} · {pct}%
                </span>
              </div>
              <div style={{ height: 6, borderRadius: 99, background: "#e0e7ff", overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: 99,
                  width: `${pct}%`,
                  background: pct >= 75 ? "#16a34a" : pct >= 50 ? "#d97706" : "#dc2626",
                  transition: "width .3s",
                }} />
              </div>
            </div>
          )}

          {totalStudents === 0 && (
            <p className="text-xs text-gray-400 mt-2">No students linked to submissions yet</p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-2">
          {canEdit && !allReviewed && submitted > 0 && (
            <button
              onClick={() => router.push(`/dashboard/academics/assignments/${assignment.id}`)}
              style={{
                width: "100%", minHeight: 44, border: 0, borderRadius: 12,
                background: "linear-gradient(135deg,#28245f,#4f46e5)",
                color: "white", fontWeight: 800, font: "inherit", fontSize: 14,
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                boxShadow: "0 8px 20px rgba(79,70,229,.28)",
              }}
            >
              <CheckCircle2 style={{ width: 16, height: 16 }} />
              Review & Approve Submissions
            </button>
          )}
          <button
            onClick={() => router.push(`/dashboard/academics/assignments/${assignment.id}`)}
            style={{
              width: "100%", minHeight: 40, borderRadius: 12,
              border: `1px solid ${D.line}`, background: "white",
              color: D.ink, fontWeight: 700, font: "inherit", fontSize: 13,
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
            }}
          >
            <ExternalLink style={{ width: 14, height: 14, color: D.muted }} />
            Open Assignment Page
          </button>
        </div>

        {allReviewed && (
          <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
            <p className="text-sm font-semibold text-green-700">All submissions reviewed</p>
          </div>
        )}
      </div>
    );
  }

  // No assignment → show create form
  if (!canEdit) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <BookOpen className="h-10 w-10 text-gray-200 mb-3" />
        <p className="font-semibold text-gray-400">No assignment linked to this session</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs text-gray-500 mb-4 font-medium">No assignment linked to this session yet. Create one below.</p>
      <div className="space-y-3">
        <DField label="Assignment Name" required>
          <DInput placeholder="e.g. Practice Problems – Chapter 5" value={assForm.name} onChange={(e) => setAssForm({ ...assForm, name: e.target.value })} />
        </DField>
        <div className="grid grid-cols-2 gap-3">
          <DField label="Assignment Date" required>
            <DInput type="date" max="2099-12-31" min="1900-01-01" value={assForm.assignmentDate} onChange={(e) => setAssForm({ ...assForm, assignmentDate: e.target.value })} />
          </DField>
          <DField label="Submission Date" required>
            <DInput type="date" max="2099-12-31" min="1900-01-01" error={submissionError} value={assForm.submissionDate} onChange={(e) => setAssForm({ ...assForm, submissionDate: e.target.value })} />
            {submissionError && <p style={{ fontSize: 11, color: "#ef4444", margin: 0 }}>Can't be before assignment date</p>}
          </DField>
        </div>
        <DField label="Batch(es)" required>
          <BatchMultiSelect batches={filteredBatches} selected={assForm.batchIds} onChange={(ids) => setAssForm({ ...assForm, batchIds: ids })} />
        </DField>
        <div className="grid grid-cols-2 gap-3">
          <DField label="Subject">
            <DSelect value={assForm.subjectId} onChange={(e) => setAssForm({ ...assForm, subjectId: e.target.value })}>
              <option value="">— Subject —</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </DSelect>
          </DField>
          <DField label="Faculty">
            <DSelect value={assForm.employeeId} onChange={(e) => setAssForm({ ...assForm, employeeId: e.target.value })}>
              <option value="">— Faculty —</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
            </DSelect>
          </DField>
        </div>
        <DField label="Topics">
          <DInput placeholder="Topics covered…" value={assForm.topics} onChange={(e) => setAssForm({ ...assForm, topics: e.target.value })} />
        </DField>
        <DField label="Note">
          <DTextarea placeholder="Additional instructions…" value={assForm.note} onChange={(e) => setAssForm({ ...assForm, note: e.target.value })} style={{ minHeight: 64 }} />
        </DField>
        <div className="flex justify-end">
          <DBtn primary onClick={handleCreateAssignment} disabled={createAssignmentMut.isPending}>
            {createAssignmentMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Create Assignment
          </DBtn>
        </div>
      </div>
    </div>
  );
}

// ── Schedule Detail Modal ─────────────────────────────────────────────────────

function ScheduleDetailModal({
  scheduleId, onClose, batches, subjects, employees, academicYears, canEdit,
}: {
  scheduleId: string | null;
  onClose: () => void;
  batches: any[];
  subjects: any[];
  employees: any[];
  academicYears: any[];
  canEdit: boolean;
}) {
  const [activeTab, setActiveTab] = useState<"attendance" | "assignment">("attendance");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["schedule-detail", scheduleId],
    queryFn: () =>
      api.get(`/api/v1/academics/schedules/${scheduleId}/attendance-detail`).then((r) => r.data.data),
    enabled: Boolean(scheduleId),
    staleTime: 0,
  });

  if (!scheduleId) return null;

  const schedule      = data;
  const batchStudents = data?.batchStudents ?? [];
  const attendance    = data?.attendances   ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(17,24,39,0.55)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full bg-white flex flex-col"
        style={{
          maxWidth: 600, borderRadius: 22,
          boxShadow: "0 32px 90px rgba(0,0,0,.3)",
          maxHeight: "88vh", overflow: "hidden",
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 shrink-0 border-b" style={{ padding: "20px 24px", borderColor: D.line }}>
          <div className="flex-1 min-w-0">
            {isLoading || !schedule ? (
              <div className="h-5 w-48 bg-gray-100 rounded animate-pulse" />
            ) : (
              <>
                <p style={{ fontSize: 11, fontWeight: 800, color: "#6366f1", textTransform: "uppercase", letterSpacing: ".06em", margin: "0 0 4px" }}>
                  {fmtDateHeading(schedule.date?.split("T")[0] ?? "")} · {fmtTime(schedule.startTime)} – {fmtTime(schedule.endTime)}
                </p>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: D.ink, lineHeight: 1.2 }}>
                  {schedule.subject?.name ?? "No subject"}
                  <span style={{ color: D.muted, fontWeight: 600, fontSize: 14 }}> · {schedule.batches?.map((sb: any) => sb.batch?.name).join(", ")}</span>
                </h2>
                {schedule.employee && (
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: D.muted, display: "flex", alignItems: "center", gap: 4 }}>
                    <User style={{ width: 12, height: 12 }} /> {schedule.employee.firstName} {schedule.employee.lastName}
                  </p>
                )}
              </>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 border-0 bg-transparent cursor-pointer"
            style={{ marginTop: 2, flexShrink: 0 }}
          >
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b shrink-0" style={{ borderColor: D.line }}>
          {(["attendance", "assignment"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1, height: 46, border: 0, background: "transparent",
                cursor: "pointer", font: "inherit",
                fontSize: 13, fontWeight: 800,
                color: activeTab === tab ? D.nav2 : D.muted,
                borderBottom: activeTab === tab ? `2px solid ${D.nav2}` : "2px solid transparent",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                transition: "color .15s",
              }}
            >
              {tab === "attendance"
                ? <><Users style={{ width: 15, height: 15 }} /> Attendance</>
                : <><BookOpen style={{ width: 15, height: 15 }} /> Assignment</>}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto" style={{ padding: "20px 24px" }}>
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
            </div>
          ) : activeTab === "attendance" ? (
            <AttendanceTab
              scheduleId={scheduleId}
              batchStudents={batchStudents}
              existingAttendance={attendance}
              canEdit={canEdit}
              onSaved={() => refetch()}
            />
          ) : (
            <AssignmentTab
              schedule={schedule}
              batches={batches}
              subjects={subjects}
              employees={employees}
              academicYears={academicYears}
              canEdit={canEdit}
              onSaved={() => refetch()}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Schedule row ──────────────────────────────────────────────────────────────

function ScheduleRow({ s, canEdit, onEdit, onDelete, onStatus, onClick }: {
  s: any; canEdit: boolean;
  onEdit: (s: any) => void;
  onDelete: (s: any) => void;
  onStatus: (id: string, status: string) => void;
  onClick: (s: any) => void;
}) {
  const batchNames = s.batches?.map((sb: any) => sb.batch?.name).filter(Boolean).join(", ") ?? "—";
  const assignments = (s.assignments ?? []) as { id: string; submissions: { status: string }[] }[];

  return (
    <tr
      className="hover:bg-indigo-50/40 transition-colors group cursor-pointer"
      onClick={() => onClick(s)}
    >
      <td className="px-3 py-2.5 whitespace-nowrap">
        <p className="text-xs font-semibold text-gray-800">{fmtTime(s.startTime)}</p>
        <p className="text-[11px] text-gray-400">{fmtTime(s.endTime)}</p>
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap">
        <span className="text-xs text-gray-500 bg-indigo-50 rounded px-1.5 py-0.5">
          {calcDuration(s.startTime, s.endTime)}
        </span>
      </td>
      <td className="px-3 py-2.5 max-w-[160px]">
        <p className="text-xs font-medium text-gray-800 truncate" title={batchNames}>{batchNames}</p>
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap">
        <p className="text-xs text-gray-600">{s.subject?.name ?? <span className="text-gray-300">—</span>}</p>
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap">
        {s.employee
          ? <span className="flex items-center gap-1 text-xs text-gray-600"><User className="h-3 w-3 shrink-0" />{s.employee.firstName} {s.employee.lastName}</span>
          : <span className="text-gray-300 text-xs">—</span>}
      </td>
      {/* Attendance % */}
      <td className="px-3 py-2.5 whitespace-nowrap">
        <AttendancePct attendances={s.attendances ?? []} />
      </td>
      {/* Assignment */}
      <td className="px-3 py-2.5 whitespace-nowrap">
        <AssignmentBadge assignments={assignments} />
      </td>
      <td className="px-3 py-2.5 max-w-[120px] hidden lg:table-cell">
        <p className="text-xs text-gray-500 truncate" title={s.topics ?? ""}>
          {s.topics || <span className="text-gray-300">—</span>}
        </p>
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          <StatusBadge status={s.status} />
          {s.mode === "ONLINE"
            ? <span className="text-[10px] font-semibold rounded-full px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100">🌐 Online</span>
            : <span className="text-[10px] font-semibold rounded-full px-2 py-0.5 bg-slate-50 text-slate-500 border border-slate-200">🏫 Offline</span>
          }
          {s.recurrenceId && (
            <span
              className="text-[10px] font-semibold rounded-full px-2 py-0.5 bg-violet-50 text-violet-700 border border-violet-100 inline-flex items-center gap-1"
              title="Part of a repeating series"
            >
              <Repeat className="h-2.5 w-2.5" /> Series
            </span>
          )}
        </div>
      </td>
      {canEdit && (
        <td className="px-3 py-2.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => onEdit(s)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 border-0 bg-transparent cursor-pointer" title="Edit">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            {s.status === "UPCOMING" && (
              <button onClick={() => onStatus(s.id, "CANCELLED")} className="p-1.5 rounded hover:bg-amber-50 text-gray-400 hover:text-amber-500 border-0 bg-transparent cursor-pointer" title="Cancel">
                <XCircle className="h-3.5 w-3.5" />
              </button>
            )}
            <button onClick={() => onDelete(s)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 border-0 bg-transparent cursor-pointer" title="Delete">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </td>
      )}
    </tr>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

function SchedulePage() {
  const { user }     = useAuthStore();
  const searchParams = useSearchParams();
  const teacherId    = searchParams.get("teacherId");
  const qc           = useQueryClient();
  const permissions  = usePermissions();
  // Write access comes from the permission matrix; only SUPER_ADMIN bypasses it
  const canEdit = hasAcademicsAction(user?.role, permissions, "STU_TIMETABLE", "canEdit");

  const [view,           setView]           = useState("ALL");
  const [filterStatus,   setFilterStatus]   = useState("ALL");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo,   setFilterDateTo]   = useState("");
  const [filterYear,     setFilterYear]     = useState("");
  const [filterBatch,    setFilterBatch]    = useState("");
  const [filterGrade,    setFilterGrade]    = useState("");
  const [filterFaculty,    setFilterFaculty]    = useState("");
  const [filterLocation,   setFilterLocation]   = useState("");
  const [filterAttendance, setFilterAttendance] = useState("ALL"); // ALL | COMPLETE | INCOMPLETE
  const [filterAssignment, setFilterAssignment] = useState("ALL"); // ALL | COMPLETE | INCOMPLETE

  const [showStats,         setShowStats]         = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [modalOpen,         setModalOpen]          = useState(false);
  const [editTarget,        setEditTarget]          = useState<any | null>(null);
  const [deleteTarget,      setDeleteTarget]        = useState<any | null>(null);
  const [deleteSeries,      setDeleteSeries]        = useState(false);
  const [searchQuery,       setSearchQuery]         = useState("");
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);
  const [collapsedDates, setCollapsedDates] = useState<Set<string>>(new Set());

  const { data: yearsData }     = useQuery({ queryKey: ["academic-years"],   queryFn: () => api.get("/api/v1/academics/academic-years").then((r) => r.data.data) });
  const { data: gradesData }    = useQuery({ queryKey: ["grades"],           queryFn: () => api.get("/api/v1/academics/grades").then((r) => r.data) });
  const { data: locationsData } = useQuery({ queryKey: ["locations"],        queryFn: () => api.get("/api/v1/academics/locations").then((r) => r.data) });
  const { data: subjectsData }  = useQuery({ queryKey: ["subjects"],         queryFn: () => api.get("/api/v1/academics/subjects").then((r) => r.data.data) });
  const { data: batchesData }   = useQuery({ queryKey: ["batches-all"],      queryFn: () => api.get("/api/v1/academics/batches").then((r) => r.data) });
  const { data: empData }       = useQuery({ queryKey: ["employees-lookup"], queryFn: () => api.get("/api/v1/employees/lookup").then((r) => r.data) });

  const years     = (yearsData            ?? []) as any[];
  const grades    = (gradesData?.data     ?? []) as any[];
  const locations = (locationsData?.data  ?? []) as any[];
  const subjects  = (subjectsData ?? []) as any[];
  const batches   = (batchesData?.data    ?? []) as any[];
  const employees = (empData?.data        ?? []) as any[];

  useEffect(() => {
    if (filterYear || years.length === 0) return;
    const active = years.find((y) => y.isActive && !y.isArchived) ?? years.find((y) => !y.isArchived);
    if (active) setFilterYear(active.name);
  }, [years]); // eslint-disable-line react-hooks/exhaustive-deps

  const defaultYear = years.find((y) => y.isActive && !y.isArchived)?.name ?? years.find((y) => !y.isArchived)?.name ?? "";

  const params = new URLSearchParams();
  if (view !== "ALL")         params.set("view",         view);
  if (filterStatus !== "ALL") params.set("status",       filterStatus);
  if (filterDateFrom)         params.set("dateFrom",     filterDateFrom);
  if (filterDateTo)           params.set("dateTo",       filterDateTo);
  if (filterYear)             params.set("academicYear", filterYear);
  if (filterBatch)            params.set("batchId",      filterBatch);
  if (filterGrade)            params.set("gradeId",      filterGrade);
  // If scoped to a teacher, use their ID as employeeId filter (unless admin overrode it)
  if (teacherId && !filterFaculty) params.set("employeeId", teacherId);
  else if (filterFaculty)          params.set("employeeId", filterFaculty);
  if (filterLocation)         params.set("locationId",   filterLocation);
  params.set("limit", "200");

  const { data: scheduleData, isLoading } = useQuery({
    queryKey: ["schedules", params.toString()],
    queryFn:  () => api.get(`/api/v1/academics/schedules?${params.toString()}`).then((r) => r.data),
  });

  const statsParams = new URLSearchParams(params);
  statsParams.delete("view");
  statsParams.set("limit", "2000");

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ["schedules-stats", statsParams.toString()],
    queryFn:  () => api.get(`/api/v1/academics/schedules?${statsParams.toString()}`).then((r) => r.data),
    enabled:  showStats,
  });

  const schedules: any[]    = scheduleData?.data ?? [];
  const allSchedules: any[] = statsData?.data    ?? [];

  const todayStr2   = format(new Date(), "yyyy-MM-dd");
  const weekStart  = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd    = endOfWeek(new Date(),   { weekStartsOn: 1 });
  const todayCount    = schedules.filter((s) => format(parseISO(s.date), "yyyy-MM-dd") === todayStr2).length;
  const weekCount     = schedules.filter((s) => { const d = parseISO(s.date); return d >= weekStart && d <= weekEnd; }).length;
  const facultyCount  = new Set(schedules.map((s: any) => s.employeeId).filter(Boolean)).size;
  const roomsCount    = new Set(schedules.map((s: any) => s.locationId).filter(Boolean)).size;

  const displayedSchedules = schedules.filter((s: any) => {
    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const batchNames = s.batches?.map((sb: any) => sb.batch?.name ?? "").join(" ") ?? "";
      const faculty    = s.employee ? `${s.employee.firstName} ${s.employee.lastName}` : "";
      const matches =
        batchNames.toLowerCase().includes(q) ||
        (s.subject?.name ?? "").toLowerCase().includes(q) ||
        faculty.toLowerCase().includes(q) ||
        (s.topics ?? "").toLowerCase().includes(q) ||
        (s.location?.name ?? "").toLowerCase().includes(q);
      if (!matches) return false;
    }
    // Attendance filter
    if (filterAttendance !== "ALL") {
      const marked = (s.attendances ?? []).length > 0;
      if (filterAttendance === "COMPLETE"   && !marked) return false;
      if (filterAttendance === "INCOMPLETE" &&  marked) return false;
    }
    // Assignment filter
    if (filterAssignment !== "ALL") {
      const hasAssignment = (s.assignments ?? []).length > 0;
      if (filterAssignment === "COMPLETE"   && !hasAssignment) return false;
      if (filterAssignment === "INCOMPLETE" &&  hasAssignment) return false;
    }
    return true;
  });

  const grouped = displayedSchedules.reduce<Record<string, any[]>>((acc, s) => {
    const k = groupKey(s.date);
    if (!acc[k]) acc[k] = [];
    acc[k].push(s);
    return acc;
  }, {});
  const dateKeys = Object.keys(grouped).sort().reverse();

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/api/v1/academics/schedules/${id}/status`, { status }).then((r) => r.data),
    onSuccess: (res) => {
      if (!res.success) { toast.error(res.error); return; }
      qc.invalidateQueries({ queryKey: ["schedules"] });
      toast.success("Status updated");
    },
  });
  const deleteMut = useMutation({
    mutationFn: ({ id, series }: { id: string; series: boolean }) =>
      api.delete(`/api/v1/academics/schedules/${id}${series ? "?scope=series" : ""}`).then((r) => r.data),
    onSuccess: (res) => {
      if (!res.success) { toast.error(res.error); return; }
      qc.invalidateQueries({ queryKey: ["schedules"] });
      const n = res.data?.deleted ?? 1;
      toast.success(n > 1 ? `${n} classes deleted` : "Schedule deleted");
      setDeleteTarget(null);
    },
  });

  const openEdit = (s: any) => {
    const d = new Date(s.date), st = new Date(s.startTime), et = new Date(s.endTime);
    setEditTarget({
      id: s.id,
      form: {
        academicYear: s.academicYear,
        batchIds:  s.batches?.map((sb: any) => sb.batchId) ?? [],
        subjectId: s.subjectId ?? "", employeeId: s.employeeId ?? "", locationId: s.locationId ?? "",
        mode: (s.mode ?? "OFFLINE") as "ONLINE" | "OFFLINE",
        date:      d.toISOString().split("T")[0],
        startTime: `${String(st.getHours()).padStart(2, "0")}:${String(st.getMinutes()).padStart(2, "0")}`,
        endTime:   `${String(et.getHours()).padStart(2, "0")}:${String(et.getMinutes()).padStart(2, "0")}`,
        topics: s.topics ?? "", notes: s.notes ?? "",
      },
    });
    setModalOpen(true);
  };

  const exportCSV = () => {
    const headers = ["Date","Day","Start","End","Duration","Batches","Subject","Faculty","Topics","Attendance%","Assignments","Status"];
    const rows = schedules.map((s) => {
      const atts = s.attendances ?? [];
      const pct  = atts.length > 0 ? Math.round((atts.filter((a: any) => a.isPresent).length / atts.length) * 100) + "%" : "—";
      return [
        format(parseISO(s.date), "dd/MM/yyyy"), format(parseISO(s.date), "EEEE"),
        fmtTime(s.startTime), fmtTime(s.endTime), calcDuration(s.startTime, s.endTime),
        s.batches?.map((sb: any) => sb.batch?.name).join(" | ") ?? "",
        s.subject?.name ?? "",
        s.employee ? `${s.employee.firstName} ${s.employee.lastName}` : "",
        s.topics ?? "", pct, s.assignments?.length ?? 0, s.status,
      ];
    });
    const csv  = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a"); a.href = url; a.download = "schedules.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const hasFilters = view !== "ALL" || filterStatus !== "ALL" || filterDateFrom || filterDateTo ||
    filterYear || filterBatch || filterGrade || filterFaculty || filterLocation ||
    filterAttendance !== "ALL" || filterAssignment !== "ALL";
  const clearFilters = () => {
    setView("ALL"); setFilterStatus("ALL"); setFilterDateFrom(""); setFilterDateTo("");
    setFilterYear(""); setFilterBatch(""); setFilterGrade(""); setFilterFaculty(""); setFilterLocation("");
    setFilterAttendance("ALL"); setFilterAssignment("ALL");
  };

  const filterLabelStyle: React.CSSProperties = {
    display: "block", marginBottom: 8, color: "#4b5563", fontSize: 13, fontWeight: 850,
  };

  const filterPanel = (
    <div style={{ display: "grid", gap: 20 }}>
      <div>
        <p style={filterLabelStyle}>Show</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {(["ALL", "UPCOMING", "PAST"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                minHeight: 34, borderRadius: 999, padding: "0 13px",
                border: `1px solid ${view === v ? D.nav2 : D.line}`,
                background: view === v ? D.nav2 : "white",
                color: view === v ? "white" : "#4b5563",
                fontSize: 13, fontWeight: 850, cursor: "pointer", font: "inherit",
              }}
            >
              {v === "ALL" ? "All" : v === "UPCOMING" ? "Upcoming" : "Past"}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label style={filterLabelStyle}>Status</label>
        <DSelect value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="ALL">All statuses</option>
          <option value="UPCOMING">Upcoming</option>
          <option value="COMPLETED">Completed</option>
          <option value="CONCLUDED">Concluded</option>
          <option value="CANCELLED">Cancelled</option>
        </DSelect>
      </div>

      <div>
        <label style={filterLabelStyle}>Date Range</label>
        <DInput type="date" max="2099-12-31" min="1900-01-01" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} />
        <DInput type="date" max="2099-12-31" min="1900-01-01" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} style={{ marginTop: 8 }} />
      </div>

      <div>
        <label style={filterLabelStyle}>Academic Year</label>
        <DSelect value={filterYear} onChange={(e) => { setFilterYear(e.target.value); setFilterBatch(""); }}>
          <option value="">All years</option>
          {years.filter((y) => !y.isArchived).map((y) => (
            <option key={y.id} value={y.name}>{y.name}</option>
          ))}
        </DSelect>
      </div>

      <div>
        <label style={filterLabelStyle}>Batch</label>
        <DSelect value={filterBatch} onChange={(e) => setFilterBatch(e.target.value)}>
          <option value="">All batches</option>
          {(filterYear ? batches.filter((b) => b.academicYear === filterYear) : batches).map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </DSelect>
      </div>

      <div>
        <label style={filterLabelStyle}>Grade</label>
        <DSelect value={filterGrade} onChange={(e) => setFilterGrade(e.target.value)}>
          <option value="">All grades</option>
          {grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </DSelect>
      </div>

      <div>
        <label style={filterLabelStyle}>Faculty</label>
        <DSelect value={filterFaculty} onChange={(e) => setFilterFaculty(e.target.value)}>
          <option value="">All faculty</option>
          {employees.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
        </DSelect>
      </div>

      <div>
        <label style={filterLabelStyle}>Location</label>
        <DSelect value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)}>
          <option value="">All locations</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </DSelect>
      </div>

      <div>
        <label style={filterLabelStyle}>Attendance</label>
        <DSelect value={filterAttendance} onChange={(e) => setFilterAttendance(e.target.value)}>
          <option value="ALL">All</option>
          <option value="COMPLETE">Marked</option>
          <option value="INCOMPLETE">Not Marked</option>
        </DSelect>
      </div>

      <div>
        <label style={filterLabelStyle}>Assignment</label>
        <DSelect value={filterAssignment} onChange={(e) => setFilterAssignment(e.target.value)}>
          <option value="ALL">All</option>
          <option value="COMPLETE">Given</option>
          <option value="INCOMPLETE">Not Given</option>
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

      {/* Page head */}
      <div
        className="bg-white border-b shrink-0 flex flex-wrap items-center justify-between gap-4"
        style={{ borderColor: D.line, padding: "22px 32px" }}
      >
        <div className="flex items-center gap-[14px]">
          <div style={{
            width: 44, height: 44, borderRadius: 14, display: "grid", placeItems: "center",
            background: "#eef2ff", color: D.nav2, fontWeight: 900, fontSize: 15, flexShrink: 0,
          }}>SC</div>
          <div>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, lineHeight: 1.15, color: D.ink }}>Schedule</h1>
            <p style={{ margin: "5px 0 0", color: D.muted, fontWeight: 700, fontSize: 14 }}>
              Lecture timetables and faculty scheduling
            </p>
          </div>
        </div>
        <div className="flex items-center flex-wrap gap-[10px]">
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
              <span>New Schedule</span>
            </DBtn>
          )}
        </div>
      </div>

      {/* Layout */}
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
                <button onClick={() => setMobileFiltersOpen(false)} className="p-1 rounded hover:bg-gray-100 border-0 bg-transparent cursor-pointer">
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
              statsLoading ? (
                <div className="flex items-center justify-center h-40">
                  <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
                </div>
              ) : (
                <StatsPanel schedules={allSchedules} subjects={subjects} />
              )
            ) : (
              <>
                {/* Toolbar */}
                <div
                  className="grid items-center gap-[14px] mb-[18px]"
                  style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}
                >
                  <div style={{
                    minHeight: 48, borderRadius: 14, border: `1px solid ${D.line}`, background: "white",
                    display: "flex", alignItems: "center", gap: 10, padding: "0 16px",
                  }}>
                    <Search style={{ width: 18, height: 18, color: D.muted, flexShrink: 0 }} />
                    <input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by batch, subject, faculty, topic, or location…"
                      style={{
                        flex: 1, border: 0, outline: "none", background: "transparent",
                        fontSize: 14, fontWeight: 700, color: D.ink, fontFamily: "inherit",
                        minWidth: 0,
                      }}
                    />
                    {searchQuery && (
                      <button onClick={() => setSearchQuery("")} className="border-0 bg-transparent cursor-pointer p-0 flex items-center">
                        <X style={{ width: 15, height: 15, color: D.muted }} />
                      </button>
                    )}
                  </div>
                  <span style={{ color: D.muted, fontWeight: 850, whiteSpace: "nowrap", fontSize: 14 }}>
                    {displayedSchedules.length} schedule{displayedSchedules.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {/* Stat cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-[14px] mb-[18px]">
                  {[
                    { label: "Today",            value: todayCount   },
                    { label: "This Week",         value: weekCount    },
                    { label: "Faculty Assigned",  value: facultyCount },
                    { label: "Rooms Booked",      value: roomsCount   },
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
                  <div className="flex items-center justify-center h-40">
                    <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
                  </div>
                ) : dateKeys.length === 0 ? (
                  <>
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
                        }}>SC</div>
                        <h2 style={{ margin: 0, fontSize: 22, color: D.ink }}>No schedules found</h2>
                        <p style={{ margin: "8px auto 18px", color: D.muted, maxWidth: 470, lineHeight: 1.5, fontWeight: 600 }}>
                          Create a lecture schedule, assign faculty, select a batch and location, and track upcoming classes from this workspace.
                        </p>
                        {canEdit && (
                          <DBtn primary onClick={() => { setEditTarget(null); setModalOpen(true); }} style={{ margin: "0 auto" }}>
                            <Plus style={{ width: 16, height: 16 }} />
                            Create Schedule
                          </DBtn>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-[14px]" style={{ marginTop: 18 }}>
                      {[
                        { title: "Attendance Tracking", desc: "Click any session to mark attendance for all students." },
                        { title: "Assignment Linking",   desc: "Create and link assignments directly from the session." },
                        { title: "Faculty Load",         desc: "Check conflicts before assigning classes." },
                      ].map(({ title, desc }) => (
                        <div key={title} style={{ background: "white", border: `1px solid ${D.line}`, borderRadius: 16, padding: 18 }}>
                          <strong style={{ display: "block", fontSize: 15, color: D.ink }}>{title}</strong>
                          <span style={{ display: "block", color: D.muted, marginTop: 5, fontSize: 13, fontWeight: 700 }}>{desc}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                    {dateKeys.map((dateKey) => {
                      const isCollapsed = collapsedDates.has(dateKey);
                      const toggleCollapse = () => {
                        setCollapsedDates((prev) => {
                          const next = new Set(prev);
                          if (next.has(dateKey)) next.delete(dateKey); else next.add(dateKey);
                          return next;
                        });
                      };
                      return (
                        <div key={dateKey}>
                          <div
                            className="flex items-center gap-3"
                            style={{ marginBottom: isCollapsed ? 0 : 8, cursor: "pointer", userSelect: "none" }}
                            onClick={toggleCollapse}
                          >
                            <div style={{
                              width: 24, height: 24, borderRadius: "50%", background: "#eef2ff",
                              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                            }}>
                              <Calendar style={{ width: 14, height: 14, color: "#4f46e5" }} />
                            </div>
                            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: D.ink }}>
                              {fmtDateHeading(dateKey)}
                            </h3>
                            <span style={{
                              fontSize: 12, color: D.muted, background: "#f1f5f9",
                              borderRadius: 999, padding: "2px 10px", flexShrink: 0,
                            }}>
                              {grouped[dateKey].length} lecture{grouped[dateKey].length !== 1 ? "s" : ""}
                            </span>
                            <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
                            {isCollapsed
                              ? <ChevronRight style={{ width: 16, height: 16, color: D.muted, flexShrink: 0 }} />
                              : <ChevronDown  style={{ width: 16, height: 16, color: D.muted, flexShrink: 0 }} />
                            }
                          </div>
                          {!isCollapsed && (
                            <div style={{
                              background: "white", borderRadius: 18, border: `1px solid ${D.line}`,
                              boxShadow: "0 8px 22px rgba(20,23,53,.05)", overflow: "hidden",
                            }}>
                              <div style={{ overflowX: "auto" }}>
                                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                  <thead>
                                    <tr style={{ borderBottom: `1px solid ${D.line}`, background: "#f8fafc" }}>
                                      <th className="px-3 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wide text-left">Time</th>
                                      <th className="px-3 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wide text-left">Dur.</th>
                                      <th className="px-3 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wide text-left">Batch(es)</th>
                                      <th className="px-3 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wide text-left">Subject</th>
                                      <th className="px-3 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wide text-left">Faculty</th>
                                      <th className="px-3 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wide text-left">
                                        <span className="flex items-center gap-1"><Percent style={{ width: 10, height: 10 }} />Attend.</span>
                                      </th>
                                      <th className="px-3 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wide text-left">
                                        <span className="flex items-center gap-1"><ClipboardList style={{ width: 10, height: 10 }} />Assign.</span>
                                      </th>
                                      <th className="px-3 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wide text-left hidden lg:table-cell">Topics</th>
                                      <th className="px-3 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wide text-left">Status</th>
                                      {canEdit && <th className="px-3 py-2 w-28" />}
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-50">
                                    {grouped[dateKey].map((s) => (
                                      <ScheduleRow
                                        key={s.id} s={s} canEdit={canEdit}
                                        onEdit={openEdit}
                                        onDelete={(row) => { setDeleteSeries(false); setDeleteTarget(row); }}
                                        onStatus={(id, status) => statusMut.mutate({ id, status })}
                                        onClick={(s) => setSelectedScheduleId(s.id)}
                                      />
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>

      {/* Schedule create/edit modal */}
      <ScheduleModal
        key={editTarget?.id ?? "new"}
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditTarget(null); }}
        initial={editTarget?.form} scheduleId={editTarget?.id} defaultYear={defaultYear}
        batches={batches} subjects={subjects} employees={employees}
        locations={locations} academicYears={years}
      />

      {/* Detail modal */}
      <ScheduleDetailModal
        scheduleId={selectedScheduleId}
        onClose={() => setSelectedScheduleId(null)}
        batches={batches}
        subjects={subjects}
        employees={employees}
        academicYears={years}
        canEdit={canEdit}
      />

      {/* Delete confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div style={{
            background: "white", borderRadius: 22, boxShadow: "0 32px 90px rgba(0,0,0,.28)",
            width: "100%", maxWidth: 380, padding: 28, textAlign: "center",
          }}>
            <div style={{
              width: 48, height: 48, background: "#fef2f2", borderRadius: "50%",
              display: "grid", placeItems: "center", margin: "0 auto 14px",
            }}>
              <Trash2 style={{ width: 20, height: 20, color: "#ef4444" }} />
            </div>
            <h3 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 700, color: D.ink }}>Delete Schedule?</h3>
            <p style={{ margin: "0 0 18px", fontSize: 14, color: D.muted }}>This action cannot be undone.</p>
            {deleteTarget.recurrenceId && (
              <div style={{ margin: "0 0 18px", padding: 12, borderRadius: 12, background: "#f5f3ff", border: "1px solid #ddd6fe", textAlign: "left" }}>
                <p style={{ margin: "0 0 8px", fontSize: 13, color: "#4c1d95" }}>
                  This class is part of a repeating series.
                </p>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={deleteSeries}
                    onChange={(e) => setDeleteSeries(e.target.checked)}
                    style={{ width: 15, height: 15, marginTop: 2, accentColor: "#6d28d9" }}
                  />
                  <span style={{ fontSize: 13, color: "#4c1d95" }}>
                    Delete every upcoming class in the series. Past classes are kept so their attendance survives.
                  </span>
                </label>
              </div>
            )}
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <DBtn onClick={() => setDeleteTarget(null)}>Cancel</DBtn>
              <button
                onClick={() => deleteMut.mutate({ id: deleteTarget.id, series: deleteSeries && Boolean(deleteTarget.recurrenceId) })}
                disabled={deleteMut.isPending}
                style={{
                  minHeight: 42, border: 0, borderRadius: 12, padding: "0 18px",
                  background: "#dc2626", color: "white", fontWeight: 850, font: "inherit",
                  cursor: deleteMut.isPending ? "not-allowed" : "pointer",
                  opacity: deleteMut.isPending ? 0.5 : 1,
                  display: "inline-flex", alignItems: "center", gap: 6,
                }}
              >
                {deleteMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SchedulePageWrapped() {
  return <Suspense fallback={null}><SchedulePage /></Suspense>;
}
