"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Layers } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api";
import { PROJECT_TYPE_LABEL, type ProjectDetail, type Structure } from "@/lib/types";
import { ProjectDetailsForm, type ProjectDetailsValue } from "@/components/project-details-form";
import { sameStructure, StructureEditor } from "@/components/structure-editor";
import { Badge, Button, Card, CardHeader, ErrorNote, Field, Input, Modal, PageHeader, Spinner, StatusBadge } from "@/components/ui";

const toDetails = (p: ProjectDetail): ProjectDetailsValue => ({
  partnerId: p.partner.id,
  type: p.type,
  internalName: p.internalName,
  displayName: p.displayName,
  startDate: p.startDate,
  startAcademicYearId: p.startAcademicYear.id,
});

const toStructure = (p: ProjectDetail): Structure => ({
  gradeIds: p.grades.map((g) => g.id),
  schools: p.schools.map((s) => ({ schoolId: s.schoolId, grades: s.grades.map((g) => ({ gradeId: g.gradeId, boardId: g.board.id })) })),
});

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { data: project, isLoading, error } = useQuery({ queryKey: ["projects", id], queryFn: () => api<ProjectDetail>(`/projects/${id}`) });

  const [details, setDetails] = useState<ProjectDetailsValue | null>(null);
  const [structure, setStructure] = useState<Structure | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteText, setDeleteText] = useState("");

  // Reset the editors whenever the server copy changes (after a save, or another admin's edit).
  useEffect(() => {
    if (project) {
      setDetails(toDetails(project));
      setStructure(toStructure(project));
    }
  }, [project]);

  const refresh = (p?: ProjectDetail) => {
    if (p) qc.setQueryData(["projects", id], p);
    qc.invalidateQueries({ queryKey: ["projects"] });
    qc.invalidateQueries({ queryKey: ["batches"] });
    qc.invalidateQueries({ queryKey: ["data-quality"] });
    qc.invalidateQueries({ queryKey: ["partners"] });
  };

  const saveDetails = useMutation({
    mutationFn: (d: ProjectDetailsValue) => {
      const { partnerId: _partner, ...rest } = d;
      return api<ProjectDetail>(`/projects/${id}`, { method: "PATCH", body: rest });
    },
    onSuccess: (p) => { refresh(p); toast.success("Details saved"); },
  });
  const saveStructure = useMutation({
    mutationFn: (s: Structure) => api<ProjectDetail>(`/projects/${id}/structure`, { method: "PUT", body: s }),
    onSuccess: (p) => { refresh(p); toast.success("Grades, schools and boards saved"); },
  });
  const setArchived = useMutation({
    mutationFn: (archive: boolean) => api<ProjectDetail>(`/projects/${id}/${archive ? "archive" : "unarchive"}`, { method: "POST", body: {} }),
    onSuccess: (p) => { refresh(p); toast.success(p.status === "ARCHIVED" ? "Project archived" : "Project restored"); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: () => api(`/projects/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.removeQueries({ queryKey: ["projects", id] });
      refresh();
      toast.success("Project deleted");
      router.replace("/projects");
    },
  });

  const removedSchools = useMemo(() => {
    if (!project || !structure) return [];
    const kept = new Set(structure.schools.map((s) => s.schoolId));
    return project.schools.filter((s) => !kept.has(s.schoolId));
  }, [project, structure]);

  if (isLoading) return <Spinner />;
  if (error || !project || !details || !structure) return <ErrorNote>{error ? errorMessage(error) : "Project not found."}</ErrorNote>;

  const detailsDirty = JSON.stringify(details) !== JSON.stringify(toDetails(project));
  const structureDirty = !sameStructure(structure, toStructure(project));
  const archived = project.status === "ARCHIVED";

  return (
    <>
      <Link href="/projects" className="mb-3 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Projects
      </Link>
      <PageHeader
        title={project.internalName}
        description={`${project.partner.name} · ${PROJECT_TYPE_LABEL[project.type]} · partners see “${project.displayName}”`}
        actions={<StatusBadge status={project.status} />}
      />
      {archived && (
        <div className="mb-5 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          This project is archived. Partner users can't see it, and batches can't be assigned to it.
        </div>
      )}

      <div className="flex flex-col gap-5">
        <Card>
          <CardHeader title="Details" />
          <div className="flex flex-col gap-4 p-4 sm:p-5">
            <ProjectDetailsForm value={details} onChange={setDetails} partnerLocked />
            {saveDetails.error && <ErrorNote>{errorMessage(saveDetails.error)}</ErrorNote>}
            {detailsDirty && (
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="ghost" onClick={() => setDetails(toDetails(project))}>Discard changes</Button>
                <Button variant="primary" loading={saveDetails.isPending} onClick={() => saveDetails.mutate(details)}>Save details</Button>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Grades, schools and boards" />
          <div className="flex flex-col gap-4 p-4 sm:p-5">
            <StructureEditor value={structure} onChange={setStructure} />
            {removedSchools.length > 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Saving removes {removedSchools.map((s) => s.name ?? "a school").join(", ")} from this project. Partner users lose access to{" "}
                {removedSchools.length > 1 ? "those schools" : "that school"} here, and its students drop out of partner data.
              </div>
            )}
            {saveStructure.error && <ErrorNote>{errorMessage(saveStructure.error)}</ErrorNote>}
            {structureDirty && (
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="ghost" onClick={() => setStructure(toStructure(project))}>Discard changes</Button>
                <Button variant="primary" loading={saveStructure.isPending} onClick={() => saveStructure.mutate(structure)}>
                  Save grades, schools and boards
                </Button>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Batches"
            description="Which CADB batches belong to this project. Partners see nothing until batches are assigned."
            actions={
              <Link href={`/batches?project=${project.id}`} className="inline-flex h-8 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-medium text-ink hover:bg-canvas">
                <Layers className="h-4 w-4" /> Manage batches
              </Link>
            }
          />
          <div className="flex flex-wrap gap-2 px-4 py-4 sm:px-5">
            <Badge tone={project.batchCount ? "brand" : "amber"}>{project.batchCount} batch{project.batchCount === 1 ? "" : "es"} assigned</Badge>
            <Badge>{project.userCount} partner user{project.userCount === 1 ? "" : "s"} with access</Badge>
          </div>
        </Card>

        <Card>
          <CardHeader title="Archive or delete" />
          <div className="flex flex-col gap-4 p-4 sm:p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-ink-soft">
                {archived ? "Restore the project to make it visible to its partner users again." : "Archiving hides the project from partner users. Nothing is deleted."}
              </p>
              <Button loading={setArchived.isPending} onClick={() => setArchived.mutate(!archived)}>
                {archived ? "Restore project" : "Archive project"}
              </Button>
            </div>
            <div className="flex flex-col gap-2 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-ink-soft">
                {project.batchCount > 0
                  ? "A project with batches can't be deleted. Archive it, or unassign its batches first."
                  : "Delete only a project created by mistake. This can't be undone."}
              </p>
              <Button variant="danger" disabled={project.batchCount > 0} onClick={() => { setDeleteText(""); setConfirmDelete(true); }}>
                Delete project
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <Modal
        open={confirmDelete}
        title="Delete this project?"
        onClose={() => setConfirmDelete(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Keep project</Button>
            <Button variant="danger" disabled={deleteText !== project.internalName} loading={remove.isPending} onClick={() => remove.mutate()}>
              Delete project
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-ink-soft">
            This removes the project, its schools and boards, and every partner user's access to it. Type the internal name to confirm.
          </p>
          <Field label={project.internalName} htmlFor="confirm-name">
            <Input id="confirm-name" value={deleteText} onChange={(e) => setDeleteText(e.target.value)} autoComplete="off" />
          </Field>
          {remove.error && <ErrorNote>{errorMessage(remove.error)}</ErrorNote>}
        </div>
      </Modal>
    </>
  );
}
