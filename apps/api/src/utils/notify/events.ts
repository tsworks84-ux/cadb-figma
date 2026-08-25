/**
 * Every event the outbox can carry, and the Super-Admin toggle that gates it.
 *
 * `GLOBAL` is reserved: it is not an event anything emits, it is the master
 * switch checked alongside each real event. Both must be on for a channel to
 * produce a row.
 */

export const NOTIFY_EVENTS = [
  "LEAVE_APPLIED",
  "LEAVE_CANCEL_REQUESTED",
  "LEAVE_APPROVED",
  "LEAVE_REJECTED",
  "CLAIM_SUBMITTED",
  "CLAIM_CANCEL_REQUESTED",
  "CLAIM_APPROVED",
  "CLAIM_REJECTED",
  "CLAIM_PAID",
] as const;

export type NotifyEvent = (typeof NOTIFY_EVENTS)[number];

export const GLOBAL_SETTING_KEY = "GLOBAL";

/** Labels for the Administration grid, so the API and UI can't drift apart. */
export const EVENT_META: Record<NotifyEvent, { group: "Leaves" | "Claims"; label: string; audience: string }> = {
  LEAVE_APPLIED:          { group: "Leaves", label: "Leave applied",              audience: "Supervisor, department head, HR" },
  LEAVE_CANCEL_REQUESTED: { group: "Leaves", label: "Leave cancellation request", audience: "Supervisor, department head, HR" },
  LEAVE_APPROVED:         { group: "Leaves", label: "Leave approved",             audience: "The employee" },
  LEAVE_REJECTED:         { group: "Leaves", label: "Leave rejected",             audience: "The employee" },
  CLAIM_SUBMITTED:        { group: "Claims", label: "Claim submitted",            audience: "Supervisor, department head, HR" },
  CLAIM_CANCEL_REQUESTED: { group: "Claims", label: "Claim cancellation request", audience: "Supervisor, department head, HR" },
  CLAIM_APPROVED:         { group: "Claims", label: "Claim approved",             audience: "The employee" },
  CLAIM_REJECTED:         { group: "Claims", label: "Claim rejected",             audience: "The employee" },
  CLAIM_PAID:             { group: "Claims", label: "Claim paid out",             audience: "The employee" },
};

/** Events whose notice goes back to the person who raised the request. */
export const GOES_TO_APPLICANT: ReadonlySet<NotifyEvent> = new Set<NotifyEvent>([
  "LEAVE_APPROVED",
  "LEAVE_REJECTED",
  "CLAIM_APPROVED",
  "CLAIM_REJECTED",
  "CLAIM_PAID",
]);
