import { prisma } from "@cadb/db";

/**
 * Confirms employees whose default 3-month probation (measured from their joining
 * date) has elapsed: flips PROBATION → ACTIVE and stamps confirmationDate at the
 * probation-end date (unless one was already recorded). Idempotent and safe to run
 * repeatedly. Returns the number of employees confirmed.
 */
export async function confirmExpiredProbations(): Promise<number> {
  const count = await prisma.$executeRawUnsafe(`
    UPDATE "Employee"
    SET "status" = 'ACTIVE',
        "confirmationDate" = COALESCE("confirmationDate", "joiningDate" + INTERVAL '3 months')
    WHERE "status" = 'PROBATION'
      AND "deletedAt" IS NULL
      AND "joiningDate" <= NOW() - INTERVAL '3 months'
  `);
  return count as number;
}
