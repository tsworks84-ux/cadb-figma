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
  newPassword:     z.string().min(8, "Must be at least 8 characters"),
  confirmPassword: z.string().min(1, "Please confirm"),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "Passwords do not match", path: ["confirmPassword"],
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
    try { await studentApi.post("/api/v1/student/auth/logout", { refreshToken }); } catch {}
    clearAuth();
    router.push("/student/login");
  }

  const inputClass = "w-full rounded-xl border border-gray-200 px-3.5 py-2.5 pr-10 text-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 transition";

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-5">

      {/* Heading */}
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-xl bg-gray-100 flex items-center justify-center">
          <Settings className="h-4 w-4 text-gray-500" />
        </div>
        <h1 className="text-lg font-bold text-gray-900">Settings</h1>
      </div>

      {/* Change Password */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-50">
          <div className="h-7 w-7 rounded-lg bg-sky-50 flex items-center justify-center">
            <ShieldCheck className="h-3.5 w-3.5 text-sky-600" />
          </div>
          <h2 className="text-sm font-semibold text-gray-800">Change Password</h2>
        </div>
        <div className="px-5 py-5">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {([
              { key: "current" as const, field: "currentPassword" as const, label: "Current Password",     ph: "••••••••"       },
              { key: "new"     as const, field: "newPassword"     as const, label: "New Password",          ph: "Min. 8 characters" },
              { key: "confirm" as const, field: "confirmPassword" as const, label: "Confirm New Password",  ph: "••••••••"       },
            ]).map(({ key, field, label, ph }) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">{label}</label>
                <div className="relative">
                  <input {...register(field)} type={show[key] ? "text" : "password"} placeholder={ph}
                    className={inputClass} />
                  <button type="button" tabIndex={-1}
                    onClick={() => setShow((s) => ({ ...s, [key]: !s[key] }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {show[key] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
                {errors[field] && <p className="mt-1 text-xs text-red-500">{errors[field]?.message}</p>}
              </div>
            ))}

            <button type="submit" disabled={loading}
              className="w-full rounded-xl bg-sky-600 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60 transition-colors mt-2">
              {loading ? "Saving…" : "Update Password"}
            </button>
          </form>
        </div>
      </div>

      {/* Sign Out */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-50">
          <div className="h-7 w-7 rounded-lg bg-red-50 flex items-center justify-center">
            <LogOut className="h-3.5 w-3.5 text-red-500" />
          </div>
          <h2 className="text-sm font-semibold text-gray-800">Account</h2>
        </div>
        <div className="px-5 py-5">
          <p className="text-sm text-gray-500 mb-4">Sign out of the student portal on this device.</p>
          <button onClick={handleLogout}
            className="inline-flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-100 transition-colors">
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
