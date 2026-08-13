import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

export interface ModulePerms {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canApprove: boolean;
  canAppraise: boolean;
}

export type PermMap = Record<string, ModulePerms>;

/**
 * One module per Administration tab, so the Super Admin can hand out a single tab.
 *
 * Custom Roles and Roles & Permissions are absent on purpose: whoever can edit the
 * permission matrix can grant themselves everything else, so those two tabs stay
 * Super Admin only and are shown as locked rows in the matrix.
 */
export const ADMIN_MODULES = [
  "ADM_DEPARTMENTS", "ADM_DESIGNATIONS", "ADM_LEAVE_POLICIES",
  "ADM_WORK_LOCATIONS", "ADM_CLAIM_TYPES",
] as const;

const ALL_MODULES = [
  "EMP_PROFILE", "EMP_DOCUMENTS", "EMP_SALARY", "EMP_BANK", "EMP_LEAVES", "EMP_PAYOUT",
  "LEAVES", "CLAIMS", "POLICIES", "TRAINING",
  "MIS_EMP_DIRECTORY", "MIS_SALARY_STRUCT", "MIS_SALARY_DISB", "MIS_LEAVE_RECORDS", "MIS_HOLIDAYS", "MIS_CLAIMS",
  "ACA_BATCH", "ACA_SUBJECT", "ACA_SETTINGS",
  "STU_PROFILE", "STU_ADMISSION", "STU_ATTENDANCE", "STU_ASSIGNMENT", "STU_ASSESSMENT", "STU_TIMETABLE",
  ...ADMIN_MODULES,
] as const;

const DENY_ALL: PermMap = Object.fromEntries(
  ALL_MODULES.map((m) => [m, { canView: false, canCreate: false, canEdit: false, canDelete: false, canApprove: false, canAppraise: false }])
);

const ALLOW_ALL: PermMap = Object.fromEntries(
  ALL_MODULES.map((m) => [m, { canView: true, canCreate: true, canEdit: true, canDelete: true, canApprove: true, canAppraise: true }])
);

/**
 * Permission map plus a `ready` flag. Use this (rather than `usePermissions`)
 * when a denied result triggers a redirect or an "Access denied" screen, so the
 * UI can wait instead of flashing a false negative while the fetch is in flight.
 */
export function usePermissionsState(): { permissions: PermMap; ready: boolean } {
  const role = useAuthStore((s) => s.user?.role) ?? "EMPLOYEE";

  const { data, isPending } = useQuery<PermMap>({
    queryKey: ["my-permissions", role],
    queryFn: () => api.get("/api/v1/roles/my-permissions").then((r) => r.data.data),
    staleTime: 2 * 60 * 1000,
    // SUPER_ADMIN permissions cannot be modified — skip the network round-trip
    enabled: role !== "SUPER_ADMIN",
  });

  // SUPER_ADMIN always has everything — their permissions row cannot be edited in the admin panel
  if (role === "SUPER_ADMIN") return { permissions: ALLOW_ALL, ready: true };

  // Deny all while loading to prevent a flash of forbidden content
  return { permissions: data ?? DENY_ALL, ready: !isPending };
}

export function usePermissions(): PermMap {
  return usePermissionsState().permissions;
}
