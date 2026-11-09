"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ClipboardCheck, CheckCircle2, Lock, Play, ExternalLink, CalendarClock, Info, ClipboardList, ShieldCheck, Hourglass, Send, Undo2 } from "lucide-react";
import { api } from "@/lib/api";
import {
  useExamMe, StatusChip, fmtDay, relDays, btnPrimary, btnSecondary, apiError, MODE_LABEL, personName, type StageStatus,
} from "@/components/exams/shared";
import { MarkDoneDialog, Notice, useInvalidateExams } from "@/components/exams/StageDialogs";
import { BlueprintDialog, type BlueprintStage, type BlueprintMode } from "@/components/exams/Blueprint";

// Exam stages assigned to (or awaiting approval from) the signed-in user.
// Rendered on the Examinations "My Tasks" page and inside My To-Do; both use
// the same card and dialogs so the exam workflow rules live in one place.

export type ExamTask = BlueprintStage & {
  id: string;
  name: string;
  description: string | null;
  subjectLabel: string | null;
  plannedDate: string;
  status: StageStatus;
  action: string | null;
  remarks: string | null;
  evidenceUrl: string | null;
  completedAt: string | null;
  overdue: boolean;
  daysLeft: number;
  blockedBy: { id: string; name: string; subjectLabel: string | null }[];
  exam: { id: string; name: string; examDate: string; mode: string | null };
  approver: "SUBJECT_HEAD" | "CONTROLLER" | null;
  form: "BLUEPRINT" | null;
  isOwner: boolean;
  awaitingMyApproval: boolean;
};

export function useMyExamTasks(enabled = true) {
  return useQuery<ExamTask[]>({
    queryKey: ["exam-tasks"],
    queryFn: () => api.get("/api/v1/exams/tasks").then((r) => r.data.data),
    staleTime: 30 * 1000,
    enabled,
  });
}

export type ExamTaskGroupKey = "approve" | "overdue" | "week" | "later" | "submitted" | "done";

export function groupExamTasks(tasks: ExamTask[]) {
  const approvals = tasks.filter((t) => t.awaitingMyApproval);
  const mine = tasks.filter((t) => t.isOwner);
  const open = mine.filter((t) => t.status === "NOT_STARTED" || t.status === "IN_PROGRESS");
  return [
    { key: "approve" as const, label: "Awaiting your approval", tasks: approvals, tone: "text-violet-700" },
    { key: "overdue" as const, label: "Overdue", tasks: open.filter((t) => t.overdue), tone: "text-red-700" },
    { key: "week" as const, label: "Due in the next 7 days", tasks: open.filter((t) => !t.overdue && t.daysLeft <= 7), tone: "text-amber-700" },
    { key: "later" as const, label: "Later", tasks: open.filter((t) => t.daysLeft > 7), tone: "text-gray-700" },
    { key: "submitted" as const, label: "Submitted, waiting for approval", tasks: mine.filter((t) => t.status === "PENDING_APPROVAL"), tone: "text-amber-700" },
    { key: "done" as const, label: "Completed in the last 14 days", tasks: mine.filter((t) => t.status === "DONE" || t.status === "BYPASSED"), tone: "text-gray-500" },
  ];
}

/** Grouped exam task cards plus the dialogs they open. */
export function ExamTaskGroups({ tasks, include }: { tasks: ExamTask[]; include?: ExamTaskGroupKey[] }) {
  const [doneFor, setDoneFor] = useState<ExamTask | null>(null);
  const [bpFor, setBpFor] = useState<{ task: ExamTask; mode: BlueprintMode } | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const groups = groupExamTasks(tasks).filter((g) => g.tasks.length > 0 && (!include || include.includes(g.key)));

  return (
    <div className="space-y-6">
      {flash && <Notice icon={Info} tone="green">{flash}</Notice>}
      {groups.map((g) => (
        <section key={g.key} className="space-y-2">
          <h2 className={`text-xs font-semibold uppercase tracking-wide ${g.tone}`}>{g.label} · {g.tasks.length}</h2>
          <div className="space-y-2">
            {g.tasks.map((t) => (
              <TaskCard key={t.id} task={t} onDone={() => setDoneFor(t)} onBlueprint={(mode) => setBpFor({ task: t, mode })} onFlash={setFlash} />
            ))}
          </div>
        </section>
      ))}

      {bpFor && (
        <BlueprintDialog
          stage={bpFor.task}
          mode={bpFor.mode}
          onClose={() => setBpFor(null)}
          onDone={(msg) => { setBpFor(null); setFlash(msg); }}
        />
      )}
      {doneFor && (
        <MarkDoneDialog
          stage={doneFor}
          onClose={() => setDoneFor(null)}
          onDone={(msg) => { setDoneFor(null); setFlash(msg ?? `"${doneFor.name}" marked done.`); }}
        />
      )}
    </div>
  );
}

/**
 * "Assigned to me · Exams" panel at the top of My To-Do. Shows only open work
 * (approvals, overdue, upcoming, submitted); completed stages stay on the
 * exam page. Renders nothing for people with no part in exams.
 */
export function ExamTasksInTodo() {
  const { data: me } = useExamMe();
  const { data: tasks = [], isLoading } = useMyExamTasks(!!me?.showTasks);
  const groups = groupExamTasks(tasks);
  const count = (k: ExamTaskGroupKey) => groups.find((g) => g.key === k)?.tasks.length ?? 0;
  const approve = count("approve"), overdue = count("overdue"), week = count("week"), later = count("later"), submitted = count("submitted");
  const openTotal = approve + overdue + week + later + submitted;
  const urgent = approve + overdue > 0;
  const [userOpen, setUserOpen] = useState<boolean | null>(null);
  const open = userOpen ?? urgent;

  if (!me?.showTasks || isLoading || openTotal === 0) return null;

  const summary = [
    overdue && `${overdue} overdue`,
    approve && `${approve} to approve`,
    week && `${week} due this week`,
    later && `${later} later`,
    submitted && `${submitted} submitted`,
  ].filter(Boolean).join(" · ");

  return (
    <div className={`bg-white rounded-lg border ${urgent ? "border-red-100" : "border-gray-200"}`}>
      <button
        type="button"
        onClick={() => setUserOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <div className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 bg-[#2C3E7C]/10">
          <ClipboardCheck className="h-4 w-4 text-[#2C3E7C]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">Assigned to me · Exams <span className="font-normal text-gray-400">({openTotal})</span></p>
          <p className={`text-xs truncate ${urgent ? "text-red-600" : "text-gray-500"}`}>{summary}</p>
        </div>
        <ChevronDown className={`h-4 w-4 text-gray-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t border-gray-100 px-3 py-4 sm:px-4 space-y-4">
          <p className="text-xs text-gray-500">
            Set by the exam team. Deadlines and approvals follow the exam plan, so these can&apos;t be edited or deleted here.
          </p>
          <ExamTaskGroups tasks={tasks} include={["approve", "overdue", "week", "later", "submitted"]} />
          <Link href="/dashboard/exams/tasks" className="inline-block text-xs text-[#2C3E7C] hover:underline">
            See completed exam tasks →
          </Link>
        </div>
      )}
    </div>
  );
}

function TaskCard({ task: t, onDone, onBlueprint, onFlash }: {
  task: ExamTask; onDone: () => void; onBlueprint: (mode: BlueprintMode) => void; onFlash: (m: string) => void;
}) {
  const invalidate = useInvalidateExams();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const closed = t.status === "DONE" || t.status === "BYPASSED";
  const blocked = t.blockedBy.length > 0;

  const pending = t.status === "PENDING_APPROVAL";
  const isBlueprint = t.form === "BLUEPRINT";
  const post = async (action: string, body: object) => {
    setBusy(true); setErr(null);
    try {
      const r = await api.post(`/api/v1/exams/stages/${t.id}/${action}`, body);
      invalidate();
      if (r.data.message) onFlash(r.data.message);
    } catch (e) { setErr(apiError(e)); } finally { setBusy(false); }
  };
  const withdraw = async () => {
    if (!confirm("Withdraw this submission to make changes? You'll need to submit it again.")) return;
    setBusy(true); setErr(null);
    try {
      await api.patch(`/api/v1/exams/stages/${t.id}`, { status: "IN_PROGRESS" });
      invalidate();
    } catch (e) { setErr(apiError(e)); } finally { setBusy(false); }
  };

  const start = async () => {
    setBusy(true); setErr(null);
    try {
      await api.patch(`/api/v1/exams/stages/${t.id}`, { status: "IN_PROGRESS" });
      invalidate();
    } catch (e) { setErr(apiError(e)); } finally { setBusy(false); }
  };

  return (
    <div className={`rounded-2xl border bg-white px-4 py-3 sm:px-5 sm:py-4 ${t.awaitingMyApproval ? "border-violet-200" : t.overdue ? "border-red-200" : "border-gray-100"}`}>
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-gray-900">{t.name}</p>
            <StatusChip status={t.status} overdue={t.overdue} />
          </div>
          {t.subjectLabel && <p className="text-xs text-gray-500 mt-0.5">{t.subjectLabel}</p>}
          <Link href={`/dashboard/exams/${t.exam.id}`} className="inline-block text-xs text-[#2C3E7C] hover:underline mt-1">
            {t.exam.name} · exam {fmtDay(t.exam.examDate)}{t.exam.mode ? ` · ${MODE_LABEL[t.exam.mode]}` : ""}
          </Link>
          <p className={`flex items-center gap-1 text-xs mt-1 ${t.overdue ? "text-red-600 font-semibold" : "text-gray-500"}`}>
            <CalendarClock className="h-3.5 w-3.5" />
            {closed ? `Completed ${t.completedAt ? fmtDay(t.completedAt) : ""}` : `Due ${fmtDay(t.plannedDate)} (${relDays(t.daysLeft)})`}
          </p>
          {t.awaitingMyApproval && <p className="text-xs text-violet-700 mt-1">Submitted by <b>{personName(t.owner)}</b> for your approval</p>}
          {pending && !t.awaitingMyApproval && (
            <p className="flex items-center gap-1 text-xs text-amber-800 mt-1"><Hourglass className="h-3.5 w-3.5" /> Waiting for {personName(t.approverPerson)}</p>
          )}
          {t.lastFeedback && (
            <p className="text-xs text-amber-700 mt-1">
              {t.lastFeedback.action === "SENT_BACK" ? `Sent back by ${t.lastFeedback.actorName}` : "Reopened"}{t.lastFeedback.note ? `: ${t.lastFeedback.note}` : ""}
            </p>
          )}
          {t.description && !closed && !t.awaitingMyApproval && <p className="text-xs text-gray-500 mt-2">{t.description}</p>}
          {blocked && !closed && (
            <p className="flex items-start gap-1 text-xs text-amber-700 mt-2">
              <Lock className="h-3.5 w-3.5 shrink-0 mt-px" />
              Waiting on: {t.blockedBy.slice(0, 3).map((b) => b.name + (b.subjectLabel ? ` (${b.subjectLabel})` : "")).join(", ")}
              {t.blockedBy.length > 3 ? ` +${t.blockedBy.length - 3} more` : ""}
            </p>
          )}
          {t.evidenceUrl && (
            <a href={t.evidenceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-[#2C3E7C] hover:underline mt-1">
              <ExternalLink className="h-3 w-3" /> Evidence
            </a>
          )}
          {err && <p className="text-xs text-red-600 mt-1">{err}</p>}
        </div>
        {t.awaitingMyApproval && (
          <div className="flex flex-wrap gap-2 shrink-0">
            {isBlueprint ? (
              <button className={btnPrimary} onClick={() => onBlueprint("review")}><ShieldCheck className="h-4 w-4" /> Review blueprint</button>
            ) : (<>
              <button className={btnSecondary} disabled={busy} onClick={() => {
                const comment = prompt("What needs changing?");
                if (comment && comment.trim().length >= 5) post("send-back", { comment });
                else if (comment !== null) setErr("Say what needs changing (at least 5 characters).");
              }}><Undo2 className="h-4 w-4" /> Send back</button>
              <button className={btnPrimary} disabled={busy} onClick={() => post("approve", {})}><CheckCircle2 className="h-4 w-4" /> Approve</button>
            </>)}
          </div>
        )}
        {pending && t.isOwner && !t.awaitingMyApproval && (
          <div className="flex flex-wrap gap-2 shrink-0">
            {isBlueprint && <button className={btnSecondary} onClick={() => onBlueprint("view")}><ClipboardList className="h-4 w-4" /> View</button>}
            <button className={btnSecondary} disabled={busy} onClick={withdraw}><Undo2 className="h-4 w-4" /> Withdraw</button>
          </div>
        )}
        {closed && isBlueprint && (
          <div className="flex gap-2 shrink-0">
            <button className={btnSecondary} onClick={() => onBlueprint("view")}><ClipboardList className="h-4 w-4" /> View blueprint</button>
          </div>
        )}
        {!closed && !pending && (
          <div className="flex flex-wrap gap-2 shrink-0">
            {t.status === "NOT_STARTED" && !isBlueprint && (
              <button className={btnSecondary} onClick={start} disabled={busy}><Play className="h-4 w-4" /> Start</button>
            )}
            {isBlueprint ? (
              <button className={btnPrimary} onClick={() => onBlueprint("edit")}
                title={blocked ? "You can fill it in now; submit once earlier steps are done" : undefined}>
                <ClipboardList className="h-4 w-4" /> {t.formData ? "Edit blueprint" : "Fill blueprint"}
              </button>
            ) : t.approver ? (
              <button className={btnPrimary} onClick={() => post("submit", {})} disabled={blocked || busy}
                title={blocked ? "Earlier steps must be finished first" : undefined}>
                <Send className="h-4 w-4" /> Submit for approval
              </button>
            ) : (
              <button
                className={btnPrimary}
                onClick={onDone}
                disabled={blocked}
                title={blocked ? "Earlier steps must be finished first" : undefined}
              >
                <CheckCircle2 className="h-4 w-4" /> Mark done
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
