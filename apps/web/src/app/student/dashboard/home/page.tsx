"use client";

import { useStudentAuthStore } from "@/store/studentAuth";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ClipboardList, BookOpen, Bell, Clock, TrendingUp, GraduationCap, ChevronRight, Info, AlertTriangle, AlertCircle, Pin } from "lucide-react";
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

  const { data: announcements = [] } = useQuery({
    queryKey: ["student-announcements"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/v1/student/announcements`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return [];
      const json = await res.json();
      return json.data ?? [];
    },
    enabled: !!accessToken,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
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
        {[
          { icon: CalendarDays, label: "Attendance",   value: "—",  sub: "This month",    color: "text-blue-600",   bg: "bg-blue-50" },
          { icon: ClipboardList,label: "Assignments",  value: "—",  sub: "Pending",       color: "text-amber-600",  bg: "bg-amber-50" },
          { icon: BookOpen,     label: "Assessments",  value: "—",  sub: "Upcoming",      color: "text-purple-600", bg: "bg-purple-50" },
          { icon: TrendingUp,   label: "Avg Score",    value: "—",  sub: "This term",     color: "text-emerald-600",bg: "bg-emerald-50" },
        ].map(({ icon: Icon, label, value, sub, color, bg }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${bg} mb-3`}>
              <Icon className={`h-4 w-4 ${color}`} />
            </div>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs font-medium text-gray-700 mt-0.5">{label}</p>
            <p className="text-xs text-gray-400">{sub}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {/* Today's schedule */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" />
              <h2 className="font-semibold text-gray-900 text-sm">Today's Schedule</h2>
            </div>
            <a href="/student/dashboard/schedule" className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-0.5">
              View all <ChevronRight className="h-3 w-3" />
            </a>
          </div>
          <div className="px-5 py-8 text-center">
            <GraduationCap className="h-8 w-8 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No classes scheduled yet.</p>
            <p className="text-xs text-gray-300 mt-1">Timetable will appear once assigned by admin.</p>
          </div>
        </div>

        {/* Notice board */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-amber-500" />
              <h2 className="font-semibold text-gray-900 text-sm">Notice Board</h2>
              {announcements.length > 0 && (
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
                  {announcements.length}
                </span>
              )}
            </div>
          </div>
          {announcements.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <Bell className="h-8 w-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No announcements yet.</p>
              <p className="text-xs text-gray-300 mt-1">Notices from your institution will appear here.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {announcements.slice(0, 4).map((a: any) => {
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

        {/* Upcoming assessments */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-purple-500" />
              <h2 className="font-semibold text-gray-900 text-sm">Upcoming Assessments</h2>
            </div>
            <a href="/student/dashboard/assessments" className="text-xs text-purple-500 hover:text-purple-700 flex items-center gap-0.5">
              View all <ChevronRight className="h-3 w-3" />
            </a>
          </div>
          <div className="px-5 py-8 text-center">
            <BookOpen className="h-8 w-8 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No upcoming assessments.</p>
          </div>
        </div>

        {/* Pending assignments */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-amber-500" />
              <h2 className="font-semibold text-gray-900 text-sm">Pending Assignments</h2>
            </div>
            <a href="/student/dashboard/assignments" className="text-xs text-amber-500 hover:text-amber-700 flex items-center gap-0.5">
              View all <ChevronRight className="h-3 w-3" />
            </a>
          </div>
          <div className="px-5 py-8 text-center">
            <ClipboardList className="h-8 w-8 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No pending assignments.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
