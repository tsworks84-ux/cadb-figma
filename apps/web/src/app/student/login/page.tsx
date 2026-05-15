"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "@/lib/api";
import { useStudentAuthStore } from "@/store/studentAuth";
import { toast } from "sonner";
import { Eye, EyeOff, GraduationCap, ArrowLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { StudentLoginResponse } from "@cadb/types";

const schema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});
type FormData = z.infer<typeof schema>;

export default function StudentLoginPage() {
  const router = useRouter();
  const { setAuth, isAuthenticated } = useStudentAuthStore();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (isAuthenticated()) router.replace("/student/dashboard/home");
  }, []);

  async function onSubmit(data: FormData) {
    setLoading(true);
    try {
      const res = await api.post<{ success: boolean; data: StudentLoginResponse }>(
        "/api/v1/student/auth/login",
        { email: data.email, password: data.password }
      );
      setAuth(res.data.data);
      if (res.data.data.mustChangePassword) {
        toast.info("Please set a new password to continue.");
        router.push("/student/change-password");
      } else {
        toast.success(`Welcome, ${res.data.data.student.firstName}!`);
        router.push("/student/dashboard/home");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950">
      <div className="w-full max-w-md px-4">
        {/* Back to portal */}
        <Link href="/" className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white text-sm mb-8 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to portal
        </Link>

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <Image src="/logo.png" alt="Centum Academy" width={80} height={80} className="drop-shadow-lg" priority />
              <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500">
                <GraduationCap className="h-3.5 w-3.5 text-white" />
              </div>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white">Student Portal</h1>
          <p className="text-slate-400 mt-1 text-sm">Sign in to your student account</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <input
                {...register("email")}
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <input
                  {...register("password")}
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 pr-11 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
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

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 transition-colors"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          Having trouble? Contact your institution admin.
        </p>
      </div>
    </div>
  );
}
