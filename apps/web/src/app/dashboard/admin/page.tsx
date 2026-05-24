"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Check, X, RotateCcw, ChevronDown, Users, Play, CalendarDays, ToggleLeft, ToggleRight } from "lucide-react";
import { useAuthStore } from "@/store/auth";

// ── helpers ──────────────────────────────────────────────────────────────────
function Input({ className = "", ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${className}`}
    />
  );
}

const PERMS = ["canView", "canCreate", "canEdit", "canDelete", "canApprove"] as const;
const PERM_LABEL: Record<string, string> = { canView: "View", canCreate: "Create", canEdit: "Edit", canDelete: "Delete", canApprove: "Approve" };

type ModuleRow = { key: string; label: string; isHeader?: boolean; indent?: boolean };
const MODULE_ROWS: ModuleRow[] = [
  { key: "_EMP_HEADER",  label: "Employees",      isHeader: true },
  { key: "EMP_PROFILE",   label: "Profile",        indent: true },
  { key: "EMP_DOCUMENTS", label: "Documents",      indent: true },
  { key: "EMP_SALARY",    label: "Salary",         indent: true },
  { key: "EMP_BANK",      label: "Bank Details",   indent: true },
  { key: "EMP_LEAVES",    label: "Leaves",         indent: true },
  { key: "EMP_PAYOUT",    label: "Monthly Payout", indent: true },
  { key: "LEAVES",    label: "Leaves" },
  { key: "CLAIMS",    label: "Claims" },
  { key: "POLICIES",  label: "Policies" },
  { key: "TRAINING",  label: "Training" },
  { key: "_MIS_HEADER",        label: "MIS Reports",              isHeader: true },
  { key: "MIS_EMP_DIRECTORY",  label: "Employee Directory",       indent: true },
  { key: "MIS_SALARY_STRUCT",  label: "Salary Structures",        indent: true },
  { key: "MIS_SALARY_DISB",    label: "Monthly Salary Disbursement", indent: true },
  { key: "MIS_LEAVE_RECORDS",  label: "Leave Records",            indent: true },
  { key: "MIS_HOLIDAYS",       label: "Holidays List",            indent: true },
  { key: "MIS_CLAIMS",         label: "Claims Report",            indent: true },
  { key: "_ACA_HEADER",       label: "Academics",                isHeader: true },
  { key: "ACA_BATCH",         label: "Batches",                  indent: true },
  { key: "ACA_SUBJECT",       label: "Subjects",                 indent: true },
  { key: "STU_PROFILE",       label: "Students",                 indent: true },
  { key: "STU_ADMISSION",     label: "Admission",                indent: true },
  { key: "STU_ATTENDANCE",    label: "Attendance",               indent: true },
  { key: "STU_ASSIGNMENT",    label: "Assignments",              indent: true },
  { key: "STU_ASSESSMENT",    label: "Assessments",              indent: true },
  { key: "STU_TIMETABLE",     label: "Timetable",                indent: true },
  { key: "ADMIN",     label: "Admin" },
];
const ROLE_META: Record<string, { label: string; color: string; description: string }> = {
  SUPER_ADMIN: { label: "Super Admin",   color: "bg-red-100 text-red-700",    description: "Full system access. Cannot be restricted." },
  HR_ADMIN:    { label: "HR Admin",      color: "bg-purple-100 text-purple-700", description: "Manages employees, leaves, claims, and policies." },
  DEPT_HEAD:   { label: "Department Head", color: "bg-blue-100 text-blue-700", description: "Approves leaves and claims for their department." },
  EMPLOYEE:    { label: "Employee",      color: "bg-green-100 text-green-700", description: "Manages own leaves, claims and profile." },
};

// ── Departments Tab ──────────────────────────────────────────────────────────
function DepartmentsTab() {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", code: "" });
  const [editForm, setEditForm] = useState({ name: "", code: "" });

  const { data: departments, isLoading } = useQuery({
    queryKey: ["departments-admin"],
    queryFn: () => api.get("/api/v1/departments").then((r) => r.data.data),
  });

  const createMut = useMutation({
    mutationFn: () => api.post("/api/v1/departments", { name: form.name, code: form.code.toUpperCase() }),
    onSuccess: () => { toast.success("Department created"); setAdding(false); setForm({ name: "", code: "" }); qc.invalidateQueries({ queryKey: ["departments-admin"] }); qc.invalidateQueries({ queryKey: ["departments"] }); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });

  const updateMut = useMutation({
    mutationFn: (id: string) => api.patch(`/api/v1/departments/${id}`, { name: editForm.name, code: editForm.code.toUpperCase() }),
    onSuccess: () => { toast.success("Updated"); setEditId(null); qc.invalidateQueries({ queryKey: ["departments-admin"] }); qc.invalidateQueries({ queryKey: ["departments"] }); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/departments/${id}`),
    onSuccess: () => { toast.success("Department deleted"); qc.invalidateQueries({ queryKey: ["departments-admin"] }); qc.invalidateQueries({ queryKey: ["departments"] }); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Cannot delete"),
  });

  function startEdit(d: any) { setEditId(d.id); setEditForm({ name: d.name, code: d.code }); }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{departments?.length ?? 0} departments</p>
        <button
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white hover:opacity-90" style={{ backgroundColor: "#2C3E7C" }}
        >
          <Plus className="h-4 w-4" /> Add Department
        </button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Code</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Employees</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {/* Add row */}
            {adding && (
              <tr className="bg-blue-50">
                <td className="px-5 py-3">
                  <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Department name" autoFocus />
                </td>
                <td className="px-5 py-3">
                  <Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="CODE" className="font-mono uppercase" maxLength={10} />
                </td>
                <td className="px-5 py-3 text-sm text-gray-400">—</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2 justify-end">
                    <button onClick={() => createMut.mutate()} disabled={!form.name || !form.code || createMut.isPending} className="rounded-md px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60" style={{ backgroundColor: "#2C3E7C" }}>
                      {createMut.isPending ? "Saving…" : "Save"}
                    </button>
                    <button onClick={() => { setAdding(false); setForm({ name: "", code: "" }); }} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs hover:bg-gray-50">Cancel</button>
                  </div>
                </td>
              </tr>
            )}
            {isLoading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}><td colSpan={4} className="px-5 py-4"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td></tr>
                ))
              : departments?.map((d: any) => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-5 py-4">
                      {editId === d.id
                        ? <Input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} autoFocus />
                        : <span className="text-sm font-medium text-gray-900">{d.name}</span>
                      }
                    </td>
                    <td className="px-5 py-4">
                      {editId === d.id
                        ? <Input value={editForm.code} onChange={(e) => setEditForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} className="font-mono uppercase w-28" maxLength={10} />
                        : <span className="text-sm font-mono text-gray-500">{d.code}</span>
                      }
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-500">{d._count?.employees ?? 0}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 justify-end">
                        {editId === d.id ? (
                          <>
                            <button onClick={() => updateMut.mutate(d.id)} disabled={updateMut.isPending} className="rounded-md px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60" style={{ backgroundColor: "#2C3E7C" }}>
                              {updateMut.isPending ? "…" : <Check className="h-3.5 w-3.5" />}
                            </button>
                            <button onClick={() => setEditId(null)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs hover:bg-gray-50"><X className="h-3.5 w-3.5" /></button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => startEdit(d)} className="rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"><Pencil className="h-3.5 w-3.5" /></button>
                            <button
                              onClick={() => { if (confirm(`Delete "${d.name}"? This cannot be undone.`)) deleteMut.mutate(d.id); }}
                              disabled={deleteMut.isPending || (d._count?.employees ?? 0) > 0}
                              title={(d._count?.employees ?? 0) > 0 ? "Cannot delete — has active employees" : "Delete"}
                              className="rounded-lg border border-gray-200 p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Designations Tab ─────────────────────────────────────────────────────────
function DesignationsTab() {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", grade: "" });
  const [editForm, setEditForm] = useState({ title: "", grade: "" });

  const { data: designations, isLoading } = useQuery({
    queryKey: ["designations-admin"],
    queryFn: () => api.get("/api/v1/designations").then((r) => r.data.data),
  });

  const createMut = useMutation({
    mutationFn: () => api.post("/api/v1/designations", { title: form.title, grade: form.grade || undefined }),
    onSuccess: () => { toast.success("Designation created"); setAdding(false); setForm({ title: "", grade: "" }); qc.invalidateQueries({ queryKey: ["designations-admin"] }); qc.invalidateQueries({ queryKey: ["designations"] }); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });

  const updateMut = useMutation({
    mutationFn: (id: string) => api.patch(`/api/v1/designations/${id}`, { title: editForm.title, grade: editForm.grade || null }),
    onSuccess: () => { toast.success("Updated"); setEditId(null); qc.invalidateQueries({ queryKey: ["designations-admin"] }); qc.invalidateQueries({ queryKey: ["designations"] }); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/designations/${id}`),
    onSuccess: () => { toast.success("Designation deleted"); qc.invalidateQueries({ queryKey: ["designations-admin"] }); qc.invalidateQueries({ queryKey: ["designations"] }); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Cannot delete"),
  });

  function startEdit(d: any) { setEditId(d.id); setEditForm({ title: d.title, grade: d.grade ?? "" }); }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{designations?.length ?? 0} designations</p>
        <button
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white hover:opacity-90" style={{ backgroundColor: "#2C3E7C" }}
        >
          <Plus className="h-4 w-4" /> Add Designation
        </button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Title</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Grade</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Employees</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {adding && (
              <tr className="bg-blue-50">
                <td className="px-5 py-3">
                  <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Designation title" autoFocus />
                </td>
                <td className="px-5 py-3">
                  <Input value={form.grade} onChange={(e) => setForm((f) => ({ ...f, grade: e.target.value }))} placeholder="e.g. L1, Senior" className="w-28" />
                </td>
                <td className="px-5 py-3 text-sm text-gray-400">—</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2 justify-end">
                    <button onClick={() => createMut.mutate()} disabled={!form.title || createMut.isPending} className="rounded-md px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60" style={{ backgroundColor: "#2C3E7C" }}>
                      {createMut.isPending ? "Saving…" : "Save"}
                    </button>
                    <button onClick={() => { setAdding(false); setForm({ title: "", grade: "" }); }} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs hover:bg-gray-50">Cancel</button>
                  </div>
                </td>
              </tr>
            )}
            {isLoading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}><td colSpan={4} className="px-5 py-4"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td></tr>
                ))
              : designations?.map((d: any) => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-5 py-4">
                      {editId === d.id
                        ? <Input value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} autoFocus />
                        : <span className="text-sm font-medium text-gray-900">{d.title}</span>
                      }
                    </td>
                    <td className="px-5 py-4">
                      {editId === d.id
                        ? <Input value={editForm.grade} onChange={(e) => setEditForm((f) => ({ ...f, grade: e.target.value }))} className="w-28" placeholder="Optional" />
                        : <span className="text-sm text-gray-500">{d.grade ?? "—"}</span>
                      }
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-500">{d._count?.employees ?? 0}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 justify-end">
                        {editId === d.id ? (
                          <>
                            <button onClick={() => updateMut.mutate(d.id)} disabled={updateMut.isPending} className="rounded-md px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60" style={{ backgroundColor: "#2C3E7C" }}>
                              {updateMut.isPending ? "…" : <Check className="h-3.5 w-3.5" />}
                            </button>
                            <button onClick={() => setEditId(null)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs hover:bg-gray-50"><X className="h-3.5 w-3.5" /></button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => startEdit(d)} className="rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"><Pencil className="h-3.5 w-3.5" /></button>
                            <button
                              onClick={() => { if (confirm(`Delete "${d.title}"?`)) deleteMut.mutate(d.id); }}
                              disabled={deleteMut.isPending || (d._count?.employees ?? 0) > 0}
                              title={(d._count?.employees ?? 0) > 0 ? "Cannot delete — has active employees" : "Delete"}
                              className="rounded-lg border border-gray-200 p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Roles & Permissions Tab ──────────────────────────────────────────────────
function RolesTab({ isSA }: { isSA: boolean }) {
  const qc = useQueryClient();
  const [expandedRole, setExpandedRole] = useState<string | null>("HR_ADMIN");
  const [bulkPending, setBulkPending] = useState(false);

  const { data: permissions, isLoading } = useQuery({
    queryKey: ["role-permissions"],
    queryFn: () => api.get("/api/v1/roles").then((r) => r.data.data),
  });

  const { data: customRoles = [] } = useQuery<any[]>({
    queryKey: ["custom-roles"],
    queryFn: () => api.get("/api/v1/roles/custom").then((r) => r.data.data),
  });

  const updateMut = useMutation({
    mutationFn: ({ role, module, perms }: { role: string; module: string; perms: Record<string, boolean> }) =>
      api.put(`/api/v1/roles/${role}/${module}`, perms),
    onSuccess: () => { toast.success("Permissions updated"); qc.invalidateQueries({ queryKey: ["role-permissions"] }); qc.invalidateQueries({ queryKey: ["my-permissions"] }); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });

  const seedMut = useMutation({
    mutationFn: () => api.post("/api/v1/roles/seed"),
    onSuccess: () => { toast.success("Permissions reset to defaults"); qc.invalidateQueries({ queryKey: ["role-permissions"] }); qc.invalidateQueries({ queryKey: ["my-permissions"] }); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });

  // Build map: role -> module -> permissions
  const permMap: Record<string, Record<string, Record<string, boolean>>> = {};
  for (const p of (permissions ?? [])) {
    if (!permMap[p.role]) permMap[p.role] = {};
    permMap[p.role][p.module] = p;
  }

  function togglePerm(role: string, module: string, perm: string, current: boolean) {
    if (!isSA || role === "SUPER_ADMIN") return;
    const existing = permMap[role]?.[module] ?? {};
    const updated = { ...existing, [perm]: !current };
    const payload = {
      canView:     updated.canView     ?? false,
      canCreate:   updated.canCreate   ?? false,
      canEdit:     updated.canEdit     ?? false,
      canDelete:   updated.canDelete   ?? false,
      canApprove:  updated.canApprove  ?? false,
      canAppraise: updated.canAppraise ?? false,
    };
    updateMut.mutate({ role, module, perms: payload });
  }

  async function toggleColumn(role: string, perm: string) {
    if (!isSA || role === "SUPER_ADMIN" || bulkPending) return;
    const dataRows = MODULE_ROWS.filter((r) => !r.isHeader);
    const allChecked = dataRows.every((row) => permMap[role]?.[row.key]?.[perm] ?? false);
    const setTo = !allChecked;
    setBulkPending(true);
    try {
      await Promise.all(dataRows.map((row) => {
        const ex = permMap[role]?.[row.key] ?? {};
        return api.put(`/api/v1/roles/${role}/${row.key}`, {
          canView: ex.canView ?? false, canCreate: ex.canCreate ?? false,
          canEdit: ex.canEdit ?? false, canDelete: ex.canDelete ?? false,
          canApprove: ex.canApprove ?? false, canAppraise: ex.canAppraise ?? false,
          [perm]: setTo,
        });
      }));
      toast.success(`${PERM_LABEL[perm]} ${setTo ? "enabled" : "disabled"} for all modules`);
      qc.invalidateQueries({ queryKey: ["role-permissions"] });
      qc.invalidateQueries({ queryKey: ["my-permissions"] });
    } catch { toast.error("Failed to update permissions"); }
    finally { setBulkPending(false); }
  }

  async function toggleRow(role: string, module: string) {
    if (!isSA || role === "SUPER_ADMIN" || bulkPending) return;
    const ex = permMap[role]?.[module] ?? {};
    const allChecked = PERMS.every((p) => ex[p] ?? false);
    const setTo = !allChecked;
    setBulkPending(true);
    try {
      await api.put(`/api/v1/roles/${role}/${module}`, {
        canView: setTo, canCreate: setTo, canEdit: setTo,
        canDelete: setTo, canApprove: setTo, canAppraise: setTo,
      });
      toast.success(`All permissions ${setTo ? "enabled" : "disabled"}`);
      qc.invalidateQueries({ queryKey: ["role-permissions"] });
      qc.invalidateQueries({ queryKey: ["my-permissions"] });
    } catch { toast.error("Failed to update permissions"); }
    finally { setBulkPending(false); }
  }

  async function toggleAll(role: string) {
    if (!isSA || role === "SUPER_ADMIN" || bulkPending) return;
    const dataRows = MODULE_ROWS.filter((r) => !r.isHeader);
    const allChecked = dataRows.every((row) => PERMS.every((p) => permMap[role]?.[row.key]?.[p] ?? false));
    const setTo = !allChecked;
    setBulkPending(true);
    try {
      await Promise.all(dataRows.map((row) =>
        api.put(`/api/v1/roles/${role}/${row.key}`, {
          canView: setTo, canCreate: setTo, canEdit: setTo,
          canDelete: setTo, canApprove: setTo, canAppraise: setTo,
        })
      ));
      toast.success(`All permissions ${setTo ? "enabled" : "disabled"}`);
      qc.invalidateQueries({ queryKey: ["role-permissions"] });
      qc.invalidateQueries({ queryKey: ["my-permissions"] });
    } catch { toast.error("Failed to update permissions"); }
    finally { setBulkPending(false); }
  }

  function colAllChecked(role: string, perm: string) {
    return MODULE_ROWS.filter((r) => !r.isHeader).every((row) => permMap[role]?.[row.key]?.[perm] ?? false);
  }
  function colSomeChecked(role: string, perm: string) {
    return MODULE_ROWS.filter((r) => !r.isHeader).some((row) => permMap[role]?.[row.key]?.[perm] ?? false);
  }
  function masterAllChecked(role: string) {
    return MODULE_ROWS.filter((r) => !r.isHeader).every((row) => PERMS.every((p) => permMap[role]?.[row.key]?.[p] ?? false));
  }
  function masterSomeChecked(role: string) {
    return MODULE_ROWS.filter((r) => !r.isHeader).some((row) => PERMS.some((p) => permMap[role]?.[row.key]?.[p] ?? false));
  }

  const SYSTEM_ROLE_ORDER = ["SUPER_ADMIN", "HR_ADMIN", "DEPT_HEAD", "EMPLOYEE"];
  const COLS = PERMS.length;
  const allRoles = [
    ...SYSTEM_ROLE_ORDER.map((r) => ({ name: r, label: ROLE_META[r].label, color: ROLE_META[r].color, description: ROLE_META[r].description, isCustom: false })),
    ...(customRoles as any[]).map((r) => ({ name: r.name, label: r.label, color: "bg-orange-100 text-orange-700", description: `Custom role · ${r.deptAccess.length} dept${r.deptAccess.length !== 1 ? "s" : ""}`, isCustom: true })),
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Configure what each role can do across modules.</p>
        {isSA && (
          <button
            onClick={() => { if (confirm("Reset all permissions to system defaults?")) seedMut.mutate(); }}
            disabled={seedMut.isPending}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            <RotateCcw className="h-4 w-4" /> Reset to Defaults
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl border border-gray-200 bg-white animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {allRoles.map(({ name: role, label, color, description, isCustom }) => {
            const isLocked = role === "SUPER_ADMIN";
            const isOpen = expandedRole === role;

            return (
              <div key={role} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                {/* Role header */}
                <button
                  onClick={() => setExpandedRole(isOpen ? null : role)}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors text-left"
                >
                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${color}`}>
                    {label}
                  </span>
                  <span className="text-sm text-gray-500 flex-1">{description}</span>
                  {isCustom && <span className="text-xs text-orange-500 font-medium">Custom</span>}
                  {isLocked && <span className="text-xs text-gray-400 italic">Locked</span>}
                  <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>

                {/* Permission matrix */}
                {isOpen && (
                  <div className="border-t border-gray-100 overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider w-32">
                            <div className="flex items-center gap-2">
                              <span>Module</span>
                              {isSA && !isLocked && (
                                <button
                                  onClick={() => toggleAll(role)}
                                  disabled={bulkPending}
                                  title={masterAllChecked(role) ? "Deselect all" : "Select all"}
                                  className={`h-4 w-4 rounded flex items-center justify-center transition-colors disabled:opacity-50 ${
                                    masterAllChecked(role) ? "bg-blue-600 text-white" : masterSomeChecked(role) ? "bg-blue-200 text-blue-600 border border-blue-300" : "border-2 border-gray-300 text-transparent"
                                  }`}
                                >
                                  <Check className="h-2.5 w-2.5" />
                                </button>
                              )}
                            </div>
                          </th>
                          {PERMS.map((p) => (
                            <th key={p} className="px-4 py-2.5 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                              <div className="flex flex-col items-center gap-1">
                                <span>{PERM_LABEL[p]}</span>
                                {isSA && !isLocked && (
                                  <button
                                    onClick={() => toggleColumn(role, p)}
                                    disabled={bulkPending}
                                    title={colAllChecked(role, p) ? `Deselect all ${PERM_LABEL[p]}` : `Select all ${PERM_LABEL[p]}`}
                                    className={`h-4 w-4 rounded flex items-center justify-center transition-colors disabled:opacity-50 ${
                                      colAllChecked(role, p) ? "bg-blue-600 text-white" : colSomeChecked(role, p) ? "bg-blue-200 text-blue-600 border border-blue-300" : "border-2 border-gray-300 text-transparent"
                                    }`}
                                  >
                                    <Check className="h-2.5 w-2.5" />
                                  </button>
                                )}
                              </div>
                            </th>
                          ))}
                          {isSA && !isLocked && <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">All</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {MODULE_ROWS.map((row) => {
                          if (row.isHeader) {
                            return (
                              <tr key={row.key} className="bg-gray-50">
                                <td
                                  colSpan={COLS + (isSA && !isLocked ? 2 : 1)}
                                  className="px-5 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider"
                                >
                                  {row.label}
                                </td>
                              </tr>
                            );
                          }
                          const mp = permMap[role]?.[row.key] ?? {};
                          const rowAllChecked = PERMS.every((p) => mp[p] ?? false);
                          const rowSomeChecked = PERMS.some((p) => mp[p] ?? false);
                          return (
                            <tr key={row.key} className="hover:bg-gray-50">
                              <td className={`py-3 text-sm font-medium text-gray-700 ${row.indent ? "pl-8 pr-3" : "px-5"}`}>
                                {row.indent && <span className="text-gray-300 mr-1.5">└</span>}
                                {row.label}
                              </td>
                              {PERMS.map((perm) => {
                                const val = mp[perm] ?? false;
                                const canToggle = isSA && !isLocked;
                                return (
                                  <td key={perm} className="px-4 py-3 text-center">
                                    <button
                                      onClick={() => togglePerm(role, row.key, perm, val)}
                                      disabled={!canToggle || updateMut.isPending || bulkPending}
                                      className={`h-5 w-5 rounded flex items-center justify-center mx-auto transition-colors ${
                                        val
                                          ? "bg-blue-600 text-white"
                                          : "border-2 border-gray-200 text-transparent"
                                      } ${canToggle ? "cursor-pointer hover:opacity-80" : "cursor-default"}`}
                                    >
                                      <Check className="h-3 w-3" />
                                    </button>
                                  </td>
                                );
                              })}
                              {isSA && !isLocked && (
                                <td className="px-3 py-3 text-center">
                                  <button
                                    onClick={() => toggleRow(role, row.key)}
                                    disabled={bulkPending}
                                    title={rowAllChecked ? "Deselect all" : "Select all"}
                                    className={`h-5 w-5 rounded flex items-center justify-center mx-auto transition-colors disabled:opacity-50 ${
                                      rowAllChecked ? "bg-blue-600 text-white" : rowSomeChecked ? "bg-blue-200 text-blue-600 border border-blue-300" : "border-2 border-gray-300 text-transparent"
                                    } cursor-pointer hover:opacity-80`}
                                  >
                                    <Check className="h-3 w-3" />
                                  </button>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Leave Policies Tab ────────────────────────────────────────────────────────

const ALL_LEAVE_TYPES = [
  "CASUAL", "SICK", "EARNED", "MATERNITY", "PATERNITY",
  "COMPENSATORY", "UNPAID", "SPECIAL",
] as const;

const LEAVE_LABEL: Record<string, string> = {
  CASUAL: "Casual", SICK: "Sick", EARNED: "Earned / PL", MATERNITY: "Maternity",
  PATERNITY: "Paternity", COMPENSATORY: "Compensatory", UNPAID: "Unpaid / LOP", SPECIAL: "Special",
};

type LeaveRule = { leaveType: string; daysPerYear: number; maxCarryForward: number };
type PolicyForm = { name: string; description: string; isActive: boolean; rules: LeaveRule[]; grades: string[] };

const BLANK_FORM: PolicyForm = {
  name: "", description: "", isActive: true,
  rules: ALL_LEAVE_TYPES.map((lt) => ({ leaveType: lt, daysPerYear: 0, maxCarryForward: 0 })),
  grades: [],
};

function LeavePoliciesTab() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null); // policy id or "new"
  const [form, setForm] = useState<PolicyForm>(BLANK_FORM);
  const [applyYear, setApplyYear] = useState(new Date().getFullYear());
  const [applyingId, setApplyingId] = useState<string | null>(null);

  const { data: policies, isLoading } = useQuery({
    queryKey: ["leave-policies"],
    queryFn: () => api.get("/api/v1/leave-policies").then((r) => r.data.data),
  });

  const { data: availableGrades } = useQuery({
    queryKey: ["designation-grades"],
    queryFn: () => api.get("/api/v1/leave-policies/grades").then((r) => r.data.data as string[]),
  });

  const saveMut = useMutation({
    mutationFn: () => editing === "new"
      ? api.post("/api/v1/leave-policies", { ...form, rules: form.rules.filter((r) => r.daysPerYear > 0) })
      : api.put(`/api/v1/leave-policies/${editing}`, { ...form, rules: form.rules.filter((r) => r.daysPerYear > 0) }),
    onSuccess: () => {
      toast.success(editing === "new" ? "Policy created" : "Policy updated");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["leave-policies"] });
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/leave-policies/${id}`),
    onSuccess: () => { toast.success("Policy deleted"); qc.invalidateQueries({ queryKey: ["leave-policies"] }); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Cannot delete"),
  });

  const toggleMut = useMutation({
    mutationFn: (id: string) => api.patch(`/api/v1/leave-policies/${id}/toggle`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leave-policies"] }),
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });

  const applyMut = useMutation({
    mutationFn: ({ id, year }: { id: string; year: number }) =>
      api.post(`/api/v1/leave-policies/${id}/apply`, { year }),
    onSuccess: (res) => {
      toast.success(res.data.message ?? "Applied successfully");
      setApplyingId(null);
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed to apply"),
  });

  function startNew() {
    setForm(BLANK_FORM);
    setEditing("new");
  }

  function startEdit(p: any) {
    // Merge stored rules into the full leave-type grid
    const rulesMap: Record<string, LeaveRule> = {};
    for (const r of (p.rules ?? [])) rulesMap[r.leaveType] = r;
    setForm({
      name: p.name,
      description: p.description ?? "",
      isActive: p.isActive,
      rules: ALL_LEAVE_TYPES.map((lt) => rulesMap[lt] ?? { leaveType: lt, daysPerYear: 0, maxCarryForward: 0 }),
      grades: (p.grades ?? []).map((g: any) => g.grade),
    });
    setEditing(p.id);
  }

  function updateRule(idx: number, field: keyof LeaveRule, val: number) {
    setForm((f) => {
      const rules = [...f.rules];
      rules[idx] = { ...rules[idx], [field]: val };
      return { ...f, rules };
    });
  }

  function toggleGrade(grade: string) {
    setForm((f) => ({
      ...f,
      grades: f.grades.includes(grade) ? f.grades.filter((g) => g !== grade) : [...f.grades, grade],
    }));
  }

  const activeRules = form.rules.filter((r) => r.daysPerYear > 0);

  if (editing) {
    return (
      <div className="space-y-6 max-w-3xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              {editing === "new" ? "New Leave Policy" : "Edit Leave Policy"}
            </h2>
            <p className="text-sm text-gray-400 mt-0.5">Define leave entitlements and assign to grades.</p>
          </div>
          <button onClick={() => setEditing(null)} className="text-sm text-gray-500 hover:text-gray-700">← Back</button>
        </div>

        {/* Basic info */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Policy Details</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">Policy Name *</label>
              <Input
                placeholder="e.g. Faculty Grade A Policy"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">Description</label>
              <Input
                placeholder="Optional description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox" id="isActive" checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                className="rounded"
              />
              <label htmlFor="isActive" className="text-sm text-gray-700">Active (applies to employees)</label>
            </div>
          </div>
        </div>

        {/* Leave allocations */}
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Leave Allocations</h3>
            <p className="text-xs text-gray-400 mt-0.5">Set days per year. Leave types with 0 days are excluded.</p>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase">Leave Type</th>
                <th className="px-5 py-2.5 text-center text-xs font-semibold text-gray-400 uppercase">Days / Year</th>
                <th className="px-5 py-2.5 text-center text-xs font-semibold text-gray-400 uppercase">Max Carry Forward</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {form.rules.map((rule, idx) => (
                <tr key={rule.leaveType} className={rule.daysPerYear > 0 ? "bg-blue-50/30" : ""}>
                  <td className="px-5 py-2.5 text-sm font-medium text-gray-700">
                    {LEAVE_LABEL[rule.leaveType]}
                  </td>
                  <td className="px-5 py-2.5 text-center">
                    <input
                      type="number" min={0} step={0.5}
                      value={rule.daysPerYear}
                      onChange={(e) => updateRule(idx, "daysPerYear", parseFloat(e.target.value) || 0)}
                      className="w-20 text-center rounded-lg border border-gray-200 px-2 py-1 text-sm focus:border-blue-400 focus:outline-none"
                    />
                  </td>
                  <td className="px-5 py-2.5 text-center">
                    <input
                      type="number" min={0} step={0.5}
                      value={rule.maxCarryForward}
                      onChange={(e) => updateRule(idx, "maxCarryForward", parseFloat(e.target.value) || 0)}
                      disabled={rule.daysPerYear === 0}
                      className="w-20 text-center rounded-lg border border-gray-200 px-2 py-1 text-sm focus:border-blue-400 focus:outline-none disabled:opacity-40 disabled:bg-gray-50"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {activeRules.length > 0 && (
            <div className="px-5 py-2 bg-blue-50 border-t border-blue-100 text-xs text-blue-700">
              Total: {activeRules.reduce((s, r) => s + r.daysPerYear, 0)} days across {activeRules.length} leave type{activeRules.length !== 1 ? "s" : ""}
            </div>
          )}
        </div>

        {/* Grade assignment */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Applicable Grades</h3>
          <p className="text-xs text-gray-400">Select the designation grades this policy applies to. Grades come from Designations.</p>
          {!availableGrades?.length ? (
            <p className="text-sm text-gray-400 italic">No grades defined yet. Add grades to designations first.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {availableGrades.map((grade) => {
                const selected = form.grades.includes(grade);
                return (
                  <button
                    key={grade}
                    type="button"
                    onClick={() => toggleGrade(grade)}
                    className={`rounded-full px-3 py-1 text-sm font-medium border transition-colors ${
                      selected
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-600 border-gray-200 hover:border-blue-400"
                    }`}
                  >
                    {selected && <Check className="inline h-3 w-3 mr-1" />}Grade {grade}
                  </button>
                );
              })}
            </div>
          )}
          {form.grades.length > 0 && (
            <p className="text-xs text-blue-700 bg-blue-50 rounded px-3 py-1.5">
              Policy will apply to employees with grade: {form.grades.sort().join(", ")}
            </p>
          )}
        </div>

        {/* Save */}
        <div className="flex gap-3">
          <button
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending || !form.name || activeRules.length === 0 || form.grades.length === 0}
            className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60" style={{ backgroundColor: "#2C3E7C" }}
          >
            {saveMut.isPending ? "Saving…" : editing === "new" ? "Create Policy" : "Save Changes"}
          </button>
          <button onClick={() => setEditing(null)} className="text-sm text-gray-500 hover:text-gray-700 px-3">Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {policies?.length ?? 0} polic{policies?.length === 1 ? "y" : "ies"} — define leave entitlements per grade and apply to employees.
        </p>
        <button
          onClick={startNew}
          className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white hover:opacity-90" style={{ backgroundColor: "#2C3E7C" }}
        >
          <Plus className="h-4 w-4" /> New Policy
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => <div key={i} className="h-20 rounded-xl border border-gray-200 bg-white animate-pulse" />)}
        </div>
      ) : !policies?.length ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white py-16 text-center">
          <CalendarDays className="h-8 w-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500">No leave policies yet</p>
          <p className="text-xs text-gray-400 mt-1">Create a policy to define leave entitlements for each grade.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(policies as any[]).map((policy) => (
            <div key={policy.id} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              {/* Policy header */}
              <div className="flex items-center gap-4 px-5 py-4 border-b border-gray-100">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-900 text-sm">{policy.name}</h3>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      policy.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                    }`}>
                      {policy.isActive ? "Active" : "Inactive"}
                    </span>
                    {policy.grades?.map((g: any) => (
                      <span key={g.grade} className="rounded-full bg-blue-100 text-blue-700 px-2 py-0.5 text-xs font-medium">
                        Grade {g.grade}
                      </span>
                    ))}
                  </div>
                  {policy.description && <p className="text-xs text-gray-400 mt-0.5">{policy.description}</p>}
                  <div className="flex items-center gap-1.5 mt-1">
                    <Users className="h-3.5 w-3.5 text-gray-400" />
                    <span className="text-xs text-gray-400">{policy.employeeCount ?? 0} employee{policy.employeeCount !== 1 ? "s" : ""} covered</span>
                    <span className="text-gray-300 mx-1">·</span>
                    <span className="text-xs text-gray-400">
                      {(policy.rules ?? []).filter((r: any) => r.daysPerYear > 0).length} leave types ·{" "}
                      {(policy.rules ?? []).reduce((s: number, r: any) => s + r.daysPerYear, 0)} days total
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {/* Apply button */}
                  {applyingId === policy.id ? (
                    <div className="flex items-center gap-2">
                      <select
                        value={applyYear}
                        onChange={(e) => setApplyYear(parseInt(e.target.value))}
                        className="rounded-lg border border-gray-200 px-2 py-1 text-sm focus:outline-none"
                      >
                        {[new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1].map((y) => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => applyMut.mutate({ id: policy.id, year: applyYear })}
                        disabled={applyMut.isPending}
                        className="rounded-md px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60 inline-flex items-center gap-1" style={{ backgroundColor: "#2C3E7C" }}
                      >
                        <Play className="h-3 w-3" /> {applyMut.isPending ? "Applying…" : "Apply"}
                      </button>
                      <button onClick={() => setApplyingId(null)} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setApplyingId(policy.id)}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 inline-flex items-center gap-1.5"
                    >
                      <Play className="h-3.5 w-3.5" /> Apply to Employees
                    </button>
                  )}
                  <button
                    onClick={() => toggleMut.mutate(policy.id)}
                    disabled={toggleMut.isPending}
                    title={policy.isActive ? "Deactivate" : "Activate"}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-blue-600 hover:border-blue-300 disabled:opacity-50"
                  >
                    {policy.isActive ? <ToggleRight className="h-4 w-4 text-green-600" /> : <ToggleLeft className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => startEdit(policy)}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-blue-600 hover:border-blue-300"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => { if (confirm(`Delete "${policy.name}"?`)) deleteMut.mutate(policy.id); }}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Leave type grid */}
              {policy.rules?.filter((r: any) => r.daysPerYear > 0).length > 0 && (
                <div className="px-5 py-3 grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {(policy.rules as any[]).filter((r) => r.daysPerYear > 0).map((rule) => (
                    <div key={rule.leaveType} className="rounded-lg bg-gray-50 px-3 py-2 text-center">
                      <p className="text-xs text-gray-400 leading-tight">{LEAVE_LABEL[rule.leaveType]}</p>
                      <p className="text-lg font-bold text-gray-900 mt-0.5">{rule.daysPerYear}</p>
                      <p className="text-xs text-gray-400">days</p>
                      {rule.maxCarryForward > 0 && (
                        <p className="text-xs text-blue-500 mt-0.5">↻ {rule.maxCarryForward}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Custom Roles Tab ──────────────────────────────────────────────────────────
function CustomRolesTab() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [form, setForm] = useState({ label: "", name: "", departmentIds: [] as string[] });
  const [editForm, setEditForm] = useState({ label: "", departmentIds: [] as string[] });

  const { data: customRoles = [], isLoading } = useQuery<any[]>({
    queryKey: ["custom-roles"],
    queryFn: () => api.get("/api/v1/roles/custom").then((r) => r.data.data),
  });

  const { data: departments = [] } = useQuery<any[]>({
    queryKey: ["departments-admin"],
    queryFn: () => api.get("/api/v1/departments").then((r) => r.data.data),
  });

  const createMut = useMutation({
    mutationFn: () => api.post("/api/v1/roles/custom", {
      name: form.name,
      label: form.label,
      departmentIds: form.departmentIds,
    }),
    onSuccess: () => {
      toast.success("Role created");
      qc.invalidateQueries({ queryKey: ["custom-roles"] });
      qc.invalidateQueries({ queryKey: ["role-permissions"] });
      setShowCreate(false);
      setForm({ label: "", name: "", departmentIds: [] });
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });

  const updateMut = useMutation({
    mutationFn: (name: string) => api.patch(`/api/v1/roles/custom/${name}`, {
      label: editForm.label,
      departmentIds: editForm.departmentIds,
    }),
    onSuccess: () => {
      toast.success("Role updated");
      qc.invalidateQueries({ queryKey: ["custom-roles"] });
      setEditingName(null);
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });

  const deleteMut = useMutation({
    mutationFn: (name: string) => api.delete(`/api/v1/roles/custom/${name}`),
    onSuccess: () => {
      toast.success("Role deleted");
      qc.invalidateQueries({ queryKey: ["custom-roles"] });
      qc.invalidateQueries({ queryKey: ["role-permissions"] });
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });

  function labelToName(label: string) {
    return label.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");
  }

  function startEdit(role: any) {
    setEditingName(role.name);
    setEditForm({
      label: role.label,
      departmentIds: role.deptAccess.map((d: any) => d.departmentId),
    });
  }

  function DeptMultiSelect({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
    function toggle(id: string) {
      onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
    }
    return (
      <div className="grid grid-cols-2 gap-1.5 mt-1">
        {(departments as any[]).map((d) => (
          <label key={d.id} className={`flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer text-sm transition-colors ${
            value.includes(d.id) ? "border-blue-400 bg-blue-50 text-blue-800" : "border-gray-200 text-gray-600 hover:border-gray-300"
          }`}>
            <input type="checkbox" className="hidden" checked={value.includes(d.id)} onChange={() => toggle(d.id)} />
            <span className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${value.includes(d.id) ? "bg-blue-500 border-blue-500" : "border-gray-300"}`}>
              {value.includes(d.id) && <Check className="h-2.5 w-2.5 text-white" />}
            </span>
            {d.name}
          </label>
        ))}
      </div>
    );
  }

  const deptMap = Object.fromEntries((departments as any[]).map((d) => [d.id, d.name]));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{customRoles.length} custom role{customRoles.length !== 1 ? "s" : ""}</p>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white hover:opacity-90" style={{ backgroundColor: "#2C3E7C" }}
        >
          <Plus className="h-4 w-4" /> New Role
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-800">Create Custom Role</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Display Name</label>
              <Input
                autoFocus
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value, name: labelToName(e.target.value) }))}
                placeholder="e.g. Finance Head"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Role Key <span className="text-gray-400 normal-case font-normal">(auto-generated)</span></label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "") }))}
                placeholder="FINANCE_HEAD"
                className="mt-1 font-mono"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Department Access</label>
            <p className="text-xs text-gray-400 mt-0.5 mb-2">This role can view employees from the selected departments.</p>
            <DeptMultiSelect value={form.departmentIds} onChange={(ids) => setForm((f) => ({ ...f, departmentIds: ids }))} />
          </div>
          <div className="flex gap-3 pt-1">
            <button
              onClick={() => createMut.mutate()}
              disabled={!form.label || !form.name || form.departmentIds.length === 0 || createMut.isPending}
              className="rounded-md px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60" style={{ backgroundColor: "#2C3E7C" }}
            >
              {createMut.isPending ? "Creating…" : "Create Role"}
            </button>
            <button
              onClick={() => { setShowCreate(false); setForm({ label: "", name: "", departmentIds: [] }); }}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Role list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => <div key={i} className="h-20 rounded-xl border border-gray-200 bg-white animate-pulse" />)}
        </div>
      ) : customRoles.length === 0 && !showCreate ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white py-16 text-center">
          <Users className="h-8 w-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500">No custom roles yet</p>
          <p className="text-xs text-gray-400 mt-1">Create a role to define cross-department access for specific positions.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {customRoles.map((role: any) => (
            <div key={role.name} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              {editingName === role.name ? (
                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Display Name</label>
                      <Input value={editForm.label} onChange={(e) => setEditForm((f) => ({ ...f, label: e.target.value }))} className="mt-1" autoFocus />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Role Key</label>
                      <Input value={role.name} disabled className="mt-1 font-mono bg-gray-50 text-gray-400" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Department Access</label>
                    <DeptMultiSelect value={editForm.departmentIds} onChange={(ids) => setEditForm((f) => ({ ...f, departmentIds: ids }))} />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => updateMut.mutate(role.name)}
                      disabled={!editForm.label || editForm.departmentIds.length === 0 || updateMut.isPending}
                      className="rounded-md px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60" style={{ backgroundColor: "#2C3E7C" }}
                    >
                      {updateMut.isPending ? "Saving…" : "Save Changes"}
                    </button>
                    <button onClick={() => setEditingName(null)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4 px-5 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 text-sm">{role.label}</span>
                      <span className="font-mono text-xs text-gray-400 bg-gray-100 rounded px-1.5 py-0.5">{role.name}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {role.deptAccess.map((d: any) => (
                        <span key={d.departmentId} className="rounded-full bg-blue-100 text-blue-700 px-2.5 py-0.5 text-xs font-medium">
                          {deptMap[d.departmentId] ?? d.departmentId}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => startEdit(role)} className="rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-100">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => { if (confirm(`Delete role "${role.label}"? Employees with this role will lose access.`)) deleteMut.mutate(role.name); }}
                      disabled={deleteMut.isPending}
                      className="rounded-lg border border-gray-200 p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
        After creating a role, go to <strong>Roles &amp; Permissions</strong> to configure what this role can view, edit, approve, etc.
        Department access here only controls which employees they can see — module permissions are set separately.
      </div>
    </div>
  );
}

// ── Work Locations Tab ────────────────────────────────────────────────────────
function WorkLocationsTab() {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");

  const { data: locations, isLoading } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["work-locations"],
    queryFn: () => api.get("/api/v1/work-locations").then((r) => r.data.data),
  });

  const addMutation = useMutation({
    mutationFn: (name: string) => api.post("/api/v1/work-locations", { name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["work-locations"] });
      setNewName("");
      setAdding(false);
      toast.success("Work location added");
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/work-locations/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["work-locations"] });
      toast.success("Work location removed");
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });

  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">Work Locations</h2>
          <p className="text-xs text-gray-400 mt-0.5">Locations available in the employee creation form.</p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-white hover:opacity-90" style={{ backgroundColor: "#2C3E7C" }}
        >
          <Plus className="h-3.5 w-3.5" /> Add Location
        </button>
      </div>

      {adding && (
        <div className="flex items-center gap-2 px-5 py-3 border-b border-blue-100 bg-blue-50">
          <Input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Hyderabad"
            className="max-w-xs"
            onKeyDown={(e) => {
              if (e.key === "Enter") addMutation.mutate(newName.trim());
              if (e.key === "Escape") { setAdding(false); setNewName(""); }
            }}
          />
          <button
            onClick={() => addMutation.mutate(newName.trim())}
            disabled={!newName.trim() || addMutation.isPending}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60" style={{ backgroundColor: "#2C3E7C" }}
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => { setAdding(false); setNewName(""); }} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {isLoading ? (
        <p className="px-5 py-6 text-sm text-gray-400">Loading…</p>
      ) : !locations?.length ? (
        <p className="px-5 py-6 text-sm text-gray-400">No work locations configured.</p>
      ) : (
        <ul className="divide-y divide-gray-50">
          {locations.map((loc) => (
            <li key={loc.id} className="flex items-center justify-between px-5 py-3">
              <span className="text-sm text-gray-700">{loc.name}</span>
              <button
                onClick={() => deleteMutation.mutate(loc.id)}
                disabled={deleteMutation.isPending}
                className="text-gray-300 hover:text-red-500 transition-colors disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Claim Types Tab ───────────────────────────────────────────────────────────

function ClaimTypesTab() {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ label: "" });
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ label: "" });

  const { data: types = [], isLoading } = useQuery<any[]>({
    queryKey: ["claim-types-admin"],
    queryFn: () => api.get("/api/v1/claim-types/all").then((r) => r.data.data),
  });

  const createMut = useMutation({
    mutationFn: () => api.post("/api/v1/claim-types", form),
    onSuccess: () => {
      toast.success("Claim type created");
      setAdding(false);
      setForm({ label: "" });
      qc.invalidateQueries({ queryKey: ["claim-types-admin"] });
      qc.invalidateQueries({ queryKey: ["claim-types"] });
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });

  const updateMut = useMutation({
    mutationFn: (id: string) => api.patch(`/api/v1/claim-types/${id}`, editForm),
    onSuccess: () => {
      toast.success("Updated");
      setEditId(null);
      qc.invalidateQueries({ queryKey: ["claim-types-admin"] });
      qc.invalidateQueries({ queryKey: ["claim-types"] });
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/api/v1/claim-types/${id}`, { isActive }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["claim-types-admin"] });
      qc.invalidateQueries({ queryKey: ["claim-types"] });
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/claim-types/${id}`),
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["claim-types-admin"] });
      qc.invalidateQueries({ queryKey: ["claim-types"] });
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{types.length} claim type{types.length !== 1 ? "s" : ""}</p>
        <button onClick={() => setAdding(true)} className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-white hover:opacity-90" style={{ backgroundColor: "#2C3E7C" }}>
          <Plus className="h-4 w-4" /> Add Claim Type
        </button>
      </div>

      {adding && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-700">New Claim Type</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Display name</label>
              <Input value={form.label} onChange={(e) => setForm({ label: e.target.value })} placeholder="e.g. Internet Reimbursement" autoFocus />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Internal key (auto)</label>
              <Input value={form.label.toUpperCase().replace(/\s+/g, "_").replace(/[^A-Z0-9_]/g, "")} readOnly className="bg-gray-100 text-gray-500 font-mono text-xs" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setAdding(false)} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
            <button onClick={() => createMut.mutate()} disabled={!form.label.trim() || createMut.isPending} className="rounded-md px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60" style={{ backgroundColor: "#2C3E7C" }}>
              Create
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-gray-400 py-4 text-center">Loading…</p>
      ) : (
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Label</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Internal Key</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {types.map((ct: any) => (
                <tr key={ct.id} className={`hover:bg-gray-50 transition-colors ${!ct.isActive ? "opacity-50" : ""}`}>
                  <td className="px-4 py-3">
                    {editId === ct.id ? (
                      <Input value={editForm.label} onChange={(e) => setEditForm({ label: e.target.value })} autoFocus />
                    ) : (
                      <span className="font-medium text-gray-800">{ct.label}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{ct.name}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleMut.mutate({ id: ct.id, isActive: !ct.isActive })}
                      className={`text-xs font-medium px-2 py-0.5 rounded-full transition-colors ${ct.isActive ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
                    >
                      {ct.isActive ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {editId === ct.id ? (
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => updateMut.mutate(ct.id)} disabled={updateMut.isPending} className="p-1 text-green-600 hover:text-green-800"><Check className="h-4 w-4" /></button>
                        <button onClick={() => setEditId(null)} className="p-1 text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
                      </div>
                    ) : (
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => { setEditId(ct.id); setEditForm({ label: ct.label }); }} className="p-1 text-gray-400 hover:text-blue-600"><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={() => { if (confirm(`Delete "${ct.label}"?`)) deleteMut.mutate(ct.id); }} className="p-1 text-gray-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
const TABS = [
  { id: "departments",    label: "Departments" },
  { id: "designations",   label: "Designations" },
  { id: "leaves",         label: "Leave Policies" },
  { id: "work-locations", label: "Work Locations" },
  { id: "claim-types",    label: "Claim Types" },
  { id: "custom-roles",   label: "Custom Roles" },
  { id: "roles",          label: "Roles & Permissions" },
] as const;

type Tab = typeof TABS[number]["id"];

export default function AdminPage() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState<Tab>("departments");
  const isSA = user?.role === "SUPER_ADMIN";

  if (user?.role !== "SUPER_ADMIN" && user?.role !== "HR_ADMIN") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] text-gray-400">
        <p className="text-lg font-medium">Access Denied</p>
        <p className="text-sm mt-1">This section is restricted to admins.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Administration</h1>
        <p className="text-sm text-gray-400 mt-0.5">Manage departments, designations, leave policies, and role permissions.</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 rounded-xl bg-gray-100 p-1 w-fit">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "departments"    && <DepartmentsTab />}
      {tab === "designations"   && <DesignationsTab />}
      {tab === "leaves"         && <LeavePoliciesTab />}
      {tab === "work-locations" && <WorkLocationsTab />}
      {tab === "claim-types"    && <ClaimTypesTab />}
      {tab === "custom-roles"   && <CustomRolesTab />}
      {tab === "roles"          && <RolesTab isSA={isSA} />}
    </div>
  );
}
