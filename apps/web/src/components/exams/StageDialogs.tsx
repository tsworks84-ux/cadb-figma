"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Mail } from "lucide-react";
import { api } from "@/lib/api";
import { Modal, Field, inputCls, btnPrimary, btnSecondary, btnDanger, apiError, PersonPicker, type Person } from "./shared";

/**
 * Every exam view reads from these keys. A stage change can move numbers on all
 * of them (board, tasks, the exam page, the sidebar badge), so refresh them all
 * rather than guessing which one the user will look at next.
 */
export function useInvalidateExams() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["exam-me"] });
    qc.invalidateQueries({ queryKey: ["exam-tasks"] });
    qc.invalidateQueries({ queryKey: ["exam-board"] });
    qc.invalidateQueries({ queryKey: ["exam-detail"] });
  };
}

type StageLite = {
  id: string;
  name: string;
  subjectLabel?: string | null;
  action?: string | null;
  remarks?: string | null;
  evidenceUrl?: string | null;
};

/** Mark a stage done, with optional remarks and an evidence link. */
export function MarkDoneDialog({ stage, onClose, onDone }: { stage: StageLite; onClose: () => void; onDone: (message?: string | null) => void }) {
  const [remarks, setRemarks] = useState(stage.remarks ?? "");
  const [evidenceUrl, setEvidenceUrl] = useState(stage.evidenceUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const invalidate = useInvalidateExams();

  const submit = async () => {
    setSaving(true); setError(null);
    try {
      const r = await api.patch(`/api/v1/exams/stages/${stage.id}`, {
        status: "DONE",
        remarks: remarks.trim() || null,
        evidenceUrl: evidenceUrl.trim() || null,
      });
      invalidate();
      onDone(r.data.message);
    } catch (e) {
      setError(apiError(e, "Could not mark this stage done"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Mark stage done"
      onClose={onClose}
      footer={<>
        <button className={btnSecondary} onClick={onClose}>Cancel</button>
        <button className={btnPrimary} onClick={submit} disabled={saving}>{saving ? "Saving…" : "Mark done"}</button>
      </>}
    >
      <div>
        <p className="text-sm font-semibold text-gray-900">{stage.name}</p>
        {stage.subjectLabel && <p className="text-xs text-gray-500">{stage.subjectLabel}</p>}
      </div>
      {stage.action === "NOTIFY_STUDENTS" && (
        <Notice icon={Mail} tone="blue">
          Marking this done emails the exam date, timing and syllabus to every student in the exam&apos;s batches and their parents
          (if student emails are switched on in Administration → Notifications). Check the syllabus on the assessment first.
        </Notice>
      )}
      {stage.action === "RELEASE_RESULTS" && (
        <Notice icon={AlertTriangle} tone="amber">
          Marking this done makes the marks visible on the student portal and emails each student and their parents their score
          (if switched on). Only do this after the results have been verified.
        </Notice>
      )}
      <Field label="Evidence link (optional)" hint="Drive file, Learnyst test link, or anything that shows the work is done.">
        <input className={inputCls} value={evidenceUrl} onChange={(e) => setEvidenceUrl(e.target.value)} placeholder="https://…" inputMode="url" />
      </Field>
      <Field label="Remarks (optional)">
        <textarea className={`${inputCls} min-h-[80px]`} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Anything the next person should know" />
      </Field>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </Modal>
  );
}

/** Controller-only: skip a stage with a reason. */
export function BypassDialog({ stage, onClose }: { stage: StageLite; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const invalidate = useInvalidateExams();
  const submit = async () => {
    setSaving(true); setError(null);
    try {
      await api.post(`/api/v1/exams/stages/${stage.id}/bypass`, { reason });
      invalidate();
      onClose();
    } catch (e) {
      setError(apiError(e, "Could not bypass this stage"));
    } finally { setSaving(false); }
  };
  return (
    <Modal
      title="Bypass stage"
      onClose={onClose}
      footer={<>
        <button className={btnSecondary} onClick={onClose}>Cancel</button>
        <button className={btnDanger} onClick={submit} disabled={saving || reason.trim().length < 5}>{saving ? "Saving…" : "Bypass"}</button>
      </>}
    >
      <p className="text-sm text-gray-700">
        <span className="font-semibold">{stage.name}</span>{stage.subjectLabel ? ` · ${stage.subjectLabel}` : ""} will be marked as bypassed.
        The reason is recorded in the stage history.
      </p>
      <Field label="Reason">
        <textarea className={`${inputCls} min-h-[80px]`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. No re-evaluation requests received" />
      </Field>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </Modal>
  );
}

/** Exam team: hand a stage to someone else. */
export function ReassignDialog({ stage, current, onClose }: { stage: StageLite; current: Person | null; onClose: () => void }) {
  const [person, setPerson] = useState<Person | null>(current);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const invalidate = useInvalidateExams();
  const submit = async () => {
    if (!person) return;
    setSaving(true); setError(null);
    try {
      await api.patch(`/api/v1/exams/stages/${stage.id}/owner`, { ownerId: person.id });
      invalidate();
      onClose();
    } catch (e) {
      setError(apiError(e, "Could not reassign this stage"));
    } finally { setSaving(false); }
  };
  return (
    <Modal
      title="Reassign stage"
      onClose={onClose}
      footer={<>
        <button className={btnSecondary} onClick={onClose}>Cancel</button>
        <button className={btnPrimary} onClick={submit} disabled={saving || !person || person.id === current?.id}>{saving ? "Saving…" : "Reassign"}</button>
      </>}
    >
      <p className="text-sm text-gray-700"><span className="font-semibold">{stage.name}</span>{stage.subjectLabel ? ` · ${stage.subjectLabel}` : ""}</p>
      <Field label="New owner" hint="The new owner is notified. This stays with them even if the exam team changes later.">
        <PersonPicker value={person} onChange={setPerson} />
      </Field>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </Modal>
  );
}

export function Notice({ icon: Icon, tone, children }: { icon: React.ElementType; tone: "blue" | "amber" | "red" | "green"; children: React.ReactNode }) {
  const cls = {
    blue: "bg-blue-50 border-blue-100 text-blue-800",
    amber: "bg-amber-50 border-amber-100 text-amber-800",
    red: "bg-red-50 border-red-100 text-red-800",
    green: "bg-emerald-50 border-emerald-100 text-emerald-800",
  }[tone];
  return (
    <div className={`flex gap-2 rounded-xl border px-3 py-2.5 text-sm ${cls}`}>
      <Icon className="h-4 w-4 shrink-0 mt-0.5" />
      <div>{children}</div>
    </div>
  );
}
