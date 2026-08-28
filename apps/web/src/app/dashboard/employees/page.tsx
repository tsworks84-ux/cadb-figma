"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { formatDate, getInitials } from "@/lib/utils";
import { Plus, Search, Trash2, ChevronDown, X, AlertTriangle, UserCheck, UserX, Users, CalendarOff, UserPlus, LogOut, Upload, Download, MoreVertical, Filter, ChevronRight, Eye, Copy } from "lucide-react";
import Link from "next/link";
import type { EmployeeListItem } from "@cadb/types";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth";

// ── Stat card drill-down ──────────────────────────────────────────────────────

/**
 * The three headline numbers are questions ("who is out today?"), so each one
 * opens the list behind it. The list comes from `/employees/stats/<metric>`,
 * which reuses the where-clauses of `/employees/stats`, so the rows can never
 * disagree with the count that was clicked.
 */
type StatMetric = "on-leave-today" | "onboarded-this-month" | "out-this-month";

type StatEmployee = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  status: string;
  joiningDate: string;
  terminationDate: string | null;
  department:  { name: string } | null;
  designation: { title: string } | null;
  leaveApplications?: {
    id: string;
    leaveType: string;
    fromDate: string;
    toDate: string;
    totalDays: number;
    status: string;
  }[];
};

const STAT_MODAL: Record<StatMetric, { title: string; empty: string; icon: typeof Users; iconBg: string; iconColor: string }> = {
  "on-leave-today":       { title: "On Leave Today",  empty: "Nobody is on leave today.",      icon: CalendarOff, iconBg: "bg-orange-50", iconColor: "text-orange-600" },
  "onboarded-this-month": { title: "Onboarded",       empty: "Nobody joined this month.",      icon: UserPlus,    iconBg: "bg-green-50",  iconColor: "text-green-600"  },
  "out-this-month":       { title: "Out",             empty: "Nobody left this month.",        icon: LogOut,      iconBg: "bg-red-50",    iconColor: "text-red-600"    },
};

function StatDetailModal({ metric, subtitle, onClose }: {
  metric: StatMetric; subtitle: string; onClose: () => void;
}) {
  const cfg = STAT_MODAL[metric];

  const { data: people = [], isLoading } = useQuery<StatEmployee[]>({
    queryKey: ["employee-stats", metric],
    queryFn: () => api.get(`/api/v1/employees/stats/${metric}`).then((r) => r.data.data),
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-2xl max-h-[85vh] sm:max-h-[80vh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3 px-5 sm:px-6 py-4 border-b border-gray-100 shrink-0">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${cfg.iconBg}`}>
            <cfg.icon className={`h-5 w-5 ${cfg.iconColor}`} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-gray-900">{cfg.title}</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {isLoading ? "Loading…" : `${people.length} ${people.length === 1 ? "employee" : "employees"} · ${subtitle}`}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 shrink-0" aria-label="Close">
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin h-5 w-5 border-2 border-gray-300 border-t-transparent rounded-full" />
            </div>
          ) : people.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-gray-500">{cfg.empty}</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {people.map((p) => {
                const leave = p.leaveApplications?.[0];
                return (
                  <Link
                    key={p.id}
                    href={`/dashboard/employees/${p.id}`}
                    onClick={onClose}
                    className="flex items-center gap-3 px-5 sm:px-6 py-3.5 hover:bg-gray-50 transition-colors"
                  >
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-full text-white text-sm font-medium shrink-0"
                      style={{ backgroundColor: "#2C3E7C" }}
                    >
                      {getInitials(p.firstName, p.lastName)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-gray-900 truncate">{p.firstName} {p.lastName}</p>
                        <span className="text-xs text-gray-400 font-mono">{p.employeeCode}</span>
                        {leave?.status === "CANCELLATION_PENDING" && (
                          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                            Withdrawal pending
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 truncate">
                        {[p.designation?.title, p.department?.name].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      {metric === "on-leave-today" && leave && (
                        <>
                          <p className="text-xs font-semibold text-gray-700">{leave.leaveType.replace(/_/g, " ")}</p>
                          <p className="text-xs text-gray-500">
                            {formatDate(leave.fromDate)}
                            {leave.fromDate.slice(0, 10) !== leave.toDate.slice(0, 10) && ` – ${formatDate(leave.toDate)}`}
                          </p>
                        </>
                      )}
                      {metric === "onboarded-this-month" && (
                        <>
                          <p className="text-xs text-gray-500">Joined</p>
                          <p className="text-xs font-semibold text-gray-700">{formatDate(p.joiningDate)}</p>
                        </>
                      )}
                      {metric === "out-this-month" && (
                        <>
                          <p className="text-xs text-gray-500">Left</p>
                          <p className="text-xs font-semibold text-gray-700">
                            {p.terminationDate ? formatDate(p.terminationDate) : "—"}
                          </p>
                        </>
                      )}
                    </div>

                    <ChevronRight className="h-4 w-4 text-gray-300 shrink-0" />
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Row overflow menu ─────────────────────────────────────────────────────────

/**
 * The per-row "⋮" menu. It is positioned against the viewport rather than the
 * row because the table lives inside an `overflow-hidden` card that would clip
 * a normally-positioned dropdown, and it closes on anything that would move it
 * out from under the cursor (scroll, resize, Escape, an outside click).
 */
function RowMenu({
  emp, x, y, yTop, isSuperAdmin, onClose, onAction,
}: {
  emp: EmployeeListItem; x: number; y: number; yTop: number; isSuperAdmin: boolean;
  onClose: () => void;
  onAction: (action: ModalAction, emp: EmployeeListItem) => void;
}) {
  const ref    = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (ref.current?.contains(t) || t.closest("[data-row-menu-trigger]")) return;
      onClose();
    };
    const onKey  = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onClose, true);
    window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onClose, true);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  const items: {
    key: string; label: string; icon: React.ElementType;
    danger?: boolean; divider?: boolean; onClick: () => void;
  }[] = [
    {
      key: "view", label: "View profile", icon: Eye,
      onClick: () => { onClose(); router.push(`/dashboard/employees/${emp.id}`); },
    },
    {
      key: "copy", label: "Copy email", icon: Copy,
      onClick: () => {
        onClose();
        navigator.clipboard.writeText(emp.email)
          .then(() => toast.success("Email copied"))
          .catch(() => toast.error("Could not copy email"));
      },
    },
  ];

  if (isSuperAdmin) {
    const before = items.length;
    if (emp.status !== "ACTIVE") {
      items.push({ key: "activate", label: "Activate", icon: UserCheck, onClick: () => onAction("activate", emp) });
    }
    if (emp.status !== "TERMINATED") {
      items.push({ key: "deactivate", label: "Deactivate", icon: UserX, onClick: () => onAction("deactivate", emp) });
    }
    items.push({ key: "delete", label: "Delete", icon: Trash2, danger: true, onClick: () => onAction("delete", emp) });
    items[before].divider = true;
  }

  const W = 200;
  const H = 42 + items.length * 36 + (isSuperAdmin ? 9 : 0);
  const left = Math.min(Math.max(8, x - W), (typeof window !== "undefined" ? window.innerWidth : 1024) - W - 8);
  const flip = typeof window !== "undefined" && y + H > window.innerHeight - 8 && yTop - H > 8;

  return (
    <div
      ref={ref}
      role="menu"
      className="fixed z-50 rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
      style={{ width: W, left, top: flip ? undefined : y + 6, bottom: flip ? window.innerHeight - yTop + 6 : undefined }}
    >
      <div className="px-3 pb-1.5 pt-1">
        <p className="truncate text-xs font-semibold text-gray-900">{emp.firstName} {emp.lastName}</p>
        <p className="truncate text-[11px] text-gray-400">{emp.employeeCode}</p>
      </div>
      {items.map((it) => (
        <div key={it.key}>
          {it.divider && <div className="my-1 border-t border-gray-100" />}
          <button
            role="menuitem"
            onClick={it.onClick}
            className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-gray-50 ${
              it.danger ? "text-red-600 hover:bg-red-50" : "text-gray-700"
            }`}
          >
            <it.icon className="h-4 w-4 shrink-0" />
            {it.label}
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Confirm modal ─────────────────────────────────────────────────────────────
type ModalAction = "activate" | "deactivate" | "delete";

function ConfirmModal({
  action, count, names,
  onConfirm, onCancel, loading,
}: {
  action: ModalAction; count: number; names: string[];
  onConfirm: () => void; onCancel: () => void; loading: boolean;
}) {
  const [typed, setTyped] = useState("");

  const cfg = {
    activate: {
      title: "Activate Employees",
      body: `This will set ${count} employee(s) back to Active status.`,
      confirmLabel: "Activate",
      btnClass: "bg-green-600 hover:bg-green-700",
      icon: <UserCheck className="h-6 w-6 text-green-600" />,
      iconBg: "bg-green-100",
      requireTyped: false,
    },
    deactivate: {
      title: "Deactivate Employees",
      body: `This will mark ${count} employee(s) as Terminated. They will remain in the system but be inactive.`,
      confirmLabel: "Deactivate",
      btnClass: "bg-orange-600 hover:bg-orange-700",
      icon: <UserX className="h-6 w-6 text-orange-600" />,
      iconBg: "bg-orange-100",
      requireTyped: false,
    },
    delete: {
      title: "Permanently Delete Employees",
      body: `This will permanently hide ${count} employee(s) from the system. This action cannot be undone.`,
      confirmLabel: "Delete",
      btnClass: "bg-red-600 hover:bg-red-700",
      icon: <Trash2 className="h-6 w-6 text-red-600" />,
      iconBg: "bg-red-100",
      requireTyped: true,
    },
  }[action];

  const canConfirm = !cfg.requireTyped || typed === "DELETE";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start gap-4 px-6 py-5 border-b border-gray-100">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${cfg.iconBg}`}>
            {cfg.icon}
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">{cfg.title}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{cfg.body}</p>
          </div>
        </div>

        {/* Employee list */}
        <div className="px-6 py-4 max-h-40 overflow-y-auto space-y-1">
          {names.slice(0, 8).map((n, i) => (
            <p key={i} className="text-sm text-gray-700">• {n}</p>
          ))}
          {names.length > 8 && (
            <p className="text-xs text-gray-400">…and {names.length - 8} more</p>
          )}
        </div>

        {/* Typed confirmation for delete */}
        {cfg.requireTyped && (
          <div className="px-6 pb-2">
            <p className="text-xs text-red-600 mb-1.5">Type <strong>DELETE</strong> to confirm</p>
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="DELETE"
              className="w-full rounded-lg border border-red-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500"
              autoFocus
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 px-6 py-4">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading || !canConfirm}
            className={`flex-1 rounded-lg py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-50 ${cfg.btnClass}`}
          >
            {loading ? "Processing…" : cfg.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const STATUS_COLOR: Record<string, string> = {
  DRAFT: "bg-amber-100 text-amber-700 border border-amber-300",
  ACTIVE: "bg-green-100 text-green-700",
  PROBATION: "bg-yellow-100 text-yellow-700",
  ON_LEAVE: "bg-blue-100 text-blue-700",
  NOTICE_PERIOD: "bg-orange-100 text-orange-700",
  TERMINATED: "bg-red-100 text-red-700",
  RESIGNED: "bg-gray-100 text-gray-700",
  RETIRED: "bg-purple-100 text-purple-700",
  EXITED: "bg-red-50 text-red-500",
};

const EMPLOYMENT_TYPES = ["FULL_TIME", "PART_TIME", "CONTRACT", "VISITING", "INTERN"];
const STATUSES = ["DRAFT", "ACTIVE", "PROBATION", "ON_LEAVE", "NOTICE_PERIOD", "TERMINATED", "RESIGNED", "RETIRED", "EXITED"];

export default function EmployeesPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === "SUPER_ADMIN" || user?.role === "HR_ADMIN";
  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  // Filters
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [designationId, setDesignationId] = useState("");
  const [employmentType, setEmploymentType] = useState("");
  const [gender, setGender] = useState("");
  const [incompleteOnly, setIncompleteOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Bulk selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Confirm modal — targets travel with the action so the row menu and the
  // bulk bar share one confirmation path.
  const [modal, setModal] = useState<{ action: ModalAction; ids: string[]; names: string[] } | null>(null);

  // Row overflow menu. The table scrolls inside an overflow-hidden card, so an
  // absolutely positioned dropdown would be clipped — anchor it to the viewport.
  const [rowMenu, setRowMenu] = useState<{ emp: EmployeeListItem; x: number; y: number; yTop: number } | null>(null);

  const activeFilterCount = [status, departmentId, designationId, employmentType, gender, incompleteOnly ? "1" : ""].filter(Boolean).length;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["employees", page, search, status, departmentId, designationId, employmentType, gender],
    queryFn: () =>
      api.get<{ success: boolean; data: EmployeeListItem[]; meta: any }>("/api/v1/employees", {
        params: {
          page, limit: 20, search,
          ...(status && { status }),
          ...(departmentId && { departmentId }),
          ...(designationId && { designationId }),
          ...(employmentType && { employmentType }),
          ...(gender && { gender }),
        },
      }).then((r) => r.data),
    placeholderData: (prev) => prev,
    enabled: !!user?.id,
    retry: 2,
  });

  const { data: empStats } = useQuery({
    queryKey: ["employee-stats"],
    queryFn: () => api.get("/api/v1/employees/stats").then((r) => r.data.data),
    staleTime: 60 * 1000,
    enabled: isAdmin,
  });

  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: () => api.get("/api/v1/departments").then((r) => r.data.data),
    staleTime: Infinity,
  });

  const { data: designations } = useQuery({
    queryKey: ["designations"],
    queryFn: () => api.get("/api/v1/designations").then((r) => r.data.data),
    staleTime: Infinity,
  });

  function onMutationSuccess(msg: string) {
    toast.success(msg);
    setSelected(new Set());
    setModal(null);
    queryClient.invalidateQueries({ queryKey: ["employees"] });
  }

  const activateMutation = useMutation({
    mutationFn: (ids: string[]) => api.patch("/api/v1/employees/bulk", { ids, status: "ACTIVE" }),
    onSuccess: (_, ids) => onMutationSuccess(`${ids.length} employee(s) activated`),
    onError: (err: any) => toast.error(err.response?.data?.error ?? "Failed"),
  });

  const deactivateMutation = useMutation({
    mutationFn: (ids: string[]) => api.patch("/api/v1/employees/bulk", { ids, status: "TERMINATED" }),
    onSuccess: (_, ids) => onMutationSuccess(`${ids.length} employee(s) deactivated`),
    onError: (err: any) => toast.error(err.response?.data?.error ?? "Failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: (ids: string[]) => api.delete("/api/v1/employees/bulk", { data: { ids } }),
    onSuccess: (_, ids) => onMutationSuccess(`${ids.length} employee(s) deleted`),
    onError: (err: any) => toast.error(err.response?.data?.error ?? "Failed"),
  });

  const anyPending = activateMutation.isPending || deactivateMutation.isPending || deleteMutation.isPending;

  const employees = data?.data ?? [];
  const allPageIds = employees.map((e) => e.id);
  const allSelected = allPageIds.length > 0 && allPageIds.every((id) => selected.has(id));
  const someSelected = allPageIds.some((id) => selected.has(id));

  function toggleAll() {
    if (allSelected) {
      setSelected((prev) => { const s = new Set(prev); allPageIds.forEach((id) => s.delete(id)); return s; });
    } else {
      setSelected((prev) => { const s = new Set(prev); allPageIds.forEach((id) => s.add(id)); return s; });
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }

  function clearFilters() {
    setStatus(""); setDepartmentId(""); setDesignationId(""); setEmploymentType(""); setGender(""); setIncompleteOnly(false); setSearch(""); setPage(1);
  }

  const handleRowClick = useCallback((e: React.MouseEvent, id: string) => {
    // Don't navigate if clicking checkbox or action elements
    if ((e.target as HTMLElement).closest("input, button, a")) return;
    router.push(`/dashboard/employees/${id}`);
  }, [router]);

  const handleRowEnter = useCallback((id: string) => {
    queryClient.prefetchQuery({
      queryKey: ["employee", id],
      queryFn: () => api.get(`/api/v1/employees/${id}`).then((r) => r.data.data),
    });
  }, [queryClient]);

  const [statDetail, setStatDetail] = useState<StatMetric | null>(null);

  const incompleteCount = employees.filter((e) => !e.profileComplete).length;

  const selectedEmployees = employees.filter((e) => selected.has(e.id));
  const selectedNames = selectedEmployees.map((e) => `${e.firstName} ${e.lastName}`);

  function handleConfirm() {
    if (!modal) return;
    if (modal.action === "activate")   activateMutation.mutate(modal.ids);
    if (modal.action === "deactivate") deactivateMutation.mutate(modal.ids);
    if (modal.action === "delete")     deleteMutation.mutate(modal.ids);
  }

  function askBulk(action: ModalAction) {
    setModal({ action, ids: Array.from(selected), names: selectedNames });
  }

  const closeRowMenu = useCallback(() => setRowMenu(null), []);

  // The menu is anchored to a row, so anything that reshuffles the rows
  // (paging, searching, filtering) has to dismiss it.
  useEffect(() => { setRowMenu(null); }, [page, search, status, departmentId, designationId, employmentType, gender, incompleteOnly]);

  function askRow(action: ModalAction, emp: EmployeeListItem) {
    setRowMenu(null);
    setModal({ action, ids: [emp.id], names: [`${emp.firstName} ${emp.lastName}`] });
  }

  return (
    <>
      {statDetail && (
        <StatDetailModal
          metric={statDetail}
          subtitle={
            statDetail === "on-leave-today"
              ? new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
              : `${empStats?.monthName ?? new Date().toLocaleString("en-IN", { month: "long" })} ${new Date().getFullYear()}`
          }
          onClose={() => setStatDetail(null)}
        />
      )}
      {rowMenu && (
        <RowMenu
          emp={rowMenu.emp}
          x={rowMenu.x}
          y={rowMenu.y}
          yTop={rowMenu.yTop}
          isSuperAdmin={isSuperAdmin}
          onClose={closeRowMenu}
          onAction={askRow}
        />
      )}
      {modal && (
        <ConfirmModal
          action={modal.action}
          count={modal.ids.length}
          names={modal.names}
          onConfirm={handleConfirm}
          onCancel={() => setModal(null)}
          loading={anyPending}
        />
      )}
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: "#2C3E7C" }}>
              <Users className="text-white" size={18} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Employees</h1>
              <p className="text-sm text-gray-500">{data?.meta?.total ?? 0} total employees</p>
            </div>
          </div>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button className="px-3 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2">
              <Upload className="h-4 w-4" /> <span className="hidden sm:inline">Import</span>
            </button>
            <button className="px-3 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2">
              <Download className="h-4 w-4" /> <span className="hidden sm:inline">Export</span>
            </button>
            <Link
              href="/dashboard/employees/new"
              className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-white transition-colors"
              style={{ backgroundColor: "#2C3E7C" }}
            >
              <Plus className="h-4 w-4" /> Add Employee
            </Link>
          </div>
        )}
      </div>

      {/* Stats cards */}
      {isAdmin && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {([
            { label: "Total Employees", value: empStats?.total ?? "—", sub: "active headcount", icon: Users, iconCls: "bg-blue-50", iconColor: "text-blue-600", numColor: "text-gray-900", metric: null },
            { label: "On Leave Today",  value: empStats?.onLeaveToday ?? "—", sub: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short" }), icon: CalendarOff, iconCls: "bg-orange-50", iconColor: "text-orange-600", numColor: "text-gray-900", metric: "on-leave-today" },
            { label: `Onboarded in ${empStats?.monthName ?? new Date().toLocaleString("en-IN", { month: "long" })}`, value: empStats?.onboardedThisMonth ?? "—", sub: "joined this month", icon: UserPlus, iconCls: "bg-green-50", iconColor: "text-green-600", numColor: "text-gray-900", metric: "onboarded-this-month" },
            { label: `Out in ${empStats?.monthName ?? new Date().toLocaleString("en-IN", { month: "long" })}`, value: empStats?.quitThisMonth ?? "—", sub: "left this month", icon: LogOut, iconCls: "bg-red-50", iconColor: "text-red-600", numColor: "text-gray-900", metric: "out-this-month" },
          ] as { label: string; value: number | string; sub: string; icon: typeof Users; iconCls: string; iconColor: string; numColor: string; metric: StatMetric | null }[]).map((s) => {
            const body = (
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${s.iconCls}`}>
                  <s.icon className={`h-5 w-5 ${s.iconColor}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-gray-600 truncate">{s.label}</p>
                  <p className={`text-2xl font-semibold ${s.numColor}`}>{s.value}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{s.sub}</p>
                </div>
              </div>
            );

            // Total Employees isn't clickable — the table below already is that list.
            if (!s.metric) {
              return (
                <div key={s.label} className="bg-white rounded-lg border border-gray-200 p-5">
                  {body}
                </div>
              );
            }

            return (
              <button
                key={s.label}
                type="button"
                onClick={() => setStatDetail(s.metric)}
                className="bg-white rounded-lg border border-gray-200 p-5 text-left w-full hover:border-gray-300 hover:shadow-sm transition-all group"
              >
                {body}
                <span className="mt-2 flex items-center gap-1 text-xs font-medium text-gray-400 group-hover:text-gray-600">
                  View list <ChevronRight className="h-3 w-3" />
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Incomplete profiles alert */}
      {isAdmin && incompleteCount > 0 && !incompleteOnly && (
        <button
          onClick={() => setIncompleteOnly(true)}
          className="w-full flex items-center justify-between gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-left hover:bg-orange-100 transition-colors"
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-orange-800">
                {incompleteCount} employee{incompleteCount > 1 ? "s have" : " has"} incomplete profiles
              </p>
              <p className="text-xs text-orange-600">Missing DOB, blood group, address, or emergency contact info</p>
            </div>
          </div>
          <span className="text-xs font-medium text-orange-700 whitespace-nowrap">View →</span>
        </button>
      )}

      {/* Bulk action bar — Super Admin only */}
      {selected.size > 0 && isSuperAdmin && (
        <div className="flex items-center justify-between rounded-lg bg-blue-50 border border-blue-200 px-4 py-2.5">
          <span className="text-sm font-medium text-blue-800">{selected.size} employee(s) selected</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelected(new Set())}
              className="text-xs text-blue-600 hover:underline px-2"
            >
              Clear selection
            </button>
            <button
              onClick={() => askBulk("activate")}
              disabled={anyPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-60"
            >
              <UserCheck className="h-3.5 w-3.5" /> Activate
            </button>
            <button
              onClick={() => askBulk("deactivate")}
              disabled={anyPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
            >
              <UserX className="h-3.5 w-3.5" /> Deactivate
            </button>
            <button
              onClick={() => askBulk("delete")}
              disabled={anyPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          </div>
        </div>
      )}

      {/* Search + filter bar */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by name, code, email..."
              className="w-full rounded-md border border-gray-200 pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={departmentId}
              onChange={(e) => { setDepartmentId(e.target.value); setPage(1); }}
              className="flex-1 sm:flex-none px-3 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Departments</option>
              {departments?.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={`p-2 border rounded-md text-gray-600 hover:bg-gray-50 flex items-center gap-1.5 text-sm font-medium ${
                showFilters || activeFilterCount > 0 ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200"
              }`}
            >
              <Filter className="h-4 w-4" />
              {activeFilterCount > 0 && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="p-2 border border-gray-200 rounded-md text-gray-500 hover:bg-gray-50">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
          {/* Status */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Status</label>
            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }}
              className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="">All</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
            </select>
          </div>

          {/* Department */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Department</label>
            <select
              value={departmentId}
              onChange={(e) => { setDepartmentId(e.target.value); setPage(1); }}
              className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="">All</option>
              {departments?.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          {/* Designation */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Designation</label>
            <select
              value={designationId}
              onChange={(e) => { setDesignationId(e.target.value); setPage(1); }}
              className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="">All</option>
              {designations?.map((d: any) => <option key={d.id} value={d.id}>{d.title}</option>)}
            </select>
          </div>

          {/* Employment Type */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Type</label>
            <select
              value={employmentType}
              onChange={(e) => { setEmploymentType(e.target.value); setPage(1); }}
              className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="">All</option>
              {EMPLOYMENT_TYPES.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
            </select>
          </div>

          {/* Gender */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Gender</label>
            <select
              value={gender}
              onChange={(e) => { setGender(e.target.value); setPage(1); }}
              className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="">All</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          {/* Profile completeness */}
          {isAdmin && (
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={incompleteOnly}
                  onChange={(e) => { setIncompleteOnly(e.target.checked); setPage(1); }}
                  className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                />
                <span className="text-sm text-gray-600">Incomplete profiles only</span>
              </label>
            </div>
          )}
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              {isAdmin && (
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-gray-300 cursor-pointer"
                    style={{ accentColor: "#2C3E7C" }}
                  />
                </th>
              )}
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Employee</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Code</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Department</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Designation</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Type</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Joined</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
              {isAdmin && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Profile</th>}
              <th className="px-4 py-3 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: isAdmin ? 10 : 8 }).map((_, j) => (
                    <td key={j} className="px-4 py-4">
                      <div className="h-4 bg-gray-100 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : isError ? (
              <tr>
                <td colSpan={isAdmin ? 10 : 8} className="px-6 py-16 text-center text-sm text-gray-400">
                  Failed to load employees.{" "}
                  <button onClick={() => refetch()} className="text-blue-600 hover:underline">Try again</button>
                </td>
              </tr>
            ) : employees.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 10 : 8} className="px-6 py-16 text-center text-sm text-gray-400">
                  No employees found.{activeFilterCount > 0 && " Try clearing some filters."}
                </td>
              </tr>
            ) : (
              employees
                .filter((e) => !incompleteOnly || !e.profileComplete)
                .map((emp) => {
                  const score = emp.profileScore ?? 0;
                  const total = emp.profileTotal ?? 7;
                  const pct   = total > 0 ? Math.round((score / total) * 100) : 0;
                  return (
                  <tr
                    key={emp.id}
                    onClick={(e) => handleRowClick(e, emp.id)}
                    onMouseEnter={() => handleRowEnter(emp.id)}
                    className={`hover:bg-gray-50 transition-colors cursor-pointer ${
                      selected.has(emp.id) ? "bg-blue-50/50" : emp.status === "DRAFT" ? "bg-amber-50/60" : ""
                    }`}
                  >
                    {isAdmin && (
                      <td className="w-10 px-4 py-4" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selected.has(emp.id)}
                          onChange={() => toggleOne(emp.id)}
                          className="h-4 w-4 rounded border-gray-300 cursor-pointer"
                          style={{ accentColor: "#2C3E7C" }}
                        />
                      </td>
                    )}
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full text-white text-sm font-medium shrink-0" style={{ backgroundColor: "#2C3E7C" }}>
                          {getInitials(emp.firstName, emp.lastName)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{emp.firstName} {emp.lastName}</p>
                          <p className="text-xs text-gray-500">{emp.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600 font-mono">{emp.employeeCode}</td>
                    <td className="px-4 py-4 text-sm text-gray-600">{emp.department.name}</td>
                    <td className="px-4 py-4 text-sm text-gray-600">{emp.designation.title}</td>
                    <td className="px-4 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        emp.employmentType === "FULL_TIME" ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-700"
                      }`}>
                        {emp.employmentType.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">{formatDate(emp.joiningDate)}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLOR[emp.status] ?? "bg-gray-100 text-gray-700"}`}>
                        {emp.status.replace("_", " ")}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-1.5 w-16">
                            <div
                              className="h-1.5 rounded-full"
                              style={{ width: `${pct}%`, backgroundColor: pct >= 100 ? "#10b981" : "#F2994A" }}
                            />
                          </div>
                          <span className="text-xs text-gray-600 shrink-0">{pct}%</span>
                        </div>
                      </td>
                    )}
                    <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                      <button
                        data-row-menu-trigger
                        aria-label={`Actions for ${emp.firstName} ${emp.lastName}`}
                        aria-haspopup="menu"
                        aria-expanded={rowMenu?.emp.id === emp.id}
                        onClick={(e) => {
                          const r = e.currentTarget.getBoundingClientRect();
                          setRowMenu((cur) => cur?.emp.id === emp.id ? null : { emp, x: r.right, y: r.bottom, yTop: r.top });
                        }}
                        className="rounded p-1 hover:bg-gray-100"
                      >
                        <MoreVertical size={16} className="text-gray-400" />
                      </button>
                    </td>
                  </tr>
                )})
            )}
          </tbody>
        </table>
        </div>

        {/* Pagination */}
        {data?.meta && data.meta.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-6 py-3">
            <p className="text-xs text-gray-500">
              Page {data.meta.page} of {data.meta.totalPages} — {data.meta.total} employees
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded px-3 py-1 text-sm border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
              >Previous</button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= data.meta.totalPages}
                className="rounded px-3 py-1 text-sm border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
              >Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
