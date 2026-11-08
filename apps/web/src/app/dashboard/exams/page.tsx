"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ChevronRight, Settings2 } from "lucide-react";
import { api } from "@/lib/api";
import {
  ExamsHeader, HealthChip, AccessDenied, Select, fmtDay, fmtDayShort, relDays, personName, useExamMe, Chip,
  type Person,
} from "@/components/exams/shared";
import { StepProgress, StepLegend, stepPercent, type Step } from "@/components/exams/StepProgress";

type BoardExam = {
  id: string;
  name: string;
  examDate: string;
  startTime: string;
  endTime: string;
  academicYear: string;
  mode: string | null;
  examType: { id: string; name: string } | null;
  controller: Person | null;
  executive: Person | null;
  batches: string[];
  tracked: boolean;
  resultsReleasedAt: string | null;
  daysToExam: number;
  summary: {
    total: number; done: number; overdue: number; health: string;
    currentStage: { name: string; subjectLabel: string | null; plannedDate: string; overdue: boolean } | null;
  } | null;
  steps: Step[];
  overdueStages: { id: string; name: string; subjectLabel: string | null; plannedDate: string; owner: Person | null; daysLate: number }[];
};

type Kpis = {
  windowDays: number;
  examsHeld: number;
  stagesOnTimePct: number | null;
  avgDaysToResults: number | null;
  openOverdue: number;
  untrackedUpcoming: number;
};

export default function ExamBoardPage() {
  const { data: me, isLoading: meLoading } = useExamMe();
  const [days, setDays] = useState("45");
  const [filter, setFilter] = useState<"all" | "late" | "untracked">("all");

  const { data, isLoading } = useQuery<{ exams: BoardExam[]; kpis: Kpis }>({
    queryKey: ["exam-board", days],
    queryFn: () => api.get("/api/v1/exams/board", { params: { days } }).then((r) => r.data.data),
    enabled: !!me?.canViewBoard,
    staleTime: 30 * 1000,
  });

  if (meLoading) return null;
  if (!me?.canViewBoard) {
    return <AccessDenied message="The exam board is for the Controller of Examinations, the Examination Executive and Super Admins. Your own exam tasks are under My Tasks." />;
  }

  const exams = (data?.exams ?? []).filter((e) =>
    filter === "late" ? (e.summary?.overdue ?? 0) > 0 : filter === "untracked" ? !e.tracked : true);
  const k = data?.kpis;

  return (
    <div className="space-y-6">
      <ExamsHeader
        title="Exam Board"
        subtitle="Every upcoming exam and where it stands. Red means a stage has passed its due date and isn't done."
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Stages overdue now" value={k?.openOverdue ?? "—"} tone={k && k.openOverdue > 0 ? "red" : "default"} />
        <Kpi label="Stages done on time" value={k?.stagesOnTimePct != null ? `${k.stagesOnTimePct}%` : "—"} hint={`last ${k?.windowDays ?? 90} days`} />
        <Kpi label="Avg. days exam → results" value={k?.avgDaysToResults ?? "—"} hint={`${k?.examsHeld ?? 0} exams, last ${k?.windowDays ?? 90} days`} />
        <Kpi label="Upcoming, not set up" value={k?.untrackedUpcoming ?? "—"} tone={k && k.untrackedUpcoming > 0 ? "amber" : "default"} hint="exams with no tracking yet" />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex gap-1 rounded-xl bg-gray-100 p-1 overflow-x-auto scrollbar-none">
          {([["all", "All"], ["late", "Late"], ["untracked", "Not set up"]] as const).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setFilter(v)}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${filter === v ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-800"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="sm:ml-auto sm:w-56">
          <Select value={days} onChange={(e) => setDays(e.target.value)}>
            <option value="14">Next 14 days</option>
            <option value="45">Next 45 days</option>
            <option value="90">Next 90 days</option>
            <option value="180">Next 180 days</option>
          </Select>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-sm text-gray-400">Loading…</div>
      ) : exams.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-500">
          No exams in this view. Exams are created under Academics → Assessments; set up tracking here once they exist.
        </div>
      ) : (
        <div className="space-y-2">
          {exams.some((e) => e.tracked) && <div className="px-1"><StepLegend /></div>}
          {exams.map((e) => <ExamRow key={e.id} exam={e} />)}
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, hint, tone = "default" }: { label: string; value: React.ReactNode; hint?: string; tone?: "default" | "red" | "amber" }) {
  const color = tone === "red" ? "text-red-600" : tone === "amber" ? "text-amber-600" : "text-gray-900";
  return (
    <div className="rounded-2xl border border-gray-100 bg-white px-4 py-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-2xl font-semibold mt-1 ${color}`}>{value}</p>
      {hint && <p className="text-[11px] text-gray-400 mt-0.5">{hint}</p>}
    </div>
  );
}

function ExamRow({ exam: e }: { exam: BoardExam }) {
  const s = e.summary;
  const pct = stepPercent(e.steps);
  const stepsDone = e.steps.filter((x) => x.state === "DONE").length;
  const late = (s?.overdue ?? 0) > 0;

  return (
    <Link
      href={`/dashboard/exams/${e.id}`}
      className={`block rounded-2xl border bg-white px-4 py-3 sm:px-5 sm:py-4 hover:shadow-sm active:bg-gray-50 transition ${late ? "border-red-200" : "border-gray-100"}`}
    >
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        {/* Date block */}
        <div className="flex lg:flex-col items-baseline lg:items-center gap-2 lg:gap-0 lg:w-20 shrink-0">
          <p className="text-lg font-semibold text-gray-900">{fmtDayShort(e.examDate)}</p>
          <p className={`text-xs ${e.daysToExam < 0 ? "text-gray-400" : e.daysToExam <= 7 ? "text-amber-600 font-semibold" : "text-gray-500"}`}>{relDays(e.daysToExam)}</p>
        </div>

        {/* Name */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-gray-900">{e.name}</p>
            {e.examType && <Chip className="bg-indigo-50 text-indigo-700">{e.examType.name}</Chip>}
            {e.resultsReleasedAt && e.tracked && <Chip className="bg-emerald-50 text-emerald-700">Results out</Chip>}
          </div>
          <p className="text-xs text-gray-500 mt-0.5 truncate">
            {e.batches.join(", ") || "No batches"} · {e.startTime}–{e.endTime}
            {e.controller ? ` · CoE ${personName(e.controller)}` : ""}
          </p>
        </div>

        {/* Progress */}
        {s ? (
          <div className="lg:w-80 shrink-0 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <HealthChip health={s.health} />
              <span className="text-xs text-gray-500"><span className="font-semibold text-gray-900">{pct}%</span> · {stepsDone}/{e.steps.length} steps</span>
            </div>
            <StepProgress steps={e.steps} legend={false} />
            {s.currentStage && (
              <p className={`text-xs truncate ${s.currentStage.overdue ? "text-red-600 font-medium" : "text-gray-600"}`}>
                Now: {s.currentStage.name}{s.currentStage.subjectLabel ? ` (${s.currentStage.subjectLabel})` : ""} · due {fmtDay(s.currentStage.plannedDate)}
              </p>
            )}
          </div>
        ) : (
          <div className="lg:w-80 shrink-0">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700">
              <Settings2 className="h-3.5 w-3.5" /> Not set up — open to assign type and team
            </span>
          </div>
        )}
        <ChevronRight className="hidden lg:block h-4 w-4 text-gray-300 shrink-0" />
      </div>

      {e.overdueStages.length > 0 && (
        <div className="mt-3 rounded-xl bg-red-50 border border-red-100 px-3 py-2 space-y-1">
          {e.overdueStages.slice(0, 4).map((o) => (
            <p key={o.id} className="flex items-start gap-1.5 text-xs text-red-700">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px" />
              <span>
                <span className="font-semibold">{o.name}</span>{o.subjectLabel ? ` (${o.subjectLabel})` : ""} — {personName(o.owner)}, {o.daysLate} day{o.daysLate === 1 ? "" : "s"} late
              </span>
            </p>
          ))}
          {e.overdueStages.length > 4 && <p className="text-xs text-red-600">+{e.overdueStages.length - 4} more overdue</p>}
        </div>
      )}
    </Link>
  );
}
