"use client";

import { Suspense } from "react";
import { AcademicsTopNav, AcademicsMobileTabStrip } from "@/components/academics/AcademicsTopNav";

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
        {children}
      </main>
    </div>
  );
}
