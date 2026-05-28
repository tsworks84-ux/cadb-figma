"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { studentApi } from "@/lib/studentApi";
import { useStudentAuthStore } from "@/store/studentAuth";
import { GraduationCap, ChevronLeft, ChevronRight } from "lucide-react";

function statusLabel(s: string | null | undefined) {
  if (!s) return null;
  if (s === "PRESENT") return { label: "Present", bg: "bg-green-50", text: "text-green-700" };
  if (s === "ABSENT")  return { label: "Absent",  bg: "bg-red-50",   text: "text-red-700"   };
  return { label: "—", bg: "bg-gray-50", text: "text-gray-400" };
}

function scheduleStatusColor(status: string) {
  if (status === "CONCLUDED")  return "border-gray-200 bg-white";
  if (status === "COMPLETED")  return "border-gray-200 bg-white";
  if (status === "CANCELLED")  return "border-red-100 bg-red-50/30";
  return "border-emerald-100 bg-white"; // UPCOMING
}

function addDays(d: Date, n: number) {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}
function startOfWeek(d: Date) {
  const r = new Date(d); r.setDate(r.getDate() - r.getDay()); return r;
}
function isoDate(d: Date) {
  return d.toISOString().split("T")[0];
}

export default function StudentSchedulePage() {
  const { accessToken } = useStudentAuthStore();
  const [weekOffset, setWeekOffset] = useState(0);

  const weekStart = useMemo(() => {
    const base = startOfWeek(new Date());
    return addDays(base, weekOffset * 7);
  }, [weekOffset]);

  const weekEnd = addDays(weekStart, 6);

  const { data, isLoading } = useQuery({
    queryKey: ["student-portal-schedule", isoDate(weekStart), isoDate(weekEnd)],
    queryFn: () =>
      studentApi.get(`/api/v1/student/portal/schedule?dateFrom=${isoDate(weekStart)}&dateTo=${isoDate(weekEnd)}`).then((r) => r.data),
    staleTime: 5 * 60 * 1000,
    enabled: !!accessToken,
  });

  const schedules: any[] = data?.data ?? [];

  // Group by date
  const byDate = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const s of schedules) {
      const key = (s.date as string).split("T")[0];
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return map;
  }, [schedules]);

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const isCurrentWeek = weekOffset === 0;
  const todayStr = isoDate(new Date());

  const weekLabel = `${weekStart.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – ${weekEnd.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-blue-500" />
          <h1 className="text-lg font-bold text-gray-900">My Schedule</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekOffset((w) => w - 1)}
            className="h-8 w-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
            <ChevronLeft className="h-4 w-4 text-gray-500" />
          </button>
          <span className="text-xs font-medium text-gray-600 min-w-[160px] text-center">{weekLabel}</span>
          <button onClick={() => setWeekOffset((w) => w + 1)}
            className="h-8 w-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
            <ChevronRight className="h-4 w-4 text-gray-500" />
          </button>
          {weekOffset !== 0 && (
            <button onClick={() => setWeekOffset(0)}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors">
              Today
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : schedules.length === 0 && !isLoading ? (
        <div className="bg-white rounded-xl border border-gray-100 flex flex-col items-center justify-center py-20 text-center px-6">
          <GraduationCap className="h-10 w-10 text-gray-200 mb-3" />
          <p className="text-sm font-semibold text-gray-400">No classes this week</p>
          <p className="text-xs text-gray-300 mt-1">Your timetable will appear here once it is set up.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {days.map((day) => {
            const key = isoDate(day);
            const classes = byDate.get(key) ?? [];
            const isToday = key === todayStr;
            const dayLabel = day.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" });

            if (classes.length === 0) return null;

            return (
              <div key={key}>
                <div className={`flex items-center gap-2 mb-2 px-1`}>
                  <span className={`text-xs font-semibold uppercase tracking-wide ${isToday ? "text-blue-600" : "text-gray-400"}`}>
                    {dayLabel}
                  </span>
                  {isToday && (
                    <span className="inline-flex h-4 items-center rounded-full bg-blue-100 px-2 text-[10px] font-bold text-blue-600">Today</span>
                  )}
                </div>
                <div className="space-y-2">
                  {classes.map((c: any) => {
                    const att    = statusLabel(c.attendanceStatus);
                    const start  = new Date(c.startTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
                    const end    = new Date(c.endTime).toLocaleTimeString("en-IN",   { hour: "2-digit", minute: "2-digit", hour12: true });
                    return (
                      <div key={c.id} className={`rounded-xl border flex overflow-hidden ${scheduleStatusColor(c.status)}`}>
                        {/* Time column */}
                        <div className="shrink-0 w-20 flex flex-col items-center justify-center py-3 bg-gray-50/80 border-r border-gray-100 text-center gap-0.5">
                          <p className="text-xs font-bold text-gray-700">{start}</p>
                          <p className="text-[10px] text-gray-400">–</p>
                          <p className="text-xs font-medium text-gray-500">{end}</p>
                        </div>
                        {/* Content */}
                        <div className="flex-1 px-4 py-3 flex items-center gap-3 min-w-0">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-800 truncate">
                              {c.subject?.name ?? "—"}
                              {c.subject?.code && <span className="ml-1.5 text-xs font-normal text-gray-400">({c.subject.code})</span>}
                            </p>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                              {c.faculty && (
                                <span className="text-xs text-gray-400">{c.faculty.firstName} {c.faculty.lastName}</span>
                              )}
                              {c.mode === "ONLINE"
                                ? <span className="text-[10px] font-semibold rounded-full px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100">🌐 Online</span>
                                : <span className="text-[10px] font-semibold rounded-full px-2 py-0.5 bg-slate-50 text-slate-500 border border-slate-200">🏫 Offline</span>
                              }
                            </div>
                            {c.topics && <p className="text-xs text-gray-400 truncate mt-0.5">{c.topics}</p>}
                          </div>
                          {att && (
                            <span className={`shrink-0 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${att.bg} ${att.text}`}>
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
