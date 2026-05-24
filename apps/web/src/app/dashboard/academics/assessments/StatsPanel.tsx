"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  ComposedChart, Area, Line, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, CartesianGrid, BarChart, Bar, Cell,
} from "recharts";
import {
  Download, FileSpreadsheet, FileText, ChevronDown, X, Loader2,
  TrendingUp, TrendingDown, Users, BookOpen, BarChart2, Filter,
} from "lucide-react";
import { format, subDays, subMonths } from "date-fns";
import { toast } from "sonner";

// ── Primitives ────────────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">{children}</label>;
}
function Sel({ value, onChange, children }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select value={value} onChange={onChange}
      className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs bg-white text-gray-700 focus:outline-none focus:border-indigo-400">
      {children}
    </select>
  );
}

// ── Multi-select exam picker ──────────────────────────────────────────────────

function ExamPicker({ exams, selected, onChange }: {
  exams: any[]; selected: string[]; onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const toggle = (id: string) =>
    selected.includes(id) ? onChange(selected.filter((x) => x !== id)) : onChange([...selected, id]);

  const filtered = exams.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs bg-white text-gray-700 focus:outline-none">
        <span className="truncate">
          {selected.length === 0 ? <span className="text-gray-400">All exams</span>
            : `${selected.length} exam${selected.length > 1 ? "s" : ""} selected`}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 text-gray-400 shrink-0 ml-1 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute z-50 top-full mt-1 w-64 rounded-xl border border-gray-200 bg-white shadow-xl">
          <div className="p-2 border-b border-gray-100">
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search exams…"
              className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs focus:outline-none focus:border-indigo-400" />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 && <p className="px-3 py-2 text-xs text-gray-400">No exams found</p>}
            {filtered.map((e) => (
              <label key={e.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer">
                <input type="checkbox" checked={selected.includes(e.id)} onChange={() => toggle(e.id)}
                  className="accent-indigo-600" />
                <span className="text-xs text-gray-700 truncate">{e.name}</span>
                <span className="text-[10px] text-gray-400 ml-auto shrink-0">{e.examDate ? format(new Date(e.examDate), "d MMM") : ""}</span>
              </label>
            ))}
          </div>
          <div className="border-t border-gray-100 px-3 py-2 flex items-center justify-between">
            <button onClick={() => onChange([])} className="text-[10px] text-gray-400 hover:text-gray-600">Clear</button>
            <button onClick={() => setOpen(false)} className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 px-2 py-0.5 rounded hover:bg-indigo-50">Done</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon, color = "indigo" }: {
  label: string; value: string | number; sub?: string;
  icon: React.ReactNode; color?: string;
}) {
  const colors: Record<string, string> = {
    indigo: "text-indigo-600 bg-indigo-50", green: "text-green-600 bg-green-50",
    amber: "text-amber-600 bg-amber-50",    red: "text-red-500 bg-red-50",
    violet: "text-violet-600 bg-violet-50", blue: "text-blue-600 bg-blue-50",
  };
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-start gap-3">
      <div className={`p-2 rounded-lg ${colors[color]}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
        <p className="text-xl font-bold text-gray-900 leading-tight">{value}</p>
        {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Custom tooltip ────────────────────────────────────────────────────────────

function TrendTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-700 mb-2 max-w-[160px] truncate">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2 mb-0.5">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
          <span className="text-gray-500">{p.name}:</span>
          <span className="font-semibold text-gray-800">{p.value != null ? p.value : "—"}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function AssessmentStatsPanel({
  batches, grades, subjects, academicYears, defaultYear,
}: {
  batches: any[]; grades: any[]; subjects: any[];
  academicYears: any[]; defaultYear: string;
}) {
  // ── Filter state ────────────────────────────────────────────────────────
  const [timeWindow,    setTimeWindow]    = useState<"30d" | "3m" | "6m" | "1y" | "custom">("6m");
  const [dateFrom,      setDateFrom]      = useState("");
  const [dateTo,        setDateTo]        = useState("");
  const [academicYear,  setAcademicYear]  = useState(defaultYear);
  const [gradeId,       setGradeId]       = useState("");
  const [batchId,       setBatchId]       = useState("");
  const [subjectId,     setSubjectId]     = useState("");
  const [locationId,    setLocationId]    = useState("");
  const [selectedExams, setSelectedExams] = useState<string[]>([]);
  const [topN,          setTopN]          = useState(10);
  const [perfView,      setPerfView]      = useState<"top" | "low">("top");
  const [showFilters,   setShowFilters]   = useState(false);

  // ── Derive date range from time window ─────────────────────────────────
  const { from: resolvedFrom, to: resolvedTo } = useMemo(() => {
    const now = new Date();
    if (timeWindow === "custom") return { from: dateFrom, to: dateTo };
    const map = { "30d": subDays(now, 30), "3m": subMonths(now, 3), "6m": subMonths(now, 6), "1y": subMonths(now, 12) };
    return { from: format(map[timeWindow], "yyyy-MM-dd"), to: format(now, "yyyy-MM-dd") };
  }, [timeWindow, dateFrom, dateTo]);

  // ── Reference data queries ──────────────────────────────────────────────
  const { data: locData }   = useQuery({ queryKey: ["locations"],  queryFn: () => api.get("/api/v1/academics/locations").then((r) => r.data), staleTime: 60_000 });
  const { data: examsData } = useQuery({
    queryKey: ["assessments-picker", academicYear, gradeId, batchId, locationId],
    queryFn:  () => {
      const p = new URLSearchParams({ limit: "200" });
      if (academicYear) p.set("academicYear", academicYear);
      if (gradeId)      p.set("gradeId",      gradeId);
      if (batchId)      p.set("batchId",      batchId);
      return api.get(`/api/v1/academics/assessments?${p}`).then((r) => r.data);
    },
    staleTime: 30_000,
  });

  const locations  = (locData?.data     ?? []) as any[];
  const examsList  = (examsData?.data   ?? []) as any[];

  // ── Stats query ─────────────────────────────────────────────────────────
  const statsParams = useMemo(() => {
    const p = new URLSearchParams({ topN: String(topN) });
    if (resolvedFrom)          p.set("dateFrom",     resolvedFrom);
    if (resolvedTo)            p.set("dateTo",       resolvedTo);
    if (academicYear)          p.set("academicYear", academicYear);
    if (gradeId)               p.set("gradeId",      gradeId);
    if (batchId)               p.set("batchId",      batchId);
    if (subjectId)             p.set("subjectId",    subjectId);
    if (locationId)            p.set("locationId",   locationId);
    if (selectedExams.length)  p.set("examIds",      selectedExams.join(","));
    return p.toString();
  }, [resolvedFrom, resolvedTo, academicYear, gradeId, batchId, subjectId, locationId, selectedExams, topN]);

  const { data: statsData, isLoading, isFetching } = useQuery({
    queryKey: ["assessment-stats", statsParams],
    queryFn:  () => api.get(`/api/v1/academics/assessments/stats?${statsParams}`).then((r) => r.data),
    staleTime: 30_000,
  });

  const stats = statsData?.data as {
    trend: any[];
    topPerformers: any[];
    lowPerformers: any[];
    subjectBreakdown: any[];
    summary: { totalExams: number; totalStudents: number; overallAvg: number | null; overallMax: number | null; overallMin: number | null };
  } | undefined;

  // ── Chart data ─────────────────────────────────────────────────────────
  const trendData = useMemo(() =>
    (stats?.trend ?? []).map((t) => ({
      name:       t.examName.length > 18 ? t.examName.slice(0, 16) + "…" : t.examName,
      fullName:   t.examName,
      avg:        t.avg,
      max:        t.max,
      min:        t.min,
      appeared:   t.appeared,
      totalMarks: t.totalMarks,
    })),
  [stats]);

  const subjectChartData = useMemo(() =>
    (stats?.subjectBreakdown ?? []).map((s) => ({
      name: s.subjectName.length > 12 ? s.subjectName.slice(0, 10) + "…" : s.subjectName,
      avg:  s.avg,
      max:  s.max,
      min:  s.min,
    })),
  [stats]);

  const performers = perfView === "top" ? (stats?.topPerformers ?? []) : (stats?.lowPerformers ?? []);

  // ── Download handlers ───────────────────────────────────────────────────
  const downloadExcel = () => {
    const url = `/api/v1/academics/assessments/stats/excel?${statsParams}`;
    const a   = document.createElement("a");
    a.href    = url; a.download = "assessment_stats.xlsx"; a.click();
  };

  const downloadPDF = async () => {
    if (!stats) { toast.error("No data to export"); return; }
    const { default: jsPDF }     = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const doc    = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW  = doc.internal.pageSize.getWidth();
    const pageH  = doc.internal.pageSize.getHeight();
    const M      = 14;
    const indigo: [number, number, number] = [67, 56, 202];
    const light:  [number, number, number] = [246, 247, 254];

    const addFooter = (pg: number, total: number) => {
      doc.setPage(pg);
      doc.setDrawColor(220, 220, 230);
      doc.line(M, pageH - 12, pageW - M, pageH - 12);
      doc.setFontSize(7); doc.setTextColor(150);
      // TODO: replace with AppSetting("org_name") once Universal Settings are implemented
      doc.text("Centum Academy", M, pageH - 7);
      doc.text(`Page ${pg} of ${total}`, pageW / 2, pageH - 7, { align: "center" });
      doc.text("Confidential", pageW - M, pageH - 7, { align: "right" });
    };

    const tableOpts = {
      margin: { left: M, right: M },
      styles:          { fontSize: 7.5, cellPadding: 2.5 },
      headStyles:      { fillColor: indigo, textColor: [255,255,255] as [number,number,number], fontStyle: "bold" as const, fontSize: 7 },
      alternateRowStyles: { fillColor: light },
      theme: "grid" as const,
    };

    // ── Page 1: summary + trend ────────────────────────────────────────
    doc.setFillColor(...indigo);
    doc.rect(0, 0, pageW, 38, "F");
    doc.setTextColor(255,255,255);
    doc.setFontSize(7); doc.setFont("helvetica", "normal");
    doc.text("ASSESSMENT STATISTICS REPORT", M, 11);
    doc.setFontSize(15); doc.setFont("helvetica", "bold");
    doc.text("Performance Analytics", M, 23);
    doc.setFontSize(8); doc.setFont("helvetica", "normal");
    const rangeLabel = resolvedFrom && resolvedTo ? `${resolvedFrom} to ${resolvedTo}` : "All time";
    doc.text(rangeLabel, M, 32);

    let y = 46;
    const stat6 = [
      { l: "Total Exams",     v: String(stats.summary.totalExams) },
      { l: "Total Students",  v: String(stats.summary.totalStudents) },
      { l: "Overall Average", v: stats.summary.overallAvg != null ? String(stats.summary.overallAvg) : "—" },
      { l: "Highest Score",   v: stats.summary.overallMax != null ? String(stats.summary.overallMax) : "—" },
      { l: "Lowest Score",    v: stats.summary.overallMin != null ? String(stats.summary.overallMin) : "—" },
      { l: "Active Filters",  v: [academicYear, grades.find((g)=>g.id===gradeId)?.name, batches.find((b)=>b.id===batchId)?.name].filter(Boolean).join(", ") || "None" },
    ];
    const bw = (pageW - 2 * M - 10) / 3;
    for (let i = 0; i < 6; i++) {
      const col = i % 3, row = Math.floor(i / 3);
      const bx = M + col * (bw + 5), by = y + row * 21;
      doc.setFillColor(...light); doc.setDrawColor(210,212,240);
      doc.roundedRect(bx, by, bw, 16, 2, 2, "FD");
      doc.setFontSize(6); doc.setTextColor(130); doc.setFont("helvetica","normal");
      doc.text(stat6[i].l.toUpperCase(), bx+3, by+6);
      doc.setFontSize(10); doc.setFont("helvetica","bold"); doc.setTextColor(...indigo);
      doc.text(String(stat6[i].v), bx+3, by+13);
    }
    y += 48;

    doc.setFont("helvetica","bold"); doc.setFontSize(9); doc.setTextColor(40);
    doc.text("Exam-wise Trend", M, y); y += 3;
    autoTable(doc, {
      ...tableOpts, startY: y,
      head: [["Exam", "Date", "Total", "Appeared", "Absent", "Average", "Highest", "Lowest"]],
      body: stats.trend.map((t) => [
        t.examName, t.examDate ? format(new Date(t.examDate), "dd MMM yy") : "",
        t.totalMarks ?? "—", t.appeared, t.absent,
        t.avg ?? "—", t.max ?? "—", t.min ?? "—",
      ]),
    });
    y = (doc as any).lastAutoTable.finalY + 8;

    if (stats.subjectBreakdown.length) {
      doc.setFont("helvetica","bold"); doc.setFontSize(9); doc.setTextColor(40);
      doc.text("Subject Breakdown", M, y); y += 3;
      autoTable(doc, {
        ...tableOpts, startY: y,
        head: [["Subject", "Data Points", "Average", "Highest", "Lowest"]],
        body: stats.subjectBreakdown.map((s) => [s.subjectName, s.count, s.avg ?? "—", s.max ?? "—", s.min ?? "—"]),
      });
    }

    // ── Page 2: Top Performers ────────────────────────────────────────
    doc.addPage();
    doc.setFillColor(...indigo); doc.rect(0,0,pageW,16,"F");
    doc.setTextColor(255,255,255); doc.setFontSize(9); doc.setFont("helvetica","bold");
    doc.text("Top Performers", M, 11);
    autoTable(doc, {
      ...tableOpts, startY: 20,
      head: [["Rank","Roll","Name","Batch","Grade","Exams","Avg","High","Low"]],
      body: stats.topPerformers.map((p,i) => [i+1, p.roll, p.name, p.batch, p.grade, p.examsCount, p.avgTotal, p.maxTotal, p.minTotal]),
    });
    let y2 = (doc as any).lastAutoTable.finalY + 10;
    doc.setFillColor(...indigo); doc.rect(0, y2-2, pageW, 16, "F");
    doc.setTextColor(255,255,255); doc.setFontSize(9); doc.setFont("helvetica","bold");
    doc.text("Low Performers", M, y2+9);
    autoTable(doc, {
      ...tableOpts, startY: y2+14,
      head: [["Rank","Roll","Name","Batch","Grade","Exams","Avg","High","Low"]],
      body: stats.lowPerformers.map((p,i) => [i+1, p.roll, p.name, p.batch, p.grade, p.examsCount, p.avgTotal, p.maxTotal, p.minTotal]),
    });

    const total = doc.getNumberOfPages();
    for (let i = 1; i <= total; i++) addFooter(i, total);
    doc.save("assessment_stats_report.pdf");
    toast.success("PDF downloaded");
  };

  // ── Filtered batch list ─────────────────────────────────────────────────
  const filteredBatches = batches.filter((b) =>
    (!academicYear || b.academicYear === academicYear) &&
    (!gradeId      || b.gradeId === gradeId)
  );

  const TIME_BTNS: { key: typeof timeWindow; label: string }[] = [
    { key: "30d", label: "30 Days" }, { key: "3m", label: "3 Months" },
    { key: "6m",  label: "6 Months" }, { key: "1y", label: "1 Year" },
    { key: "custom", label: "Custom" },
  ];

  const TOP_N_OPTS = [5, 10, 20, 50];

  const hasData = (stats?.trend?.length ?? 0) > 0;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">

      {/* ── Filter Bar ─────────────────────────────────────────────────────── */}
      <div className="shrink-0 bg-white border-b border-gray-100">
        {/* Time window presets */}
        <div className="px-4 sm:px-6 pt-3 pb-2 flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide shrink-0">Period</span>
          <div className="flex gap-1.5 flex-wrap">
            {TIME_BTNS.map(({ key, label }) => (
              <button key={key} onClick={() => setTimeWindow(key)}
                className={`px-2.5 py-1 text-xs rounded-full font-medium border transition-colors ${
                  timeWindow === key
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                }`}>
                {label}
              </button>
            ))}
          </div>
          {timeWindow === "custom" && (
            <div className="flex items-center gap-1.5 ml-1">
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="text-xs rounded-lg border border-gray-200 px-2 py-1 focus:outline-none focus:border-indigo-400" />
              <span className="text-gray-400 text-xs">→</span>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="text-xs rounded-lg border border-gray-200 px-2 py-1 focus:outline-none focus:border-indigo-400" />
            </div>
          )}
          <button onClick={() => setShowFilters((v) => !v)}
            className={`ml-auto flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors ${
              showFilters ? "bg-indigo-50 text-indigo-700 border-indigo-200" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            }`}>
            <Filter className="h-3 w-3" /> Filters
            {(academicYear || gradeId || batchId || subjectId || locationId || selectedExams.length > 0) && (
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 ml-0.5" />
            )}
          </button>
          {isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400" />}
        </div>

        {/* Expanded filters */}
        {showFilters && (
          <div className="px-4 sm:px-6 pb-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 border-t border-gray-50 pt-3">
            <div>
              <Label>Academic Year</Label>
              <Sel value={academicYear} onChange={(e) => { setAcademicYear((e.target as HTMLSelectElement).value); setBatchId(""); }}>
                <option value="">All years</option>
                {academicYears.map((y) => <option key={y.id} value={y.name}>{y.name}</option>)}
              </Sel>
            </div>
            <div>
              <Label>Grade</Label>
              <Sel value={gradeId} onChange={(e) => { setGradeId((e.target as HTMLSelectElement).value); setBatchId(""); }}>
                <option value="">All grades</option>
                {grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </Sel>
            </div>
            <div>
              <Label>Batch</Label>
              <Sel value={batchId} onChange={(e) => setBatchId((e.target as HTMLSelectElement).value)}>
                <option value="">All batches</option>
                {filteredBatches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Sel>
            </div>
            <div>
              <Label>Subject</Label>
              <Sel value={subjectId} onChange={(e) => setSubjectId((e.target as HTMLSelectElement).value)}>
                <option value="">All subjects</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Sel>
            </div>
            <div>
              <Label>City / Centre</Label>
              <Sel value={locationId} onChange={(e) => setLocationId((e.target as HTMLSelectElement).value)}>
                <option value="">All locations</option>
                {locations.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </Sel>
            </div>
            <div>
              <Label>Select Exams</Label>
              <ExamPicker exams={examsList} selected={selectedExams} onChange={setSelectedExams} />
            </div>
            {(academicYear || gradeId || batchId || subjectId || locationId || selectedExams.length > 0) && (
              <div className="flex items-end col-span-2 sm:col-span-3 lg:col-span-6">
                <button onClick={() => { setAcademicYear(defaultYear); setGradeId(""); setBatchId(""); setSubjectId(""); setLocationId(""); setSelectedExams([]); }}
                  className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded hover:bg-gray-50 transition-colors">
                  Clear all filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Content ──────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
          </div>
        ) : !hasData ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <BarChart2 className="h-10 w-10 text-gray-200 mb-3" />
            <p className="font-semibold text-gray-400">No assessment data found</p>
            <p className="text-sm text-gray-300 mt-1">Adjust the filters or time window</p>
          </div>
        ) : (
          <>
            {/* ── Summary cards ──────────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <StatCard label="Total Exams"    value={stats!.summary.totalExams}    icon={<BookOpen className="h-4 w-4" />} color="indigo" />
              <StatCard label="Students"       value={stats!.summary.totalStudents} icon={<Users    className="h-4 w-4" />} color="blue" />
              <StatCard label="Overall Avg"    value={stats!.summary.overallAvg ?? "—"} icon={<BarChart2    className="h-4 w-4" />} color="violet" />
              <StatCard label="Highest Score"  value={stats!.summary.overallMax ?? "—"} icon={<TrendingUp  className="h-4 w-4" />} color="green" />
              <StatCard label="Lowest Score"   value={stats!.summary.overallMin ?? "—"} icon={<TrendingDown className="h-4 w-4" />} color="amber"
                sub={stats!.summary.overallMax && stats!.summary.overallMin ? `Range: ${stats!.summary.overallMax - stats!.summary.overallMin}` : undefined}
              />
            </div>

            {/* ── Trend chart ─────────────────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-semibold text-gray-700">Average / Min / Max Marks Trend</p>
                <p className="text-[10px] text-gray-400">{trendData.length} exam{trendData.length !== 1 ? "s" : ""}</p>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={trendData} margin={{ top: 5, right: 10, left: -10, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#9ca3af" }} angle={-35} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} width={28} />
                  <Tooltip content={<TrendTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
                  <Area type="monotone" dataKey="avg" name="Average" stroke="#6366f1" fill="#e0e7ff" strokeWidth={2} dot={{ r: 3, fill: "#6366f1" }} />
                  <Line type="monotone" dataKey="max" name="Highest" stroke="#10b981" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
                  <Line type="monotone" dataKey="min" name="Lowest"  stroke="#f87171" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* ── Subject breakdown chart ─────────────────────────────── */}
              {subjectChartData.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                  <p className="text-xs font-semibold text-gray-700 mb-4">Subject-wise Averages</p>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={subjectChartData} margin={{ top: 5, right: 5, left: -15, bottom: 30 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#9ca3af" }} angle={-30} textAnchor="end" interval={0} />
                      <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} width={28} />
                      <Tooltip content={<TrendTooltip />} />
                      <Bar dataKey="avg" name="Average" radius={[3,3,0,0]}>
                        {subjectChartData.map((_, i) => (
                          <Cell key={i} fill={["#a5b4fc","#6ee7b7","#fcd34d","#f9a8d4","#93c5fd"][i % 5]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* ── Subject breakdown table ─────────────────────────────── */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <p className="text-xs font-semibold text-gray-700 mb-3">Subject Summary</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="py-2 text-left text-gray-500 font-semibold">Subject</th>
                        <th className="py-2 text-center text-gray-500 font-semibold">Count</th>
                        <th className="py-2 text-center text-gray-500 font-semibold">Avg</th>
                        <th className="py-2 text-center text-gray-500 font-semibold">High</th>
                        <th className="py-2 text-center text-gray-500 font-semibold">Low</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {(stats?.subjectBreakdown ?? []).map((s) => (
                        <tr key={s.subjectId} className="hover:bg-gray-50/60">
                          <td className="py-1.5 font-medium text-gray-700">{s.subjectName}</td>
                          <td className="py-1.5 text-center text-gray-400">{s.count}</td>
                          <td className="py-1.5 text-center font-semibold text-indigo-600">{s.avg ?? "—"}</td>
                          <td className="py-1.5 text-center text-green-600 font-medium">{s.max ?? "—"}</td>
                          <td className="py-1.5 text-center text-red-500 font-medium">{s.min ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* ── Performers table ────────────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                {/* Top / Low toggle */}
                <div className="flex rounded-lg overflow-hidden border border-gray-200">
                  {(["top","low"] as const).map((v) => (
                    <button key={v} onClick={() => setPerfView(v)}
                      className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                        perfView === v ? "bg-[#2C3E7C] text-white" : "bg-white text-gray-500 hover:bg-gray-50"
                      }`}>
                      {v === "top" ? "Top Performers" : "Low Performers"}
                    </button>
                  ))}
                </div>
                {/* Top N selector */}
                <div className="flex items-center gap-1.5 ml-auto">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">Show</span>
                  {TOP_N_OPTS.map((n) => (
                    <button key={n} onClick={() => setTopN(n)}
                      className={`w-8 h-7 text-xs font-medium rounded-lg border transition-colors ${
                        topN === n ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                      }`}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="py-2 text-center font-semibold text-gray-400 w-8">#</th>
                      <th className="py-2 text-left font-semibold text-gray-500">Student</th>
                      <th className="py-2 text-left font-semibold text-gray-500">Batch</th>
                      <th className="py-2 text-left font-semibold text-gray-500">Grade</th>
                      <th className="py-2 text-center font-semibold text-gray-500">Exams</th>
                      <th className="py-2 text-center font-semibold text-gray-500">Average</th>
                      <th className="py-2 text-center font-semibold text-gray-500">Highest</th>
                      <th className="py-2 text-center font-semibold text-gray-500">Lowest</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {performers.length === 0 ? (
                      <tr><td colSpan={8} className="py-8 text-center text-gray-400">No data</td></tr>
                    ) : performers.map((p: any, i: number) => (
                      <tr key={p.studentId} className="hover:bg-indigo-50/20 transition-colors">
                        <td className="py-2 text-center">
                          <span className={`inline-flex w-5 h-5 rounded-full items-center justify-center text-[9px] font-bold
                            ${perfView === "top"
                              ? i === 0 ? "bg-amber-100 text-amber-700" : i === 1 ? "bg-gray-100 text-gray-600" : i === 2 ? "bg-orange-100 text-orange-600" : "text-gray-400"
                              : i === 0 ? "bg-red-100 text-red-600" : "text-gray-400"
                            }`}>
                            {i + 1}
                          </span>
                        </td>
                        <td className="py-2">
                          <div className="font-medium text-gray-700">{p.name}</div>
                          <div className="text-[10px] text-gray-400">{p.roll}</div>
                        </td>
                        <td className="py-2 text-gray-500">{p.batch}</td>
                        <td className="py-2 text-gray-500">{p.grade}</td>
                        <td className="py-2 text-center text-gray-500">{p.examsCount}</td>
                        <td className={`py-2 text-center font-bold ${perfView === "top" ? "text-indigo-600" : "text-red-500"}`}>{p.avgTotal}</td>
                        <td className="py-2 text-center text-green-600 font-medium">{p.maxTotal}</td>
                        <td className="py-2 text-center text-red-400">{p.minTotal}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Download actions ─────────────────────────────────────────── */}
            <div className="flex items-center justify-end gap-3 pb-2">
              <button onClick={downloadExcel}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold border border-green-200 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors">
                <FileSpreadsheet className="h-3.5 w-3.5" /> Download Excel
              </button>
              <button onClick={downloadPDF}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold border border-red-200 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors">
                <FileText className="h-3.5 w-3.5" /> Download PDF
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
