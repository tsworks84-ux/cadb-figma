"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { studentApi } from "@/lib/studentApi";
import { useStudentAuthStore } from "@/store/studentAuth";
import { GraduationCap, ChevronLeft, ChevronRight } from "lucide-react";

function attBadge(s: string | null | undefined) {
  if (!s) return null;
  if (s === "PRESENT") return { label: "Present", bg: "bg-green-50",  text: "text-green-700",  border: "border-green-200" };
  if (s === "ABSENT")  return { label: "Absent",  bg: "bg-red-50",    text: "text-red-700",    border: "border-red-200"   };
  return null;
}

function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function startOfWeek(d: Date)        { const r = new Date(d); r.setDate(r.getDate() - r.getDay()); return r; }
function isoDate(d: Date)            { return d.toISOString().split("T")[0]; }
function fmtTime(t: string | null | undefined) {
  if (!t) return "—";
  return new Date(t).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

export default function StudentSchedulePage() {
  const { accessToken } = useStudentAuthStore();
  const [weekOffset, setWeekOffset] = useState(0);

  const weekStart = useMemo(() => addDays(startOfWeek(new Date()), weekOffset * 7), [weekOffset]);
  const weekEnd   = addDays(weekStart, 6);

  const { data, isLoading } = useQuery({
    queryKey: ["student-portal-schedule", isoDate(weekStart), isoDate(weekEnd)],
    queryFn:  () => studentApi.get(`/api/v1/student/portal/schedule?dateFrom=${isoDate(weekStart)}&dateTo=${isoDate(weekEnd)}`).then((r) => r.data),
    staleTime: 0, refetchOnWindowFocus: true, enabled: !!accessToken,
  });

  const schedules: any[] = data?.data ?? [];

  const byDate = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const s of schedules) {
      const key = (s.date as string).split("T")[0];
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return map;
  }, [schedules]);

  const days     = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const todayStr = isoDate(new Date());
  const weekLabel = `${weekStart.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – ${weekEnd.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-teal-100 flex items-center justify-center">
            <GraduationCap className="h-4 w-4 text-teal-600" />
          </div>
          <h1 className="text-lg font-bold text-gray-900">My Schedule</h1>
        </div>

        {/* Week navigator */}
        <div className="flex items-center gap-2 bg-white rounded-xl border border-gray-200 shadow-sm px-2 py-1.5">
          <button onClick={() => setWeekOffset((w) => w - 1)}
            className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-gray-500">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs font-semibold text-gray-700 min-w-[152px] text-center">{weekLabel}</span>
          <button onClick={() => setWeekOffset((w) => w + 1)}
            className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-gray-500">
            <ChevronRight className="h-4 w-4" />
          </button>
          {weekOffset !== 0 && (
            <button onClick={() => setWeekOffset(0)}
              className="text-xs font-semibold text-sky-600 hover:text-sky-700 px-2 py-1 rounded-lg hover:bg-sky-50 transition-colors ml-1">
              Today
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="h-6 w-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : schedules.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center py-20 text-center px-6">
          <GraduationCap className="h-10 w-10 text-gray-200 mb-3" />
          <p className="text-sm font-semibold text-gray-400">No classes this week</p>
          <p className="text-xs text-gray-300 mt-1">Your timetable will appear here once it&apos;s set up.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {days.map((day) => {
            const key     = isoDate(day);
            const classes = byDate.get(key) ?? [];
            const isToday = key === todayStr;
            const dayLabel = day.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" });

            if (classes.length === 0) return null;

            return (
              <div key={key}>
                {/* Day header */}
                <div className="flex items-center gap-2 mb-2 px-1">
                  <span className={`text-xs font-bold uppercase tracking-widest ${isToday ? "text-sky-600" : "text-gray-400"}`}>
                    {dayLabel}
                  </span>
                  {isToday && (
                    <span className="inline-flex h-5 items-center rounded-full bg-sky-100 px-2 text-[10px] font-bold text-sky-700">
                      Today
                    </span>
                  )}
                  <span className="text-xs text-gray-300">{classes.length} class{classes.length !== 1 ? "es" : ""}</span>
                </div>

                <div className="space-y-2">
                  {classes.map((c: any) => {
                    const att    = attBadge(c.attendanceStatus);
                    const isCancelled = c.status === "CANCELLED";
                    return (
                      <div key={c.id}
                        className={`rounded-xl border flex overflow-hidden shadow-sm transition-opacity ${
                          isCancelled ? "opacity-60 border-red-100 bg-red-50/30" : isToday ? "border-sky-100 bg-sky-50/20" : "border-gray-100 bg-white"
                        }`}>
                        {/* Time column */}
                        <div className={`shrink-0 w-20 flex flex-col items-center justify-center py-3 border-r text-center gap-0.5 ${
                          isToday ? "bg-sky-50/60 border-sky-100" : "bg-gray-50/80 border-gray-100"
                        }`}>
                          <p className={`text-xs font-bold ${isToday ? "text-sky-700" : "text-gray-700"}`}>{fmtTime(c.startTime)}</p>
                          <p className="text-[10px] text-gray-400">–</p>
                          <p className={`text-xs font-medium ${isToday ? "text-sky-500" : "text-gray-500"}`}>{fmtTime(c.endTime)}</p>
                        </div>

                        {/* Content */}
                        <div className="flex-1 px-4 py-3 flex items-center gap-3 min-w-0">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-800 truncate">
                              {c.subject?.name ?? "—"}
                              {c.subject?.code && (
                                <span className="ml-1.5 text-xs font-normal text-gray-400">({c.subject.code})</span>
                              )}
                            </p>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                              {c.faculty && (
                                <span className="text-xs text-gray-400">{c.faculty.firstName} {c.faculty.lastName}</span>
                              )}
                              {c.mode === "ONLINE"
                                ? <span className="text-[10px] font-semibold rounded-full px-2 py-0.5 bg-teal-50 text-teal-700 border border-teal-100">🌐 Online</span>
                                : <span className="text-[10px] font-semibold rounded-full px-2 py-0.5 bg-gray-100 text-gray-500 border border-gray-200">🏫 Offline</span>
                              }
                              {isCancelled && (
                                <span className="text-[10px] font-bold rounded-full px-2 py-0.5 bg-red-100 text-red-600">Cancelled</span>
                              )}
                            </div>
                            {c.topics && <p className="text-xs text-gray-400 truncate mt-0.5">{c.topics}</p>}
                          </div>

                          {att && (
                            <span className={`shrink-0 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold border ${att.bg} ${att.text} ${att.border}`}>
                              {att.label}
                            </span>
                          )}
                        </div>
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
