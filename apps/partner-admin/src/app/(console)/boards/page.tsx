"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api";
import { useBoards } from "@/lib/queries";
import type { Board } from "@/lib/types";
import { Badge, Button, Card, CardHeader, ErrorNote, Field, Input, PageHeader, Spinner } from "@/components/ui";

export default function BoardsPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useBoards();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");

  const refresh = () => { qc.invalidateQueries({ queryKey: ["boards"] }); qc.invalidateQueries({ queryKey: ["projects"] }); };
  const add = useMutation({
    mutationFn: () => api<Board>("/boards", { method: "POST", body: { code, name } }),
    onSuccess: (b) => { refresh(); setCode(""); setName(""); toast.success(`${b.code} added`); },
  });
  const toggle = useMutation({
    mutationFn: (b: Board) => api<Board>(`/boards/${b.id}`, { method: "PATCH", body: { isActive: !b.isActive } }),
    onSuccess: (b) => { refresh(); toast.success(b.isActive ? `${b.code} turned on` : `${b.code} turned off`); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const submit = (e: FormEvent) => { e.preventDefault(); add.mutate(); };

  return (
    <>
      <PageHeader title="Boards" description="Boards a school can follow for a grade. Turning a board off hides it from new choices; schools already using it keep it." />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card>
          {error && <div className="p-4"><ErrorNote>{errorMessage(error)}</ErrorNote></div>}
          {isLoading ? (
            <div className="px-5"><Spinner /></div>
          ) : (
            <ul className="divide-y divide-line">
              {data?.map((b) => (
                <li key={b.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <span className="w-16 shrink-0 font-mono text-sm font-medium text-ink">{b.code}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink">{b.name}</p>
                    <p className="tabular text-xs text-ink-muted">Used for {b.usedBy} school grade{b.usedBy === 1 ? "" : "s"}</p>
                  </div>
                  {!b.isActive && <Badge>Off</Badge>}
                  <Button size="sm" variant="ghost" loading={toggle.isPending && toggle.variables?.id === b.id} onClick={() => toggle.mutate(b)}>
                    {b.isActive ? "Turn off" : "Turn on"}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="self-start">
          <CardHeader title="Add a board" />
          <form onSubmit={submit} className="flex flex-col gap-4 p-4 sm:p-5">
            <Field label="Code" htmlFor="b-code" hint="2–16 letters or digits, e.g. KSEEB.">
              <Input id="b-code" required value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={16} />
            </Field>
            <Field label="Full name" htmlFor="b-name">
              <Input id="b-name" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            {add.error && <ErrorNote>{errorMessage(add.error)}</ErrorNote>}
            <Button type="submit" variant="primary" loading={add.isPending}><Plus className="h-4 w-4" /> Add board</Button>
          </form>
        </Card>
      </div>
    </>
  );
}
