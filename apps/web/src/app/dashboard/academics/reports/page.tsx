"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  Users2, TrendingUp, CalendarCheck, BookOpen, ClipboardList,
  FileBarChart2, FileSpreadsheet, FileText, X, Loader2,
  Search, FileCheck2,
} from "lucide-react";
import { format, subMonths } from "date-fns";

// ── Design tokens ───────────────────────────────────────────────────────────────
const D = { line: "#e6e8ef", muted: "#7c8598", ink: "#111827", nav2: "#28245f", bg: "#f4f6fa", accent: "#eef2ff" };

// ── Primitives ─────────────────────────────────────────────────────────────────
function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-semibold text-gray-500 mb-1">{children}</label>;
}

function Inp({ className = "", ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 bg-white ${className}`} />;
}

function Sel({ value, onChange, children, className = "" }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select value={value} onChange={onChange}
      className={`w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 bg-white text-gray-700 ${className}`}>
      {children}
    </select>
  );
}

// ── Student search typeahead ────────────────────────────────────────────────────
function StudentSearch({ value, onChange }: { value: { id: string; label: string } | null; onChange: (v: { id: string; label: string } | null) => void }) {
  const [q, setQ] = useState(value?.label ?? "");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data } = useQuery({
    queryKey: ["student-search", q],
    queryFn:  () => q.length >= 2 ? api.get(`/api/v1/academics/students?search=${encodeURIComponent(q)}&limit=20`).then((r) => r.data) : Promise.resolve({ data: [] }),
    staleTime: 10_000,
  });
  const results: any[] = data?.data ?? [];

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const select = (s: any) => {
    const label = `${s.firstName} ${s.lastName} (${s.rollNumber ?? s.id.slice(0, 6)})`;
    setQ(label); onChange({ id: s.id, label }); setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input value={q} onChange={(e) => { setQ(e.target.value); onChange(null); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Type student name or roll number…"
          className="w-full rounded-lg border border-gray-200 pl-8 pr-3 py-2 text-sm focus:outline-none focus:border-indigo-400 bg-white" />
        {value && (
          <button onClick={() => { setQ(""); onChange(null); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-xl max-h-48 overflow-y-auto">
          {results.map((s: any) => (
            <button key={s.id} onClick={() => select(s)}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-left hover:bg-indigo-50 transition-colors">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-700 truncate">{s.firstName} {s.lastName}</p>
                <p className="text-xs text-gray-400">{s.rollNumber ?? "—"} · {s.batch?.name ?? "—"}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Report definitions ─────────────────────────────────────────────────────────
type ReportDef = {
  id:          string;
  title:       string;
  shortCode:   string;
  description: string;
  icon:        React.ElementType;
  color:       string;
  iconBg:      string;
  formats:     ("excel" | "pdf")[];
  tags:        string[];
  statusHint:  string;
  category:    string;
};

const REPORTS: ReportDef[] = [
  {
    id: "batch-performance", title: "Batch Performance", shortCode: "BP",
    description: "Per-exam statistics and student rankings for a batch, with detailed marks matrix across assessments.",
    icon: Users2, color: "text-indigo-600", iconBg: "bg-indigo-50",
    formats: ["excel", "pdf"], tags: ["Exams", "Rankings", "Marks Matrix"],
    statusHint: "Configure filters before download", category: "Performance",
  },
  {
    id: "student-progress", title: "Student Progress", shortCode: "SP",
    description: "Individual student's marks across exams with subject-wise progress and trend breakdown.",
    icon: TrendingUp, color: "text-violet-600", iconBg: "bg-violet-50",
    formats: ["excel", "pdf"], tags: ["Individual", "Trends", "Subject-wise"],
    statusHint: "Best for parent meetings", category: "Performance",
  },
  {
    id: "assessment-overview", title: "Assessment Overview", shortCode: "AO",
    description: "Cross-exam performance statistics, averages, top and low performers, and subject breakdown.",
    icon: FileCheck2, color: "text-blue-600", iconBg: "bg-blue-50",
    formats: ["excel", "pdf"], tags: ["Statistics", "Performers", "Trends"],
    statusHint: "Use time-window filters", category: "Performance",
  },
  {
    id: "exam-attendance", title: "Exam Attendance", shortCode: "EA",
    description: "Who attended and missed each exam, including per-exam attendance rate across selected batches.",
    icon: CalendarCheck, color: "text-green-600", iconBg: "bg-green-50",
    formats: ["excel", "pdf"], tags: ["Attendance", "Per Exam"],
    statusHint: "Useful before result review", category: "Attendance",
  },
  {
    id: "subject-analysis", title: "Subject Analysis", shortCode: "SA",
    description: "Deep-dive into a single subject with average marks per exam and per-student breakdown over time.",
    icon: BookOpen, color: "text-amber-600", iconBg: "bg-amber-50",
    formats: ["excel", "pdf"], tags: ["Subject", "Trends", "Per Student"],
    statusHint: "Choose subject first", category: "Performance",
  },
  {
    id: "assignment-completion", title: "Assignment Completion", shortCode: "AC",
    description: "Submission rates by batch, pending counts, per-student status, and assignment completion trend.",
    icon: ClipboardList, color: "text-rose-600", iconBg: "bg-rose-50",
    formats: ["excel", "pdf"], tags: ["Assignments", "Submission Rate"],
    statusHint: "Tracks pending submissions", category: "Assignments",
  },
];

// ── Generation modal ───────────────────────────────────────────────────────────
function GenerateModal({ report, onClose, academicYears, batches, grades, subjects, defaultYear }: {
  report: ReportDef; onClose: () => void;
  academicYears: any[]; batches: any[]; grades: any[]; subjects: any[];
  defaultYear: string;
}) {
  const [academicYear, setAcademicYear] = useState(defaultYear);
  const [gradeId,      setGradeId]      = useState("");
  const [batchId,      setBatchId]      = useState("");
  const [subjectId,    setSubjectId]    = useState("");
  const [dateFrom,     setDateFrom]     = useState(() => format(subMonths(new Date(), 6), "yyyy-MM-dd"));
  const [dateTo,       setDateTo]       = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [student,      setStudent]      = useState<{ id: string; label: string } | null>(null);
  const [loading,      setLoading]      = useState<"excel" | "pdf" | null>(null);

  const filteredBatches = batches.filter((b) =>
    (!academicYear || b.academicYear === academicYear) && (!gradeId || b.gradeId === gradeId)
  );

  const buildParams = () => {
    const p = new URLSearchParams();
    if (academicYear) p.set("academicYear", academicYear);
    if (gradeId)      p.set("gradeId",      gradeId);
    if (batchId)      p.set("batchId",      batchId);
    if (subjectId)    p.set("subjectId",    subjectId);
    if (dateFrom)     p.set("dateFrom",     dateFrom);
    if (dateTo)       p.set("dateTo",       dateTo);
    if (student)      p.set("studentId",    student.id);
    return p;
  };

  const validate = (): string | null => {
    if (report.id === "student-progress" && !student) return "Please select a student";
    if (report.id === "subject-analysis" && !subjectId) return "Please select a subject";
    if (!academicYear && report.id !== "student-progress") return "Please select an academic year";
    return null;
  };

  const downloadExcel = async () => {
    const err = validate(); if (err) { toast.error(err); return; }
    setLoading("excel");
    const p = buildParams(); p.set("format", "excel");
    const endpoint = report.id === "assessment-overview"
      ? `/api/v1/academics/assessments/stats/excel?${p}`
      : `/api/v1/academics/reports/${report.id}?${p}`;
    try {
      const a = document.createElement("a"); a.href = endpoint; a.click();
      toast.success("Excel download started");
    } finally { setLoading(null); }
  };

  const downloadPDF = async () => {
    const err = validate(); if (err) { toast.error(err); return; }
    setLoading("pdf");
    try {
      const p = buildParams();
      const endpoint = report.id === "assessment-overview"
        ? `/api/v1/academics/assessments/stats?${p}`
        : `/api/v1/academics/reports/${report.id}?${p}`;
      const res = await api.get(endpoint).then((r) => r.data);
      if (!res.success) { toast.error(res.error ?? "Failed to fetch data"); return; }
      await generatePDF(report, res.data, { academicYear, gradeId, batchId, subjectId, dateFrom, dateTo, studentLabel: student?.label });
      toast.success("PDF downloaded");
    } catch { toast.error("Failed to generate PDF"); }
    finally { setLoading(null); }
  };

  const showYear    = report.id !== "student-progress";
  const showGrade   = !["student-progress"].includes(report.id);
  const showBatch   = !["student-progress", "subject-analysis"].includes(report.id);
  const showSubject = ["subject-analysis", "assignment-completion"].includes(report.id);
  const showStudent = report.id === "student-progress";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-3 px-6 pt-5 pb-4 border-b border-gray-100">
          <div style={{ width: 40, height: 40, borderRadius: 12, background: D.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700, color: D.nav2, flexShrink: 0 }}>{report.shortCode}</div>
          <div className="flex-1">
            <h2 className="text-base font-bold text-gray-900">{report.title}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{report.description}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X className="h-4 w-4" /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {showStudent && (
            <div><Label>Student <span className="text-red-400">*</span></Label><StudentSearch value={student} onChange={setStudent} /></div>
          )}
          {showYear && (
            <div>
              <Label>Academic Year {!["student-progress"].includes(report.id) && <span className="text-red-400">*</span>}</Label>
              <Sel value={academicYear} onChange={(e) => { setAcademicYear((e.target as HTMLSelectElement).value); setBatchId(""); }}>
                <option value="">All years</option>
                {academicYears.map((y) => <option key={y.id} value={y.name}>{y.name}</option>)}
              </Sel>
            </div>
          )}
          {(showGrade || showBatch) && (
            <div className="grid grid-cols-2 gap-3">
              {showGrade && (
                <div><Label>Grade</Label>
                  <Sel value={gradeId} onChange={(e) => { setGradeId((e.target as HTMLSelectElement).value); setBatchId(""); }}>
                    <option value="">All grades</option>
                    {grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </Sel>
                </div>
              )}
              {showBatch && (
                <div><Label>Batch</Label>
                  <Sel value={batchId} onChange={(e) => setBatchId((e.target as HTMLSelectElement).value)}>
                    <option value="">All batches</option>
                    {filteredBatches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </Sel>
                </div>
              )}
            </div>
          )}
          {showSubject && (
            <div><Label>Subject {report.id === "subject-analysis" && <span className="text-red-400">*</span>}</Label>
              <Sel value={subjectId} onChange={(e) => setSubjectId((e.target as HTMLSelectElement).value)}>
                <option value="">All subjects</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Sel>
            </div>
          )}
          <div><Label>Date Range</Label>
            <div className="grid grid-cols-2 gap-3">
              <Inp type="date" max="2099-12-31" min="1900-01-01" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              <Inp type="date" max="2099-12-31" min="1900-01-01" value={dateTo}   onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>
          <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">This report includes</p>
            <div className="flex flex-wrap gap-1.5">
              {report.tags.map((t) => (
                <span key={t} className="rounded-full bg-white border border-gray-200 px-2 py-0.5 text-[10px] text-gray-600 font-medium">{t}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="px-6 pb-5 pt-2 border-t border-gray-100 flex items-center gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 rounded-lg hover:bg-gray-100 transition-colors">Cancel</button>
          <div className="flex-1" />
          <button onClick={downloadExcel} disabled={!!loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold border border-green-200 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 disabled:opacity-50 transition-colors">
            {loading === "excel" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
            Excel
          </button>
          <button onClick={downloadPDF} disabled={!!loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold border border-red-200 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors">
            {loading === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            PDF
          </button>
        </div>
      </div>
    </div>
  );
}

// ── PDF generator ──────────────────────────────────────────────────────────────
async function generatePDF(report: ReportDef, data: any, filters: Record<string, string | undefined>) {
  const { default: jsPDF }     = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc   = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M     = 14;
  const IND:  [number, number, number] = [67, 56, 202];
  const LITE: [number, number, number] = [246, 247, 254];

  const addFooter = (pg: number, total: number) => {
    doc.setPage(pg);
    doc.setDrawColor(220, 220, 230);
    doc.line(M, pageH - 12, pageW - M, pageH - 12);
    doc.setFontSize(7); doc.setTextColor(150); doc.setFont("helvetica", "normal");
    doc.text("Centum Academy", M, pageH - 7);
    doc.text(`Page ${pg} of ${total}`, pageW / 2, pageH - 7, { align: "center" });
    doc.text("Confidential", pageW - M, pageH - 7, { align: "right" });
  };

  const tblOpts = {
    margin: { left: M, right: M },
    styles:             { fontSize: 7.5, cellPadding: 2.5 },
    headStyles:         { fillColor: IND, textColor: [255,255,255] as [number,number,number], fontStyle: "bold" as const, fontSize: 7 },
    alternateRowStyles: { fillColor: LITE },
    theme:              "grid" as const,
  };

  doc.setFillColor(...IND);
  doc.rect(0, 0, pageW, 40, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7); doc.setFont("helvetica", "normal");
  doc.text(`ACADEMIC REPORT  ·  ${report.title.toUpperCase()}`, M, 11);
  doc.setFontSize(15); doc.setFont("helvetica", "bold");
  doc.text(report.title, M, 24);
  doc.setFontSize(8); doc.setFont("helvetica", "normal");
  const filterLine = [filters.academicYear, filters.studentLabel, filters.dateFrom && filters.dateTo ? `${filters.dateFrom} to ${filters.dateTo}` : ""].filter(Boolean).join("  ·  ");
  doc.text(filterLine, M, 34);

  let y = 48;

  if (report.id === "batch-performance") {
    doc.setFont("helvetica","bold"); doc.setFontSize(9); doc.setTextColor(40);
    doc.text("Exam Summary", M, y); y += 3;
    autoTable(doc, {
      ...tblOpts, startY: y,
      head: [["Exam", "Date", "Total Marks", "Appeared", "Absent", "Avg", "High", "Low"]],
      body: (data.examStats ?? []).map((e: any) => [e.name, e.date ? format(new Date(e.date), "dd MMM yy") : "", e.totalMarks ?? "—", e.appeared, e.absent, e.avg ?? "—", e.max ?? "—", e.min ?? "—"]),
    });
    y = (doc as any).lastAutoTable.finalY + 8;
    doc.setFont("helvetica","bold"); doc.setFontSize(9); doc.setTextColor(40);
    doc.text("Student Rankings", M, y); y += 3;
    autoTable(doc, {
      ...tblOpts, startY: y,
      head: [["Rank","Roll","Name","Batch","Appeared","Average"]],
      body: (data.students ?? []).map((s: any, i: number) => [i+1, s.rollNumber ?? "—", `${s.firstName} ${s.lastName}`, s.batch?.name ?? "—", s.attended, s.avg]),
    });
  }

  if (report.id === "student-progress" && data.student) {
    const s = data.student;
    doc.setFont("helvetica","bold"); doc.setFontSize(10); doc.setTextColor(40);
    doc.text(`${s.firstName} ${s.lastName}`, M, y);
    doc.setFont("helvetica","normal"); doc.setFontSize(8); doc.setTextColor(100);
    doc.text(`Roll: ${s.rollNumber ?? "—"}  ·  Batch: ${s.batch?.name ?? "—"}  ·  Grade: ${s.batch?.grade?.name ?? "—"}`, M, y + 6);
    y += 14;
    doc.setFont("helvetica","bold"); doc.setFontSize(9); doc.setTextColor(40);
    doc.text("Exam History", M, y); y += 3;
    autoTable(doc, {
      ...tblOpts, startY: y,
      head: [["Exam","Date","Max Marks","Obtained","Percentage","Attended"]],
      body: (data.examHistory ?? []).map((e: any) => [e.examName, e.examDate ? format(new Date(e.examDate),"dd MMM yy") : "", e.totalMarks ?? "—", e.total ?? "—", e.pct != null ? `${e.pct}%` : "—", e.attended ? "Yes" : "No"]),
    });
    y = (doc as any).lastAutoTable.finalY + 8;
    doc.setFont("helvetica","bold"); doc.setFontSize(9); doc.setTextColor(40);
    doc.text("Subject Summary", M, y); y += 3;
    autoTable(doc, {
      ...tblOpts, startY: y,
      head: [["Subject","Exams","Average","Highest","Lowest"]],
      body: (data.subjectSummary ?? []).map((s: any) => [s.subject, s.count, s.avg, s.max, s.min]),
    });
  }

  if (report.id === "assessment-overview") {
    const sum = data.summary ?? {};
    const boxes = [
      { l: "Total Exams",   v: String(sum.totalExams ?? "—") },
      { l: "Students",      v: String(sum.totalStudents ?? "—") },
      { l: "Overall Avg",   v: String(sum.overallAvg ?? "—") },
    ];
    const bw = (pageW - 2*M - 8) / 3;
    boxes.forEach((b, i) => {
      const bx = M + i*(bw+4);
      doc.setFillColor(...LITE); doc.setDrawColor(210,212,240);
      doc.roundedRect(bx, y, bw, 16, 2, 2, "FD");
      doc.setFontSize(6); doc.setTextColor(120); doc.setFont("helvetica","normal");
      doc.text(b.l.toUpperCase(), bx+3, y+6);
      doc.setFontSize(11); doc.setFont("helvetica","bold"); doc.setTextColor(...IND);
      doc.text(b.v, bx+3, y+13);
    });
    y += 22;
    doc.setFont("helvetica","bold"); doc.setFontSize(9); doc.setTextColor(40);
    doc.text("Exam Trend", M, y); y += 3;
    autoTable(doc, {
      ...tblOpts, startY: y,
      head: [["Exam","Date","Total","Appeared","Absent","Avg","High","Low"]],
      body: (data.trend ?? []).map((t: any) => [t.examName, t.examDate ? format(new Date(t.examDate),"dd MMM yy") : "", t.totalMarks ?? "—", t.appeared, t.absent, t.avg ?? "—", t.max ?? "—", t.min ?? "—"]),
    });
  }

  if (report.id === "exam-attendance") {
    (data ?? []).forEach((exam: any, ei: number) => {
      if (ei > 0) doc.addPage();
      if (ei > 0) {
        doc.setFillColor(...IND); doc.rect(0,0,pageW,18,"F");
        doc.setTextColor(255,255,255); doc.setFontSize(9); doc.setFont("helvetica","bold");
        doc.text(`Exam Attendance — ${exam.examName}`, M, 12);
        y = 24;
      }
      if (ei === 0) {
        doc.setFont("helvetica","bold"); doc.setFontSize(9); doc.setTextColor(40);
        doc.text(`${exam.examName}`, M, y); y += 3;
      }
      autoTable(doc, {
        ...tblOpts, startY: y,
        head: [["Roll","Name","Batch","Status"]],
        body: exam.students.map((s: any) => [s.roll, s.name, s.batch, s.attended ? "Present" : "Absent"]),
        didParseCell: (d: any) => {
          if (d.section === "body" && d.column.index === 3 && d.cell.text[0] === "Absent")
            d.cell.styles.textColor = [239, 68, 68];
        },
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    });
  }

  if (report.id === "subject-analysis") {
    doc.setFont("helvetica","bold"); doc.setFontSize(9); doc.setTextColor(40);
    doc.text(`Subject: ${data.subjectName ?? ""}`, M, y); y += 5;
    autoTable(doc, {
      ...tblOpts, startY: y,
      head: [["Exam","Date","Max Marks","Appeared","Avg","High","Low"]],
      body: (data.examData ?? []).map((e: any) => [e.examName, e.examDate ? format(new Date(e.examDate),"dd MMM yy") : "", e.maxMarks ?? "—", e.appeared, e.avg ?? "—", e.max ?? "—", e.min ?? "—"]),
    });
  }

  if (report.id === "assignment-completion") {
    doc.setFont("helvetica","bold"); doc.setFontSize(9); doc.setTextColor(40);
    doc.text("Assignment Summary", M, y); y += 3;
    autoTable(doc, {
      ...tblOpts, startY: y,
      head: [["Assignment","Subject","Batches","Due Date","Total","Submitted","Pending"]],
      body: (data ?? []).map((a: any) => [a.name, a.subject, a.batches, a.dueDate ? format(new Date(a.dueDate),"dd MMM yy") : "—", a.total, a.submitted, a.pending]),
    });
  }

  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) addFooter(i, total);
  doc.save(`${report.id}_report.pdf`);
}

// ── Main page ──────────────────────────────────────────────────────────────────
function AcademicReportsPage() {
  const searchParams = useSearchParams();
  const teacherId    = searchParams.get("teacherId");

  const [activeReport, setActiveReport] = useState<ReportDef | null>(null);
  const [search,       setSearch]       = useState("");
  const [typeFilter,   setTypeFilter]   = useState("");

  const batchesUrl = teacherId
    ? `/api/v1/academics/batches?teacherId=${teacherId}`
    : "/api/v1/academics/batches";
  const { data: yearsData }    = useQuery({ queryKey: ["academic-years"],   queryFn: () => api.get("/api/v1/academics/academic-years").then((r) => r.data.data) });
  const { data: gradesData }   = useQuery({ queryKey: ["grades"],           queryFn: () => api.get("/api/v1/academics/grades").then((r) => r.data) });
  const { data: subjectsData } = useQuery({ queryKey: ["subjects"],         queryFn: () => api.get("/api/v1/academics/subjects").then((r) => r.data.data) });
  const { data: batchesData }  = useQuery({ queryKey: ["batches-all", teacherId ?? "all"], queryFn: () => api.get(batchesUrl).then((r) => r.data) });

  const years    = (yearsData    ?? []) as any[];
  const grades   = (gradesData?.data   ?? []) as any[];
  const subjects = (subjectsData ?? []) as any[];
  const batches  = (batchesData?.data  ?? []) as any[];

  const defaultYear = years.find((y) => y.isActive && !y.isArchived)?.name ?? years.find((y) => !y.isArchived)?.name ?? "";

  const filtered = REPORTS.filter(r => {
    const q = search.toLowerCase();
    const matchSearch = !q || r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q) || r.tags.some(t => t.toLowerCase().includes(q));
    const matchType = !typeFilter || r.category === typeFilter;
    return matchSearch && matchType;
  });

  const colGrid = "minmax(280px,1.45fr) minmax(200px,.9fr) 160px 160px 140px";

  return (
    <div style={{ flex: 1, overflowY: "auto", background: D.bg }}>

      {/* Page head */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, padding: "20px 24px", background: "#fff", borderBottom: `1px solid ${D.line}`, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: D.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: D.nav2, flexShrink: 0 }}>RP</div>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: D.ink }}>Academic Reports</h1>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: D.muted }}>Generate and download detailed academic reports in Excel or PDF</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button style={{ padding: "10px 18px", borderRadius: 12, border: `1px solid ${D.line}`, background: "#fff", fontSize: 13, fontWeight: 500, color: D.ink, cursor: "pointer" }}>Report History</button>
          <button style={{ padding: "10px 18px", borderRadius: 12, background: D.nav2, color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Generate Custom Report</button>
        </div>
      </div>

      <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Toolbar */}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto auto", gap: 12, alignItems: "center", background: "#fff", border: `1px solid ${D.line}`, borderRadius: 18, padding: 14 }} className="sm:grid-cols-[1fr_auto_auto] grid-cols-1">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search reports by name, batch, subject, performance, attendance, or assignment"
            style={{ minHeight: 42, borderRadius: 12, border: `1px solid ${D.line}`, padding: "0 14px", fontSize: 13, background: D.bg, outline: "none", width: "100%" }} />
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            style={{ minHeight: 42, borderRadius: 12, border: `1px solid ${D.line}`, padding: "0 12px", fontSize: 13, background: "#fff", cursor: "pointer" }}>
            <option value="">All report types</option>
            <option value="Performance">Performance</option>
            <option value="Attendance">Attendance</option>
            <option value="Assignments">Assignments</option>
          </select>
          <button style={{ minHeight: 42, padding: "0 18px", borderRadius: 12, border: `1px solid ${D.line}`, background: "#fff", fontSize: 13, fontWeight: 500, color: D.muted, cursor: "pointer", whiteSpace: "nowrap" }}>Export Catalogue</button>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4" style={{ gap: 12 }}>
          {[
            { label: "Available Reports", value: REPORTS.length },
            { label: "Excel Ready",       value: REPORTS.filter(r => r.formats.includes("excel")).length },
            { label: "PDF Ready",         value: REPORTS.filter(r => r.formats.includes("pdf")).length },
            { label: "Generated Today",   value: 0 },
          ].map(c => (
            <div key={c.label} style={{ background: "#fff", border: `1px solid ${D.line}`, borderRadius: 14, padding: "14px 18px" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: D.muted, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4 }}>{c.label}</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: D.ink }}>{c.value}</div>
            </div>
          ))}
        </div>

        {/* Report list */}
        <div style={{ background: "#fff", border: `1px solid ${D.line}`, borderRadius: 18, overflow: "hidden", boxShadow: "0 8px 22px rgba(20,23,53,.05)" }}>
          {/* Column header — hidden on narrow screens */}
          <div className="hidden xl:grid" style={{ gridTemplateColumns: colGrid, gap: 16, alignItems: "center", minHeight: 48, padding: "0 18px", background: D.bg, borderBottom: `1px solid ${D.line}` }}>
            {["Report", "Includes", "Formats", "Status", "Action"].map(h => (
              <div key={h} style={{ fontSize: 12, fontWeight: 900, color: "#9aa3b4", textTransform: "uppercase", letterSpacing: ".06em" }}>{h}</div>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div style={{ padding: "48px 24px", textAlign: "center", color: D.muted, fontSize: 14 }}>No reports match your search.</div>
          ) : filtered.map((r, idx) => (
            <div key={r.id} className="xl:grid" style={{ display: "block", gridTemplateColumns: colGrid, gap: 16, alignItems: "center", padding: "16px 18px", borderTop: idx === 0 ? "none" : `1px solid #eef2f7` }}>

              {/* Report title + description */}
              <div style={{ display: "grid", gridTemplateColumns: "46px 1fr", gap: 14, alignItems: "start", marginBottom: 12 }} className="xl:mb-0">
                <div style={{ width: 46, height: 46, borderRadius: 14, display: "grid", placeItems: "center", background: D.accent, color: D.nav2, fontWeight: 900, fontSize: 15, flexShrink: 0 }}>{r.shortCode}</div>
                <div>
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: D.ink, lineHeight: 1.25 }}>{r.title}</h2>
                  <p style={{ margin: "5px 0 0", color: D.muted, fontSize: 13, lineHeight: 1.45, fontWeight: 500 }}>{r.description}</p>
                </div>
              </div>

              {/* Tags */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 10 }} className="xl:mb-0">
                {r.tags.map(t => (
                  <span key={t} style={{ minHeight: 28, borderRadius: 999, display: "inline-flex", alignItems: "center", padding: "0 10px", fontSize: 12, fontWeight: 750, background: "#f1f5f9", color: "#64748b", whiteSpace: "nowrap" }}>{t}</span>
                ))}
              </div>

              {/* Formats */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 10 }} className="xl:mb-0">
                {r.formats.includes("excel") && (
                  <span style={{ minHeight: 28, borderRadius: 999, display: "inline-flex", alignItems: "center", gap: 5, padding: "0 10px", fontSize: 12, fontWeight: 750, background: "#dcfce7", color: "#15803d" }}><FileSpreadsheet size={12} />Excel</span>
                )}
                {r.formats.includes("pdf") && (
                  <span style={{ minHeight: 28, borderRadius: 999, display: "inline-flex", alignItems: "center", gap: 5, padding: "0 10px", fontSize: 12, fontWeight: 750, background: "#fee2e2", color: "#b91c1c" }}><FileText size={12} />PDF</span>
                )}
              </div>

              {/* Status */}
              <div style={{ display: "grid", gap: 2, color: "#475569", fontSize: 13, fontWeight: 750, marginBottom: 12 }} className="xl:mb-0">
                Ready
                <span style={{ color: D.muted, fontSize: 12, fontWeight: 500 }}>{r.statusHint}</span>
              </div>

              {/* Action */}
              <div style={{ justifySelf: "end" }}>
                <button onClick={() => setActiveReport(r)} style={{ padding: "9px 20px", borderRadius: 12, background: D.nav2, color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                  Generate
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Note panel */}
        <div style={{ border: "1px solid #c7d2fe", background: D.accent, color: "#3730a3", borderRadius: 16, padding: "16px 18px", fontSize: 14, lineHeight: 1.55, fontWeight: 550 }}>
          Click <strong>Generate</strong> on any report row to configure filters and download. Excel files can include multiple sheets and colour-coded headers; PDF reports are branded and ready to share.
        </div>
      </div>

      {/* Generation modal */}
      {activeReport && (
        <GenerateModal
          report={activeReport}
          onClose={() => setActiveReport(null)}
          academicYears={years}
          batches={batches}
          grades={grades}
          subjects={subjects}
          defaultYear={defaultYear}
        />
      )}
    </div>
  );
}

export default function AcademicReportsPageWrapped() {
  return <Suspense fallback={null}><AcademicReportsPage /></Suspense>;
}
