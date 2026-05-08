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

const ALL_MODULES = [
  "EMP_PROFILE", "EMP_DOCUMENTS", "EMP_SALARY", "EMP_BANK", "EMP_LEAVES", "EMP_PAYOUT",
  "LEAVES", "CLAIMS", "POLICIES", "TRAINING",
  "MIS_EMP_DIRECTORY", "MIS_SALARY_STRUCT", "MIS_SALARY_DISB", "MIS_LEAVE_RECORDS", "MIS_HOLIDAYS",
  "ADMIN",
] as const;

const DENY_ALL: PermMap = Object.fromEntries(
  ALL_MODULES.map((m) => [m, { canView: false, canCreate: false, canEdit: false, canDelete: false, canApprove: false, canAppraise: false }])
);

const ALLOW_ALL: PermMap = Object.fromEntries(
  ALL_MODULES.map((m) => [m, { canView: true, canCreate: true, canEdit: true, canDelete: true, canApprove: true, canAppraise: true }])
);

export function usePermissions(): PermMap {
  const role = useAuthStore((s) => s.user?.role) ?? "EMPLOYEE";

  const { data } = useQuery<PermMap>({
    queryKey: ["my-permissions", role],
    queryFn: () => api.get("/api/v1/roles/my-permissions").then((r) => r.data.data),
    staleTime: 2 * 60 * 1000,
    // SUPER_ADMIN permissions cannot be modified — skip the network round-trip
    enabled: role !== "SUPER_ADMIN",
  });

  // SUPER_ADMIN always has everything — their permissions row cannot be edited in the admin panel
  if (role === "SUPER_ADMIN") return ALLOW_ALL;

  // Return fetched data once available; deny all while loading to prevent flash of forbidden content
  return data ?? DENY_ALL;
}
