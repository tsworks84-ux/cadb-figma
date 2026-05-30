"use client";

import { useState, useMemo } from "react";
import { useStudentAuthStore } from "@/store/studentAuth";
import { useQuery } from "@tanstack/react-query";
import { studentApi } from "@/lib/studentApi";
import {
  BarChart2, Clock, ChevronDown, ChevronUp, X,
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

// ── page ─────────────────────────────────────────────────────────────────────

export default function StudentAssessmentsPage() {
  const { accessToken } = useStudentAuthStore();
  const [selected,   setSelected]   = useState<string | null>(null);
  const [filterYear, setFilterYear] = useState("");

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

  const rows: any[] = data ?? [];

  // Performance trend (last 12 attended exams with a percentile)
  const trend = useMemo(
    () =>
      [...rows]
        .filter((r) => r.result?.attended && r.stats.percentile !== null)
        .reverse()
        .slice(-12),
    [rows],
  );

  const selectedRow = rows.find((r) => r.exam.id === selected);

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

      {/* Filter row */}
      <div className="bg-white rounded-xl border border-gray-100 p-3 flex items-center gap-3 flex-wrap">
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
        <span className="text-xs text-gray-400 ml-auto">
          {isLoading ? "…" : `${rows.length} assessment${rows.length !== 1 ? "s" : ""}`}
        </span>
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
          <h2 className="text-lg font-semibold text-gray-600">No assessments yet</h2>
          <p className="text-sm text-gray-400 mt-2 max-w-xs">
            Your exam results will appear here once they are available.
          </p>
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
                      onClick={() => setSelected(r.exam.id === selected ? null : r.exam.id)}
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

          {/* Detail panel */}
          {selectedRow && (
            <div className="bg-white rounded-xl border border-sky-100 overflow-hidden shadow-sm">
              {/* Panel header */}
              <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-100 bg-sky-50/40">
                <div>
                  <p className="text-xs text-sky-600 font-bold uppercase tracking-wider">
                    {new Date(selectedRow.exam.examDate).toLocaleDateString("en-IN", {
                      weekday: "long", day: "numeric", month: "long", year: "numeric",
                    })}
                  </p>
                  <h3 className="text-base font-bold text-gray-900 mt-0.5">{selectedRow.exam.name}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {selectedRow.exam.startTime} – {selectedRow.exam.endTime} · {selectedRow.exam.batches.join(", ")}
                  </p>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 shrink-0"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Stats */}
              {!selectedRow.marksRecorded ? (
                <div className="px-5 py-8 text-center">
                  <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 border border-amber-200 px-4 py-2 text-sm font-semibold text-amber-700">
                    <Clock className="h-4 w-4" /> Marks not entered yet
                  </div>
                  <p className="text-xs text-gray-400 mt-3">
                    This exam is scheduled for your batch. Once marks are entered, your scores will appear here.
                  </p>
                </div>
              ) : selectedRow.result ? (
                <div className="px-5 py-4 space-y-5">
                  {/* 4 KPI cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      {
                        label: "Score",
                        value: selectedRow.result.total != null
                          ? `${selectedRow.result.total}${selectedRow.exam.totalMarks ? `/${selectedRow.exam.totalMarks}` : ""}`
                          : "—",
                        sub: selectedRow.exam.totalMarks && selectedRow.result.total != null
                          ? `${Math.round((selectedRow.result.total / selectedRow.exam.totalMarks) * 100)}%`
                          : "",
                        color: "text-sky-700", bg: "bg-sky-50 border-sky-100",
                      },
                      {
                        label: "Rank",
                        value: selectedRow.stats.rank != null ? `#${selectedRow.stats.rank}` : "—",
                        sub: selectedRow.stats.totalStudents ? `of ${selectedRow.stats.totalStudents}` : "",
                        color: "text-amber-700", bg: "bg-amber-50 border-amber-100",
                      },
                      {
                        label: "Percentile",
                        value: selectedRow.stats.percentile != null
                          ? `${selectedRow.stats.percentile.toFixed(2)}`
                          : "—",
                        sub: "NTA-style percentile",
                        color: scoreColor(selectedRow.stats.percentile),
                        bg: scoreBg(selectedRow.stats.percentile),
                      },
                      {
                        label: "Class Avg",
                        value: selectedRow.stats.classAvg != null ? String(selectedRow.stats.classAvg) : "—",
                        sub: selectedRow.stats.classMax != null ? `Highest: ${selectedRow.stats.classMax}` : "",
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
                  {selectedRow.result.marks.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                        {selectedRow.exam.numPapers > 1 ? "Paper-wise & Subject-wise Marks" : "Subject-wise Marks"}
                      </p>
                      {Array.from({ length: selectedRow.exam.numPapers }, (_, pi) => {
                        const paperMarks = selectedRow.result!.marks.filter((m: any) => m.paperNum === pi + 1);
                        if (paperMarks.length === 0) return null;
                        return (
                          <div key={pi} className="mb-4">
                            {selectedRow.exam.numPapers > 1 && (
                              <p className="text-xs font-semibold text-gray-500 mb-2">Paper {pi + 1}</p>
                            )}
                            <div className="space-y-2">
                              {paperMarks.map((m: any) => {
                                const pct = m.maxMarks ? Math.round((m.marks / m.maxMarks) * 100) : null;
                                return (
                                  <div key={`${m.paperNum}-${m.subjectSlot}`}
                                    className="flex items-center gap-3 rounded-lg bg-gray-50 px-4 py-2.5">
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
                                      {pct !== null && (
                                        <p className="text-[10px] text-gray-400">{pct}%</p>
                                      )}
                                    </div>
                                    {m.maxMarks && (
                                      <div className="w-20 shrink-0">
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
              ) : (
                <div className="px-5 py-6 text-center text-sm text-gray-400">Marks not available</div>
              )}
            </div>
          )}

          {/* Exam list */}
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
                return (
                  <button
                    key={r.exam.id}
                    onClick={() => setSelected(isOpen ? null : r.exam.id)}
                    className="w-full text-left flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors"
                    style={{ background: isOpen ? "#f0f9ff" : undefined }}
                  >
                    {/* Date pill */}
                    <div className="shrink-0 w-14 text-center">
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
                      {r.exam.subjects && r.exam.subjects.length > 0 && (
                        <p className="text-xs text-sky-600 font-medium mt-0.5 truncate">
                          {[...new Set((r.exam.subjects as any[]).map((es: any) => es.subject?.name).filter(Boolean))].join(", ")}
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
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
