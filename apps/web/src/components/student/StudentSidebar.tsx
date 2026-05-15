"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Home, User, FileText, CalendarDays, ClipboardList, BookOpen, Settings, LogOut, GraduationCap } from "lucide-react";
import { useStudentAuthStore } from "@/store/studentAuth";
import Image from "next/image";

const nav = [
  { name: "Home",        href: "/student/dashboard/home",        icon: Home },
  { name: "My Profile",  href: "/student/dashboard/profile",     icon: User },
  { name: "Admission",   href: "/student/dashboard/admission",   icon: FileText },
  { name: "Attendance",  href: "/student/dashboard/attendance",  icon: CalendarDays },
  { name: "Assignments", href: "/student/dashboard/assignments", icon: ClipboardList },
  { name: "Assessments", href: "/student/dashboard/assessments", icon: BookOpen },
  { name: "Schedule",    href: "/student/dashboard/schedule",    icon: GraduationCap },
  { name: "Settings",    href: "/student/dashboard/settings",    icon: Settings },
];

export function StudentSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { student, clearAuth } = useStudentAuthStore();

  async function handleLogout() {
    const refreshToken = localStorage.getItem("cadb_student_refresh_token");
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/api/v1/student/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
    } catch {}
    clearAuth();
    router.push("/student/login");
  }

  return (
    <aside className="flex h-screen w-64 flex-col bg-slate-900 text-white shrink-0">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-4 border-b border-slate-700">
        <Image src="/logo.png" alt="Centum Academy" width={36} height={36} className="shrink-0 rounded-full" />
        <div>
          <p className="font-semibold text-sm leading-tight">Centum Academy</p>
          <p className="text-xs text-emerald-400">Student Portal</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <p className="px-3 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">My Dashboard</p>
        {nav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-emerald-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="border-t border-slate-700 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold overflow-hidden">
            {student
              ? `${student.firstName[0]}${student.lastName[0]}`
              : "?"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{student ? `${student.firstName} ${student.lastName}` : "Loading..."}</p>
            <p className="text-xs text-slate-400 truncate">{student?.studentCode}</p>
          </div>
          <button onClick={handleLogout} className="text-slate-400 hover:text-white transition-colors">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
