"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import Image from "next/image";
import Link from "next/link";
import {
  Users, GraduationCap, HeartHandshake, ArrowRight,
  BookOpen, BarChart3, Shield, CalendarDays,
  ClipboardList, Bell,
} from "lucide-react";

export default function LandingPage() {
  const { isAuthenticated, user } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated()) return;
    router.replace(user?.role === "EMPLOYEE" ? "/dashboard/home" : "/dashboard/employees");
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 flex flex-col">

      {/* Header */}
      <header className="flex items-center gap-3 px-8 py-5">
        <Image src="/logo.png" alt="Centum Academy" width={40} height={40} className="rounded-full shrink-0" />
        <div>
          <p className="text-white font-bold text-lg leading-tight">Centum Academy</p>
          <p className="text-slate-400 text-xs">Integrated Management System</p>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-1.5 mb-6">
            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
            <span className="text-blue-300 text-xs font-medium tracking-wide">System Online</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
            Welcome to <span className="text-blue-400">CADB</span>
          </h1>
          <p className="text-slate-400 text-lg max-w-xl mx-auto leading-relaxed">
            Your centralised platform for academic management, student records, and institutional operations.
          </p>
        </div>

        {/* Portal Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full max-w-4xl">

          {/* Staff Portal */}
          <Link
            href="/login"
            className="group relative bg-white/5 hover:bg-white/10 border border-white/10 hover:border-blue-500/50 rounded-2xl p-7 transition-all duration-200"
          >
            <div className="flex items-start justify-between mb-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/20">
                <Users className="h-6 w-6 text-blue-400" />
              </div>
              <ArrowRight className="h-5 w-5 text-slate-600 group-hover:text-blue-400 group-hover:translate-x-1 transition-all duration-200" />
            </div>
            <h2 className="text-white font-semibold text-lg mb-1.5">Staff Portal</h2>
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
              For faculty, HR, and administrative staff members.
            </p>
            <div className="space-y-2">
              {["HR & Payroll", "Leave Management", "MIS Reports"].map((f) => (
                <div key={f} className="flex items-center gap-2 text-xs text-slate-500">
                  <div className="w-1 h-1 rounded-full bg-blue-500 shrink-0" />
                  {f}
                </div>
              ))}
            </div>
          </Link>

          {/* Student Portal */}
          <Link
            href="/student/login"
            className="group relative bg-white/5 hover:bg-white/10 border border-white/10 hover:border-emerald-500/50 rounded-2xl p-7 transition-all duration-200"
          >
            <div className="flex items-start justify-between mb-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/20">
                <GraduationCap className="h-6 w-6 text-emerald-400" />
              </div>
              <ArrowRight className="h-5 w-5 text-slate-600 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all duration-200" />
            </div>
            <h2 className="text-white font-semibold text-lg mb-1.5">Student Portal</h2>
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
              For enrolled students to access their academic dashboard.
            </p>
            <div className="space-y-2">
              {["Attendance & Schedule", "Assignments & Assessments", "Results & Reports"].map((f) => (
                <div key={f} className="flex items-center gap-2 text-xs text-slate-500">
                  <div className="w-1 h-1 rounded-full bg-emerald-500 shrink-0" />
                  {f}
                </div>
              ))}
            </div>
          </Link>

          {/* Parent Portal — Coming Soon */}
          <div className="relative bg-white/[0.03] border border-white/5 rounded-2xl p-7 opacity-60 cursor-not-allowed select-none">
            <div className="absolute top-4 right-4">
              <span className="text-[10px] font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-full px-2.5 py-0.5 tracking-wide">
                Coming Soon
              </span>
            </div>
            <div className="mb-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10">
                <HeartHandshake className="h-6 w-6 text-amber-400/60" />
              </div>
            </div>
            <h2 className="text-white/60 font-semibold text-lg mb-1.5">Parent Portal</h2>
            <p className="text-slate-500 text-sm mb-6 leading-relaxed">
              For parents and guardians to track their child's progress.
            </p>
            <div className="space-y-2">
              {["Attendance & Results", "Fee Payments", "Teacher Communication"].map((f) => (
                <div key={f} className="flex items-center gap-2 text-xs text-slate-600">
                  <div className="w-1 h-1 rounded-full bg-amber-500/30 shrink-0" />
                  {f}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Stats strip */}
        <div className="mt-16 flex flex-wrap justify-center gap-10">
          {[
            { icon: BookOpen,      value: "12+",  label: "Academic Modules" },
            { icon: Shield,        value: "RBAC", label: "Role-Based Access" },
            { icon: BarChart3,     value: "Live", label: "MIS Reports" },
            { icon: CalendarDays,  value: "Auto", label: "Leave Accruals" },
            { icon: ClipboardList, value: "Real", label: "Timesheet Tracking" },
            { icon: Bell,          value: "Push", label: "Announcements" },
          ].map(({ icon: Icon, value, label }) => (
            <div key={label} className="flex flex-col items-center gap-1 text-center">
              <Icon className="h-4 w-4 text-slate-500 mb-1" />
              <p className="text-white font-bold text-lg">{value}</p>
              <p className="text-slate-500 text-xs">{label}</p>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-5 text-slate-600 text-xs">
        © {new Date().getFullYear()} Centum Academy · All rights reserved
      </footer>
    </div>
  );
}
