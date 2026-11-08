"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Circle, CircleDot, Hourglass } from "lucide-react";
import { fmtDay } from "./shared";

/**
 * The exam cycle as a segmented bar: one block per step, in order, equal width.
 * Colour shows the step's state, and is never the only cue: the legend pairs each
 * colour with an icon and a word, every block has a tooltip and an accessible
 * label, and the stage list below the bar is the full table view.
 *
 * A step with several subjects fills in proportion to how many are closed, on a
 * lighter track of the same colour, so "2 of 3 subjects done" is visible too.
 */

export type StepState = "DONE" | "OVERDUE" | "PENDING" | "ACTIVE" | "TODO";
export type Step = {
  seq: number; name: string; offsetDays: number; plannedDate: string;
  total: number; done: number; pending: number; overdue: number; state: StepState;
};

const STATE: Record<StepState, { label: string; fill: string; track: string; ink: string; icon: React.ElementType; iconCls: string }> = {
  DONE:    { label: "Done",              fill: "bg-emerald-500", track: "bg-emerald-500", ink: "text-white",    icon: CheckCircle2,  iconCls: "text-emerald-600" },
  ACTIVE:  { label: "In progress",       fill: "bg-blue-500",    track: "bg-blue-100",    ink: "text-white",    icon: CircleDot,     iconCls: "text-blue-600" },
  PENDING: { label: "Awaiting approval", fill: "bg-amber-400",   track: "bg-amber-100",   ink: "text-gray-900", icon: Hourglass,     iconCls: "text-amber-600" },
  OVERDUE: { label: "Overdue",           fill: "bg-red-500",     track: "bg-red-100",     ink: "text-white",    icon: AlertTriangle, iconCls: "text-red-600" },
  TODO:    { label: "Not started",       fill: "bg-gray-200",    track: "bg-gray-200",    ink: "text-gray-500", icon: Circle,        iconCls: "text-gray-400" },
};
const LEGEND_ORDER: StepState[] = ["DONE", "ACTIVE", "PENDING", "OVERDUE", "TODO"];

/** Share of the cycle complete, counting part-done subject steps by their fraction. */
export function stepPercent(steps: Step[]) {
  if (steps.length === 0) return 0;
  return Math.round((steps.reduce((s, x) => s + x.done / x.total, 0) / steps.length) * 100);
}

function describe(st: Step) {
  const bits: string[] = [STATE[st.state].label];
  if (st.total > 1) bits.push(`${st.done}/${st.total} subjects done`);
  if (st.pending && st.state !== "PENDING") bits.push(`${st.pending} awaiting approval`);
  if (st.state !== "DONE") bits.push(`due ${fmtDay(st.plannedDate)}`);
  return bits.join(" · ");
}

export function StepProgress({ steps, size = "thin", onSelect, legend = true }: {
  steps: Step[];
  size?: "thin" | "tall";
  /** Tall bar only: called with the step's sequence number when a block is clicked. */
  onSelect?: (seq: number) => void;
  legend?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (steps.length === 0) return null;
  const tall = size === "tall";
  const n = steps.length;
  const examDayIdx = steps.findIndex((s) => s.offsetDays >= 0);
  const done = steps.filter((s) => s.state === "DONE").length;
  const present = new Set(steps.map((s) => s.state));
  const h = hover != null ? steps[hover] : null;

  return (
    <div className="w-full">
      <div className="relative">
        <div
          role="img"
          aria-label={`${done} of ${n} steps done. ${steps.map((s, i) => `Step ${i + 1} ${s.name}: ${describe(s)}`).join(". ")}`}
          className={`flex w-full ${tall ? "gap-[2px] h-7" : "gap-[2px] h-2"}`}
          onMouseLeave={() => setHover(null)}
        >
          {steps.map((s, i) => {
            const c = STATE[s.state];
            const frac = s.state === "DONE" ? 1 : s.total ? s.done / s.total : 0;
            // A step that's begun but has nothing closed yet still shows a sliver, so "started" reads.
            // Late or waiting on approval reads as one solid block; a started step shows how far it has got.
            const fillPct = s.state === "TODO" ? 0
              : s.state === "ACTIVE" ? Math.max(frac * 100, 18) : 100;
            const ends = tall ? "rounded" : `${i === 0 ? "rounded-l-full" : ""} ${i === n - 1 ? "rounded-r-full" : ""}`;
            const Tag = tall && onSelect ? "button" : "span";
            return (
              <Tag
                key={s.seq}
                {...(Tag === "button" ? { type: "button" as const, onClick: () => onSelect?.(s.seq) } : { tabIndex: 0 })}
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                aria-label={`Step ${i + 1}, ${s.name}: ${describe(s)}`}
                className={`relative flex-1 min-w-0 overflow-hidden ${ends} ${c.track} outline-none focus-visible:ring-2 focus-visible:ring-[#2C3E7C] focus-visible:ring-offset-1 ${
                  hover === i ? "brightness-95" : ""} ${tall && onSelect ? "cursor-pointer" : ""}`}
              >
                <span className={`absolute inset-y-0 left-0 ${c.fill}`} style={{ width: `${fillPct}%` }} />
                {tall && (
                  <span className={`relative z-10 hidden sm:flex h-full items-center justify-center text-[11px] font-semibold ${
                    fillPct >= 60 ? c.ink : "text-gray-600"}`}>
                    {i + 1}
                  </span>
                )}
              </Tag>
            );
          })}
        </div>

        {/* Exam-day marker: a tick on the boundary where post-exam steps begin. */}
        {examDayIdx > 0 && (
          <div className="pointer-events-none absolute -top-1 -bottom-1 w-0.5 rounded bg-gray-800"
            style={{ left: `calc(${(examDayIdx / n) * 100}% - 1px)` }} aria-hidden />
        )}

        {h && hover != null && (
          <div
            className="pointer-events-none absolute z-20 bottom-full mb-2 w-60 -translate-x-1/2 rounded-lg bg-gray-900 px-3 py-2 text-xs text-white shadow-lg"
            style={{ left: `clamp(7.5rem, ${((hover + 0.5) / n) * 100}%, calc(100% - 7.5rem))` }}
          >
            <p className="font-semibold">Step {hover + 1} · {h.name}</p>
            <p className="text-gray-300 mt-0.5">{describe(h)}</p>
          </div>
        )}
      </div>

      {tall && examDayIdx > 0 && (
        <div className="relative h-4 mt-1 text-[11px] text-gray-500">
          <span className="absolute whitespace-nowrap -translate-x-1/2" style={{ left: `clamp(2rem, ${(examDayIdx / n) * 100}%, calc(100% - 2rem))` }}>Exam day</span>
          <span className="absolute left-0">Before</span>
          <span className="absolute right-0">After</span>
        </div>
      )}

      {legend && (
        <ul className={`flex flex-wrap gap-x-3 gap-y-1 ${tall ? "mt-2" : "mt-1.5"}`}>
          {LEGEND_ORDER.filter((k) => tall || present.has(k)).map((k) => {
            const c = STATE[k];
            const count = steps.filter((s) => s.state === k).length;
            return (
              <li key={k} className={`flex items-center gap-1 text-[11px] ${count ? "text-gray-600" : "text-gray-400"}`}>
                <c.icon className={`h-3 w-3 ${c.iconCls}`} aria-hidden />
                {c.label}{tall ? ` ${count}` : ""}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** The colour key on its own, for a list of thin bars that each hide theirs. */
export function StepLegend() {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1" aria-label="Progress bar key">
      {LEGEND_ORDER.map((k) => {
        const c = STATE[k];
        return (
          <li key={k} className="flex items-center gap-1.5 text-[11px] text-gray-600">
            <span className={`h-2 w-4 rounded-full ${c.fill}`} aria-hidden />
            <c.icon className={`h-3 w-3 ${c.iconCls}`} aria-hidden />
            {c.label}
          </li>
        );
      })}
      <li className="flex items-center gap-1.5 text-[11px] text-gray-600">
        <span className="h-3 w-0.5 rounded bg-gray-800" aria-hidden /> Exam day
      </li>
    </ul>
  );
}
