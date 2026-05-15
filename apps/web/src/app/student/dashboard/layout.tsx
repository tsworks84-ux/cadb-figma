"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStudentAuthStore } from "@/store/studentAuth";
import { StudentSidebar } from "@/components/student/StudentSidebar";

export default function StudentDashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, mustChangePassword } = useStudentAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated()) { router.replace("/student/login"); return; }
    if (mustChangePassword) { router.replace("/student/change-password"); return; }
  }, []);

  if (!isAuthenticated()) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <StudentSidebar />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
