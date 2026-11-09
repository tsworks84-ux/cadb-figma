"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn, resolvePhotoUrl } from "@/lib/utils";
import {
  Users, Home, CalendarOff, Receipt, Shield,
  GraduationCap, Settings, LogOut, BarChart3, Building2, User,
  CalendarDays, UsersRound, ListTodo, Megaphone, ClipboardList, School, MessageSquare, IndianRupee, X,
  Archive, FolderOpen, ChevronRight, Briefcase, Wallet, BookOpen, ClipboardCheck, ListChecks,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { useRouter } from "next/navigation";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Image from "next/image";
import { usePermissions, ADMIN_MODULES } from "@/hooks/usePermissions";
import { canViewAcademics, firstAcademicsHref } from "@/lib/academicsAccess";
import { useExamMe } from "@/components/exams/shared";

// How long cached data stays fresh — must match each page's staleTime
const STALE = {
  long: 5 * 60 * 1000,
  medium: 2 * 60 * 1000,
};

type NavItem = { name: string; href: string; icon: React.ElementType; badge?: number };
type NavGroup = { key: string; label: string; icon: React.ElementType; items: NavItem[] };

/** Which groups were left open, remembered per browser. Purely a convenience. */
const OPEN_GROUPS_KEY = "cadb_sidebar_open_groups";
function readOpenGroups(): string[] {
  try {
    const raw = localStorage.getItem(OPEN_GROUPS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((k) => typeof k === "string") : [];
  } catch {
    return [];
  }
}
function writeOpenGroups(keys: string[]) {
  try { localStorage.setItem(OPEN_GROUPS_KEY, JSON.stringify(keys)); } catch { /* private mode etc. */ }
}

/** Does `href` (which may carry a query string) own the current route? */
function isActiveHref(pathname: string, href: string): boolean {
  const path = href.split("?")[0];
  return pathname === path || pathname.startsWith(path + "/");
}

interface SidebarProps {
  /** Drawer state — only meaningful below the `lg` breakpoint. */
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
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
  // Super-admin-only surfaces (Student Feedback, Revenue, the unfiltered Academics
  // view). These are deliberately NOT permission-configurable.
  const canViewAdmin = role === "SUPER_ADMIN";
  // The Administration section itself is per-tab configurable: the link shows if the
  // role can view at least one tab. Which tabs appear is decided inside the page.
  const canViewAdminSection = canViewAdmin
    || ADMIN_MODULES.some((m) => permissions[m]?.canView);
  // The deletion log is the counterweight to the delete/force-cancel powers, so
  // it's visible to exactly the roles that hold them.
  const canViewDeletionLog = role === "SUPER_ADMIN" || role === "HR_ADMIN";
  const canViewMIS = Object.keys(permissions)
    .filter((k) => k.startsWith("MIS_"))
    .some((k) => permissions[k]?.canView);

  const profileEntry = canViewDirectory
    ? { name: "Employees", href: "/dashboard/employees", icon: Users }
    : { name: "My Profile", href: user?.id ? `/dashboard/employees/${user.id}` : "#", icon: User };

  // Settings is self-service only (own photo, password, preferences), so every
  // role gets it — employees included. It lives as a gear in the user footer.
  const settingsHref = "/dashboard/settings";

  const { data: feedbackSummary } = useQuery({
    queryKey: ["feedback-summary"],
    queryFn: () => api.get("/api/v1/feedback/summary").then((r) => r.data.data as Record<string, number>),
    enabled: canViewAdmin,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
  const openFeedbackCount = (feedbackSummary?.OPEN ?? 0) + (feedbackSummary?.RESPONDED ?? 0);

  // Land on the first page the role may open — Overview is a grant of its own
  // (ACA_OVERVIEW), so a role holding only, say, Students goes straight there.
  const academicsLanding = firstAcademicsHref(role, permissions) ?? "/dashboard/academics";
  // For non-admin EMPLOYEE users (teachers), deep-link academics to their own filtered view
  const academicsHref = (!canViewAdmin && role === "EMPLOYEE" && user)
    ? `${academicsLanding}?teacherId=${user.id}`
    : academicsLanding;
  // Academics is only offered to roles that actually hold an academics grant
  const canViewAcademicsNav = canViewAcademics(role, permissions);

  // Examinations: exam stages show up inside My To-Do for everyone who owns
  // one (the overdue count rides on the My To-Do badge). The exam team also
  // keeps a "My Exam Tasks" link next to the board.
  const { data: examMe } = useExamMe();
  const showExamTasks = !!examMe?.showTasks && !!examMe?.canViewBoard;
  const examOverdue = examMe?.showTasks ? examMe.overdueTasks ?? 0 : 0;

  // Home stays a plain link; everything else folds into groups so the panel
  // reads as a handful of rows. Items a role can't open are dropped first, and
  // a group left with a single item is shown as that item, not a one-line dropdown.
  const homeItem: NavItem = { name: "Home", href: "/dashboard/home", icon: Home };

  const myGroups: NavGroup[] = [
    { key: "workspace", label: "Workspace", icon: Briefcase, items: [
      { name: "Notice Board", href: "/dashboard/announcements", icon: Megaphone },
      { name: "My Team",      href: "/dashboard/my-team",       icon: UsersRound },
      { name: "My To-Do",     href: "/dashboard/todos",         icon: ListTodo, badge: examOverdue },
    ] },
    { key: "leave-claims", label: "Leave & Claims", icon: Wallet, items: [
      { name: "Leaves & Holidays", href: "/dashboard/leaves", icon: CalendarOff },
      ...(isPartTime ? [{ name: "My Timesheet", href: "/dashboard/timesheet", icon: ClipboardList }] : []),
      { name: "Claims", href: "/dashboard/claims", icon: Receipt },
    ] },
    { key: "learning", label: "Learning", icon: BookOpen, items: [
      { name: "Policies", href: "/dashboard/policies", icon: Shield },
      { name: "Training", href: "/dashboard/training", icon: GraduationCap },
      ...(permissions.RESOURCES?.canView ? [{ name: "Resources", href: "/dashboard/resources", icon: FolderOpen }] : []),
    ] },
  ];

  const mgmtGroups: NavGroup[] = [
    { key: "people", label: "People", icon: Users, items: [
      profileEntry,
      ...(canViewAdminSection ? [{ name: "Administration", href: "/dashboard/admin",        icon: Building2 }] : []),
      ...(canViewDeletionLog  ? [{ name: "Deletion Log",   href: "/dashboard/deletion-log", icon: Archive   }] : []),
    ] },
    { key: "academics", label: "Academics", icon: School, items: [
      ...(canViewAcademicsNav ? [{ name: "Academics",        href: academicsHref,         icon: School }] : []),
      ...(canViewAdmin        ? [{ name: "Student Feedback", href: "/dashboard/feedback", icon: MessageSquare, badge: openFeedbackCount }] : []),
    ] },
    { key: "exams", label: "Examinations", icon: ClipboardCheck, items: [
      ...(examMe?.canViewBoard ? [{ name: "Exam Board",    href: "/dashboard/exams",       icon: ClipboardCheck }] : []),
      ...(showExamTasks        ? [{ name: "My Exam Tasks", href: "/dashboard/exams/tasks", icon: ListChecks, badge: examMe?.overdueTasks ?? 0 }] : []),
    ] },
    { key: "finance", label: "Finance & Reports", icon: BarChart3, items: [
      ...(canViewAdmin ? [{ name: "Revenue",     href: "/dashboard/revenue", icon: IndianRupee }] : []),
      ...(canViewMIS   ? [{ name: "MIS Reports", href: "/dashboard/mis",     icon: BarChart3   }] : []),
    ] },
  ].filter((g) => g.items.length > 0);

  // Open groups: whatever the user left open, plus the one holding the current
  // page — opened on every navigation so you can always see where you are.
  const [openGroups, setOpenGroups] = useState<string[]>([]);
  useEffect(() => { setOpenGroups(readOpenGroups()); }, []);
  const activeGroupKey = [...myGroups, ...mgmtGroups]
    .find((g) => g.items.some((i) => isActiveHref(pathname, i.href)))?.key;
  useEffect(() => {
    if (!activeGroupKey) return;
    setOpenGroups((prev) => (prev.includes(activeGroupKey) ? prev : [...prev, activeGroupKey]));
  }, [activeGroupKey]);

  const toggleGroup = (key: string) => {
    setOpenGroups((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      writeOpenGroups(next);
      return next;
    });
  };

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

  function renderLink(item: NavItem, nested = false) {
    // A nested route (/dashboard/exams/tasks) belongs to its own link, not
    // also to a parent link (/dashboard/exams) that happens to prefix it.
    const allHrefs = [...myGroups, ...mgmtGroups].flatMap((g) => g.items.map((i) => i.href.split("?")[0]));
    const longerMatch = allHrefs.some((h) => h !== item.href.split("?")[0] && h.length > item.href.split("?")[0].length && isActiveHref(pathname, h));
    const active = isActiveHref(pathname, item.href) && !longerMatch;
    return (
      <Link
        key={item.href}
        href={item.href}
        prefetch={true}
        onMouseEnter={() => prefetch(item.href)}
        onClick={onMobileClose}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          nested && "py-1.5",
          active ? theme.activeLink : theme.inactiveLink,
        )}
      >
        <item.icon className="h-4 w-4 shrink-0" />
        <span className="flex-1 truncate">{item.name}</span>
        {!!item.badge && <Badge count={item.badge} />}
      </Link>
    );
  }

  function renderGroup(group: NavGroup) {
    if (group.items.length === 1) return renderLink(group.items[0]);
    const open = openGroups.includes(group.key);
    const holdsActive = group.key === activeGroupKey;
    const badgeTotal = group.items.reduce((n, i) => n + (i.badge ?? 0), 0);
    const panelId = `nav-group-${group.key}`;
    return (
      <div key={group.key}>
        <button
          type="button"
          onClick={() => toggleGroup(group.key)}
          aria-expanded={open}
          aria-controls={panelId}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            holdsActive && !open ? "text-[#1e3464] bg-[#1e3464]/10" : theme.inactiveLink,
          )}
        >
          <group.icon className="h-4 w-4 shrink-0" />
          <span className="flex-1 truncate text-left">{group.label}</span>
          {!open && badgeTotal > 0 && <Badge count={badgeTotal} />}
          <ChevronRight className={cn("h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200", open && "rotate-90")} />
        </button>
        {/* grid-rows 0fr→1fr animates to the content's own height */}
        <div
          id={panelId}
          className={cn("grid transition-[grid-template-rows] duration-200 ease-out", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}
        >
          <div className="overflow-hidden">
            <div className="ml-5 mt-1 mb-1 space-y-0.5 border-l border-gray-200 pl-2" inert={!open || undefined}>
              {group.items.map((item) => renderLink(item, true))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Mobile backdrop — tap to dismiss the drawer */}
      <div
        onClick={onMobileClose}
        className={cn(
          "fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 lg:hidden",
          mobileOpen ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-full w-64 flex-col text-inherit",
          // Below lg the sidebar slides in as an overlay drawer…
          "transform transition-transform duration-300 ease-in-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          // …and from lg up it sits in the normal flow, always visible.
          "lg:relative lg:translate-x-0",
          theme.aside,
        )}
      >
      {/* Logo */}
      <div className={cn("flex h-16 items-center gap-3 px-4 border-b", theme.logoBorder)}>
        <Image src="/logo.png" alt="Centum Academy" width={36} height={36} className="shrink-0 rounded-full" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-tight text-gray-900 truncate">Centum Academy</p>
          <p className={theme.logoSubtitle}>{isSuperAdmin ? "Administration" : "Dashboard"}</p>
        </div>
        {/* Mobile close button */}
        <button
          onClick={onMobileClose}
          className="lg:hidden p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors"
          aria-label="Close menu"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <p className={cn("px-3 mb-2 text-xs font-semibold uppercase tracking-wider", theme.sectionLabel)}>
          My Dashboard
        </p>
        {renderLink(homeItem)}
        {myGroups.map(renderGroup)}

        {mgmtGroups.length > 0 && (
          <>
            {/* padding, not margin: the nav's space-y rule overrides a top margin here */}
            <p className={cn("px-3 pt-5 pb-1 text-xs font-semibold uppercase tracking-wider", theme.sectionLabel)}>Management</p>
            {mgmtGroups.map(renderGroup)}
          </>
        )}
      </nav>

      {/* User */}
      <div className={cn("border-t px-4 py-3", theme.userBorder)}>
        <div className="flex items-center gap-2">
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
          <Link
            href={settingsHref}
            onClick={onMobileClose}
            aria-label="Settings"
            title="Settings"
            className={cn(
              "rounded-md p-1.5 transition-colors",
              isActiveHref(pathname, settingsHref) ? "bg-[#1e3464] text-white" : cn(theme.logoutBtn, "hover:bg-gray-200"),
            )}
          >
            <Settings className="h-4 w-4" />
          </Link>
          <button onClick={handleLogout} aria-label="Log out" title="Log out" className={cn("rounded-md p-1.5 transition-colors hover:bg-gray-200", theme.logoutBtn)}>
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
      </aside>
    </>
  );
}

function Badge({ count }: { count: number }) {
  return (
    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-semibold text-white leading-none">
      {count > 99 ? "99+" : count}
    </span>
  );
}
