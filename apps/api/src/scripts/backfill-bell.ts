import "dotenv/config";
import { prisma } from "@cadb/db";
import { notifyLeaveEvent, notifyClaimEvent, notifyCompOffEvent } from "../utils/notify/index.js";

/**
 * Seeds the bell with the requests that are already waiting for a decision.
 *
 * The in-app channel went live after these were raised, so their approvers have
 * an empty bell and a queue of work — this walks everything still open and
 * writes the notification that would have been written at the time.
 *
 * Two things make it safe to run more than once, and safe to run on prod:
 *
 *   - IN_APP only. The email for these went out weeks ago; re-sending it would
 *     be a mailbox full of "awaiting your decision" for decisions already made.
 *   - Deduped per recipient and entity, so a second run adds nothing.
 *
 * Prints what it would do and exits unless you pass `--apply`:
 *
 *     node dist/scripts/backfill-bell.js            # dry run
 *     node dist/scripts/backfill-bell.js --apply
 *
 * It lives under src/ rather than the sibling scripts/ folder so that it is
 * compiled into dist and ships with the deploy — production has no source tree
 * to run it from.
 */

const APPLY = process.argv.includes("--apply");
const IN_APP_ONLY = { onlyChannels: ["IN_APP" as const], dedupe: true };

async function main() {
  const [leaves, cancellingLeaves, claims, cancellingClaims, compOffs] = await Promise.all([
    prisma.leaveApplication.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" } }),
    prisma.leaveApplication.findMany({ where: { status: "CANCELLATION_PENDING" }, orderBy: { createdAt: "asc" } }),
    prisma.reimbursementClaim.findMany({ where: { status: "SUBMITTED" }, orderBy: { createdAt: "asc" } }),
    prisma.reimbursementClaim.findMany({ where: { status: "CANCELLATION_PENDING" }, orderBy: { createdAt: "asc" } }),
    prisma.compOffRequest.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" } }),
  ]);

  const plan = [
    ["Leave applications awaiting approval", leaves.length],
    ["Leave cancellations awaiting sign-off", cancellingLeaves.length],
    ["Claims awaiting approval", claims.length],
    ["Claim cancellations awaiting sign-off", cancellingClaims.length],
    ["Comp-off requests awaiting approval", compOffs.length],
  ] as const;

  for (const [label, count] of plan) console.log(`${String(count).padStart(4)}  ${label}`);

  const total = plan.reduce((sum, [, count]) => sum + count, 0);
  if (total === 0) {
    console.log("\nNothing open — no backfill needed.");
    return;
  }

  if (!APPLY) {
    console.log(`\n${total} open request(s). Re-run with --apply to write their bell notifications.`);
    return;
  }

  const before = await prisma.notification.count({ where: { channel: "IN_APP" } });

  for (const leave of leaves) await notifyLeaveEvent("LEAVE_APPLIED", leave, IN_APP_ONLY);
  for (const leave of cancellingLeaves) await notifyLeaveEvent("LEAVE_CANCEL_REQUESTED", leave, IN_APP_ONLY);
  for (const claim of claims) await notifyClaimEvent("CLAIM_SUBMITTED", claim, IN_APP_ONLY);
  for (const claim of cancellingClaims) await notifyClaimEvent("CLAIM_CANCEL_REQUESTED", claim, IN_APP_ONLY);
  for (const compOff of compOffs) await notifyCompOffEvent("COMP_OFF_REQUESTED", compOff, IN_APP_ONLY);

  const after = await prisma.notification.count({ where: { channel: "IN_APP" } });
  console.log(`\nWrote ${after - before} bell notification(s) across ${total} open request(s).`);
}

await main();
await prisma.$disconnect();
