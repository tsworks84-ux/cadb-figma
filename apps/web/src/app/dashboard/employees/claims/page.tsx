"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft, BadgeIndianRupee, CheckCircle2, ChevronDown, Clock, FileText, Paperclip, Receipt,
  Search, X, XCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { usePermissionsState } from "@/hooks/usePermissions";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/** Read and review grants come straight from the matrix — see roles.ts RECORD_MODULES. */
const MODULE = "EMP_ALL_CLAIMS";

const STATUS_STYLES: Record<string, string> = {
  DRAFT:                "bg-gray-100 text-gray-500",
  SUBMITTED:            "bg-yellow-100 text-yellow-700",
  APPROVED:             "bg-green-100 text-green-700",
  REJECTED:             "bg-red-100 text-red-600",
  PAID:                 "bg-blue-100 text-blue-700",
  CANCELLED:            "bg-gray-100 text-gray-500",
  CANCELLATION_PENDING: "bg-amber-100 text-amber-700",
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft", SUBMITTED: "Submitted", APPROVED: "Approved",
  REJECTED: "Rejected", PAID: "Paid", CANCELLED: "Cancelled",
  CANCELLATION_PENDING: "Cancellation pending",
};

const STATUSES = ["SUBMITTED", "APPROVED", "PAID", "CANCELLATION_PENDING", "REJECTED", "CANCELLED", "DRAFT"];

function statusLabel(status: string) {
  return STATUS_LABEL[status] ?? status;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function fmtShort(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

type ClaimRecord = {
  id: string;
  claimNumber: string;
  claimType: string;
  title: string;
  description: string | null;
  claimedAmount: number;
  approvedAmount: number | null;
  status: string;
  createdAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  paidAt: string | null;
  rejectionNote: string | null;
  cancelReason: string | null;
  approver: { id: string; firstName: string; lastName: string } | null;
  receipts: { id: string; fileName: string; fileUrl: string; amount: number }[];
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
 * The claim in full, plus the decision controls when the viewer holds approve.
 * An approval carries the amount actually sanctioned — it defaults to what was
 * claimed but is editable, which is the whole point of reviewing a claim rather
 * than rubber-stamping it. A rejection must carry a note; the API requires one.
 */
function ReviewModal({ claim, canApprove, onClose }: {
  claim: ClaimRecord;
  canApprove: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState(String(claim.claimedAmount));
  const [mode, setMode] = useState<"APPROVED" | "REJECTED" | null>(null);

  function refresh(message: string) {
    toast.success(message);
    for (const key of ["all-claim-records", "pending-claims", "admin-all-claims", "claim-cancellation-requests", "my-claims", "claim"]) {
      queryClient.invalidateQueries({ queryKey: [key] });
    }
    onClose();
  }

  const decide = useMutation({
    mutationFn: (action: "APPROVED" | "REJECTED") =>
      api.patch(`/api/v1/claims/${claim.id}/decision`, {
        action,
        note: note.trim() || undefined,
        ...(action === "APPROVED" && { approvedAmount: Number(amount) }),
      }),
    onSuccess: (_d, action) => refresh(action === "APPROVED" ? "Claim approved" : "Claim rejected"),
    onError: (e: any) => toast.error(e?.response?.data?.error ?? "Failed to record decision"),
  });

  const pay = useMutation({
    mutationFn: () => api.patch(`/api/v1/claims/${claim.id}/pay`),
    onSuccess: () => refresh("Claim marked as paid"),
    onError: (e: any) => toast.error(e?.response?.data?.error ?? "Failed to mark as paid"),
  });

  const receiptTotal = claim.receipts.reduce((sum, r) => sum + r.amount, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-gray-900">{claim.title}</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              {claim.claimNumber} · {claim.employee.firstName} {claim.employee.lastName}
              {claim.employee.department?.name ? ` · ${claim.employee.department.name}` : ""}
            </p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400">Type</p>
              <p className="mt-0.5 text-sm text-gray-800">{claim.claimType}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400">Status</p>
              <span className={`mt-1 inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[claim.status] ?? "bg-gray-100 text-gray-500"}`}>
                {statusLabel(claim.status)}
              </span>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400">Claimed</p>
              <p className="mt-0.5 text-sm font-semibold text-gray-800">{formatCurrency(claim.claimedAmount)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400">Approved</p>
              <p className="mt-0.5 text-sm font-semibold text-gray-800">
                {claim.approvedAmount != null ? formatCurrency(claim.approvedAmount) : "—"}
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-xs uppercase tracking-wide text-gray-400">Submitted on</p>
              <p className="mt-0.5 text-sm text-gray-800">{fmt(claim.createdAt)}</p>
            </div>
          </div>

          {claim.description && (
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400">Description</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{claim.description}</p>
            </div>
          )}

          <div>
            <p className="text-xs uppercase tracking-wide text-gray-400">
              Receipts {claim.receipts.length > 0 && `· ${formatCurrency(receiptTotal)} attached`}
            </p>
            {claim.receipts.length === 0 ? (
              <p className="mt-1 text-sm text-gray-400">None attached.</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {claim.receipts.map((r) => (
                  <li key={r.id}>
                    <a
                      href={`${API_BASE}${r.fileUrl}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between gap-3 rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <Paperclip size={14} className="shrink-0 text-gray-400" />
                        <span className="truncate">{r.fileName}</span>
                      </span>
                      <span className="shrink-0 text-xs text-gray-500">{formatCurrency(r.amount)}</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {claim.approver && (
            <p className="text-xs text-gray-500">
              Decided by {claim.approver.firstName} {claim.approver.lastName}
              {claim.approvedAt && ` on ${fmt(claim.approvedAt)}`}
              {claim.rejectedAt && ` on ${fmt(claim.rejectedAt)}`}
              {claim.paidAt && ` · paid ${fmt(claim.paidAt)}`}
            </p>
          )}
          {claim.rejectionNote && (
            <div className="rounded-md bg-red-50 px-3 py-2">
              <p className="text-xs font-medium text-red-700">Rejection note</p>
              <p className="mt-0.5 text-sm text-red-600">{claim.rejectionNote}</p>
            </div>
          )}
          {claim.cancelReason && (
            <div className="rounded-md bg-amber-50 px-3 py-2">
              <p className="text-xs font-medium text-amber-700">Cancellation reason</p>
              <p className="mt-0.5 text-sm text-amber-700">{claim.cancelReason}</p>
            </div>
          )}

          {canApprove && claim.status === "SUBMITTED" && (
            <div className="space-y-3 border-t border-gray-100 pt-4">
              {mode === null ? (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    onClick={() => setMode("APPROVED")}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                  >
                    <CheckCircle2 size={16} /> Approve
                  </button>
                  <button
                    onClick={() => setMode("REJECTED")}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
                  >
                    <XCircle size={16} /> Reject
                  </button>
                </div>
              ) : (
                <>
                  {mode === "APPROVED" && (
                    <div>
                      <label className="text-xs uppercase tracking-wide text-gray-400">Approved amount (₹)</label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className={`${FIELD} mt-1`}
                      />
                      <p className="mt-1 text-xs text-gray-400">
                        Defaults to the claimed amount. Lower it to sanction a part of the claim.
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
                  <div className="flex flex-col gap-2 sm:flex-row">
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

          {canApprove && claim.status === "APPROVED" && (
            <div className="border-t border-gray-100 pt-4">
              <button
                disabled={pay.isPending}
                onClick={() => pay.mutate()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                style={{ backgroundColor: "#2C3E7C" }}
              >
                <BadgeIndianRupee size={16} /> {pay.isPending ? "Saving…" : "Mark as paid"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AllClaimRecordsPage() {
  const { permissions, ready } = usePermissionsState();
  const canView    = permissions[MODULE]?.canView    ?? false;
  const canApprove = permissions[MODULE]?.canApprove ?? false;

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [claimType, setClaimType] = useState("");
  const [department, setDepartment] = useState("");
  const [selected, setSelected] = useState<ClaimRecord | null>(null);

  // A claim's status moves under our feet — another reviewer decides it, or this
  // one decides it in a second tab — so this list opts out of the app-wide
  // staleTime rather than showing a decided claim as still awaiting review.
  const { data: claims = [], isLoading } = useQuery<ClaimRecord[]>({
    queryKey: ["all-claim-records", status, claimType],
    queryFn: () => {
      const params = new URLSearchParams();
      if (status)    params.set("status", status);
      if (claimType) params.set("claimType", claimType);
      return api.get(`/api/v1/claims/admin/all?${params}`).then((r) => r.data.data);
    },
    enabled: canView,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  const { data: claimTypes = [] } = useQuery<{ id: string; name: string; label: string }[]>({
    queryKey: ["claim-types"],
    queryFn: () => api.get("/api/v1/claim-types").then((r) => r.data.data),
    enabled: canView,
  });

  const departments = useMemo(
    () => [...new Set(claims.map((c) => c.employee.department?.name).filter(Boolean) as string[])].sort(),
    [claims],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return claims.filter((c) => {
      if (department && c.employee.department?.name !== department) return false;
      if (!q) return true;
      return [
        c.employee.firstName, c.employee.lastName, c.employee.employeeCode,
        c.employee.department?.name, c.claimNumber, c.claimType, c.title,
        statusLabel(c.status),
      ].some((v) => v?.toLowerCase().includes(q));
    });
  }, [claims, search, department]);

  const counts = useMemo(() => ({
    total:    filtered.length,
    pending:  filtered.filter((c) => c.status === "SUBMITTED").length,
    claimed:  filtered.reduce((sum, c) => sum + c.claimedAmount, 0),
    // What the org is actually out of pocket for — a rejected claim's approved
    // amount is null, and a cancelled one never counted.
    approved: filtered
      .filter((c) => c.status === "APPROVED" || c.status === "PAID")
      .reduce((sum, c) => sum + (c.approvedAmount ?? c.claimedAmount), 0),
  }), [filtered]);

  if (!ready) {
    return <div className="py-16 text-center text-sm text-gray-400">Loading…</div>;
  }

  if (!canView) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm font-medium text-gray-700">You don&apos;t have access to claim records</p>
        <p className="mt-1 text-sm text-gray-500">Ask a Super Admin to grant your role view on All Claim Records.</p>
        <Link href="/dashboard/employees" className="mt-4 inline-block text-sm font-medium text-[#2C3E7C] hover:underline">
          Back to Employees
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {selected && (
        <ReviewModal claim={selected} canApprove={canApprove} onClose={() => setSelected(null)} />
      )}

      {/* Header */}
      <div>
        <Link href="/dashboard/employees" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
          <ArrowLeft size={15} /> Employees
        </Link>
        <div className="mt-2 flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md" style={{ backgroundColor: "#2C3E7C" }}>
            <Receipt className="text-white" size={18} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Claim Records</h1>
            <p className="text-sm text-gray-500">
              Every employee&apos;s reimbursement claims{canApprove ? " — open one to approve or reject" : ""}
            </p>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Records", value: String(counts.total), icon: FileText, cls: "bg-blue-50 text-blue-600" },
          { label: "Awaiting review", value: String(counts.pending), icon: Clock, cls: "bg-orange-50 text-orange-600" },
          { label: "Claimed", value: formatCurrency(counts.claimed), icon: Receipt, cls: "bg-purple-50 text-purple-600" },
          { label: "Approved value", value: formatCurrency(counts.approved), icon: CheckCircle2, cls: "bg-green-50 text-green-600" },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${s.cls}`}>
                <s.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm text-gray-600">{s.label}</p>
                <p className="truncate text-2xl font-semibold text-gray-900">{s.value}</p>
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
              placeholder="Search name, code, claim no., title…"
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
            value={claimType}
            onChange={setClaimType}
            placeholder="All types"
            options={claimTypes.map((t) => ({ value: t.name, label: t.label }))}
          />
          <SelectField
            value={department}
            onChange={setDepartment}
            placeholder="All departments"
            options={departments.map((d) => ({ value: d, label: d }))}
          />
        </div>
      </div>

      {/* Records */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        {isLoading ? (
          <div className="py-16 text-center text-sm text-gray-400">Loading records…</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">No claim records match these filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem]">
              <thead className="border-b border-gray-100 bg-gray-50">
                <tr>
                  {["Employee", "Claim", "Type", "Claimed", "Approved", "Status", "Submitted", ""].map((h) => (
                    <th key={h} className="whitespace-nowrap px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => setSelected(c)}
                    className="cursor-pointer transition-colors hover:bg-gray-50"
                  >
                    <td className="px-5 py-3">
                      <p className="whitespace-nowrap text-sm font-semibold text-gray-800">
                        {c.employee.firstName} {c.employee.lastName}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-400">
                        {[c.employee.employeeCode, c.employee.department?.name].filter(Boolean).join(" · ")}
                      </p>
                    </td>
                    <td className="px-5 py-3">
                      <p className="max-w-[14rem] truncate text-sm text-gray-700">{c.title}</p>
                      <p className="mt-0.5 text-xs text-gray-400">{c.claimNumber}</p>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-sm text-gray-700">{c.claimType}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-sm text-gray-700">{formatCurrency(c.claimedAmount)}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-sm text-gray-700">
                      {c.approvedAmount != null ? formatCurrency(c.approvedAmount) : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[c.status] ?? "bg-gray-100 text-gray-500"}`}>
                        {statusLabel(c.status)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-sm text-gray-500">{fmtShort(c.createdAt)}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-right">
                      <span className="text-xs font-medium text-[#2C3E7C]">
                        {canApprove && c.status === "SUBMITTED" ? "Review" : "View"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
