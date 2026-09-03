"use client";

import { useState, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth";
import { CalendarDays, Plus, Paperclip, XCircle, ChevronRight, ChevronDown, Clock, AlertTriangle, X, FileText, CheckCircle2, Users, Trash2, Heart, Calendar, CalendarOff, Info, Search } from "lucide-react";

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
  PENDING:              "bg-yellow-100 text-yellow-700",
  APPROVED:             "bg-green-100 text-green-700",
  REJECTED:             "bg-red-100 text-red-600",
  CANCELLED:            "bg-gray-100 text-gray-400",
  CANCELLATION_PENDING: "bg-amber-100 text-amber-700",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING:              "Pending",
  APPROVED:             "Approved",
  REJECTED:             "Rejected",
  CANCELLED:            "Cancelled",
  CANCELLATION_PENDING: "Cancellation pending",
};

function statusLabel(status: string) {
  return STATUS_LABEL[status] ?? status.charAt(0) + status.slice(1).toLowerCase();
}

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
  // Days credited outside the accrual curve — approved comp-offs. Counted whole
  // in `balance`, so this is only ever shown for context.
  earned:    number;
}

interface LeaveBalancesResponse {
  data:    LeaveBalance[];
  lopDays: number;
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
  cancelReason?:        string | null;
  cancelRequestedAt?:   string | null;
  cancelRejectionNote?: string | null;
  cancelApprover?:      { firstName: string; lastName: string } | null;
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

const MS_PER_DAY = 86_400_000;

/**
 * The span charged for a leave running `from` … `to`, both ends inclusive: total
 * days, plus how many of them are Sundays the sandwich rule pulled in (the
 * apply form explains that second number). Mirrors `countLeaveDays` in the API
 * (apps/api/src/utils/leave.ts) — this only previews what the server will store.
 *
 * The office works Monday–Saturday and the sandwich rule charges non-working
 * days that fall inside a leave span, so every calendar day in the range counts.
 * Sundays at the ends are trimmed — nobody works a Sunday, so a range that
 * opens or closes on one isn't charged for it.
 *
 * Date inputs give `YYYY-MM-DD`, which parses to UTC midnight, hence the UTC
 * accessors: `getDay()` would report the previous day in a negative-offset zone.
 */
function chargedSpan(from: Date, to: Date) {
  let start = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  let end   = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  while (start <= end && new Date(start).getUTCDay() === 0) start += MS_PER_DAY;
  while (end >= start && new Date(end).getUTCDay() === 0) end -= MS_PER_DAY;
  if (start > end) return { start: 0, end: 0, days: 0, sundays: 0 };

  let sundays = 0;
  for (let cur = start; cur <= end; cur += MS_PER_DAY) {
    if (new Date(cur).getUTCDay() === 0) sundays++;
  }
  return { start, end, days: Math.round((end - start) / MS_PER_DAY) + 1, sundays };
}

/**
 * The dates a partial LoP lands on, latest first — payroll counts LoP days back
 * from the last day of the leave, so an approver marking 3 of 5 days needs to see
 * *which* three. Mirrors `lopDaysInMonth` in apps/api/src/utils/leave.ts.
 */
function lopDayLabels(fromIso: string, toIso: string, lopDays: number): string[] {
  const span = chargedSpan(new Date(fromIso), new Date(toIso));
  if (!span.days || lopDays <= 0) return [];

  const labels: string[] = [];
  let remaining = lopDays;
  for (let day = span.end; day >= span.start && remaining > 0; day -= MS_PER_DAY) {
    const charge = Math.min(1, remaining);
    labels.push(`${fmtShort(new Date(day).toISOString())}${charge < 1 ? " (half)" : ""}`);
    remaining -= charge;
  }
  return labels;
}

/**
 * Free-text match for the HR leave lists. Every whitespace-separated term has to
 * appear somewhere in the row, so "priya casual" narrows instead of widening.
 */
function matchesLeaveSearch(query: string, fields: (string | null | undefined)[]) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = fields.filter(Boolean).join(" ").toLowerCase();
  return q.split(/\s+/).every((term) => haystack.includes(term));
}

/** Search box for the HR leave lists — full width on mobile, fixed inline on desktop. */
function LeaveSearchInput({ value, onChange, placeholder }: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative w-full sm:w-72">
      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded-xl pl-9 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
          aria-label="Clear search"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

// ── Reason Prompt ─────────────────────────────────────────────────────────────

/**
 * Small confirm dialog that collects a written reason. Every destructive or
 * override action here needs one: cancellations go to an approver who wasn't in
 * the room, and admin deletions survive only as an audit-log entry.
 */
function ReasonPromptModal({
  title, description, label, placeholder, confirmLabel, tone = "danger",
  required = true, isPending, onConfirm, onClose,
}: {
  title: string;
  description: string;
  label: string;
  placeholder: string;
  confirmLabel: string;
  tone?: "danger" | "warning";
  required?: boolean;
  isPending?: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const disabled = (required && !reason.trim()) || !!isPending;
  const accent = tone === "danger"
    ? { box: "border-red-200 bg-red-50", icon: "text-red-500", btn: "bg-red-600 hover:bg-red-700" }
    : { box: "border-amber-200 bg-amber-50", icon: "text-amber-500", btn: "bg-amber-600 hover:bg-amber-700" };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between px-5 sm:px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 shrink-0 ml-3">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-5 sm:px-6 py-5 space-y-4">
          <div className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 ${accent.box}`}>
            <AlertTriangle className={`h-4 w-4 shrink-0 mt-0.5 ${accent.icon}`} />
            <p className="text-sm text-gray-700">{description}</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              {label} {required && <span className="text-red-500">*</span>}
            </label>
            <textarea
              rows={3}
              autoFocus
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={placeholder}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-5 sm:px-6 pb-5">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Keep it
          </button>
          <button
            onClick={() => onConfirm(reason.trim())}
            disabled={disabled}
            className={`px-4 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-50 transition-colors ${accent.btn}`}
          >
            {isPending ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Holiday Calendar Modal ────────────────────────────────────────────────────

interface HolidayEntry {
  id: string;
  name: string;
  fromDate: string;
  toDate: string;
  year: number;
  numberOfDays: number;
  description?: string | null;
}

function HolidayCalendarModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === "SUPER_ADMIN" || user?.role === "HR_ADMIN";
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", fromDate: "", toDate: "" });

  const { data: holidays = [], isLoading } = useQuery<HolidayEntry[]>({
    queryKey: ["holidays", selectedYear],
    queryFn: () => api.get(`/api/v1/holidays?year=${selectedYear}`).then((r) => r.data.data),
  });

  const createMut = useMutation({
    mutationFn: (body: object) => api.post("/api/v1/holidays", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holidays", selectedYear] });
      setShowAddForm(false);
      setAddForm({ name: "", fromDate: "", toDate: "" });
      toast.success("Holiday added");
    },
    onError: () => toast.error("Failed to add holiday"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/holidays/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holidays", selectedYear] });
      toast.success("Holiday deleted");
    },
    onError: () => toast.error("Failed to delete holiday"),
  });

  function handleAdd() {
    if (!addForm.name.trim() || !addForm.fromDate || !addForm.toDate) {
      toast.error("Please fill all fields");
      return;
    }
    createMut.mutate({
      name: addForm.name,
      fromDate: new Date(addForm.fromDate).toISOString(),
      toDate: new Date(addForm.toDate).toISOString(),
    });
  }

  const years = [currentYear - 1, currentYear, currentYear + 1];
  const totalDays = holidays.reduce((s, h) => s + h.numberOfDays, 0);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Holiday Calendar</h2>
            <p className="text-sm text-gray-500 mt-1">
              {isAdmin ? "Manage official holidays for the year." : "View official holidays for the year."}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Year selector + admin actions */}
        <div className="p-6 border-b border-gray-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex gap-2">
              {years.map((yr) => (
                <button
                  key={yr}
                  onClick={() => setSelectedYear(yr)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    selectedYear === yr ? "text-white" : "text-gray-700 bg-gray-100 hover:bg-gray-200"
                  }`}
                  style={selectedYear === yr ? { backgroundColor: "#2C3E7C" } : {}}
                >
                  {yr}
                </button>
              ))}
            </div>
            {isAdmin && (
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="px-4 py-2 rounded-md text-sm font-medium text-white flex items-center gap-2"
                style={{ backgroundColor: "#2C3E7C" }}
              >
                <Plus size={18} />
                Add Holiday
              </button>
            )}
          </div>

          {showAddForm && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
              <h4 className="text-sm font-semibold text-gray-900">New Holiday</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  placeholder="Holiday name"
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 bg-white"
                />
                <div>
                  <label className="block text-xs text-gray-500 mb-1">From Date</label>
                  <input
                    type="date" max="2099-12-31" min="1900-01-01"
                    value={addForm.fromDate}
                    onChange={(e) => setAddForm({ ...addForm, fromDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">To Date</label>
                  <input
                    type="date" max="2099-12-31"
                    value={addForm.toDate}
                    min={addForm.fromDate}
                    onChange={(e) => setAddForm({ ...addForm, toDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 bg-white"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAdd}
                  disabled={createMut.isPending}
                  className="px-4 py-2 rounded-md text-sm font-medium text-white disabled:opacity-50"
                  style={{ backgroundColor: "#2C3E7C" }}
                >
                  {createMut.isPending ? "Adding…" : "Add Holiday"}
                </button>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Holiday list */}
        <div className="p-6">
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-6 py-4" style={{ backgroundColor: "#2C3E7C" }}>
              <h3 className="text-base font-semibold text-white text-center uppercase tracking-wide">
                Employees' Holiday List — {selectedYear}
              </h3>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full" />
              </div>
            ) : holidays.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Holiday</th>
                      <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider border-l border-gray-200">From</th>
                      <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider border-l border-gray-200">To</th>
                      <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider border-l border-gray-200">Days</th>
                      {isAdmin && (
                        <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider border-l border-gray-200">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {holidays.map((h) => (
                      <tr key={h.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{h.name}</td>
                        <td className="px-6 py-4 border-l border-gray-200 text-sm text-gray-700 text-center">
                          {new Date(h.fromDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                          <span className="text-gray-400 ml-1.5">
                            {new Date(h.fromDate).toLocaleDateString("en-IN", { weekday: "short" })}
                          </span>
                        </td>
                        <td className="px-6 py-4 border-l border-gray-200 text-sm text-gray-700 text-center">
                          {new Date(h.toDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                          <span className="text-gray-400 ml-1.5">
                            {new Date(h.toDate).toLocaleDateString("en-IN", { weekday: "short" })}
                          </span>
                        </td>
                        <td className="px-6 py-4 border-l border-gray-200 text-sm text-gray-900 text-center font-medium">
                          {h.numberOfDays}
                        </td>
                        {isAdmin && (
                          <td className="px-6 py-4 border-l border-gray-200 text-center">
                            <button
                              onClick={() => deleteMut.mutate(h.id)}
                              disabled={deleteMut.isPending}
                              className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-red-600 disabled:opacity-50"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center">
                <CalendarDays className="mx-auto text-gray-300 mb-4" size={48} />
                <p className="text-base font-medium text-gray-900 mb-1">No holidays for {selectedYear}</p>
                {isAdmin && <p className="text-sm text-gray-500">Use "Add Holiday" to declare the first one.</p>}
              </div>
            )}
          </div>

          {holidays.length > 0 && (
            <div className="mt-4 flex items-center justify-between px-1">
              <p className="text-sm text-gray-600">Total Holidays: <span className="font-semibold text-gray-900">{holidays.length}</span></p>
              <p className="text-sm text-gray-600">Total Days: <span className="font-semibold text-gray-900">{totalDays}</span></p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end p-6 border-t border-gray-200 bg-gray-50">
          <button onClick={onClose} className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 bg-white">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Apply Leave Modal ─────────────────────────────────────────────────────────

function ApplyLeaveModal({ balances, onClose }: { balances: LeaveBalance[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Apply for Leave</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>
        <div className="p-6">
          <ApplyForm balances={balances} onSuccess={onClose} />
        </div>
      </div>
    </div>
  );
}

// ── Review Leave Modal ────────────────────────────────────────────────────────

function ReviewLeaveModal({
  leave,
  onClose,
  onDecide,
  isPending: decisionPending,
}: {
  leave: PendingLeave;
  onClose: () => void;
  onDecide: (id: string, action: "APPROVED" | "REJECTED", lopDays?: number, note?: string) => void;
  isPending: boolean;
}) {
  const [decision, setDecision] = useState<"approve" | "reject" | null>(null);
  const [comments, setComments] = useState("");
  // An unpaid leave carries loss of pay by definition, so the toggle starts on
  // for it. Approving with it off sends an explicit 0, which the API reads as a
  // waiver — that must be a deliberate click, not the default.
  const [lopEnabled, setLopEnabled] = useState(leave.leaveType === "UNPAID");
  const [lopDays, setLopDays] = useState(leave.totalDays);

  const lopDates = useMemo(
    () => lopDayLabels(leave.fromDate, leave.toDate, lopDays),
    [leave.fromDate, leave.toDate, lopDays],
  );

  function handleSubmit() {
    if (!decision) return;
    if (!comments.trim()) { toast.error("Manager notes are required"); return; }
    if (decision === "approve") {
      onDecide(leave.id, "APPROVED", lopEnabled ? lopDays : 0, comments);
    } else {
      onDecide(leave.id, "REJECTED", 0, comments);
    }
    onClose();
  }

  const initials = `${leave.employee.firstName[0]}${leave.employee.lastName[0]}`;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Review Leave Request</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Employee */}
          <div className="bg-gray-50 rounded-lg p-4 flex items-center gap-3">
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold shrink-0"
              style={{ backgroundColor: "#2C3E7C" }}>
              {initials}
            </div>
            <div>
              <p className="font-semibold text-gray-900">{leave.employee.firstName} {leave.employee.lastName}</p>
              <p className="text-sm text-gray-500">{leave.employee.department?.name}</p>
            </div>
          </div>

          {/* Leave details grid */}
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Leave Type", value: LEAVE_LABEL[leave.leaveType] ?? leave.leaveType },
              { label: "Duration", value: `${leave.totalDays} ${leave.totalDays === 1 ? "day" : "days"}` },
              { label: "From Date", value: fmtShort(leave.fromDate) },
              { label: "To Date", value: fmtShort(leave.toDate) },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white border border-gray-200 rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-1">{label}</p>
                <p className="text-sm font-medium text-gray-900">{value}</p>
              </div>
            ))}
          </div>

          {/* Reason */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <FileText size={15} /> Reason
            </p>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-sm text-gray-700">{leave.reason}</p>
            </div>
          </div>

          {leave.documentUrl && (
            <a href={`${API_BASE}${leave.documentUrl}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700 hover:bg-blue-100 transition-colors">
              <FileText size={16} /> View attached document
            </a>
          )}

          {/* Decision buttons */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-3">Your Decision</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setDecision("approve")}
                className={`p-4 rounded-lg border-2 transition-all flex items-center gap-3 ${
                  decision === "approve" ? "border-green-500 bg-green-50" : "border-gray-200 hover:border-green-300"
                }`}
              >
                <CheckCircle2 size={24} className={decision === "approve" ? "text-green-600" : "text-gray-400"} />
                <div className="text-left">
                  <p className={`text-sm font-medium ${decision === "approve" ? "text-green-900" : "text-gray-700"}`}>Approve</p>
                  <p className="text-xs text-gray-500">Grant leave request</p>
                </div>
              </button>
              <button
                onClick={() => setDecision("reject")}
                className={`p-4 rounded-lg border-2 transition-all flex items-center gap-3 ${
                  decision === "reject" ? "border-red-500 bg-red-50" : "border-gray-200 hover:border-red-300"
                }`}
              >
                <XCircle size={24} className={decision === "reject" ? "text-red-600" : "text-gray-400"} />
                <div className="text-left">
                  <p className={`text-sm font-medium ${decision === "reject" ? "text-red-900" : "text-gray-700"}`}>Reject</p>
                  <p className="text-xs text-gray-500">Decline request</p>
                </div>
              </button>
            </div>
          </div>

          {/* LOP toggle when approving */}
          {decision === "approve" && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 space-y-3">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div
                  onClick={() => setLopEnabled((e) => !e)}
                  className={`w-9 h-5 rounded-full relative transition-colors ${lopEnabled ? "bg-rose-500" : "bg-gray-300"}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${lopEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
                </div>
                <span className="text-sm text-gray-700">Approve with <span className="font-semibold text-rose-600">Loss of Pay</span></span>
              </label>
              {lopEnabled && (
                <div className="space-y-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-xs text-gray-600">LoP days:</span>
                    <input
                      type="number" min={0.5} max={leave.totalDays} step={0.5}
                      value={lopDays}
                      onChange={(e) => setLopDays(Math.min(leave.totalDays, Math.max(0, parseFloat(e.target.value) || 0)))}
                      className="w-20 border border-rose-200 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-rose-400 bg-white"
                    />
                    <span className="text-xs text-gray-400">of {leave.totalDays} total days</span>
                  </div>
                  {/* Payroll counts LoP back from the last day — name the dates so
                      the approver isn't guessing which end gets docked. */}
                  {lopDates.length > 0 && (
                    <p className="text-xs text-rose-700">
                      Deducted from <span className="font-medium">{lopDates.join(", ")}</span>
                      {" — "}counted back from the last day of the leave.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Manager notes */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <FileText size={15} /> Manager Notes <span className="text-red-600">*</span>
              <span className="text-xs text-gray-500 font-normal">(Required for record purposes)</span>
            </p>
            <textarea
              placeholder={
                decision === "approve" ? "Add notes for approval record…" :
                decision === "reject" ? "Please provide a clear reason for rejection…" :
                "Make a decision above to add notes"
              }
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={3}
              disabled={!decision}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 resize-none disabled:bg-gray-50 disabled:text-gray-400"
            />
          </div>

          {decision === "reject" && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-2">
              <AlertTriangle size={18} className="text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-900">This action will notify the employee</p>
                <p className="text-xs text-red-700 mt-1">Please provide a clear reason so the employee understands your decision.</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          <button onClick={onClose} className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!decision || !comments.trim() || decisionPending}
            className={`px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-colors ${
              decision === "approve" ? "bg-green-600 hover:bg-green-700" :
              decision === "reject" ? "bg-red-600 hover:bg-red-700" :
              "bg-gray-300 cursor-not-allowed"
            }`}
          >
            {decisionPending ? "Saving…" :
              decision === "approve" ? "Approve Leave" :
              decision === "reject" ? "Reject Leave" :
              "Submit Decision"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── LOP Approval Modal ────────────────────────────────────────────────────────

function LOPApprovalModal({
  leave,
  onClose,
  onDecide,
  isPending: decisionPending,
}: {
  leave: PendingLeave;
  onClose: () => void;
  onDecide: (id: string, action: "APPROVED" | "REJECTED", lopDays?: number, note?: string) => void;
  isPending: boolean;
}) {
  const [decision, setDecision] = useState<"approve" | "waive" | null>(null);
  const [notes, setNotes] = useState("");

  function handleSubmit() {
    if (!decision || !notes.trim()) { toast.error("Notes are required"); return; }
    onDecide(leave.id, "APPROVED", decision === "approve" ? leave.totalDays : 0, notes);
    onClose();
  }

  const initials = `${leave.employee.firstName[0]}${leave.employee.lastName[0]}`;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-red-50">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Loss of Pay Review</h2>
            <p className="text-sm text-gray-600 mt-1">Handle with care — this impacts employee compensation</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-red-100 rounded-lg transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Employee */}
          <div className="bg-gray-50 rounded-lg p-4 flex items-center gap-3">
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold shrink-0"
              style={{ backgroundColor: "#2C3E7C" }}>
              {initials}
            </div>
            <div>
              <p className="font-semibold text-gray-900">{leave.employee.firstName} {leave.employee.lastName}</p>
              <p className="text-sm text-gray-500">{leave.employee.department?.name}</p>
            </div>
          </div>

          {/* LOP details */}
          <div className="bg-red-50 border-2 border-red-200 rounded-lg p-5">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="text-red-600 shrink-0" size={24} />
              <div>
                <h3 className="text-base font-semibold text-red-900 mb-1">Loss of Pay Triggered</h3>
                <p className="text-sm text-red-700">{leave.reason}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">LOP Days</p>
                <p className="text-2xl font-bold text-red-600">{leave.totalDays} {leave.totalDays === 1 ? "day" : "days"}</p>
              </div>
              <div className="bg-white rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Period</p>
                <p className="text-sm font-semibold text-gray-900">
                  {fmtShort(leave.fromDate)}{leave.fromDate !== leave.toDate ? ` – ${fmtShort(leave.toDate)}` : ""}
                </p>
              </div>
            </div>
          </div>

          {/* Decision */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-3">Your Decision</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setDecision("approve")}
                className={`p-4 rounded-lg border-2 transition-all ${decision === "approve" ? "border-red-500 bg-red-50" : "border-gray-200 hover:border-red-300"}`}
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle size={24} className={decision === "approve" ? "text-red-600" : "text-gray-400"} />
                  <div className="text-left">
                    <p className={`text-sm font-medium ${decision === "approve" ? "text-red-900" : "text-gray-700"}`}>Approve LOP</p>
                    <p className="text-xs text-gray-500 mt-1">Deduct from salary</p>
                  </div>
                </div>
              </button>
              <button
                onClick={() => setDecision("waive")}
                className={`p-4 rounded-lg border-2 transition-all ${decision === "waive" ? "border-green-500 bg-green-50" : "border-gray-200 hover:border-green-300"}`}
              >
                <div className="flex items-start gap-3">
                  <Heart size={24} className={decision === "waive" ? "text-green-600" : "text-gray-400"} />
                  <div className="text-left">
                    <p className={`text-sm font-medium ${decision === "waive" ? "text-green-900" : "text-gray-700"}`}>Waive LOP</p>
                    <p className="text-xs text-gray-500 mt-1">Excuse absence, no deduction</p>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Notes */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Manager Notes <span className="text-red-600">*</span></p>
            <textarea
              placeholder={
                decision === "waive"
                  ? "Justification for waiving LOP (e.g., exceptional circumstances, medical emergency)…"
                  : "Add notes for record keeping…"
              }
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 resize-none"
            />
          </div>

          {decision === "approve" && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-2">
              <AlertTriangle size={18} className="text-red-600 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">This will impact the employee's next salary. The deduction will be processed in the upcoming payroll cycle.</p>
            </div>
          )}
          {decision === "waive" && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-2">
              <Heart size={18} className="text-green-600 shrink-0 mt-0.5" />
              <p className="text-sm text-green-700">Waiving LOP shows understanding and support during difficult times. The employee will be notified.</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <p className="text-xs text-gray-500 max-w-xs">This decision will be recorded in the employee's file and reviewed during performance evaluations.</p>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button
              onClick={handleSubmit}
              disabled={!decision || !notes.trim() || decisionPending}
              className={`px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-colors ${
                decision === "approve" ? "bg-red-600 hover:bg-red-700" :
                decision === "waive" ? "bg-green-600 hover:bg-green-700" :
                "bg-gray-300 cursor-not-allowed"
              }`}
            >
              {decisionPending ? "Saving…" :
                decision === "approve" ? "Confirm LOP" :
                decision === "waive" ? "Waive LOP" :
                "Submit Decision"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Leave Balance Cards ────────────────────────────────────────────────────────

function BalanceSection({ balances, lopDays }: { balances: LeaveBalance[]; lopDays: number }) {
  const [open, setOpen] = useState(true);
  const fy = getFiscalYear();
  const totalAllocated = balances.reduce((s, b) => s + b.allocated, 0);
  // Always show at least Casual and Sick as the first two cards, even with no policy
  const DEFAULT_CARDS: LeaveBalance[] = [
    { leaveType: "CASUAL", allocated: 0, accrued: 0, availed: 0, pending: 0, balance: 0, used: 0, carried: 0, earned: 0 },
    { leaveType: "SICK",   allocated: 0, accrued: 0, availed: 0, pending: 0, balance: 0, used: 0, carried: 0, earned: 0 },
  ];
  const cardTypes = balances.length >= 2
    ? balances.slice(0, 2)
    : [
        balances.find((b) => b.leaveType === "CASUAL") ?? DEFAULT_CARDS[0],
        balances.find((b) => b.leaveType === "SICK")   ?? DEFAULT_CARDS[1],
      ];
  const pillTypes = balances.slice(2);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="text-left">
          <h2 className="font-semibold text-gray-900">Leave Balance</h2>
          <p className="text-xs text-gray-400 mt-0.5">FY {fy}–{fy + 1} · Accrued monthly</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">{totalAllocated} days annual entitlement</span>
          <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      {open && (
        <>
          <div className="px-6 pb-4 grid grid-cols-3 gap-3">
            {cardTypes.map((b) => {
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

            {/* Loss of Pay card — always shown as 3rd card */}
            <div className="bg-rose-50 border border-rose-100 rounded-xl p-4">
              <p className="text-xs font-bold uppercase tracking-wider mb-2 text-rose-600">Loss of Pay</p>
              <p className="text-4xl font-bold text-rose-600 mb-3">{lopDays}</p>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-gray-600">
                  <span>This FY</span><span className="font-semibold text-rose-700">{lopDays} {lopDays === 1 ? "day" : "days"}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Status</span>
                  <span className={`font-semibold ${lopDays > 0 ? "text-rose-600" : "text-green-600"}`}>
                    {lopDays > 0 ? "Deducted" : "None"}
                  </span>
                </div>
              </div>
              <div className="mt-3 h-1.5 rounded-full bg-rose-200">
                {lopDays > 0 && <div className="h-full rounded-full bg-rose-500 w-full" />}
              </div>
            </div>
          </div>

          {pillTypes.length > 0 && (
            <div className="px-6 pb-4 flex gap-2 flex-wrap">
              {pillTypes.map((b) => {
                const c = LEAVE_COLORS[b.leaveType] ?? LEAVE_COLORS.UNPAID;
                return (
                  <div key={b.leaveType} className={`${c.bg} ${c.border} border rounded-xl px-4 py-2.5 flex items-center gap-3`}>
                    <span className={`text-xs font-bold uppercase tracking-wider ${c.text}`}>
                      {LEAVE_LABEL[b.leaveType]}
                    </span>
                    <span className={`text-xl font-bold ${c.text}`}>{b.balance}</span>
                    {/* Comp-off has no annual entitlement — it is only ever earned, so
                        the denominator is the days credited, not an allocation of 0. */}
                    <span className="text-xs text-gray-400">
                      {b.allocated > 0 ? `/ ${b.allocated}` : `of ${b.earned} earned`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="px-6 py-3 border-t border-gray-50 bg-gray-50/50 flex justify-between text-xs text-gray-500">
            <span>Next accrual: {nextAccrualDate()}</span>
            <span>Medical certificate required for sick leave over 2 days</span>
          </div>
        </>
      )}
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

  // Sandwich policy: every day in the span is charged, Sundays included, so this
  // preview is a plain calendar count. 0 days means the range is all Sundays —
  // the server rejects that, and `onlySundays` says so before they submit.
  const { previewDays, sundayCount, onlySundays } = useMemo(() => {
    const empty = { previewDays: 0, sundayCount: 0, onlySundays: false };
    if (!form.fromDate) return empty;
    const from = new Date(form.fromDate);
    if (isHalfDay) {
      const ok = chargedSpan(from, from).days > 0;
      return { previewDays: ok ? 0.5 : 0, sundayCount: 0, onlySundays: !ok };
    }
    if (!form.toDate) return empty;
    const to = new Date(form.toDate);
    if (from > to) return empty;
    const span = chargedSpan(from, to);
    return { previewDays: span.days, sundayCount: span.sundays, onlySundays: span.days === 0 };
  }, [form.fromDate, form.toDate, form.duration]);

  const selectedBalance = balances.find((b) => b.leaveType === form.leaveType);
  const isInsufficient = !!selectedBalance && previewDays > 0 && previewDays > selectedBalance.balance;
  const balanceAfter = selectedBalance ? selectedBalance.balance - previewDays : 0;

  // Comp-off is a credit ledger, not an entitlement: the days exist only because
  // an approved comp-off request minted them, so there is nothing for a
  // supervisor to stretch. The server refuses these too — this just says so
  // before the round trip.
  const isCompOff = form.leaveType === "COMPENSATORY";
  const compOffAvailable = selectedBalance?.balance ?? 0;
  const compOffOverdrawn = isCompOff && previewDays > 0 && previewDays > compOffAvailable;

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
    if (!form.fromDate) {
      toast.error("Please select a start date");
      return;
    }
    if (!isHalfDay && !form.toDate) {
      toast.error("Please select an end date");
      return;
    }
    if (!form.reason.trim() || form.reason.trim().length < 5) {
      toast.error("Please enter a reason (at least 5 characters)");
      return;
    }
    if (compOffOverdrawn) {
      toast.error(`You have ${compOffAvailable} comp-off day${compOffAvailable === 1 ? "" : "s"} available`);
      return;
    }
    applyMut.mutate();
  }

  return (
    <div>
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
              type="date" max="2099-12-31" min="1900-01-01"
              value={form.fromDate}
              onChange={(e) => {
                set("fromDate", e.target.value);
                if (!form.toDate) set("toDate", e.target.value);
              }}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">To</label>
            <input
              type="date" max="2099-12-31"
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

        {/* A range of nothing but Sundays has no leave in it — the server says no too */}
        {onlySundays && (
          <div className="flex items-start gap-2.5 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
            <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
            <p className="text-xs text-orange-700">
              Sunday is not a working day. Pick a range that includes at least one working day (Monday–Saturday).
            </p>
          </div>
        )}

        {/* Request summary bar */}
        {previewDays > 0 && (
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Request summary</p>
                <p className="text-sm font-bold text-gray-900">
                  {previewDays} {previewDays === 1 ? "day" : "days"} · {LEAVE_LABEL[form.leaveType]}
                  {isHalfDay ? ` (${form.duration === "FIRST_HALF" ? "First" : "Second"} half)` : ""}
                </p>
              </div>
              <div className="sm:text-right">
                <p className="text-xs text-gray-400">Balance after approval</p>
                <p className={`text-sm font-bold ${balanceAfter < 0 ? "text-red-500" : balanceAfter === 0 ? "text-orange-500" : "text-gray-800"}`}>
                  {balanceAfter} {Math.abs(balanceAfter) === 1 ? "day" : "days"}
                </p>
              </div>
            </div>
            {sundayCount > 0 && (
              <div className="flex items-start gap-2.5 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
                <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700">
                  Includes {sundayCount} Sunday{sundayCount === 1 ? "" : "s"} under the sandwich policy — a
                  non-working day that falls inside a leave span is counted. Working days are Monday–Saturday.
                </p>
              </div>
            )}
            {compOffOverdrawn ? (
              <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-800">Not enough comp-off days</p>
                  <p className="text-xs text-red-700 mt-0.5">
                    You have {compOffAvailable} comp-off {compOffAvailable === 1 ? "day" : "days"} available but are
                    requesting {previewDays}. Comp-off can only be taken against days already approved — claim the
                    days you worked on your weekly off first.
                  </p>
                </div>
              </div>
            ) : isInsufficient && (
              <div className="flex items-start gap-2.5 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
                <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-orange-800">Insufficient leave balance</p>
                  <p className="text-xs text-orange-700 mt-0.5">
                    You have {selectedBalance!.balance} {selectedBalance!.balance === 1 ? "day" : "days"} available but are requesting {previewDays} {previewDays === 1 ? "day" : "days"}.
                    Your application will still be sent to your supervisor — approval is at their discretion.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={applyMut.isPending || uploading || compOffOverdrawn}
            className="px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {uploading ? "Uploading…" : applyMut.isPending ? "Submitting…" : "Submit Request"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Comp-off ──────────────────────────────────────────────────────────────────

/**
 * Compensatory offs: the day-back an employee earns by working a day they were
 * not due to work — a Sunday under the Mon–Sat week, a declared holiday, an
 * exam duty. Nothing is credited until the supervisor approves; approval moves
 * the days into the Comp-off leave balance, which is then spent through the
 * ordinary Apply for Leave flow.
 */

interface CompOffRequest {
  id:            string;
  workDate:      string;
  days:          number;
  reason:        string;
  status:        string;
  approvedAt?:   string | null;
  rejectedAt?:   string | null;
  rejectionNote?: string | null;
  createdAt:     string;
  weekday:       string;
  isWeeklyOff:   boolean;
  holidayName:   string | null;
  approver?:     { firstName: string; lastName: string } | null;
  employee?:     { id: string; employeeCode: string; firstName: string; lastName: string; department: { name: string } | null };
}

/** "Sun 17 Aug" — the weekday is the whole point, so it leads. */
function fmtWorkDate(r: { workDate: string; weekday: string }) {
  return `${r.weekday.slice(0, 3)} ${fmtShort(r.workDate)}`;
}

/** What kind of day this was, in the approver's terms. */
function dayContext(r: CompOffRequest) {
  if (r.holidayName) return `${r.holidayName} · holiday`;
  if (r.isWeeklyOff) return "Weekly off";
  return "Working day";
}

function ClaimCompOffModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [workDate, setWorkDate] = useState("");
  const [days, setDays] = useState<0.5 | 1>(1);
  const [reason, setReason] = useState("");

  // The claim is for work already done, so tomorrow is never valid. Built from
  // local date parts rather than toISOString(), which would shift the cap a day
  // back for anyone east of Greenwich.
  const now = new Date();
  const todayIsoLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  // Date inputs give YYYY-MM-DD, i.e. UTC midnight — read the weekday in UTC to
  // match, exactly as the server does.
  const weekdayHint = useMemo(() => {
    if (!workDate) return null;
    const d = new Date(`${workDate}T00:00:00.000Z`);
    const name = d.toLocaleDateString("en-IN", { weekday: "long", timeZone: "UTC" });
    return { name, isSunday: d.getUTCDay() === 0 };
  }, [workDate]);

  const claimMut = useMutation({
    mutationFn: () => api.post("/api/v1/comp-off", { workDate, days, reason: reason.trim() }),
    onSuccess: (res) => {
      toast.success(res.data?.message ?? "Comp-off request submitted");
      queryClient.invalidateQueries({ queryKey: ["my-comp-offs"] });
      onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? "Failed to submit comp-off request"),
  });

  function handleSubmit() {
    if (!workDate) { toast.error("Pick the date you worked"); return; }
    if (reason.trim().length < 5) { toast.error("Please say what you worked on (at least 5 characters)"); return; }
    claimMut.mutate();
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Claim a Comp-off</h2>
            <p className="text-xs text-gray-500 mt-0.5">For a day you worked when you were not due to</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Date worked</label>
              <input
                type="date"
                value={workDate}
                max={todayIsoLocal}
                min="1900-01-01"
                onChange={(e) => setWorkDate(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {weekdayHint && (
                <p className={`text-xs mt-1.5 ${weekdayHint.isSunday ? "text-green-600" : "text-gray-400"}`}>
                  {weekdayHint.name}{weekdayHint.isSunday ? " — your weekly off" : ""}
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">How much you worked</label>
              <div className="flex rounded-xl overflow-hidden border border-gray-200">
                {([1, 0.5] as const).map((d, i) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDays(d)}
                    className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
                      days === d ? "bg-blue-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50"
                    } ${i > 0 ? "border-l border-gray-200" : ""}`}
                  >
                    {d === 1 ? "Full day" : "Half day"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">What you worked on</label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Sunday admission-test duty at the Salt Lake centre"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-start gap-2.5 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
            <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">
              Your supervisor decides. Once approved, {days === 1 ? "1 day" : "half a day"} is credited to your
              Comp-off balance and you can apply for it like any other leave.
            </p>
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-6 pb-6">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={claimMut.isPending}
            className="px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {claimMut.isPending ? "Submitting…" : "Submit Request"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CompOffSection({ available }: { available: number }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(true);
  const [claiming, setClaiming] = useState(false);

  const { data } = useQuery<{ data: CompOffRequest[]; summary: { earned: number; awaiting: number } }>({
    queryKey: ["my-comp-offs"],
    queryFn: () => api.get("/api/v1/comp-off/my").then((r) => ({ data: r.data.data, summary: r.data.summary })),
  });
  const requests = data?.data ?? [];
  const summary  = data?.summary ?? { earned: 0, awaiting: 0 };

  const withdrawMut = useMutation({
    mutationFn: (id: string) => api.patch(`/api/v1/comp-off/${id}/cancel`),
    onSuccess: () => {
      toast.success("Comp-off request withdrawn");
      queryClient.invalidateQueries({ queryKey: ["my-comp-offs"] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? "Failed to withdraw request"),
  });

  return (
    <>
      {claiming && <ClaimCompOffModal onClose={() => setClaiming(false)} />}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <button
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2 text-left">
            <CalendarOff className="h-4 w-4 text-orange-400 shrink-0" />
            <div>
              <h2 className="font-semibold text-gray-900">Comp-offs</h2>
              <p className="text-xs text-gray-400 mt-0.5">Worked on your weekly off? Claim the day back.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 hidden sm:inline">
              {available} available{summary.awaiting > 0 ? ` · ${summary.awaiting} awaiting approval` : ""}
            </span>
            <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform duration-200 shrink-0 ${open ? "rotate-180" : ""}`} />
          </div>
        </button>

        {open && (
          <>
            <div className="px-6 pb-4 grid grid-cols-3 gap-3">
              {[
                { label: "Available", value: available, tone: "text-orange-600 bg-orange-50 border-orange-100" },
                { label: "Earned", value: summary.earned, tone: "text-gray-700 bg-gray-50 border-gray-100" },
                { label: "Awaiting", value: summary.awaiting, tone: "text-yellow-700 bg-yellow-50 border-yellow-100" },
              ].map((s) => (
                <div key={s.label} className={`border rounded-xl px-4 py-3 ${s.tone}`}>
                  <p className="text-xs font-bold uppercase tracking-wider opacity-70">{s.label}</p>
                  <p className="text-2xl font-bold mt-1">{s.value}</p>
                </div>
              ))}
            </div>

            <div className="px-6 pb-4">
              <button
                onClick={() => setClaiming(true)}
                className="w-full flex items-center justify-center gap-2 border border-dashed border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Claim a comp-off for a day worked
              </button>
            </div>

            {requests.length > 0 && (
              <div className="border-t border-gray-50 divide-y divide-gray-50 max-h-80 overflow-y-auto">
                {requests.map((r) => (
                  <div key={r.id} className="px-6 py-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-800">{fmtWorkDate(r)}</p>
                        <span className="text-xs text-gray-400">{dayContext(r)}</span>
                        <span className="text-xs text-gray-400">· {r.days === 1 ? "1 day" : "Half day"}</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{r.reason}</p>
                      {r.status === "REJECTED" && r.rejectionNote && (
                        <p className="text-xs text-red-500 mt-0.5">Note: {r.rejectionNote}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[r.status] ?? "bg-gray-100 text-gray-500"}`}>
                        {statusLabel(r.status)}
                      </span>
                      {r.status === "PENDING" && (
                        <button
                          onClick={() => withdrawMut.mutate(r.id)}
                          disabled={withdrawMut.isPending}
                          className="text-xs text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                        >
                          Withdraw
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

/**
 * The approver's side. A comp-off decision is not a leave decision: it does not
 * grant time away, it mints the days the employee can later ask for — so it
 * lives in its own panel rather than in the Pending Approvals list.
 */
function CompOffApprovalsPanel() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [rejecting, setRejecting] = useState<CompOffRequest | null>(null);

  const { data: requests = [], isLoading } = useQuery<CompOffRequest[]>({
    queryKey: ["team-comp-offs"],
    queryFn: () => api.get("/api/v1/comp-off/team").then((r) => r.data.data),
  });

  const decideMut = useMutation({
    mutationFn: ({ id, action, note }: { id: string; action: "APPROVED" | "REJECTED"; note?: string }) =>
      api.patch(`/api/v1/comp-off/${id}/decision`, { action, note }),
    onSuccess: (res) => {
      toast.success(res.data?.message ?? "Decision recorded");
      queryClient.invalidateQueries({ queryKey: ["team-comp-offs"] });
      queryClient.invalidateQueries({ queryKey: ["my-comp-offs"] });
      queryClient.invalidateQueries({ queryKey: ["my-leave-balances"] });
      setRejecting(null);
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? "Failed to record decision"),
  });

  const pending = requests.filter((r) => r.status === "PENDING");
  const decided = requests.filter((r) => r.status !== "PENDING").slice(0, 25);

  const matching = pending.filter((r) =>
    matchesLeaveSearch(search, [
      r.employee?.firstName,
      r.employee?.lastName,
      r.employee?.employeeCode,
      r.employee?.department?.name,
      r.reason,
    ]),
  );

  return (
    <>
      {rejecting && (
        <ReasonPromptModal
          title="Reject this comp-off"
          description={`${rejecting.employee?.firstName} ${rejecting.employee?.lastName} claimed ${rejecting.days === 1 ? "a day" : "half a day"} for ${fmtWorkDate(rejecting)}. Nothing will be credited, and they will see your note.`}
          label="Why"
          placeholder="e.g. The centre was closed that Sunday"
          confirmLabel="Reject request"
          tone="danger"
          isPending={decideMut.isPending}
          onConfirm={(note) => decideMut.mutate({ id: rejecting.id, action: "REJECTED", note })}
          onClose={() => setRejecting(null)}
        />
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="flex flex-col gap-3 p-5 border-b border-gray-200 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <CalendarOff className="text-orange-500" size={20} />
            <h3 className="text-base font-semibold text-gray-900">Comp-off Requests</h3>
            {pending.length > 0 && (
              <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-medium">{pending.length}</span>
            )}
          </div>
          {pending.length > 0 && (
            <LeaveSearchInput value={search} onChange={setSearch} placeholder="Search name, code, department…" />
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin h-5 w-5 border-2 border-orange-400 border-t-transparent rounded-full" />
          </div>
        ) : matching.length === 0 ? (
          <div className="p-10 text-center">
            <CalendarOff className="mx-auto text-gray-300 mb-3" size={40} />
            <p className="text-sm text-gray-500">
              {search.trim() && pending.length > 0
                ? "No comp-off requests match your search."
                : "No comp-off requests awaiting a decision."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {matching.map((r) => (
              <div key={r.id} className="p-5 hover:bg-gray-50 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="font-medium text-gray-900">{r.employee?.firstName} {r.employee?.lastName}</p>
                      <span className="text-xs text-gray-400">{r.employee?.employeeCode}</span>
                      <span className="text-xs text-gray-400">{r.employee?.department?.name}</span>
                    </div>
                    <p className="text-sm text-gray-600 mb-1">
                      <span className="font-medium">{fmtWorkDate(r)}</span>
                      {" · "}{r.days === 1 ? "1 day" : "Half day"}
                      {" · "}
                      <span className={r.isWeeklyOff || r.holidayName ? "text-green-600" : "text-amber-600"}>
                        {dayContext(r)}
                      </span>
                    </p>
                    <p className="text-xs text-gray-400 truncate">{r.reason}</p>
                    {!r.isWeeklyOff && !r.holidayName && (
                      <p className="text-xs text-amber-600 mt-1 flex items-start gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px" />
                        That was an ordinary working day — approve only if they were genuinely off duty.
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => setRejecting(r)}
                      disabled={decideMut.isPending}
                      className="flex-1 sm:flex-initial px-4 py-2 rounded-md text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => decideMut.mutate({ id: r.id, action: "APPROVED" })}
                      disabled={decideMut.isPending}
                      className="flex-1 sm:flex-initial px-4 py-2 rounded-md text-sm font-medium text-white whitespace-nowrap disabled:opacity-50"
                      style={{ backgroundColor: "#2C3E7C" }}
                    >
                      Approve &amp; credit
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {decided.length > 0 && (
          <div className="border-t border-gray-100">
            <p className="px-5 pt-4 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Recently decided</p>
            <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
              {decided.map((r) => (
                <div key={r.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-gray-800 truncate">
                      {r.employee?.firstName} {r.employee?.lastName}
                      <span className="text-gray-400"> · {fmtWorkDate(r)} · {r.days === 1 ? "1 day" : "Half day"}</span>
                    </p>
                  </div>
                  <span className={`shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[r.status] ?? "bg-gray-100 text-gray-500"}`}>
                    {statusLabel(r.status)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ── Leave Detail Modal ────────────────────────────────────────────────────────

function LeaveDetailModal({ leave, onClose, onCancel }: {
  leave: LeaveApplication;
  onClose: () => void;
  onCancel: (id: string, reason: string) => void;
}) {
  const c = LEAVE_COLORS[leave.leaveType] ?? LEAVE_COLORS.UNPAID;
  const sameDay = leave.fromDate.slice(0, 10) === leave.toDate.slice(0, 10);
  const [confirming, setConfirming] = useState(false);

  // A pending leave withdraws on the spot. An approved one has to go back to the
  // approver, so the reason is mandatory and the leave stays live meanwhile.
  const isApprovedWithdrawal = leave.status === "APPROVED";
  const canWithdraw = leave.status === "PENDING" || isApprovedWithdrawal;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      {confirming && (
        <ReasonPromptModal
          title={isApprovedWithdrawal ? "Request cancellation" : "Cancel leave"}
          description={isApprovedWithdrawal
            ? "This leave is already approved, so your approver has to sign off on cancelling it. The days stay booked until they decide."
            : "This request hasn't been reviewed yet, so it will be withdrawn straight away and the days returned to your balance."}
          label={isApprovedWithdrawal ? "Why are you cancelling?" : "Reason (optional)"}
          placeholder={isApprovedWithdrawal ? "e.g. Trip called off — I'll be at work as usual" : "e.g. Plans changed"}
          confirmLabel={isApprovedWithdrawal ? "Send request" : "Cancel leave"}
          tone={isApprovedWithdrawal ? "warning" : "danger"}
          required={isApprovedWithdrawal}
          onConfirm={(reason) => { onCancel(leave.id, reason); setConfirming(false); onClose(); }}
          onClose={() => setConfirming(false)}
        />
      )}
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className={`${c.bg} ${c.border} border-b rounded-t-2xl px-6 py-4 flex items-start justify-between`}>
          <div>
            <span className={`text-xs font-bold uppercase tracking-wider ${c.text}`}>
              {LEAVE_LABEL[leave.leaveType] ?? leave.leaveType}
            </span>
            <p className="text-lg font-bold text-gray-900 mt-0.5">
              {sameDay ? fmtShort(leave.fromDate) : `${fmtShort(leave.fromDate)} – ${fmtShort(leave.toDate)}`}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {sameDay ? fmtDayName(leave.fromDate) : `${fmtDayName(leave.fromDate)} – ${fmtDayName(leave.toDate)}`}
              {" · "}{leave.totalDays} {leave.totalDays === 1 ? "day" : "days"}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 mt-0.5">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Status */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Status</span>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[leave.status] ?? "bg-gray-100 text-gray-500"}`}>
              {statusLabel(leave.status)}
            </span>
          </div>

          {/* Reason */}
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Reason</p>
            <p className="text-sm text-gray-800 bg-gray-50 rounded-xl px-4 py-3">{leave.reason}</p>
          </div>

          {/* Rejection note */}
          {leave.rejectionNote && (
            <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-100 px-4 py-3">
              <XCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-red-700 mb-0.5">Rejection Reason</p>
                <p className="text-sm text-red-700">{leave.rejectionNote}</p>
              </div>
            </div>
          )}

          {/* Cancellation trail */}
          {leave.status === "CANCELLATION_PENDING" && (
            <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-100 px-4 py-3">
              <Clock className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-amber-800 mb-0.5">Cancellation awaiting approval</p>
                <p className="text-sm text-amber-700">{leave.cancelReason}</p>
                <p className="text-xs text-amber-600 mt-1">
                  The leave stays approved — and the days stay deducted — until your approver decides.
                </p>
              </div>
            </div>
          )}
          {leave.status === "CANCELLED" && leave.cancelReason && (
            <div className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3">
              <p className="text-xs font-semibold text-gray-600 mb-0.5">Cancellation Reason</p>
              <p className="text-sm text-gray-700">{leave.cancelReason}</p>
              {leave.cancelApprover && (
                <p className="text-xs text-gray-400 mt-1">
                  Actioned by {leave.cancelApprover.firstName} {leave.cancelApprover.lastName}
                </p>
              )}
            </div>
          )}
          {leave.status === "APPROVED" && leave.cancelRejectionNote && (
            <div className="flex items-start gap-2 rounded-xl bg-orange-50 border border-orange-100 px-4 py-3">
              <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-orange-800 mb-0.5">Cancellation declined</p>
                <p className="text-sm text-orange-700">{leave.cancelRejectionNote}</p>
              </div>
            </div>
          )}

          {/* Meta grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-xl px-4 py-3">
              <p className="text-xs text-gray-400 mb-0.5">Applied on</p>
              <p className="text-sm font-semibold text-gray-800">{fmtShort(leave.createdAt)}</p>
            </div>
            <div className="bg-gray-50 rounded-xl px-4 py-3">
              <p className="text-xs text-gray-400 mb-0.5">Approver</p>
              <p className="text-sm font-semibold text-gray-800">
                {leave.approver ? `${leave.approver.firstName} ${leave.approver.lastName}` : "—"}
              </p>
            </div>
          </div>

          {/* Document */}
          {leave.documentUrl && (
            <a
              href={`${API_BASE}${leave.documentUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700 hover:bg-blue-100 transition-colors"
            >
              <FileText className="h-4 w-4 shrink-0" />
              View attached document
            </a>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          {canWithdraw && (
            <button
              onClick={() => setConfirming(true)}
              className="px-4 py-2 text-sm font-semibold text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-colors"
            >
              {isApprovedWithdrawal ? "Request Cancellation" : "Cancel Leave"}
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Close
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
  onCancel: (id: string, reason: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "PENDING" | "APPROVED">("ALL");
  const [selected, setSelected] = useState<LeaveApplication | null>(null);

  const filtered = leaves.filter((l) => {
    if (filter === "PENDING")  return l.status === "PENDING";
    if (filter === "APPROVED") return l.status === "APPROVED";
    return true;
  });

  return (
    <>
      {selected && (
        <LeaveDetailModal
          leave={selected}
          onClose={() => setSelected(null)}
          onCancel={onCancel}
        />
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
          <button
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-2 text-left hover:opacity-80 transition-opacity"
          >
            <div>
              <h2 className="font-semibold text-gray-900">Leave History</h2>
              <p className="text-xs text-gray-400 mt-0.5">Recent applications and approval status.</p>
            </div>
            <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform duration-200 ml-2 ${open ? "rotate-180" : ""}`} />
          </button>
          {open && (
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
          )}
        </div>

        {open && (
          filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-3">
                <CalendarDays className="h-6 w-6 text-blue-400" />
              </div>
              <p className="text-sm font-medium text-gray-600">No leave applications yet</p>
              <p className="text-xs text-gray-400 mt-1">Your submitted leave requests will appear here with approval status and balance impact.</p>
            </div>
          ) : (
            <div className="overflow-y-auto max-h-96">
              <table className="w-full">
                <thead className="sticky top-0 bg-white z-10">
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
                      <tr
                        key={l.id}
                        onClick={() => setSelected(l)}
                        className="hover:bg-blue-50/40 transition-colors cursor-pointer"
                      >
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
                            {statusLabel(l.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {l.approver ? `${l.approver.firstName} ${l.approver.lastName}` : "—"}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-400">{fmtShort(l.createdAt)}</td>
                        <td className="px-6 py-4 text-right">
                          <ChevronRight className="h-4 w-4 text-gray-300 inline-block" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </>
  );
}

// ── Current Request Tracker ───────────────────────────────────────────────────

function CurrentRequest({ leaves }: { leaves: LeaveApplication[] }) {
  // A withdrawal awaiting sign-off is the most live thing on the list — surface
  // it ahead of a plain pending application.
  const latest = leaves.find((l) => l.status === "CANCELLATION_PENDING")
    ?? leaves.find((l) => l.status === "PENDING")
    ?? leaves[0];

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

  const awaitingCancellation = latest.status === "CANCELLATION_PENDING";

  const steps = awaitingCancellation
    ? [
        { label: "Leave approved", desc: latest.approver
            ? `Granted by ${latest.approver.firstName} ${latest.approver.lastName}.`
            : "Granted by your approver.", done: true, active: false },
        { label: "Cancellation requested", desc: latest.cancelReason ?? "Withdrawal submitted.", done: true, active: false },
        { label: "Approver decision", desc: "Days stay deducted until the cancellation is approved.", done: false, active: true },
      ]
    : [
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
            : latest.status === "CANCELLED"
            ? "Leave cancelled — days returned."
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

      {/* The sandwich rule surprises people the first time — state it up front. */}
      <div className="mt-4 pt-4 border-t border-gray-100 flex items-start gap-2">
        <Info className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />
        <p className="text-xs text-gray-500">
          Working days are Monday–Saturday. Sandwich policy: every day between the first and last
          day of your leave is counted, so Friday to Monday is four days.
        </p>
      </div>
    </div>
  );
}

// ── Who's On Leave (Team Leaves tab) ─────────────────────────────────────────

type OnLeaveEntry = {
  id: string;
  leaveType: string;
  fromDate: string;
  toDate: string;
  totalDays: number;
  status: string;
  employee: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    department: { name: string } | null;
    designation: { title: string } | null;
  };
};

/** Today in the viewer's own timezone — `toISOString` would roll back a day in IST. */
function todayIso() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** `iso` shifted by `days`, still as a local-timezone YYYY-MM-DD. */
function shiftIso(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The default window: today plus the next thirteen days — a fortnight inclusive. */
const DEFAULT_WINDOW_DAYS = 14;
function defaultWindow() {
  const from = todayIso();
  return { from, to: shiftIso(from, DEFAULT_WINDOW_DAYS - 1) };
}

/**
 * Who is away over a window, defaulting to the next fortnight. Answers the
 * question a manager actually walks in with — "who is out, and when?" — which
 * the approvals queue can't, since a leave approved last month no longer
 * appears there.
 *
 * Approved and still-pending requests sit in one list on purpose: cover has to
 * be planned against both, and a request nobody has answered is exactly the one
 * that turns into a surprise absence. Every row states which it is.
 */
function WhoIsOnLeavePanel() {
  const [range, setRange] = useState(defaultWindow);

  const { data: entries = [], isLoading } = useQuery<OnLeaveEntry[]>({
    queryKey: ["leaves-on-date", range.from, range.to],
    queryFn: () =>
      api.get(`/api/v1/leaves/on-date?from=${range.from}&to=${range.to}`).then((r) => r.data.data),
  });

  // Picking a start past the end (or an end before the start) drags the other
  // bound along rather than leaving an empty range the server would reject.
  const setFrom = (value: string) => {
    const from = value || todayIso();
    setRange((r) => ({ from, to: from > r.to ? from : r.to }));
  };
  const setTo = (value: string) => {
    const to = value || todayIso();
    setRange((r) => ({ from: to < r.from ? to : r.from, to }));
  };

  const isDefaultWindow = range.from === defaultWindow().from && range.to === defaultWindow().to;
  const pendingCount = entries.filter((e) => e.status === "PENDING").length;
  const approvedCount = entries.length - pendingCount;

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="flex flex-col gap-3 p-5 border-b border-gray-200 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <CalendarOff className="text-teal-600 shrink-0" size={20} />
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-gray-900">On Leave</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {isLoading
                ? "Checking…"
                : entries.length === 0
                  ? `Nobody is booked off, ${fmtShort(range.from)} – ${fmtShort(range.to)}`
                  : `${fmtShort(range.from)} – ${fmtShort(range.to)} · ${approvedCount} approved · ${pendingCount} awaiting approval`}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date" max={range.to} min="1900-01-01"
            aria-label="From date"
            value={range.from}
            onChange={(e) => setFrom(e.target.value)}
            className="flex-1 min-w-0 sm:flex-initial border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-xs text-gray-400 shrink-0">to</span>
          <input
            type="date" max="2099-12-31" min={range.from}
            aria-label="To date"
            value={range.to}
            onChange={(e) => setTo(e.target.value)}
            className="flex-1 min-w-0 sm:flex-initial border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {!isDefaultWindow && (
            <button
              onClick={() => setRange(defaultWindow())}
              className="px-3 py-2 text-xs font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 whitespace-nowrap"
            >
              Next 2 weeks
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <div className="animate-spin h-5 w-5 border-2 border-teal-400 border-t-transparent rounded-full" />
        </div>
      ) : entries.length === 0 ? (
        <div className="px-6 py-10 text-center">
          <CheckCircle2 className="mx-auto text-gray-300 mb-3" size={36} />
          <p className="text-sm text-gray-500">
            Nobody has leave booked between {fmtShort(range.from)} and {fmtShort(range.to)}.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {entries.map((e) => {
            const sameDay = e.fromDate.slice(0, 10) === e.toDate.slice(0, 10);
            const colors = LEAVE_COLORS[e.leaveType] ?? LEAVE_COLORS.CASUAL;
            const isPending = e.status === "PENDING";
            return (
              <div
                key={e.id}
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-5 py-3.5 hover:bg-gray-50 transition-colors ${
                  // An unapproved request is a maybe, not an absence — the accent
                  // says so at a glance, before anyone reads the status pill.
                  isPending ? "border-l-2 border-amber-300" : ""
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-gray-900">{e.employee.firstName} {e.employee.lastName}</p>
                    <span className="text-xs text-gray-400">{e.employee.employeeCode}</span>
                    {isPending ? (
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                        Pending approval
                      </span>
                    ) : (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                        Approved
                      </span>
                    )}
                    {e.status === "CANCELLATION_PENDING" && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                        Withdrawal pending
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {[e.employee.designation?.title, e.employee.department?.name].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="sm:text-right shrink-0">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
                    {LEAVE_LABEL[e.leaveType] ?? e.leaveType}
                    {e.totalDays === 0.5 ? " · half day" : ""}
                  </span>
                  <p className="text-xs text-gray-400 mt-1">
                    {sameDay ? fmtShort(e.fromDate) : `${fmtShort(e.fromDate)} – ${fmtShort(e.toDate)}`}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Pending Approvals (Team Leaves tab) ──────────────────────────────────────

function PendingApprovalsPanel() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const isApprover = user?.role !== "EMPLOYEE";
  const [reviewLeave, setReviewLeave] = useState<PendingLeave | null>(null);
  const [lopLeave, setLopLeave] = useState<PendingLeave | null>(null);
  const [search, setSearch] = useState("");

  const { data: pending = [], isLoading } = useQuery<PendingLeave[]>({
    queryKey: ["pending-leaves"],
    queryFn: () => api.get("/api/v1/leaves/pending").then((r) => r.data.data),
    enabled: isApprover,
  });

  const decisionMut = useMutation({
    mutationFn: ({ id, action, lopDays, note }: { id: string; action: string; lopDays?: number; note?: string }) =>
      api.patch(`/api/v1/leaves/${id}/decision`, { action, lopDays, note }),
    onSuccess: (_data, variables) => {
      const isLop = (variables.lopDays ?? 0) > 0;
      toast.success(isLop ? `Approved with ${variables.lopDays} LoP day${variables.lopDays !== 1 ? "s" : ""}` : "Decision recorded");
      queryClient.invalidateQueries({ queryKey: ["pending-leaves"] });
      queryClient.invalidateQueries({ queryKey: ["decided-leaves"] });
      queryClient.invalidateQueries({ queryKey: ["leaves-on-date"] });
      queryClient.invalidateQueries({ queryKey: ["my-leaves"] });
      queryClient.invalidateQueries({ queryKey: ["my-leave-balances"] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? "Failed to record decision"),
  });

  if (!isApprover) return null;

  function handleDecide(id: string, action: "APPROVED" | "REJECTED", lopDays?: number, note?: string) {
    decisionMut.mutate({ id, action, lopDays, note });
  }

  // The list arrives newest-application-first from the API; search narrows it in
  // place so the ordering HR relies on survives filtering.
  const matching = pending.filter((l) =>
    matchesLeaveSearch(search, [
      l.employee.firstName,
      l.employee.lastName,
      l.employee.employeeCode,
      l.employee.department?.name,
      LEAVE_LABEL[l.leaveType] ?? l.leaveType,
      l.reason,
    ]),
  );

  // Separate unpaid/overdrawn leaves for LOP section
  const regularLeaves = matching.filter((l) => l.leaveType !== "UNPAID");
  const lopLeaves = matching.filter((l) => l.leaveType === "UNPAID");

  return (
    <>
      {/* Pending Approvals */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="flex flex-col gap-3 p-5 border-b border-gray-200 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Clock className="text-orange-500" size={20} />
            <h3 className="text-base font-semibold text-gray-900">Pending Approvals</h3>
            {pending.length > 0 && (
              <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-medium">{pending.length}</span>
            )}
          </div>
          {pending.length > 0 && (
            <LeaveSearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search name, code, department, type…"
            />
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin h-5 w-5 border-2 border-orange-400 border-t-transparent rounded-full" />
          </div>
        ) : regularLeaves.length === 0 ? (
          <div className="p-12 text-center">
            <Clock className="mx-auto text-gray-300 mb-4" size={48} />
            <p className="text-sm text-gray-500">
              {search.trim() && pending.length > 0
                ? "No pending applications match your search."
                : "No pending approvals at this time."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {regularLeaves.map((leave) => (
              <div key={leave.id} className="p-5 hover:bg-gray-50 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="font-medium text-gray-900">{leave.employee.firstName} {leave.employee.lastName}</p>
                      <span className="text-xs text-gray-400">{leave.employee.employeeCode}</span>
                      <span className="text-xs text-gray-400">{leave.employee.department?.name}</span>
                    </div>
                    <p className="text-sm text-gray-600 mb-1">
                      <span className="font-medium">{LEAVE_LABEL[leave.leaveType] ?? leave.leaveType}</span>
                      {" · "}{leave.totalDays} {leave.totalDays === 1 ? "day" : "days"}
                    </p>
                    <p className="text-sm text-gray-500">
                      {fmtShort(leave.fromDate)}{leave.fromDate !== leave.toDate ? ` – ${fmtShort(leave.toDate)}` : ""}
                      {leave.createdAt && <span className="text-xs text-gray-400"> · applied {fmtShort(leave.createdAt)}</span>}
                    </p>
                    <p className="text-xs text-gray-400 mt-1 truncate">{leave.reason}</p>
                  </div>
                  <button
                    onClick={() => setReviewLeave(leave)}
                    className="w-full sm:w-auto px-4 py-2 rounded-md text-sm font-medium text-white whitespace-nowrap shrink-0"
                    style={{ backgroundColor: "#2C3E7C" }}
                  >
                    Review
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* LOP Approvals — only shown when UNPAID type leaves exist */}
      {lopLeaves.length > 0 && (
        <div className="bg-white rounded-lg border border-red-200 overflow-hidden">
          <div className="p-5 bg-red-50 border-b border-red-200">
            <div className="flex items-center gap-2">
              <AlertTriangle className="text-red-600" size={20} />
              <h3 className="text-base font-semibold text-gray-900">Loss of Pay Approvals</h3>
            </div>
            <p className="text-sm text-gray-600 mt-1">Review and approve or waive LOP for your team members</p>
          </div>
          <div className="divide-y divide-gray-100">
            {lopLeaves.map((leave) => (
              <div key={leave.id} className="p-5 hover:bg-gray-50 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="font-medium text-gray-900">{leave.employee.firstName} {leave.employee.lastName}</p>
                      <span className="text-xs text-gray-400">{leave.employee.department?.name}</span>
                    </div>
                    <p className="text-sm font-medium text-red-600 mb-1">
                      {leave.totalDays} {leave.totalDays === 1 ? "day" : "days"} Unpaid Leave
                    </p>
                    <p className="text-sm text-gray-500">
                      {fmtShort(leave.fromDate)}{leave.fromDate !== leave.toDate ? ` – ${fmtShort(leave.toDate)}` : ""}
                    </p>
                    <p className="text-xs text-gray-400 mt-1 truncate">{leave.reason}</p>
                  </div>
                  <button
                    onClick={() => setLopLeave(leave)}
                    className="w-full sm:w-auto px-4 py-2 rounded-md text-sm font-medium text-white whitespace-nowrap shrink-0"
                    style={{ backgroundColor: "#2C3E7C" }}
                  >
                    Take Action
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      {reviewLeave && (
        <ReviewLeaveModal
          leave={reviewLeave}
          onClose={() => setReviewLeave(null)}
          onDecide={handleDecide}
          isPending={decisionMut.isPending}
        />
      )}
      {lopLeave && (
        <LOPApprovalModal
          leave={lopLeave}
          onClose={() => setLopLeave(null)}
          onDecide={handleDecide}
          isPending={decisionMut.isPending}
        />
      )}
    </>
  );
}

// ── Cancellation Requests (approver view) ────────────────────────────────────

/**
 * Withdrawals of leaves this approver already granted. Kept separate from
 * Pending Approvals because the decision is a different one: not "should they
 * get this leave" but "should I undo the approval I already gave".
 */
function CancellationRequestsPanel() {
  const queryClient = useQueryClient();
  const [deciding, setDeciding] = useState<{ leave: PendingLeave; action: "APPROVED" | "REJECTED" } | null>(null);

  const { data: requests = [], isLoading } = useQuery<PendingLeave[]>({
    queryKey: ["leave-cancellation-requests"],
    queryFn: () => api.get("/api/v1/leaves/cancellation-requests").then((r) => r.data.data),
  });

  const decideMut = useMutation({
    mutationFn: ({ id, action, note }: { id: string; action: string; note?: string }) =>
      api.patch(`/api/v1/leaves/${id}/cancellation-decision`, { action, note }),
    onSuccess: (_d, vars) => {
      toast.success(vars.action === "APPROVED" ? "Leave cancelled — days returned" : "Cancellation declined");
      queryClient.invalidateQueries({ queryKey: ["leave-cancellation-requests"] });
      queryClient.invalidateQueries({ queryKey: ["decided-leaves"] });
      queryClient.invalidateQueries({ queryKey: ["leaves-on-date"] });
      queryClient.invalidateQueries({ queryKey: ["all-leaves"] });
      queryClient.invalidateQueries({ queryKey: ["my-leaves"] });
      queryClient.invalidateQueries({ queryKey: ["my-leave-balances"] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? "Failed to record decision"),
  });

  if (!isLoading && requests.length === 0) return null;

  return (
    <>
      {deciding && (
        <ReasonPromptModal
          title={deciding.action === "APPROVED" ? "Approve cancellation" : "Decline cancellation"}
          description={deciding.action === "APPROVED"
            ? `${deciding.leave.employee.firstName}'s leave will be cancelled and the ${deciding.leave.totalDays} day(s) returned to their balance.`
            : `The leave stays approved. ${deciding.leave.employee.firstName} will see your note explaining why.`}
          label={deciding.action === "APPROVED" ? "Note (optional)" : "Why are you declining?"}
          placeholder={deciding.action === "APPROVED" ? "e.g. Confirmed with the team" : "e.g. Cover has already been arranged for these dates"}
          confirmLabel={deciding.action === "APPROVED" ? "Approve cancellation" : "Decline"}
          tone={deciding.action === "APPROVED" ? "warning" : "danger"}
          required={deciding.action === "REJECTED"}
          isPending={decideMut.isPending}
          onConfirm={(note) => {
            decideMut.mutate({ id: deciding.leave.id, action: deciding.action, note: note || undefined });
            setDeciding(null);
          }}
          onClose={() => setDeciding(null)}
        />
      )}

      <div className="bg-white rounded-lg border border-amber-200 overflow-hidden">
        <div className="p-5 bg-amber-50 border-b border-amber-200 flex items-center gap-2">
          <Clock className="text-amber-600 shrink-0" size={20} />
          <div>
            <h3 className="text-base font-semibold text-gray-900">Cancellation Requests</h3>
            <p className="text-xs text-gray-600 mt-0.5">
              Approved leaves your team wants to withdraw — the days stay booked until you decide.
            </p>
          </div>
          {requests.length > 0 && (
            <span className="ml-auto text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-medium shrink-0">
              {requests.length}
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin h-5 w-5 border-2 border-amber-400 border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {requests.map((leave) => (
              <div key={leave.id} className="p-5 hover:bg-gray-50 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="font-medium text-gray-900">{leave.employee.firstName} {leave.employee.lastName}</p>
                      <span className="text-xs text-gray-400">{leave.employee.department?.name}</span>
                    </div>
                    <p className="text-sm text-gray-600 mb-1">
                      <span className="font-medium">{LEAVE_LABEL[leave.leaveType] ?? leave.leaveType}</span>
                      {" · "}{leave.totalDays} {leave.totalDays === 1 ? "day" : "days"}
                      {" · "}{fmtShort(leave.fromDate)}{leave.fromDate !== leave.toDate ? ` – ${fmtShort(leave.toDate)}` : ""}
                    </p>
                    <div className="mt-2 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2">
                      <p className="text-xs font-semibold text-amber-800 mb-0.5">Reason for cancelling</p>
                      <p className="text-sm text-amber-700">{leave.cancelReason ?? "—"}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => setDeciding({ leave, action: "REJECTED" })}
                      className="flex-1 sm:flex-initial px-4 py-2 rounded-md text-sm font-medium text-red-700 border border-red-200 bg-red-50 hover:bg-red-100 whitespace-nowrap"
                    >
                      Decline
                    </button>
                    <button
                      onClick={() => setDeciding({ leave, action: "APPROVED" })}
                      className="flex-1 sm:flex-initial px-4 py-2 rounded-md text-sm font-medium text-white bg-green-600 hover:bg-green-700 whitespace-nowrap"
                    >
                      Approve
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ── All Leaves (Super Admin / HR override view) ──────────────────────────────

/**
 * Every leave in the system, with the two override actions. Cancelling keeps
 * the record and returns the days; deleting erases it and leaves only the
 * audit-log entry, so the copy is blunt about which is which.
 */
function AllLeavesPanel() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [action, setAction] = useState<{ leave: AdminLeave; kind: "cancel" | "delete" } | null>(null);

  const { data: leaves = [], isLoading } = useQuery<AdminLeave[]>({
    queryKey: ["all-leaves", statusFilter],
    queryFn: () => api
      .get(`/api/v1/leaves/all${statusFilter ? `?status=${statusFilter}` : ""}`)
      .then((r) => r.data.data),
    enabled: open,
  });

  function onDone(message: string) {
    toast.success(message);
    queryClient.invalidateQueries({ queryKey: ["all-leaves"] });
    queryClient.invalidateQueries({ queryKey: ["pending-leaves"] });
    queryClient.invalidateQueries({ queryKey: ["leave-cancellation-requests"] });
    queryClient.invalidateQueries({ queryKey: ["decided-leaves"] });
    queryClient.invalidateQueries({ queryKey: ["leaves-on-date"] });
    queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
    setAction(null);
  }

  const cancelMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.patch(`/api/v1/leaves/${id}/admin-cancel`, { reason }),
    onSuccess: () => onDone("Leave cancelled"),
    onError: (e: any) => toast.error(e?.response?.data?.error ?? "Failed to cancel leave"),
  });

  const deleteMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.delete(`/api/v1/leaves/${id}`, { data: { reason } }),
    onSuccess: () => onDone("Leave deleted — recorded in the deletion log"),
    onError: (e: any) => toast.error(e?.response?.data?.error ?? "Failed to delete leave"),
  });

  const filtered = useMemo(() =>
    leaves.filter((l) =>
      matchesLeaveSearch(search, [
        l.employee.firstName,
        l.employee.lastName,
        l.employee.employeeCode,
        l.employee.department?.name,
        LEAVE_LABEL[l.leaveType] ?? l.leaveType,
        statusLabel(l.status),
      ]),
    ), [leaves, search]);

  return (
    <>
      {action && (
        <ReasonPromptModal
          title={action.kind === "cancel" ? "Cancel this leave" : "Delete this leave"}
          description={action.kind === "cancel"
            ? `${action.leave.employee.firstName} ${action.leave.employee.lastName}'s leave will be cancelled and any deducted days returned. The record stays visible to them.`
            : `The record will be erased for good. A full copy goes to the deletion log, which is the only trace that will remain — cancel instead if you just want to void the leave.`}
          label="Reason"
          placeholder={action.kind === "cancel" ? "e.g. Duplicate application" : "e.g. Filed against the wrong employee"}
          confirmLabel={action.kind === "cancel" ? "Cancel leave" : "Delete permanently"}
          tone="danger"
          isPending={cancelMut.isPending || deleteMut.isPending}
          onConfirm={(reason) => {
            if (action.kind === "cancel") cancelMut.mutate({ id: action.leave.id, reason });
            else deleteMut.mutate({ id: action.leave.id, reason });
          }}
          onClose={() => setAction(null)}
        />
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <button
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2 text-left">
            <Trash2 className="h-4 w-4 text-gray-400 shrink-0" />
            <div>
              <h2 className="font-semibold text-gray-900">All Leaves</h2>
              <p className="text-xs text-gray-400 mt-0.5">Cancel or delete any leave application. Deletions are logged.</p>
            </div>
          </div>
          <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform duration-200 shrink-0 ${open ? "rotate-180" : ""}`} />
        </button>

        {open && (
          <>
            <div className="px-6 pb-4 flex flex-col sm:flex-row gap-2">
              <LeaveSearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search name, code, department, type…"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All statuses</option>
                {["PENDING", "APPROVED", "CANCELLATION_PENDING", "REJECTED", "CANCELLED"].map((s) => (
                  <option key={s} value={s}>{statusLabel(s)}</option>
                ))}
              </select>
            </div>

            {isLoading ? (
              <div className="px-6 py-8 text-center text-sm text-gray-400">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-gray-400">No leave applications match.</div>
            ) : (
              <div className="overflow-x-auto max-h-[32rem] overflow-y-auto">
                <table className="w-full min-w-[46rem]">
                  <thead className="sticky top-0 bg-white z-10 border-b border-gray-50">
                    <tr>
                      {["Employee", "Type", "Dates", "Days", "Status", "Actions"].map((h) => (
                        <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filtered.map((l) => {
                      const sameDay = l.fromDate.slice(0, 10) === l.toDate.slice(0, 10);
                      return (
                        <tr key={l.id} className="hover:bg-gray-50/50">
                          <td className="px-5 py-3">
                            <p className="text-sm font-semibold text-gray-800 whitespace-nowrap">
                              {l.employee.firstName} {l.employee.lastName}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">{l.employee.employeeCode}</p>
                          </td>
                          <td className="px-5 py-3 text-sm text-gray-700 whitespace-nowrap">
                            {LEAVE_LABEL[l.leaveType] ?? l.leaveType}
                          </td>
                          <td className="px-5 py-3 text-sm text-gray-700 whitespace-nowrap">
                            {sameDay ? fmtShort(l.fromDate) : `${fmtShort(l.fromDate)} – ${fmtShort(l.toDate)}`}
                          </td>
                          <td className="px-5 py-3 text-sm text-gray-700">{l.totalDays}</td>
                          <td className="px-5 py-3">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${STATUS_STYLES[l.status] ?? "bg-gray-100 text-gray-500"}`}>
                              {statusLabel(l.status)}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-1.5">
                              {l.status !== "CANCELLED" && (
                                <button
                                  onClick={() => setAction({ leave: l, kind: "cancel" })}
                                  className="px-2.5 py-1 text-xs font-medium text-amber-700 border border-amber-200 bg-amber-50 rounded-lg hover:bg-amber-100 whitespace-nowrap"
                                >
                                  Cancel
                                </button>
                              )}
                              <button
                                onClick={() => setAction({ leave: l, kind: "delete" })}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"
                                title="Delete permanently"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

// ── Decision History (for managers/HR) ───────────────────────────────────────

interface DecidedLeave {
  id: string;
  leaveType: string;
  fromDate: string;
  toDate: string;
  totalDays: number;
  status: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  employee: { employeeCode?: string; firstName: string; lastName: string; department: { name: string } };
}

function DecisionHistory() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Same reporting-line authority as the tab itself — served from cache
  const { data: authority } = useQuery<LeaveAuthority>({
    queryKey: ["leave-authority"],
    queryFn: () => api.get("/api/v1/leaves/authority").then((r) => r.data.data),
    staleTime: 5 * 60 * 1000,
  });
  const isApprover = authority?.canApproveAny ?? false;

  const { data: decided = [], isLoading } = useQuery<DecidedLeave[]>({
    queryKey: ["decided-leaves"],
    queryFn: () => api.get("/api/v1/leaves/decided").then((r) => r.data.data),
    enabled: isApprover,
  });

  if (!isApprover) return null;

  // Newest decision first from the API; searching keeps that order.
  const filtered = decided.filter((l) =>
    matchesLeaveSearch(search, [
      l.employee.firstName,
      l.employee.lastName,
      l.employee.employeeCode,
      l.employee.department?.name,
      LEAVE_LABEL[l.leaveType] ?? l.leaveType,
      statusLabel(l.status),
    ]),
  );

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2 text-left">
          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
          <h2 className="font-semibold text-gray-900">Decision History</h2>
          <span className="hidden sm:inline text-xs text-gray-400 font-normal ml-1">Leaves you've approved or rejected</span>
        </div>
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform duration-200 shrink-0 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        isLoading ? (
          <div className="px-6 py-8 text-center text-sm text-gray-400">Loading…</div>
        ) : decided.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-gray-400">No decisions recorded yet.</div>
        ) : (
          <>
          <div className="px-6 pb-4">
            <LeaveSearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search name, code, department, type…"
            />
          </div>
          {filtered.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-gray-400">No decisions match your search.</div>
          ) : (
          <div className="overflow-x-auto overflow-y-auto max-h-96">
            <table className="w-full min-w-[40rem]">
              <thead className="sticky top-0 bg-white z-10 border-b border-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Employee</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Dates</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Days</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Decision</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((leave) => {
                  const sameDay = leave.fromDate.slice(0, 10) === leave.toDate.slice(0, 10);
                  const dateStr = sameDay
                    ? fmtShort(leave.fromDate)
                    : `${fmtShort(leave.fromDate)} – ${fmtShort(leave.toDate)}`;
                  const decidedAt = leave.approvedAt ?? leave.rejectedAt;
                  return (
                    <tr key={leave.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="text-sm font-semibold text-gray-800">
                          {leave.employee.firstName} {leave.employee.lastName}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {[leave.employee.employeeCode, leave.employee.department?.name].filter(Boolean).join(" · ")}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {LEAVE_LABEL[leave.leaveType] ?? leave.leaveType}
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-700">{dateStr}</p>
                        {decidedAt && (
                          <p className="text-xs text-gray-400 mt-0.5">Decided {fmtShort(decidedAt)}</p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">{leave.totalDays}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[leave.status] ?? "bg-gray-100 text-gray-500"}`}>
                          {statusLabel(leave.status)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          )}
          </>
        )
      )}
    </div>
  );
}

type PendingLeave = {
  id: string;
  leaveType: string;
  fromDate: string;
  toDate: string;
  totalDays: number;
  reason: string;
  createdAt?: string;
  documentUrl?: string;
  cancelReason?: string | null;
  employee: { id: string; employeeCode?: string; firstName: string; lastName: string; department: { name: string } | null };
};

type AdminLeave = {
  id: string;
  leaveType: string;
  fromDate: string;
  toDate: string;
  totalDays: number;
  status: string;
  employee: { id: string; employeeCode: string; firstName: string; lastName: string; department: { name: string } | null };
};

type LeaveAuthority = {
  canApproveAny: boolean;
  canOverride: boolean;
  headedDepartmentIds: string[];
  directReportCount: number;
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LeavesPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  // Approval authority follows the reporting line, not the role name — an
  // EMPLOYEE-role supervisor or department head approves for their people too.
  const { data: authority } = useQuery<LeaveAuthority>({
    queryKey: ["leave-authority"],
    queryFn: () => api.get("/api/v1/leaves/authority").then((r) => r.data.data),
    staleTime: 5 * 60 * 1000,
  });
  const isApprover = authority?.canApproveAny ?? false;

  const [activeTab, setActiveTab] = useState<"my-leaves" | "team-leaves">("my-leaves");
  const [showApplyLeave, setShowApplyLeave] = useState(false);
  const [showHolidayCalendar, setShowHolidayCalendar] = useState(false);

  const { data: balancesResp } = useQuery<LeaveBalancesResponse>({
    queryKey: ["my-leave-balances"],
    queryFn: () => api.get("/api/v1/leaves/balances").then((r) => ({ data: r.data.data, lopDays: r.data.lopDays ?? 0 })),
    // Balances are auto-provisioned server-side on first access; always refetch on
    // mount so a stale (pre-provision) empty result isn't shown until a hard reload.
    staleTime: 0,
    refetchOnMount: "always",
  });
  const balances = balancesResp?.data ?? [];
  const lopDays  = balancesResp?.lopDays ?? 0;

  const { data: leaves = [] } = useQuery<LeaveApplication[]>({
    queryKey: ["my-leaves"],
    queryFn: () => api.get("/api/v1/leaves/my").then((r) => r.data.data),
  });

  const cancelMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.patch(`/api/v1/leaves/${id}/cancel`, { reason }),
    onSuccess: (res) => {
      toast.success(res.data?.message ?? "Leave cancelled");
      queryClient.invalidateQueries({ queryKey: ["my-leaves"] });
      queryClient.invalidateQueries({ queryKey: ["my-leave-balances"] });
      queryClient.invalidateQueries({ queryKey: ["leave-cancellation-requests"] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? "Failed to cancel leave"),
  });

  function invalidateLeaves() {
    queryClient.invalidateQueries({ queryKey: ["my-leaves"] });
    queryClient.invalidateQueries({ queryKey: ["my-leave-balances"] });
  }

  const tabs = [
    { id: "my-leaves" as const,   label: "My Leaves",   Icon: CalendarDays },
    ...(isApprover ? [{ id: "team-leaves" as const, label: "Team Leaves", Icon: Users }] : []),
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-md flex items-center justify-center" style={{ backgroundColor: "#2C3E7C" }}>
              <CalendarDays className="text-white" size={18} />
            </div>
            <div>
              <p className="text-sm text-gray-500 uppercase tracking-wide">Time Away</p>
              <h1 className="text-2xl font-semibold text-gray-900">Leaves</h1>
            </div>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Check available leaves, submit a request, and track approvals in one place.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap md:flex-nowrap w-full md:w-auto">
          <button
            onClick={() => setShowHolidayCalendar(true)}
            className="flex-1 md:flex-initial px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2"
          >
            <Calendar size={18} />
            <span className="hidden sm:inline">View Holiday Calendar</span>
            <span className="sm:hidden">Holidays</span>
          </button>
          <button
            onClick={() => setShowApplyLeave(true)}
            className="flex-1 md:flex-initial px-4 py-2 rounded-md text-sm font-medium text-white flex items-center justify-center gap-2"
            style={{ backgroundColor: "#2C3E7C" }}
          >
            <Plus size={18} />
            <span className="hidden sm:inline">Apply for Leave</span>
            <span className="sm:hidden">Apply</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex">
          {tabs.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`px-4 py-2.5 text-sm font-medium flex items-center gap-2 transition-colors border-b-2 -mb-px ${
                activeTab === id ? "text-gray-900" : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
              style={activeTab === id ? { borderBottomColor: "#2C3E7C" } : {}}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── My Leaves Tab ── */}
      {activeTab === "my-leaves" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-5">
            <BalanceSection balances={balances} lopDays={lopDays} />

            <CompOffSection
              available={balances.find((b) => b.leaveType === "COMPENSATORY")?.balance ?? 0}
            />

            {/* Apply for Leave — opens modal */}
            <div className="bg-white rounded-lg border border-gray-200">
              <button
                onClick={() => setShowApplyLeave(true)}
                className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Plus size={20} style={{ color: "#2C3E7C" }} />
                  <h3 className="text-base font-semibold text-gray-900">Apply for Leave</h3>
                </div>
                <ChevronRight size={20} className="text-gray-400" />
              </button>
            </div>

            <LeaveHistory leaves={leaves} onCancel={(id, reason) => cancelMut.mutate({ id, reason })} />
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <CurrentRequest leaves={leaves} />
            <PolicySnapshot balances={balances} />
          </div>
        </div>
      )}

      {/* ── Team Leaves Tab ── */}
      {activeTab === "team-leaves" && isApprover && (
        <div className="space-y-6">
          {/* Banner */}
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-4 flex items-start gap-3">
            <Users className="text-purple-600 shrink-0 mt-0.5" size={20} />
            <div>
              <p className="text-sm font-medium text-gray-900 uppercase tracking-wide">Leave Management</p>
              <p className="text-xs text-gray-600 mt-1">Review and approve leave requests from your team members</p>
            </div>
          </div>

          <WhoIsOnLeavePanel />
          <PendingApprovalsPanel />
          <CompOffApprovalsPanel />
          <CancellationRequestsPanel />
          <DecisionHistory />
          {authority?.canOverride && <AllLeavesPanel />}
        </div>
      )}

      {/* Modals */}
      {showApplyLeave && (
        <ApplyLeaveModal
          balances={balances}
          onClose={() => { setShowApplyLeave(false); invalidateLeaves(); }}
        />
      )}
      {showHolidayCalendar && (
        <HolidayCalendarModal onClose={() => setShowHolidayCalendar(false)} />
      )}
    </div>
  );
}
