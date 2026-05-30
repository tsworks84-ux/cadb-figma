"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStudentAuthStore } from "@/store/studentAuth";
import { StudentSidebar } from "@/components/student/StudentSidebar";
import { Menu } from "lucide-react";
import Image from "next/image";

export default function StudentDashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, mustChangePassword } = useStudentAuthStore();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) { router.replace("/student/login"); return; }
    if (mustChangePassword) { router.replace("/student/change-password"); return; }
  }, []);

  if (!isAuthenticated()) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar — mobile: overlay drawer, desktop: fixed left column */}
      <StudentSidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />

      {/* Main content column */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Mobile top bar — hidden on lg+ */}
        <header className="lg:hidden flex items-center justify-between h-14 px-4 bg-white border-b border-gray-100 shrink-0 shadow-sm">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="Centum Academy" width={28} height={28} className="rounded-full" />
            <span className="text-sm font-bold text-gray-800">Centum Academy</span>
          </div>

          {/* Spacer to keep logo centered */}
          <div className="w-9" />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
