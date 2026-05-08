"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { toast } from "sonner";
import type { LoginResponse } from "@cadb/types";
import { Eye, EyeOff } from "lucide-react";
import Image from "next/image";

const schema = z.object({
  employeeCode: z.string().min(1, "Employee code is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  rememberMe: z.boolean().default(false),
});

type FormData = z.infer<typeof schema>;

const REMEMBER_KEY = "cadb_remembered_code";

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { rememberMe: false },
  });

  // Pre-fill remembered employee code on mount
  useEffect(() => {
    const saved = localStorage.getItem(REMEMBER_KEY);
    if (saved) {
      setValue("employeeCode", saved);
      setValue("rememberMe", true);
    }
  }, [setValue]);

  async function onSubmit(data: FormData) {
    setLoading(true);
    try {
      if (data.rememberMe) {
        localStorage.setItem(REMEMBER_KEY, data.employeeCode);
      } else {
        localStorage.removeItem(REMEMBER_KEY);
      }

      const res = await api.post<{ success: boolean; data: LoginResponse & { mustChangePassword?: boolean } }>(
        "/api/v1/auth/login",
        { employeeCode: data.employeeCode, password: data.password }
      );
      setAuth(res.data.data);
      if (res.data.data.mustChangePassword) {
        toast.info("Please set a new password to continue.");
        router.push("/change-password");
      } else {
        const role = res.data.data.employee.role;
        toast.success(`Welcome back, ${res.data.data.employee.firstName}!`);
        router.push(role === "EMPLOYEE" ? "/dashboard/home" : "/dashboard/employees");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-700">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Image src="/logo.png" alt="Centum Academy" width={100} height={100} className="drop-shadow-lg" priority />
          </div>
          <h1 className="text-2xl font-bold text-white">Centum Academy</h1>
          <p className="text-slate-400 mt-1">Sign in to your dashboard</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Employee Code */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Employee Code</label>
              <input
                {...register("employeeCode")}
                placeholder="SA0001"
                autoComplete="username"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {errors.employeeCode && <p className="mt-1 text-xs text-red-500">{errors.employeeCode.message}</p>}
            </div>

            {/* Password with show/hide */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <input
                  {...register("password")}
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 pr-11 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>}
            </div>

            {/* Remember me */}
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                {...register("rememberMe")}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-600">Remember my Employee Code</span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
