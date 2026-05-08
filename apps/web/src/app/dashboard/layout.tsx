"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Sidebar } from "@/components/layout/Sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, user, updateUser } = useAuthStore();

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

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
