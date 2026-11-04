"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type LopAssessment = {
  totalDays: number;
  /** Balance still free for this leave type: accrued + carried + earned − approved. */
  available: number;
  /** Days the balance can't cover — Loss of Pay unless waived. */
  shortfall: number;
  /** Reporting manager, HR Admin or Super Admin may approve with less LoP than `shortfall`. */
  canWaive: boolean;
};

/**
 * What approving a pending leave costs in pay. The server applies the same rule
 * on /decision, so this is a pre-fill, not the enforcement: a non-supervisor who
 * sends less than `shortfall` gets a 403.
 */
export function useLopAssessment(leaveId: string, enabled = true) {
  return useQuery<LopAssessment>({
    queryKey: ["leave-balances", "lop-assessment", leaveId],
    queryFn: () => api.get(`/api/v1/leaves/${leaveId}/lop-assessment`).then((r) => r.data.data),
    enabled,
    staleTime: 0,
  });
}
