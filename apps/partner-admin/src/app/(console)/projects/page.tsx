"use client";

import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { usePartners } from "@/lib/queries";
import { PROJECT_TYPE_LABEL, type ProjectListItem } from "@/lib/types";
import { Badge, Card, EmptyState, ErrorNote, Input, PageHeader, Select, Spinner, StatusBadge } from "@/components/ui";

const fmtDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default function ProjectsPage() {
  const [partnerId, setPartnerId] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [search, setSearch] = useState("");
  const { data: partners } = usePartners();

  const params = new URLSearchParams();
  if (partnerId) params.set("partnerId", partnerId);
  if (type) params.set("type", type);
  if (status) params.set("status", status);
  if (search.trim()) params.set("search", search.trim());

  const { data, isLoading, error } = useQuery({
    queryKey: ["projects", "list", params.toString()],
    queryFn: () => api<ProjectListItem[]>(`/projects?${params}`),
  });

  return (
    <>
      <PageHeader
        title="Projects"
        description="Each project is one program (SIP or ASP) a partner runs with us: its schools, grades, boards per grade, and batches."
        actions={
          <Link href="/projects/new" className="inline-flex h-10 items-center gap-2 rounded-md bg-brand px-4 text-sm font-medium text-white hover:bg-brand-dark">
            <Plus className="h-4 w-4" /> New project
          </Link>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input placeholder="Search by name" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search projects" />
        <Select value={partnerId} onChange={(e) => setPartnerId(e.target.value)} aria-label="Partner">
          <option value="">All partners</option>
          {partners?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
        <Select value={type} onChange={(e) => setType(e.target.value)} aria-label="Program type">
          <option value="">All program types</option>
          <option value="SIP">SIP · School Integrated</option>
          <option value="ASP">ASP · After School</option>
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="ACTIVE">Active</option>
          <option value="ARCHIVED">Archived</option>
          <option value="">Active and archived</option>
        </Select>
      </div>

      {error && <ErrorNote>{errorMessage(error)}</ErrorNote>}
      {isLoading ? (
        <Spinner />
      ) : !data?.length ? (
        <Card>
          <EmptyState title="No projects match">
            {partners?.length ? "Change the filters, or create a project." : "Add a partner first, then create its first project."}
          </EmptyState>
        </Card>
      ) : (
        <Card>
          {/* Table on wide screens, stacked rows on phones */}
          <table className="hidden w-full text-sm md:table">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-muted">
                <th className="px-5 py-3 font-medium">Project</th>
                <th className="px-3 py-3 font-medium">Type</th>
                <th className="px-3 py-3 font-medium">Starts</th>
                <th className="px-3 py-3 text-right font-medium">Schools</th>
                <th className="px-3 py-3 text-right font-medium">Grades</th>
                <th className="px-3 py-3 text-right font-medium">Batches</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.id} className="border-b border-line last:border-0 hover:bg-canvas/60">
                  <td className="px-5 py-3">
                    <Link href={`/projects/${p.id}`} className="font-medium text-ink hover:text-brand">{p.internalName}</Link>
                    <p className="text-xs text-ink-muted">{p.partner.name} · partners see “{p.displayName}”</p>
                  </td>
                  <td className="px-3 py-3"><Badge tone="brand">{p.type}</Badge></td>
                  <td className="px-3 py-3 text-ink-soft">
                    {fmtDate(p.startDate)}
                    <p className="text-xs text-ink-muted">{p.startAcademicYear ?? "Year missing"}</p>
                  </td>
                  <td className="tabular px-3 py-3 text-right">{p.schoolCount}</td>
                  <td className="tabular px-3 py-3 text-right">{p.gradeCount}</td>
                  <td className="tabular px-3 py-3 text-right">{p.batchCount}</td>
                  <td className="px-5 py-3"><StatusBadge status={p.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="divide-y divide-line md:hidden">
            {data.map((p) => (
              <li key={p.id}>
                <Link href={`/projects/${p.id}`} className="flex flex-col gap-1.5 px-4 py-3 active:bg-canvas">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium text-ink">{p.internalName}</span>
                    <StatusBadge status={p.status} />
                  </div>
                  <p className="text-xs text-ink-muted">{p.partner.name} · {PROJECT_TYPE_LABEL[p.type]}</p>
                  <p className="tabular text-xs text-ink-soft">
                    Starts {fmtDate(p.startDate)} · {p.schoolCount} schools · {p.gradeCount} grades · {p.batchCount} batches
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
