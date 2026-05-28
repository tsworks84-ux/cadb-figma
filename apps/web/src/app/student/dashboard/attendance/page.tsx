"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { studentApi } from "@/lib/studentApi";
import { useStudentAuthStore } from "@/store/studentAuth";
import { CalendarCheck } from "lucide-react";

function attStyle(s: string) {
  if (s === "PRESENT") return { bar: "bg-green-500", bg: "bg-green-50", text: "text-green-700", border: "border-green-200", label: "Present" };
  if (s === "ABSENT")  return { bar: "bg-red-500",   bg: "bg-red-50",   text: "text-red-700",   border: "border-red-200",   label: "Absent"  };
  return { bar: "bg-gray-300", bg: "bg-gray-50", text: "text-gray-500", border: "border-gray-200", label: "Unrecorded" };
}
const pctTextColor = (p: number) => p >= 85 ? "text-green-600" : p >= 75 ? "text-amber-600" : "text-red-600";
const pctBarColor  = (p: number) => p >= 85 ? "bg-green-500"   : p >= 75 ? "bg-amber-500"   : "bg-red-500";

export default function StudentAttendancePage() {
  const { accessToken } = useStudentAuthStore();
  const today = new Date();
  const defaultFrom = new Date(today.getFullYear(), today.getMonth() - 2, 1);

  const [dateFrom, setDateFrom] = useState(defaultFrom.toISOString().split("T")[0]);
  const [dateTo,   setDateTo]   = useState(today.toISOString().split("T")[0]);
  const [subjectFilter, setSubjectFilter] = useState("");
  const [view, setView] = useState<"classes" | "stats">("classes");

  const params = new URLSearchParams({ dateFrom, dateTo });
  if (subjectFilter) params.set("subjectId", subjectFilter);

  const { data, isLoading } = useQuery({
    queryKey: ["student-portal-attendance", dateFrom, dateTo, subjectFilter],
    queryFn: () => studentApi.get(`/api/v1/student/portal/attendance?${params}`).then((r) => r.data),
    staleTime: 2 * 60 * 1000,
    enabled: !!accessToken,
  });

  const classes: any[] = data?.data ?? [];
  const stats = data?.stats ?? { total: 0, present: 0, absent: 0, unrecorded: 0, percentage: 0, bySubject: [] };

  const subjects = useMemo(() => {
    const map = new Map<string, { id: string; name: string; code: string }>();
    for (const c of classes) { if (c.subject) map.set(c.subject.id, c.subject); }
    return Array.from(map.values());
  }, [classes]);

  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const c of classes) {
      const key = (c.date as string).split("T")[0];
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [classes]);

  const monthlyTrend = useMemo(() => {
    const map = new Map<string, { label: string; total: number; present: number; absent: number }>();
    for (const c of classes) {
      const d = new Date(c.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
      if (!map.has(key)) map.set(key, { label, total: 0, present: 0, absent: 0 });
      const entry = map.get(key)!;
      entry.total++;
      if (c.attendanceStatus === "PRESENT") entry.present++;
      else if (c.attendanceStatus === "ABSENT") entry.absent++;
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, v]) => ({
        ...v,
        percentage: v.present + v.absent > 0 ? Math.round((v.present / (v.present + v.absent)) * 100) : 0,
      }));
  }, [classes]);

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <CalendarCheck className="h-5 w-5 text-emerald-500" />
        <h1 className="text-lg font-bold text-gray-900">My Attendance</h1>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden shrink-0">
            {(["classes", "stats"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                  view === v ? "bg-emerald-600 text-white" : "text-gray-500 hover:bg-gray-50"
                }`}>
                {v === "classes" ? "Class List" : "Statistics"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-gray-400 font-medium whitespace-nowrap">From</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-700 focus:outline-none focus:border-emerald-400" />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-gray-400 font-medium whitespace-nowrap">To</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-700 focus:outline-none focus:border-emerald-400" />
            </div>
          </div>
          {subjects.length > 0 && (
            <select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}
              className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-700 bg-white focus:outline-none focus:border-emerald-400">
              <option value="">All Subjects</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Classes", value: String(stats.total),      color: "text-gray-800",  bg: "bg-white"      },
          { label: "Present",       value: String(stats.present),    color: "text-green-700", bg: "bg-green-50"   },
          { label: "Absent",        value: String(stats.absent),     color: "text-red-700",   bg: "bg-red-50"     },
          { label: "Attendance %",  value: `${stats.percentage}%`,   color: pctTextColor(stats.percentage), bg: "bg-emerald-50" },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`${bg} rounded-xl border border-gray-100 px-4 py-3 text-center`}>
            <p className={`text-2xl font-black ${color}`}>{isLoading ? "—" : value}</p>
            <p className="text-xs text-gray-400 mt-0.5 font-medium">{label}</p>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="h-6 w-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : classes.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 text-center">
          <CalendarCheck className="h-8 w-8 text-gray-200 mb-3" />
          <p className="text-sm font-semibold text-gray-400">No classes found</p>
          <p className="text-xs text-gray-400 mt-1">Try adjusting the date range or subject filter.</p>
        </div>
      ) : view === "classes" ? (
        <div className="space-y-5">
          {grouped.map(([dateKey, dayClasses]) => {
            const d = new Date(dateKey + "T00:00:00");
            const dayLabel = d.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
            return (
              <div key={dateKey}>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">{dayLabel}</p>
                <div className="space-y-2">
                  {dayClasses.map((c: any) => {
                    const col   = attStyle(c.attendanceStatus);
                    const start = new Date(c.startTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
                    const end   = new Date(c.endTime).toLocaleTimeString("en-IN",   { hour: "2-digit", minute: "2-digit", hour12: true });
                    return (
                      <div key={c.id} className={`bg-white rounded-xl border ${col.border} flex overflow-hidden`}>
                        <div className={`w-1.5 shrink-0 ${col.bar}`} />
                        <div className="flex-1 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 min-w-0">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-800 truncate">
                              {c.subject ? c.subject.name : "—"}
                              {c.subject?.code && <span className="ml-1.5 text-xs font-normal text-gray-400">({c.subject.code})</span>}
                            </p>
                            {c.topics && <p className="text-xs text-gray-400 truncate mt-0.5">{c.topics}</p>}
                            {c.faculty && (
                              <p className="text-xs text-gray-400 mt-0.5">{c.faculty.firstName} {c.faculty.lastName}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-3 sm:flex-col sm:items-end shrink-0">
                            <p className="text-xs text-gray-400 font-medium whitespace-nowrap">{start} – {end}</p>
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${col.bg} ${col.text}`}>
                              {col.label}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Monthly trend */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50">
              <p className="text-sm font-semibold text-gray-800">Monthly Attendance Trend</p>
            </div>
            <div className="px-5 py-4 space-y-3">
              {monthlyTrend.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No data</p>
              ) : monthlyTrend.map((m) => (
                <div key={m.label} className="flex items-center gap-3">
                  <p className="text-xs font-medium text-gray-500 w-20 shrink-0">{m.label}</p>
                  <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div className={`h-2 rounded-full transition-all ${pctBarColor(m.percentage)}`}
                      style={{ width: `${m.percentage}%` }} />
                  </div>
                  <p className={`text-xs font-bold w-9 text-right shrink-0 ${pctTextColor(m.percentage)}`}>{m.percentage}%</p>
                  <p className="text-xs text-gray-400 w-16 text-right shrink-0">{m.present}/{m.present + m.absent} cls</p>
                </div>
              ))}
            </div>
          </div>

          {/* Subject breakdown */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50">
              <p className="text-sm font-semibold text-gray-800">Subject-wise Breakdown</p>
            </div>
            {stats.bySubject.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No subject data</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {(stats.bySubject as any[]).map((s) => (
                  <div key={s.id} className="px-5 py-3 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{s.name}</p>
                      <p className="text-xs text-gray-400">{s.code}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-green-600 font-medium">{s.present}P</span>
                      <span className="text-xs text-gray-300">·</span>
                      <span className="text-xs text-red-600 font-medium">{s.absent}A</span>
                      <span className="text-xs text-gray-300">·</span>
                      <span className={`text-sm font-black ${pctTextColor(s.percentage)}`}>{s.percentage}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
