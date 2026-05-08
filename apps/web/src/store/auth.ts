"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { LoginResponse } from "@cadb/types";

interface AuthState {
  user: LoginResponse["employee"] | null;
  accessToken: string | null;
  refreshToken: string | null;
  mustChangePassword: boolean;
  setAuth: (data: LoginResponse & { mustChangePassword?: boolean }) => void;
  updateUser: (patch: Partial<LoginResponse["employee"]>) => void;
  clearAuth: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      mustChangePassword: false,
      setAuth: (data) => {
        localStorage.setItem("cadb_access_token", data.accessToken);
        localStorage.setItem("cadb_refresh_token", data.refreshToken);
        set({
          user: data.employee,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          mustChangePassword: data.mustChangePassword ?? false,
        });
      },
      updateUser: (patch) => set((s) => ({ user: s.user ? { ...s.user, ...patch } : s.user })),
      clearAuth: () => {
        localStorage.removeItem("cadb_access_token");
        localStorage.removeItem("cadb_refresh_token");
        set({ user: null, accessToken: null, refreshToken: null, mustChangePassword: false });
      },
      isAuthenticated: () => !!get().accessToken,
    }),
    { name: "cadb-auth" }
  )
);
