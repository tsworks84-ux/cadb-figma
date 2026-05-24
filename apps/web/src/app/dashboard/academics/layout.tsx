"use client";

import { useAuthStore } from "@/store/auth";
import { usePermissions } from "@/hooks/usePermissions";
import { AcademicsTopNav, AcademicsMobileTabStrip } from "@/components/academics/AcademicsTopNav";
import { School } from "lucide-react";

export default function AcademicsLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  const permissions = usePermissions();
  const role = user?.role ?? "EMPLOYEE";

  const canAccess =
    role === "SUPER_ADMIN" ||
    role === "HR_ADMIN" ||
    Object.keys(permissions)
      .filter((k) => k.startsWith("ACA_") || k.startsWith("STU_"))
      .some((k) => permissions[k]?.canView);

  if (!canAccess) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <School className="h-12 w-12 text-gray-200 mx-auto mb-3" />
          <p className="font-semibold text-gray-600">Access Restricted</p>
          <p className="text-sm text-gray-400 mt-1">You don't have permission to access the Academics section.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <AcademicsTopNav />
      <AcademicsMobileTabStrip />
      <main className="flex-1 overflow-y-auto" style={{ background: "#f4f6fa" }}>
        {children}
      </main>
    </div>
  );
}
