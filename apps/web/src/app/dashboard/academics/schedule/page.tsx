"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  Plus, X, Calendar, MapPin, User,
  ChevronDown, Filter, Download, SlidersHorizontal,
  CheckCircle2, XCircle, Loader2, Pencil, Trash2,
  CalendarDays, BarChart2, AlertTriangle,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { format, parseISO } from "date-fns";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ComposedChart, Area, PieChart, Pie, Cell,
} from "recharts";

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

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-medium text-gray-600 mb-1">{children}</label>;
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    UPCOMING:  "bg-blue-50 text-blue-700 border border-blue-200",
    COMPLETED: "bg-green-50 text-green-700 border border-green-200",
    CANCELLED: "bg-red-50 text-red-700 border border-red-200",
  };
  const label: Record<string, string> = {
    UPCOMING: "Upcoming", COMPLETED: "Completed", CANCELLED: "Cancelled",
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

// ── Multi-batch selector ──────────────────────────────────────────────────────

function BatchMultiSelect({
  batches, selected, onChange,
}: {
  batches: any[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
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
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500">
        <span className="truncate text-left flex-1 min-w-0">
          {selected.length === 0 ? <span className="text-gray-400">Select batches…</span> : selectedNames}
        </span>
        <ChevronDown className={`h-4 w-4 text-gray-400 shrink-0 ml-1 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
          <div className="max-h-48 overflow-y-auto">
            {batches.length === 0 && (
              <p className="px-3 py-2 text-xs text-gray-400">No batches available for this year</p>
            )}
            {batches.map((b) => (
              <label key={b.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                <input type="checkbox" checked={selected.includes(b.id)} onChange={() => toggle(b.id)} className="accent-indigo-600" />
                <span className="text-sm text-gray-700">{b.name}</span>
                {b.grade && <span className="text-xs text-gray-400 ml-auto shrink-0">{b.grade.name}</span>}
              </label>
            ))}
          </div>
          <div className="border-t border-gray-100 px-3 py-2 flex items-center justify-between">
            <span className="text-xs text-gray-400">{selected.length} selected</span>
            <button type="button" onClick={() => setOpen(false)}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-800 px-2 py-0.5 rounded hover:bg-indigo-50 transition-colors">
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Stats helpers ─────────────────────────────────────────────────────────────

const CHART_COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#14b8a6", "#f59e0b", "#10b981", "#3b82f6", "#f97316", "#a855f7", "#06b6d4"];

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
            {typeof p.value === "number" ? (p.name?.toLowerCase().includes("hour") ? p.value.toFixed(1) : p.value) : p.value}
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

  // ── 1. Batch stats ──────────────────────────────────────────────────────────
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

  // ── 2. Batch-subject stats ──────────────────────────────────────────────────
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
  // Top 8 subjects by total count
  const subjectTotals: Record<string, number> = {};
  for (const e of bsMap.values()) subjectTotals[e.subjectName] = (subjectTotals[e.subjectName] ?? 0) + e.count;
  const topSubjects = Object.entries(subjectTotals).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([n]) => n);

  // Unique subjectId per subjectName
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

  // ── 3. Monthly trend ────────────────────────────────────────────────────────
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

  // ── 4. Status breakdown ─────────────────────────────────────────────────────
  const sc = { UPCOMING: 0, COMPLETED: 0, CANCELLED: 0 };
  for (const s of schedules) if (s.status in sc) sc[s.status as keyof typeof sc]++;
  const statusData = [
    { name: "Upcoming",  value: sc.UPCOMING,  color: "#6366f1" },
    { name: "Completed", value: sc.COMPLETED, color: "#10b981" },
    { name: "Cancelled", value: sc.CANCELLED, color: "#ef4444" },
  ];

  // ── 5. Faculty load ─────────────────────────────────────────────────────────
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

  // ── Summary numbers ─────────────────────────────────────────────────────────
  const totalLectures   = schedules.length;
  const totalHours      = parseFloat(schedules.reduce((s, x) => s + lectureDurationHours(x), 0).toFixed(1));
  const completionRate  = totalLectures > 0 ? Math.round((sc.COMPLETED / totalLectures) * 100) : 0;
  const avgHrs          = totalLectures > 0 ? (totalHours / totalLectures).toFixed(1) : "0.0";

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

      {/* ── Summary row ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard label="Total Lectures"  value={totalLectures}     sub="all statuses"                  color="indigo" />
        <SummaryCard label="Total Hours"     value={`${totalHours}h`}  sub="teaching time"                 color="violet" />
        <SummaryCard label="Completion Rate" value={`${completionRate}%`} sub={`${sc.COMPLETED} completed`} color="green"  />
        <SummaryCard label="Avg Duration"    value={`${avgHrs}h`}      sub="per lecture"                   color="amber"  />
      </div>

      {/* ── Row: Batch overview + Status donut ───────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Batch overview (2/3) */}
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

        {/* Status donut (1/3) */}
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

      {/* ── Subject distribution ──────────────────────────────────────────────── */}
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

      {/* ── Monthly trend ────────────────────────────────────────────────────── */}
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

      {/* ── Faculty load ─────────────────────────────────────────────────────── */}
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

type ScheduleForm = {
  academicYear: string; batchIds: string[]; subjectId: string; employeeId: string;
  locationId: string; date: string; startTime: string; endTime: string; topics: string; notes: string;
};

function ScheduleModal({
  open, onClose, initial, scheduleId, batches, subjects, employees, locations, academicYears, defaultYear,
}: {
  open: boolean; onClose: () => void; initial?: ScheduleForm; scheduleId?: string;
  batches: any[]; subjects: any[]; employees: any[]; locations: any[]; academicYears: any[]; defaultYear: string;
}) {
  const qc = useQueryClient();
  const emptyForm = (): ScheduleForm => ({
    academicYear: defaultYear, batchIds: [], subjectId: "", employeeId: "",
    locationId: "", date: "", startTime: "", endTime: "", topics: "", notes: "",
  });
  const [form, setForm] = useState<ScheduleForm>(initial ?? emptyForm());

  useEffect(() => {
    if (open) setForm(initial ?? emptyForm());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const filteredBatches = form.academicYear ? batches.filter((b) => b.academicYear === form.academicYear) : batches;

  const endTimeError = Boolean(
    form.date && form.startTime && form.endTime &&
    new Date(`${form.date}T${form.endTime}`) <= new Date(`${form.date}T${form.startTime}`)
  );

  // Faculty conflict detection
  const conflictEnabled = Boolean(form.employeeId && form.date && form.startTime && form.endTime && !endTimeError);
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

  const createMut = useMutation({
    mutationFn: (d: any) => api.post("/api/v1/academics/schedules", d).then((r) => r.data),
    onSuccess: (res) => { if (!res.success) { toast.error(res.error); return; } qc.invalidateQueries({ queryKey: ["schedules"] }); toast.success("Schedule created"); },
  });
  const updateMut = useMutation({
    mutationFn: (d: any) => api.patch(`/api/v1/academics/schedules/${scheduleId}`, d).then((r) => r.data),
    onSuccess: (res) => { if (!res.success) { toast.error(res.error); return; } qc.invalidateQueries({ queryKey: ["schedules"] }); toast.success("Schedule updated"); onClose(); },
  });
  const busy = createMut.isPending || updateMut.isPending;

  const buildPayload = () => {
    if (!form.academicYear) { toast.error("Academic year is required"); return null; }
    if (form.batchIds.length === 0) { toast.error("Select at least one batch"); return null; }
    if (!form.date) { toast.error("Date is required"); return null; }
    if (!form.startTime || !form.endTime) { toast.error("Start and end time required"); return null; }
    if (endTimeError) { toast.error("End time must be after start time"); return null; }
    const startDT = new Date(`${form.date}T${form.startTime}`);
    const endDT   = new Date(`${form.date}T${form.endTime}`);
    return {
      academicYear: form.academicYear, batchIds: form.batchIds,
      subjectId: form.subjectId || null, employeeId: form.employeeId || null, locationId: form.locationId || null,
      date: new Date(form.date).toISOString(), startTime: startDT.toISOString(), endTime: endDT.toISOString(),
      topics: form.topics || undefined, notes: form.notes || undefined,
    };
  };

  const handleSave = () => {
    const p = buildPayload(); if (!p) return;
    if (scheduleId) updateMut.mutate(p);
    else createMut.mutate(p, { onSuccess: (res) => { if (res.success) onClose(); } });
  };
  const handleSaveAnother = () => {
    const p = buildPayload(); if (!p) return;
    createMut.mutate(p, { onSuccess: (res) => { if (res.success) setForm({ ...emptyForm(), academicYear: form.academicYear, date: form.date }); } });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-100 rounded-lg"><CalendarDays className="h-4 w-4 text-indigo-600" /></div>
            <h2 className="text-base font-semibold text-gray-900">{scheduleId ? "Edit Schedule" : "New Schedule"}</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-400"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <Label>Academic Year <span className="text-red-400">*</span></Label>
            <FSelect value={form.academicYear} onChange={(e) => setForm({ ...form, academicYear: e.target.value, batchIds: [] })}>
              <option value="">Select academic year</option>
              {academicYears.filter((y) => !y.isArchived).map((y) => <option key={y.id} value={y.name}>{y.name}</option>)}
            </FSelect>
          </div>
          <div>
            <Label>Batch(es) <span className="text-red-400">*</span></Label>
            <BatchMultiSelect batches={filteredBatches} selected={form.batchIds} onChange={(ids) => setForm({ ...form, batchIds: ids })} />
            {form.batchIds.length > 0 && (
              <p className="text-xs text-indigo-600 mt-1">{form.batchIds.length} batch{form.batchIds.length > 1 ? "es" : ""} selected</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Subject</Label>
              <FSelect value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })}>
                <option value="">Select subject</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </FSelect>
            </div>
            <div>
              <Label>Faculty</Label>
              <FSelect value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}>
                <option value="">Select faculty</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
              </FSelect>
            </div>
          </div>
          {conflictWarnings.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
              <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-red-700">Faculty conflict detected</p>
                <p className="text-xs text-red-600 mt-0.5">
                  {employees.find((e) => e.id === form.employeeId)
                    ? `${employees.find((e) => e.id === form.employeeId)!.firstName} ${employees.find((e) => e.id === form.employeeId)!.lastName}`
                    : "This faculty"} already has a class at this time with:{" "}
                  {conflictWarnings.join("; ")}
                </p>
              </div>
            </div>
          )}
          <div>
            <Label>Date <span className="text-red-400">*</span></Label>
            <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Start Time <span className="text-red-400">*</span></Label>
              <Input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
            </div>
            <div>
              <Label>End Time <span className="text-red-400">*</span></Label>
              <input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${endTimeError ? "border-red-400 focus:border-red-400 focus:ring-red-300 bg-red-50" : "border-gray-200 focus:border-indigo-500 focus:ring-indigo-500"}`}
              />
              {endTimeError && <p className="text-xs text-red-500 mt-1">End time must be after start time</p>}
            </div>
          </div>
          {form.startTime && form.endTime && form.date && !endTimeError && (
            <p className="text-xs text-gray-400 -mt-2">
              Duration: {calcDuration(new Date(`${form.date}T${form.startTime}`).toISOString(), new Date(`${form.date}T${form.endTime}`).toISOString())}
            </p>
          )}
          <div>
            <Label>Location</Label>
            <FSelect value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })}>
              <option value="">Select location</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </FSelect>
          </div>
          <div>
            <Label>Topics</Label>
            <Input placeholder="e.g. Quadratic Equations, Chapter 5" value={form.topics} onChange={(e) => setForm({ ...form, topics: e.target.value })} />
          </div>
          <div>
            <Label>Notes</Label>
            <textarea rows={2} placeholder="Additional notes…" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none" />
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 px-6 pb-5 pt-2 border-t border-gray-100">
          <button onClick={onClose} disabled={busy} className="px-4 py-2 text-sm text-gray-500 rounded-lg hover:bg-gray-100 transition-colors">Cancel</button>
          <div className="flex items-center gap-2">
            {!scheduleId && (
              <button onClick={handleSaveAnother} disabled={busy || endTimeError}
                className="px-4 py-2 text-sm text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors disabled:opacity-50">
                Save & Add Another
              </button>
            )}
            <button onClick={handleSave} disabled={busy || endTimeError}
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50">
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {scheduleId ? "Save Changes" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Schedule row ──────────────────────────────────────────────────────────────

function ScheduleRow({ s, canEdit, onEdit, onDelete, onStatus }: {
  s: any; canEdit: boolean;
  onEdit: (s: any) => void; onDelete: (id: string) => void; onStatus: (id: string, status: string) => void;
}) {
  const batchNames = s.batches?.map((sb: any) => sb.batch?.name).filter(Boolean).join(", ") ?? "—";
  return (
    <tr className="hover:bg-gray-50/60 transition-colors group">
      <td className="px-3 py-2.5 whitespace-nowrap">
        <p className="text-xs font-semibold text-gray-800">{fmtTime(s.startTime)}</p>
        <p className="text-[11px] text-gray-400">{fmtTime(s.endTime)}</p>
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap">
        <span className="text-xs text-gray-500 bg-indigo-50 rounded px-1.5 py-0.5">{calcDuration(s.startTime, s.endTime)}</span>
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
      <td className="px-3 py-2.5 whitespace-nowrap">
        {s.location
          ? <span className="flex items-center gap-1 text-xs text-gray-600"><MapPin className="h-3 w-3 shrink-0" />{s.location.name}</span>
          : <span className="text-gray-300 text-xs">—</span>}
      </td>
      <td className="px-3 py-2.5 max-w-[140px] hidden lg:table-cell">
        <p className="text-xs text-gray-500 truncate" title={s.topics ?? ""}>{s.topics || <span className="text-gray-300">—</span>}</p>
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap"><StatusBadge status={s.status} /></td>
      {canEdit && (
        <td className="px-3 py-2.5 whitespace-nowrap">
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => onEdit(s)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700" title="Edit"><Pencil className="h-3.5 w-3.5" /></button>
            {s.status === "UPCOMING" && (
              <>
                <button onClick={() => onStatus(s.id, "COMPLETED")} className="p-1.5 rounded hover:bg-green-50 text-gray-400 hover:text-green-600" title="Mark Completed"><CheckCircle2 className="h-3.5 w-3.5" /></button>
                <button onClick={() => onStatus(s.id, "CANCELLED")} className="p-1.5 rounded hover:bg-amber-50 text-gray-400 hover:text-amber-500" title="Cancel"><XCircle className="h-3.5 w-3.5" /></button>
              </>
            )}
            <button onClick={() => onDelete(s.id)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        </td>
      )}
    </tr>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SchedulePage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const canEdit = user?.role === "SUPER_ADMIN" || user?.role === "HR_ADMIN";

  // Filter state
  const [view,           setView]           = useState("ALL");
  const [filterStatus,   setFilterStatus]   = useState("ALL");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo,   setFilterDateTo]   = useState("");
  const [filterYear,     setFilterYear]     = useState("");
  const [filterBatch,    setFilterBatch]    = useState("");
  const [filterGrade,    setFilterGrade]    = useState("");
  const [filterFaculty,  setFilterFaculty]  = useState("");
  const [filterLocation, setFilterLocation] = useState("");

  // UI state
  const [showStats,         setShowStats]         = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [modalOpen,         setModalOpen]          = useState(false);
  const [editTarget,        setEditTarget]          = useState<any | null>(null);
  const [deleteId,          setDeleteId]            = useState<string | null>(null);

  // Reference data
  const { data: yearsData }     = useQuery({ queryKey: ["academic-years"],   queryFn: () => api.get("/api/v1/academics/academic-years").then((r) => r.data.data) });
  const { data: gradesData }    = useQuery({ queryKey: ["grades"],           queryFn: () => api.get("/api/v1/academics/grades").then((r) => r.data) });
  const { data: locationsData } = useQuery({ queryKey: ["locations"],        queryFn: () => api.get("/api/v1/academics/locations").then((r) => r.data) });
  const { data: subjectsData }  = useQuery({ queryKey: ["subjects"],         queryFn: () => api.get("/api/v1/academics/subjects").then((r) => r.data) });
  const { data: batchesData }   = useQuery({ queryKey: ["batches-all"],      queryFn: () => api.get("/api/v1/academics/batches").then((r) => r.data) });
  const { data: empData }       = useQuery({ queryKey: ["employees-select"], queryFn: () => api.get("/api/v1/employees?limit=500").then((r) => r.data) });

  const years     = (yearsData     ?? []) as any[];
  const grades    = (gradesData?.data    ?? []) as any[];
  const locations = (locationsData?.data ?? []) as any[];
  const subjects  = (subjectsData?.data  ?? []) as any[];
  const batches   = (batchesData?.data   ?? []) as any[];
  const employees = (empData?.data       ?? []) as any[];

  // Auto-set filter to active AY
  useEffect(() => {
    if (filterYear || years.length === 0) return;
    const active = years.find((y) => y.isActive && !y.isArchived) ?? years.find((y) => !y.isArchived);
    if (active) setFilterYear(active.name);
  }, [years]); // eslint-disable-line react-hooks/exhaustive-deps

  const defaultYear = years.find((y) => y.isActive && !y.isArchived)?.name ?? years.find((y) => !y.isArchived)?.name ?? "";

  // Schedule list query (paginated)
  const params = new URLSearchParams();
  if (view !== "ALL")         params.set("view",         view);
  if (filterStatus !== "ALL") params.set("status",       filterStatus);
  if (filterDateFrom)         params.set("dateFrom",     filterDateFrom);
  if (filterDateTo)           params.set("dateTo",       filterDateTo);
  if (filterYear)             params.set("academicYear", filterYear);
  if (filterBatch)            params.set("batchId",      filterBatch);
  if (filterGrade)            params.set("gradeId",      filterGrade);
  if (filterFaculty)          params.set("employeeId",   filterFaculty);
  if (filterLocation)         params.set("locationId",   filterLocation);
  params.set("limit", "200");

  const { data: scheduleData, isLoading } = useQuery({
    queryKey: ["schedules", params.toString()],
    queryFn:  () => api.get(`/api/v1/academics/schedules?${params.toString()}`).then((r) => r.data),
  });

  // Stats query — same filters but no view/status limit, higher cap
  const statsParams = new URLSearchParams(params);
  statsParams.delete("view");
  statsParams.set("limit", "2000");

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ["schedules-stats", statsParams.toString()],
    queryFn:  () => api.get(`/api/v1/academics/schedules?${statsParams.toString()}`).then((r) => r.data),
    enabled:  showStats,
  });

  const schedules: any[] = scheduleData?.data ?? [];
  const total: number    = scheduleData?.meta?.total ?? 0;
  const allSchedules: any[] = statsData?.data ?? [];

  // Group list by date
  const grouped = schedules.reduce<Record<string, any[]>>((acc, s) => {
    const k = groupKey(s.date);
    if (!acc[k]) acc[k] = [];
    acc[k].push(s);
    return acc;
  }, {});
  const dateKeys = Object.keys(grouped).sort();

  // Mutations
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
    mutationFn: (id: string) => api.delete(`/api/v1/academics/schedules/${id}`).then((r) => r.data),
    onSuccess: (res) => {
      if (!res.success) { toast.error(res.error); return; }
      qc.invalidateQueries({ queryKey: ["schedules"] });
      toast.success("Schedule deleted");
      setDeleteId(null);
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
        date:      d.toISOString().split("T")[0],
        startTime: `${String(st.getHours()).padStart(2, "0")}:${String(st.getMinutes()).padStart(2, "0")}`,
        endTime:   `${String(et.getHours()).padStart(2, "0")}:${String(et.getMinutes()).padStart(2, "0")}`,
        topics: s.topics ?? "", notes: s.notes ?? "",
      },
    });
    setModalOpen(true);
  };

  const exportCSV = () => {
    const headers = ["Date", "Day", "Start", "End", "Duration", "Batches", "Subject", "Faculty", "Location", "Topics", "Status"];
    const rows = schedules.map((s) => [
      format(parseISO(s.date), "dd/MM/yyyy"), format(parseISO(s.date), "EEEE"),
      fmtTime(s.startTime), fmtTime(s.endTime), calcDuration(s.startTime, s.endTime),
      s.batches?.map((sb: any) => sb.batch?.name).join(" | ") ?? "",
      s.subject?.name ?? "",
      s.employee ? `${s.employee.firstName} ${s.employee.lastName}` : "",
      s.location?.name ?? "", s.topics ?? "", s.status,
    ]);
    const csv  = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a"); a.href = url; a.download = "schedules.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const hasFilters = view !== "ALL" || filterStatus !== "ALL" || filterDateFrom || filterDateTo || filterYear || filterBatch || filterGrade || filterFaculty || filterLocation;
  const clearFilters = () => {
    setView("ALL"); setFilterStatus("ALL"); setFilterDateFrom(""); setFilterDateTo("");
    setFilterYear(""); setFilterBatch(""); setFilterGrade(""); setFilterFaculty(""); setFilterLocation("");
  };

  const filterPanel = (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Show</p>
        {(["ALL", "UPCOMING", "PAST"] as const).map((v) => (
          <button key={v} onClick={() => setView(v)}
            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-sm transition-colors ${view === v ? "bg-indigo-50 text-indigo-700 font-medium" : "text-gray-600 hover:bg-gray-50"}`}>
            {v === "ALL" ? "All" : v === "UPCOMING" ? "Upcoming" : "Past"}
          </button>
        ))}
      </div>
      <div>
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Status</p>
        <FSelect value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="ALL">All Statuses</option>
          <option value="UPCOMING">Upcoming</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </FSelect>
      </div>
      <div>
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Date Range</p>
        <div className="space-y-1.5">
          <Input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} />
          <Input type="date" value={filterDateTo}   onChange={(e) => setFilterDateTo(e.target.value)}   />
        </div>
      </div>
      <div>
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Academic Year</p>
        <FSelect value={filterYear} onChange={(e) => { setFilterYear(e.target.value); setFilterBatch(""); }}>
          <option value="">All Years</option>
          {years.filter((y) => !y.isArchived).map((y) => <option key={y.id} value={y.name}>{y.name}</option>)}
        </FSelect>
      </div>
      <div>
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Batch</p>
        <FSelect value={filterBatch} onChange={(e) => setFilterBatch(e.target.value)}>
          <option value="">All Batches</option>
          {(filterYear ? batches.filter((b) => b.academicYear === filterYear) : batches).map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </FSelect>
      </div>
      <div>
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Grade</p>
        <FSelect value={filterGrade} onChange={(e) => setFilterGrade(e.target.value)}>
          <option value="">All Grades</option>
          {grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </FSelect>
      </div>
      <div>
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Faculty</p>
        <FSelect value={filterFaculty} onChange={(e) => setFilterFaculty(e.target.value)}>
          <option value="">All Faculty</option>
          {employees.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
        </FSelect>
      </div>
      <div>
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Location</p>
        <FSelect value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)}>
          <option value="">All Locations</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </FSelect>
      </div>
      {hasFilters && (
        <button onClick={clearFilters}
          className="w-full text-xs text-red-500 hover:text-red-700 py-1.5 border border-dashed border-red-200 rounded-lg hover:bg-red-50 transition-colors">
          Clear All Filters
        </button>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-full min-h-0 bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 sm:px-6 py-4 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <button className="sm:hidden p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50" onClick={() => setMobileFiltersOpen(true)}>
            <SlidersHorizontal className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-indigo-500" />
              <h1 className="text-lg font-bold text-gray-900">Schedule</h1>
              {!showStats && total > 0 && <span className="text-xs bg-indigo-100 text-indigo-700 rounded-full px-2 py-0.5 font-medium">{total}</span>}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">Lecture timetables and faculty scheduling</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Stats toggle */}
          <button onClick={() => setShowStats((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
              showStats
                ? "bg-violet-600 text-white border-violet-600 hover:bg-violet-700"
                : "text-gray-600 border-gray-200 hover:bg-gray-50"
            }`}>
            <BarChart2 className="h-4 w-4" />
            <span className="hidden sm:inline">Stats</span>
          </button>
          <button onClick={exportCSV} className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <Download className="h-4 w-4" /> Export
          </button>
          {canEdit && (
            <button onClick={() => { setEditTarget(null); setModalOpen(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New Schedule</span>
              <span className="sm:hidden">Add</span>
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Desktop sidebar */}
        <aside className="hidden sm:block w-52 shrink-0 bg-white border-r border-gray-100 overflow-y-auto p-4">
          <div className="flex items-center gap-1.5 mb-4">
            <Filter className="h-3.5 w-3.5 text-gray-400" />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Filters</span>
          </div>
          {filterPanel}
        </aside>

        {/* Mobile filter drawer */}
        {mobileFiltersOpen && (
          <div className="fixed inset-0 z-40 sm:hidden">
            <div className="absolute inset-0 bg-black/30" onClick={() => setMobileFiltersOpen(false)} />
            <div className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-xl overflow-y-auto p-4">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold text-gray-700">Filters</span>
                <button onClick={() => setMobileFiltersOpen(false)} className="p-1 rounded hover:bg-gray-100"><X className="h-4 w-4 text-gray-400" /></button>
              </div>
              {filterPanel}
            </div>
          </div>
        )}

        {/* Main area */}
        <main className="flex-1 overflow-y-auto">
          {showStats ? (
            statsLoading ? (
              <div className="flex items-center justify-center h-40">
                <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
              </div>
            ) : (
              <StatsPanel schedules={allSchedules} subjects={subjects} />
            )
          ) : (
            <div className="p-4 sm:p-6">
              {isLoading ? (
                <div className="flex items-center justify-center h-40">
                  <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
                </div>
              ) : dateKeys.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <CalendarDays className="h-10 w-10 text-gray-200 mb-3" />
                  <p className="font-semibold text-gray-400">No schedules found</p>
                  <p className="text-sm text-gray-300 mt-1">Adjust your filters or create a new schedule</p>
                  {canEdit && (
                    <button onClick={() => { setEditTarget(null); setModalOpen(true); }}
                      className="mt-4 flex items-center gap-1.5 px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                      <Plus className="h-4 w-4" /> New Schedule
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  {dateKeys.map((dateKey) => (
                    <div key={dateKey}>
                      <div className="flex items-center gap-3 mb-2">
                        <div className="h-6 w-6 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                          <Calendar className="h-3.5 w-3.5 text-indigo-600" />
                        </div>
                        <h3 className="text-sm font-semibold text-gray-800">{fmtDateHeading(dateKey)}</h3>
                        <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5 shrink-0">
                          {grouped[dateKey].length} lecture{grouped[dateKey].length !== 1 ? "s" : ""}
                        </span>
                        <div className="flex-1 h-px bg-gray-100" />
                      </div>
                      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left">
                            <thead>
                              <tr className="border-b border-gray-100 bg-gray-50/60">
                                <th className="px-3 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Time</th>
                                <th className="px-3 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Dur.</th>
                                <th className="px-3 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Batch(es)</th>
                                <th className="px-3 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Subject</th>
                                <th className="px-3 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Faculty</th>
                                <th className="px-3 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Location</th>
                                <th className="px-3 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wide hidden lg:table-cell">Topics</th>
                                <th className="px-3 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Status</th>
                                {canEdit && <th className="px-3 py-2 w-28" />}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {grouped[dateKey].map((s) => (
                                <ScheduleRow key={s.id} s={s} canEdit={canEdit}
                                  onEdit={openEdit} onDelete={(id) => setDeleteId(id)}
                                  onStatus={(id, status) => statusMut.mutate({ id, status })}
                                />
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Modals */}
      <ScheduleModal
        key={editTarget?.id ?? "new"}
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditTarget(null); }}
        initial={editTarget?.form} scheduleId={editTarget?.id} defaultYear={defaultYear}
        batches={batches} subjects={subjects} employees={employees} locations={locations} academicYears={years}
      />

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Trash2 className="h-5 w-5 text-red-500" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">Delete Schedule?</h3>
            <p className="text-sm text-gray-500 mb-5">This action cannot be undone.</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm text-gray-500 rounded-lg hover:bg-gray-100 transition-colors">Cancel</button>
              <button onClick={() => deleteMut.mutate(deleteId!)} disabled={deleteMut.isPending}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50">
                {deleteMut.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
