"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api";
import type { ProjectDetail, Structure } from "@/lib/types";
import { emptyDetails, ProjectDetailsForm, type ProjectDetailsValue } from "@/components/project-details-form";
import { StructureEditor } from "@/components/structure-editor";
import { Button, Card, CardHeader, ErrorNote, PageHeader } from "@/components/ui";

export default function NewProjectPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [details, setDetails] = useState<ProjectDetailsValue>(emptyDetails);
  const [structure, setStructure] = useState<Structure>({ gradeIds: [], schools: [] });

  const create = useMutation({
    mutationFn: () => api<ProjectDetail>("/projects", { method: "POST", body: { ...details, ...structure } }),
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["partners"] });
      qc.invalidateQueries({ queryKey: ["data-quality"] });
      toast.success("Project created");
      router.replace(`/projects/${p.id}`);
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate();
  };

  return (
    <form onSubmit={submit}>
      <Link href="/projects" className="mb-3 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Projects
      </Link>
      <PageHeader title="New project" description="You can change everything here later, except the partner." />

      <div className="flex flex-col gap-5">
        <Card>
          <CardHeader title="Details" />
          <div className="p-4 sm:p-5">
            <ProjectDetailsForm value={details} onChange={setDetails} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Grades, schools and boards" description="Batches are assigned after the project is created." />
          <div className="p-4 sm:p-5">
            <StructureEditor value={structure} onChange={setStructure} />
          </div>
        </Card>

        {create.error && <ErrorNote>{errorMessage(create.error)}</ErrorNote>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Link href="/projects" className="inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium text-ink-soft hover:bg-canvas">
            Cancel
          </Link>
          <Button type="submit" variant="primary" loading={create.isPending}>
            Create project
          </Button>
        </div>
      </div>
    </form>
  );
}
