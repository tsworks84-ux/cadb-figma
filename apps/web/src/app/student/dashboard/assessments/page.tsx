"use client";

import { useState, useMemo, useEffect } from "react";
import { useStudentAuthStore } from "@/store/studentAuth";
import { useQuery } from "@tanstack/react-query";
import { studentApi } from "@/lib/studentApi";
import {
  BarChart2, Clock, ChevronDown, ChevronUp, Search, X, CalendarDays,
} from "lucide-react";

// ── helpers ──────────────────────────────────────────────────────────────────

function scoreColor(pct: number | null) {
  if (pct === null) return "text-gray-400";
  if (pct >= 75) return "text-green-600";
  if (pct >= 50) return "text-amber-600";
  return "text-red-600";
}
function scoreBg(pct: number | null) {
  if (pct === null) return "bg-gray-50 border-gray-200";
  if (pct >= 75) return "bg-green-50 border-green-200";
  if (pct >= 50) return "bg-amber-50 border-amber-200";
  return "bg-red-50 border-red-200";
}

/**
 * Exam dates come back as ISO timestamps but are rendered in local time, so the
 * date filter compares on the local calendar day too — otherwise an exam could
 * sit outside a range that visibly contains the date shown on its row.
 */
function localISODate(value: string | Date) {
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function subjectNames(exam: any): string[] {
  return [...new Set(((exam.subjects ?? []) as any[]).map((es) => es.subject?.name).filter(Boolean))] as string[];
}

// ── Exam detail (rendered inline, under the row it belongs to) ────────────────

function ExamDetail({ row }: { row: any }) {
  if (!row.marksRecorded) {
    return (
      <div className="px-5 py-8 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 border border-amber-200 px-4 py-2 text-sm font-semibold text-amber-700">
          <Clock className="h-4 w-4" /> Marks not entered yet
        </div>
        <p className="text-xs text-gray-400 mt-3">
          This exam is scheduled for your batch. Once marks are entered, your scores will appear here.
        </p>
      </div>
    );
  }

  if (!row.result) {
    return <div className="px-5 py-6 text-center text-sm text-gray-400">Marks not available</div>;
  }

  return (
    <div className="px-4 sm:px-5 py-4 space-y-5">
      {/* Exam meta */}
      <p className="text-xs text-gray-400">
        {new Date(row.exam.examDate).toLocaleDateString("en-IN", {
          weekday: "long", day: "numeric", month: "long", year: "numeric",
        })}
        {row.exam.batches?.length > 0 && ` · ${row.exam.batches.join(", ")}`}
      </p>

      {/* 4 KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: "Score",
            value: row.result.total != null
              ? `${row.result.total}${row.exam.totalMarks ? `/${row.exam.totalMarks}` : ""}`
              : "—",
            sub: row.exam.totalMarks && row.result.total != null
              ? `${Math.round((row.result.total / row.exam.totalMarks) * 100)}%`
              : "",
            color: "text-sky-700", bg: "bg-sky-50 border-sky-100",
          },
          {
            label: "Rank",
            value: row.stats.rank != null ? `#${row.stats.rank}` : "—",
            sub: row.stats.totalStudents ? `of ${row.stats.totalStudents}` : "",
            color: "text-amber-700", bg: "bg-amber-50 border-amber-100",
          },
          {
            label: "Percentile",
            value: row.stats.percentile != null ? `${row.stats.percentile.toFixed(2)}` : "—",
            sub: "NTA-style percentile",
            color: scoreColor(row.stats.percentile),
            bg: scoreBg(row.stats.percentile),
          },
          {
            label: "Class Avg",
            value: row.stats.classAvg != null ? String(row.stats.classAvg) : "—",
            sub: row.stats.classMax != null ? `Highest: ${row.stats.classMax}` : "",
            color: "text-gray-700", bg: "bg-gray-50 border-gray-100",
          },
        ].map(({ label, value, sub, color, bg }) => (
          <div key={label} className={`rounded-xl border p-3 ${bg}`}>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</p>
            <p className={`text-2xl font-black mt-1 leading-none ${color}`}>{value}</p>
            {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
          </div>
        ))}
      </div>

      {/* Subject-wise marks */}
      {row.result.marks.length > 0 && (
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
            {row.exam.numPapers > 1 ? "Paper-wise & Subject-wise Marks" : "Subject-wise Marks"}
          </p>
          {Array.from({ length: row.exam.numPapers }, (_, pi) => {
            const paperMarks = row.result.marks.filter((m: any) => m.paperNum === pi + 1);
            if (paperMarks.length === 0) return null;
            return (
              <div key={pi} className="mb-4">
                {row.exam.numPapers > 1 && (
                  <p className="text-xs font-semibold text-gray-500 mb-2">Paper {pi + 1}</p>
                )}
                <div className="space-y-2">
                  {paperMarks.map((m: any) => {
                    const pct = m.maxMarks ? Math.round((m.marks / m.maxMarks) * 100) : null;
                    return (
                      <div key={`${m.paperNum}-${m.subjectSlot}`}
                        className="flex items-center gap-3 rounded-lg bg-gray-50 px-3 sm:px-4 py-2.5">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">
                            {m.subjectName ?? `Subject ${m.subjectSlot}`}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`text-base font-black ${
                            pct !== null
                              ? pct >= 75 ? "text-green-600" : pct >= 50 ? "text-amber-600" : "text-red-600"
                              : "text-gray-700"
                          }`}>
                            {m.marks ?? "—"}
                            {m.maxMarks ? <span className="text-xs font-normal text-gray-400">/{m.maxMarks}</span> : ""}
                          </p>
                          {pct !== null && <p className="text-[10px] text-gray-400">{pct}%</p>}
                        </div>
                        {m.maxMarks && (
                          <div className="w-14 sm:w-20 shrink-0">
                            <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  pct !== null
                                    ? pct >= 75 ? "bg-green-400" : pct >= 50 ? "bg-amber-400" : "bg-red-400"
                                    : "bg-gray-300"
                                }`}
                                style={{ width: `${pct ?? 0}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── page ─────────────────────────────────────────────────────────────────────

export default function StudentAssessmentsPage() {
  const { accessToken } = useStudentAuthStore();
  const [selected,   setSelected]   = useState<string | null>(null);
  const [filterYear, setFilterYear] = useState("");
  const [search,     setSearch]     = useState("");
  const [dateFrom,   setDateFrom]   = useState("");
  const [dateTo,     setDateTo]     = useState("");
  const [scrollTo,   setScrollTo]   = useState<string | null>(null);

  // Academic year filter options
  const { data: yearsData } = useQuery({
    queryKey: ["student-portal-academic-years"],
    queryFn: () => studentApi.get("/api/v1/student/portal/academic-years").then((r) => r.data.data ?? []),
    enabled: !!accessToken,
    staleTime: 10 * 60 * 1000,
  });
  const years: any[] = yearsData ?? [];

  const params = new URLSearchParams();
  if (filterYear) params.set("academicYear", filterYear);

  const { data, isLoading } = useQuery({
    queryKey: ["student-portal-assessments", filterYear],
    queryFn: () =>
      studentApi
        .get(`/api/v1/student/portal/assessments?${params}`)
        .then((r) => r.data.data ?? []),
    enabled: !!accessToken,
    staleTime: 0,
  });

  const allRows: any[] = data ?? [];

  // Search + date range are applied here rather than server-side: the endpoint
  // returns this student's whole exam history in one go, so filtering is instant.
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allRows.filter((r) => {
      const day = localISODate(r.exam.examDate);
      if (dateFrom && day < dateFrom) return false;
      if (dateTo   && day > dateTo)   return false;
      if (!q) return true;
      const haystack = [
        r.exam.name,
        r.exam.status,
        ...subjectNames(r.exam),
        ...(r.exam.batches ?? []),
      ].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [allRows, search, dateFrom, dateTo]);

  const hasFilters = !!(search || dateFrom || dateTo || filterYear);
  const clearFilters = () => {
    setSearch(""); setDateFrom(""); setDateTo(""); setFilterYear(""); setSelected(null);
  };

  // Performance trend (last 12 attended exams with a percentile)
  const trend = useMemo(
    () =>
      [...rows]
        .filter((r) => r.result?.attended && r.stats.percentile !== null)
        .reverse()
        .slice(-12),
    [rows],
  );

  // A trend bar opens the matching row further down the list — bring it into view
  useEffect(() => {
    if (!scrollTo) return;
    document.getElementById(`exam-${scrollTo}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    setScrollTo(null);
  }, [scrollTo]);

  // Keep the open row honest when a filter hides it
  useEffect(() => {
    if (selected && !rows.some((r) => r.exam.id === selected)) setSelected(null);
  }, [rows, selected]);

  const toggle = (id: string, scroll = false) => {
    const next = selected === id ? null : id;
    setSelected(next);
    if (next && scroll) setScrollTo(next);
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center gap-2">
        <BarChart2 className="h-5 w-5 text-sky-600" />
        <h1 className="text-lg font-bold text-gray-900">My Assessments</h1>
        {rows.length > 0 && (
          <span className="inline-flex h-6 items-center rounded-full bg-sky-100 text-sky-700 text-xs font-bold px-2">
            {rows.length}
          </span>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 p-3 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-300 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by exam name, subject or batch"
            className="w-full rounded-lg border border-gray-200 pl-9 pr-9 py-2 text-sm text-gray-700 placeholder:text-gray-300 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-100"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-gray-300 hover:text-gray-500 hover:bg-gray-100"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Date range + year */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <CalendarDays className="h-4 w-4 text-gray-300 shrink-0" />
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-gray-400 font-medium">From</label>
              <input
                type="date" value={dateFrom} max={dateTo || undefined}
                onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-700 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-100"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-gray-400 font-medium">To</label>
              <input
                type="date" value={dateTo} min={dateFrom || undefined}
                onChange={(e) => setDateTo(e.target.value)}
                className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-700 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-100"
              />
            </div>
          </div>

          <select
            value={filterYear}
            onChange={(e) => { setFilterYear(e.target.value); setSelected(null); }}
            className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-700 bg-white focus:outline-none focus:border-sky-400"
          >
            <option value="">All Academic Years</option>
            {years.map((y: any) => (
              <option key={y.id} value={y.name}>{y.name}</option>
            ))}
          </select>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-50"
            >
              <X className="h-3 w-3" /> Clear
            </button>
          )}

          <span className="text-xs text-gray-400 sm:ml-auto">
            {isLoading
              ? "…"
              : `${rows.length} assessment${rows.length !== 1 ? "s" : ""}${
                  hasFilters && rows.length !== allRows.length ? ` of ${allRows.length}` : ""
                }`}
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3 p-1">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 flex flex-col items-center justify-center py-20 text-center px-6">
          <div className="h-16 w-16 rounded-2xl bg-sky-50 flex items-center justify-center mb-4">
            <BarChart2 className="h-8 w-8 text-sky-300" />
          </div>
          {hasFilters ? (
            <>
              <h2 className="text-lg font-semibold text-gray-600">No matching assessments</h2>
              <p className="text-sm text-gray-400 mt-2 max-w-xs">
                Nothing matches this search or date range.
              </p>
              <button
                onClick={clearFilters}
                className="mt-4 rounded-lg bg-sky-600 px-4 py-2 text-xs font-bold text-white hover:bg-sky-700"
              >
                Clear filters
              </button>
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-gray-600">No assessments yet</h2>
              <p className="text-sm text-gray-400 mt-2 max-w-xs">
                Your exam results will appear here once they are available.
              </p>
            </>
          )}
        </div>
      ) : (
        <>
          {/* Trend sparkline */}
          {trend.length > 1 && (
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
                Performance Trend — Percentile
              </p>
              <div className="flex items-end gap-1.5 h-20">
                {trend.map((r: any) => {
                  const pct    = r.stats.percentile ?? 0;
                  const height = Math.max(6, Math.round((pct / 100) * 80));
                  return (
                    <div
                      key={r.exam.id}
                      className="flex-1 flex flex-col items-center gap-1 group cursor-pointer"
                      onClick={() => toggle(r.exam.id, true)}
                    >
                      <div className="relative w-full">
                        <div
                          className={`w-full rounded-t-sm transition-all
                            ${pct >= 75 ? "bg-green-400" : pct >= 50 ? "bg-amber-400" : "bg-red-400"}
                            ${r.exam.id === selected ? "opacity-100 ring-2 ring-offset-1 ring-sky-400" : "opacity-70 group-hover:opacity-100"}`}
                          style={{ height }}
                        />
                      </div>
                      <span className="text-[9px] text-gray-400 font-bold truncate max-w-full px-0.5 text-center hidden sm:block">
                        {new Date(r.exam.examDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between mt-1 text-[10px] text-gray-400">
                <span>0th</span><span>50th</span><span>100th percentile</span>
              </div>
            </div>
          )}

          {/* Exam list — details expand in place, under the row that was tapped */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-50">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                {rows.length} Assessment{rows.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="divide-y divide-gray-50">
              {rows.map((r: any) => {
                const isOpen   = selected === r.exam.id;
                const attended = r.result ? r.result.attended !== false : true;
                const pct      = r.stats.percentile;
                const rank     = r.stats.rank;
                const total    = r.result?.total;
                const subjects = subjectNames(r.exam);
                return (
                  <div key={r.exam.id} id={`exam-${r.exam.id}`} style={{ background: isOpen ? "#f0f9ff" : undefined }}>
                    <button
                      onClick={() => toggle(r.exam.id)}
                      aria-expanded={isOpen}
                      className="w-full text-left flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3.5 hover:bg-gray-50 transition-colors"
                    >
                      {/* Date pill */}
                      <div className="shrink-0 w-12 sm:w-14 text-center">
                        <p className="text-lg font-black text-gray-800 leading-none">
                          {new Date(r.exam.examDate).getDate()}
                        </p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase mt-0.5">
                          {new Date(r.exam.examDate).toLocaleDateString("en-IN", { month: "short" })}
                        </p>
                      </div>

                      {/* Name + meta */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold text-gray-900 truncate">{r.exam.name}</p>
                          {r.exam.status && r.exam.status !== "DUE" && (
                            <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                              r.exam.status === "MARKED"    ? "bg-sky-50 text-sky-700 border-sky-200" :
                              r.exam.status === "COMPLETED" ? "bg-green-50 text-green-700 border-green-200" :
                              r.exam.status === "CANCELLED" ? "bg-red-50 text-red-700 border-red-200" :
                              "bg-gray-50 text-gray-500 border-gray-200"
                            }`}>
                              {r.exam.status.charAt(0) + r.exam.status.slice(1).toLowerCase()}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5 truncate">
                          {r.exam.startTime} – {r.exam.endTime}
                        </p>
                        {subjects.length > 0 && (
                          <p className="text-xs text-sky-600 font-medium mt-0.5 truncate">
                            {subjects.join(", ")}
                          </p>
                        )}
                      </div>

                      {/* Score */}
                      <div className="shrink-0 text-right">
                        {!r.marksRecorded ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-1 text-[11px] font-bold text-amber-600">
                            <Clock className="h-3 w-3" /> Pending
                          </span>
                        ) : !attended ? (
                          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-bold text-gray-500">
                            Absent
                          </span>
                        ) : total != null ? (
                          <>
                            <p className="text-sm font-black text-gray-900">
                              {total}{r.exam.totalMarks ? `/${r.exam.totalMarks}` : ""}
                            </p>
                            {rank !== null && (
                              <p className={`text-[11px] font-bold mt-0.5 ${scoreColor(pct)}`}>
                                Rank #{rank} · {pct != null ? pct.toFixed(2) : "—"}%ile
                              </p>
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-gray-400">Not marked</span>
                        )}
                      </div>

                      {/* Chevron */}
                      <div className="shrink-0 ml-1 text-gray-300">
                        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </button>

                    {/* Inline detail */}
                    {isOpen && (
                      <div className="border-t border-sky-100 bg-white">
                        <ExamDetail row={r} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
