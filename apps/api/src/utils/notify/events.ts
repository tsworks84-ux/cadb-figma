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
  "COMP_OFF_REQUESTED",
  "COMP_OFF_APPROVED",
  "COMP_OFF_REJECTED",
  "CLAIM_SUBMITTED",
  "CLAIM_CANCEL_REQUESTED",
  "CLAIM_APPROVED",
  "CLAIM_REJECTED",
  "CLAIM_PAID",
  "ANNOUNCEMENT_POSTED",
] as const;

export type NotifyEvent = (typeof NOTIFY_EVENTS)[number];

export const GLOBAL_SETTING_KEY = "GLOBAL";

/** Every channel an event can be delivered on. */
export const NOTIFY_CHANNELS = ["EMAIL", "WHATSAPP", "IN_APP"] as const;
export type NotifyChannel = (typeof NOTIFY_CHANNELS)[number];

const ALL_CHANNELS: readonly NotifyChannel[] = NOTIFY_CHANNELS;

type EventMeta = {
  group: "Leaves" | "Comp-off" | "Claims" | "Announcements";
  label: string;
  audience: string;
  /**
   * Which channels this event may ever use. The Administration grid renders a
   * dash instead of a checkbox for the rest, so nobody toggles a switch that
   * cannot do anything.
   */
  channels: readonly NotifyChannel[];
};

/** Labels for the Administration grid, so the API and UI can't drift apart. */
export const EVENT_META: Record<NotifyEvent, EventMeta> = {
  LEAVE_APPLIED:          { group: "Leaves", label: "Leave applied",              audience: "Reporting manager, HR, Super Admin", channels: ALL_CHANNELS },
  LEAVE_CANCEL_REQUESTED: { group: "Leaves", label: "Leave cancellation request", audience: "Reporting manager, HR, Super Admin", channels: ALL_CHANNELS },
  LEAVE_APPROVED:         { group: "Leaves", label: "Leave approved",             audience: "The employee",                    channels: ALL_CHANNELS },
  LEAVE_REJECTED:         { group: "Leaves", label: "Leave rejected",             audience: "The employee",                    channels: ALL_CHANNELS },
  COMP_OFF_REQUESTED:     { group: "Comp-off", label: "Comp-off claimed",  audience: "Reporting manager, HR, Super Admin", channels: ALL_CHANNELS },
  COMP_OFF_APPROVED:      { group: "Comp-off", label: "Comp-off approved", audience: "The employee",                    channels: ALL_CHANNELS },
  COMP_OFF_REJECTED:      { group: "Comp-off", label: "Comp-off rejected", audience: "The employee",                    channels: ALL_CHANNELS },
  CLAIM_SUBMITTED:        { group: "Claims", label: "Claim submitted",            audience: "Reporting manager, HR, Super Admin", channels: ALL_CHANNELS },
  CLAIM_CANCEL_REQUESTED: { group: "Claims", label: "Claim cancellation request", audience: "Reporting manager, HR, Super Admin", channels: ALL_CHANNELS },
  CLAIM_APPROVED:         { group: "Claims", label: "Claim approved",             audience: "The employee",                    channels: ALL_CHANNELS },
  CLAIM_REJECTED:         { group: "Claims", label: "Claim rejected",             audience: "The employee",                    channels: ALL_CHANNELS },
  CLAIM_PAID:             { group: "Claims", label: "Claim paid out",             audience: "The employee",                    channels: ALL_CHANNELS },
  // Bell only. A notice already reaches everyone on the Notice Board, so
  // mailing all staff on every announcement would be a new kind of spam.
  ANNOUNCEMENT_POSTED:    { group: "Announcements", label: "Announcement published", audience: "Everyone",                     channels: ["IN_APP"] },
};

/** Events whose notice goes back to the person who raised the request. */
export const GOES_TO_APPLICANT: ReadonlySet<NotifyEvent> = new Set<NotifyEvent>([
  "LEAVE_APPROVED",
  "LEAVE_REJECTED",
  "COMP_OFF_APPROVED",
  "COMP_OFF_REJECTED",
  "CLAIM_APPROVED",
  "CLAIM_REJECTED",
  "CLAIM_PAID",
]);
