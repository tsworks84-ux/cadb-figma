"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Users2, ClipboardList, CalendarDays, School,
  BookOpen, FileCheck2, SlidersHorizontal,
  LayoutDashboard, ArrowLeft, FileBarChart2,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { usePermissions } from "@/hooks/usePermissions";
import Image from "next/image";

const NAV_ITEMS = [
  { name: "Overview",    href: "/dashboard/academics",             icon: LayoutDashboard,  permKey: null,             exact: true  },
  { name: "Students",    href: "/dashboard/academics/students",    icon: Users2,           permKey: "STU_PROFILE",    exact: false },
  { name: "Admission",   href: "/dashboard/academics/admission",   icon: ClipboardList,    permKey: "STU_ADMISSION",  exact: false },
  { name: "Schedule",    href: "/dashboard/academics/schedule",    icon: CalendarDays,     permKey: "STU_TIMETABLE",  exact: false },
  { name: "Batches",     href: "/dashboard/academics/batches",     icon: School,           permKey: "ACA_BATCH",      exact: false },
  { name: "Assignments", href: "/dashboard/academics/assignments", icon: BookOpen,         permKey: "STU_ASSIGNMENT", exact: false },
  { name: "Assessments", href: "/dashboard/academics/assessments", icon: FileCheck2,        permKey: "STU_ASSESSMENT", exact: false },
  { name: "Reports",     href: "/dashboard/academics/reports",     icon: FileBarChart2,     permKey: null,             exact: false },
  { name: "Settings",    href: "/dashboard/academics/settings",    icon: SlidersHorizontal, permKey: "ACA_SETTINGS",   exact: false },
];

export function AcademicsTopNav() {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const permissions = usePermissions();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const isHRAdmin    = user?.role === "HR_ADMIN";

  const visibleItems = NAV_ITEMS.filter(({ permKey }) => {
    if (!permKey) return true;
    if (isSuperAdmin || isHRAdmin) return true;
    return permissions[permKey]?.canView ?? false;
  });

  return (
    <header className="shrink-0 bg-slate-900 text-white border-b border-slate-700">
      {/* Top row: branding + back + user */}
      <div className="flex items-center justify-between px-4 h-11 border-b border-slate-700/60 sm:px-6 sm:h-12">
        <div className="flex items-center gap-2 min-w-0 sm:gap-3">
          <Image src="/logo.png" alt="Centum Academy" width={24} height={24} className="rounded-full shrink-0" />
          <span className="font-semibold text-sm text-white shrink-0">Academics</span>
          <span className="text-slate-600 hidden sm:block">|</span>
          <Link
            href="/dashboard/home"
            className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Dashboard
          </Link>
        </div>

        {/* User chip */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Mobile: back to dashboard as icon-only */}
          <Link
            href="/dashboard/home"
            className="sm:hidden flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </Link>
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-500 text-xs font-bold overflow-hidden">
            {user?.photoUrl
              ? <img src={`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}${user.photoUrl}`} alt="avatar" className="h-full w-full object-cover" />
              : user ? `${user.firstName[0]}${user.lastName[0]}` : "?"
            }
          </div>
          <span className="text-xs text-slate-300 hidden sm:block">{user ? `${user.firstName} ${user.lastName}` : ""}</span>
        </div>
      </div>

      {/* Bottom row: nav tabs — scrollable on mobile */}
      <nav className="flex items-end gap-0.5 px-2 overflow-x-auto scrollbar-none sm:px-4">
        {visibleItems.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors",
                active
                  ? "border-indigo-400 text-white"
                  : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-500"
              )}
            >
              <item.icon className="h-3.5 w-3.5 shrink-0" />
              {item.name}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
