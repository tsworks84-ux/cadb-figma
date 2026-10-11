"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { api, errorMessage } from "@/lib/api";
import type { AuditRow, Paged } from "@/lib/types";
import { Button, Card, EmptyState, ErrorNote, PageHeader, Spinner } from "@/components/ui";

const ACTION_LABEL: Record<string, string> = {
  "partner.create": "created a partner",
  "partner.update": "changed a partner",
  "project.create": "created a project",
  "project.update": "changed project details",
  "project.structure.update": "changed a project's grades, schools or boards",
  "project.archive": "archived a project",
  "project.unarchive": "restored a project",
  "project.delete": "deleted a project",
  "batches.assign": "assigned batches",
  "batches.unassign": "unassigned batches",
  "board.create": "added a board",
  "board.update": "changed a board",
  "admin.password.change": "changed their password",
};

export default function ActivityPage() {
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const { data, isLoading, error } = useQuery({
    queryKey: ["audit", page],
    queryFn: () => api<Paged<AuditRow>>(`/audit?page=${page}&pageSize=50`),
    placeholderData: keepPreviousData,
  });
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <>
      <PageHeader title="Activity" description="Every change made in this console, newest first." />
      {error && <ErrorNote>{errorMessage(error)}</ErrorNote>}
      {isLoading ? (
        <Spinner />
      ) : !data?.rows.length ? (
        <Card><EmptyState title="No activity yet" /></Card>
      ) : (
        <Card>
          <ul className="divide-y divide-line">
            {data.rows.map((r) => (
              <li key={r.id}>
                <button type="button" onClick={() => setOpen(open === r.id ? null : r.id)} aria-expanded={open === r.id} className="flex w-full flex-col gap-0.5 px-4 py-3 text-left hover:bg-canvas/60 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
                  <span className="tabular shrink-0 text-xs text-ink-muted sm:w-40">
                    {new Date(r.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="min-w-0 text-sm text-ink">
                    <span className="font-medium">{r.adminUser.name}</span> {ACTION_LABEL[r.action] ?? r.action}
                  </span>
                </button>
                {open === r.id && (
                  <div className="grid grid-cols-1 gap-3 border-t border-line bg-canvas/40 px-4 py-3 sm:grid-cols-2 sm:px-5">
                    {(["before", "after"] as const).map((k) => (
                      <div key={k} className="min-w-0">
                        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-muted">{k}</p>
                        <pre className="max-h-72 overflow-auto rounded-md border border-line bg-white p-2 text-xs text-ink-soft">
                          {r[k] === null || r[k] === undefined ? "—" : JSON.stringify(r[k], null, 2)}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
          {pages > 1 && (
            <div className="flex items-center justify-between border-t border-line px-4 py-2.5 sm:px-5">
              <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /> Newer</Button>
              <span className="tabular text-sm text-ink-muted">Page {page} of {pages}</span>
              <Button size="sm" variant="ghost" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Older <ChevronRight className="h-4 w-4" /></Button>
            </div>
          )}
        </Card>
      )}
    </>
  );
}
