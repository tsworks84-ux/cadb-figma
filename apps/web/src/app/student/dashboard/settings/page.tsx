"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { studentApi } from "@/lib/studentApi";
import { useStudentAuthStore } from "@/store/studentAuth";
import { toast } from "sonner";
import { Eye, EyeOff, ShieldCheck, Settings, LogOut } from "lucide-react";

const pwdSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "Must be at least 8 characters"),
  confirmPassword: z.string().min(1, "Please confirm"),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});
type PwdForm = z.infer<typeof pwdSchema>;

export default function StudentSettingsPage() {
  const router = useRouter();
  const { clearAuth } = useStudentAuthStore();
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState({ current: false, new: false, confirm: false });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<PwdForm>({
    resolver: zodResolver(pwdSchema),
  });

  async function onSubmit(data: PwdForm) {
    setLoading(true);
    try {
      await studentApi.post("/api/v1/student/auth/change-password", {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      toast.success("Password changed successfully.");
      reset();
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? "Failed to change password");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    const refreshToken = localStorage.getItem("cadb_student_refresh_token");
    try {
      await studentApi.post("/api/v1/student/auth/logout", { refreshToken });
    } catch {}
    clearAuth();
    router.push("/student/login");
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <Settings className="h-5 w-5 text-gray-500" />
        <h1 className="text-lg font-bold text-gray-900">Settings</h1>
      </div>

      {/* Change Password */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-50">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          <h2 className="text-sm font-semibold text-gray-800">Change Password</h2>
        </div>
        <div className="px-5 py-5">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Current */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Current Password</label>
              <div className="relative">
                <input {...register("currentPassword")} type={show.current ? "text" : "password"} placeholder="••••••••"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 pr-10 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                <button type="button" onClick={() => setShow((s) => ({ ...s, current: !s.current }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" tabIndex={-1}>
                  {show.current ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
              {errors.currentPassword && <p className="mt-1 text-xs text-red-500">{errors.currentPassword.message}</p>}
            </div>

            {/* New */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">New Password</label>
              <div className="relative">
                <input {...register("newPassword")} type={show.new ? "text" : "password"} placeholder="Min. 8 characters"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 pr-10 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                <button type="button" onClick={() => setShow((s) => ({ ...s, new: !s.new }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" tabIndex={-1}>
                  {show.new ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
              {errors.newPassword && <p className="mt-1 text-xs text-red-500">{errors.newPassword.message}</p>}
            </div>

            {/* Confirm */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Confirm New Password</label>
              <div className="relative">
                <input {...register("confirmPassword")} type={show.confirm ? "text" : "password"} placeholder="••••••••"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 pr-10 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                <button type="button" onClick={() => setShow((s) => ({ ...s, confirm: !s.confirm }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" tabIndex={-1}>
                  {show.confirm ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
              {errors.confirmPassword && <p className="mt-1 text-xs text-red-500">{errors.confirmPassword.message}</p>}
            </div>

            <button type="submit" disabled={loading}
              className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 transition-colors">
              {loading ? "Saving..." : "Update Password"}
            </button>
          </form>
        </div>
      </div>

      {/* Sign Out */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-50">
          <LogOut className="h-4 w-4 text-red-400" />
          <h2 className="text-sm font-semibold text-gray-800">Account</h2>
        </div>
        <div className="px-5 py-5">
          <p className="text-sm text-gray-500 mb-4">Sign out of the student portal on this device.</p>
          <button onClick={handleLogout}
            className="flex items-center gap-2 rounded-lg border border-red-100 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-100 transition-colors">
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
