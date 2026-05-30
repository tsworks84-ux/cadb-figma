"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  ComposedChart, Area, Line, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, CartesianGrid, BarChart, Bar, Cell,
} from "recharts";
import {
  X, TrendingUp, CalendarCheck, ClipboardList, BarChart2, Loader2,
} from "lucide-react";

const COLORS = ["#a5b4fc", "#6ee7b7", "#fcd34d", "#f9a8d4", "#93c5fd", "#fdba74", "#86efac", "#c4b5fd"];

const PRESETS = [
  { key: "1m",  label: "1 Month" },
  { key: "3m",  label: "3 Months" },
  { key: "6m",  label: "6 Months" },
  { key: "1y",  label: "1 Year" },
  { key: "all", label: "All Time" },
  { key: "custom", label: "Custom" },
] as const;
type Preset = typeof PRESETS[number]["key"];

function getDateRange(preset: Preset, customFrom: string, customTo: string) {
  if (preset === "all")    return { from: "", to: "" };
  if (preset === "custom") return { from: customFrom, to: customTo };
  const now  = new Date();
  const days: Record<string, number> = { "1m": 30, "3m": 90, "6m": 180, "1y": 365 };
  const from = new Date(now.getTime() - days[preset] * 86400_000);
  return {
    from: from.toISOString().slice(0, 10),
    to:   now.toISOString().slice(0, 10),
  };
}

function fmtShort(iso: string | null | undefined) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }); }
  catch { return "—"; }
}

function TrendTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-lg p-3 text-xs max-w-[200px]">
      <p className="font-semibold text-gray-700 mb-2 truncate">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2 mb-0.5">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
          <span className="text-gray-500 truncate">{p.name}:</span>
          <span className="font-semibold text-gray-800 ml-auto">{p.value != null ? p.value : "—"}</span>
        </div>
      ))}
    </div>
  );
}

function SectionHeader({ icon, title, count, unit }: { icon: React.ReactNode; title: string; count?: number; unit?: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      {icon}
      <p className="text-sm font-semibold text-gray-800">{title}</p>
      {count != null && (
        <span className="text-xs text-gray-400">{count} {unit ?? "items"}</span>
      )}
    </div>
  );
}

function MiniStatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  const colors: Record<string, string> = {
    blue:   "bg-blue-50   text-blue-700",
    indigo: "bg-indigo-50 text-indigo-700",
    green:  "bg-green-50  text-green-700",
    amber:  "bg-amber-50  text-amber-700",
  };
  return (
    <div className={`rounded-xl p-3 border border-gray-100 ${colors[color] ?? colors.indigo}`}>
      <p className="text-xl font-bold tabular-nums">{value}</p>
      <p className="text-[10px] font-medium opacity-70 mt-0.5">{label}</p>
    </div>
  );
}

interface Props {
  batchId: string;
  open: boolean;
  onClose: () => void;
}

export function BatchStatsPanel({ batchId, open, onClose }: Props) {
  const [preset, setPreset]         = useState<Preset>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo,   setCustomTo]   = useState("");

  const { from, to } = useMemo(
    () => getDateRange(preset, customFrom, customTo),
    [preset, customFrom, customTo],
  );

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (from) p.set("dateFrom", from);
    if (to)   p.set("dateTo",   to);
    return p.toString();
  }, [from, to]);

  const { data, isLoading } = useQuery({
    queryKey: ["batch-stats", batchId, params],
    queryFn:  () => api.get(`/api/v1/academics/batches/${batchId}/stats${params ? `?${params}` : ""}`).then((r) => r.data.data),
    enabled:  open,
    staleTime: 30_000,
  });

  // ── Attendance chart data ───────────────────────────────────────────────────
  const attTrend = useMemo(() =>
    (data?.attendance?.trend ?? []).map((c: any) => ({
      name:     fmtShort(c.date),
      fullName: `${fmtShort(c.date)}${c.subject ? ` · ${c.subject}` : ""}`,
      "Att %":  c.pct,
    })),
  [data]);

  const attSubj = useMemo(() =>
    (data?.attendance?.subjectBreakdown ?? []).map((s: any) => ({
      name:    s.subject.length > 14 ? s.subject.slice(0, 12) + "…" : s.subject,
      full:    s.subject,
      "Avg %": s.avgPct,
      Classes: s.classCount,
    })),
  [data]);

  // ── Assignment chart data ───────────────────────────────────────────────────
  const assignTrend = useMemo(() =>
    (data?.assignments?.trend ?? []).map((a: any) => ({
      name:       fmtShort(a.date),
      fullName:   a.name,
      "Comp %":   a.pct,
    })),
  [data]);

  const assignSubj = useMemo(() =>
    (data?.assignments?.subjectBreakdown ?? []).map((s: any) => ({
      name:    s.subject.length > 14 ? s.subject.slice(0, 12) + "…" : s.subject,
      full:    s.subject,
      "Given": s.given,
      "Avg Comp %": s.avgCompletionPct,
    })),
  [data]);

  // ── Assessment chart data ───────────────────────────────────────────────────
  const examTrend = useMemo(() =>
    (data?.assessments?.trend ?? []).map((e: any) => ({
      name:       fmtShort(e.date),
      fullName:   e.name,
      "Score %":  e.avgPct,
      "Att %":    e.attendPct,
    })),
  [data]);

  const examSubj = useMemo(() =>
    (data?.assessments?.subjectBreakdown ?? []).map((s: any) => ({
      name:    s.subject.length > 14 ? s.subject.slice(0, 12) + "…" : s.subject,
      full:    s.subject,
      "Avg %": s.avgPct,
    })),
  [data]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      <div className="relative w-full max-w-2xl bg-white shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-indigo-600" />
            <p className="font-semibold text-gray-900">Batch Statistics</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Date filter */}
        <div className="px-5 py-3 border-b border-gray-100 shrink-0 bg-gray-50/60">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide shrink-0">Period</span>
            <div className="flex gap-1.5 flex-wrap">
              {PRESETS.map(({ key, label }) => (
                <button key={key} onClick={() => setPreset(key)}
                  className={`px-2.5 py-1 text-xs rounded-full font-medium border transition-colors ${
                    preset === key
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                  }`}>
                  {label}
                </button>
              ))}
            </div>
            {preset === "custom" && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <input type="date" max="2099-12-31" min="1900-01-01" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
                  className="text-xs rounded-lg border border-gray-200 px-2 py-1 focus:outline-none focus:border-indigo-400" />
                <span className="text-gray-400 text-xs">→</span>
                <input type="date" max="2099-12-31" min="1900-01-01" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
                  className="text-xs rounded-lg border border-gray-200 px-2 py-1 focus:outline-none focus:border-indigo-400" />
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-7">
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
            </div>
          ) : (
            <>
              {/* ── Attendance ─────────────────────────────────────────────── */}
              <section>
                <SectionHeader
                  icon={<CalendarCheck className="h-3.5 w-3.5 text-blue-500" />}
                  title="Attendance"
                  count={data?.attendance?.totalClasses}
                  unit="classes"
                />

                {/* Summary cards */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <MiniStatCard label="Total Classes" value={data?.attendance?.totalClasses ?? "—"} color="blue" />
                  <MiniStatCard label="Avg Attendance" value={data?.attendance?.avgPct != null ? `${data.attendance.avgPct}%` : "—"} color="indigo" />
                </div>

                {attTrend.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-6 bg-white rounded-xl border border-gray-100">No attendance data in this period.</p>
                ) : (
                  <div className="space-y-3">
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                      <p className="text-xs font-semibold text-gray-500 mb-3">Attendance % Over Time</p>
                      <ResponsiveContainer width="100%" height={160}>
                        <ComposedChart data={attTrend} margin={{ top: 4, right: 4, left: -18, bottom: 28 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                          <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#9ca3af" }} angle={-35} textAnchor="end" interval={Math.ceil(attTrend.length / 12)} />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "#9ca3af" }} width={28} />
                          <Tooltip content={<TrendTooltip />} />
                          <Area type="monotone" dataKey="Att %" stroke="#3b82f6" fill="#dbeafe" strokeWidth={2} dot={{ r: 2, fill: "#3b82f6" }} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>

                    {attSubj.length > 1 && (
                      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                        <p className="text-xs font-semibold text-gray-500 mb-3">Subject-wise Avg Attendance</p>
                        <ResponsiveContainer width="100%" height={140}>
                          <BarChart data={attSubj} margin={{ top: 4, right: 4, left: -18, bottom: 28 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                            <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#9ca3af" }} angle={-30} textAnchor="end" interval={0} />
                            <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "#9ca3af" }} width={28} />
                            <Tooltip content={<TrendTooltip />} />
                            <Bar dataKey="Avg %" radius={[3, 3, 0, 0]}>
                              {attSubj.map((_: unknown, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                )}
              </section>

              {/* ── Assignments ────────────────────────────────────────────── */}
              <section>
                <SectionHeader
                  icon={<ClipboardList className="h-3.5 w-3.5 text-indigo-500" />}
                  title="Assignments"
                  count={data?.assignments?.total}
                  unit="assignments"
                />

                <div className="grid grid-cols-2 gap-2 mb-4">
                  <MiniStatCard label="Total Given" value={data?.assignments?.total ?? "—"} color="indigo" />
                  <MiniStatCard label="Avg Completion" value={data?.assignments?.avgCompletionPct != null ? `${data.assignments.avgCompletionPct}%` : "—"} color="green" />
                </div>

                {assignTrend.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-6 bg-white rounded-xl border border-gray-100">No assignments in this period.</p>
                ) : (
                  <div className="space-y-3">
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                      <p className="text-xs font-semibold text-gray-500 mb-3">Completion % per Assignment</p>
                      <ResponsiveContainer width="100%" height={160}>
                        <BarChart data={assignTrend} margin={{ top: 4, right: 4, left: -18, bottom: 28 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                          <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#9ca3af" }} angle={-35} textAnchor="end" interval={Math.ceil(assignTrend.length / 12)} />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "#9ca3af" }} width={28} />
                          <Tooltip content={<TrendTooltip />} />
                          <Bar dataKey="Comp %" radius={[3, 3, 0, 0]}>
                            {assignTrend.map((_: unknown, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {assignSubj.length > 0 && (
                      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="px-4 py-3 border-b border-gray-50">
                          <p className="text-xs font-semibold text-gray-500">Subject-wise Assignments</p>
                        </div>
                        <table className="w-full text-xs">
                          <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                              <th className="px-3 py-2 text-left text-gray-500 font-semibold">Subject</th>
                              <th className="px-3 py-2 text-center text-gray-500 font-semibold">Given</th>
                              <th className="px-3 py-2 text-center text-gray-500 font-semibold">Avg Comp %</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {assignSubj.map((s: typeof assignSubj[0], i: number) => (
                              <tr key={i} className="hover:bg-gray-50/60">
                                <td className="px-3 py-2 font-medium text-gray-700">{s.full}</td>
                                <td className="px-3 py-2 text-center text-gray-500">{s["Given"]}</td>
                                <td className="px-3 py-2 text-center font-semibold text-indigo-600">
                                  {s["Avg Comp %"] != null ? `${s["Avg Comp %"]}%` : "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </section>

              {/* ── Assessments ────────────────────────────────────────────── */}
              <section>
                <SectionHeader
                  icon={<BarChart2 className="h-3.5 w-3.5 text-green-500" />}
                  title="Assessments"
                  count={data?.assessments?.total}
                  unit="exams"
                />

                <div className="grid grid-cols-2 gap-2 mb-4">
                  <MiniStatCard label="Total Exams" value={data?.assessments?.total ?? "—"} color="green" />
                  <MiniStatCard label="Avg Score" value={data?.assessments?.avgScorePct != null ? `${data.assessments.avgScorePct}%` : "—"} color="amber" />
                </div>

                {examTrend.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-6 bg-white rounded-xl border border-gray-100">No assessments in this period.</p>
                ) : (
                  <div className="space-y-3">
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                      <p className="text-xs font-semibold text-gray-500 mb-3">Avg Score % Over Time</p>
                      <ResponsiveContainer width="100%" height={180}>
                        <ComposedChart data={examTrend} margin={{ top: 4, right: 4, left: -18, bottom: 28 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                          <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#9ca3af" }} angle={-35} textAnchor="end" interval={Math.ceil(examTrend.length / 12)} />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "#9ca3af" }} width={28} />
                          <Tooltip content={<TrendTooltip />} />
                          <Legend wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
                          <Area type="monotone" dataKey="Score %" stroke="#10b981" fill="#d1fae5" strokeWidth={2} dot={{ r: 2, fill: "#10b981" }} />
                          <Line type="monotone" dataKey="Att %" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>

                    {examSubj.length > 0 && (
                      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                        <p className="text-xs font-semibold text-gray-500 mb-3">Subject-wise Avg Score</p>
                        <ResponsiveContainer width="100%" height={140}>
                          <BarChart data={examSubj} margin={{ top: 4, right: 4, left: -18, bottom: 28 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                            <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#9ca3af" }} angle={-30} textAnchor="end" interval={0} />
                            <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "#9ca3af" }} width={28} />
                            <Tooltip content={<TrendTooltip />} />
                            <Bar dataKey="Avg %" radius={[3, 3, 0, 0]}>
                              {examSubj.map((_: unknown, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
