"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, Send, Undo2 } from "lucide-react";
import { api } from "@/lib/api";
import { Modal, Field, Select, inputCls, btnPrimary, btnSecondary, btnDanger, apiError, personName, fmtDateTime, type Person, type StageStatus } from "./shared";
import { Notice, useInvalidateExams } from "./StageDialogs";

/**
 * The blueprint for one subject of an exam. The chapters come from the exam's
 * syllabus (entered when the exam is created); the setter only fills in how the
 * paper is spread across them. The subject head then approves it, which closes
 * the stage, or sends it back with a comment.
 */

type Chapter = { chapter: string; marks: number; questions: number; questionType: string };
export type BlueprintData = { maxMarks: number | null; chapters: Chapter[]; difficulty: { easy: number; medium: number; hard: number } };
export type BlueprintStage = {
  id: string;
  name: string;
  subjectLabel: string | null;
  status: StageStatus;
  formData: BlueprintData | null;
  blueprint: { chapters: string[]; maxMarks: number | null; questionTypes: readonly string[] } | null;
  owner: Person | null;
  approverPerson: Person | null;
  submittedAt: string | null;
  lastFeedback: { actorName: string; action: string; note: string | null; createdAt: string } | null;
};

/** edit = owner filling it in; review = the approver deciding; view = read-only. */
export type BlueprintMode = "edit" | "review" | "view";

type Row = { marks: string; questions: string; questionType: string };

const num = (v: string) => (v.trim() === "" ? NaN : Number(v));
const r2 = (n: number) => Math.round(n * 100) / 100;

export function BlueprintDialog({ stage, mode, onClose, onDone }: {
  stage: BlueprintStage; mode: BlueprintMode; onClose: () => void; onDone: (message: string) => void;
}) {
  const invalidate = useInvalidateExams();
  const chapters = stage.blueprint?.chapters ?? [];
  const maxMarks = stage.blueprint?.maxMarks ?? null;
  const types = stage.blueprint?.questionTypes ?? [];
  const readOnly = mode !== "edit";

  const [rows, setRows] = useState<Record<string, Row>>(() => {
    const saved = new Map((stage.formData?.chapters ?? []).map((c) => [c.chapter.toLowerCase(), c]));
    return Object.fromEntries(chapters.map((ch) => {
      const c = saved.get(ch.toLowerCase());
      return [ch, {
        marks: c && c.marks ? String(c.marks) : "",
        questions: c && c.questions ? String(c.questions) : "",
        questionType: c?.questionType ?? "",
      }];
    }));
  });
  const d0 = stage.formData?.difficulty;
  const [diff, setDiff] = useState({ easy: d0 ? String(d0.easy) : "", medium: d0 ? String(d0.medium) : "", hard: d0 ? String(d0.hard) : "" });
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState<null | "save" | "submit" | "approve" | "back">(null);
  const [error, setError] = useState<string | null>(null);

  const total = r2(chapters.reduce((s, ch) => s + (num(rows[ch]?.marks ?? "") || 0), 0));
  const diffTotal = r2((num(diff.easy) || 0) + (num(diff.medium) || 0) + (num(diff.hard) || 0));

  // Mirrors the server's checks so the button state matches what it will accept.
  const problems = useMemo(() => {
    const out: string[] = [];
    if (chapters.length === 0) return ["No syllabus on the exam for this subject"];
    const missing = chapters.filter((ch) => {
      const r = rows[ch];
      return !(num(r.marks) > 0) || !(num(r.questions) >= 1) || !Number.isInteger(num(r.questions)) || !r.questionType;
    });
    if (missing.length) out.push(`${missing.length} chapter${missing.length === 1 ? "" : "s"} incomplete`);
    if (maxMarks != null && total !== r2(maxMarks)) out.push(`Marks total ${total}, should be ${maxMarks}`);
    if ([diff.easy, diff.medium, diff.hard].some((v) => !(num(v) >= 0))) out.push("Difficulty mix incomplete");
    else if (diffTotal !== 100) out.push(`Difficulty adds up to ${diffTotal}%, should be 100%`);
    return out;
  }, [chapters, rows, maxMarks, total, diff, diffTotal]);

  const payload = () => ({
    chapters: chapters.map((ch) => ({
      chapter: ch,
      marks: num(rows[ch].marks) || 0,
      questions: Math.max(0, Math.trunc(num(rows[ch].questions) || 0)),
      questionType: rows[ch].questionType,
    })),
    difficulty: { easy: num(diff.easy) || 0, medium: num(diff.medium) || 0, hard: num(diff.hard) || 0 },
  });

  const run = async (kind: NonNullable<typeof busy>, fn: () => Promise<any>, fallback: string) => {
    setBusy(kind); setError(null);
    try {
      const r = await fn();
      invalidate();
      onDone(r.data.message ?? fallback);
    } catch (e) {
      setError(apiError(e));
    } finally { setBusy(null); }
  };

  const setRow = (ch: string, patch: Partial<Row>) => setRows((x) => ({ ...x, [ch]: { ...x[ch], ...patch } }));

  const footer = mode === "edit" ? (<>
    <button className={btnSecondary} onClick={onClose}>Cancel</button>
    <button className={btnSecondary} disabled={!!busy || chapters.length === 0}
      onClick={() => run("save", () => api.put(`/api/v1/exams/stages/${stage.id}/form`, payload()), "Draft saved.")}>
      {busy === "save" ? "Saving…" : "Save draft"}
    </button>
    <button className={btnPrimary} disabled={!!busy || problems.length > 0}
      title={problems.length ? problems.join(" · ") : undefined}
      onClick={() => run("submit", () => api.post(`/api/v1/exams/stages/${stage.id}/submit`, payload()), "Submitted for approval.")}>
      <Send className="h-4 w-4" /> {busy === "submit" ? "Submitting…" : "Submit for approval"}
    </button>
  </>) : mode === "review" ? (<>
    <button className={btnSecondary} onClick={onClose}>Close</button>
    <button className={btnDanger} disabled={!!busy || comment.trim().length < 5}
      title={comment.trim().length < 5 ? "Write what needs changing first" : undefined}
      onClick={() => run("back", () => api.post(`/api/v1/exams/stages/${stage.id}/send-back`, { comment }), "Sent back.")}>
      <Undo2 className="h-4 w-4" /> {busy === "back" ? "Sending…" : "Send back"}
    </button>
    <button className={btnPrimary} disabled={!!busy}
      onClick={() => run("approve", () => api.post(`/api/v1/exams/stages/${stage.id}/approve`, { comment: comment.trim() || undefined }), "Approved.")}>
      <CheckCircle2 className="h-4 w-4" /> {busy === "approve" ? "Approving…" : "Approve"}
    </button>
  </>) : <button className={btnSecondary} onClick={onClose}>Close</button>;

  return (
    <Modal wide title={mode === "review" ? "Review blueprint" : "Blueprint"} onClose={onClose} footer={footer}>
      <div>
        <p className="text-sm font-semibold text-gray-900">{stage.subjectLabel ?? stage.name}</p>
        <p className="text-xs text-gray-500">
          Set by {personName(stage.owner)}
          {stage.approverPerson && stage.status === "PENDING_APPROVAL" ? ` · awaiting ${personName(stage.approverPerson)}` : ""}
          {stage.submittedAt && stage.status === "PENDING_APPROVAL" ? ` · submitted ${fmtDateTime(stage.submittedAt)}` : ""}
        </p>
      </div>

      {mode === "edit" && stage.lastFeedback && (
        <Notice icon={AlertTriangle} tone="amber">
          {stage.lastFeedback.action === "SENT_BACK" ? <><b>{stage.lastFeedback.actorName}</b> sent this back: </> : <>Reopened: </>}
          {stage.lastFeedback.note ?? ""}
        </Notice>
      )}

      {chapters.length === 0 ? (
        <Notice icon={Info} tone="amber">
          This subject has no syllabus on the exam yet. Add its chapters to the exam (Academics → Assessments → edit the exam) and the blueprint will list them here.
        </Notice>
      ) : (
        <>
          <div className="space-y-2">
            <div className="hidden md:grid md:grid-cols-[1fr_6rem_6rem_10rem] gap-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              <span>Chapter</span><span>Marks</span><span>Questions</span><span>Question type</span>
            </div>
            {chapters.map((ch) => {
              const r = rows[ch];
              return (
                <div key={ch} className="rounded-xl border border-gray-100 p-2.5 md:p-0 md:border-0 grid grid-cols-3 md:grid-cols-[1fr_6rem_6rem_10rem] gap-2 items-center">
                  <p className="col-span-3 md:col-span-1 text-sm text-gray-800 md:px-1 break-words">{ch}</p>
                  {readOnly ? (<>
                    <ReadCell label="Marks" value={r.marks || "—"} />
                    <ReadCell label="Questions" value={r.questions || "—"} />
                    <ReadCell label="Type" value={r.questionType || "—"} />
                  </>) : (<>
                    <label className="block">
                      <span className="md:hidden text-[11px] text-gray-500">Marks</span>
                      <input className={inputCls} inputMode="decimal" type="number" min={0} step="any" value={r.marks} onChange={(e) => setRow(ch, { marks: e.target.value })} aria-label={`${ch} marks`} />
                    </label>
                    <label className="block">
                      <span className="md:hidden text-[11px] text-gray-500">Questions</span>
                      <input className={inputCls} inputMode="numeric" type="number" min={0} step={1} value={r.questions} onChange={(e) => setRow(ch, { questions: e.target.value })} aria-label={`${ch} questions`} />
                    </label>
                    <label className="block">
                      <span className="md:hidden text-[11px] text-gray-500">Type</span>
                      <Select value={r.questionType} onChange={(e) => setRow(ch, { questionType: e.target.value })} aria-label={`${ch} question type`}>
                        <option value="">Select…</option>
                        {types.map((t) => <option key={t} value={t}>{t}</option>)}
                      </Select>
                    </label>
                  </>)}
                </div>
              );
            })}
            <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2 text-sm">
              <span className="font-medium text-gray-700">Total marks</span>
              <span className={`font-semibold ${maxMarks == null ? "text-gray-900" : total === r2(maxMarks) ? "text-emerald-700" : "text-red-600"}`}>
                {total}{maxMarks != null ? ` / ${maxMarks}` : ""}
              </span>
            </div>
            {maxMarks == null && <p className="text-[11px] text-gray-400">No max marks set for this subject on the exam, so the total isn&apos;t checked.</p>}
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-600 mb-2">Difficulty mix (% of the paper)</p>
            <div className="grid grid-cols-3 gap-2">
              {(["easy", "medium", "hard"] as const).map((k) => (
                <Field key={k} label={k[0].toUpperCase() + k.slice(1)}>
                  {readOnly
                    ? <p className="text-sm font-medium text-gray-900">{diff[k] ? `${diff[k]}%` : "—"}</p>
                    : <input className={inputCls} type="number" min={0} max={100} step="any" inputMode="decimal" value={diff[k]} onChange={(e) => setDiff((x) => ({ ...x, [k]: e.target.value }))} />}
                </Field>
              ))}
            </div>
            <p className={`text-xs mt-1 ${diffTotal === 100 ? "text-emerald-700" : "text-gray-500"}`}>Adds up to {diffTotal}%</p>
          </div>
        </>
      )}

      {mode === "edit" && problems.length > 0 && chapters.length > 0 && (
        <p className="text-xs text-amber-700">To submit: {problems.join(" · ")}</p>
      )}
      {mode === "review" && (
        <Field label="Comment" hint="Required to send it back; optional when approving.">
          <textarea className={`${inputCls} min-h-[72px]`} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="e.g. Too much weight on Optics; move 8 marks to Modern Physics" />
        </Field>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </Modal>
  );
}

function ReadCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="md:px-1">
      <span className="md:hidden block text-[11px] text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
  );
}

/** Which way the blueprint opens for this user, or null if they can't open it. */
export function blueprintModeFor(stage: { status: StageStatus; owner: Person | null; approverPerson: Person | null }, userId: string, canManage: boolean, isSA: boolean): BlueprintMode {
  if (stage.status === "PENDING_APPROVAL" && (stage.approverPerson?.id === userId || isSA) && stage.owner?.id !== userId) return "review";
  if ((stage.status === "NOT_STARTED" || stage.status === "IN_PROGRESS") && (stage.owner?.id === userId || canManage)) return "edit";
  return "view";
}
