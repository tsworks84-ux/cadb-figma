/**
 * Expansion of a recurrence rule into concrete lecture dates.
 *
 * All arithmetic is done on UTC midnights. Schedule.date is a `@db.Date`
 * column, so only the calendar day matters — working in UTC keeps a
 * DST transition from shifting a lecture onto the previous day.
 */

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
