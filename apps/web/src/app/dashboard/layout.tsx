"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Sidebar } from "@/components/layout/Sidebar";
import { Menu } from "lucide-react";
import Image from "next/image";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isAcademicsHub = pathname.startsWith("/dashboard/academics");
  const { isAuthenticated, user, updateUser } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close the drawer on navigation so it never covers the page you just opened
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    const store = useAuthStore.getState();
    if (store.mustChangePassword) {
      router.replace("/change-password");
    }
  }, [isAuthenticated, router]);

  // Always fetch fresh profile so role/name changes reflect immediately on any page
  const { data: profile } = useQuery({
    queryKey: ["employee", user?.id],
    queryFn: () => api.get(`/api/v1/employees/${user?.id}`).then((r) => r.data.data),
    enabled: !!user?.id,
    staleTime: 0,
  });

  useEffect(() => {
    if (!profile || !user) return;
    const roleChanged = profile.role !== user.role;
    const changed =
      roleChanged ||
      profile.photoUrl !== user.photoUrl ||
      profile.firstName !== user.firstName ||
      profile.lastName !== user.lastName;
    if (changed) {
      updateUser({
        role: profile.role,
        photoUrl: profile.photoUrl,
        firstName: profile.firstName,
        lastName: profile.lastName,
      });
    }
    // If the role changed, the JWT still carries the old role — force a refresh
    // so all subsequent API calls use the updated role immediately.
    if (roleChanged) {
      const refreshToken = localStorage.getItem("cadb_refresh_token");
      if (refreshToken) {
        api.post("/api/v1/auth/refresh", { refreshToken })
          .then(({ data }) => {
            if (data.data?.accessToken) {
              localStorage.setItem("cadb_access_token", data.data.accessToken);
            }
          })
          .catch(() => {});
      }
    }
  }, [profile]);

  // Academics hub has its own full-screen layout with its own sidebar
  if (isAcademicsHub) {
    return <div className="h-screen overflow-hidden bg-gray-50">{children}</div>;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Below lg the sidebar is an overlay drawer; from lg up it's the left column */}
      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />

      {/* min-w-0 stops a wide child (table, long heading) from forcing the whole
          page to scroll sideways — it makes the column shrinkable instead. */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Mobile top bar — the only way to reach the nav below lg */}
        <header className="lg:hidden flex items-center justify-between h-14 px-4 bg-white border-b border-gray-100 shrink-0 shadow-sm">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 -ml-2 rounded-lg text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-colors"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <Image src="/logo.png" alt="Centum Academy" width={28} height={28} className="rounded-full shrink-0" />
            <span className="text-sm font-bold text-gray-800 truncate">Centum Academy</span>
          </div>

          {/* Spacer keeps the logo optically centred against the menu button */}
          <div className="w-9 shrink-0" />
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
