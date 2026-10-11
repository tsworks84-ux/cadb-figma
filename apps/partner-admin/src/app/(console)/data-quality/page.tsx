"use client";

import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { CheckCircle2, ChevronDown, RefreshCw } from "lucide-react";
import { useState } from "react";
import { api, errorMessage } from "@/lib/api";
import type { QualityCheck } from "@/lib/types";
import { Badge, Button, Card, ErrorNote, PageHeader, Spinner } from "@/components/ui";

const SEVERITY = {
  error: { label: "Fix", tone: "red" as const, stripe: "bg-red-500" },
  warning: { label: "Review", tone: "amber" as const, stripe: "bg-amber-400" },
  info: { label: "Info", tone: "neutral" as const, stripe: "bg-slate-300" },
};

const humanise = (k: string) => k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());

function CheckRow({ c }: { c: QualityCheck }) {
  const [open, setOpen] = useState(false);
  const s = SEVERITY[c.severity];
  const columns = c.sample[0] ? Object.keys(c.sample[0]) : [];
  return (
    <li className="relative">
      <span className={clsx("absolute inset-y-0 left-0 w-1", c.count ? s.stripe : "bg-emerald-400")} aria-hidden />
      <button
        type="button"
        disabled={c.count === 0}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-start gap-3 py-3 pl-5 pr-4 text-left enabled:hover:bg-canvas/60 sm:items-center"
      >
        <div className="min-w-0 flex-1">
          <p className="font-medium text-ink">{c.title}</p>
          <p className="text-sm text-ink-muted">{c.help}</p>
        </div>
        {c.count === 0 ? (
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-label="No problems" />
        ) : (
          <>
            <Badge tone={s.tone}>{s.label}</Badge>
            <span className="tabular w-10 shrink-0 text-right font-semibold text-ink">{c.count}</span>
            <ChevronDown className={clsx("h-4 w-4 shrink-0 text-ink-muted transition-transform", open && "rotate-180")} aria-hidden />
          </>
        )}
      </button>
      {open && c.count > 0 && (
        <div className="overflow-x-auto border-t border-line bg-canvas/40 px-5 py-3">
          <table className="w-full min-w-[28rem] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-ink-muted">
                {columns.map((col) => <th key={col} className="py-1.5 pr-4 font-medium">{humanise(col)}</th>)}
              </tr>
            </thead>
            <tbody>
              {c.sample.map((row, i) => (
                <tr key={i} className="border-t border-line/70">
                  {columns.map((col) => <td key={col} className="py-1.5 pr-4 text-ink-soft">{String(row[col] ?? "—")}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
          {c.count > c.sample.length && <p className="mt-2 text-xs text-ink-muted">Showing {c.sample.length} of {c.count}.</p>}
        </div>
      )}
    </li>
  );
}

export default function DataQualityPage() {
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["data-quality"],
    queryFn: () => api<{ generatedAt: string; checks: QualityCheck[] }>("/data-quality"),
  });
  const order = { error: 0, warning: 1, info: 2 };
  const checks = [...(data?.checks ?? [])].sort((a, b) => Number(b.count > 0) - Number(a.count > 0) || order[a.severity] - order[b.severity]);
  const problems = checks.filter((c) => c.count > 0 && c.severity !== "info").length;

  return (
    <>
      <PageHeader
        title="Data quality"
        description="Problems that would make partner data wrong or incomplete. Fixes happen in CADB or in a project's setup; this page only reads."
        actions={<Button onClick={() => refetch()} loading={isFetching}><RefreshCw className="h-4 w-4" /> Re-check</Button>}
      />
      {error && <ErrorNote>{errorMessage(error)}</ErrorNote>}
      {isLoading ? (
        <Spinner label="Checking…" />
      ) : (
        <>
          <p className="mb-3 text-sm text-ink-soft">
            {problems === 0 ? "Nothing needs fixing." : `${problems} check${problems > 1 ? "s" : ""} need${problems > 1 ? "" : "s"} attention.`}{" "}
            {data && <span className="text-ink-muted">Checked {new Date(data.generatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}.</span>}
          </p>
          <Card className="overflow-hidden">
            <ul className="divide-y divide-line">{checks.map((c) => <CheckRow key={c.key} c={c} />)}</ul>
          </Card>
        </>
      )}
    </>
  );
}
