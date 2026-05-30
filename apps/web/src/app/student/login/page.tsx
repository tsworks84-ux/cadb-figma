"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { studentApi as api } from "@/lib/studentApi";
import { useStudentAuthStore } from "@/store/studentAuth";
import { toast } from "sonner";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { StudentLoginResponse } from "@cadb/types";

const schema = z.object({
  email:    z.string().email("Enter a valid email address"),
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
        { email: data.email, password: data.password },
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
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #0c2340 0%, #0c3d50 50%, #085450 100%)" }}>

      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #38bdf8, transparent)" }} />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #2dd4bf, transparent)" }} />
      </div>

      <div className="relative w-full max-w-md px-4">
        {/* Back link */}
        <Link href="/"
          className="inline-flex items-center gap-1.5 text-sky-300/70 hover:text-sky-200 text-sm mb-8 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to portal
        </Link>

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <div className="h-20 w-20 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/20 shadow-2xl">
                <Image src="/logo.png" alt="Centum Academy" width={56} height={56} className="drop-shadow-lg" priority />
              </div>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white">Student Portal</h1>
          <p className="text-sky-300/80 mt-1.5 text-sm">Sign in to your student account</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-7 ring-1 ring-black/5">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                Email Address
              </label>
              <input
                {...register("email")}
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 transition"
              />
              {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                Password
              </label>
              <div className="relative">
                <input
                  {...register("password")}
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 pr-11 text-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 transition"
                />
                <button type="button" tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>}
            </div>

            <button type="submit" disabled={loading}
              className="w-full rounded-xl bg-sky-600 py-3 text-sm font-bold text-white hover:bg-sky-700 disabled:opacity-60 transition-colors shadow-sm mt-1">
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <div className="mt-5 pt-5 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-400">
              Having trouble? Contact your institution admin.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
