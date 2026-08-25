import { prisma } from "@cadb/db";

/**
 * Reporting-line helpers shared by the approval flows.
 *
 * Two things confer authority over an employee, independent of their role name:
 *   - being their immediate supervisor (`Employee.reportingToId`)
 *   - heading a department they belong to
 *
 * Headship is stored in two places that `employees.ts` keeps in sync:
 * `EmployeeDepartment.isHead` (the multi-department source of truth) and the
 * legacy single-head `Department.headId`. Both are read here so a record that
 * predates the junction table still resolves.
 */

/** Departments `employeeId` heads. */
export async function getHeadedDepartmentIds(employeeId: string): Promise<string[]> {
  const [memberships, legacy] = await Promise.all([
    prisma.employeeDepartment.findMany({
      where: { employeeId, isHead: true },
      select: { departmentId: true },
    }),
    prisma.department.findMany({
      where: { headId: employeeId },
      select: { id: true },
    }),
  ]);
  return [...new Set([
    ...memberships.map((m) => m.departmentId),
    ...legacy.map((d) => d.id),
  ])];
}

/** Is `targetId` in any of `deptIds` — as their primary department or a secondary membership? */
export async function isInDepartments(targetId: string, deptIds: string[]): Promise<boolean> {
  if (deptIds.length === 0) return false;
  const hit = await prisma.employee.findFirst({
    where: {
      id: targetId,
      OR: [
        { departmentId: { in: deptIds } },
        { deptMemberships: { some: { departmentId: { in: deptIds } } } },
      ],
    },
    select: { id: true },
  });
  return hit !== null;
}

/**
 * Is `viewerId` the immediate reporting manager of `targetId`?
 * Self never counts — nobody supervises themselves.
 */
export async function isImmediateSupervisor(viewerId: string, targetId: string): Promise<boolean> {
  if (viewerId === targetId) return false;
  const target = await prisma.employee.findUnique({
    where: { id: targetId },
    select: { reportingToId: true },
  });
  return target?.reportingToId === viewerId;
}

/** Does `viewerId` head a department that `targetId` belongs to? Self never counts. */
export async function isDepartmentHeadOf(viewerId: string, targetId: string): Promise<boolean> {
  if (viewerId === targetId) return false;
  const deptIds = await getHeadedDepartmentIds(viewerId);
  return isInDepartments(targetId, deptIds);
}

/**
 * Prisma `Employee` filter matching everyone `viewerId` supervises or whose
 * department they head, excluding themselves. Returns null when the viewer has
 * neither relationship, so callers can short-circuit to an empty result.
 */
export async function buildReportingScopeFilter(viewerId: string) {
  const headedDeptIds = await getHeadedDepartmentIds(viewerId);

  const or: any[] = [{ reportingToId: viewerId }];
  if (headedDeptIds.length > 0) {
    or.push(
      { departmentId: { in: headedDeptIds } },
      { deptMemberships: { some: { departmentId: { in: headedDeptIds } } } },
    );
  }

  return { OR: or, NOT: { id: viewerId } };
}

/** Every department `employeeId` belongs to — primary plus secondary memberships. */
export async function getDepartmentIdsFor(employeeId: string): Promise<string[]> {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      departmentId: true,
      deptMemberships: { select: { departmentId: true } },
    },
  });
  if (!employee) return [];
  return [...new Set([
    employee.departmentId,
    ...employee.deptMemberships.map((m) => m.departmentId),
  ])];
}

/**
 * Everyone who heads any of `deptIds` — the inverse of `getHeadedDepartmentIds`.
 * Reads both the junction table and the legacy `Department.headId`, for the same
 * reason `getHeadedDepartmentIds` does.
 */
export async function getDepartmentHeadIds(deptIds: string[]): Promise<string[]> {
  if (deptIds.length === 0) return [];
  const [memberships, legacy] = await Promise.all([
    prisma.employeeDepartment.findMany({
      where: { departmentId: { in: deptIds }, isHead: true },
      select: { employeeId: true },
    }),
    prisma.department.findMany({
      where: { id: { in: deptIds }, headId: { not: null } },
      select: { headId: true },
    }),
  ]);
  return [...new Set([
    ...memberships.map((m) => m.employeeId),
    ...legacy.map((d) => d.headId!),
  ])];
}
