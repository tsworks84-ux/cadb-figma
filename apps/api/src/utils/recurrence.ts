/**
 * Expansion of a recurrence rule into concrete lecture dates.
 *
 * All arithmetic is done on UTC midnights. Schedule.date is a `@db.Date`
 * column, so only the calendar day matters — working in UTC keeps a
 * DST transition from shifting a lecture onto the previous day.
 */

// NOTE: the frequency-based rule below is NOT currently reached by any route.
// The scheduling form was changed to the weekday-grid format (see
// expandWeekdayPlan at the foot of this file), which covers daily, weekly and
// arbitrary weekday mixes but not fortnightly or monthly. This is kept, with its
// tests, so those two can be restored by wiring a branch rather than rewriting
// the maths.

export type Frequency = "DAILY" | "WEEKLY" | "FORTNIGHTLY" | "MONTHLY" | "CUSTOM";

export interface RecurrenceRule {
  frequency: Frequency;
  /** 0 = Sunday … 6 = Saturday. Used by WEEKLY, FORTNIGHTLY and CUSTOM. */
  weekdays?: number[];
  /** Inclusive last date the series may reach, as YYYY-MM-DD. */
  until: string;
}

/** Hard ceiling so a typo in `until` can't create thousands of rows. */
export const MAX_OCCURRENCES = 200;

const DAY_MS = 86_400_000;

/** Parse YYYY-MM-DD into a UTC midnight, rejecting anything malformed. */
function parseDay(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) throw new Error(`Invalid date: ${s}`);
  const [, y, mo, d] = m;
  const dt = new Date(Date.UTC(+y, +mo - 1, +d));
  // Rejects 31 Feb and friends, which Date.UTC would silently roll over.
  if (dt.getUTCFullYear() !== +y || dt.getUTCMonth() !== +mo - 1 || dt.getUTCDate() !== +d) {
    throw new Error(`Invalid date: ${s}`);
  }
  return dt;
}

export function toDayString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Monday-anchored start of the week containing `d`. Academy weeks run Mon–Sat. */
function startOfWeek(d: Date): Date {
  const dow = d.getUTCDay();            // 0 = Sun
  const backToMonday = (dow + 6) % 7;   // Sun -> 6, Mon -> 0
  return new Date(d.getTime() - backToMonday * DAY_MS);
}

/**
 * Expand a rule into the dates it covers, always including `start` itself.
 * Returns ascending, de-duplicated YYYY-MM-DD strings.
 */
export function expandRecurrence(start: string, rule: RecurrenceRule): string[] {
  const startD = parseDay(start);
  const untilD = parseDay(rule.until);
  if (untilD < startD) throw new Error("Repeat-until date must be on or after the schedule date");

  const out: string[] = [];
  const push = (d: Date) => {
    if (d >= startD && d <= untilD && out.length < MAX_OCCURRENCES) out.push(toDayString(d));
  };

  switch (rule.frequency) {
    case "DAILY": {
      for (let t = startD.getTime(); t <= untilD.getTime(); t += DAY_MS) {
        push(new Date(t));
        if (out.length >= MAX_OCCURRENCES) break;
      }
      break;
    }

    case "WEEKLY":
    case "FORTNIGHTLY":
    case "CUSTOM": {
      const stepWeeks = rule.frequency === "FORTNIGHTLY" ? 2 : 1;
      // No explicit weekdays means "same weekday as the start date".
      const days = rule.weekdays?.length ? [...new Set(rule.weekdays)].sort((a, b) => a - b) : [startD.getUTCDay()];
      let weekStart = startOfWeek(startD);
      while (weekStart.getTime() <= untilD.getTime() && out.length < MAX_OCCURRENCES) {
        for (const dow of days) {
          const offset = (dow + 6) % 7; // Monday-anchored position within the week
          push(new Date(weekStart.getTime() + offset * DAY_MS));
        }
        weekStart = new Date(weekStart.getTime() + stepWeeks * 7 * DAY_MS);
      }
      break;
    }

    case "MONTHLY": {
      // Same day-of-month each month. Months without that day (e.g. the 31st
      // in April) are skipped rather than clamped, so no lecture silently
      // lands on a date the user never chose.
      const dom = startD.getUTCDate();
      let y = startD.getUTCFullYear();
      let mo = startD.getUTCMonth();
      while (out.length < MAX_OCCURRENCES) {
        const cand = new Date(Date.UTC(y, mo, dom));
        if (cand.getTime() > untilD.getTime()) break;
        if (cand.getUTCMonth() === mo) push(cand); // false when the month is too short
        mo += 1;
        if (mo > 11) { mo = 0; y += 1; }
      }
      break;
    }
  }

  return [...new Set(out)].sort();
}

// ─── Weekday plan ─────────────────────────────────────────────────────────────
// What the "Add Multiple Schedules" form produces: a date range plus the chosen
// weekdays, each carrying its own start and end time (Mon 09:00 and Wed 14:00
// in a single submission).

export interface DaySpec {
  /** 0 = Sunday … 6 = Saturday. */
  weekday: number;
  /** Wall-clock "HH:MM". */
  startTime: string;
  endTime: string;
}

export interface Occurrence {
  date: string;      // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string;   // HH:MM
}

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Every occurrence of the selected weekdays between two dates, inclusive.
 * Ascending by date. Each occurrence carries the times of its own weekday.
 */
export function expandWeekdayPlan(startDate: string, endDate: string, days: DaySpec[]): Occurrence[] {
  const startD = parseDay(startDate);
  const endD   = parseDay(endDate);
  if (endD < startD) throw new Error("End date must be on or after the start date");
  if (!days.length) throw new Error("Select at least one day");

  const byWeekday = new Map<number, DaySpec>();
  for (const d of days) {
    if (d.weekday < 0 || d.weekday > 6) throw new Error(`Invalid weekday: ${d.weekday}`);
    if (!HHMM.test(d.startTime) || !HHMM.test(d.endTime)) {
      throw new Error("Times must be in HH:MM form");
    }
    if (d.endTime <= d.startTime) {
      throw new Error(`End time must be after start time on ${WEEKDAY_NAMES[d.weekday]}`);
    }
    byWeekday.set(d.weekday, d); // last one wins, so a duplicated day can't double-book
  }

  const out: Occurrence[] = [];
  for (let t = startD.getTime(); t <= endD.getTime() && out.length < MAX_OCCURRENCES; t += DAY_MS) {
    const day = new Date(t);
    const spec = byWeekday.get(day.getUTCDay());
    if (spec) out.push({ date: toDayString(day), startTime: spec.startTime, endTime: spec.endTime });
  }
  return out;
}

export const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
