"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, CheckCircle2, ChevronDown, ExternalLink, History, Lock, Play, RotateCcw, SkipForward,
  UserCog, Settings2, Info, Mail, Send,
} from "lucide-react";
import { api } from "@/lib/api";
import {
  ExamsHeader, StatusChip, HealthChip, Select, Field, PersonPicker, fmtDay, fmtDateTime, relDays, personName,
  btnPrimary, btnSecondary, apiError, MODE_LABEL, OWNER_ROLE_LABEL, AccessDenied, Chip,
  type Person, type StageStatus, type OwnerRole,
} from "@/components/exams/shared";
import { MarkDoneDialog, BypassDialog, ReassignDialog, Notice, useInvalidateExams } from "@/components/exams/StageDialogs";

type Stage = {
  id: string; sequenceNo: number; name: string; description: string | null;
  ownerRole: OwnerRole; scope: "EXAM" | "SUBJECT"; action: string | null; canBypass: boolean;
  paperNum: number; subjectSlot: number; subjectLabel: string | null;
  plannedDate: string; status: StageStatus; startedAt: string | null; completedAt: string | null;
  remarks: string | null; evidenceUrl: string | null; bypassReason: string | null; ownerOverridden: boolean;
  owner: Person | null; overdue: boolean; daysLate: number;
  blockedBy: { id: string; name: string; subjectLabel: string | null }[];
  events: { id: string; actorName: string; action: string; note: string | null; createdAt: string }[];
};

type ExamDetail = {
  id: string; name: string; academicYear: string; examDate: string; startTime: string; endTime: string;
  status: string; numPapers: number; numSubjects: number; mode: string | null;
  examTypeId: string | null; examType: { id: string; name: string } | null;
  controller: Person | null; executive: Person | null;
  resultsReleasedAt: string | null; studentsNotifiedAt: string | null;
  batches: { batch: { id: string; name: string } }[];
  subjects: { paperNum: number; subjectSlot: number; topics: string | null; subject: { id: string; name: string } | null }[];
  subjectTeams: { paperNum: number; subjectSlot: number; setter: Person | null; reviewer: Person | null }[];
  daysToExam: number;
  summary: { total: number; done: number; overdue: number; health: string } | null;
  stages: Stage[];
  permissions: { canManage: boolean; isController: boolean; userId: string };
};

export default function ExamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: exam, isLoading, error } = useQuery<ExamDetail>({
    queryKey: ["exam-detail", id],
    queryFn: () => api.get(`/api/v1/exams/${id}`).then((r) => r.data.data),
    staleTime: 15 * 1000,
    retry: false,
  });
  const [setupOpen, setSetupOpen] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  if (isLoading) return <div className="text-sm text-gray-400">Loading…</div>;
  if (error || !exam) {
    const status = (error as any)?.response?.status;
    return <AccessDenied message={status === 404 ? "This exam no longer exists." : "You can only open exams you're part of."} />;
  }

  const tracked = !!exam.examTypeId;
  const subjectLabel = (p: number, s: number) => {
    const row = exam.subjects.find((x) => x.paperNum === p && x.subjectSlot === s);
    const name = row?.subject?.name ?? `Subject ${s}`;
    return exam.numPapers > 1 ? `Paper ${p} · ${name}` : name;
  };

  return (
    <div className="space-y-6">
      <Link href="/dashboard/exams" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeft className="h-4 w-4" /> Exam board
      </Link>

      <ExamsHeader
        title={exam.name}
        actions={exam.permissions.canManage && tracked ? (
          <button className={btnSecondary} onClick={() => setSetupOpen((o) => !o)}><Settings2 className="h-4 w-4" /> {setupOpen ? "Hide setup" : "Edit setup"}</button>
        ) : undefined}
      />

      {/* Facts */}
      <div className="rounded-2xl border border-gray-100 bg-white px-4 py-4 sm:px-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
        <Fact label="Exam date" value={`${fmtDay(exam.examDate)} (${relDays(exam.daysToExam)})`} sub={`${exam.startTime} – ${exam.endTime}`} />
        <Fact label="Batches" value={exam.batches.map((b) => b.batch.name).join(", ") || "—"} sub={exam.academicYear} />
        <Fact label="Type & mode" value={exam.examType?.name ?? "Not set up"} sub={exam.mode ? MODE_LABEL[exam.mode] : undefined} />
        <Fact label="Team" value={`CoE: ${personName(exam.controller)}`} sub={`Executive: ${personName(exam.executive)}`} />
        {tracked && exam.summary && (
          <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap items-center gap-2 pt-2 border-t border-gray-50">
            <HealthChip health={exam.summary.health} />
            <span className="text-xs text-gray-500">{exam.summary.done}/{exam.summary.total} stages closed{exam.summary.overdue ? ` · ${exam.summary.overdue} overdue` : ""}</span>
            {exam.studentsNotifiedAt && <Chip className="bg-blue-50 text-blue-700"><Mail className="h-3 w-3 mr-1" />Notice sent {fmtDay(exam.studentsNotifiedAt)}</Chip>}
            {exam.resultsReleasedAt
              ? <Chip className="bg-emerald-50 text-emerald-700"><Send className="h-3 w-3 mr-1" />Results released {fmtDay(exam.resultsReleasedAt)}</Chip>
              : <Chip className="bg-gray-100 text-gray-600">Results hidden from students</Chip>}
          </div>
        )}
      </div>

      {flash && <Notice icon={Info} tone="green">{flash}</Notice>}

      {(!tracked || setupOpen) && (
        exam.permissions.canManage
          ? <SetupCard exam={exam} subjectLabel={subjectLabel} onSaved={(msg) => { setSetupOpen(false); setFlash(msg); }} />
          : <Notice icon={Info} tone="amber">Tracking hasn&apos;t been set up for this exam yet. The exam team will assign it a type and owners.</Notice>
      )}

      {tracked && <StageTimeline exam={exam} onFlash={setFlash} />}
    </div>
  );
}

function Fact({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="font-medium text-gray-900 break-words">{value}</p>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

// ─── Setup ────────────────────────────────────────────────────────────────────

type TypeOpt = { id: string; name: string; isActive: boolean; academicYear: string; stages: { scope: string; ownerRole: string }[] };
type TeamMember = { id: string; role: "CONTROLLER" | "EXECUTIVE"; employee: Person };

function SetupCard({ exam, subjectLabel, onSaved }: { exam: ExamDetail; subjectLabel: (p: number, s: number) => string; onSaved: (msg: string) => void }) {
  const invalidate = useInvalidateExams();
  const { data: types = [] } = useQuery<TypeOpt[]>({
    queryKey: ["exam-types", exam.academicYear],
    queryFn: () => api.get("/api/v1/exams/settings/types", { params: { academicYear: exam.academicYear } }).then((r) => r.data.data),
  });
  const { data: team = [] } = useQuery<TeamMember[]>({
    queryKey: ["exam-team"],
    queryFn: () => api.get("/api/v1/exams/settings/team").then((r) => r.data.data),
  });

  const [typeId, setTypeId] = useState(exam.examTypeId ?? "");
  const [mode, setMode] = useState(exam.mode ?? "PEN_PAPER");
  const [controller, setController] = useState<Person | null>(exam.controller);
  const [executive, setExecutive] = useState<Person | null>(exam.executive);
  const slots = exam.subjects.map((s) => ({ paperNum: s.paperNum, subjectSlot: s.subjectSlot }));
  const [teams, setTeams] = useState<Record<string, { setter: Person | null; reviewer: Person | null }>>(() =>
    Object.fromEntries(slots.map((s) => {
      const t = exam.subjectTeams.find((x) => x.paperNum === s.paperNum && x.subjectSlot === s.subjectSlot);
      return [`${s.paperNum}_${s.subjectSlot}`, { setter: t?.setter ?? null, reviewer: t?.reviewer ?? null }];
    })));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prefill from the standing team when there's exactly one of each.
  useEffect(() => {
    const ctrls = team.filter((m) => m.role === "CONTROLLER");
    const execs = team.filter((m) => m.role === "EXECUTIVE");
    if (!controller && ctrls.length === 1) setController(ctrls[0].employee);
    if (!executive && execs.length === 1) setExecutive(execs[0].employee);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team]);

  const activeTypes = types.filter((t) => t.isActive || t.id === exam.examTypeId);
  const chosen = types.find((t) => t.id === typeId);
  const needsPaperTeam = !!chosen?.stages.some((s) => s.ownerRole === "PAPER_SETTER" || s.ownerRole === "REVIEWER");
  const missingPaperTeam = needsPaperTeam && slots.some((s) => { const t = teams[`${s.paperNum}_${s.subjectSlot}`]; return !t?.setter || !t?.reviewer; });

  const save = async () => {
    setSaving(true); setError(null);
    try {
      const r = await api.put(`/api/v1/exams/${exam.id}/setup`, {
        examTypeId: typeId, mode,
        controllerId: controller?.id ?? "", executiveId: executive?.id ?? "",
        subjectTeams: slots.map((s) => {
          const t = teams[`${s.paperNum}_${s.subjectSlot}`];
          return { ...s, setterId: t?.setter?.id ?? null, reviewerId: t?.reviewer?.id ?? null };
        }),
      });
      invalidate();
      const d = r.data.data as { rescheduled: number; assigned: number };
      onSaved(exam.examTypeId
        ? `Setup saved.${d.assigned ? ` ${d.assigned} person(s) notified of new tasks.` : ""}`
        : `Tracking set up. ${d.assigned} person(s) were notified of their tasks. Marks stay hidden from students until results are released.`);
    } catch (e) {
      setError(apiError(e, "Could not save setup"));
    } finally { setSaving(false); }
  };

  return (
    <div className="rounded-2xl border border-gray-100 bg-white px-4 py-4 sm:px-6 sm:py-5 space-y-5">
      <div>
        <h2 className="text-base font-semibold text-gray-900">{exam.examTypeId ? "Exam setup" : "Set up tracking"}</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Pick the exam type; its stages and deadlines are created from the type&apos;s timings, counted from the exam date.
          Each stage goes to the person in the matching role below.
        </p>
      </div>

      {types.length === 0 && (
        <Notice icon={Info} tone="amber">No exam types exist for {exam.academicYear} yet. A Super Admin adds them under Examinations → Settings.</Notice>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Exam type">
          <Select value={typeId} onChange={(e) => setTypeId(e.target.value)}>
            <option value="">Select…</option>
            {activeTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
        </Field>
        <Field label="Mode" hint={mode === "ONLINE" ? "Paper is built and hosted on Learnyst." : "Paper is stored on the Drive, printed and dispatched."}>
          <Select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="PEN_PAPER">{MODE_LABEL.PEN_PAPER}</option>
            <option value="ONLINE">{MODE_LABEL.ONLINE}</option>
          </Select>
        </Field>
        <Field label={OWNER_ROLE_LABEL.CONTROLLER}><PersonPicker value={controller} onChange={setController} /></Field>
        <Field label={OWNER_ROLE_LABEL.EXECUTIVE}><PersonPicker value={executive} onChange={setExecutive} /></Field>
      </div>

      {needsPaperTeam && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-600">Paper setters and reviewers</p>
          <p className="text-[11px] text-gray-400 -mt-1">The reviewer must be a different person from the setter.</p>
          <div className="space-y-3">
            {slots.map((s) => {
              const key = `${s.paperNum}_${s.subjectSlot}`;
              const t = teams[key] ?? { setter: null, reviewer: null };
              const same = t.setter && t.reviewer && t.setter.id === t.reviewer.id;
              return (
                <div key={key} className="rounded-xl border border-gray-100 p-3">
                  <p className="text-sm font-medium text-gray-800 mb-2">{subjectLabel(s.paperNum, s.subjectSlot)}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Setter"><PersonPicker value={t.setter} onChange={(p) => setTeams((x) => ({ ...x, [key]: { ...t, setter: p } }))} /></Field>
                    <Field label="Reviewer"><PersonPicker value={t.reviewer} onChange={(p) => setTeams((x) => ({ ...x, [key]: { ...t, reviewer: p } }))} /></Field>
                  </div>
                  {same && <p className="text-xs text-red-600 mt-1">Setter and reviewer can&apos;t be the same person.</p>}
                </div>
              );
            })}
          </div>
          {missingPaperTeam && <p className="text-xs text-amber-700">Some papers have no setter or reviewer yet. Their stages will show as unassigned until you add them.</p>}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end">
        <button className={btnPrimary} onClick={save} disabled={saving || !typeId || !controller || !executive}>
          {saving ? "Saving…" : exam.examTypeId ? "Save setup" : "Set up tracking"}
        </button>
      </div>
    </div>
  );
}

// ─── Stages ───────────────────────────────────────────────────────────────────

function StageTimeline({ exam, onFlash }: { exam: ExamDetail; onFlash: (m: string) => void }) {
  const groups = useMemo(() => {
    const m = new Map<number, Stage[]>();
    for (const s of exam.stages) m.set(s.sequenceNo, [...(m.get(s.sequenceNo) ?? []), s]);
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [exam.stages]);

  return (
    <div className="rounded-2xl border border-gray-100 bg-white">
      <div className="px-4 py-3 sm:px-6 border-b border-gray-100">
        <h2 className="text-base font-semibold text-gray-900">Stages</h2>
        <p className="text-xs text-gray-500">Each step unlocks once the steps before it are done. Every change is recorded in the stage history.</p>
      </div>
      <ol className="divide-y divide-gray-50">
        {groups.map(([seq, stages]) => {
          const first = stages[0];
          const allClosed = stages.every((s) => s.status === "DONE" || s.status === "BYPASSED");
          const anyLate = stages.some((s) => s.overdue);
          return (
            <li key={seq} className="px-4 py-4 sm:px-6">
              <div className="flex items-start gap-3">
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  allClosed ? "bg-emerald-100 text-emerald-700" : anyLate ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}>
                  {allClosed ? <CheckCircle2 className="h-4 w-4" /> : seq}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900">{first.name}</p>
                    <span className="text-xs text-gray-400">{OWNER_ROLE_LABEL[first.ownerRole]}</span>
                    {first.action === "NOTIFY_STUDENTS" && <Chip className="bg-blue-50 text-blue-700">Emails students</Chip>}
                    {first.action === "RELEASE_RESULTS" && <Chip className="bg-emerald-50 text-emerald-700">Releases results</Chip>}
                    {first.canBypass && <Chip className="bg-gray-100 text-gray-500">Can bypass</Chip>}
                  </div>
                  {first.description && <p className="text-xs text-gray-500 mt-0.5">{first.description}</p>}
                  <div className="mt-2 space-y-2">
                    {stages.map((s) => <StageRow key={s.id} stage={s} exam={exam} onFlash={onFlash} />)}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function StageRow({ stage: s, exam, onFlash }: { stage: Stage; exam: ExamDetail; onFlash: (m: string) => void }) {
  const invalidate = useInvalidateExams();
  const [dialog, setDialog] = useState<"done" | "bypass" | "reassign" | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const { canManage, isController, userId } = exam.permissions;
  const isOwner = s.owner?.id === userId;
  const canAct = isOwner || canManage;
  const closed = s.status === "DONE" || s.status === "BYPASSED";
  const blocked = s.blockedBy.length > 0;
  const releaseNeedsController = s.action === "RELEASE_RESULTS" && !isController;

  const patch = async (status: string, okMsg?: string) => {
    setBusy(true); setErr(null);
    try {
      const r = await api.patch(`/api/v1/exams/stages/${s.id}`, { status });
      invalidate();
      if (r.data.message || okMsg) onFlash(r.data.message ?? okMsg);
    } catch (e) { setErr(apiError(e)); } finally { setBusy(false); }
  };

  return (
    <div className={`rounded-xl border px-3 py-2.5 ${s.overdue ? "border-red-200 bg-red-50/40" : "border-gray-100"}`}>
      <div className="flex flex-col md:flex-row md:items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {s.subjectLabel && <span className="text-sm font-medium text-gray-800">{s.subjectLabel}</span>}
            <StatusChip status={s.status} overdue={s.overdue} />
            {s.ownerOverridden && <span className="text-[11px] text-gray-400">reassigned</span>}
          </div>
          <p className="text-xs text-gray-600 mt-0.5">
            <span className={s.owner ? "" : "text-amber-700 font-semibold"}>{personName(s.owner)}</span>
            {" · "}
            {closed
              ? <>closed {s.completedAt ? fmtDay(s.completedAt) : ""}{s.daysLate > 0 ? <span className="text-red-600"> ({s.daysLate}d late)</span> : null}</>
              : <span className={s.overdue ? "text-red-600 font-semibold" : ""}>due {fmtDay(s.plannedDate)}{s.overdue ? ` · ${s.daysLate}d late` : ""}</span>}
          </p>
          {s.bypassReason && <p className="text-xs text-amber-700 mt-0.5">Bypassed: {s.bypassReason}</p>}
          {s.remarks && <p className="text-xs text-gray-500 mt-0.5">“{s.remarks}”</p>}
          {s.evidenceUrl && (
            <a href={s.evidenceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-[#2C3E7C] hover:underline mt-0.5">
              <ExternalLink className="h-3 w-3" /> Evidence
            </a>
          )}
          {blocked && !closed && (
            <p className="flex items-start gap-1 text-[11px] text-gray-500 mt-0.5">
              <Lock className="h-3 w-3 shrink-0 mt-px" /> Waiting on {s.blockedBy.length} earlier step{s.blockedBy.length === 1 ? "" : "s"}
            </p>
          )}
          {err && <p className="text-xs text-red-600 mt-1">{err}</p>}
        </div>

        <div className="flex flex-wrap gap-1.5 shrink-0">
          {!closed && canAct && s.status === "NOT_STARTED" && (
            <IconBtn icon={Play} label="Start" onClick={() => patch("IN_PROGRESS")} disabled={busy} />
          )}
          {!closed && canAct && (
            <IconBtn
              icon={CheckCircle2} label="Done" primary
              onClick={() => setDialog("done")}
              disabled={busy || blocked || releaseNeedsController}
              title={blocked ? "Earlier steps must be finished first" : releaseNeedsController ? "Only the Controller can release results" : undefined}
            />
          )}
          {!closed && canManage && <IconBtn icon={UserCog} label="Reassign" onClick={() => setDialog("reassign")} />}
          {!closed && isController && s.canBypass && !s.action && <IconBtn icon={SkipForward} label="Bypass" onClick={() => setDialog("bypass")} />}
          {closed && isController && (
            <IconBtn
              icon={RotateCcw} label="Reopen" disabled={busy}
              onClick={() => {
                const warn = s.action === "RELEASE_RESULTS" ? " Results will be hidden from students again." : "";
                if (confirm(`Reopen "${s.name}"?${warn}`)) patch("IN_PROGRESS", "Stage reopened.");
              }}
            />
          )}
          {s.events.length > 0 && <IconBtn icon={History} label="History" onClick={() => setHistoryOpen((o) => !o)} trailing={<ChevronDown className={`h-3 w-3 transition-transform ${historyOpen ? "rotate-180" : ""}`} />} />}
        </div>
      </div>

      {historyOpen && (
        <ul className="mt-2 border-t border-gray-100 pt-2 space-y-1">
          {s.events.map((e) => (
            <li key={e.id} className="text-[11px] text-gray-500">
              <span className="text-gray-400">{fmtDateTime(e.createdAt)}</span> · <span className="font-medium text-gray-700">{e.actorName}</span> · {EVENT_LABEL[e.action] ?? e.action}
              {e.note ? <span className="text-gray-500"> — {e.note}</span> : null}
            </li>
          ))}
        </ul>
      )}

      {dialog === "done" && (
        <MarkDoneDialog stage={s} onClose={() => setDialog(null)} onDone={(msg) => { setDialog(null); onFlash(msg ?? `"${s.name}" marked done.`); }} />
      )}
      {dialog === "bypass" && <BypassDialog stage={s} onClose={() => setDialog(null)} />}
      {dialog === "reassign" && <ReassignDialog stage={s} current={s.owner} onClose={() => setDialog(null)} />}
    </div>
  );
}

const EVENT_LABEL: Record<string, string> = {
  STARTED: "started", DONE: "marked done", BYPASSED: "bypassed", REOPENED: "reopened",
  OWNER_CHANGED: "changed owner", RESCHEDULED: "due date moved", UPDATED: "updated",
};

function IconBtn({ icon: Icon, label, onClick, disabled, primary, title, trailing }: {
  icon: React.ElementType; label: string; onClick: () => void; disabled?: boolean; primary?: boolean; title?: string; trailing?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed ${
        primary ? "bg-[#2C3E7C] text-white hover:bg-[#23326a] active:bg-[#1c2856]" : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 active:bg-gray-100"}`}
    >
      <Icon className="h-3.5 w-3.5" />{label}{trailing}
    </button>
  );
}
