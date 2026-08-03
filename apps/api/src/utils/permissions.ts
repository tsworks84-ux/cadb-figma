import { prisma } from "@cadb/db";
import type { JwtPayload } from "@cadb/types";
import type { FastifyRequest, FastifyReply } from "fastify";

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

// ─── ACADEMICS MODULE GATING ────────────────────────────────────────────────

/** Every module that maps to a tab / section of the Academics area. */
export const ACADEMICS_MODULES = [
  "ACA_BATCH", "ACA_SUBJECT", "ACA_SETTINGS",
  "STU_PROFILE", "STU_ADMISSION", "STU_ATTENDANCE",
  "STU_ASSIGNMENT", "STU_ASSESSMENT", "STU_TIMETABLE",
] as const;

/**
 * SUPER_ADMIN and HR_ADMIN keep unconditional academics access — matching the
 * existing academic-settings gate and the UI, where those two bypass the matrix.
 * Everyone else (DEPT_HEAD, EMPLOYEE, custom roles) goes through RolePermission.
 */
export function isAcademicsAdmin(role: string | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "HR_ADMIN";
}

const METHOD_ACTION: Record<string, PermAction> = {
  GET: "canView", HEAD: "canView",
  POST: "canCreate",
  PUT: "canEdit", PATCH: "canEdit",
  DELETE: "canDelete",
};

/**
 * Resolves the module(s) a request touches. Return `null` to skip the check —
 * used for self-scoped reads (a teacher's own timetable/batches) that belong to
 * "my work", not to the Academics module.
 */
export type ModuleResolver = (
  request: FastifyRequest,
) => string | string[] | null;

/**
 * Fastify preHandler that gates a route plugin on the permission matrix.
 * Must be registered AFTER `authenticate` so `request.user` is populated.
 */
export function requireModulePermission(spec: string | string[] | ModuleResolver) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as JwtPayload | undefined;
    if (!user) {
      return reply.status(401).send({ success: false, error: "Unauthorized", statusCode: 401 });
    }
    if (isAcademicsAdmin(user.role)) return;

    const resolved = typeof spec === "function" ? spec(request) : spec;
    if (resolved === null) return;

    const modules = Array.isArray(resolved) ? resolved : [resolved];
    const action = METHOD_ACTION[request.method] ?? "canView";
    if (await hasAnyPermission(user, modules, action)) return;

    return reply.status(403).send({
      success: false,
      error: "Insufficient permissions",
      statusCode: 403,
    });
  };
}
