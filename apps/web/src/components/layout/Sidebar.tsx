"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn, resolvePhotoUrl } from "@/lib/utils";
import {
  Users, Home, CalendarOff, Receipt, Shield,
  GraduationCap, Settings, LogOut, BarChart3, Building2, User,
  CalendarDays, UsersRound, ListTodo, Megaphone, ClipboardList, School,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { useRouter } from "next/navigation";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useCallback } from "react";
import Image from "next/image";
import { usePermissions } from "@/hooks/usePermissions";

// How long cached data stays fresh — must match each page's staleTime
const STALE = {
  long: 5 * 60 * 1000,
  medium: 2 * 60 * 1000,
};

export function Sidebar() {
  const pathname = usePathname();
  const { user, clearAuth } = useAuthStore();
  const router = useRouter();
  const queryClient = useQueryClient();
  const permissions = usePermissions();

  const role = user?.role ?? "EMPLOYEE";

  // Read from cache (populated by DashboardLayout) — no extra network request
  const { data: profile } = useQuery({
    queryKey: ["employee", user?.id],
    queryFn: () => api.get(`/api/v1/employees/${user?.id}`).then((r) => r.data.data),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });
  const isPartTime = profile?.employmentType === "PART_TIME";
  // Directory access: system roles are hardcoded; custom roles use their EMP_PROFILE.canView permission
  const SYSTEM_DIR_ROLES = ["SUPER_ADMIN", "HR_ADMIN", "DEPT_HEAD"];
  const canViewDirectory = SYSTEM_DIR_ROLES.includes(role)
    || (role !== "EMPLOYEE" && (permissions["EMP_PROFILE"]?.canView ?? false));
  // Administration is restricted to SUPER_ADMIN only — not configurable via permissions
  const canViewAdmin = role === "SUPER_ADMIN";
  const canViewMIS = Object.keys(permissions)
    .filter((k) => k.startsWith("MIS_"))
    .some((k) => permissions[k]?.canView);
  const canViewAcademics = canViewAdmin
    || Object.keys(permissions)
      .filter((k) => k.startsWith("ACA_") || k.startsWith("STU_"))
      .some((k) => permissions[k]?.canView);

  const profileEntry = canViewDirectory
    ? { name: "Employees", href: "/dashboard/employees", icon: Users }
    : { name: "My Profile", href: user?.id ? `/dashboard/employees/${user.id}` : "#", icon: User };

  const mainNav = [
    { name: "Home", href: "/dashboard/home", icon: Home },
    { name: "Notice Board", href: "/dashboard/announcements", icon: Megaphone },
    { name: "My Team", href: "/dashboard/my-team", icon: UsersRound },
    { name: "My To-Do", href: "/dashboard/todos", icon: ListTodo },
    { name: "Leaves & Holidays", href: "/dashboard/leaves", icon: CalendarOff },
    ...(isPartTime ? [{ name: "My Timesheet", href: "/dashboard/timesheet", icon: ClipboardList }] : []),
    { name: "Claims", href: "/dashboard/claims", icon: Receipt },
    { name: "Policies", href: "/dashboard/policies", icon: Shield },
    { name: "Training", href: "/dashboard/training", icon: GraduationCap },
    { name: "Settings", href: "/dashboard/settings", icon: Settings },
  ];

  const mgmtNav = [
    profileEntry,
    ...(canViewAdmin      ? [{ name: "Administration", href: "/dashboard/admin",      icon: Building2 }] : []),
    ...(canViewAcademics  ? [{ name: "Academics",      href: "/dashboard/academics",  icon: School    }] : []),
    ...(canViewMIS        ? [{ name: "MIS Reports",    href: "/dashboard/mis",        icon: BarChart3 }] : []),
  ];

  // Fire API prefetches when the user hovers a link — data is ready by the time they click
  const prefetch = useCallback((href: string) => {
    const uid = user?.id;

    if (href === "/dashboard/home" || href === "/dashboard/announcements") {
      queryClient.prefetchQuery({
        queryKey: ["announcements"],
        queryFn: () => api.get("/api/v1/announcements").then((r) => ({ data: r.data.data, stats: null })),
        staleTime: STALE.medium,
      });
    }
    if (href === "/dashboard/home" && uid) {
      queryClient.prefetchQuery({
        queryKey: ["employee", uid],
        queryFn: () => api.get(`/api/v1/employees/${uid}`).then((r) => r.data.data),
        staleTime: 0,
      });
      queryClient.prefetchQuery({
        queryKey: ["my-leave-balances"],
        queryFn: () => api.get(`/api/v1/employees/${uid}/leave-balances`).then((r) => r.data.data),
        staleTime: STALE.long,
      });
      queryClient.prefetchQuery({
        queryKey: ["my-leaves"],
        queryFn: () => api.get("/api/v1/leaves/my").then((r) => r.data.data),
        staleTime: STALE.long,
      });
    }
    if (href === "/dashboard/my-team" && uid) {
      queryClient.prefetchQuery({
        queryKey: ["my-team", uid],
        queryFn: () => api.get(`/api/v1/employees/${uid}/team`).then((r) => r.data.data),
        staleTime: STALE.long,
      });
    }
    if (href === "/dashboard/todos") {
      queryClient.prefetchQuery({
        queryKey: ["todos"],
        queryFn: () => api.get("/api/v1/todos").then((r) => r.data.data),
        staleTime: STALE.medium,
      });
    }
    if (href === "/dashboard/leaves" && uid) {
      queryClient.prefetchQuery({
        queryKey: ["my-leaves"],
        queryFn: () => api.get("/api/v1/leaves/my").then((r) => r.data.data),
        staleTime: STALE.long,
      });
      queryClient.prefetchQuery({
        queryKey: ["my-leave-balances"],
        queryFn: () => api.get(`/api/v1/employees/${uid}/leave-balances`).then((r) => r.data.data),
        staleTime: STALE.long,
      });
    }
    if (href === "/dashboard/claims") {
      queryClient.prefetchQuery({
        queryKey: ["my-claims"],
        queryFn: () => api.get("/api/v1/claims/my").then((r) => r.data.data),
        staleTime: STALE.long,
      });
    }
    if (href === "/dashboard/policies") {
      queryClient.prefetchQuery({
        queryKey: ["policies"],
        queryFn: () => api.get("/api/v1/policies").then((r) => r.data.data),
        staleTime: STALE.long,
      });
    }
    if (href === "/dashboard/training") {
      queryClient.prefetchQuery({
        queryKey: ["my-enrollments"],
        queryFn: () => api.get("/api/v1/training/my-enrollments").then((r) => r.data.data),
        staleTime: STALE.long,
      });
    }
    if (href === "/dashboard/holidays") {
      queryClient.prefetchQuery({
        queryKey: ["holidays", new Date().getFullYear()],
        queryFn: () => api.get(`/api/v1/holidays?year=${new Date().getFullYear()}`).then((r) => r.data.data),
        staleTime: STALE.long,
      });
    }
    if (href === "/dashboard/employees" && uid) {
      queryClient.prefetchQuery({
        queryKey: ["employees"],
        queryFn: () => api.get("/api/v1/employees").then((r) => r.data.data),
        staleTime: STALE.long,
      });
    }
    if (href.startsWith("/dashboard/employees/") && uid) {
      queryClient.prefetchQuery({
        queryKey: ["employee", uid],
        queryFn: () => api.get(`/api/v1/employees/${uid}`).then((r) => r.data.data),
        staleTime: 0,
      });
    }
  }, [queryClient, user?.id]);

  async function handleLogout() {
    const refreshToken = localStorage.getItem("cadb_refresh_token");
    await api.post("/api/v1/auth/logout", { refreshToken }).catch(() => {});
    queryClient.clear();
    clearAuth();
    router.push("/login");
  }

  const isSuperAdmin = role === "SUPER_ADMIN";

  const theme = {
    aside: "bg-gray-50 border-r border-gray-200",
    logoBorder: "border-gray-200",
    logoSubtitle: "text-xs text-gray-400 uppercase tracking-widest font-medium",
    sectionLabel: "text-gray-400",
    activeLink: "bg-[#1e3464] text-white",
    inactiveLink: "text-gray-600 hover:bg-gray-200 hover:text-gray-900",
    userBorder: "border-gray-200",
    userName: "text-gray-900",
    userRole: "text-gray-500",
    logoutBtn: "text-gray-400 hover:text-gray-700",
  };

  return (
    <aside className={cn("flex h-screen w-64 flex-col text-inherit", theme.aside)}>
      {/* Logo */}
      <div className={cn("flex h-16 items-center gap-3 px-4 border-b", theme.logoBorder)}>
        <Image src="/logo.png" alt="Centum Academy" width={36} height={36} className="shrink-0 rounded-full" />
        <div>
          <p className="font-semibold text-sm leading-tight text-gray-900">Centum Academy</p>
          <p className={theme.logoSubtitle}>{isSuperAdmin ? "Administration" : "Dashboard"}</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <p className={cn("px-3 mb-2 text-xs font-semibold uppercase tracking-wider", theme.sectionLabel)}>
          My Dashboard
        </p>
        {mainNav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              onMouseEnter={() => prefetch(item.href)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active ? theme.activeLink : theme.inactiveLink
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.name}
            </Link>
          );
        })}

        {mgmtNav.length > 0 && (
          <>
            <p className={cn("px-3 mt-6 mb-2 text-xs font-semibold uppercase tracking-wider", theme.sectionLabel)}>Management</p>
            {mgmtNav.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={true}
                  onMouseEnter={() => prefetch(item.href)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active ? theme.activeLink : theme.inactiveLink
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.name}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* User */}
      <div className={cn("border-t px-4 py-3", theme.userBorder)}>
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full overflow-hidden bg-[#1e3464]">
            <img
              src={user?.photoUrl ? resolvePhotoUrl(user.photoUrl)! : "/default-avatar.svg"}
              alt="avatar"
              className="h-full w-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className={cn("text-sm font-medium truncate", theme.userName)}>{user ? `${user.firstName} ${user.lastName}` : "Loading..."}</p>
            <p className={cn("text-xs truncate", theme.userRole)}>{user?.role?.replace(/_/g, " ")}</p>
          </div>
          <button onClick={handleLogout} className={cn("transition-colors", theme.logoutBtn)}>
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
