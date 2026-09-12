"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft, CalendarDays, CheckCircle2, ChevronDown, Clock, FileText, Search, X, XCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { usePermissionsState } from "@/hooks/usePermissions";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/** Read and review grants come straight from the matrix — see roles.ts RECORD_MODULES. */
const MODULE = "EMP_ALL_LEAVES";

const LEAVE_LABEL: Record<string, string> = {
  CASUAL: "Casual", SICK: "Sick", EARNED: "Earned",
  MATERNITY: "Maternity", PATERNITY: "Paternity",
  COMPENSATORY: "Comp-off", UNPAID: "Unpaid", SPECIAL: "Special",
};

const STATUS_STYLES: Record<string, string> = {
  PENDING:              "bg-yellow-100 text-yellow-700",
  APPROVED:             "bg-green-100 text-green-700",
  REJECTED:             "bg-red-100 text-red-600",
  CANCELLED:            "bg-gray-100 text-gray-500",
  CANCELLATION_PENDING: "bg-amber-100 text-amber-700",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING:              "Pending",
  APPROVED:             "Approved",
  REJECTED:             "Rejected",
  CANCELLED:            "Cancelled",
  CANCELLATION_PENDING: "Cancellation pending",
};

const STATUSES = ["PENDING", "APPROVED", "CANCELLATION_PENDING", "REJECTED", "CANCELLED"];

function statusLabel(status: string) {
  return STATUS_LABEL[status] ?? status;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function fmtShort(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

type LeaveRecord = {
  id: string;
  leaveType: string;
  fromDate: string;
  toDate: string;
  totalDays: number;
  lopDays: number;
  reason: string;
  status: string;
  createdAt: string;
  documentUrl: string | null;
  rejectionNote: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  cancelReason: string | null;
  approver: { firstName: string; lastName: string } | null;
  cancelApprover: { firstName: string; lastName: string } | null;
  employee: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    department: { name: string } | null;
  };
};

const FIELD =
  "w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-[#2C3E7C] focus:outline-none focus:ring-1 focus:ring-[#2C3E7C]";

/** A native select ignores most box styling, so it is appearance-none plus our own chevron. */
function SelectField({ value, onChange, options, placeholder }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${FIELD} appearance-none pr-8 ${value ? "text-gray-700" : "text-gray-400"}`}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
    </div>
  );
}

// ── Review modal ─────────────────────────────────────────────────────────────

/**
 * The record in full, plus the decision controls when the viewer holds approve.
 * A rejection must carry a note — the employee only ever sees this text as the
 * reason, and the API rejects an empty one anyway.
 */
function ReviewModal({ leave, canApprove, onClose }: {
  leave: LeaveRecord;
  canApprove: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [lopDays, setLopDays] = useState(String(leave.leaveType === "UNPAID" ? leave.totalDays : 0));
  const [mode, setMode] = useState<"APPROVED" | "REJECTED" | null>(null);

  const decide = useMutation({
    mutationFn: (action: "APPROVED" | "REJECTED") =>
      api.patch(`/api/v1/leaves/${leave.id}/decision`, {
        action,
        note: note.trim() || undefined,
        ...(action === "APPROVED" && { lopDays: Number(lopDays) || 0 }),
      }),
    onSuccess: (res) => {
      toast.success(res.data?.message ?? "Decision recorded");
      // Every list that can show this leave, here and on the Leaves page.
      for (const key of ["all-leave-records", "all-leaves", "pending-leaves", "decided-leaves", "leaves-on-date", "my-leaves", "my-leave-balances"]) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
      onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? "Failed to record decision"),
  });

  const isPending = leave.status === "PENDING";
  const sameDay = leave.fromDate.slice(0, 10) === leave.toDate.slice(0, 10);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-900 truncate">
              {leave.employee.firstName} {leave.employee.lastName}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {[leave.employee.employeeCode, leave.employee.department?.name].filter(Boolean).join(" · ")}
            </p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400">Leave type</p>
              <p className="text-sm text-gray-800 mt-0.5">{LEAVE_LABEL[leave.leaveType] ?? leave.leaveType}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400">Status</p>
              <span className={`mt-1 inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[leave.status] ?? "bg-gray-100 text-gray-500"}`}>
                {statusLabel(leave.status)}
              </span>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400">Dates</p>
              <p className="text-sm text-gray-800 mt-0.5">
                {sameDay ? fmt(leave.fromDate) : `${fmt(leave.fromDate)} – ${fmt(leave.toDate)}`}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400">Days</p>
              <p className="text-sm text-gray-800 mt-0.5">
                {leave.totalDays}
                {leave.lopDays > 0 && <span className="text-red-600"> · {leave.lopDays} LoP</span>}
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-xs uppercase tracking-wide text-gray-400">Applied on</p>
              <p className="text-sm text-gray-800 mt-0.5">{fmt(leave.createdAt)}</p>
            </div>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-gray-400">Reason</p>
            <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{leave.reason}</p>
          </div>

          {leave.documentUrl && (
            <a
              href={`${API_BASE}${leave.documentUrl}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <FileText size={15} /> Supporting document
            </a>
          )}

          {leave.approver && (
            <p className="text-xs text-gray-500">
              Decided by {leave.approver.firstName} {leave.approver.lastName}
              {leave.approvedAt && ` on ${fmt(leave.approvedAt)}`}
              {leave.rejectedAt && ` on ${fmt(leave.rejectedAt)}`}
            </p>
          )}
          {leave.rejectionNote && (
            <div className="rounded-md bg-red-50 px-3 py-2">
              <p className="text-xs font-medium text-red-700">Rejection note</p>
              <p className="text-sm text-red-600 mt-0.5">{leave.rejectionNote}</p>
            </div>
          )}
          {leave.cancelReason && (
            <div className="rounded-md bg-amber-50 px-3 py-2">
              <p className="text-xs font-medium text-amber-700">Cancellation reason</p>
              <p className="text-sm text-amber-700 mt-0.5">{leave.cancelReason}</p>
            </div>
          )}

          {canApprove && isPending && (
            <div className="space-y-3 border-t border-gray-100 pt-4">
              {mode === null ? (
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={() => setMode("APPROVED")}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                  >
                    <CheckCircle2 size={16} /> Approve
                  </button>
                  <button
                    onClick={() => setMode("REJECTED")}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
                  >
                    <XCircle size={16} /> Reject
                  </button>
                </div>
              ) : (
                <>
                  {mode === "APPROVED" && (
                    <div>
                      <label className="text-xs uppercase tracking-wide text-gray-400">Loss of pay (days)</label>
                      <input
                        type="number"
                        min={0}
                        max={leave.totalDays}
                        step="0.5"
                        value={lopDays}
                        onChange={(e) => setLopDays(e.target.value)}
                        className={`${FIELD} mt-1`}
                      />
                      <p className="mt-1 text-xs text-gray-400">
                        Deducted from pay. Set 0 to waive it — nothing else drives the deduction.
                      </p>
                    </div>
                  )}
                  <div>
                    <label className="text-xs uppercase tracking-wide text-gray-400">
                      {mode === "REJECTED" ? "Reason for rejection" : "Note (optional)"}
                    </label>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={3}
                      placeholder={mode === "REJECTED" ? "Shown to the employee" : "Visible on the record"}
                      className={`${FIELD} mt-1`}
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      disabled={decide.isPending || (mode === "REJECTED" && !note.trim())}
                      onClick={() => decide.mutate(mode)}
                      className={`flex-1 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
                        mode === "APPROVED" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
                      }`}
                    >
                      {decide.isPending ? "Saving…" : mode === "APPROVED" ? "Confirm approval" : "Confirm rejection"}
                    </button>
                    <button
                      onClick={() => { setMode(null); setNote(""); }}
                      className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Back
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AllLeaveRecordsPage() {
  const { permissions, ready } = usePermissionsState();
  const canView    = permissions[MODULE]?.canView    ?? false;
  const canApprove = permissions[MODULE]?.canApprove ?? false;

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [department, setDepartment] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selected, setSelected] = useState<LeaveRecord | null>(null);

  // Status and the date window narrow the query itself; the 1000-row ceiling on
  // /leaves/all is otherwise easy to hit once a couple of years have accumulated.
  const { data: leaves = [], isLoading } = useQuery<LeaveRecord[]>({
    queryKey: ["all-leave-records", status, from, to],
    queryFn: () => {
      const params = new URLSearchParams({ limit: "1000" });
      if (status) params.set("status", status);
      if (from)   params.set("from", from);
      if (to)     params.set("to", to);
      return api.get(`/api/v1/leaves/all?${params}`).then((r) => r.data.data);
    },
    enabled: canView,
    staleTime: 0,
  });

  const departments = useMemo(
    () => [...new Set(leaves.map((l) => l.employee.department?.name).filter(Boolean) as string[])].sort(),
    [leaves],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leaves.filter((l) => {
      if (department && l.employee.department?.name !== department) return false;
      if (!q) return true;
      return [
        l.employee.firstName, l.employee.lastName, l.employee.employeeCode,
        l.employee.department?.name, LEAVE_LABEL[l.leaveType] ?? l.leaveType,
        statusLabel(l.status), l.reason,
      ].some((v) => v?.toLowerCase().includes(q));
    });
  }, [leaves, search, department]);

  const counts = useMemo(() => ({
    total:    filtered.length,
    pending:  filtered.filter((l) => l.status === "PENDING").length,
    approved: filtered.filter((l) => l.status === "APPROVED").length,
    days:     filtered.reduce((sum, l) => sum + (l.status === "APPROVED" ? l.totalDays : 0), 0),
  }), [filtered]);

  if (!ready) {
    return <div className="py-16 text-center text-sm text-gray-400">Loading…</div>;
  }

  if (!canView) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm font-medium text-gray-700">You don&apos;t have access to leave records</p>
        <p className="mt-1 text-sm text-gray-500">Ask a Super Admin to grant your role view on All Leave Records.</p>
        <Link href="/dashboard/employees" className="mt-4 inline-block text-sm font-medium text-[#2C3E7C] hover:underline">
          Back to Employees
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {selected && (
        <ReviewModal leave={selected} canApprove={canApprove} onClose={() => setSelected(null)} />
      )}

      {/* Header */}
      <div>
        <Link href="/dashboard/employees" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
          <ArrowLeft size={15} /> Employees
        </Link>
        <div className="mt-2 flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md" style={{ backgroundColor: "#2C3E7C" }}>
            <CalendarDays className="text-white" size={18} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Leave Records</h1>
            <p className="text-sm text-gray-500">
              Every employee&apos;s leave applications{canApprove ? " — open one to approve or reject" : ""}
            </p>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Records", value: counts.total, icon: FileText, cls: "bg-blue-50 text-blue-600" },
          { label: "Pending", value: counts.pending, icon: Clock, cls: "bg-orange-50 text-orange-600" },
          { label: "Approved", value: counts.approved, icon: CheckCircle2, cls: "bg-green-50 text-green-600" },
          { label: "Approved days", value: counts.days, icon: CalendarDays, cls: "bg-purple-50 text-purple-600" },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${s.cls}`}>
                <s.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm text-gray-600">{s.label}</p>
                <p className="text-2xl font-semibold text-gray-900">{s.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative lg:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, code, department, reason…"
              className={`${FIELD} pl-9`}
            />
          </div>
          <SelectField
            value={status}
            onChange={setStatus}
            placeholder="All statuses"
            options={STATUSES.map((s) => ({ value: s, label: statusLabel(s) }))}
          />
          <SelectField
            value={department}
            onChange={setDepartment}
            placeholder="All departments"
            options={departments.map((d) => ({ value: d, label: d }))}
          />
          <div className="grid grid-cols-2 gap-2">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={FIELD} title="Leave on or after" />
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={FIELD} title="Leave on or before" />
          </div>
        </div>
      </div>

      {/* Records */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        {isLoading ? (
          <div className="py-16 text-center text-sm text-gray-400">Loading records…</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">No leave records match these filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[48rem]">
              <thead className="border-b border-gray-100 bg-gray-50">
                <tr>
                  {["Employee", "Type", "Dates", "Days", "Status", "Applied", ""].map((h) => (
                    <th key={h} className="whitespace-nowrap px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((l) => {
                  const sameDay = l.fromDate.slice(0, 10) === l.toDate.slice(0, 10);
                  return (
                    <tr
                      key={l.id}
                      onClick={() => setSelected(l)}
                      className="cursor-pointer transition-colors hover:bg-gray-50"
                    >
                      <td className="px-5 py-3">
                        <p className="whitespace-nowrap text-sm font-semibold text-gray-800">
                          {l.employee.firstName} {l.employee.lastName}
                        </p>
                        <p className="mt-0.5 text-xs text-gray-400">
                          {[l.employee.employeeCode, l.employee.department?.name].filter(Boolean).join(" · ")}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-sm text-gray-700">
                        {LEAVE_LABEL[l.leaveType] ?? l.leaveType}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-sm text-gray-700">
                        {sameDay ? fmtShort(l.fromDate) : `${fmtShort(l.fromDate)} – ${fmtShort(l.toDate)}`}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-sm text-gray-700">
                        {l.totalDays}
                        {l.lopDays > 0 && <span className="text-xs text-red-600"> · {l.lopDays} LoP</span>}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[l.status] ?? "bg-gray-100 text-gray-500"}`}>
                          {statusLabel(l.status)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-sm text-gray-500">{fmtShort(l.createdAt)}</td>
                      <td className="whitespace-nowrap px-5 py-3 text-right">
                        <span className="text-xs font-medium text-[#2C3E7C]">
                          {canApprove && l.status === "PENDING" ? "Review" : "View"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
