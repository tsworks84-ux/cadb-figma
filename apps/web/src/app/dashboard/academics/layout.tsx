"use client";

import { AcademicsTopNav, AcademicsMobileTabStrip } from "@/components/academics/AcademicsTopNav";

export default function AcademicsLayout({ children }: { children: React.ReactNode }) {

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
