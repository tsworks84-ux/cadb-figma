"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { X, Archive, ArchiveRestore, Trash2, Pencil, Check, ChevronRight } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { usePermissions } from "@/hooks/usePermissions";

// ── Design tokens ─────────────────────────────────────────────────────────────
const D = {
  line: "#e6e8ef", muted: "#7c8598", ink: "#111827",
  nav2: "#28245f", bg: "#f4f6fa",
};

const inputBase: React.CSSProperties = {
  width: "100%", minHeight: 42, border: `1px solid ${D.line}`,
  borderRadius: 12, padding: "9px 12px", background: "white",
  color: D.ink, font: "inherit", fontSize: 14, outline: "none", boxSizing: "border-box",
};

// ── Primitives ────────────────────────────────────────────────────────────────
function DInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={{ ...inputBase, ...props.style }} />;
}
function DSelect({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} style={{ ...inputBase, ...props.style }}>{children}</select>;
}
function DTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} style={{ ...inputBase, minHeight: 88, resize: "vertical", ...props.style }} />;
}
function DBtn({
  primary, children, ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }) {
  return (
    <button
      {...props}
      style={{
        minHeight: 42, border: 0, borderRadius: 12, padding: "0 20px",
        font: "inherit", fontWeight: 850, cursor: props.disabled ? "not-allowed" : "pointer",
        ...(primary
          ? { background: "linear-gradient(135deg, #28245f, #4f46e5)", color: "white", boxShadow: "0 12px 24px rgba(79,70,229,.24)" }
          : { background: "white", color: "#374151", boxShadow: `inset 0 0 0 1px ${D.line}` }),
        opacity: props.disabled ? 0.6 : 1,
        ...props.style,
      }}
    >
      {children}
    </button>
  );
}
function DField({ label, req, children }: { label: string; req?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gap: 7 }}>
      <label style={{ color: "#4b5563", fontSize: 13, fontWeight: 850 }}>
        {label}{req && <span style={{ color: "#ef4444" }}> *</span>}
      </label>
      {children}
    </div>
  );
}
function ActionBtn({
  children, primary, danger, ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean; danger?: boolean }) {
  return (
    <button
      {...props}
      style={{
        padding: 6, borderRadius: 8, border: `1px solid ${D.line}`, cursor: props.disabled ? "not-allowed" : "pointer",
        background: primary ? "#4f46e5" : "white",
        color: primary ? "white" : danger ? "#ef4444" : "#6b7280",
        opacity: props.disabled ? 0.4 : 1,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      {children}
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function BatchesPage() {
  const { user } = useAuthStore();
  const permissions = usePermissions();
  const qc = useQueryClient();
  const router = useRouter();

  const blankForm = {
    name: "", description: "", locationId: "", academicYear: "",
    startDate: "", schoolId: "", gradeId: "", targetStrength: "", course: "",
  };
  const [modalOpen, setModalOpen]             = useState(false);
  const [form, setForm]                       = useState(blankForm);
  const [editId, setEditId]                   = useState<string | null>(null);
  const [editForm, setEditForm]               = useState({ name: "", description: "", locationId: "", academicYear: "", startDate: "", schoolId: "", gradeId: "" });
  const [toolbarSearch, setToolbarSearch]     = useState("");
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  const [filterYear,     setFilterYear]     = useState("");
  const [filterSchool,   setFilterSchool]   = useState("");
  const [filterGrade,    setFilterGrade]    = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [showArchived,   setShowArchived]   = useState(false);

  const canEdit =
    user?.role === "SUPER_ADMIN" ||
    user?.role === "HR_ADMIN" ||
    (permissions["ACA_BATCH"]?.canCreate ?? false);

  // ── Queries ───────────────────────────────────────────────────────────────────
  const batchParams = new URLSearchParams({ archived: String(showArchived) });
  if (filterYear)     batchParams.set("academicYear", filterYear);
  if (filterLocation) batchParams.set("locationId", filterLocation);
  if (filterSchool)   batchParams.set("schoolId", filterSchool);
  if (filterGrade)    batchParams.set("gradeId", filterGrade);

  const { data: batchRes, isLoading } = useQuery({
    queryKey: ["batches-filtered", batchParams.toString()],
    queryFn: () => api.get(`/api/v1/academics/batches?${batchParams}`).then((r) => r.data),
  });
  const allBatches: any[] = batchRes?.data ?? [];

  const { data: academicYears = [] } = useQuery({
    queryKey: ["academic-years"],
    queryFn: () => api.get("/api/v1/academics/academic-years").then((r) => r.data.data),
    staleTime: 10 * 60 * 1000,
  });
  const { data: grades = [] } = useQuery({
    queryKey: ["grades"],
    queryFn: () => api.get("/api/v1/academics/grades").then((r) => r.data.data),
    staleTime: 10 * 60 * 1000,
  });
  const { data: schools = [] } = useQuery({
    queryKey: ["schools"],
    queryFn: () => api.get("/api/v1/academics/schools").then((r) => r.data.data),
    staleTime: 10 * 60 * 1000,
  });
  const { data: locations = [] } = useQuery({
    queryKey: ["locations"],
    queryFn: () => api.get("/api/v1/academics/locations").then((r) => r.data.data),
    staleTime: 10 * 60 * 1000,
  });

  useEffect(() => {
    const active = (academicYears as any[]).filter((y) => !y.isArchived);
    if (active.length > 0 && !filterYear) setFilterYear(active[0].name);
  }, [(academicYears as any[]).length]);

  // ── Mutations ─────────────────────────────────────────────────────────────────
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["batches"] });
    qc.invalidateQueries({ queryKey: ["batches-filtered"] });
  };

  const createMut = useMutation({
    mutationFn: () => api.post("/api/v1/academics/batches", {
      name:        form.name,
      description: form.description || undefined,
      academicYear: form.academicYear,
      locationId:  form.locationId  || null,
      schoolId:    form.schoolId    || null,
      gradeId:     form.gradeId     || null,
      startDate:   form.startDate   || undefined,
    }),
    onSuccess: () => { toast.success("Batch created"); setModalOpen(false); setForm(blankForm); invalidate(); },
    onError:   (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });

  const updateMut = useMutation({
    mutationFn: (id: string) => api.patch(`/api/v1/academics/batches/${id}`, {
      ...editForm,
      locationId: editForm.locationId || null,
      schoolId:   editForm.schoolId   || null,
      gradeId:    editForm.gradeId    || null,
      startDate:  editForm.startDate  || undefined,
    }),
    onSuccess: () => { toast.success("Updated"); setEditId(null); invalidate(); },
    onError:   (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });

  const archiveMut = useMutation({
    mutationFn: (id: string) => api.patch(`/api/v1/academics/batches/${id}/archive`, {}),
    onSuccess: () => { toast.success("Updated"); invalidate(); },
    onError:   (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/academics/batches/${id}`),
    onSuccess: () => { toast.success("Batch deleted"); invalidate(); },
    onError:   (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });

  // ── Derived stats ─────────────────────────────────────────────────────────────
  const totalStudents = allBatches.reduce((s, b) => s + (b._count?.students ?? 0), 0);
  const activeBatches = allBatches.filter((b) => b.isActive && !b.isArchived).length;
  const avgStrength   = allBatches.length > 0 ? Math.round(totalStudents / allBatches.length) : 0;

  // ── Client-side search ────────────────────────────────────────────────────────
  const batches = toolbarSearch
    ? allBatches.filter((b) => {
        const q = toolbarSearch.toLowerCase();
        return (
          b.name?.toLowerCase().includes(q) ||
          b.school?.name?.toLowerCase().includes(q) ||
          b.grade?.name?.toLowerCase().includes(q) ||
          b.location?.name?.toLowerCase().includes(q) ||
          b.academicYear?.toLowerCase().includes(q)
        );
      })
    : allBatches;

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const gradeName  = (id: string) => (grades    as any[]).find((g) => g.id === id)?.name ?? id;
  const locName    = (id: string) => (locations as any[]).find((l) => l.id === id)?.name ?? id;

  // ── Live preview rows ─────────────────────────────────────────────────────────
  const previewReady = !!(form.name && form.academicYear);
  const previewRows  = [
    { label: "Name",            value: form.name || "Not set" },
    { label: "Academic Year",   value: form.academicYear || "—" },
    { label: "Grade",           value: form.gradeId ? gradeName(form.gradeId) : "None" },
    { label: "Location",        value: form.locationId ? locName(form.locationId) : "None" },
    { label: "Target Strength", value: form.targetStrength ? `${form.targetStrength} students` : "—" },
    { label: "Status",          value: previewReady ? "Ready to create" : "Required fields missing" },
  ];

  // ── Sidebar content ───────────────────────────────────────────────────────────
  const sidebarContent = (
    <div style={{ padding: "22px 18px", overflowY: "auto" }}>
      {/* Statistics */}
      <p style={{ margin: "0 0 14px", color: "#9aa3b4", fontSize: 13, fontWeight: 900, letterSpacing: ".08em", textTransform: "uppercase" }}>
        Statistics
      </p>
      <div className="grid grid-cols-2 gap-2.5 mb-6">
        {[
          { label: "Total",    value: allBatches.length },
          { label: "Active",   value: activeBatches },
          { label: "Students", value: totalStudents },
          { label: "Avg.",     value: avgStrength },
        ].map((s) => (
          <div key={s.label} style={{ background: "white", border: `1px solid ${D.line}`, borderRadius: 14, padding: "14px 12px", boxShadow: "0 4px 12px rgba(20,23,53,.04)" }}>
            <span style={{ color: D.muted, fontSize: 11, fontWeight: 850, textTransform: "uppercase", letterSpacing: ".04em" }}>{s.label}</span>
            <strong style={{ display: "block", marginTop: 6, fontSize: 24, lineHeight: 1 }}>{s.value}</strong>
          </div>
        ))}
      </div>

      {/* Filters */}
      <p style={{ margin: "0 0 14px", color: "#9aa3b4", fontSize: 13, fontWeight: 900, letterSpacing: ".08em", textTransform: "uppercase" }}>
        Filters
      </p>

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: "block", marginBottom: 8, color: "#4b5563", fontSize: 13, fontWeight: 850 }}>Show</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {([{ label: "Active", val: false }, { label: "Archived", val: true }] as const).map(({ label, val }) => (
            <button key={label} onClick={() => setShowArchived(val)} style={{
              minHeight: 34, borderRadius: 999, display: "inline-flex", alignItems: "center",
              padding: "0 13px", fontSize: 13, fontWeight: 850, cursor: "pointer", border: "1px solid",
              ...(showArchived === val
                ? { background: D.nav2, color: "white", borderColor: D.nav2 }
                : { background: "white", color: "#4b5563", borderColor: D.line }),
            }}>{label}</button>
          ))}
        </div>
      </div>

      {[
        { label: "Academic Year", content: (
          <DSelect value={filterYear} onChange={(e) => setFilterYear(e.target.value)}>
            <option value="">All years</option>
            {(academicYears as any[]).filter((y) => !y.isArchived).map((y: any) => (
              <option key={y.id} value={y.name}>{y.name}</option>
            ))}
          </DSelect>
        )},
        { label: "School", content: (
          <DSelect value={filterSchool} onChange={(e) => setFilterSchool(e.target.value)}>
            <option value="">All schools</option>
            {(schools as any[]).filter((s) => s.isActive).map((s: any) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </DSelect>
        )},
        { label: "Grade", content: (
          <DSelect value={filterGrade} onChange={(e) => setFilterGrade(e.target.value)}>
            <option value="">All grades</option>
            {(grades as any[]).filter((g) => g.isActive).map((g: any) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </DSelect>
        )},
        { label: "Location", content: (
          <DSelect value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)}>
            <option value="">All locations</option>
            {(locations as any[]).filter((l) => l.isActive).map((l: any) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </DSelect>
        )},
      ].map(({ label, content }) => (
        <div key={label} style={{ marginBottom: 20 }}>
          <label style={{ display: "block", marginBottom: 8, color: "#4b5563", fontSize: 13, fontWeight: 850 }}>{label}</label>
          {content}
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: D.bg }}>

      {/* ── Page head ────────────────────────────────────────────────────────── */}
      <div style={{
        background: "white", borderBottom: `1px solid ${D.line}`,
        padding: "22px 32px", display: "flex", alignItems: "center",
        justifyContent: "space-between", gap: 24, flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button
            className="lg:hidden"
            onClick={() => setMobileFilterOpen(true)}
            style={{ minHeight: 36, border: `1px solid ${D.line}`, borderRadius: 10, padding: "0 14px", background: "white", color: D.muted, fontSize: 13, fontWeight: 850, cursor: "pointer" }}
          >
            Filters
          </button>
          <div style={{ width: 44, height: 44, borderRadius: 14, display: "grid", placeItems: "center", background: "#eef2ff", color: D.nav2, fontWeight: 900, fontSize: 16, flexShrink: 0 }}>
            BA
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 28, lineHeight: 1.15, fontWeight: 800 }}>Batches</h1>
            <div style={{ marginTop: 4, color: D.muted, fontWeight: 700, fontSize: 14 }}>
              Create batches, track strength, and manage student allocation
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <DBtn>Stats</DBtn>
          <DBtn>Export</DBtn>
          {canEdit && <DBtn primary onClick={() => setModalOpen(true)}>+ New Batch</DBtn>}
        </div>
      </div>

      {/* ── Layout ───────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* Mobile overlay */}
        {mobileFilterOpen && (
          <div
            className="lg:hidden"
            style={{ position: "fixed", inset: 0, zIndex: 30, background: "rgba(0,0,0,.4)" }}
            onClick={() => setMobileFilterOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`${mobileFilterOpen ? "flex" : "hidden"} lg:flex flex-col shrink-0`}
          style={{
            width: 300, background: "white", borderRight: `1px solid ${D.line}`,
            overflowY: "auto",
            ...(mobileFilterOpen ? { position: "fixed", inset: "0 auto 0 0", zIndex: 40, boxShadow: "4px 0 24px rgba(0,0,0,.12)" } : {}),
          }}
        >
          <div className="flex lg:hidden items-center justify-between px-4 pt-4 pb-2">
            <span style={{ fontSize: 14, fontWeight: 700 }}>Filters &amp; Stats</span>
            <button onClick={() => setMobileFilterOpen(false)} style={{ border: "none", background: "none", cursor: "pointer", padding: 4 }}>
              <X style={{ width: 18, height: 18, color: D.muted }} />
            </button>
          </div>
          {sidebarContent}
        </aside>

        {/* Main */}
        <main style={{ flex: 1, overflowY: "auto", padding: "26px 30px 38px" }}>

          {/* Toolbar */}
          <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: "minmax(0,1fr) auto auto", alignItems: "center" }}>
            <DInput
              placeholder="Search batches by name, school, grade, location, or academic year"
              value={toolbarSearch}
              onChange={(e) => setToolbarSearch(e.target.value)}
              style={{ minHeight: 48, borderRadius: 14, fontSize: 15 }}
            />
            <span style={{ color: D.muted, fontWeight: 850, whiteSpace: "nowrap" }}>
              {batches.length} batch{batches.length !== 1 ? "es" : ""}
            </span>
            {canEdit && <DBtn primary onClick={() => setModalOpen(true)}>+ New Batch</DBtn>}
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            {[
              { label: "Total Batches",    value: allBatches.length },
              { label: "Active Batches",   value: activeBatches },
              { label: "Total Students",   value: totalStudents },
              { label: "Average Strength", value: avgStrength },
            ].map((s) => (
              <div key={s.label} style={{ background: "white", border: `1px solid ${D.line}`, borderRadius: 16, padding: 18, boxShadow: "0 8px 22px rgba(20,23,53,.05)" }}>
                <span style={{ color: D.muted, fontSize: 12, fontWeight: 850, textTransform: "uppercase", letterSpacing: ".04em" }}>{s.label}</span>
                <strong style={{ display: "block", marginTop: 8, fontSize: 28, lineHeight: 1 }}>{s.value}</strong>
              </div>
            ))}
          </div>

          {/* Content */}
          {isLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[1, 2, 3].map((i) => <div key={i} style={{ height: 72, borderRadius: 14, background: "#e9ecf3" }} className="animate-pulse" />)}
            </div>
          ) : batches.length === 0 ? (
            <>
              <div style={{ background: "white", border: "1px dashed #cbd5e1", borderRadius: 18, minHeight: 400, display: "grid", placeItems: "center", textAlign: "center", padding: 36 }}>
                <div>
                  <div style={{ width: 72, height: 72, borderRadius: 22, display: "grid", placeItems: "center", background: "#eef2ff", color: D.nav2, fontSize: 24, fontWeight: 900, margin: "0 auto 16px" }}>
                    BA
                  </div>
                  <h2 style={{ margin: 0, fontSize: 22 }}>No batches yet</h2>
                  <p style={{ margin: "8px auto 18px", color: D.muted, maxWidth: 470, lineHeight: 1.5, fontWeight: 650 }}>
                    Create your first batch to group students by course, grade, school, location, and academic year. Batch strength and schedule health will appear here.
                  </p>
                  {canEdit && <DBtn primary onClick={() => setModalOpen(true)}>+ Create Batch</DBtn>}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
                {[
                  { title: "Capacity Planning",  desc: "Monitor seats, strength, and batch utilization." },
                  { title: "Student Allocation", desc: "Assign students after admission or move them later." },
                  { title: "Schedule Ready",     desc: "Use batches directly in schedules and assignments." },
                ].map((q) => (
                  <div key={q.title} style={{ background: "white", border: `1px solid ${D.line}`, borderRadius: 16, padding: 18 }}>
                    <strong style={{ display: "block", fontSize: 15 }}>{q.title}</strong>
                    <span style={{ display: "block", color: D.muted, marginTop: 5, fontSize: 13, fontWeight: 700 }}>{q.desc}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ background: "white", border: `1px solid ${D.line}`, borderRadius: 18, overflow: "hidden", boxShadow: "0 4px 16px rgba(20,23,53,.06)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: `1px solid ${D.line}` }}>
                    <th style={thStyle}>Batch</th>
                    <th style={thStyle} className="hidden sm:table-cell">Year</th>
                    <th style={thStyle} className="hidden lg:table-cell">School / Grade</th>
                    <th style={thStyle} className="hidden md:table-cell">Location</th>
                    <th style={thStyle}>Students</th>
                    <th style={thStyle} className="hidden sm:table-cell">Status</th>
                    <th style={thStyle} />
                  </tr>
                </thead>
                <tbody>
                  {batches.map((b: any, i) => (
                    <BatchRow
                      key={b.id}
                      b={b}
                      i={i}
                      editId={editId}
                      editForm={editForm}
                      setEditForm={setEditForm}
                      setEditId={setEditId}
                      canEdit={canEdit}
                      academicYears={academicYears as any[]}
                      schools={schools as any[]}
                      grades={grades as any[]}
                      locations={locations as any[]}
                      onNavigate={() => router.push(`/dashboard/academics/batches/${b.id}`)}
                      onUpdate={() => updateMut.mutate(b.id)}
                      onArchive={() => archiveMut.mutate(b.id)}
                      onDelete={() => { if (confirm(`Delete batch "${b.name}"?`)) deleteMut.mutate(b.id); }}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>

      {/* ── New Batch Modal ───────────────────────────────────────────────────── */}
      {modalOpen && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 50, display: "grid", placeItems: "center", padding: 28, background: "linear-gradient(135deg, rgba(20,23,53,.72), rgba(40,36,95,.62))" }}
          onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}
        >
          <div style={{ width: "min(960px, 100%)", background: "white", borderRadius: 22, overflow: "hidden", boxShadow: "0 32px 90px rgba(0,0,0,.28)", maxHeight: "90vh", overflowY: "auto" }}>

            {/* Modal head */}
            <div style={{ padding: "24px 28px", borderBottom: `1px solid ${D.line}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
                <div style={{ width: 44, height: 44, borderRadius: 14, display: "grid", placeItems: "center", background: "#eef2ff", color: D.nav2, fontWeight: 900 }}>BA</div>
                <h1 style={{ margin: 0, fontSize: 28 }}>New Batch</h1>
              </div>
              <button onClick={() => setModalOpen(false)} style={{ border: "none", background: "none", cursor: "pointer", color: "#9aa3b4", fontSize: 28, lineHeight: 1 }}>×</button>
            </div>

            {/* Modal body */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5 p-7">
              {/* Batch Details section */}
              <div style={{ border: `1px solid ${D.line}`, borderRadius: 16, padding: 18, background: "#fbfcfe" }}>
                <h2 style={{ margin: "0 0 14px", fontSize: 17, fontWeight: 800 }}>Batch Details</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <DField label="Batch Name" req>
                    <DInput placeholder="e.g. JEE Advanced 2026-A" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </DField>
                  <DField label="Academic Year" req>
                    <DSelect value={form.academicYear} onChange={(e) => setForm({ ...form, academicYear: e.target.value })}>
                      <option value="">Select academic year</option>
                      {(academicYears as any[]).filter((y) => !y.isArchived).map((y: any) => (
                        <option key={y.id} value={y.name}>{y.name}</option>
                      ))}
                    </DSelect>
                  </DField>
                  <DField label="School">
                    <DSelect value={form.schoolId} onChange={(e) => setForm({ ...form, schoolId: e.target.value })}>
                      <option value="">None</option>
                      {(schools as any[]).filter((s) => s.isActive).map((s: any) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </DSelect>
                  </DField>
                  <DField label="Grade">
                    <DSelect value={form.gradeId} onChange={(e) => setForm({ ...form, gradeId: e.target.value })}>
                      <option value="">None</option>
                      {(grades as any[]).filter((g) => g.isActive).map((g: any) => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </DSelect>
                  </DField>
                  <DField label="Location">
                    <DSelect value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })}>
                      <option value="">None</option>
                      {(locations as any[]).filter((l) => l.isActive).map((l: any) => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </DSelect>
                  </DField>
                  <DField label="Start Date">
                    <DInput type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
                  </DField>
                  <DField label="Target Strength">
                    <DInput type="number" placeholder="e.g. 35" value={form.targetStrength} onChange={(e) => setForm({ ...form, targetStrength: e.target.value })} />
                  </DField>
                  <DField label="Course">
                    <DSelect value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })}>
                      <option value="">Select course</option>
                      <option>JEE Advanced</option>
                      <option>NEET</option>
                      <option>Foundation</option>
                    </DSelect>
                  </DField>
                </div>
                <div style={{ marginTop: 14 }}>
                  <DField label="Description">
                    <DTextarea placeholder="Optional batch description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                  </DField>
                </div>
              </div>

              {/* Preview card */}
              <div style={{ background: "white", border: `1px solid ${D.line}`, borderRadius: 18, padding: 20, boxShadow: "0 8px 22px rgba(20,23,53,.05)", alignSelf: "start" }}>
                <h2 style={{ margin: "0 0 14px", fontSize: 18 }}>Batch Preview</h2>
                {previewRows.map((row) => (
                  <div key={row.label} style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "11px 0", borderTop: "1px solid #eef2f7", color: D.muted, fontSize: 13, fontWeight: 750 }}>
                    <span>{row.label}</span>
                    <strong style={{ color: D.ink, textAlign: "right", maxWidth: 180 }}>{row.value}</strong>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal foot */}
            <div style={{ padding: "18px 28px", borderTop: `1px solid ${D.line}`, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <DBtn onClick={() => { setModalOpen(false); setForm(blankForm); }}>Cancel</DBtn>
              <DBtn primary onClick={() => createMut.mutate()} disabled={!form.name || !form.academicYear || createMut.isPending}>
                {createMut.isPending ? "Creating…" : "Create Batch"}
              </DBtn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Table helpers ─────────────────────────────────────────────────────────────
const thStyle: React.CSSProperties = {
  padding: "12px 16px", textAlign: "left",
  color: "#9aa3b4", fontSize: 12, fontWeight: 900,
  textTransform: "uppercase", letterSpacing: ".04em",
};

function BatchRow({
  b, i, editId, editForm, setEditForm, setEditId, canEdit,
  academicYears, schools, grades, locations,
  onNavigate, onUpdate, onArchive, onDelete,
}: {
  b: any; i: number; editId: string | null;
  editForm: any; setEditForm: (f: any) => void; setEditId: (id: string | null) => void;
  canEdit: boolean;
  academicYears: any[]; schools: any[]; grades: any[]; locations: any[];
  onNavigate: () => void; onUpdate: () => void; onArchive: () => void; onDelete: () => void;
}) {
  const D = { line: "#e6e8ef", muted: "#7c8598", ink: "#111827", nav2: "#28245f" };
  const inputBase: React.CSSProperties = {
    width: "100%", minHeight: 38, border: `1px solid ${D.line}`,
    borderRadius: 10, padding: "6px 10px", background: "white",
    color: D.ink, font: "inherit", fontSize: 13, outline: "none", boxSizing: "border-box",
  };

  const isEditing = editId === b.id;

  return (
    <tr
      onClick={() => { if (!isEditing) onNavigate(); }}
      style={{
        borderTop: i === 0 ? "none" : `1px solid ${D.line}`,
        cursor: "pointer", opacity: b.isArchived ? 0.65 : 1,
      }}
      onMouseEnter={(e) => { if (!isEditing) e.currentTarget.style.background = "#f5f7ff"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "white"; }}
    >
      {/* Name */}
      <td style={{ padding: "14px 16px" }} onClick={(e) => isEditing && e.stopPropagation()}>
        {isEditing ? (
          <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} style={{ ...inputBase, maxWidth: 200 }} />
        ) : (
          <div>
            <p style={{ margin: 0, fontWeight: 700, color: D.ink }}>{b.name}</p>
            {b.description && <p style={{ margin: "2px 0 0", fontSize: 12, color: D.muted }}>{b.description}</p>}
            <div className="sm:hidden" style={{ display: "flex", flexWrap: "wrap", gap: "0 10px", marginTop: 2, fontSize: 12, color: D.muted }}>
              <span>{b.academicYear}</span>
              {b.school && <span>{b.school.name}</span>}
              {b.grade && <span>{b.grade.name}</span>}
              {b.location && <span>{b.location.name}</span>}
            </div>
          </div>
        )}
      </td>

      {/* Year */}
      <td className="hidden sm:table-cell" style={{ padding: "14px 16px", color: D.muted }} onClick={(e) => isEditing && e.stopPropagation()}>
        {isEditing ? (
          <select value={editForm.academicYear} onChange={(e) => setEditForm({ ...editForm, academicYear: e.target.value })} style={{ ...inputBase, maxWidth: 150 }}>
            <option value="">Select year</option>
            {academicYears.filter((y) => !y.isArchived).map((y) => <option key={y.id} value={y.name}>{y.name}</option>)}
          </select>
        ) : b.academicYear}
      </td>

      {/* School / Grade */}
      <td className="hidden lg:table-cell" style={{ padding: "14px 16px" }} onClick={(e) => isEditing && e.stopPropagation()}>
        {isEditing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <select value={editForm.schoolId} onChange={(e) => setEditForm({ ...editForm, schoolId: e.target.value })} style={{ ...inputBase, maxWidth: 160 }}>
              <option value="">None</option>
              {schools.filter((s) => s.isActive).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select value={editForm.gradeId} onChange={(e) => setEditForm({ ...editForm, gradeId: e.target.value })} style={{ ...inputBase, maxWidth: 160 }}>
              <option value="">None</option>
              {grades.filter((g) => g.isActive).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
        ) : (
          <div>
            {b.school && <p style={{ margin: 0, fontSize: 13, color: D.ink }}>{b.school.name}</p>}
            {b.grade  && <p style={{ margin: "2px 0 0", fontSize: 12, color: D.muted }}>{b.grade.name}</p>}
            {!b.school && !b.grade && <span style={{ color: "#d1d5db", fontSize: 13 }}>—</span>}
          </div>
        )}
      </td>

      {/* Location */}
      <td className="hidden md:table-cell" style={{ padding: "14px 16px" }} onClick={(e) => isEditing && e.stopPropagation()}>
        {isEditing ? (
          <select value={editForm.locationId} onChange={(e) => setEditForm({ ...editForm, locationId: e.target.value })} style={{ ...inputBase, maxWidth: 150 }}>
            <option value="">None</option>
            {locations.filter((l) => l.isActive).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        ) : b.location ? (
          <span style={{ fontSize: 13, color: D.muted }}>{b.location.name}</span>
        ) : (
          <span style={{ color: "#d1d5db", fontSize: 13 }}>—</span>
        )}
      </td>

      {/* Students */}
      <td style={{ padding: "14px 16px" }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: D.ink }}>{b._count.students}</span>
      </td>

      {/* Status */}
      <td className="hidden sm:table-cell" style={{ padding: "14px 16px" }}>
        {b.isArchived ? (
          <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, background: "#fffbeb", padding: "2px 10px", fontSize: 12, fontWeight: 700, color: "#b45309", border: "1px solid #fde68a" }}>Archived</span>
        ) : b.isActive ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, borderRadius: 999, background: "#f0fdf4", padding: "2px 10px", fontSize: 12, fontWeight: 700, color: "#16a34a", border: "1px solid #bbf7d0" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e" }} />Active
          </span>
        ) : (
          <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, background: "#f1f5f9", padding: "2px 10px", fontSize: 12, fontWeight: 700, color: "#64748b" }}>Inactive</span>
        )}
      </td>

      {/* Actions */}
      <td style={{ padding: "14px 16px" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
          {isEditing ? (
            <>
              <ActionBtn primary onClick={onUpdate} title="Save"><Check style={{ width: 14, height: 14 }} /></ActionBtn>
              <ActionBtn onClick={() => setEditId(null)} title="Cancel"><X style={{ width: 14, height: 14 }} /></ActionBtn>
            </>
          ) : canEdit ? (
            <>
              <ActionBtn
                onClick={() => {
                  setEditId(b.id);
                  setEditForm({
                    name: b.name, description: b.description ?? "",
                    locationId: b.location?.id ?? "", academicYear: b.academicYear,
                    startDate: b.startDate ? b.startDate.slice(0, 10) : "",
                    schoolId: b.school?.id ?? "", gradeId: b.grade?.id ?? "",
                  });
                }}
                title="Edit"
              >
                <Pencil style={{ width: 14, height: 14 }} />
              </ActionBtn>
              <ActionBtn onClick={onArchive} title={b.isArchived ? "Unarchive" : "Archive"}>
                {b.isArchived ? <ArchiveRestore style={{ width: 14, height: 14 }} /> : <Archive style={{ width: 14, height: 14 }} />}
              </ActionBtn>
              {b._count.students > 0 ? (
                <ActionBtn disabled title={`Cannot delete — ${b._count.students} student(s) assigned`}>
                  <Trash2 style={{ width: 14, height: 14 }} />
                </ActionBtn>
              ) : (
                <ActionBtn danger onClick={onDelete} title="Delete">
                  <Trash2 style={{ width: 14, height: 14 }} />
                </ActionBtn>
              )}
              <ChevronRight style={{ width: 16, height: 16, color: "#d1d5db", marginLeft: 4 }} />
            </>
          ) : (
            <ChevronRight style={{ width: 16, height: 16, color: "#d1d5db" }} />
          )}
        </div>
      </td>
    </tr>
  );
}
