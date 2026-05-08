"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { toast } from "sonner";
import { ShieldAlert, Eye, EyeOff } from "lucide-react";

const schema = z
  .object({
    currentPassword: z.string().min(1, "Required"),
    newPassword: z
      .string()
      .min(8, "At least 8 characters")
      .regex(/[A-Z]/, "Must contain an uppercase letter")
      .regex(/[0-9]/, "Must contain a number")
      .regex(/[^A-Za-z0-9]/, "Must contain a special character"),
    confirmPassword: z.string().min(1, "Required"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormData = z.infer<typeof schema>;

function PasswordInput({ label, error, ...props }: any) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="relative">
        <input
          {...props}
          type={show ? "text" : "password"}
          className="w-full rounded-lg border border-gray-300 px-4 py-2.5 pr-10 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error.message}</p>}
    </div>
  );
}

export default function ChangePasswordPage() {
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors }, watch } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const newPwd = watch("newPassword") ?? "";
  const strength = [
    newPwd.length >= 8,
    /[A-Z]/.test(newPwd),
    /[0-9]/.test(newPwd),
    /[^A-Za-z0-9]/.test(newPwd),
  ];
  const strengthCount = strength.filter(Boolean).length;
  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong"][strengthCount];
  const strengthColor = ["", "bg-red-400", "bg-orange-400", "bg-yellow-400", "bg-green-500"][strengthCount];

  async function onSubmit(data: FormData) {
    setLoading(true);
    try {
      await api.post("/api/v1/auth/change-password", {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      toast.success("Password changed! Please log in with your new password.");
      clearAuth();
      router.replace("/login");
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? "Failed to change password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-700 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-500 mb-4">
            <ShieldAlert className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Set Your Password</h1>
          <p className="text-slate-400 mt-2 text-sm">
            Welcome, <span className="text-white font-medium">{user?.firstName}</span>! Your account was created with a
            temporary password. Please set a new password to continue.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <PasswordInput
              label="Temporary Password"
              error={errors.currentPassword}
              {...register("currentPassword")}
            />
            <PasswordInput
              label="New Password"
              error={errors.newPassword}
              {...register("newPassword")}
            />

            {/* Strength meter */}
            {newPwd && (
              <div className="space-y-1.5">
                <div className="flex gap-1">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={`h-1.5 flex-1 rounded-full transition-colors ${
                        i < strengthCount ? strengthColor : "bg-gray-200"
                      }`}
                    />
                  ))}
                </div>
                <p className="text-xs text-gray-500">
                  {strengthLabel && <span className="font-medium">{strengthLabel} — </span>}
                  {!strength[0] && "8+ chars · "}
                  {!strength[1] && "uppercase · "}
                  {!strength[2] && "number · "}
                  {!strength[3] && "special char"}
                </p>
              </div>
            )}

            <PasswordInput
              label="Confirm New Password"
              error={errors.confirmPassword}
              {...register("confirmPassword")}
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {loading ? "Updating..." : "Set New Password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
