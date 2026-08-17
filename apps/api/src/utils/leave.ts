import type { LeaveStatus } from "@cadb/db";

/**
 * Leave accrual helpers shared across the leave endpoints.
 *
 * The financial year (FY) runs April 1 – March 31. Leaves accrue monthly:
 * 1/12 of the annual allocation per elapsed month. Accrual is pro-rated by the
 * employee's joining date — an employee who joins mid-year only accrues from
 * their joining month onward.
 */

/**
 * Statuses in which a leave is actually in force.
 *
 * CANCELLATION_PENDING belongs here: the employee has asked to withdraw an
 * approved leave, but until the approver signs off the leave stands — the days
 * stay deducted, the employee still counts as away, and any LoP still applies.
 * Filtering on `status: "APPROVED"` alone would quietly drop those records from
 * payroll and presence for as long as the request sits unanswered.
 */
export const IN_FORCE_LEAVE_STATUSES: LeaveStatus[] = ["APPROVED", "CANCELLATION_PENDING"];

const MS_PER_DAY = 86_400_000;

/**
 * Epoch ms at UTC midnight of `date`'s day.
 *
 * Leave dates originate as `YYYY-MM-DD`, i.e. UTC midnight, so every day and
 * weekday calculation here reads UTC: local-time accessors report the previous
 * day for any server running west of Greenwich.
 */
function utcDay(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function isSunday(dayMs: number): boolean {
  return new Date(dayMs).getUTCDay() === 0;
}

/**
 * The stretch of days a leave actually charges, as UTC-midnight bounds.
 *
 * The office works Monday–Saturday, and the sandwich rule charges any
 * non-working day that falls *inside* a leave span: leave from Friday with a
 * return on Tuesday is four days (Fri, Sat, Sun, Mon), not two. Since Saturday
 * is an ordinary working day and a sandwiched Sunday is charged, every calendar
 * day between the bounds counts.
 *
 * Sundays at the ends are trimmed — nobody works a Sunday, so a range that
 * opens or closes on one isn't charged for it. A range of nothing but Sundays
 * charges nothing at all, which is `null` here and a rejection at the callers.
 */
function chargedSpan(from: Date, to: Date): { start: number; end: number } | null {
  let start = utcDay(from);
  let end   = utcDay(to);
  while (start <= end && isSunday(start)) start += MS_PER_DAY;
  while (end >= start && isSunday(end))   end -= MS_PER_DAY;
  return start > end ? null : { start, end };
}

/** Days charged for a leave running `from` … `to`, both ends inclusive. */
export function countLeaveDays(from: Date, to: Date): number {
  const span = chargedSpan(from, to);
  return span ? Math.round((span.end - span.start) / MS_PER_DAY) + 1 : 0;
}

/**
 * Calendar days in `month` (1–12) of `year` — the denominator for a day's pay.
 * A day off costs 1/31 of the month's salary in January and 1/28 (or 1/29 in a
 * leap year) in February, so the divisor is the length of the month itself, not
 * a count of its working days.
 */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * How much of a leave's loss of pay lands in one calendar month, so payroll can
 * charge each month's share against that month's own salary.
 *
 * `lopDays` is how many of the leave's days carry no pay — the whole leave for an
 * unpaid one, or the figure the approver typed when approving a paid type with
 * LoP. It need not cover the leave: a 5-day leave can be approved with 3 LoP days.
 *
 * **Partial LoP is counted back from the last day of the leave.** A leave from
 * 29 January to 2 February with 3 LoP days puts them on 2 Feb, 1 Feb and 31 Jan
 * — so February is charged 2 days and January 1, and the first two days of the
 * leave stay paid. Half days are allowed: 2.5 LoP days charge the last two days
 * in full and the third at a half.
 *
 * A leave straddling a month boundary is therefore split at that boundary. Only
 * the outer ends of the leave get the Sunday trim — a month boundary is not an
 * end of the leave, so a Sunday sitting on it is sandwiched and charged like any
 * other day.
 */
export function lopDaysInMonth(
  from: Date,
  to: Date,
  lopDays: number,
  year: number,
  month: number,
): number {
  const span = chargedSpan(from, to);
  if (!span || lopDays <= 0) return 0;

  const monthStart = Date.UTC(year, month - 1, 1);
  const monthEnd   = Date.UTC(year, month, 0);

  let remaining = lopDays;
  let charged = 0;
  for (let day = span.end; day >= span.start && remaining > 0; day -= MS_PER_DAY) {
    const dayCharge = Math.min(1, remaining);
    if (day >= monthStart && day <= monthEnd) charged += dayCharge;
    remaining -= dayCharge;
  }
  return charged;
}

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
