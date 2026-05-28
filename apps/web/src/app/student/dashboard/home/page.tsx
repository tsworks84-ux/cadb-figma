"use client";

import { useStudentAuthStore } from "@/store/studentAuth";
import { useQuery } from "@tanstack/react-query";
import { studentApi } from "@/lib/studentApi";
import { CalendarDays, ClipboardList, BookOpen, Bell, Clock, TrendingUp, GraduationCap, ChevronRight, Info, AlertTriangle, AlertCircle, Pin, MapPin } from "lucide-react";
import { formatDate } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type AnnType = "GENERAL" | "IMPORTANT" | "URGENT";
const ANN_META: Record<AnnType, { border: string; bg: string; icon: React.ElementType; iconColor: string; badge: string }> = {
  GENERAL:   { border: "border-l-blue-400",   bg: "bg-blue-50",   icon: Info,          iconColor: "text-blue-500",   badge: "bg-blue-100 text-blue-700" },
  IMPORTANT: { border: "border-l-orange-400", bg: "bg-orange-50", icon: AlertTriangle,  iconColor: "text-orange-500", badge: "bg-orange-100 text-orange-700" },
  URGENT:    { border: "border-l-red-500",    bg: "bg-red-50",    icon: AlertCircle,   iconColor: "text-red-500",    badge: "bg-red-100 text-red-700" },
};

export default function StudentHomePage() {
  const { student, accessToken } = useStudentAuthStore();
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  // Announcements
  const { data: announcements = [] } = useQuery({
    queryKey: ["student-announcements"],
    queryFn: () => studentApi.get("/api/v1/student/announcements").then((r) => r.data.data ?? []),
    enabled: !!accessToken,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });

  // Attendance this month
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const today = now.toISOString().split("T")[0];
  const { data: attData } = useQuery({
    queryKey: ["student-home-attendance", monthStart, today],
    queryFn: () => studentApi.get(`/api/v1/student/portal/attendance?dateFrom=${monthStart}&dateTo=${today}`).then((r) => r.data),
    enabled: !!accessToken,
    staleTime: 5 * 60 * 1000,
  });
  const attPct = attData?.stats?.percentage ?? null;

  // Assignments
  const assignFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split("T")[0];
  const assignTo   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
  const { data: assignData } = useQuery({
    queryKey: ["student-home-assignments", assignFrom, assignTo],
    queryFn: () => studentApi.get(`/api/v1/student/portal/assignments?dateFrom=${assignFrom}&dateTo=${assignTo}`).then((r) => r.data),
    enabled: !!accessToken,
    staleTime: 5 * 60 * 1000,
  });
  const pendingCount = assignData ? (assignData.stats?.notSubmitted ?? 0) + (assignData.stats?.overdue ?? 0) : null;

  // Today's schedule
  const { data: scheduleData } = useQuery({
    queryKey: ["student-home-schedule", today],
    queryFn: () => studentApi.get(`/api/v1/student/portal/schedule?dateFrom=${today}&dateTo=${today}`).then((r) => r.data),
    enabled: !!accessToken,
    staleTime: 5 * 60 * 1000,
  });
  const todayClasses: any[] = scheduleData?.data ?? [];

  const stats = [
    {
      icon: CalendarDays, label: "Attendance",   color: "text-blue-600",    bg: "bg-blue-50",
      value: attPct !== null ? `${attPct}%` : "—",
      sub: "This month",
      href: "/student/dashboard/attendance",
    },
    {
      icon: ClipboardList, label: "Assignments",  color: "text-amber-600",  bg: "bg-amber-50",
      value: pendingCount !== null ? String(pendingCount) : "—",
      sub: "Pending / overdue",
      href: "/student/dashboard/assignments",
    },
    {
      icon: BookOpen,      label: "Assessments",  color: "text-purple-600", bg: "bg-purple-50",
      value: "—",
      sub: "Coming soon",
      href: "/student/dashboard/assessments",
    },
    {
      icon: GraduationCap, label: "Schedule",     color: "text-emerald-600", bg: "bg-emerald-50",
      value: todayClasses.length > 0 ? String(todayClasses.length) : "0",
      sub: "Classes today",
      href: "/student/dashboard/schedule",
    },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <p className="text-sm text-gray-500">{greeting}</p>
        <h1 className="text-2xl font-bold text-gray-900">
          {student ? `${student.firstName} ${student.lastName}` : "Welcome"}
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map(({ icon: Icon, label, value, sub, color, bg, href }) => (
          <a key={label} href={href} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow block">
            <div className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${bg} mb-3`}>
              <Icon className={`h-4 w-4 ${color}`} />
            </div>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs font-medium text-gray-700 mt-0.5">{label}</p>
            <p className="text-xs text-gray-400">{sub}</p>
          </a>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {/* Today's schedule */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" />
              <h2 className="font-semibold text-gray-900 text-sm">Today&apos;s Schedule</h2>
            </div>
            <a href="/student/dashboard/schedule" className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-0.5">
              View all <ChevronRight className="h-3 w-3" />
            </a>
          </div>
          {todayClasses.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <GraduationCap className="h-8 w-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No classes today.</p>
              <p className="text-xs text-gray-300 mt-1">Enjoy your free day!</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {todayClasses.slice(0, 4).map((c: any) => {
                const start = new Date(c.startTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
                const end   = new Date(c.endTime).toLocaleTimeString("en-IN",   { hour: "2-digit", minute: "2-digit", hour12: true });
                return (
                  <div key={c.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="shrink-0 text-right w-16">
                      <p className="text-xs font-bold text-gray-700">{start}</p>
                      <p className="text-[10px] text-gray-400">{end}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{c.subject?.name ?? "—"}</p>
                      <p className="text-xs text-gray-400 truncate">
                        {c.faculty ? `${c.faculty.firstName} ${c.faculty.lastName}` : ""}
                        {c.location ? ` · ${c.location.name}` : ""}
                      </p>
                    </div>
                  </div>
                );
              })}
              {todayClasses.length > 4 && (
                <div className="px-5 py-2">
                  <a href="/student/dashboard/schedule" className="text-xs text-blue-500 hover:underline">
                    +{todayClasses.length - 4} more
                  </a>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Notice board */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-amber-500" />
              <h2 className="font-semibold text-gray-900 text-sm">Notice Board</h2>
              {(announcements as any[]).length > 0 && (
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
                  {(announcements as any[]).length}
                </span>
              )}
            </div>
          </div>
          {(announcements as any[]).length === 0 ? (
            <div className="px-5 py-8 text-center">
              <Bell className="h-8 w-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No announcements yet.</p>
              <p className="text-xs text-gray-300 mt-1">Notices from your institution will appear here.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {(announcements as any[]).slice(0, 4).map((a: any) => {
                const meta = ANN_META[a.type as AnnType] ?? ANN_META.GENERAL;
                const Icon = meta.icon;
                return (
                  <div key={a.id} className={`flex items-start gap-3 px-4 py-3 border-l-4 ${meta.border} ${meta.bg}`}>
                    {a.pinned && <Pin className="h-3 w-3 text-amber-400 shrink-0 mt-1" />}
                    <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${meta.iconColor}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{a.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{a.body}</p>
                      <p className="text-[11px] text-gray-400 mt-1">
                        {a.postedBy.firstName} {a.postedBy.lastName} · {a.publishedAt ? formatDate(a.publishedAt) : ""}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pending assignments */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-amber-500" />
              <h2 className="font-semibold text-gray-900 text-sm">Pending Assignments</h2>
              {pendingCount !== null && pendingCount > 0 && (
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
                  {pendingCount}
                </span>
              )}
            </div>
            <a href="/student/dashboard/assignments" className="text-xs text-amber-500 hover:text-amber-700 flex items-center gap-0.5">
              View all <ChevronRight className="h-3 w-3" />
            </a>
          </div>
          {!assignData ? (
            <div className="px-5 py-8 text-center">
              <div className="h-6 w-6 border-2 border-amber-300 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : (assignData.data ?? []).filter((a: any) => a.displayStatus === "NOT_SUBMITTED" || a.displayStatus === "OVERDUE").length === 0 ? (
            <div className="px-5 py-8 text-center">
              <ClipboardList className="h-8 w-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No pending assignments.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {(assignData.data as any[]).filter((a: any) => a.displayStatus === "NOT_SUBMITTED" || a.displayStatus === "OVERDUE").slice(0, 4).map((a: any) => {
                const isOverdue = a.displayStatus === "OVERDUE";
                const due = new Date(a.submissionDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
                return (
                  <div key={a.id} className="flex items-center gap-3 px-5 py-3">
                    <div className={`h-2 w-2 rounded-full shrink-0 ${isOverdue ? "bg-red-500" : "bg-amber-400"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{a.name}</p>
                      <p className="text-xs text-gray-400">{a.subject?.name ?? ""}</p>
                    </div>
                    <span className={`text-xs font-medium shrink-0 ${isOverdue ? "text-red-600" : "text-amber-600"}`}>
                      {isOverdue ? "Overdue" : `Due ${due}`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Attendance summary */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-blue-500" />
              <h2 className="font-semibold text-gray-900 text-sm">Attendance This Month</h2>
            </div>
            <a href="/student/dashboard/attendance" className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-0.5">
              View all <ChevronRight className="h-3 w-3" />
            </a>
          </div>
          <div className="px-5 py-5">
            {!attData ? (
              <div className="flex items-center justify-center h-16">
                <div className="h-6 w-6 border-2 border-blue-300 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="flex items-center gap-6">
                <div className="text-center shrink-0">
                  <p className={`text-4xl font-black ${
                    (attData.stats?.percentage ?? 0) >= 85 ? "text-green-600"
                    : (attData.stats?.percentage ?? 0) >= 75 ? "text-amber-600"
                    : "text-red-600"
                  }`}>{attData.stats?.percentage ?? 0}%</p>
                  <p className="text-xs text-gray-400 mt-0.5">Attendance</p>
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">Present</span>
                    <span className="font-semibold text-green-600">{attData.stats?.present ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">Absent</span>
                    <span className="font-semibold text-red-600">{attData.stats?.absent ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">Total Classes</span>
                    <span className="font-semibold text-gray-700">{attData.stats?.total ?? 0}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
