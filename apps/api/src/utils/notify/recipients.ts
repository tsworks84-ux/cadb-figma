import { prisma } from "@cadb/db";

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
  /** Why this person is being told — used for ordering and for debugging. */
  reason: "SUPERVISOR" | "HR_ADMIN" | "SUPER_ADMIN" | "SELF" | "EVERYONE";
};

/** The standing audience for any request, whoever raised it. */
const STANDING_ROLES = ["HR_ADMIN", "SUPER_ADMIN"] as const;

/**
 * Everyone who should hear about a request `employeeId` has raised — leave or
 * reimbursement claim alike:
 *
 *   1. their immediate supervisor (`reportingToId`)
 *   2. every HR_ADMIN
 *   3. every SUPER_ADMIN
 *
 * Deliberately nobody else. A request is one employee's business with the
 * person who decides it plus the two roles accountable for the record; anyone
 * who merely sits near them in the org chart does not need it in their inbox.
 *
 * This is narrower than it was. Department heads used to be notified for every
 * department an employee belonged to, and HR was addressed through each
 * department's `hrPartnerId` with a fallback to the HR pool. Both are gone:
 * headship is an org-chart fact that says nothing about who decides a leave
 * (approval authority is the reporting line — see hasLeaveAuthorityOver in
 * routes/v1/leaves.ts), and routing HR by department meant a partner who is not
 * an HR_ADMIN got requests while an HR_ADMIN who was nobody's partner did not.
 * `Department.hrPartnerId` is untouched and still means what it did; it just no
 * longer decides who is notified.
 *
 * The applicant themselves is always excluded — HR staff and Super Admins apply
 * for leave too, and nobody needs to be told about their own request — as is
 * anyone soft-deleted. Earlier reasons win on duplicates, so a supervisor who
 * is also an HR_ADMIN is messaged once, as the supervisor.
 */
export async function resolveApprovalRecipients(employeeId: string): Promise<Recipient[]> {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { reportingToId: true },
  });
  if (!employee) return [];

  // Terminated staff keep their role but should stop receiving traffic; the
  // announcement audience already drops them, and an approval notice is no
  // more use to someone who has left.
  const standing = await prisma.employee.findMany({
    where: { role: { in: [...STANDING_ROLES] }, deletedAt: null, status: { not: "TERMINATED" } },
    select: { id: true, role: true },
  });

  const ordered: Array<{ id: string; reason: Recipient["reason"] }> = [
    ...(employee.reportingToId ? [{ id: employee.reportingToId, reason: "SUPERVISOR" as const }] : []),
    ...standing.filter((e) => e.role === "HR_ADMIN").map((e) => ({ id: e.id, reason: "HR_ADMIN" as const })),
    ...standing.filter((e) => e.role === "SUPER_ADMIN").map((e) => ({ id: e.id, reason: "SUPER_ADMIN" as const })),
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
