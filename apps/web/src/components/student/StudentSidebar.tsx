"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn, fullName } from "@/lib/utils";
import {
  Home, User, FileText, CalendarDays, ClipboardList,
  BookOpen, GraduationCap, Settings, LogOut, Bell, X, MessageSquare,
} from "lucide-react";
import { useStudentAuthStore } from "@/store/studentAuth";
import { studentApi } from "@/lib/studentApi";
import { useQuery } from "@tanstack/react-query";
import Image from "next/image";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const BASE_NAV = [
  { name: "Home",        href: "/student/dashboard/home",        icon: Home         },
  { name: "My Profile",  href: "/student/dashboard/profile",     icon: User         },
  { name: "Admission",   href: "/student/dashboard/admission",   icon: FileText     },
  { name: "Attendance",  href: "/student/dashboard/attendance",  icon: CalendarDays },
  { name: "Assignments", href: "/student/dashboard/assignments", icon: ClipboardList },
  { name: "Assessments", href: "/student/dashboard/assessments", icon: BookOpen     },
  { name: "Schedule",    href: "/student/dashboard/schedule",    icon: GraduationCap },
  { name: "Notices",     href: "/student/dashboard/notices",     icon: Bell          },
  { name: "Feedback",    href: "/student/dashboard/feedback",    icon: MessageSquare },
  { name: "Settings",    href: "/student/dashboard/settings",    icon: Settings      },
];

interface Props {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function StudentSidebar({ mobileOpen, onMobileClose }: Props) {
  const pathname = usePathname();
  const router   = useRouter();
  const { student, accessToken, clearAuth } = useStudentAuthStore();

  const { data: fbSummary } = useQuery({
    queryKey: ["student-feedback-summary"],
    queryFn: () => studentApi.get("/api/v1/student/portal/feedback/summary").then((r) => r.data.data as { responded: number }),
    enabled: !!accessToken,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const feedbackBadge = fbSummary?.responded ?? 0;

  const nav = BASE_NAV.map((item) =>
    item.href === "/student/dashboard/feedback" && feedbackBadge > 0
      ? { ...item, badge: feedbackBadge }
      : item
  ) as (typeof BASE_NAV[number] & { badge?: number })[];

  async function handleLogout() {
    const refreshToken = localStorage.getItem("cadb_student_refresh_token");
    try { await studentApi.post("/api/v1/student/auth/logout", { refreshToken }); } catch {}
    clearAuth();
    router.push("/student/login");
  }

  const photoSrc = student?.photoUrl
    ? (student.photoUrl.startsWith("http") ? student.photoUrl : `${API_BASE}${student.photoUrl}`)
    : null;

  return (
    <>
      {/* ── Mobile backdrop ────────────────────────────────────────────────── */}
      <div
        onClick={onMobileClose}
        className={cn(
          "fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 lg:hidden",
          mobileOpen ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
      />

      {/* ── Sidebar panel ─────────────────────────────────────────────────── */}
      <aside
        className={cn(
          // layout
          "fixed inset-y-0 left-0 z-50 flex h-full w-64 flex-col",
          // mobile slide — overridden by lg:translate-x-0
          "transform transition-transform duration-300 ease-in-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          // desktop: static (in normal flow) and always visible
          "lg:relative lg:translate-x-0",
          // brand
          "bg-sky-950 text-white",
        )}
      >
        {/* ── Logo ── */}
        <div className="flex h-16 items-center gap-3 px-4 border-b border-white/10">
          <div className="relative shrink-0">
            <Image src="/logo.png" alt="Centum Academy" width={36} height={36} className="rounded-full" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-white leading-tight truncate">Centum Academy</p>
            <p className="text-xs text-teal-300 font-medium">Student Portal</p>
          </div>
          {/* Mobile close button */}
          <button
            onClick={onMobileClose}
            className="lg:hidden p-1.5 rounded-lg text-sky-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Nav ── */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          <p className="px-3 mb-3 text-[10px] font-bold text-sky-400/70 uppercase tracking-widest">
            My Dashboard
          </p>
          {nav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onMobileClose}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
                  active
                    ? "bg-sky-500/20 text-white border-l-2 border-sky-400 pl-[10px]"
                    : "text-sky-200/70 hover:bg-white/5 hover:text-white border-l-2 border-transparent pl-[10px]",
                )}
              >
                <item.icon className={cn("h-4 w-4 shrink-0", active ? "text-sky-300" : "text-sky-400/60")} />
                <span className="flex-1">{item.name}</span>
                {"badge" in item && !!item.badge && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-semibold text-white leading-none">
                    {(item.badge as number) > 99 ? "99+" : item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* ── User footer ── */}
        <div className="border-t border-white/10 px-4 py-3">
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-600 text-xs font-bold overflow-hidden ring-2 ring-teal-500/30">
              {photoSrc ? (
                <img
                  src={photoSrc}
                  alt=""
                  className="h-full w-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              ) : (
                <span className="text-white">
                  {student ? `${student.firstName[0]}${student.lastName[0]}` : "?"}
                </span>
              )}
            </div>
            {/* Name + code */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                {student ? fullName(student) : "Loading…"}
              </p>
              <p className="text-xs text-sky-400/70 font-mono truncate">{student?.studentCode}</p>
            </div>
            {/* Logout */}
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg text-sky-400/60 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
