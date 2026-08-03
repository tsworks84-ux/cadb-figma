"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldOff, ArrowLeft } from "lucide-react";
import { AcademicsTopNav, AcademicsMobileTabStrip } from "@/components/academics/AcademicsTopNav";
import { useAuthStore } from "@/store/auth";
import { usePermissionsState } from "@/hooks/usePermissions";
import { canViewAcademics, canViewAcademicsTab, moduleForAcademicsPath } from "@/lib/academicsAccess";

export default function AcademicsLayout({ children }: { children: React.ReactNode }) {

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Suspense fallback={<div style={{ height: 72, background: "#141735" }} />}>
        <AcademicsTopNav />
      </Suspense>
      <Suspense fallback={null}>
        <AcademicsMobileTabStrip />
      </Suspense>
      <main className="flex-1 overflow-y-auto" style={{ background: "#f4f6fa" }}>
        <AcademicsAccessGuard>{children}</AcademicsAccessGuard>
      </main>
    </div>
  );
}

/**
 * Blocks the page body unless the role has the grant for this route. Tabs are
 * already hidden by the nav, but this also covers deep links and bookmarks.
 * The API enforces the same rule — this is UX, not the security boundary.
 */
function AcademicsAccessGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const { permissions, ready } = usePermissionsState();

  // Don't judge access until auth has hydrated and the permission fetch resolved
  if (!user || !ready) return null;

  const allowed = canViewAcademics(user?.role, permissions)
    && canViewAcademicsTab(user?.role, permissions, moduleForAcademicsPath(pathname));

  if (!allowed) return <AcademicsAccessDenied />;

  return <>{children}</>;
}

function AcademicsAccessDenied() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-5 py-12">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm sm:px-10">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
          <ShieldOff className="h-6 w-6 text-slate-500" />
        </div>
        <p className="text-lg font-bold text-slate-900">Access denied</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          Your role doesn&apos;t have permission to view this part of Academics.
          Ask an administrator to grant it under Roles &amp; Permissions.
        </p>
        <Link
          href="/dashboard/home"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-slate-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
