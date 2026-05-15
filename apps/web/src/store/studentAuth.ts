"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { StudentLoginResponse } from "@cadb/types";

interface StudentAuthState {
  student: StudentLoginResponse["student"] | null;
  accessToken: string | null;
  refreshToken: string | null;
  mustChangePassword: boolean;
  setAuth: (data: StudentLoginResponse) => void;
  updateStudent: (patch: Partial<StudentLoginResponse["student"]>) => void;
  clearAuth: () => void;
  isAuthenticated: () => boolean;
}

export const useStudentAuthStore = create<StudentAuthState>()(
  persist(
    (set, get) => ({
      student: null,
      accessToken: null,
      refreshToken: null,
      mustChangePassword: false,
      setAuth: (data) => {
        localStorage.setItem("cadb_student_access_token", data.accessToken);
        localStorage.setItem("cadb_student_refresh_token", data.refreshToken);
        set({
          student: data.student,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          mustChangePassword: data.mustChangePassword,
        });
      },
      updateStudent: (patch) => set((s) => ({ student: s.student ? { ...s.student, ...patch } : s.student })),
      clearAuth: () => {
        localStorage.removeItem("cadb_student_access_token");
        localStorage.removeItem("cadb_student_refresh_token");
        set({ student: null, accessToken: null, refreshToken: null, mustChangePassword: false });
      },
      isAuthenticated: () => !!get().accessToken,
    }),
    { name: "cadb-student-auth" }
  )
);
