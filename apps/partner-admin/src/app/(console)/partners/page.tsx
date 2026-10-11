"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api";
import { usePartners } from "@/lib/queries";
import type { Partner } from "@/lib/types";
import { Badge, Button, Card, EmptyState, ErrorNote, Field, Input, Modal, PageHeader, Spinner } from "@/components/ui";

interface Form {
  name: string;
  displayName: string;
  isInternal: boolean;
  brandColor: string;
  logoUrl: string;
  domain: string;
  emailFrom: string;
}
const blank: Form = { name: "", displayName: "", isInternal: false, brandColor: "", logoUrl: "", domain: "", emailFrom: "" };
const fromPartner = (p: Partner): Form => ({
  name: p.name,
  displayName: p.displayName,
  isInternal: p.isInternal,
  brandColor: p.brandColor ?? "",
  logoUrl: p.logoUrl ?? "",
  domain: p.domain ?? "",
  emailFrom: p.emailFrom ?? "",
});

export default function PartnersPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = usePartners();
  const [editing, setEditing] = useState<Partner | "new" | null>(null);
  const [form, setForm] = useState<Form>(blank);

  const open = (p: Partner | "new") => { setEditing(p); setForm(p === "new" ? blank : fromPartner(p)); save.reset(); };
  const done = () => { qc.invalidateQueries({ queryKey: ["partners"] }); qc.invalidateQueries({ queryKey: ["projects"] }); };

  const save = useMutation({
    mutationFn: () =>
      editing === "new"
        ? api<Partner>("/partners", { method: "POST", body: form })
        : api<Partner>(`/partners/${(editing as Partner).id}`, { method: "PATCH", body: form }),
    onSuccess: () => { done(); setEditing(null); toast.success("Partner saved"); },
  });
  const archive = useMutation({
    mutationFn: (p: Partner) => api<Partner>(`/partners/${p.id}`, { method: "PATCH", body: { isArchived: !p.isArchived } }),
    onSuccess: (p) => { done(); toast.success(p.isArchived ? "Partner archived" : "Partner restored"); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const submit = (e: FormEvent) => { e.preventDefault(); save.mutate(); };
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <>
      <PageHeader
        title="Partners"
        description="Organisations whose projects we run. Our own programs belong to an internal partner, which outside partners never see."
        actions={<Button variant="primary" onClick={() => open("new")}><Plus className="h-4 w-4" /> New partner</Button>}
      />
      {error && <ErrorNote>{errorMessage(error)}</ErrorNote>}
      {isLoading ? (
        <Spinner />
      ) : !data?.length ? (
        <Card><EmptyState title="No partners yet">Add the first partner, for example VIBGYOR.</EmptyState></Card>
      ) : (
        <Card>
          <ul className="divide-y divide-line">
            {data.map((p) => (
              <li key={p.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
                <span className="hidden h-8 w-8 shrink-0 rounded-md ring-1 ring-line sm:block" style={{ background: p.brandColor ?? "#e2e8f0" }} aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-ink">{p.name}</p>
                    {p.isInternal && <Badge tone="brand">Internal</Badge>}
                    {p.isArchived && <Badge>Archived</Badge>}
                  </div>
                  <p className="text-xs text-ink-muted">
                    Partners see “{p.displayName}” · {p.projectCount} project{p.projectCount === 1 ? "" : "s"} · {p.userCount} user{p.userCount === 1 ? "" : "s"}
                    {p.domain ? ` · ${p.domain}` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => open(p)}><Pencil className="h-4 w-4" /> Edit</Button>
                  <Button size="sm" variant="ghost" loading={archive.isPending && archive.variables?.id === p.id} onClick={() => archive.mutate(p)}>
                    {p.isArchived ? "Restore" : "Archive"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Modal
        open={editing !== null}
        title={editing === "new" ? "New partner" : "Edit partner"}
        onClose={() => setEditing(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button variant="primary" type="submit" form="partner-form" loading={save.isPending}>Save partner</Button>
          </>
        }
      >
        <form id="partner-form" onSubmit={submit} className="flex flex-col gap-4">
          <Field label="Internal name" htmlFor="p-name" hint="Used by your team only.">
            <Input id="p-name" required minLength={2} value={form.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field label="Name partner users see" htmlFor="p-display">
            <Input id="p-display" required minLength={2} value={form.displayName} onChange={(e) => set("displayName", e.target.value)} />
          </Field>
          <label className="flex items-start gap-2 text-sm text-ink">
            <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-line accent-brand" checked={form.isInternal} onChange={(e) => set("isInternal", e.target.checked)} />
            <span>Internal partner<span className="block text-xs text-ink-muted">For our own programs. Never listed to outside partners.</span></span>
          </label>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Brand colour" htmlFor="p-color" hint="Hex, e.g. #7A2E8E">
              <Input id="p-color" value={form.brandColor} onChange={(e) => set("brandColor", e.target.value)} placeholder="#000000" />
            </Field>
            <Field label="Dashboard domain" htmlFor="p-domain" hint="Set at go-live.">
              <Input id="p-domain" value={form.domain} onChange={(e) => set("domain", e.target.value)} placeholder="example.in" />
            </Field>
          </div>
          <Field label="Logo URL" htmlFor="p-logo">
            <Input id="p-logo" value={form.logoUrl} onChange={(e) => set("logoUrl", e.target.value)} />
          </Field>
          <Field label="Email sender" htmlFor="p-email" hint="Must be on the partner's neutral domain, never one of ours.">
            <Input id="p-email" type="email" value={form.emailFrom} onChange={(e) => set("emailFrom", e.target.value)} />
          </Field>
          {save.error && <ErrorNote>{errorMessage(save.error)}</ErrorNote>}
        </form>
      </Modal>
    </>
  );
}
