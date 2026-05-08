"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Users, Home, CalendarOff, Receipt, Shield,
  GraduationCap, Settings, LogOut, BarChart3, Building2, User,
  CalendarDays, UsersRound, ListTodo, Megaphone,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
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
  // Directory access is role-based — never depends on async permissions fetch
  const canViewDirectory = role === "SUPER_ADMIN" || role === "HR_ADMIN" || role === "DEPT_HEAD";
  // Administration is restricted to SUPER_ADMIN only — not configurable via permissions
  const canViewAdmin = role === "SUPER_ADMIN";
  const canViewMIS = Object.keys(permissions)
    .filter((k) => k.startsWith("MIS_"))
    .some((k) => permissions[k]?.canView);

  const profileEntry = canViewDirectory
    ? { name: "Employees", href: "/dashboard/employees", icon: Users }
    : { name: "My Profile", href: user?.id ? `/dashboard/employees/${user.id}` : "#", icon: User };

  const mainNav = [
    { name: "Home", href: "/dashboard/home", icon: Home },
    { name: "Announcements", href: "/dashboard/announcements", icon: Megaphone },
    { name: "My Team", href: "/dashboard/my-team", icon: UsersRound },
    { name: "My To-Do", href: "/dashboard/todos", icon: ListTodo },
    { name: "Leaves", href: "/dashboard/leaves", icon: CalendarOff },
    { name: "Holidays", href: "/dashboard/holidays", icon: CalendarDays },
    { name: "Claims", href: "/dashboard/claims", icon: Receipt },
    { name: "Policies", href: "/dashboard/policies", icon: Shield },
    { name: "Training", href: "/dashboard/training", icon: GraduationCap },
    { name: "Settings", href: "/dashboard/settings", icon: Settings },
  ];

  const mgmtNav = [
    profileEntry,
    ...(canViewAdmin ? [{ name: "Administration", href: "/dashboard/admin", icon: Building2 }] : []),
    ...(canViewMIS   ? [{ name: "MIS Reports",     href: "/dashboard/mis",   icon: BarChart3 }]  : []),
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

  return (
    <aside className="flex h-screen w-64 flex-col bg-slate-900 text-white">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-4 border-b border-slate-700">
        <Image src="/logo.png" alt="Centum Academy" width={36} height={36} className="shrink-0 rounded-full" />
        <div>
          <p className="font-semibold text-sm leading-tight">Centum Academy</p>
          <p className="text-xs text-slate-400">Dashboard</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <p className="px-3 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
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
                active ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.name}
            </Link>
          );
        })}

        {mgmtNav.length > 0 && (
          <>
            <p className="px-3 mt-6 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Management</p>
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
                    active ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
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
      <div className="border-t border-slate-700 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500 text-xs font-bold overflow-hidden">
            {user?.photoUrl
              ? <img src={`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}${user.photoUrl}`} alt="avatar" className="h-full w-full object-cover" />
              : user ? `${user.firstName[0]}${user.lastName[0]}` : "?"
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user ? `${user.firstName} ${user.lastName}` : "Loading..."}</p>
            <p className="text-xs text-slate-400 truncate">{user?.role?.replace("_", " ")}</p>
          </div>
          <button onClick={handleLogout} className="text-slate-400 hover:text-white transition-colors">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
