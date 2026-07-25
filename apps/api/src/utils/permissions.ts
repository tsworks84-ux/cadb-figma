import { prisma } from "@cadb/db";
import type { JwtPayload } from "@cadb/types";

export type PermAction =
  | "canView" | "canCreate" | "canEdit" | "canDelete" | "canApprove" | "canAppraise";

const BUILTIN_ROLES = new Set(["SUPER_ADMIN", "HR_ADMIN", "DEPT_HEAD", "EMPLOYEE"]);

/**
 * True for admin-created custom roles (not one of the four built-ins). Built-in roles
 * keep their existing hard-coded authorization; the permission-matrix path is applied
 * only to custom roles, so granting e.g. DEPT_HEAD a module flag can't silently widen
 * its deliberately-scoped access.
 */
export function isCustomRole(role: string): boolean {
  return !BUILTIN_ROLES.has(role);
}

/**
 * Whether the user's role grants `action` on `module` (per the RolePermission table).
 * SUPER_ADMIN is always allowed — its grants are implicit and not editable.
 * Works for built-in roles AND custom roles, so enforcement matches the assignable
 * permission matrix rather than hard-coded role names.
 */
export async function hasPermission(
  user: JwtPayload,
  module: string,
  action: PermAction,
): Promise<boolean> {
  if (user.role === "SUPER_ADMIN") return true;
  const perm = await prisma.rolePermission.findUnique({
    where: { role_module: { role: user.role, module } },
  });
  return perm?.[action] ?? false;
}

/** Whether the user has `action` on ANY of the given modules. */
export async function hasAnyPermission(
  user: JwtPayload,
  modules: string[],
  action: PermAction,
): Promise<boolean> {
  if (user.role === "SUPER_ADMIN") return true;
  const perms = await prisma.rolePermission.findMany({
    where: { role: user.role, module: { in: modules } },
  });
  return perms.some((p) => p[action]);
}
