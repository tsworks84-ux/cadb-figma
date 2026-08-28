"use client";

import { useStudentAuthStore } from "@/store/studentAuth";
import { useQuery } from "@tanstack/react-query";
import { studentApi } from "@/lib/studentApi";
import Link from "next/link";
import {
  CalendarDays, ClipboardList, BookOpen, Bell, Clock, TrendingUp,
  GraduationCap, ChevronRight, Info, AlertTriangle, AlertCircle,
  Pin, MapPin, CheckCircle2,
} from "lucide-react";
import { formatDate, fullName } from "@/lib/utils";
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type AnnType = "GENERAL" | "IMPORTANT" | "URGENT";
const ANN_META: Record<AnnType, { border: string; bg: string; icon: React.ElementType; iconColor: string; badge: string }> = {
  GENERAL:   { border: "border-l-sky-400",    bg: "bg-sky-50/60",   icon: Info,          iconColor: "text-sky-500",   badge: "bg-sky-100 text-sky-700"   },
  IMPORTANT: { border: "border-l-amber-400",  bg: "bg-amber-50/60", icon: AlertTriangle, iconColor: "text-amber-500", badge: "bg-amber-100 text-amber-700" },
  URGENT:    { border: "border-l-red-500",    bg: "bg-red-50/60",   icon: AlertCircle,   iconColor: "text-red-500",   badge: "bg-red-100 text-red-700"   },
};

export default function StudentHomePage() {
  const { student, accessToken } = useStudentAuthStore();
  const now   = new Date();
  const hour  = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const today = now.toISOString().split("T")[0];

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: announcements = [] } = useQuery({
    queryKey: ["student-announcements"],
    queryFn: () => studentApi.get("/api/v1/student/announcements").then((r) => r.data.data ?? []),
    enabled: !!accessToken, staleTime: 0, refetchOnWindowFocus: true, refetchInterval: 60_000,
  });

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const { data: attData } = useQuery({
    queryKey: ["student-home-attendance", monthStart, today],
    queryFn: () => studentApi.get(`/api/v1/student/portal/attendance?dateFrom=${monthStart}&dateTo=${today}`).then((r) => r.data),
    enabled: !!accessToken, staleTime: 0, refetchOnWindowFocus: true,
  });
  const attPct = attData?.stats?.percentage ?? null;
  const attPresent = attData?.stats?.present ?? null;
  const attTotal   = attData?.stats?.total   ?? null;

  const assignFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split("T")[0];
  const assignTo   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
  const { data: assignData } = useQuery({
    queryKey: ["student-home-assignments", assignFrom, assignTo],
    queryFn: () => studentApi.get(`/api/v1/student/portal/assignments?dateFrom=${assignFrom}&dateTo=${assignTo}`).then((r) => r.data),
    enabled: !!accessToken, staleTime: 0, refetchOnWindowFocus: true,
  });
  const pendingCount = assignData ? (assignData.stats?.notSubmitted ?? 0) + (assignData.stats?.overdue ?? 0) : null;
  const overdueCount = assignData?.stats?.overdue ?? 0;

  const { data: scheduleData } = useQuery({
    queryKey: ["student-home-schedule", today],
    queryFn: () => studentApi.get(`/api/v1/student/portal/schedule?dateFrom=${today}&dateTo=${today}`).then((r) => r.data),
    enabled: !!accessToken, staleTime: 0, refetchOnWindowFocus: true,
  });
  const todayClasses: any[] = scheduleData?.data ?? [];

  // Photo
  const photoSrc = student?.photoUrl
    ? (student.photoUrl.startsWith("http") ? student.photoUrl : `${API_BASE}${student.photoUrl}`)
    : null;
  const initials = student ? `${student.firstName[0]}${student.lastName[0]}` : "?";

  // ── Stats cards ───────────────────────────────────────────────────────────
  const statCards = [
    {
      icon: CalendarDays, label: "Attendance",
      value: attPct !== null ? `${attPct}%` : "—",
      sub: attPresent !== null && attTotal !== null ? `${attPresent} of ${attTotal} classes` : "This month",
      href: "/student/dashboard/attendance",
      color: attPct === null ? "text-sky-600" : attPct >= 85 ? "text-green-600" : attPct >= 75 ? "text-amber-600" : "text-red-600",
      iconBg: "bg-sky-100", iconColor: "text-sky-600",
    },
    {
      icon: ClipboardList, label: "Assignments",
      value: pendingCount !== null ? String(pendingCount) : "—",
      sub: overdueCount > 0 ? `${overdueCount} overdue` : "Pending / overdue",
      href: "/student/dashboard/assignments",
      color: overdueCount > 0 ? "text-red-600" : pendingCount === 0 ? "text-green-600" : "text-amber-600",
      iconBg: "bg-amber-100", iconColor: "text-amber-600",
    },
    {
      icon: GraduationCap, label: "Today's Classes",
      value: String(todayClasses.length),
      sub: todayClasses.length === 0 ? "No classes today" : "scheduled today",
      href: "/student/dashboard/schedule",
      color: "text-teal-600",
      iconBg: "bg-teal-100", iconColor: "text-teal-600",
    },
    {
      icon: Bell, label: "Notices",
      value: String((announcements as any[]).length),
      sub: "From institution",
      href: "/student/dashboard/notices",
      color: "text-sky-600",
      iconBg: "bg-sky-100", iconColor: "text-sky-600",
    },
  ];

  return (
    <div className="pb-8">

      {/* ── Hero banner ─────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-sky-600 via-sky-700 to-teal-700 px-4 pt-5 pb-8 sm:px-6 sm:pt-7">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          {/* Avatar */}
          <div className="shrink-0 h-14 w-14 sm:h-16 sm:w-16 rounded-full ring-2 ring-white/40 overflow-hidden bg-teal-600 flex items-center justify-center text-white text-xl font-bold shadow-lg">
            {photoSrc ? (
              <img src={photoSrc} alt="" className="h-full w-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            ) : <span>{initials}</span>}
          </div>
          {/* Greeting */}
          <div>
            <p className="text-sky-200 text-sm font-medium">{greeting} 👋</p>
            <h1 className="text-xl sm:text-2xl font-bold text-white leading-tight">
              {student ? fullName(student) : "Welcome"}
            </h1>
            <p className="text-sky-300 text-xs mt-0.5">
              {now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 -mt-4 space-y-5">

        {/* ── Quick stats ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {statCards.map(({ icon: Icon, label, value, sub, color, iconBg, iconColor, href }) => (
            <Link key={label} href={href}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md hover:border-sky-100 transition-all group block"
            >
              <div className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${iconBg} mb-3`}>
                <Icon className={`h-4 w-4 ${iconColor}`} />
              </div>
              <p className={`text-2xl font-black leading-none ${color}`}>{value}</p>
              <p className="text-xs font-semibold text-gray-700 mt-1">{label}</p>
              <p className="text-[11px] text-gray-400 mt-0.5 truncate">{sub}</p>
            </Link>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-4">

          {/* ── Today's Schedule ──────────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-teal-500" />
                <h2 className="font-semibold text-gray-900 text-sm">Today&apos;s Schedule</h2>
              </div>
              <Link href="/student/dashboard/schedule"
                className="text-xs text-sky-500 hover:text-sky-700 flex items-center gap-0.5 font-medium">
                View all <ChevronRight className="h-3 w-3" />
              </Link>
            </div>

            {todayClasses.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <GraduationCap className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-400">No classes today</p>
                <p className="text-xs text-gray-300 mt-1">Enjoy your free day!</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {todayClasses.slice(0, 5).map((c: any) => {
                  const start = c.startTime;
                  const end   = c.endTime;
                  const isNow = (() => {
                    const n = now.toTimeString().slice(0, 5);
                    return n >= start?.slice(0, 5) && n <= end?.slice(0, 5);
                  })();
                  return (
                    <div key={c.id} className={`flex items-center gap-3 px-5 py-3 ${isNow ? "bg-sky-50/50" : ""}`}>
                      <div className="shrink-0 text-center w-14">
                        <p className="text-xs font-bold text-gray-700 leading-tight">{start}</p>
                        <p className="text-[10px] text-gray-400 leading-tight">{end}</p>
                      </div>
                      <div className={`w-0.5 h-8 rounded-full shrink-0 ${isNow ? "bg-sky-400" : "bg-gray-200"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{c.subject?.name ?? "—"}</p>
                        <p className="text-xs text-gray-400 truncate">
                          {c.faculty ? `${c.faculty.firstName} ${c.faculty.lastName}` : ""}
                          {c.location ? ` · ${c.location.name}` : ""}
                        </p>
                      </div>
                      {isNow && (
                        <span className="shrink-0 text-[10px] font-bold text-sky-600 bg-sky-100 rounded-full px-2 py-0.5">Now</span>
                      )}
                    </div>
                  );
                })}
                {todayClasses.length > 5 && (
                  <div className="px-5 py-2.5">
                    <Link href="/student/dashboard/schedule" className="text-xs text-sky-500 hover:underline font-medium">
                      +{todayClasses.length - 5} more classes
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Notice Board ──────────────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-amber-500" />
                <h2 className="font-semibold text-gray-900 text-sm">Notice Board</h2>
                {(announcements as any[]).length > 0 && (
                  <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5">
                    {(announcements as any[]).length}
                  </span>
                )}
              </div>
              <Link href="/student/dashboard/notices"
                className="text-xs text-sky-500 hover:text-sky-700 flex items-center gap-0.5 font-medium">
                View all <ChevronRight className="h-3 w-3" />
              </Link>
            </div>

            {(announcements as any[]).length === 0 ? (
              <div className="px-5 py-10 text-center">
                <Bell className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-400">No announcements yet</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {(announcements as any[]).slice(0, 4).map((a: any) => {
                  const meta = ANN_META[a.type as AnnType] ?? ANN_META.GENERAL;
                  const Icon = meta.icon;
                  return (
                    <div key={a.id} className={`flex items-start gap-3 px-4 py-3 border-l-[3px] ${meta.border} ${meta.bg}`}>
                      {a.pinned && <Pin className="h-3 w-3 text-amber-400 shrink-0 mt-1" />}
                      <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${meta.iconColor}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{a.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{a.body}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          {a.publishedAt ? formatDate(a.publishedAt) : ""}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Pending Assignments ───────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-amber-500" />
                <h2 className="font-semibold text-gray-900 text-sm">Pending Assignments</h2>
                {pendingCount !== null && pendingCount > 0 && (
                  <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5">
                    {pendingCount}
                  </span>
                )}
              </div>
              <Link href="/student/dashboard/assignments"
                className="text-xs text-sky-500 hover:text-sky-700 flex items-center gap-0.5 font-medium">
                View all <ChevronRight className="h-3 w-3" />
              </Link>
            </div>

            {!assignData ? (
              <div className="px-5 py-10 flex items-center justify-center">
                <div className="h-5 w-5 border-2 border-sky-300 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (assignData.data ?? []).filter((a: any) => a.displayStatus === "NOT_SUBMITTED" || a.displayStatus === "OVERDUE").length === 0 ? (
              <div className="px-5 py-10 text-center">
                <CheckCircle2 className="h-8 w-8 text-green-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-400">All caught up!</p>
                <p className="text-xs text-gray-300 mt-1">No pending assignments.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {(assignData.data as any[])
                  .filter((a: any) => a.displayStatus === "NOT_SUBMITTED" || a.displayStatus === "OVERDUE")
                  .slice(0, 5)
                  .map((a: any) => {
                    const isOverdue = a.displayStatus === "OVERDUE";
                    const due = new Date(a.submissionDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
                    return (
                      <div key={a.id} className="flex items-center gap-3 px-5 py-3">
                        <div className={`h-2 w-2 rounded-full shrink-0 ${isOverdue ? "bg-red-500" : "bg-amber-400"}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">{a.name}</p>
                          <p className="text-xs text-gray-400 truncate">{a.subject?.name ?? ""}</p>
                        </div>
                        <span className={`text-xs font-semibold shrink-0 rounded-full px-2 py-0.5 ${
                          isOverdue ? "bg-red-50 text-red-600 border border-red-100" : "bg-amber-50 text-amber-600 border border-amber-100"
                        }`}>
                          {isOverdue ? "Overdue" : `Due ${due}`}
                        </span>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* ── Attendance Summary ────────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-sky-500" />
                <h2 className="font-semibold text-gray-900 text-sm">Attendance — This Month</h2>
              </div>
              <Link href="/student/dashboard/attendance"
                className="text-xs text-sky-500 hover:text-sky-700 flex items-center gap-0.5 font-medium">
                View all <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="px-5 py-5">
              {!attData ? (
                <div className="flex items-center justify-center h-16">
                  <div className="h-5 w-5 border-2 border-sky-300 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="flex items-center gap-5">
                  {/* Big % */}
                  <div className="text-center shrink-0">
                    <p className={`text-4xl font-black leading-none ${
                      (attData.stats?.percentage ?? 0) >= 85 ? "text-green-600"
                      : (attData.stats?.percentage ?? 0) >= 75 ? "text-amber-600"
                      : "text-red-600"
                    }`}>{attData.stats?.percentage ?? 0}%</p>
                    <p className="text-[11px] text-gray-400 mt-1 font-medium">Attendance</p>
                  </div>
                  {/* Stats */}
                  <div className="flex-1 space-y-2">
                    {[
                      { label: "Present",       value: attData.stats?.present ?? 0,    color: "text-green-600", bar: "bg-green-400"   },
                      { label: "Absent",        value: attData.stats?.absent ?? 0,     color: "text-red-600",   bar: "bg-red-400"     },
                      { label: "Total Classes", value: attData.stats?.total ?? 0,      color: "text-gray-700",  bar: "bg-gray-300"    },
                    ].map(({ label, value, color, bar }) => (
                      <div key={label} className="flex items-center justify-between text-xs gap-2">
                        <span className="text-gray-500 w-24 shrink-0">{label}</span>
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-1.5 rounded-full ${bar}`}
                            style={{ width: attData.stats?.total ? `${Math.round((value / attData.stats.total) * 100)}%` : "0%" }} />
                        </div>
                        <span className={`font-bold w-6 text-right shrink-0 ${color}`}>{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
