"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn, resolvePhotoUrl } from "@/lib/utils";
import {
  Users2, CalendarDays, School,
  BookOpen, FileCheck2, SlidersHorizontal, ArrowLeft,
  LayoutDashboard, LogOut, FileBarChart2,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { usePermissions } from "@/hooks/usePermissions";
import Image from "next/image";

const NAV_ITEMS = [
  { name: "Overview",     href: "/dashboard/academics",             icon: LayoutDashboard, permKey: null,              exact: true  },
  { name: "Students",     href: "/dashboard/academics/students",    icon: Users2,          permKey: "STU_PROFILE",     exact: false },
  { name: "Schedule",     href: "/dashboard/academics/schedule",    icon: CalendarDays,    permKey: "STU_TIMETABLE",   exact: false },
  { name: "Batches",      href: "/dashboard/academics/batches",     icon: School,          permKey: "ACA_BATCH",       exact: false },
  { name: "Assignments",  href: "/dashboard/academics/assignments", icon: BookOpen,        permKey: "STU_ASSIGNMENT",  exact: false },
  { name: "Assessments",  href: "/dashboard/academics/assessments", icon: FileCheck2,       permKey: "STU_ASSESSMENT",  exact: false },
  { name: "Reports",      href: "/dashboard/academics/reports",     icon: FileBarChart2,    permKey: null,              exact: false },
  { name: "Settings",     href: "/dashboard/academics/settings",    icon: SlidersHorizontal, permKey: "ACA_SETTINGS", exact: false },
];

export function AcademicsNav() {
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
    <aside className="flex h-screen w-56 flex-col bg-slate-900 text-white shrink-0">
      {/* Header */}
      <div className="flex h-16 items-center gap-3 px-4 border-b border-slate-700">
        <Image src="/logo.png" alt="Centum Academy" width={32} height={32} className="shrink-0 rounded-full" />
        <div>
          <p className="font-semibold text-sm leading-tight">Academics</p>
          <p className="text-xs text-indigo-400">Admin Hub</p>
        </div>
      </div>

      {/* Back to Dashboard */}
      <div className="px-3 pt-3 pb-1">
        <Link
          href="/dashboard/home"
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Dashboard
        </Link>
      </div>

      {/* Divider */}
      <div className="mx-4 my-1 border-t border-slate-700/60" />

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
        {visibleItems.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-indigo-600 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
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
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-xs font-bold overflow-hidden">
            <img
              src={user?.photoUrl ? resolvePhotoUrl(user.photoUrl)! : "/default-avatar.svg"}
              alt="avatar"
              className="h-full w-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{user ? `${user.firstName} ${user.lastName}` : "..."}</p>
            <p className="text-xs text-slate-400 truncate">{user?.role?.replace(/_/g, " ")}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
