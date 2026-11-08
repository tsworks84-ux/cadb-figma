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
  /** The same destination as `link`, app-relative — what the bell navigates to. */
  path?: string;

  // Leave events
  leaveType?: string;
  fromDate?: string;
  toDate?: string;
  dateRange?: string;
  totalDays?: string;
  lopDays?: string;

  // Comp-off events
  workDate?: string;
  weekday?: string;
  compOffDays?: string;
  dayContext?: string;   // "Sunday — weekly off" / "Republic Day (holiday)" / "Tuesday"

  // Announcement events
  announcementTitle?: string;
  announcementBody?: string;
  announcementType?: string;   // GENERAL | IMPORTANT | URGENT

  // Claim events
  claimNumber?: string;
  claimType?: string;
  title?: string;
  claimedAmount?: string;
  approvedAmount?: string;

  // Exam events
  examName?: string;
  examDate?: string;
  examTime?: string;
  stageName?: string;
  subjectLabel?: string;
  plannedDate?: string;
  daysOverdue?: string;
  ownerName?: string;
  taskCount?: string;
  decision?: string;        // "approved" | "sent back" | "reopened"
  taskSummary?: string;     // newline-separated "Stage — due date" lines
  syllabus?: string;        // newline-separated "Subject: topics" lines
  studentName?: string;
  scoreLine?: string;       // "212 / 300"
  scoreDetail?: string;     // newline-separated "Subject: marks / max" lines
  /** Footer sign-off; student emails don't use the HR one. */
  signOff?: string;

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

/** Multi-line user text as escaped HTML lines. */
function lines(value: string | undefined): string {
  return esc(value).replace(/\n/g, "<br>");
}

function shell(heading: string, lead: string, rows: string, cta: string, link: string, signOff = "Centum Academy HR System"): string {
  return `
    <div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:560px;margin:0 auto;padding:24px">
      <h2 style="color:${BRAND};margin:0 0 16px;font-size:18px">${heading}</h2>
      <p style="color:#374151;font-size:14px;margin:0 0 12px">${lead}</p>
      <table style="border-collapse:collapse;margin:16px 0">${rows}</table>
      <a href="${link}" style="display:inline-block;background:${BRAND};color:#fff;padding:10px 22px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px">${cta}</a>
      <p style="color:#9ca3af;font-size:12px;margin-top:28px">— ${esc(signOff)}</p>
    </div>`;
}

// ─── EMAIL ───────────────────────────────────────────────────────────────────

/**
 * Returns null for events this channel does not carry — announcements reach
 * everyone through the bell and the Notice Board, and mailing all staff every
 * time one is posted would be a new kind of spam, not a feature.
 */
export function renderEmail(event: NotifyEvent, p: NotifyPayload): { subject: string; html: string } | null {
  const who = `${esc(p.applicantName)} (${esc(p.applicantCode)}, ${esc(p.department)})`;

  const leaveRows =
    row("Leave Type", p.leaveType) +
    row("From", p.fromDate) +
    row("To", p.toDate) +
    row("Days", p.totalDays) +
    row("Reason", p.reason);

  const compOffRows =
    row("Date Worked", p.workDate) +
    row("Day", p.dayContext) +
    row("Days Claimed", p.compOffDays) +
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

    case "COMP_OFF_REQUESTED":
      return {
        subject: `Comp-off Request: ${p.applicantName} (${p.workDate})`,
        html: shell(
          "Comp-off request awaiting your decision",
          `Dear ${esc(p.recipientName)}, ${who} has claimed a compensatory off for a day worked outside their normal week. Approving it credits the day to their comp-off balance.`,
          compOffRows,
          "Review request →",
          p.link,
        ),
      };

    case "COMP_OFF_APPROVED":
      return {
        subject: `Comp-off Approved: ${p.workDate}`,
        html: shell(
          "Your comp-off has been approved",
          `Dear ${esc(p.recipientName)}, ${esc(p.approverName)} approved your comp-off. The days are now in your Comp-off leave balance and can be applied for like any other leave.`,
          compOffRows + row("Days Credited", p.compOffDays),
          "View balance →",
          p.link,
        ),
      };

    case "COMP_OFF_REJECTED":
      return {
        subject: `Comp-off Rejected: ${p.workDate}`,
        html: shell(
          "Your comp-off request was not approved",
          `Dear ${esc(p.recipientName)}, ${esc(p.approverName)} rejected your comp-off request.`,
          compOffRows + row("Note", p.decisionNote),
          "View request →",
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

    case "EXAM_TASKS_ASSIGNED":
      return {
        subject: `Exam tasks assigned: ${p.examName} (${p.examDate})`,
        html: shell(
          "You have exam tasks",
          `Dear ${esc(p.recipientName)}, you own ${esc(p.taskCount)} task(s) for <b>${esc(p.examName)}</b>, held on ${esc(p.examDate)}.`,
          `<tr><td style="padding:6px 0;font-size:13px;color:#111827">${lines(p.taskSummary)}</td></tr>`,
          "Open my exam tasks →",
          p.link,
          "Examinations Team",
        ),
      };

    case "EXAM_STAGE_DUE_SOON":
      return {
        subject: `Due ${p.plannedDate}: ${p.stageName} — ${p.examName}`,
        html: shell(
          "Exam task due soon",
          `Dear ${esc(p.recipientName)}, this task is due in the next two days.`,
          row("Exam", p.examName) + row("Exam date", p.examDate) + row("Task", p.stageName) +
            optionalRow("Subject", p.subjectLabel) + row("Due", p.plannedDate),
          "Open my exam tasks →",
          p.link,
          "Examinations Team",
        ),
      };

    case "EXAM_STAGE_OVERDUE":
      return {
        subject: `Overdue: ${p.stageName} — ${p.examName}`,
        html: shell(
          "Exam task overdue",
          `Dear ${esc(p.recipientName)}, the task below has passed its due date and is not done.`,
          row("Exam", p.examName) + row("Exam date", p.examDate) + row("Task", p.stageName) +
            optionalRow("Subject", p.subjectLabel) + row("Owner", p.ownerName) +
            row("Was due", p.plannedDate) + row("Days overdue", p.daysOverdue),
          "Open exam tracker →",
          p.link,
          "Examinations Team",
        ),
      };

    case "EXAM_APPROVAL_REQUESTED":
      return {
        subject: `Approval needed: ${p.stageName}${p.subjectLabel ? ` (${p.subjectLabel})` : ""} — ${p.examName}`,
        html: shell(
          "Waiting for your approval",
          `Dear ${esc(p.recipientName)}, ${esc(p.ownerName)} has submitted the work below for your approval. Approving it closes the stage; you can also send it back with a comment.`,
          row("Exam", p.examName) + row("Exam date", p.examDate) + row("Stage", p.stageName) +
            optionalRow("Subject", p.subjectLabel) + row("Submitted by", p.ownerName) + row("Due", p.plannedDate),
          "Review it →",
          p.link,
          "Examinations Team",
        ),
      };

    case "EXAM_APPROVAL_DECIDED":
      return {
        subject: `${p.decision === "approved" ? "Approved" : p.decision === "sent back" ? "Sent back" : "Reopened"}: ${p.stageName}${p.subjectLabel ? ` (${p.subjectLabel})` : ""} — ${p.examName}`,
        html: shell(
          p.decision === "approved" ? "Your submission was approved" : p.decision === "sent back" ? "Your submission needs changes" : "Your stage was reopened",
          p.decision === "approved"
            ? `Dear ${esc(p.recipientName)}, ${esc(p.approverName)} approved your work below. The stage is done.`
            : p.decision === "sent back"
              ? `Dear ${esc(p.recipientName)}, ${esc(p.approverName)} sent your work back. Make the changes and submit it again.`
              : `Dear ${esc(p.recipientName)}, the stage below was reopened and needs to be submitted again.`,
          row("Exam", p.examName) + row("Stage", p.stageName) + optionalRow("Subject", p.subjectLabel) +
            optionalRow("Comment", p.decisionNote) + row("Due", p.plannedDate),
          "Open my exam tasks →",
          p.link,
          "Examinations Team",
        ),
      };

    case "EXAM_SCHEDULED":
      return {
        subject: `Exam notice: ${p.examName} on ${p.examDate}`,
        html: shell(
          `${esc(p.examName)} — exam notice`,
          `Dear Parent / ${esc(p.studentName)}, the exam below has been scheduled.`,
          row("Exam", p.examName) + row("Date", p.examDate) + row("Time", p.examTime) +
            `<tr><td style="padding:6px 16px 6px 0;color:#6b7280;font-size:13px;vertical-align:top">Syllabus</td><td style="padding:6px 0;font-size:13px;color:#111827">${lines(p.syllabus)}</td></tr>`,
          "Open student portal →",
          p.link,
          p.signOff ?? "Examinations Team",
        ),
      };

    case "EXAM_RESULTS_RELEASED":
      return {
        subject: `Result: ${p.examName} — ${p.studentName}`,
        html: shell(
          `${esc(p.examName)} — result`,
          `Dear Parent / ${esc(p.studentName)}, the result for this exam has been published.`,
          row("Student", p.studentName) + row("Exam", p.examName) + row("Exam date", p.examDate) +
            row("Score", p.scoreLine) +
            (p.scoreDetail ? `<tr><td style="padding:6px 16px 6px 0;color:#6b7280;font-size:13px;vertical-align:top">By subject</td><td style="padding:6px 0;font-size:13px;color:#111827">${lines(p.scoreDetail)}</td></tr>` : ""),
          "See full analysis →",
          p.link,
          p.signOff ?? "Examinations Team",
        ),
      };

    case "ANNOUNCEMENT_POSTED":
      return null;
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
 *   comp_off_request_alert    {{1}} recipient  {{2}} applicant  {{3}} date worked
 *                             {{4}} day        {{5}} days       {{6}} reason
 *   comp_off_approved         {{1}} recipient  {{2}} date worked {{3}} days credited
 *                             {{4}} approver
 *   comp_off_rejected         {{1}} recipient  {{2}} date worked {{3}} days
 *                             {{4}} approver   {{5}} note
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
const TEMPLATE_ENV: Partial<Record<NotifyEvent, { env: string; fallback: string }>> = {
  LEAVE_APPLIED:          { env: "WHATSAPP_TEMPLATE_LEAVE_APPLIED",  fallback: "leave_request_alert" },
  LEAVE_CANCEL_REQUESTED: { env: "WHATSAPP_TEMPLATE_LEAVE_CANCEL",   fallback: "leave_cancel_alert" },
  LEAVE_APPROVED:         { env: "WHATSAPP_TEMPLATE_LEAVE_APPROVED", fallback: "leave_decision_approved" },
  LEAVE_REJECTED:         { env: "WHATSAPP_TEMPLATE_LEAVE_REJECTED", fallback: "leave_decision_rejected" },
  COMP_OFF_REQUESTED:     { env: "WHATSAPP_TEMPLATE_COMP_OFF_REQUESTED", fallback: "comp_off_request_alert" },
  COMP_OFF_APPROVED:      { env: "WHATSAPP_TEMPLATE_COMP_OFF_APPROVED",  fallback: "comp_off_approved" },
  COMP_OFF_REJECTED:      { env: "WHATSAPP_TEMPLATE_COMP_OFF_REJECTED",  fallback: "comp_off_rejected" },
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

/** Null for events with no registered template — see `renderEmail`. */
export function whatsappTemplate(event: NotifyEvent, p: NotifyPayload): { name: string; params: string[] } | null {
  const entry = TEMPLATE_ENV[event];
  if (!entry) return null;
  const name = process.env[entry.env] ?? entry.fallback;
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
    case "COMP_OFF_REQUESTED":
      return build(p.recipientName, p.applicantName, p.workDate, p.dayContext, p.compOffDays, p.reason);
    case "COMP_OFF_APPROVED":
      return build(p.recipientName, p.workDate, p.compOffDays, p.approverName);
    case "COMP_OFF_REJECTED":
      return build(p.recipientName, p.workDate, p.compOffDays, p.approverName, p.decisionNote);
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
    case "EXAM_TASKS_ASSIGNED":
    case "EXAM_STAGE_DUE_SOON":
    case "EXAM_STAGE_OVERDUE":
    case "EXAM_APPROVAL_REQUESTED":
    case "EXAM_APPROVAL_DECIDED":
    case "EXAM_SCHEDULED":
    case "EXAM_RESULTS_RELEASED":
    case "ANNOUNCEMENT_POSTED":
      return null;
  }
}

// ─── IN-APP (THE BELL) ───────────────────────────────────────────────────────

/**
 * A feed entry, not a letter. The title has to survive being truncated to one
 * line in a 20rem dropdown, so it leads with what happened and who to — no
 * greeting, no sign-off, and the detail lives behind the link.
 */
export function renderInApp(event: NotifyEvent, p: NotifyPayload): { title: string; body: string } {
  const who = `${p.applicantName} (${p.applicantCode})`;
  const dates = p.dateRange ?? `${p.fromDate} – ${p.toDate}`;
  const days = (n: string | undefined) => `${n ?? "?"} day${n === "1" ? "" : "s"}`;

  switch (event) {
    case "LEAVE_APPLIED":
      return { title: `${who} applied for leave`, body: `${p.leaveType} · ${dates} · ${days(p.totalDays)}` };
    case "LEAVE_CANCEL_REQUESTED":
      return { title: `${who} wants to cancel a leave`, body: `${p.leaveType} · ${dates} · ${p.cancelReason ?? ""}`.trim() };
    case "LEAVE_APPROVED":
      return { title: "Your leave was approved", body: `${p.leaveType} · ${dates} · approved by ${p.approverName}` };
    case "LEAVE_REJECTED":
      return { title: "Your leave was rejected", body: `${p.leaveType} · ${dates}${p.decisionNote ? ` · ${p.decisionNote}` : ""}` };

    case "COMP_OFF_REQUESTED":
      return { title: `${who} claimed a comp-off`, body: `${p.workDate} · ${p.dayContext} · ${days(p.compOffDays)}` };
    case "COMP_OFF_APPROVED":
      return { title: "Your comp-off was approved", body: `${days(p.compOffDays)} credited for ${p.workDate}` };
    case "COMP_OFF_REJECTED":
      return { title: "Your comp-off was rejected", body: `${p.workDate}${p.decisionNote ? ` · ${p.decisionNote}` : ""}` };

    case "CLAIM_SUBMITTED":
      return { title: `${who} submitted a claim`, body: `${p.claimNumber} · ${p.claimType} · ${p.claimedAmount}` };
    case "CLAIM_CANCEL_REQUESTED":
      return { title: `${who} wants to cancel a claim`, body: `${p.claimNumber} · ${p.claimedAmount} · ${p.cancelReason ?? ""}`.trim() };
    case "CLAIM_APPROVED":
      return { title: "Your claim was approved", body: `${p.claimNumber} · ${p.approvedAmount ?? p.claimedAmount} · approved by ${p.approverName}` };
    case "CLAIM_REJECTED":
      return { title: "Your claim was rejected", body: `${p.claimNumber} · ${p.claimedAmount}${p.decisionNote ? ` · ${p.decisionNote}` : ""}` };
    case "CLAIM_PAID":
      return { title: "Your claim has been paid", body: `${p.claimNumber} · ${p.approvedAmount ?? p.claimedAmount}` };

    case "EXAM_TASKS_ASSIGNED":
      return { title: `${p.taskCount} exam task(s) assigned to you`, body: `${p.examName} · ${p.examDate}` };
    case "EXAM_STAGE_DUE_SOON":
      return { title: `Due ${p.plannedDate}: ${p.stageName}`, body: `${p.examName}${p.subjectLabel ? ` · ${p.subjectLabel}` : ""}` };
    case "EXAM_STAGE_OVERDUE":
      return { title: `Overdue: ${p.stageName}`, body: `${p.examName}${p.subjectLabel ? ` · ${p.subjectLabel}` : ""} · ${p.ownerName} · ${p.daysOverdue} day(s) late` };
    case "EXAM_APPROVAL_REQUESTED":
      return { title: `Approve: ${p.stageName}${p.subjectLabel ? ` · ${p.subjectLabel}` : ""}`, body: `${p.examName} · from ${p.ownerName}` };
    case "EXAM_APPROVAL_DECIDED":
      return {
        title: `${p.decision === "approved" ? "Approved" : p.decision === "sent back" ? "Sent back" : "Reopened"}: ${p.stageName}${p.subjectLabel ? ` · ${p.subjectLabel}` : ""}`,
        body: `${p.examName}${p.decisionNote ? ` · ${p.decisionNote}` : ""}`,
      };
    case "EXAM_SCHEDULED":
    case "EXAM_RESULTS_RELEASED":
      return { title: p.examName ?? "Exam", body: "" };

    case "ANNOUNCEMENT_POSTED":
      return { title: p.announcementTitle ?? "New announcement", body: p.announcementBody ?? "" };
  }
}
