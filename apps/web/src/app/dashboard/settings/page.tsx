"use client";

import { useAuthStore } from "@/store/auth";
import { useState, useRef } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Camera, Eye, EyeOff } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Required"),
    newPassword: z
      .string()
      .min(8, "At least 8 characters")
      .regex(/[A-Z]/, "Must contain uppercase")
      .regex(/[0-9]/, "Must contain a number")
      .regex(/[^A-Za-z0-9]/, "Must contain a special character"),
    confirmPassword: z.string().min(1, "Required"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type PasswordForm = z.infer<typeof passwordSchema>;

function PasswordField({ label, error, ...props }: { label: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="relative">
        <input
          {...props}
          type={show ? "text" : "password"}
          className={`w-full rounded-lg border px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${error ? "border-red-400 bg-red-50" : "border-gray-200"}`}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          tabIndex={-1}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
    </div>
  );
}

export default function SettingsPage() {
  const { user, updateUser } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
  });

  async function handlePhotoUpload(file: File) {
    if (!user?.id) return;
    setPhotoUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const token = localStorage.getItem("cadb_access_token");
      const res = await fetch(`${API_BASE}/api/v1/employees/${user.id}/photo`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Upload failed");
      }
      const json = await res.json();
      updateUser({ photoUrl: json.data.photoUrl });
      toast.success("Profile photo updated");
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setPhotoUploading(false);
    }
  }

  async function changePassword(data: PasswordForm) {
    setLoading(true);
    try {
      await api.post("/api/v1/auth/change-password", {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      toast.success("Password changed successfully");
      reset();
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? "Failed to change password");
    } finally {
      setLoading(false);
    }
  }

  const photoUrl = user?.photoUrl ? `${API_BASE}${user.photoUrl}` : null;
  const initials = user ? `${user.firstName[0]}${user.lastName[0]}` : "?";

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      {/* Profile Info + Photo Upload */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="font-semibold text-gray-900 mb-5">Profile</h2>
        <div className="flex items-center gap-5">
          {/* Clickable avatar */}
          <div
            className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white text-2xl font-bold overflow-hidden cursor-pointer group"
            onClick={() => photoRef.current?.click()}
            title="Click to change profile photo"
          >
            {photoUrl ? (
              <img src={photoUrl} alt="profile" className="h-full w-full object-cover" />
            ) : (
              initials
            )}
            <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity gap-1">
              {photoUploading
                ? <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <>
                    <Camera className="h-5 w-5 text-white" />
                    <span className="text-white text-[10px] font-medium">Change</span>
                  </>
              }
            </div>
          </div>
          <input
            ref={photoRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handlePhotoUpload(f);
              e.target.value = "";
            }}
          />

          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900">{user?.firstName} {user?.lastName}</p>
            <p className="text-sm text-gray-500 mt-0.5">{user?.email}</p>
            <p className="text-xs text-gray-400 mt-0.5">{user?.employeeCode} · {user?.role?.replace("_", " ")}</p>
            <button
              onClick={() => photoRef.current?.click()}
              disabled={photoUploading}
              className="mt-2 text-xs text-blue-600 hover:underline disabled:opacity-50"
            >
              {photoUploading ? "Uploading..." : "Upload profile photo"}
            </button>
            <p className="text-xs text-gray-400 mt-0.5">JPG, PNG or WEBP · max 3 MB</p>
          </div>
        </div>
      </div>

      {/* Change Password */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Change Password</h2>
        <form onSubmit={handleSubmit(changePassword)} className="space-y-4">
          <PasswordField
            label="Current Password"
            error={errors.currentPassword?.message}
            autoComplete="current-password"
            {...register("currentPassword")}
          />
          <PasswordField
            label="New Password"
            error={errors.newPassword?.message}
            autoComplete="new-password"
            {...register("newPassword")}
          />
          <PasswordField
            label="Confirm New Password"
            error={errors.confirmPassword?.message}
            autoComplete="new-password"
            {...register("confirmPassword")}
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? "Updating..." : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
