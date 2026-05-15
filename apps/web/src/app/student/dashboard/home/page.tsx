"use client";

import { useStudentAuthStore } from "@/store/studentAuth";
import { CalendarDays, ClipboardList, BookOpen, Bell, Clock, TrendingUp, GraduationCap, ChevronRight } from "lucide-react";

export default function StudentHomePage() {
  const { student } = useStudentAuthStore();
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

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
            </div>
          </div>
          <div className="px-5 py-8 text-center">
            <Bell className="h-8 w-8 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No announcements yet.</p>
            <p className="text-xs text-gray-300 mt-1">Notices from your institution will appear here.</p>
          </div>
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
