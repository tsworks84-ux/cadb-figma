import type { NotifyEvent } from "./events.js";

/**
 * One place where every notification's wording lives, for both channels.
 *
 * The payload is deliberately flat, pre-formatted strings only: it is frozen
 * into the Notification row at enqueue time and rendered minutes later by the
 * dispatcher, so it must not depend on anything that could have changed since —
 * no ids to re-look-up, no Dates to re-format. It is also stored in a JSON
 * column, so the event-specific fields are optional rather than a union: the
 * type could not be enforced at rest either way, and the renderers below are
 * the only readers.
 */
export type NotifyPayload = {
  recipientName: string;
  applicantName: string;
  applicantCode: string;
  department: string;
  link: string;

  // Leave events
  leaveType?: string;
  fromDate?: string;
  toDate?: string;
  dateRange?: string;
  totalDays?: string;
  lopDays?: string;

  // Claim events
  claimNumber?: string;
  claimType?: string;
  title?: string;
  claimedAmount?: string;
  approvedAmount?: string;

  // Shared
  reason?: string;
  cancelReason?: string;
  decisionNote?: string;
  approverName?: string;
};

const BRAND = "#2C3E7C";

/** Escapes anything interpolated into the HTML body — reasons are user text. */
function esc(value: string | undefined): string {
  return (value ?? "—").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

function row(label: string, value: string | undefined): string {
  return `<tr><td style="padding:6px 16px 6px 0;color:#6b7280;font-size:13px;white-space:nowrap">${label}</td><td style="padding:6px 0;font-size:13px;color:#111827">${esc(value)}</td></tr>`;
}

/** Same as `row`, but drops out entirely when there is nothing to show. */
function optionalRow(label: string, value: string | undefined): string {
  return value ? row(label, value) : "";
}

function shell(heading: string, lead: string, rows: string, cta: string, link: string): string {
  return `
    <div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:560px;margin:0 auto;padding:24px">
      <h2 style="color:${BRAND};margin:0 0 16px;font-size:18px">${heading}</h2>
      <p style="color:#374151;font-size:14px;margin:0 0 12px">${lead}</p>
      <table style="border-collapse:collapse;margin:16px 0">${rows}</table>
      <a href="${link}" style="display:inline-block;background:${BRAND};color:#fff;padding:10px 22px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px">${cta}</a>
      <p style="color:#9ca3af;font-size:12px;margin-top:28px">— Centum Academy HR System</p>
    </div>`;
}

// ─── EMAIL ───────────────────────────────────────────────────────────────────

export function renderEmail(event: NotifyEvent, p: NotifyPayload): { subject: string; html: string } {
  const who = `${esc(p.applicantName)} (${esc(p.applicantCode)}, ${esc(p.department)})`;

  const leaveRows =
    row("Leave Type", p.leaveType) +
    row("From", p.fromDate) +
    row("To", p.toDate) +
    row("Days", p.totalDays) +
    row("Reason", p.reason);

  const claimRows =
    row("Claim No.", p.claimNumber) +
    row("Type", p.claimType) +
    row("For", p.title) +
    row("Amount Claimed", p.claimedAmount) +
    optionalRow("Amount Approved", p.approvedAmount);

  switch (event) {
    case "LEAVE_APPLIED":
      return {
        subject: `Leave Request: ${p.applicantName} (${p.leaveType})`,
        html: shell(
          "Leave request awaiting your decision",
          `Dear ${esc(p.recipientName)}, ${who} has applied for leave.`,
          leaveRows,
          "Review request →",
          p.link,
        ),
      };

    case "LEAVE_CANCEL_REQUESTED":
      return {
        subject: `Leave Cancellation Request: ${p.applicantName} (${p.leaveType})`,
        html: shell(
          "Cancellation request awaiting your decision",
          `Dear ${esc(p.recipientName)}, ${who} wants to withdraw a leave that was already approved.`,
          leaveRows + row("Cancellation Reason", p.cancelReason),
          "Review cancellation →",
          p.link,
        ),
      };

    case "LEAVE_APPROVED":
      return {
        subject: `Leave Approved: ${p.leaveType}, ${p.dateRange}`,
        html: shell(
          "Your leave has been approved",
          `Dear ${esc(p.recipientName)}, ${esc(p.approverName)} approved your leave request.`,
          leaveRows + (p.lopDays && p.lopDays !== "0" ? row("Loss of Pay", `${p.lopDays} day(s)`) : ""),
          "View leave →",
          p.link,
        ),
      };

    case "LEAVE_REJECTED":
      return {
        subject: `Leave Rejected: ${p.leaveType}, ${p.dateRange}`,
        html: shell(
          "Your leave request was not approved",
          `Dear ${esc(p.recipientName)}, ${esc(p.approverName)} rejected your leave request.`,
          leaveRows + row("Note", p.decisionNote),
          "View leave →",
          p.link,
        ),
      };

    case "CLAIM_SUBMITTED":
      return {
        subject: `Reimbursement Claim: ${p.applicantName} (${p.claimNumber})`,
        html: shell(
          "Claim awaiting your decision",
          `Dear ${esc(p.recipientName)}, ${who} has submitted a reimbursement claim.`,
          claimRows,
          "Review claim →",
          p.link,
        ),
      };

    case "CLAIM_CANCEL_REQUESTED":
      return {
        subject: `Claim Cancellation Request: ${p.applicantName} (${p.claimNumber})`,
        html: shell(
          "Cancellation request awaiting your decision",
          `Dear ${esc(p.recipientName)}, ${who} wants to withdraw a claim that was already approved.`,
          claimRows + row("Cancellation Reason", p.cancelReason),
          "Review cancellation →",
          p.link,
        ),
      };

    case "CLAIM_APPROVED":
      return {
        subject: `Claim Approved: ${p.claimNumber}`,
        html: shell(
          "Your claim has been approved",
          `Dear ${esc(p.recipientName)}, ${esc(p.approverName)} approved your reimbursement claim.`,
          claimRows + optionalRow("Note", p.decisionNote),
          "View claim →",
          p.link,
        ),
      };

    case "CLAIM_REJECTED":
      return {
        subject: `Claim Rejected: ${p.claimNumber}`,
        html: shell(
          "Your claim was not approved",
          `Dear ${esc(p.recipientName)}, ${esc(p.approverName)} rejected your reimbursement claim.`,
          claimRows + row("Note", p.decisionNote),
          "View claim →",
          p.link,
        ),
      };

    case "CLAIM_PAID":
      return {
        subject: `Claim Paid: ${p.claimNumber}`,
        html: shell(
          "Your claim has been paid out",
          `Dear ${esc(p.recipientName)}, your reimbursement has been released.`,
          claimRows,
          "View claim →",
          p.link,
        ),
      };
  }
}

// ─── WHATSAPP ────────────────────────────────────────────────────────────────

/**
 * Meta requires business-initiated messages to use a template registered and
 * approved in the WhatsApp Manager, referenced by name, with positional body
 * parameters. Changing the wording means re-registering, so the *names* are
 * env-driven and only the parameter ORDER is fixed here.
 *
 * Register each template's body with these placeholders, in this order:
 *
 *   leave_request_alert       {{1}} recipient  {{2}} applicant  {{3}} type
 *                             {{4}} dates      {{5}} days       {{6}} reason
 *   leave_cancel_alert        {{1}} recipient  {{2}} applicant  {{3}} type
 *                             {{4}} dates      {{5}} days       {{6}} cancellation reason
 *   leave_decision_approved   {{1}} recipient  {{2}} type       {{3}} dates
 *                             {{4}} days       {{5}} approver
 *   leave_decision_rejected   {{1}} recipient  {{2}} type       {{3}} dates
 *                             {{4}} days       {{5}} approver   {{6}} note
 *   claim_request_alert       {{1}} recipient  {{2}} applicant  {{3}} claim no.
 *                             {{4}} type       {{5}} amount     {{6}} for
 *   claim_cancel_alert        {{1}} recipient  {{2}} applicant  {{3}} claim no.
 *                             {{4}} amount     {{5}} cancellation reason
 *   claim_decision_approved   {{1}} recipient  {{2}} claim no.  {{3}} approved amount
 *                             {{4}} approver
 *   claim_decision_rejected   {{1}} recipient  {{2}} claim no.  {{3}} amount
 *                             {{4}} approver   {{5}} note
 *   claim_paid                {{1}} recipient  {{2}} claim no.  {{3}} approved amount
 *
 * Category must be **Utility** — these are transactional notices, not marketing.
 * The dashboard link belongs in a URL button on the template, not in the body:
 * a button survives wording changes without re-approval.
 */
const TEMPLATE_ENV: Record<NotifyEvent, { env: string; fallback: string }> = {
  LEAVE_APPLIED:          { env: "WHATSAPP_TEMPLATE_LEAVE_APPLIED",  fallback: "leave_request_alert" },
  LEAVE_CANCEL_REQUESTED: { env: "WHATSAPP_TEMPLATE_LEAVE_CANCEL",   fallback: "leave_cancel_alert" },
  LEAVE_APPROVED:         { env: "WHATSAPP_TEMPLATE_LEAVE_APPROVED", fallback: "leave_decision_approved" },
  LEAVE_REJECTED:         { env: "WHATSAPP_TEMPLATE_LEAVE_REJECTED", fallback: "leave_decision_rejected" },
  CLAIM_SUBMITTED:        { env: "WHATSAPP_TEMPLATE_CLAIM_SUBMITTED", fallback: "claim_request_alert" },
  CLAIM_CANCEL_REQUESTED: { env: "WHATSAPP_TEMPLATE_CLAIM_CANCEL",    fallback: "claim_cancel_alert" },
  CLAIM_APPROVED:         { env: "WHATSAPP_TEMPLATE_CLAIM_APPROVED",  fallback: "claim_decision_approved" },
  CLAIM_REJECTED:         { env: "WHATSAPP_TEMPLATE_CLAIM_REJECTED",  fallback: "claim_decision_rejected" },
  CLAIM_PAID:             { env: "WHATSAPP_TEMPLATE_CLAIM_PAID",      fallback: "claim_paid" },
};

/**
 * Meta rejects body parameters containing newlines, tabs or runs of 4+ spaces,
 * and silently truncates very long ones. A free-text reason will hit all three,
 * so every parameter goes through here.
 */
function param(value: string | undefined, max = 200): string {
  const flat = (value ?? "—").replace(/\s+/g, " ").trim();
  if (!flat) return "—";
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

export function whatsappTemplate(event: NotifyEvent, p: NotifyPayload): { name: string; params: string[] } {
  const { env, fallback } = TEMPLATE_ENV[event];
  const name = process.env[env] ?? fallback;
  const build = (...values: Array<string | undefined>) => ({ name, params: values.map((v) => param(v)) });

  switch (event) {
    case "LEAVE_APPLIED":
      return build(p.recipientName, p.applicantName, p.leaveType, p.dateRange, p.totalDays, p.reason);
    case "LEAVE_CANCEL_REQUESTED":
      return build(p.recipientName, p.applicantName, p.leaveType, p.dateRange, p.totalDays, p.cancelReason);
    case "LEAVE_APPROVED":
      return build(p.recipientName, p.leaveType, p.dateRange, p.totalDays, p.approverName);
    case "LEAVE_REJECTED":
      return build(p.recipientName, p.leaveType, p.dateRange, p.totalDays, p.approverName, p.decisionNote);
    case "CLAIM_SUBMITTED":
      return build(p.recipientName, p.applicantName, p.claimNumber, p.claimType, p.claimedAmount, p.title);
    case "CLAIM_CANCEL_REQUESTED":
      return build(p.recipientName, p.applicantName, p.claimNumber, p.claimedAmount, p.cancelReason);
    case "CLAIM_APPROVED":
      return build(p.recipientName, p.claimNumber, p.approvedAmount ?? p.claimedAmount, p.approverName);
    case "CLAIM_REJECTED":
      return build(p.recipientName, p.claimNumber, p.claimedAmount, p.approverName, p.decisionNote);
    case "CLAIM_PAID":
      return build(p.recipientName, p.claimNumber, p.approvedAmount ?? p.claimedAmount);
  }
}
