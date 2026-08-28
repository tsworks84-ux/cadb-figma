"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  ArrowLeft, Save, Loader2, Trash2, RotateCcw, FileUp,
  Users, BookOpen, Calendar, Clock, FileCheck2, ChevronDown, ChevronUp,
  FileDown, TrendingUp, TrendingDown, Minus,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { usePermissions } from "@/hooks/usePermissions";
import ImportMarksModal from "../ImportMarksModal";
import { hasAcademicsAction } from "@/lib/academicsAccess";
import { invalidateAssessments } from "@/lib/assessmentCache";
import { format, parseISO } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { fullName } from "@/lib/utils";

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  try { return format(parseISO(iso), "dd MMM yyyy"); } catch { return iso; }
}

const STATUS_BADGE: Record<string, string> = {
  DUE:       "bg-amber-50 text-amber-700 border border-amber-200",
  COMPLETED: "bg-green-50 text-green-700 border border-green-200",
  MARKED:    "bg-indigo-50 text-indigo-700 border border-indigo-200",
  CANCELLED: "bg-red-50 text-red-600 border border-red-200",
  ARCHIVED:  "bg-gray-100 text-gray-500 border border-gray-200",
};
const STATUS_LABEL: Record<string, string> = {
  DUE: "Due", COMPLETED: "Completed", MARKED: "Marked", CANCELLED: "Cancelled", ARCHIVED: "Archived",
};

// Slot key used in local state maps
const slotKey = (paperNum: number, subjectSlot: number) => `${paperNum}_${subjectSlot}`;

// ── Marks input cell ─────────────────────────────────────────────────────────
// Isolated so only this cell re-renders on each keystroke

function MarksCell({ value, onChange, max, disabled }: {
  value: string; onChange: (v: string) => void; max: number | null; disabled: boolean;
}) {
  const over = max !== null && value !== "" && parseFloat(value) > max;
  return (
    <input
      type="number" min={0} max={max ?? undefined} step="0.5"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      placeholder="—"
      className={`w-full text-center text-sm rounded-lg border px-2 py-1.5 focus:outline-none focus:ring-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed
        ${over
          ? "border-red-300 bg-red-50 text-red-600 focus:border-red-400 focus:ring-red-200"
          : "border-gray-200 bg-white text-gray-800 focus:border-indigo-400 focus:ring-indigo-200"
        }`}
    />
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ExamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc     = useQueryClient();
  const { user } = useAuthStore();
  const permissions = usePermissions();
  // Marking rights come from the permission matrix, exactly like the list page.
  // This used to be hard-coded to SUPER_ADMIN / HR_ADMIN, which hid every marking
  // control from any other role the matrix had granted edit on Assessments.
  const canEdit = hasAcademicsAction(user?.role, permissions, "STU_ASSESSMENT", "canEdit");

  // ── Filter state ────────────────────────────────────────────────────────
  const [filterBatch,    setFilterBatch]    = useState("");
  const [search,         setSearch]         = useState("");
  const [showExcluded,   setShowExcluded]   = useState(false);
  const [tab,            setTab]            = useState<"marks" | "overview">("marks");
  const [importOpen,     setImportOpen]     = useState(false);

  // ── Local marks + attendance state ──────────────────────────────────────
  // studentId → slotKey → value string
  const [marksMap,      setMarksMap]      = useState<Record<string, Record<string, string>>>({});
  // studentId → attended boolean
  const [attendanceMap, setAttendanceMap] = useState<Record<string, boolean>>({});
  const [initialized,   setInitialized]  = useState<Set<string>>(new Set());

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: examData } = useQuery({
    queryKey: ["assessment", id],
    queryFn:  () => api.get(`/api/v1/academics/assessments/${id}`).then((r) => r.data),
  });
  const { data: resultsData, isLoading } = useQuery({
    queryKey: ["assessment-results", id],
    queryFn:  () => api.get(`/api/v1/academics/assessments/${id}/results`).then((r) => r.data),
  });

  const exam: any            = examData?.data;
  const allRows: any[]        = resultsData?.data ?? [];

  // ── Initialize local state from server data (only once per student) ─────
  useEffect(() => {
    for (const row of allRows) {
      const sid = row.student.id;
      if (initialized.has(sid)) continue;
      setMarksMap((prev) => {
        const studentMarks: Record<string, string> = {};
        for (const m of row.result?.marks ?? []) {
          studentMarks[slotKey(m.paperNum, m.subjectSlot)] = m.marks != null ? String(m.marks) : "";
        }
        return { ...prev, [sid]: studentMarks };
      });
      setAttendanceMap((prev) => ({ ...prev, [sid]: row.result?.attended ?? true }));
      setInitialized((prev) => new Set([...prev, sid]));
    }
  }, [allRows]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived ──────────────────────────────────────────────────────────────
  const slots: any[] = (exam?.subjects ?? []).slice().sort(
    (a: any, b: any) => a.paperNum - b.paperNum || a.subjectSlot - b.subjectSlot
  );
  const numPapers     = exam?.numPapers  ?? 1;
  const numSubjects   = exam?.numSubjects ?? 1;
  const perSlotMax    = exam?.totalMarks && slots.length > 0
    ? exam.totalMarks / slots.length
    : null;

  const activeRows   = allRows.filter((r) => !r.result?.isExcluded);
  const excludedRows = allRows.filter((r) =>  r.result?.isExcluded);

  const _batchMap = new Map<string, any>();
  for (const r of allRows) {
    for (const sb of ((r.student.studentBatches ?? []) as any[])) {
      if (!_batchMap.has(sb.batchId)) _batchMap.set(sb.batchId, sb.batch);
    }
  }
  const batchOptions = [..._batchMap.entries()].map(([id, b]) => ({ id, name: b?.name ?? id }));

  const filteredRows = activeRows.filter((r) => {
    const s = r.student;
    if (filterBatch && !(s.studentBatches ?? []).some((sb: any) => sb.batchId === filterBatch)) return false;
    if (search) {
      const name = fullName(s).toLowerCase();
      const roll = (s.rollNumber ?? "").toLowerCase();
      if (!name.includes(search.toLowerCase()) && !roll.includes(search.toLowerCase())) return false;
    }
    return true;
  });

  // ── Calculated total marks per student ───────────────────────────────────
  const getTotal = useCallback((studentId: string) =>
    slots.reduce((sum, slot) => {
      const v = marksMap[studentId]?.[slotKey(slot.paperNum, slot.subjectSlot)];
      return sum + (v && !isNaN(parseFloat(v)) ? parseFloat(v) : 0);
    }, 0),
  [slots, marksMap]);

  // ── Attendance master checkbox ───────────────────────────────────────────
  const allPresent = filteredRows.length > 0 && filteredRows.every((r) => attendanceMap[r.student.id] ?? true);
  const somePresent = filteredRows.some((r) => attendanceMap[r.student.id] ?? true);

  const toggleAllAttendance = (val: boolean) => {
    setAttendanceMap((prev) => {
      const next = { ...prev };
      for (const r of filteredRows) next[r.student.id] = val;
      return next;
    });
  };

  // ── Update helpers ───────────────────────────────────────────────────────
  const updateMark = useCallback((studentId: string, paperNum: number, subjectSlot: number, val: string) => {
    setMarksMap((prev) => ({
      ...prev,
      [studentId]: { ...(prev[studentId] ?? {}), [slotKey(paperNum, subjectSlot)]: val },
    }));
  }, []);

  const updateAttendance = useCallback((studentId: string, val: boolean) => {
    setAttendanceMap((prev) => ({ ...prev, [studentId]: val }));
  }, []);

  // ── Mutations ────────────────────────────────────────────────────────────
  const saveMut = useMutation({
    mutationFn: () => {
      const updates = activeRows.map((r) => ({
        studentId: r.student.id,
        attended:  attendanceMap[r.student.id] ?? true,
        marks: slots.map((slot) => ({
          paperNum:    slot.paperNum,
          subjectSlot: slot.subjectSlot,
          marks: (() => {
            const v = marksMap[r.student.id]?.[slotKey(slot.paperNum, slot.subjectSlot)];
            return v && !isNaN(parseFloat(v)) ? parseFloat(v) : null;
          })(),
        })),
      }));
      return api.post(`/api/v1/academics/assessments/${id}/results/bulk`, { updates }).then((r) => r.data);
    },
    onSuccess: (res) => {
      if (!res.success) { toast.error(res.error ?? "Failed to save"); return; }
      toast.success("Marks saved successfully");
      invalidateAssessments(qc);
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed to save marks"),
  });

  const excludeMut = useMutation({
    mutationFn: (studentId: string) =>
      api.patch(`/api/v1/academics/assessments/${id}/results/${studentId}`, { isExcluded: true }).then((r) => r.data),
    onSuccess: () => {
      invalidateAssessments(qc);
      toast.success("Student removed from this exam");
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed to remove student"),
  });

  const restoreMut = useMutation({
    mutationFn: (studentId: string) =>
      api.patch(`/api/v1/academics/assessments/${id}/results/${studentId}`, { isExcluded: false }).then((r) => r.data),
    onSuccess: () => {
      invalidateAssessments(qc);
      toast.success("Student restored");
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed to restore student"),
  });

  const statusMut = useMutation({
    mutationFn: (status: string) =>
      api.patch(`/api/v1/academics/assessments/${id}/status`, { status }).then((r) => r.data),
    onSuccess: () => { invalidateAssessments(qc); toast.success("Status updated"); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed to update status"),
  });

  // ── Overview stats ───────────────────────────────────────────────────────
  const appearedRows = useMemo(() => activeRows.filter((r) => r.result?.attended !== false), [activeRows]);
  const absentRows   = useMemo(() => activeRows.filter((r) => r.result?.attended === false),  [activeRows]);

  const overallStats = useMemo(() => {
    const totals = appearedRows.map((r) =>
      (r.result?.marks ?? []).reduce((sum: number, m: any) => sum + (m.marks ?? 0), 0)
    );
    if (!totals.length) return { avg: 0, max: 0, min: 0 };
    const avg = totals.reduce((a, b) => a + b, 0) / totals.length;
    return { avg, max: Math.max(...totals), min: Math.min(...totals) };
  }, [appearedRows]);

  const subjectStats = useMemo(() =>
    slots.map((slot) => {
      const marks = appearedRows
        .map((r) => r.result?.marks?.find((m: any) => m.paperNum === slot.paperNum && m.subjectSlot === slot.subjectSlot)?.marks)
        .filter((v): v is number => v != null);
      const avg = marks.length ? marks.reduce((a, b) => a + b, 0) / marks.length : 0;
      return {
        key:      slotKey(slot.paperNum, slot.subjectSlot),
        label:    numPapers > 1
          ? `P${slot.paperNum}: ${slot.subject?.name ?? `S${slot.subjectSlot}`}`
          : (slot.subject?.name ?? `Subject ${slot.subjectSlot}`),
        maxMarks: slot.maxMarks ?? null,
        avg, max: marks.length ? Math.max(...marks) : 0,
        min:      marks.length ? Math.min(...marks) : 0,
        count:    marks.length,
      };
    }),
  [slots, appearedRows, numPapers]);

  const paperStats = useMemo(() => {
    if (numPapers <= 1) return [];
    return Array.from({ length: numPapers }, (_, pi) => {
      const paperSlots = slots.filter((s) => s.paperNum === pi + 1);
      const totals = appearedRows.map((r) =>
        paperSlots.reduce((sum, slot) => {
          const m = r.result?.marks?.find((mk: any) => mk.paperNum === slot.paperNum && mk.subjectSlot === slot.subjectSlot);
          return sum + (m?.marks ?? 0);
        }, 0)
      );
      const avg = totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : 0;
      const paperMax = paperSlots.reduce((s, sl) => s + (sl.maxMarks ?? 0), 0) || null;
      return {
        paper: pi + 1, avg,
        max: totals.length ? Math.max(...totals) : 0,
        min: totals.length ? Math.min(...totals) : 0,
        maxMarks: paperMax,
      };
    });
  }, [slots, appearedRows, numPapers]);

  const distribution = useMemo(() => {
    if (!appearedRows.length || !exam?.totalMarks) return [];
    const buckets = ["0–20%", "21–40%", "41–60%", "61–80%", "81–100%"];
    const counts   = [0, 0, 0, 0, 0];
    for (const r of appearedRows) {
      const total = (r.result?.marks ?? []).reduce((s: number, m: any) => s + (m.marks ?? 0), 0);
      const pct   = (total / exam.totalMarks) * 100;
      counts[Math.min(Math.floor(pct / 20), 4)]++;
    }
    return buckets.map((label, i) => ({ label, count: counts[i] }));
  }, [appearedRows, exam?.totalMarks]);

  const topPerformers = useMemo(() =>
    [...appearedRows]
      .map((r) => ({
        name:  fullName(r.student),
        roll:  r.student.rollNumber ?? "—",
        batch: r.student.studentBatches?.[0]?.batch?.name ?? "",
        total: (r.result?.marks ?? []).reduce((s: number, m: any) => s + (m.marks ?? 0), 0),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5),
  [appearedRows]);

  // ── PDF generation ───────────────────────────────────────────────────────
  const generatePDF = async () => {
    const { default: jsPDF }    = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const doc    = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW  = doc.internal.pageSize.getWidth();
    const pageH  = doc.internal.pageSize.getHeight();
    const margin = 14;
    const indigo: [number, number, number] = [67, 56, 202];
    const lightBg: [number, number, number] = [246, 247, 254];

    // Footer drawn after all pages are created
    const addFooter = (page: number, total: number) => {
      doc.setPage(page);
      doc.setDrawColor(220, 220, 230);
      doc.line(margin, pageH - 12, pageW - margin, pageH - 12);
      doc.setFontSize(7);
      doc.setTextColor(150);
      // TODO: replace with AppSetting("org_name") once Universal settings are implemented
      doc.text("Centum Academy", margin, pageH - 7);
      doc.text(`Page ${page} of ${total}`, pageW / 2, pageH - 7, { align: "center" });
      doc.text("Confidential", pageW - margin, pageH - 7, { align: "right" });
    };

    // ── Page 1: Summary ──────────────────────────────────────────────────
    // Header band
    doc.setFillColor(...indigo);
    doc.rect(0, 0, pageW, 42, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text("ASSESSMENT REPORT", margin, 12);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(exam.name, margin, 25);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    const batchLine = (exam.batches ?? []).map((eb: any) => eb.batch?.name).filter(Boolean).join(", ");
    doc.text(`${fmtDate(exam.examDate)}  ·  ${exam.startTime} – ${exam.endTime}  ·  ${batchLine}`, margin, 35);

    let y = 50;

    // Summary stat boxes (2 rows × 3 cols)
    const stats6 = [
      { label: "Enrolled",  val: String(activeRows.length) },
      { label: "Appeared",  val: String(appearedRows.length) },
      { label: "Absent",    val: String(absentRows.length) },
      { label: "Average",   val: exam.totalMarks ? `${overallStats.avg.toFixed(1)} / ${exam.totalMarks}` : overallStats.avg.toFixed(1) },
      { label: "Highest",   val: exam.totalMarks ? `${overallStats.max} / ${exam.totalMarks}` : String(overallStats.max) },
      { label: "Lowest",    val: exam.totalMarks ? `${overallStats.min} / ${exam.totalMarks}` : String(overallStats.min) },
    ];
    const bw = (pageW - 2 * margin - 10) / 3;
    for (let i = 0; i < 6; i++) {
      const col = i % 3, row = Math.floor(i / 3);
      const bx = margin + col * (bw + 5), by = y + row * 22;
      doc.setFillColor(...lightBg);
      doc.setDrawColor(210, 212, 240);
      doc.roundedRect(bx, by, bw, 17, 2, 2, "FD");
      doc.setFontSize(6.5);
      doc.setTextColor(120);
      doc.setFont("helvetica", "normal");
      doc.text(stats6[i].label.toUpperCase(), bx + 3, by + 6);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...indigo);
      doc.text(stats6[i].val, bx + 3, by + 13.5);
    }
    y += 50;

    // Subject-wise performance
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(40);
    doc.text("Subject-wise Performance", margin, y);
    y += 3;
    autoTable(doc, {
      startY: y,
      head: [["Subject", "Max Marks", "Students", "Average", "Highest", "Lowest"]],
      body: subjectStats.map((s) => [
        s.label, s.maxMarks != null ? String(s.maxMarks) : "—",
        String(s.count), s.avg.toFixed(1), String(s.max), String(s.min),
      ]),
      margin: { left: margin, right: margin },
      styles:          { fontSize: 8, cellPadding: 2.5 },
      headStyles:      { fillColor: indigo, textColor: 255, fontStyle: "bold", fontSize: 7.5 },
      alternateRowStyles: { fillColor: lightBg },
      theme: "grid",
    });
    y = (doc as any).lastAutoTable.finalY + 8;

    // Paper-wise (only if multi-paper)
    if (paperStats.length > 1) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(40);
      doc.text("Paper-wise Performance", margin, y);
      y += 3;
      autoTable(doc, {
        startY: y,
        head: [["Paper", "Max Marks", "Average", "Highest", "Lowest"]],
        body: paperStats.map((p) => [
          `Paper ${p.paper}`, p.maxMarks != null ? String(p.maxMarks) : "—",
          p.avg.toFixed(1), String(p.max), String(p.min),
        ]),
        margin: { left: margin, right: margin },
        styles:          { fontSize: 8, cellPadding: 2.5 },
        headStyles:      { fillColor: indigo, textColor: 255, fontStyle: "bold", fontSize: 7.5 },
        alternateRowStyles: { fillColor: lightBg },
        theme: "grid",
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    }

    // Top performers
    if (topPerformers.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(40);
      doc.text("Top Performers", margin, y);
      y += 3;
      autoTable(doc, {
        startY: y,
        head: [["Rank", "Roll No", "Student", "Batch", "Total Marks"]],
        body: topPerformers.map((p, i) => [
          String(i + 1), p.roll, p.name, p.batch,
          exam.totalMarks ? `${p.total} / ${exam.totalMarks}` : String(p.total),
        ]),
        margin: { left: margin, right: margin },
        styles:          { fontSize: 8, cellPadding: 2.5 },
        headStyles:      { fillColor: indigo, textColor: 255, fontStyle: "bold", fontSize: 7.5 },
        alternateRowStyles: { fillColor: lightBg },
        theme: "grid",
      });
    }

    // ── Page 2: Full Results Table ──────────────────────────────────────
    doc.addPage();
    doc.setFillColor(...indigo);
    doc.rect(0, 0, pageW, 18, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(`${exam.name}  —  Student Results`, margin, 12);

    const hasTotal = !!exam.totalMarks;
    const slotHeaders = slots.map((s: any) =>
      numPapers > 1
        ? `P${s.paperNum}·${s.subject?.name?.slice(0, 6) ?? `S${s.subjectSlot}`}`
        : (s.subject?.name ?? `S${s.subjectSlot}`)
    );
    autoTable(doc, {
      startY: 22,
      head: [["Roll", "Student", "Batch", ...slotHeaders, "Total", ...(hasTotal ? ["%"] : [])]],
      body: activeRows.map((r) => {
        const isAbsent = r.result?.attended === false;
        const total    = (r.result?.marks ?? []).reduce((s: number, m: any) => s + (m.marks ?? 0), 0);
        return [
          r.student.rollNumber ?? "—",
          fullName(r.student),
          r.student.studentBatches?.[0]?.batch?.name ?? "—",
          ...slots.map((slot: any) => {
            if (isAbsent) return "A";
            const m = r.result?.marks?.find((mk: any) => mk.paperNum === slot.paperNum && mk.subjectSlot === slot.subjectSlot);
            return m?.marks != null ? String(m.marks) : "—";
          }),
          isAbsent ? "Absent" : String(total),
          ...(hasTotal ? [isAbsent ? "—" : `${((total / exam.totalMarks) * 100).toFixed(1)}%`] : []),
        ];
      }),
      margin: { left: margin, right: margin },
      styles:          { fontSize: 7, cellPadding: 2 },
      headStyles:      { fillColor: indigo, textColor: 255, fontStyle: "bold", fontSize: 6.5 },
      alternateRowStyles: { fillColor: lightBg },
      theme: "grid",
      didParseCell: (data) => {
        if (data.section === "body") {
          const r = activeRows[data.row.index];
          if (r?.result?.attended === false) data.cell.styles.textColor = [160, 160, 160];
        }
      },
    });

    // Add footers to all pages
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) addFooter(i, totalPages);

    doc.save(`${exam.name.replace(/\s+/g, "_")}_Report.pdf`);
  };

  // ── Build column defs ────────────────────────────────────────────────────
  const columns = slots.map((slot) => ({
    key:        slotKey(slot.paperNum, slot.subjectSlot),
    paperNum:   slot.paperNum,
    subjectSlot: slot.subjectSlot,
    subjectName: slot.subject?.name ?? `Subject ${slot.subjectSlot}`,
    topics:     slot.topics ?? "",
    maxMarks:   slot.maxMarks ?? null,
  }));

  if (!exam) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
      </div>
    );
  }

  const batchNames = exam.batches?.map((eb: any) => eb.batch?.name).filter(Boolean).join(", ");

  return (
    <div className="flex flex-col h-full bg-gray-50">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="shrink-0 bg-white border-b border-gray-100 px-4 sm:px-6 py-4">
        <div className="flex items-start gap-3">
          <button onClick={() => router.back()}
            className="mt-0.5 p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-bold text-gray-900 truncate">{exam.name}</h1>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[exam.status] ?? "bg-gray-100 text-gray-600"}`}>
                {STATUS_LABEL[exam.status] ?? exam.status}
              </span>
              {canEdit && exam.status === "DUE" && (
                <button onClick={() => statusMut.mutate("MARKED")}
                  className="text-xs text-indigo-600 border border-indigo-200 rounded-full px-2.5 py-0.5 hover:bg-indigo-50 transition-colors">
                  Mark as Marked
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-gray-500">
              {batchNames && (
                <span className="flex items-center gap-1"><Users className="h-3 w-3" />{batchNames}</span>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />{fmtDate(exam.examDate)}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />{exam.startTime} – {exam.endTime}
              </span>
              {exam.totalMarks && (
                <span className="flex items-center gap-1">
                  <FileCheck2 className="h-3 w-3" />Total: {exam.totalMarks} marks
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 mt-4 border-b border-gray-100 -mb-4">
          {(["marks", "overview"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-xs font-semibold transition-colors border-b-2 -mb-px ${
                tab === t
                  ? "border-indigo-500 text-indigo-600"
                  : "border-transparent text-gray-400 hover:text-gray-700"
              }`}>
              {t === "marks" ? "Marks Entry" : "Overview"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Overview tab ─────────────────────────────────────────────────────── */}
      {tab === "overview" && (
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">

          {/* Action bar */}
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Exam Overview</h2>
            <button onClick={generatePDF}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white rounded-md hover:opacity-90 transition-colors" style={{ backgroundColor: "#2C3E7C" }}>
              <FileDown className="h-3.5 w-3.5" /> Download PDF Report
            </button>
          </div>

          {/* ── Summary stat cards ─────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: "Enrolled",  val: activeRows.length,       color: "text-indigo-600",  icon: <Users className="h-3.5 w-3.5" /> },
              { label: "Appeared",  val: appearedRows.length,     color: "text-green-600",   icon: <TrendingUp className="h-3.5 w-3.5" /> },
              { label: "Absent",    val: absentRows.length,       color: "text-red-500",     icon: <Minus className="h-3.5 w-3.5" /> },
              { label: "Average",   val: overallStats.avg.toFixed(1) + (exam.totalMarks ? ` / ${exam.totalMarks}` : ""), color: "text-blue-600",   icon: <FileCheck2 className="h-3.5 w-3.5" /> },
              { label: "Highest",   val: String(overallStats.max) + (exam.totalMarks ? ` / ${exam.totalMarks}` : ""), color: "text-violet-600", icon: <TrendingUp className="h-3.5 w-3.5" /> },
              { label: "Lowest",    val: String(overallStats.min) + (exam.totalMarks ? ` / ${exam.totalMarks}` : ""), color: "text-amber-600",  icon: <TrendingDown className="h-3.5 w-3.5" /> },
            ].map((c) => (
              <div key={c.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3.5">
                <div className="flex items-center gap-1.5 text-gray-400 mb-2">{c.icon}<span className="text-[10px] font-semibold uppercase tracking-wide">{c.label}</span></div>
                <p className={`text-lg font-bold leading-tight ${c.color}`}>{c.val}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* ── Subject-wise stats ──────────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Subject-wise Performance</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="py-2 text-left font-semibold text-gray-500">Subject</th>
                      <th className="py-2 text-center font-semibold text-gray-500">Max</th>
                      <th className="py-2 text-center font-semibold text-gray-500">Average</th>
                      <th className="py-2 text-center font-semibold text-gray-500">Highest</th>
                      <th className="py-2 text-center font-semibold text-gray-500">Lowest</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {subjectStats.map((s) => (
                      <tr key={s.key} className="hover:bg-gray-50/60">
                        <td className="py-2 font-medium text-gray-700">{s.label}</td>
                        <td className="py-2 text-center text-gray-500">{s.maxMarks ?? "—"}</td>
                        <td className="py-2 text-center font-semibold text-indigo-600">{s.avg.toFixed(1)}</td>
                        <td className="py-2 text-center text-green-600 font-medium">{s.max}</td>
                        <td className="py-2 text-center text-red-500 font-medium">{s.min}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Score distribution chart ────────────────────────────────── */}
            {distribution.length > 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Score Distribution</p>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={distribution} barCategoryGap="30%">
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={24} />
                    <Tooltip
                      contentStyle={{ fontSize: 11, border: "1px solid #e5e7eb", borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
                      cursor={{ fill: "#f3f4ff" }}
                    />
                    <Bar dataKey="count" name="Students" radius={[4, 4, 0, 0]}>
                      {distribution.map((_, idx) => (
                        <Cell key={idx} fill={["#fca5a5","#fcd34d","#6ee7b7","#93c5fd","#a5b4fc"][idx]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-center text-xs text-gray-400">
                Set Total Marks to see score distribution
              </div>
            )}
          </div>

          {/* ── Paper-wise stats (multi-paper only) ────────────────────────── */}
          {paperStats.length > 1 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Paper-wise Performance</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {paperStats.map((p) => (
                  <div key={p.paper} className="rounded-lg bg-indigo-50/60 border border-indigo-100 p-3">
                    <p className="text-xs font-bold text-indigo-600 mb-2">Paper {p.paper}</p>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs"><span className="text-gray-500">Avg</span><span className="font-semibold text-indigo-700">{p.avg.toFixed(1)}{p.maxMarks ? `/${p.maxMarks}` : ""}</span></div>
                      <div className="flex justify-between text-xs"><span className="text-gray-500">High</span><span className="font-medium text-green-600">{p.max}</span></div>
                      <div className="flex justify-between text-xs"><span className="text-gray-500">Low</span><span className="font-medium text-red-500">{p.min}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Top performers ──────────────────────────────────────────────── */}
          {topPerformers.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Top Performers</p>
              <div className="space-y-2">
                {topPerformers.map((p, i) => (
                  <div key={i} className="flex items-center gap-3 py-1.5">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0
                      ${i === 0 ? "bg-amber-100 text-amber-700" : i === 1 ? "bg-gray-100 text-gray-600" : i === 2 ? "bg-orange-100 text-orange-600" : "bg-gray-50 text-gray-400"}`}>
                      {i + 1}
                    </span>
                    <span className="flex-1 text-sm font-medium text-gray-700 truncate">{p.name}</span>
                    <span className="text-[10px] text-gray-400 shrink-0">{p.roll}</span>
                    <span className="text-[10px] text-gray-400 shrink-0">{p.batch}</span>
                    <span className={`text-sm font-bold shrink-0 ${i === 0 ? "text-amber-600" : "text-indigo-600"}`}>
                      {exam.totalMarks ? `${p.total}/${exam.totalMarks}` : p.total}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Exam structure card ─────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Subjects</p>
              {slots.length === 0 ? <p className="text-sm text-gray-400">No subjects assigned</p> : (
                <div className="space-y-1.5">
                  {slots.map((slot) => (
                    <div key={slot.id} className="flex items-start gap-2">
                      {numPapers > 1 && <span className="text-[10px] font-bold text-indigo-500 mt-0.5 shrink-0">P{slot.paperNum}</span>}
                      <div>
                        <p className="text-sm text-gray-700">{slot.subject?.name ?? "—"}{slot.maxMarks ? <span className="text-xs text-gray-400 ml-1">({slot.maxMarks} marks)</span> : ""}</p>
                        {slot.topics && <p className="text-xs text-gray-400">{slot.topics}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Batches</p>
              <div className="space-y-1">
                {exam.batches?.map((eb: any) => (
                  <p key={eb.batchId} className="text-sm text-gray-700">{eb.batch?.name ?? eb.batchId}</p>
                ))}
              </div>
            </div>
          </div>

          {exam.note && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
              <p className="text-xs font-semibold text-amber-600 mb-1">Note</p>
              <p className="text-sm text-amber-800">{exam.note}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Marks Entry tab ──────────────────────────────────────────────────── */}
      {tab === "marks" && (
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Filter bar */}
          <div className="shrink-0 bg-white border-b border-gray-100 px-4 sm:px-6 py-3 flex flex-wrap items-center gap-3">
            <select value={filterBatch} onChange={(e) => setFilterBatch(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 focus:outline-none focus:border-indigo-400">
              <option value="">All Batches</option>
              {batchOptions.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <input placeholder="Search student…" value={search} onChange={(e) => setSearch(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-700 focus:outline-none focus:border-indigo-400 w-48" />
            <span className="text-xs text-gray-400 ml-auto">
              {filteredRows.length} student{filteredRows.length !== 1 ? "s" : ""}
              {excludedRows.length > 0 && (
                <span className="ml-2 text-red-400">· {excludedRows.length} excluded</span>
              )}
            </span>
            {canEdit && (
              <button onClick={() => setImportOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 transition-colors">
                <FileUp className="h-3.5 w-3.5" /> Import Marks
              </button>
            )}
          </div>

          {/* Table area */}
          <div className="flex-1 overflow-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
              </div>
            ) : (
              <div className="min-w-max">
                <table className="w-full text-xs border-collapse">
                  <thead className="sticky top-0 z-10 bg-gray-50">
                    {/* Paper group row — only when multiple papers */}
                    {numPapers > 1 && (
                      <tr className="border-b border-gray-200">
                        <th className="sticky left-0 z-20 bg-gray-50 w-28 min-w-[112px] px-3 py-2" />
                        <th className="sticky left-28 z-20 bg-gray-50 w-40 min-w-[160px] px-3 py-2" />
                        <th className="px-3 py-2 w-24" />  {/* Present */}
                        {Array.from({ length: numPapers }, (_, pi) => (
                          <th key={pi} colSpan={numSubjects}
                            className="px-3 py-2 text-center font-semibold text-indigo-600 border-l border-gray-200">
                            Paper {pi + 1}
                          </th>
                        ))}
                        <th className="px-3 py-2 w-20" />  {/* Total */}
                        <th className="px-3 py-2 w-10" />  {/* Actions */}
                      </tr>
                    )}
                    {/* Subject / column headers */}
                    <tr className="border-b border-gray-200">
                      <th className="sticky left-0 z-20 bg-gray-50 w-28 min-w-[112px] px-3 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wide">
                        Roll No
                      </th>
                      <th className="sticky left-28 z-20 bg-gray-50 w-40 min-w-[160px] px-3 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wide">
                        Student
                      </th>
                      <th className="px-3 py-2.5 text-center font-semibold text-gray-600 w-24 min-w-[96px] border-r border-gray-200">
                        <div className="flex items-center justify-center gap-1.5">
                          <input type="checkbox"
                            checked={allPresent}
                            ref={(el) => { if (el) el.indeterminate = !allPresent && somePresent; }}
                            onChange={(e) => toggleAllAttendance(e.target.checked)}
                            className="accent-indigo-600 h-3.5 w-3.5 cursor-pointer"
                          />
                          Present
                        </div>
                      </th>
                      {columns.map((col, idx) => (
                        <th key={col.key}
                          className={`px-3 py-2.5 text-center font-semibold text-gray-600 min-w-[110px] ${idx % numSubjects === 0 && numPapers > 1 ? "border-l border-gray-200" : ""}`}>
                          <div>{col.subjectName}</div>
                          {col.maxMarks && (
                            <div className="text-[10px] font-normal text-gray-400">/ {col.maxMarks}</div>
                          )}
                          {col.topics && (
                            <div className="text-[10px] font-normal text-indigo-400 truncate max-w-[100px]">{col.topics}</div>
                          )}
                        </th>
                      ))}
                      <th className="px-3 py-2.5 text-center font-semibold text-gray-600 w-20 min-w-[80px]">
                        Total
                      </th>
                      <th className="px-3 py-2.5 w-10" />
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-100 bg-white">
                    {filteredRows.length === 0 ? (
                      <tr>
                        <td colSpan={3 + columns.length + 2} className="py-16 text-center text-sm text-gray-400">
                          <BookOpen className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                          No students found
                        </td>
                      </tr>
                    ) : filteredRows.map((row) => {
                      const s       = row.student;
                      const absent  = !(attendanceMap[s.id] ?? true);
                      const total   = getTotal(s.id);
                      const overMax = exam.totalMarks && total > exam.totalMarks;

                      return (
                        <tr key={s.id} className={`group transition-colors ${absent ? "bg-gray-50/80" : "hover:bg-indigo-50/20"}`}>
                          {/* Roll No */}
                          <td className="sticky left-0 bg-inherit z-10 px-3 py-2 font-mono text-gray-500 w-28 min-w-[112px]">
                            {s.rollNumber ?? <span className="text-gray-300">—</span>}
                          </td>
                          {/* Student name */}
                          <td className="sticky left-28 bg-inherit z-10 px-3 py-2 w-40 min-w-[160px]">
                            <div className={`font-medium ${absent ? "text-gray-400" : "text-gray-800"}`}>
                              {fullName(s)}
                            </div>
                            {s.batch?.name && (
                              <div className="text-[10px] text-gray-400">{s.batch.name}</div>
                            )}
                          </td>
                          {/* Present checkbox */}
                          <td className="px-3 py-2 text-center w-24 border-r border-gray-100">
                            <input type="checkbox"
                              checked={attendanceMap[s.id] ?? true}
                              onChange={(e) => updateAttendance(s.id, e.target.checked)}
                              disabled={!canEdit}
                              className="accent-indigo-600 h-4 w-4 cursor-pointer disabled:cursor-not-allowed"
                            />
                          </td>
                          {/* Mark inputs per slot */}
                          {columns.map((col, idx) => (
                            <td key={col.key}
                              className={`px-2 py-1.5 min-w-[110px] ${idx % numSubjects === 0 && numPapers > 1 ? "border-l border-gray-100" : ""}`}>
                              <MarksCell
                                value={marksMap[s.id]?.[col.key] ?? ""}
                                onChange={(v) => updateMark(s.id, col.paperNum, col.subjectSlot, v)}
                                max={col.maxMarks}
                                disabled={absent || !canEdit}
                              />
                            </td>
                          ))}
                          {/* Total */}
                          <td className="px-3 py-2 text-center w-20">
                            <span className={`text-sm font-semibold ${overMax ? "text-red-500" : "text-gray-700"}`}>
                              {absent ? <span className="text-gray-300">—</span> : total > 0 ? total.toFixed(total % 1 === 0 ? 0 : 1) : "—"}
                            </span>
                          </td>
                          {/* Exclude button */}
                          <td className="px-2 py-2 text-center w-10">
                            {canEdit && (
                              <button
                                onClick={() => { if (confirm(`Remove ${s.firstName} from this exam?`)) excludeMut.mutate(s.id); }}
                                className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                                title="Remove from this exam">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Excluded students section ──────────────────────────────────────── */}
          {excludedRows.length > 0 && (
            <div className="shrink-0 border-t border-gray-100 bg-white">
              <button onClick={() => setShowExcluded((v) => !v)}
                className="w-full flex items-center gap-2 px-4 sm:px-6 py-3 text-xs font-medium text-red-500 hover:bg-red-50 transition-colors">
                {showExcluded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                {excludedRows.length} student{excludedRows.length !== 1 ? "s" : ""} excluded from this exam
                <span className="text-gray-400 font-normal ml-1">— click to {showExcluded ? "hide" : "show"}</span>
              </button>
              {showExcluded && (
                <div className="border-t border-red-50 divide-y divide-red-50 bg-red-50/30">
                  {excludedRows.map((row) => {
                    const s = row.student;
                    return (
                      <div key={s.id} className="flex items-center gap-3 px-4 sm:px-6 py-2.5">
                        <span className="text-xs font-mono text-gray-400 w-28">{s.rollNumber ?? "—"}</span>
                        <span className="text-xs text-gray-500 flex-1">{fullName(s)}</span>
                        <span className="text-[10px] text-gray-400">{s.batch?.name}</span>
                        {canEdit && (
                          <button onClick={() => restoreMut.mutate(s.id)}
                            className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 px-2 py-1 rounded hover:bg-indigo-50 transition-colors">
                            <RotateCcw className="h-3 w-3" /> Restore
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Footer actions ─────────────────────────────────────────────────── */}
          <div className="shrink-0 bg-white border-t border-gray-100 px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
            <button onClick={() => router.back()}
              className="px-4 py-2 text-sm text-gray-500 rounded-lg hover:bg-gray-100 transition-colors">
              ← Back
            </button>
            {canEdit && (
              <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}
                className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-md hover:opacity-90 transition-colors disabled:opacity-50" style={{ backgroundColor: "#2C3E7C" }}>
                {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Marks
              </button>
            )}
          </div>
        </div>
      )}

      {importOpen && exam && (
        <ImportMarksModal
          examId={id}
          examName={exam.name}
          onClose={() => setImportOpen(false)}
          onImported={() => {
            // The grid keeps its own copy of every mark, so re-seed it from the
            // server rather than leaving the imported rows showing stale values.
            setInitialized(new Set());
            invalidateAssessments(qc);
          }}
        />
      )}
    </div>
  );
}
