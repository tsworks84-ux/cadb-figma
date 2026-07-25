/**
 * Leave accrual helpers shared across the leave endpoints.
 *
 * The financial year (FY) runs April 1 – March 31. Leaves accrue monthly:
 * 1/12 of the annual allocation per elapsed month. Accrual is pro-rated by the
 * employee's joining date — an employee who joins mid-year only accrues from
 * their joining month onward.
 */

/** Returns the FY start year for a date (FY runs April 1 – March 31). */
export function getFiscalYear(date: Date): number {
  return date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
}

/** Month index within FY `fyYear`: April = 1 … March = 12 (≤ 0 for earlier dates). */
function monthIndex(date: Date, fyYear: number): number {
  return (date.getFullYear() - fyYear) * 12 + (date.getMonth() + 1) - 3;
}

/**
 * Days accrued so far in FY `fyYear`, pro-rated by joining date.
 *
 * - A full-year employee (joined before this FY) accrues monthly from April.
 * - An employee who joins during the FY starts accruing from their joining
 *   month: join day 1–15 → that month counts in full; join day 16–31 → that
 *   month counts as half. Every subsequent month counts in full.
 */
export function computeAccrued(
  allocated: number,
  fyYear: number,
  joiningDate?: Date | null,
): number {
  const now = new Date();
  const fyStart = new Date(fyYear, 3, 1);            // April 1
  const fyEndExclusive = new Date(fyYear + 1, 3, 1); // April 1 next year
  if (now < fyStart) return 0;

  // How many months into the FY we are today (capped at the full year once it ends).
  const nowIdx = now >= fyEndExclusive ? 12 : monthIndex(now, fyYear); // 1 … 12

  // Where accrual starts within this FY, and how much the first month counts.
  let startIdx = 1;            // full-year employees accrue from April
  let firstMonthFraction = 1;
  if (joiningDate && joiningDate >= fyStart) {
    if (joiningDate >= fyEndExclusive) return 0; // joined after this FY entirely
    startIdx = monthIndex(joiningDate, fyYear);  // 1 … 12
    firstMonthFraction = joiningDate.getDate() <= 15 ? 1 : 0.5;
  }

  if (nowIdx < startIdx) return 0; // hasn't started accruing yet
  const months = firstMonthFraction + (nowIdx - startIdx);
  return Math.round((Math.min(months, 12) / 12) * allocated * 10) / 10;
}

/**
 * Carry-forward from a completed prior FY into the new year's balance.
 * Leftover = full pro-rated entitlement earned last year minus what was used,
 * optionally capped by the policy rule's `maxCarryForward` (0 = no cap).
 * Returns 0 when there is no prior-year balance.
 */
export function computeCarryForward(
  prev: { allocated: number; used: number } | undefined,
  prevYear: number,
  joiningDate: Date | null | undefined,
  cap: number,
): number {
  if (!prev) return 0;
  // In a later FY, computeAccrued for `prevYear` returns the full pro-rated annual entitlement.
  const earned = computeAccrued(prev.allocated, prevYear, joiningDate);
  const leftover = Math.max(0, earned - prev.used);
  return cap > 0 ? Math.min(leftover, cap) : leftover;
}
