"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, Hourglass, SkipForward, Undo2, Users } from "lucide-react";
import { api } from "@/lib/api";
import { Modal, Field, inputCls, btnPrimary, btnSecondary, btnDanger, apiError, personName, fmtDay, type Person } from "./shared";
import { Notice, useInvalidateExams } from "./StageDialogs";

/**
 * Syllabus sign-off: the chapters on the exam for one subject go to the
 * subject's teacher in every batch writing the exam. Each teacher approves or
 * sends them back; the step closes when every sign-off is in. The Controller
 * can bypass a teacher who can't respond.
 */

export type SignoffStatus = "PENDING" | "APPROVED" | "SENT_BACK" | "BYPASSED";
export type Signoff = {
  employee: Person;
  status: SignoffStatus;
  batchNames: string[];
  fallback: boolean;
  comment: string | null;
  decidedAt: string | null;
  /** Approved, but for chapters that have since changed: they'll be asked again. */
  stale: boolean;
};
export type SyllabusInfo = { chapters: string[]; changedSinceSent: boolean };

export type SignoffStage = {
  id: string;
  name: string;
  subjectLabel: string | null;
  status: string;
  owner: Person | null;
  syllabus?: SyllabusInfo | null;
  signoffs?: Signoff[] | null;
};

/** "3 of 5 signed" style counts. */
export function signoffCounts(list: Signoff[] | null | undefined) {
  const rows = list ?? [];
  const signed = rows.filter((r) => (r.status === "APPROVED" || r.status === "BYPASSED") && !r.stale).length;
  const waiting = rows.filter((r) => r.status === "PENDING").length;
  const sentBack = rows.filter((r) => r.status === "SENT_BACK").length;
  return { total: rows.length, signed, waiting, sentBack };
}

const STATUS: Record<SignoffStatus, [string, string]> = {
  PENDING: ["Waiting", "bg-amber-50 text-amber-800"],
  APPROVED: ["Approved", "bg-emerald-50 text-emerald-700"],
  SENT_BACK: ["Sent back", "bg-red-50 text-red-700"],
  BYPASSED: ["Bypassed", "bg-gray-100 text-gray-600"],
};

/** Who has to sign, and where each one stands. Collapsed to one line by default. */
export function SignoffList({ stage, canBypass, defaultOpen = false }: { stage: SignoffStage; canBypass: boolean; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [bypassFor, setBypassFor] = useState<Signoff | null>(null);
  const rows = stage.signoffs ?? [];
  if (rows.length === 0) return null;
  const c = signoffCounts(rows);
  const waitingOnStage = stage.status === "PENDING_APPROVAL";

  return (
    <div className="mt-1.5 rounded-lg border border-gray-100 bg-gray-50/60">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-xs">
        <Users className="h-3.5 w-3.5 text-gray-500 shrink-0" />
        <span className="flex-1 min-w-0 truncate text-gray-700">
          <b>{c.signed} of {c.total}</b> teachers signed
          {c.waiting ? ` · ${c.waiting} waiting` : ""}{c.sentBack ? ` · ${c.sentBack} sent back` : ""}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 text-gray-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul className="border-t border-gray-100 divide-y divide-gray-100">
          {rows.map((r) => {
            const [label, cls] = r.stale ? ["Needs to re-approve", "bg-amber-50 text-amber-800"] : STATUS[r.status];
            return (
              <li key={r.employee.id} className="px-2.5 py-2 flex flex-col sm:flex-row sm:items-center gap-1.5">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-800">
                    {personName(r.employee)}
                    {r.fallback && <span className="font-normal text-gray-400"> · standing in (no teacher assigned)</span>}
                  </p>
                  <p className="text-[11px] text-gray-500 break-words">{r.batchNames.join(", ")}{r.decidedAt ? ` · ${fmtDay(r.decidedAt)}` : ""}</p>
                  {r.comment && <p className={`text-[11px] mt-0.5 ${r.status === "SENT_BACK" ? "text-red-700" : "text-gray-500"}`}>“{r.comment}”</p>}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{label}</span>
                  {canBypass && waitingOnStage && r.status === "PENDING" && (
                    <button onClick={() => setBypassFor(r)}
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-50 active:bg-gray-100">
                      <SkipForward className="h-3 w-3" /> Bypass
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {bypassFor && <BypassSignoffDialog stage={stage} signoff={bypassFor} onClose={() => setBypassFor(null)} />}
    </div>
  );
}

function BypassSignoffDialog({ stage, signoff, onClose }: { stage: SignoffStage; signoff: Signoff; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const invalidate = useInvalidateExams();
  const submit = async () => {
    setSaving(true); setError(null);
    try {
      await api.post(`/api/v1/exams/stages/${stage.id}/signoffs/${signoff.employee.id}/bypass`, { reason });
      invalidate();
      onClose();
    } catch (e) { setError(apiError(e, "Could not bypass this sign-off")); } finally { setSaving(false); }
  };
  return (
    <Modal
      title="Bypass a teacher's sign-off"
      onClose={onClose}
      footer={<>
        <button className={btnSecondary} onClick={onClose}>Cancel</button>
        <button className={btnDanger} onClick={submit} disabled={saving || reason.trim().length < 5}>{saving ? "Saving…" : "Bypass"}</button>
      </>}
    >
      <p className="text-sm text-gray-700">
        <b>{personName(signoff.employee)}</b> ({signoff.batchNames.join(", ")}) won&apos;t need to sign the syllabus for
        {" "}{stage.subjectLabel ?? stage.name}. The reason is recorded in the step&apos;s history.
      </p>
      <Field label="Reason">
        <textarea className={`${inputCls} min-h-[80px]`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. On leave until after the exam; HoD has checked the chapters" />
      </Field>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </Modal>
  );
}

/** A teacher reads the chapters and approves or sends them back. */
export function SyllabusReviewDialog({ stage, batchNames, onClose, onDone }: {
  stage: SignoffStage; batchNames?: string[]; onClose: () => void; onDone: (message: string) => void;
}) {
  const invalidate = useInvalidateExams();
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState<null | "approve" | "back">(null);
  const [error, setError] = useState<string | null>(null);
  const chapters = stage.syllabus?.chapters ?? [];

  const run = async (kind: "approve" | "back") => {
    setBusy(kind); setError(null);
    try {
      const r = kind === "approve"
        ? await api.post(`/api/v1/exams/stages/${stage.id}/approve`, { comment: comment.trim() || undefined })
        : await api.post(`/api/v1/exams/stages/${stage.id}/send-back`, { comment });
      invalidate();
      onDone(r.data.message ?? (kind === "approve" ? "Approved." : "Sent back."));
    } catch (e) { setError(apiError(e)); } finally { setBusy(null); }
  };

  return (
    <Modal
      title="Review syllabus"
      onClose={onClose}
      footer={<>
        <button className={btnSecondary} onClick={onClose}>Close</button>
        <button className={btnDanger} disabled={!!busy || comment.trim().length < 5}
          title={comment.trim().length < 5 ? "Write what needs changing first" : undefined} onClick={() => run("back")}>
          <Undo2 className="h-4 w-4" /> {busy === "back" ? "Sending…" : "Send back"}
        </button>
        <button className={btnPrimary} disabled={!!busy} onClick={() => run("approve")}>
          <CheckCircle2 className="h-4 w-4" /> {busy === "approve" ? "Approving…" : "Approve"}
        </button>
      </>}
    >
      <div>
        <p className="text-sm font-semibold text-gray-900">{stage.subjectLabel ?? stage.name}</p>
        <p className="text-xs text-gray-500">
          Sent by {personName(stage.owner)}{batchNames?.length ? ` · you're signing for ${batchNames.join(", ")}` : ""}
        </p>
      </div>
      <p className="text-xs text-gray-600">
        These chapters will be examined. Approve if they match what your batch has been taught by the exam date;
        otherwise send them back saying what to add or drop.
      </p>
      {chapters.length === 0 ? (
        <Notice icon={AlertTriangle} tone="amber">No chapters on the exam for this subject.</Notice>
      ) : (
        <ol className="rounded-xl border border-gray-100 divide-y divide-gray-50">
          {chapters.map((ch, i) => (
            <li key={ch} className="flex gap-3 px-3 py-2 text-sm text-gray-800">
              <span className="w-5 shrink-0 text-right text-xs text-gray-400 tabular-nums pt-0.5">{i + 1}</span>
              <span className="break-words">{ch}</span>
            </li>
          ))}
        </ol>
      )}
      <Field label="Comment" hint="Required to send it back; optional when approving.">
        <textarea className={`${inputCls} min-h-[72px]`} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="e.g. Batch B hasn't reached Rotational Motion yet; drop it or move the exam" />
      </Field>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </Modal>
  );
}

/** One line under a sign-off stage while it's out with the teachers. */
export function SignoffWaitingLine({ signoffs }: { signoffs: Signoff[] | null | undefined }) {
  const c = signoffCounts(signoffs);
  if (c.total === 0) return null;
  return (
    <p className="flex items-center gap-1 text-xs text-amber-800 mt-0.5">
      <Hourglass className="h-3 w-3 shrink-0" /> Waiting for {c.waiting} of {c.total} teacher{c.total === 1 ? "" : "s"} to sign
    </p>
  );
}
