"use client";

import { useState, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth";
import { CalendarDays, Plus, Paperclip, XCircle, ChevronRight, Clock } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// ── Constants ─────────────────────────────────────────────────────────────────

const LEAVE_LABEL: Record<string, string> = {
  CASUAL: "Casual", SICK: "Sick", EARNED: "Earned",
  MATERNITY: "Maternity", PATERNITY: "Paternity",
  COMPENSATORY: "Comp-off", UNPAID: "Unpaid", SPECIAL: "Special",
};

const LEAVE_COLORS: Record<string, { bg: string; text: string; bar: string; border: string }> = {
  CASUAL:       { bg: "bg-blue-50",   text: "text-blue-600",   bar: "bg-blue-500",   border: "border-blue-100" },
  SICK:         { bg: "bg-red-50",    text: "text-red-500",    bar: "bg-red-400",    border: "border-red-100" },
  EARNED:       { bg: "bg-green-50",  text: "text-green-600",  bar: "bg-green-500",  border: "border-green-100" },
  MATERNITY:    { bg: "bg-pink-50",   text: "text-pink-600",   bar: "bg-pink-400",   border: "border-pink-100" },
  PATERNITY:    { bg: "bg-indigo-50", text: "text-indigo-600", bar: "bg-indigo-500", border: "border-indigo-100" },
  COMPENSATORY: { bg: "bg-orange-50", text: "text-orange-600", bar: "bg-orange-400", border: "border-orange-100" },
  UNPAID:       { bg: "bg-gray-50",   text: "text-gray-500",   bar: "bg-gray-400",   border: "border-gray-100" },
  SPECIAL:      { bg: "bg-purple-50", text: "text-purple-600", bar: "bg-purple-500", border: "border-purple-100" },
};

const POLICY_NOTES: Record<string, string> = {
  CASUAL:       "Max 3 consecutive days",
  SICK:         "Certificate after 2 days",
  EARNED:       "Apply 7 days before",
  MATERNITY:    "26 weeks entitlement",
  PATERNITY:    "15 days entitlement",
  COMPENSATORY: "Based on approved OT",
  UNPAID:       "Manager approval required",
  SPECIAL:      "Subject to HR discretion",
};

const STATUS_STYLES: Record<string, string> = {
  PENDING:   "bg-yellow-100 text-yellow-700",
  APPROVED:  "bg-green-100 text-green-700",
  REJECTED:  "bg-red-100 text-red-600",
  CANCELLED: "bg-gray-100 text-gray-400",
};

const LEAVE_TYPES = [
  "CASUAL", "SICK", "EARNED", "MATERNITY",
  "PATERNITY", "COMPENSATORY", "UNPAID", "SPECIAL",
] as const;

// ── Types ─────────────────────────────────────────────────────────────────────

interface LeaveBalance {
  leaveType: string;
  allocated: number;
  accrued:   number;
  used:      number;
  pending:   number;
  availed:   number;
  balance:   number;
  carried:   number;
}

interface LeaveApplication {
  id:           string;
  leaveType:    string;
  fromDate:     string;
  toDate:       string;
  totalDays:    number;
  reason:       string;
  status:       string;
  createdAt:    string;
  approverId:   string | null;
  approver:     { firstName: string; lastName: string } | null;
  rejectionNote?: string | null;
  documentUrl?: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getFiscalYear(d = new Date()) {
  return d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
}

function nextAccrualDate() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return first.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

function fmtShort(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function fmtDayName(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { weekday: "short" });
}

function workingDaysBetween(from: Date, to: Date) {
  let count = 0;
  const cur = new Date(from);
  while (cur <= to) {
    const d = cur.getDay();
    if (d !== 0 && d !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

// ── Leave Balance Cards ────────────────────────────────────────────────────────

function BalanceSection({ balances }: { balances: LeaveBalance[] }) {
  const fy = getFiscalYear();
  const totalAllocated = balances.reduce((s, b) => s + b.allocated, 0);
  const visibleTypes = balances.filter((b) => b.allocated > 0);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <h2 className="font-semibold text-gray-900">Leave Balance</h2>
          <p className="text-xs text-gray-400 mt-0.5">FY {fy}–{fy + 1} · Accrued monthly</p>
        </div>
        <span className="text-xs text-gray-500">{totalAllocated} days annual entitlement</span>
      </div>

      <div className="px-6 pb-4 grid grid-cols-3 gap-3">
        {visibleTypes.slice(0, 3).map((b) => {
          const c = LEAVE_COLORS[b.leaveType] ?? LEAVE_COLORS.UNPAID;
          const pct = b.accrued > 0 ? Math.min(100, (b.availed / b.accrued) * 100) : 0;
          return (
            <div key={b.leaveType} className={`${c.bg} ${c.border} border rounded-xl p-4`}>
              <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${c.text}`}>
                {LEAVE_LABEL[b.leaveType] ?? b.leaveType}
              </p>
              <p className={`text-4xl font-bold ${c.text} mb-3`}>{b.balance}</p>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-gray-600">
                  <span>Accrued</span><span className="font-semibold text-gray-800">{b.accrued}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Availed</span><span className="font-semibold text-gray-800">{b.availed}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Pending</span><span className="font-semibold text-gray-800">{b.pending}</span>
                </div>
              </div>
              <div className="mt-3 h-1.5 rounded-full bg-black/10">
                <div className={`h-full rounded-full ${c.bar}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {visibleTypes.length > 3 && (
        <div className="px-6 pb-4 flex gap-2 flex-wrap">
          {visibleTypes.slice(3).map((b) => {
            const c = LEAVE_COLORS[b.leaveType] ?? LEAVE_COLORS.UNPAID;
            return (
              <div key={b.leaveType} className={`${c.bg} ${c.border} border rounded-xl px-4 py-2.5 flex items-center gap-3`}>
                <span className={`text-xs font-bold uppercase tracking-wider ${c.text}`}>
                  {LEAVE_LABEL[b.leaveType]}
                </span>
                <span className={`text-xl font-bold ${c.text}`}>{b.balance}</span>
                <span className="text-xs text-gray-400">/ {b.allocated}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="px-6 py-3 border-t border-gray-50 bg-gray-50/50 flex justify-between text-xs text-gray-500">
        <span>Next accrual: {nextAccrualDate()}</span>
        <span>Medical certificate required for sick leave over 2 days</span>
      </div>
    </div>
  );
}

// ── Apply Form ────────────────────────────────────────────────────────────────

interface ApplyFormState {
  leaveType: string;
  duration: "FULL" | "FIRST_HALF" | "SECOND_HALF";
  fromDate: string;
  toDate: string;
  reason: string;
}

function ApplyForm({
  balances,
  onSuccess,
}: {
  balances: LeaveBalance[];
  onSuccess: () => void;
}) {
  const [form, setForm] = useState<ApplyFormState>({
    leaveType: "CASUAL",
    duration: "FULL",
    fromDate: "",
    toDate: "",
    reason: "",
  });
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { user } = useAuthStore();

  const set = <K extends keyof ApplyFormState>(k: K, v: ApplyFormState[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  // When half-day selected, lock toDate = fromDate
  const isHalfDay = form.duration !== "FULL";
  const effectiveTo = isHalfDay ? form.fromDate : form.toDate;

  const previewDays = useMemo(() => {
    if (!form.fromDate) return 0;
    if (isHalfDay) return 0.5;
    if (!form.toDate) return 0;
    const from = new Date(form.fromDate);
    const to = new Date(form.toDate);
    return from > to ? 0 : workingDaysBetween(from, to);
  }, [form.fromDate, form.toDate, form.duration]);

  const selectedBalance = balances.find((b) => b.leaveType === form.leaveType);
  const balanceAfter = selectedBalance ? Math.max(0, selectedBalance.balance - previewDays) : 0;

  const applyMut = useMutation({
    mutationFn: async () => {
      let documentUrl: string | undefined;
      if (attachedFile && user?.id) {
        setUploading(true);
        const fd = new FormData();
        fd.append("file", attachedFile);
        fd.append("type", "OTHER");
        fd.append("label", "Leave Document");
        const token = localStorage.getItem("cadb_access_token");
        const res = await fetch(`${API_BASE}/api/v1/employees/${user.id}/documents`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        setUploading(false);
        if (res.ok) documentUrl = (await res.json()).data?.fileUrl;
      }
      return api.post("/api/v1/leaves/apply", {
        leaveType: form.leaveType,
        fromDate: form.fromDate,
        toDate: effectiveTo || form.fromDate,
        reason: form.reason,
        duration: form.duration,
        ...(documentUrl && { documentUrl }),
      });
    },
    onSuccess: () => {
      toast.success("Leave application submitted");
      setForm({ leaveType: "CASUAL", duration: "FULL", fromDate: "", toDate: "", reason: "" });
      setAttachedFile(null);
      onSuccess();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? "Failed to submit leave");
    },
  });

  function handleSubmit() {
    if (!form.leaveType || !form.fromDate || !form.reason.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (!isHalfDay && !form.toDate) {
      toast.error("Please select a to date");
      return;
    }
    if (form.reason.trim().length < 5) {
      toast.error("Reason must be at least 5 characters");
      return;
    }
    applyMut.mutate();
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <h2 className="font-semibold text-gray-900 mb-0.5">Apply for Leave</h2>
      <p className="text-xs text-gray-400 mb-5">Fill in the details below and submit your request.</p>

      <div className="space-y-4">
        {/* Leave type + duration on same row */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Leave type</label>
            <select
              value={form.leaveType}
              onChange={(e) => set("leaveType", e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {LEAVE_TYPES.map((t) => {
                const b = balances.find((x) => x.leaveType === t);
                return (
                  <option key={t} value={t}>
                    {LEAVE_LABEL[t]}{b ? ` (${b.balance} left)` : ""}
                  </option>
                );
              })}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Duration</label>
            <div className="flex rounded-xl overflow-hidden border border-gray-200">
              {(["FULL", "FIRST_HALF", "SECOND_HALF"] as const).map((d, i) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => set("duration", d)}
                  className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
                    form.duration === d
                      ? "bg-blue-600 text-white"
                      : "bg-white text-gray-500 hover:bg-gray-50"
                  } ${i > 0 ? "border-l border-gray-200" : ""}`}
                >
                  {d === "FULL" ? "Full day" : d === "FIRST_HALF" ? "First half" : "Second half"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">From</label>
            <input
              type="date"
              value={form.fromDate}
              onChange={(e) => set("fromDate", e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">To</label>
            <input
              type="date"
              value={effectiveTo}
              onChange={(e) => !isHalfDay && set("toDate", e.target.value)}
              disabled={isHalfDay}
              min={form.fromDate}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
            />
          </div>
        </div>

        {/* Reason */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Reason</label>
          <textarea
            rows={3}
            value={form.reason}
            onChange={(e) => set("reason", e.target.value)}
            placeholder="Brief reason for leave…"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Attachment */}
        {attachedFile ? (
          <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 px-3 py-2">
            <div className="flex items-center gap-2 text-sm text-blue-700 min-w-0">
              <Paperclip className="h-4 w-4 shrink-0" />
              <span className="truncate">{attachedFile.name}</span>
            </div>
            <button type="button" onClick={() => setAttachedFile(null)} className="text-blue-400 hover:text-red-500 ml-2">
              <XCircle className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 w-full border border-dashed border-gray-200 rounded-xl px-3 py-2.5 text-xs text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors"
          >
            <Paperclip className="h-3.5 w-3.5" />
            Attach medical record / certificate (PDF, JPG, PNG · max 5 MB)
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) setAttachedFile(f); e.target.value = ""; }}
        />

        {/* Request summary bar */}
        {previewDays > 0 && (
          <div className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Request summary</p>
              <p className="text-sm font-bold text-gray-900">
                {previewDays} working {previewDays === 1 ? "day" : "days"} · {LEAVE_LABEL[form.leaveType]}
                {isHalfDay ? ` (${form.duration === "FIRST_HALF" ? "First" : "Second"} half)` : ""}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">Balance after approval</p>
              <p className={`text-sm font-bold ${balanceAfter === 0 ? "text-red-500" : "text-gray-800"}`}>
                {balanceAfter} {balanceAfter === 1 ? "day" : "days"}
              </p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={applyMut.isPending || uploading}
            className="px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {uploading ? "Uploading…" : applyMut.isPending ? "Submitting…" : "Submit Request"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Leave History ─────────────────────────────────────────────────────────────

function LeaveHistory({
  leaves,
  onCancel,
}: {
  leaves: LeaveApplication[];
  onCancel: (id: string) => void;
}) {
  const [filter, setFilter] = useState<"ALL" | "PENDING" | "APPROVED">("ALL");

  const filtered = leaves.filter((l) => {
    if (filter === "PENDING")  return l.status === "PENDING";
    if (filter === "APPROVED") return l.status === "APPROVED";
    return true;
  });

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
        <div>
          <h2 className="font-semibold text-gray-900">Leave History</h2>
          <p className="text-xs text-gray-400 mt-0.5">Recent applications and approval status.</p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {(["ALL", "PENDING", "APPROVED"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                filter === f ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center px-6">
          <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-3">
            <CalendarDays className="h-6 w-6 text-blue-400" />
          </div>
          <p className="text-sm font-medium text-gray-600">No leave applications yet</p>
          <p className="text-xs text-gray-400 mt-1">Your submitted leave requests will appear here with approval status and balance impact.</p>
        </div>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-50">
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Type</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Dates</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Days</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Approver</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Applied</th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map((l) => {
              const sameDay = l.fromDate.slice(0, 10) === l.toDate.slice(0, 10);
              const dateStr = sameDay
                ? fmtShort(l.fromDate)
                : `${fmtShort(l.fromDate)} – ${fmtShort(l.toDate)}`;
              const dayStr = sameDay
                ? fmtDayName(l.fromDate)
                : `${fmtDayName(l.fromDate)} – ${fmtDayName(l.toDate)}`;

              return (
                <tr key={l.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="text-sm font-semibold text-gray-800">{LEAVE_LABEL[l.leaveType] ?? l.leaveType}</p>
                    <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[140px]">{l.reason}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-gray-700">{dateStr}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{dayStr}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">{l.totalDays}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[l.status] ?? "bg-gray-100 text-gray-500"}`}>
                      {l.status.charAt(0) + l.status.slice(1).toLowerCase()}
                    </span>
                    {l.rejectionNote && (
                      <p className="text-xs text-red-400 mt-0.5">{l.rejectionNote}</p>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {l.approver ? `${l.approver.firstName} ${l.approver.lastName}` : "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-400">{fmtShort(l.createdAt)}</td>
                  <td className="px-6 py-4 text-right">
                    {l.status === "PENDING" && (
                      <button
                        onClick={() => onCancel(l.id)}
                        className="text-xs text-red-400 hover:text-red-600 font-medium"
                      >
                        Cancel
                      </button>
                    )}
                    {l.documentUrl && (
                      <a
                        href={`${API_BASE}${l.documentUrl}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-3 text-xs text-blue-400 hover:underline"
                      >
                        Doc
                      </a>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Current Request Tracker ───────────────────────────────────────────────────

function CurrentRequest({ leaves }: { leaves: LeaveApplication[] }) {
  const latest = leaves.find((l) => l.status === "PENDING") ?? leaves[0];

  if (!latest) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Current Request</h3>
        <div className="flex flex-col items-center py-6 text-center">
          <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-2 text-sm font-bold text-blue-600">
            LV
          </div>
          <p className="text-sm font-medium text-gray-700 mt-1">No leave applications yet</p>
          <p className="text-xs text-gray-400 mt-1 leading-relaxed">
            Your submitted leave requests will appear here with approval status and balance impact.
          </p>
        </div>
      </div>
    );
  }

  const steps = [
    {
      label: "Submitted",
      desc: `Request created on ${fmtShort(latest.createdAt)}.`,
      done: true,
      active: latest.status === "PENDING",
    },
    {
      label: "Manager review",
      desc: latest.approver
        ? `Reviewed by ${latest.approver.firstName} ${latest.approver.lastName}.`
        : "Waiting for manager to approve.",
      done: latest.status !== "PENDING",
      active: latest.status === "PENDING",
    },
    {
      label: "HR update",
      desc: latest.status === "APPROVED"
        ? "Balance updated."
        : latest.status === "REJECTED"
        ? "Request rejected."
        : "Balance updates after approval.",
      done: latest.status === "APPROVED",
      active: false,
    },
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h3 className="font-semibold text-gray-900 mb-1">Current Request</h3>
      <p className="text-xs text-gray-400 mb-4">
        {LEAVE_LABEL[latest.leaveType]} · {fmtShort(latest.fromDate)}
        {latest.fromDate !== latest.toDate ? ` – ${fmtShort(latest.toDate)}` : ""}
      </p>
      <div className="space-y-3">
        {steps.map((step, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
              step.done
                ? "bg-green-500 text-white"
                : step.active
                ? "bg-orange-400 text-white"
                : "bg-gray-100 text-gray-400"
            }`}>
              {i + 1}
            </div>
            <div>
              <p className={`text-sm font-semibold ${step.done || step.active ? "text-gray-800" : "text-gray-400"}`}>
                {step.label}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">{step.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Policy Snapshot ───────────────────────────────────────────────────────────

function PolicySnapshot({ balances }: { balances: LeaveBalance[] }) {
  const shown = balances.filter((b) => b.allocated > 0).slice(0, 4);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h3 className="font-semibold text-gray-900 mb-3">Policy Snapshot</h3>
      <div className="space-y-2.5">
        {shown.map((b) => (
          <div key={b.leaveType} className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-800">{LEAVE_LABEL[b.leaveType]}</p>
              <p className="text-xs text-gray-400 mt-0.5">{POLICY_NOTES[b.leaveType] ?? "—"}</p>
            </div>
            <span className="text-xs font-medium text-gray-500 shrink-0 mt-0.5">
              {b.allocated > 0 ? `${b.allocated}/year` : "Accrued"}
            </span>
          </div>
        ))}
      </div>
      {shown.length === 0 && (
        <p className="text-xs text-gray-400 text-center py-4">No leave policy assigned yet.</p>
      )}
    </div>
  );
}

// ── Pending Approvals (for managers/HR) ───────────────────────────────────────

function PendingApprovals() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const isApprover = user?.role !== "EMPLOYEE";

  const { data: pending = [] } = useQuery({
    queryKey: ["pending-leaves"],
    queryFn: () => api.get("/api/v1/leaves/pending").then((r) => r.data.data),
    enabled: isApprover,
  });

  const decisionMut = useMutation({
    mutationFn: ({ id, action, note }: { id: string; action: string; note?: string }) =>
      api.patch(`/api/v1/leaves/${id}/decision`, { action, note }),
    onSuccess: () => {
      toast.success("Decision recorded");
      queryClient.invalidateQueries({ queryKey: ["pending-leaves"] });
      queryClient.invalidateQueries({ queryKey: ["my-leaves"] });
      queryClient.invalidateQueries({ queryKey: ["my-leave-balances"] });
    },
    onError: () => toast.error("Failed to record decision"),
  });

  if (!isApprover || pending.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-orange-100 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-orange-50 flex items-center gap-2">
        <Clock className="h-4 w-4 text-orange-500" />
        <h2 className="font-semibold text-gray-900">Pending Approvals</h2>
        <span className="ml-auto text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-medium">{pending.length}</span>
      </div>
      <div className="divide-y divide-gray-50">
        {pending.map((leave: {
          id: string;
          leaveType: string;
          fromDate: string;
          toDate: string;
          totalDays: number;
          reason: string;
          documentUrl?: string;
          employee: { firstName: string; lastName: string; department: { name: string } };
        }) => (
          <div key={leave.id} className="flex items-center justify-between px-6 py-4 gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-800">
                {leave.employee.firstName} {leave.employee.lastName}
                <span className="ml-2 text-xs font-normal text-gray-400">{leave.employee.department.name}</span>
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {LEAVE_LABEL[leave.leaveType]} · {fmtShort(leave.fromDate)}
                {leave.fromDate !== leave.toDate ? ` – ${fmtShort(leave.toDate)}` : ""}
                {" "}({leave.totalDays} {leave.totalDays === 1 ? "day" : "days"})
              </p>
              <p className="text-xs text-gray-400 mt-0.5 truncate">{leave.reason}</p>
              {leave.documentUrl && (
                <a href={`${API_BASE}${leave.documentUrl}`} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-blue-500 hover:underline">View document</a>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => decisionMut.mutate({ id: leave.id, action: "APPROVED" })}
                disabled={decisionMut.isPending}
                className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >Approve</button>
              <button
                onClick={() => decisionMut.mutate({ id: leave.id, action: "REJECTED", note: "Not approved" })}
                disabled={decisionMut.isPending}
                className="px-3 py-1.5 text-xs bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50"
              >Reject</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LeavesPage() {
  const queryClient = useQueryClient();

  const { data: balances = [] } = useQuery<LeaveBalance[]>({
    queryKey: ["my-leave-balances"],
    queryFn: () => api.get("/api/v1/leaves/balances").then((r) => r.data.data),
  });

  const { data: leaves = [] } = useQuery<LeaveApplication[]>({
    queryKey: ["my-leaves"],
    queryFn: () => api.get("/api/v1/leaves/my").then((r) => r.data.data),
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => api.patch(`/api/v1/leaves/${id}/cancel`),
    onSuccess: () => {
      toast.success("Leave cancelled");
      queryClient.invalidateQueries({ queryKey: ["my-leaves"] });
      queryClient.invalidateQueries({ queryKey: ["my-leave-balances"] });
    },
    onError: () => toast.error("Failed to cancel leave"),
  });

  function invalidateLeaves() {
    queryClient.invalidateQueries({ queryKey: ["my-leaves"] });
    queryClient.invalidateQueries({ queryKey: ["my-leave-balances"] });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-600 mb-1">Time Away</p>
            <h1 className="text-3xl font-bold text-gray-900">Leaves</h1>
            <p className="text-sm text-gray-400 mt-1.5 max-w-md leading-relaxed">
              Check available leave, submit a request, and track approvals in one place.
            </p>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <a
              href="/dashboard/holidays"
              className="flex items-center gap-1.5 px-4 py-2 text-sm border border-gray-200 rounded-xl bg-white hover:bg-gray-50 text-gray-700 transition-colors shadow-sm"
            >
              <CalendarDays className="h-4 w-4" /> View Holiday Calendar
            </a>
            <a
              href="#apply"
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4" /> Apply for Leave
            </a>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="flex gap-6 items-start">

          {/* Left — main content */}
          <div className="flex-1 min-w-0 space-y-5">
            <BalanceSection balances={balances} />
            <PendingApprovals />
            <div id="apply">
              <ApplyForm balances={balances} onSuccess={invalidateLeaves} />
            </div>
            <LeaveHistory leaves={leaves} onCancel={(id) => cancelMut.mutate(id)} />
          </div>

          {/* Right — sidebar */}
          <div className="w-72 shrink-0 space-y-4">
            <CurrentRequest leaves={leaves} />
            <PolicySnapshot balances={balances} />
          </div>
        </div>
      </div>
    </div>
  );
}
