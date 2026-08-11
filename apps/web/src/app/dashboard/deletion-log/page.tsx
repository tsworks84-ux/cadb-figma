"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import {
  Archive, ChevronDown, Trash2, XCircle, Search, User, Clock,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuditEntry {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  summary: string | null;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
  actor: { id: string; employeeCode: string; firstName: string; lastName: string } | null;
}

const ACTION_META: Record<string, { label: string; style: string; Icon: React.ElementType }> = {
  DELETE:       { label: "Deleted",         style: "bg-red-100 text-red-700",     Icon: Trash2 },
  BULK_DELETE:  { label: "Bulk deleted",    style: "bg-red-100 text-red-700",     Icon: Trash2 },
  FORCE_CANCEL: { label: "Force-cancelled", style: "bg-amber-100 text-amber-700", Icon: XCircle },
};

const ENTITY_LABEL: Record<string, string> = {
  LeaveApplication:   "Leave application",
  ReimbursementClaim: "Reimbursement claim",
  Employee:           "Employee record",
};

// Snapshot keys worth surfacing, in reading order. Anything else stays folded
// away in the raw JSON — the point of the list is to be scannable, not complete.
const FIELD_LABELS: Record<string, string> = {
  claimNumber:    "Claim number",
  leaveType:      "Leave type",
  claimType:      "Claim type",
  title:          "Title",
  reason:         "Reason given",
  description:    "Description",
  fromDate:       "From",
  toDate:         "To",
  totalDays:      "Days",
  claimedAmount:  "Claimed amount",
  approvedAmount: "Approved amount",
  status:         "Status at deletion",
  lopDays:        "LoP days",
  rejectionNote:  "Rejection note",
  cancelReason:   "Cancellation reason",
  createdAt:      "Originally filed",
  approvedAt:     "Approved on",
  paidAt:         "Paid on",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function fmtValue(key: string, value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (key.endsWith("Amount")) return `₹${Number(value).toLocaleString("en-IN")}`;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  }
  return String(value);
}

// ─── Entry row ────────────────────────────────────────────────────────────────

function LogEntry({ entry }: { entry: AuditEntry }) {
  const [open, setOpen] = useState(false);
  const meta = ACTION_META[entry.action] ?? { label: entry.action, style: "bg-gray-100 text-gray-600", Icon: Archive };
  const snapshot = entry.oldValues ?? {};
  const details = (entry.newValues ?? {}) as { reason?: string; count?: number };
  const reason = details.reason;
  const entityName = ENTITY_LABEL[entry.entity] ?? entry.entity;
  // Older entries (employee bulk deletes) predate the summary column, so
  // reconstruct something readable rather than printing a list of raw IDs.
  const headline = entry.summary
    ?? (details.count != null ? `${details.count} ${entityName.toLowerCase()}(s)` : `${entityName} ${entry.entityId}`);

  const fields = Object.entries(FIELD_LABELS)
    .filter(([key]) => snapshot[key] != null && snapshot[key] !== "")
    .map(([key, label]) => ({ key, label, value: fmtValue(key, snapshot[key]) }));

  return (
    <div className="border-b border-gray-50 last:border-b-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left px-4 sm:px-6 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-start gap-3">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold shrink-0 ${meta.style}`}>
            <meta.Icon className="h-3 w-3 shrink-0" />
            <span className="hidden sm:inline">{meta.label}</span>
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-800 break-words">{headline}</p>
            <div className="flex items-center gap-x-3 gap-y-1 mt-1 flex-wrap text-xs text-gray-400">
              <span className="inline-flex items-center gap-1">
                <User className="h-3 w-3" />
                {entry.actor ? `${entry.actor.firstName} ${entry.actor.lastName}` : "Unknown actor"}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {fmtDateTime(entry.createdAt)}
              </span>
              <span className="hidden sm:inline">{entityName}</span>
            </div>
          </div>
          <ChevronDown className={`h-4 w-4 text-gray-300 shrink-0 mt-1 transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      {open && (
        <div className="px-4 sm:px-6 pb-5 space-y-4">
          {reason && (
            <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3">
              <p className="text-xs font-semibold text-amber-800 mb-0.5">Reason given</p>
              <p className="text-sm text-amber-700">{reason}</p>
            </div>
          )}

          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Record as it stood
            </p>
            {fields.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No snapshot captured.</p>
            ) : (
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
                {fields.map((f) => (
                  <div key={f.key} className="min-w-0">
                    <dt className="text-xs text-gray-400">{f.label}</dt>
                    <dd className="text-sm text-gray-800 break-words">{f.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>

          <details className="group">
            <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-600 select-none">
              Raw snapshot
            </summary>
            <pre className="mt-2 overflow-x-auto rounded-xl bg-gray-900 p-4 text-xs text-gray-200">
              {JSON.stringify(entry.oldValues, null, 2)}
            </pre>
          </details>

          <p className="text-xs text-gray-300">
            Record ID {entry.entityId}{entry.ipAddress ? ` · from ${entry.ipAddress}` : ""}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

export default function DeletionLogPage() {
  const { user } = useAuthStore();
  const [action, setAction] = useState("");
  const [entity, setEntity] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) });
  if (action) params.set("action", action);
  if (entity) params.set("entity", entity);
  if (search.trim()) params.set("search", search.trim());

  const { data, isLoading } = useQuery<{ data: AuditEntry[]; meta: { total: number } }>({
    queryKey: ["audit-logs", action, entity, search, page],
    queryFn: () => api.get(`/api/v1/audit-logs?${params.toString()}`).then((r) => r.data),
    enabled: user?.role === "SUPER_ADMIN" || user?.role === "HR_ADMIN",
  });

  if (user?.role !== "SUPER_ADMIN" && user?.role !== "HR_ADMIN") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] text-gray-400">
        <p className="text-lg font-medium">Access Denied</p>
        <p className="text-sm mt-1">The deletion log is restricted to Super Admin and HR.</p>
      </div>
    );
  }

  const entries = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);

  function resetTo(setter: (v: string) => void) {
    return (value: string) => { setter(value); setPage(0); };
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: "#2C3E7C" }}>
            <Archive className="text-white" size={18} />
          </div>
          <div>
            <p className="text-sm text-gray-500 uppercase tracking-wide">Audit</p>
            <h1 className="text-2xl font-semibold text-gray-900">Deletion Log</h1>
          </div>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          Every record an admin has deleted or force-cancelled — leaves, reimbursement claims and
          employee records — with a copy of the record as it stood and the reason given.
          Append-only: entries cannot be edited or removed.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-300" />
          <input
            value={search}
            onChange={(e) => resetTo(setSearch)(e.target.value)}
            placeholder="Search by employee, claim number, type…"
            className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={action}
          onChange={(e) => resetTo(setAction)(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All deletions</option>
          <option value="DELETE,BULK_DELETE">Deleted</option>
          <option value="FORCE_CANCEL">Force-cancelled</option>
        </select>
        <select
          value={entity}
          onChange={(e) => resetTo(setEntity)(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All records</option>
          <option value="LeaveApplication">Leave applications</option>
          <option value="ReimbursementClaim">Reimbursement claims</option>
          <option value="Employee">Employee records</option>
        </select>
      </div>

      {/* Entries */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="px-6 py-12 text-center text-sm text-gray-400">Loading…</div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3">
              <Archive className="h-6 w-6 text-gray-300" />
            </div>
            <p className="text-sm font-medium text-gray-600">Nothing logged yet</p>
            <p className="text-xs text-gray-400 mt-1 max-w-sm">
              Deletions and force-cancellations of leaves and claims will appear here as they happen.
            </p>
          </div>
        ) : (
          entries.map((entry) => <LogEntry key={entry.id} entry={entry} />)
        )}
      </div>

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
              disabled={page >= lastPage}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
