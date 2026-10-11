"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api";
import { useSchools } from "@/lib/queries";
import type { BatchPage, ProjectListItem } from "@/lib/types";
import { Badge, Button, Card, EmptyState, ErrorNote, Input, PageHeader, Select, Spinner } from "@/components/ui";

function BatchesView() {
  const qc = useQueryClient();
  const initialProject = useSearchParams().get("project") ?? "";
  const [project, setProject] = useState(initialProject || "unassigned");
  const [academicYear, setAcademicYear] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [search, setSearch] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [target, setTarget] = useState(initialProject);

  const { data: schools } = useSchools();
  const { data: projects } = useQuery({
    queryKey: ["projects", "list", "status=ACTIVE"],
    queryFn: () => api<ProjectListItem[]>("/projects?status=ACTIVE"),
  });

  const params = new URLSearchParams({ page: String(page), pageSize: "50" });
  if (project) params.set("project", project);
  if (academicYear) params.set("academicYear", academicYear);
  if (schoolId) params.set("schoolId", schoolId);
  if (search.trim()) params.set("search", search.trim());
  if (includeArchived) params.set("includeArchived", "true");

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["batches", params.toString()],
    queryFn: () => api<BatchPage>(`/batches?${params}`),
    placeholderData: keepPreviousData,
  });

  // A new filter starts from page one with nothing selected.
  useEffect(() => { setPage(1); setSelected(new Set()); }, [project, academicYear, schoolId, search, includeArchived]);

  const afterChange = () => {
    setSelected(new Set());
    qc.invalidateQueries({ queryKey: ["batches"] });
    qc.invalidateQueries({ queryKey: ["projects"] });
    qc.invalidateQueries({ queryKey: ["data-quality"] });
  };
  const assign = useMutation({
    mutationFn: () => api<{ assigned: number; movedFromOtherProjects: number }>("/batches/assign", { method: "POST", body: { projectId: target, batchIds: [...selected] } }),
    onSuccess: (r) => {
      afterChange();
      toast.success(`${r.assigned} batch${r.assigned === 1 ? "" : "es"} assigned${r.movedFromOtherProjects ? `, ${r.movedFromOtherProjects} moved from another project` : ""}`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const unassign = useMutation({
    mutationFn: () => api<{ unassigned: number }>("/batches/unassign", { method: "POST", body: { batchIds: [...selected] } }),
    onSuccess: (r) => { afterChange(); toast.success(`${r.unassigned} batch${r.unassigned === 1 ? "" : "es"} unassigned`); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const rows = data?.rows ?? [];
  const allOnPage = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleAll = () => setSelected((s) => { const n = new Set(s); rows.forEach((r) => (allOnPage ? n.delete(r.id) : n.add(r.id))); return n; });
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const selectedAssigned = rows.filter((r) => selected.has(r.id) && r.project).length;

  return (
    <>
      <PageHeader
        title="Batches"
        description="Assign CADB batches to a project. A batch belongs to at most one project; unassigned batches are never shown to partners."
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Select value={project} onChange={(e) => setProject(e.target.value)} aria-label="Project filter">
          <option value="unassigned">Not in any project</option>
          <option value="assigned">In any project</option>
          <option value="">All batches</option>
          {projects?.length ? <option disabled>──────────</option> : null}
          {projects?.map((p) => <option key={p.id} value={p.id}>In {p.internalName}</option>)}
        </Select>
        <Select value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} aria-label="Academic year">
          <option value="">All academic years</option>
          {data?.academicYears.map((y) => <option key={y} value={y}>{y}</option>)}
        </Select>
        <Select value={schoolId} onChange={(e) => setSchoolId(e.target.value)} aria-label="School">
          <option value="">All schools</option>
          {schools?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
        <Input placeholder="Search batch name" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search batches" />
      </div>
      <label className="mb-4 inline-flex items-center gap-2 text-sm text-ink-soft">
        <input type="checkbox" className="h-4 w-4 rounded border-line accent-brand" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} />
        Include archived batches
      </label>

      {selected.size > 0 && (
        <div className="sticky top-14 z-20 mb-4 flex flex-col gap-2 rounded-lg border border-brand/30 bg-brand-soft p-3 shadow-sm lg:top-2 lg:flex-row lg:items-center">
          <p className="text-sm font-medium text-brand-dark lg:mr-auto">{selected.size} selected</p>
          <Select className="lg:w-72" value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Project to assign to">
            <option value="">Choose a project…</option>
            {projects?.map((p) => <option key={p.id} value={p.id}>{p.internalName}</option>)}
          </Select>
          <div className="flex gap-2">
            <Button variant="primary" className="flex-1" disabled={!target} loading={assign.isPending} onClick={() => assign.mutate()}>Assign</Button>
            <Button className="flex-1" disabled={selectedAssigned === 0} loading={unassign.isPending} onClick={() => unassign.mutate()}>Unassign</Button>
            <Button variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
          </div>
        </div>
      )}

      {error && <ErrorNote>{errorMessage(error)}</ErrorNote>}
      {isLoading ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <Card><EmptyState title="No batches match">Change the filters above.</EmptyState></Card>
      ) : (
        <Card className={isFetching ? "opacity-70 transition-opacity" : undefined}>
          <div className="flex items-center gap-3 border-b border-line px-4 py-2.5 sm:px-5">
            <input type="checkbox" className="h-4 w-4 rounded border-line accent-brand" checked={allOnPage} onChange={toggleAll} aria-label="Select all on this page" />
            <span className="tabular text-sm text-ink-muted">{data!.total} batch{data!.total === 1 ? "" : "es"}</span>
          </div>
          <ul className="divide-y divide-line">
            {rows.map((b) => (
              <li key={b.id}>
                <label className="flex cursor-pointer gap-3 px-4 py-3 hover:bg-canvas/60 sm:px-5">
                  <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 rounded border-line accent-brand" checked={selected.has(b.id)} onChange={() => toggle(b.id)} />
                  <div className="grid min-w-0 flex-1 gap-1 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.4fr)_auto_minmax(0,1.2fr)] md:items-center md:gap-4">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink">{b.name}</p>
                      <p className="text-xs text-ink-muted">{b.academicYear}{b.grade ? ` · Grade ${b.grade}` : ""}{b.isArchived ? " · archived" : !b.isActive ? " · inactive" : ""}</p>
                    </div>
                    <p className="min-w-0 truncate text-sm text-ink-soft">{b.schools.map((s) => s.name ?? "Unknown school").join(", ") || "No school"}</p>
                    <p className="tabular text-sm text-ink-soft md:text-right">{b.studentCount} student{b.studentCount === 1 ? "" : "s"}</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {b.project ? (
                        <Link href={`/projects/${b.project.id}`} onClick={(e) => e.stopPropagation()}>
                          <Badge tone={b.project.status === "ACTIVE" ? "brand" : "neutral"}>{b.project.internalName}</Badge>
                        </Link>
                      ) : (
                        <Badge>Not assigned</Badge>
                      )}
                      {b.schoolsOutsideProject > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-800" title="Students from these schools are left out of partner data">
                          <AlertTriangle className="h-3.5 w-3.5" /> {b.schoolsOutsideProject} school{b.schoolsOutsideProject > 1 ? "s" : ""} outside project
                        </span>
                      )}
                    </div>
                  </div>
                </label>
              </li>
            ))}
          </ul>
          {pages > 1 && (
            <div className="flex items-center justify-between border-t border-line px-4 py-2.5 sm:px-5">
              <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /> Previous</Button>
              <span className="tabular text-sm text-ink-muted">Page {page} of {pages}</span>
              <Button size="sm" variant="ghost" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next <ChevronRight className="h-4 w-4" /></Button>
            </div>
          )}
        </Card>
      )}
    </>
  );
}

export default function BatchesPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <BatchesView />
    </Suspense>
  );
}
