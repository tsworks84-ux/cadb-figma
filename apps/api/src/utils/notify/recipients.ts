import { prisma } from "@cadb/db";
import { getDepartmentIdsFor, getDepartmentHeadIds } from "../orgHierarchy.js";

/** The fields every channel needs to address a person. */
export const RECIPIENT_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  whatsappNumber: true,
  whatsappOptIn: true,
  officialPhone: true,
  personalPhone: true,
} as const;

export type Recipient = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  whatsappNumber: string | null;
  whatsappOptIn: boolean;
  officialPhone: string | null;
  personalPhone: string | null;
  /** Why this person is being told — used in the greeting and for debugging. */
  reason: "SUPERVISOR" | "DEPT_HEAD" | "HR_PARTNER" | "HR_POOL" | "SELF" | "EVERYONE";
};

/** Roles that constitute the HR pool when no department HR partner is set. */
const HR_POOL_ROLES = ["HR_ADMIN"];

/**
 * Everyone who should hear about a request `employeeId` has raised — leave or
 * reimbursement claim alike:
 *
 *   1. their immediate supervisor (`reportingToId`)
 *   2. the head of every department they belong to
 *   3. the HR partner of every department they belong to
 *
 * If no department names an HR partner, the whole HR_ADMIN pool is used
 * instead — a department nobody has configured must not silently go unnotified.
 * That fallback is the reason this returns a list rather than one address.
 *
 * The applicant themselves is always excluded (someone can head their own
 * department, or be their own department's HR partner), as is anyone
 * soft-deleted. Earlier reasons win on duplicates, so a supervisor who also
 * heads the department is greeted as the supervisor and messaged once.
 */
export async function resolveApprovalRecipients(employeeId: string): Promise<Recipient[]> {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { reportingToId: true },
  });
  if (!employee) return [];

  const deptIds = await getDepartmentIdsFor(employeeId);

  const [headIds, depts] = await Promise.all([
    getDepartmentHeadIds(deptIds),
    prisma.department.findMany({
      where: { id: { in: deptIds }, hrPartnerId: { not: null } },
      select: { hrPartnerId: true },
    }),
  ]);

  const hrPartnerIds = [...new Set(depts.map((d) => d.hrPartnerId!))];

  // Only fall back to the pool when *no* department named a partner. A partly
  // configured org uses the partners it has rather than mailing all of HR.
  let hrPoolIds: string[] = [];
  if (hrPartnerIds.length === 0) {
    const pool = await prisma.employee.findMany({
      where: { role: { in: HR_POOL_ROLES }, deletedAt: null },
      select: { id: true },
    });
    hrPoolIds = pool.map((e) => e.id);
  }

  const ordered: Array<{ id: string; reason: Recipient["reason"] }> = [
    ...(employee.reportingToId ? [{ id: employee.reportingToId, reason: "SUPERVISOR" as const }] : []),
    ...headIds.map((id) => ({ id, reason: "DEPT_HEAD" as const })),
    ...hrPartnerIds.map((id) => ({ id, reason: "HR_PARTNER" as const })),
    ...hrPoolIds.map((id) => ({ id, reason: "HR_POOL" as const })),
  ];

  return hydrate(ordered, employeeId);
}

/** The applicant themselves — for decision notices, which go back to them. */
export async function resolveSelfRecipient(employeeId: string): Promise<Recipient[]> {
  return hydrate([{ id: employeeId, reason: "SELF" }], null);
}

/**
 * Every active employee except `excludeId` — for company-wide notices, which
 * have no approval chain to walk.
 *
 * Terminated staff are dropped as well as soft-deleted ones: the same rule the
 * announcement audience count already uses, so the bell and the "notified N
 * people" figure on the announcement can't disagree.
 */
export async function resolveEveryoneElse(excludeId: string): Promise<Recipient[]> {
  const rows = await prisma.employee.findMany({
    where: { deletedAt: null, status: { not: "TERMINATED" }, id: { not: excludeId } },
    select: RECIPIENT_SELECT,
    orderBy: { id: "asc" },
  });
  return rows.map((row) => ({ ...row, reason: "EVERYONE" as const }));
}

/**
 * Turns (id, reason) pairs into addressable people: first reason wins per id,
 * `excludeId` and soft-deleted records are dropped, and the original ordering
 * is preserved so the primary recipient stays first.
 */
async function hydrate(
  ordered: Array<{ id: string; reason: Recipient["reason"] }>,
  excludeId: string | null,
): Promise<Recipient[]> {
  const reasonById = new Map<string, Recipient["reason"]>();
  for (const { id, reason } of ordered) {
    if (id === excludeId) continue;
    if (!reasonById.has(id)) reasonById.set(id, reason);
  }
  if (reasonById.size === 0) return [];

  const rows = await prisma.employee.findMany({
    where: { id: { in: [...reasonById.keys()] }, deletedAt: null },
    select: RECIPIENT_SELECT,
  });
  const byId = new Map(rows.map((r) => [r.id, r]));

  return [...reasonById.entries()]
    .map(([id, reason]) => {
      const row = byId.get(id);
      return row ? { ...row, reason } : null;
    })
    .filter((r): r is Recipient => r !== null);
}
