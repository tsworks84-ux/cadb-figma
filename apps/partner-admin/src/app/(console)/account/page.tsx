"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api";
import { useMe } from "@/lib/queries";
import { Button, Card, CardHeader, ErrorNote, Field, Input, PageHeader, Spinner } from "@/components/ui";

const MIN = 10;

export default function AccountPage() {
  const qc = useQueryClient();
  const { data: me, isLoading } = useMe();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [localError, setLocalError] = useState("");

  const change = useMutation({
    mutationFn: () => api("/auth/change-password", { method: "POST", body: { currentPassword: current, newPassword: next } }),
    onSuccess: () => {
      setCurrent(""); setNext(""); setConfirm("");
      qc.invalidateQueries({ queryKey: ["me"] });
      toast.success("Password changed. Your other sessions were signed out.");
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setLocalError("");
    if (next.length < MIN) return setLocalError(`Use at least ${MIN} characters.`);
    if (next !== confirm) return setLocalError("The two new passwords don't match.");
    change.mutate();
  };

  if (isLoading) return <Spinner />;

  return (
    <>
      <PageHeader title="Account" description={me ? `${me.name} · ${me.email} · ${me.role === "OWNER" ? "Owner" : "Manager"}` : undefined} />
      {me?.mustChangePassword && (
        <div className="mb-5 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          You signed in with a temporary password. Choose your own to continue.
        </div>
      )}
      <Card className="max-w-lg">
        <CardHeader title="Change password" />
        <form onSubmit={submit} className="flex flex-col gap-4 p-4 sm:p-5">
          <Field label="Current password" htmlFor="cur">
            <Input id="cur" type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
          </Field>
          <Field label="New password" htmlFor="new" hint={`At least ${MIN} characters.`}>
            <Input id="new" type="password" autoComplete="new-password" required value={next} onChange={(e) => setNext(e.target.value)} />
          </Field>
          <Field label="New password again" htmlFor="confirm">
            <Input id="confirm" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
          {(localError || change.error) && <ErrorNote>{localError || errorMessage(change.error)}</ErrorNote>}
          <Button type="submit" variant="primary" loading={change.isPending} className="sm:self-end">Change password</Button>
        </form>
      </Card>
    </>
  );
}
