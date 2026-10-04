"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Wallet } from "lucide-react";
import { api } from "@/lib/api";

const LEAVE_LABEL: Record<string, string> = {
  CASUAL: "Casual", SICK: "Sick", EARNED: "Earned",
  MATERNITY: "Maternity", PATERNITY: "Paternity",
  COMPENSATORY: "Comp-off", UNPAID: "Unpaid", SPECIAL: "Special",
};

type Balance = {
  leaveType: string;
  allocated: number;
  accrued: number;
  used: number;
  pending: number;
  balance: number;
  carried: number;
  earned: number;
};

/**
 * The applicant's leave balances, shown to whoever is deciding the request —
 * reporting manager, head of department, HR. The requested type is pulled to the
 * front and highlighted; the rest sit beside it so the approver can suggest a
 * different type instead of rejecting outright.
 *
 * `pending` already holds requests awaiting a decision (this one included, when
 * the balance row existed at the time it was applied), so `balance` is what is
 * left once they are all granted.
 */
export function ApproverLeaveBalance({ employeeId, leaveType, totalDays }: {
  employeeId: string;
  leaveType: string;
  totalDays: number;
}) {
  const { data, isLoading, isError } = useQuery<{ data: Balance[]; lopDays: number }>({
    // Keyed under "leave-balances" so the decision mutations' invalidation of
    // that prefix refreshes it after an approval.
    queryKey: ["leave-balances", "approver", employeeId],
    queryFn: () => api.get(`/api/v1/leaves/balances/employee/${employeeId}`).then((r) => r.data),
  });

  if (isLoading) {
    return <div className="h-24 rounded-lg bg-gray-50 animate-pulse" />;
  }
  if (isError || !data) {
    return (
      <p className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
        Leave balance unavailable.
      </p>
    );
  }

  // Types with nothing allocated, carried or earned are noise — except the one
  // being requested, which is always shown so "0 left" is visible.
  const rows = data.data
    .filter((b) => b.leaveType === leaveType || b.allocated > 0 || b.carried > 0 || b.earned > 0)
    .sort((a, b) => (a.leaveType === leaveType ? -1 : b.leaveType === leaveType ? 1 : 0));

  const requested = data.data.find((b) => b.leaveType === leaveType);
  const exhausted = leaveType !== "UNPAID" && (!requested || requested.balance <= 0);

  return (
    <div className="rounded-lg border border-gray-200 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm font-medium text-gray-700 flex items-center gap-2">
          <Wallet size={15} /> Leave Balance
        </p>
        {data.lopDays > 0 && (
          <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-600">
            {data.lopDays} LoP day{data.lopDays === 1 ? "" : "s"} this year
          </span>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">No leave balances set up for this employee.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {rows.map((b) => {
            const isRequested = b.leaveType === leaveType;
            return (
              <div
                key={b.leaveType}
                className={`rounded-lg border px-3 py-2 ${isRequested ? "border-[#2C3E7C] bg-blue-50/60" : "border-gray-200 bg-white"}`}
              >
                <p className={`text-xs truncate ${isRequested ? "font-medium text-[#2C3E7C]" : "text-gray-500"}`}>
                  {LEAVE_LABEL[b.leaveType] ?? b.leaveType}{isRequested && " · requested"}
                </p>
                <p className="text-lg font-semibold text-gray-900 leading-tight mt-0.5">
                  {b.balance}
                  <span className="text-xs font-normal text-gray-400"> left</span>
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {b.used} used · {b.pending} pending
                </p>
              </div>
            );
          })}
        </div>
      )}

      {exhausted && (
        <p className="flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          No {LEAVE_LABEL[leaveType] ?? leaveType} balance left to cover these {totalDays} day{totalDays === 1 ? "" : "s"} — consider approving with Loss of Pay.
        </p>
      )}
      <p className="text-[11px] text-gray-400">Pending includes requests still awaiting a decision.</p>
    </div>
  );
}
