import type { PermMap } from "@/hooks/usePermissions";

/**
 * Single source of truth for who may see what inside the Academics area.
 * The API enforces the same mapping (apps/api/src/utils/permissions.ts) — this
 * side only decides what to render, never what is authoritative.
 */

/** Every module that maps to a tab / section of Academics. */
export const ACADEMICS_MODULES = [
  "ACA_BATCH", "ACA_SUBJECT", "ACA_SETTINGS",
  "STU_PROFILE", "STU_ADMISSION", "STU_ATTENDANCE",
  "STU_ASSIGNMENT", "STU_ASSESSMENT", "STU_TIMETABLE",
] as const;

/**
 * Only SUPER_ADMIN bypasses the matrix, matching the API. Every other role —
 * HR_ADMIN included — needs the grant, so nothing is editable in Academics
 * unless the super admin has granted it.
 */
export function isAcademicsAdmin(role: string | undefined): boolean {
  return role === "SUPER_ADMIN";
}

/** Does the role hold `action` on `module` for Academics? */
export function hasAcademicsAction(
  role: string | undefined,
  permissions: PermMap,
  module: string,
  action: "canCreate" | "canEdit" | "canDelete",
): boolean {
  if (isAcademicsAdmin(role)) return true;
  return permissions[module]?.[action] ?? false;
}

/** `null` module = no specific grant needed beyond having *some* academics access. */
export interface AcademicsTab {
  name: string;
  href: string;
  module: string | null;
  exact: boolean;
}

export const ACADEMICS_TABS: AcademicsTab[] = [
  { name: "Overview",    href: "/dashboard/academics",             module: null,              exact: true  },
  { name: "Students",    href: "/dashboard/academics/students",    module: "STU_PROFILE",     exact: false },
  { name: "Schedule",    href: "/dashboard/academics/schedule",    module: "STU_TIMETABLE",   exact: false },
  { name: "Batches",     href: "/dashboard/academics/batches",     module: "ACA_BATCH",       exact: false },
  { name: "Assignments", href: "/dashboard/academics/assignments", module: "STU_ASSIGNMENT",  exact: false },
  { name: "Assessments", href: "/dashboard/academics/assessments", module: "STU_ASSESSMENT",  exact: false },
  { name: "Reports",     href: "/dashboard/academics/reports",     module: null,              exact: false },
  { name: "Settings",    href: "/dashboard/academics/settings",    module: "ACA_SETTINGS",    exact: false },
];

/** Sub-routes that aren't tabs but still need a grant when deep-linked. */
const EXTRA_ROUTE_MODULES: { prefix: string; module: string }[] = [
  { prefix: "/dashboard/academics/admission", module: "STU_ADMISSION" },
];

/** Does the role have view access to at least one part of Academics? */
export function canViewAcademics(role: string | undefined, permissions: PermMap): boolean {
  if (isAcademicsAdmin(role)) return true;
  return ACADEMICS_MODULES.some((m) => permissions[m]?.canView ?? false);
}

/** May this role open `href`? */
export function canViewAcademicsTab(
  role: string | undefined,
  permissions: PermMap,
  module: string | null,
): boolean {
  if (isAcademicsAdmin(role)) return true;
  // A `null` module means the page has no dedicated grant (Overview, Reports) —
  // any academics view permission is enough to open it.
  if (module === null) return canViewAcademics(role, permissions);
  return permissions[module]?.canView ?? false;
}

/** Resolve a pathname inside /dashboard/academics to the module that guards it. */
export function moduleForAcademicsPath(pathname: string): string | null {
  const extra = EXTRA_ROUTE_MODULES.find((r) => pathname.startsWith(r.prefix));
  if (extra) return extra.module;

  // Longest matching href wins, so /students/new resolves like /students.
  const match = ACADEMICS_TABS
    .filter((t) => t.href !== "/dashboard/academics")
    .filter((t) => pathname === t.href || pathname.startsWith(t.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0];

  return match?.module ?? null;
}
