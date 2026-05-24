"use client";

import { useAuthStore } from "@/store/auth";
import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { resolvePhotoUrl } from "@/lib/utils";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  User, Shield, Bell, Eye, EyeOff, Upload, Monitor, Globe,
  Lock, Mail, Phone, Clock, Calendar, Smartphone, Laptop, Save,
  Camera, Settings,
} from "lucide-react";


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

function PasswordField({
  label, error, ...props
}: { label: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <div className="relative">
        <input
          {...props}
          type={show ? "text" : "password"}
          className={`w-full px-4 py-2 pr-10 border rounded-md text-sm focus:outline-none focus:ring-2 ${error ? "border-red-400 bg-red-50" : "border-gray-200"}`}
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
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${checked ? "bg-blue-600" : "bg-gray-200"}`}
      style={checked ? { backgroundColor: "#2C3E7C" } : {}}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`}
      />
    </button>
  );
}

export default function SettingsPage() {
  const { user, updateUser } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [photoTs, setPhotoTs] = useState<number>(Date.now());
  const photoRef = useRef<HTMLInputElement>(null);

  const [notifications, setNotifications] = useState({
    emailNotices: true,
    emailLeaves: true,
    emailClaims: true,
    emailTasks: true,
    pushNotices: true,
    pushLeaves: false,
    pushClaims: false,
  });

  const [preferences, setPreferences] = useState({
    dateFormat: "DD/MM/YYYY",
    timeFormat: "12",
    timezone: "Asia/Kolkata",
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
  });

  // Fetch full employee profile for phone and designation
  const { data: profile } = useQuery({
    queryKey: ["employee", user?.id],
    queryFn: () => api.get(`/api/v1/employees/${user?.id}`).then((r) => r.data.data),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  async function handlePhotoUpload(file: File) {
    if (!user?.id) return;
    setPhotoUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.patch(`/api/v1/employees/${user.id}/photo`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      updateUser({ photoUrl: res.data.data.photoUrl });
      setPhotoTs(Date.now());
      toast.success("Profile photo updated");
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? e.message ?? "Upload failed");
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

  const resolvedBase = resolvePhotoUrl(user?.photoUrl);
  const photoUrl = resolvedBase
    ? `${resolvedBase}${resolvedBase.includes("?") ? "&" : "?"}v=${photoTs}`
    : "/default-avatar.svg";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: "#2C3E7C" }}>
            <Settings className="text-white" size={18} />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
        </div>
        <p className="text-sm text-gray-600 mt-1 ml-10">Manage your account and preferences</p>
      </div>

      {/* ── Profile ── */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-5 flex items-center gap-2">
          <User size={18} style={{ color: "#2C3E7C" }} />
          Profile
        </h2>

        <div className="flex flex-col md:flex-row gap-6">
          {/* Avatar */}
          <div className="flex flex-col items-center gap-3 shrink-0">
            <div
              className="w-28 h-28 rounded-xl flex items-center justify-center text-white text-3xl font-bold overflow-hidden cursor-pointer group relative"
              style={{ backgroundColor: "#2C3E7C" }}
              onClick={() => photoRef.current?.click()}
              title="Click to change profile photo"
            >
              <img src={photoUrl} alt="profile" className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                {photoUploading
                  ? <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <><Camera className="h-5 w-5 text-white" /><span className="text-white text-[10px] font-medium">Change</span></>
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
            <button
              onClick={() => photoRef.current?.click()}
              disabled={photoUploading}
              className="px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
            >
              <Upload size={15} /> Upload photo
            </button>
            <p className="text-xs text-gray-400">JPG, PNG or WEBP · max 3 MB</p>
          </div>

          {/* Profile fields */}
          <div className="flex-1 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                <input
                  type="text"
                  defaultValue={user ? `${user.firstName} ${user.lastName}` : ""}
                  disabled
                  className="w-full px-4 py-2 border border-gray-200 rounded-md text-sm bg-gray-50 text-gray-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Employee ID</label>
                <input
                  type="text"
                  value={user?.employeeCode ?? ""}
                  disabled
                  className="w-full px-4 py-2 border border-gray-200 rounded-md text-sm bg-gray-50 text-gray-500"
                  readOnly
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <Mail size={14} /> Email
                </label>
                <input
                  type="email"
                  value={user?.email ?? ""}
                  disabled
                  className="w-full px-4 py-2 border border-gray-200 rounded-md text-sm bg-gray-50 text-gray-500"
                  readOnly
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <Phone size={14} /> Phone
                </label>
                <input
                  type="tel"
                  value={profile?.phone ?? "—"}
                  disabled
                  className="w-full px-4 py-2 border border-gray-200 rounded-md text-sm bg-gray-50 text-gray-500"
                  readOnly
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
              <input
                type="text"
                value={user?.role?.replace(/_/g, " ") ?? ""}
                disabled
                className="w-full px-4 py-2 border border-gray-200 rounded-md text-sm bg-gray-50 text-gray-500"
                readOnly
              />
            </div>

            <p className="text-xs text-gray-400">
              Profile details are managed by HR. Contact your HR administrator to update personal information.
            </p>
          </div>
        </div>
      </div>

      {/* ── Security ── */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-5 flex items-center gap-2">
          <Shield size={18} style={{ color: "#2C3E7C" }} />
          Security
        </h2>

        {/* 2FA */}
        <div className="mb-6 pb-6 border-b border-gray-200">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Two-Factor Authentication</h3>
              <p className="text-sm text-gray-600">Add an extra layer of security to your account</p>
            </div>
            <ToggleSwitch checked={twoFactorEnabled} onChange={setTwoFactorEnabled} />
          </div>
          {twoFactorEnabled && (
            <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-md">
              <p className="text-sm text-green-800">2FA is enabled. Your account has an extra layer of protection.</p>
            </div>
          )}
        </div>

        {/* Change Password */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Lock size={16} /> Change Password
          </h3>
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
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 rounded-md text-sm font-medium text-white disabled:opacity-60 hover:opacity-90"
                style={{ backgroundColor: "#2C3E7C" }}
              >
                {loading ? "Updating…" : "Update Password"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ── Notification Preferences ── */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-5 flex items-center gap-2">
          <Bell size={18} style={{ color: "#2C3E7C" }} />
          Notification Preferences
        </h2>

        <div className="space-y-6">
          {/* Email */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Mail size={15} /> Email Notifications
            </h3>
            <div className="space-y-3 ml-6">
              {[
                { key: "emailNotices" as const, label: "Notice Board updates" },
                { key: "emailLeaves" as const, label: "Leave requests and approvals" },
                { key: "emailClaims" as const, label: "Claim requests and approvals" },
                { key: "emailTasks" as const, label: "Task assignments and updates" },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm text-gray-700">{label}</span>
                  <input
                    type="checkbox"
                    checked={notifications[key]}
                    onChange={(e) => setNotifications((n) => ({ ...n, [key]: e.target.checked }))}
                    className="w-4 h-4 rounded border-gray-300"
                    style={{ accentColor: "#2C3E7C" }}
                  />
                </label>
              ))}
            </div>
          </div>

          {/* Push */}
          <div className="pt-4 border-t border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Smartphone size={15} /> Push Notifications
            </h3>
            <div className="space-y-3 ml-6">
              {[
                { key: "pushNotices" as const, label: "Notice Board updates" },
                { key: "pushLeaves" as const, label: "Leave requests and approvals" },
                { key: "pushClaims" as const, label: "Claim requests and approvals" },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm text-gray-700">{label}</span>
                  <input
                    type="checkbox"
                    checked={notifications[key]}
                    onChange={(e) => setNotifications((n) => ({ ...n, [key]: e.target.checked }))}
                    className="w-4 h-4 rounded border-gray-300"
                    style={{ accentColor: "#2C3E7C" }}
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={() => toast.success("Notification preferences saved")}
              className="px-4 py-2 rounded-md text-sm font-medium text-white flex items-center gap-2 hover:opacity-90"
              style={{ backgroundColor: "#2C3E7C" }}
            >
              <Save size={15} /> Save Preferences
            </button>
          </div>
        </div>
      </div>

      {/* ── Display Preferences ── */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-5 flex items-center gap-2">
          <Monitor size={18} style={{ color: "#2C3E7C" }} />
          Display Preferences
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Calendar size={14} /> Date Format
            </label>
            <select
              value={preferences.dateFormat}
              onChange={(e) => setPreferences((p) => ({ ...p, dateFormat: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 bg-white"
            >
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Clock size={14} /> Time Format
            </label>
            <select
              value={preferences.timeFormat}
              onChange={(e) => setPreferences((p) => ({ ...p, timeFormat: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 bg-white"
            >
              <option value="12">12-hour (AM/PM)</option>
              <option value="24">24-hour</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Globe size={14} /> Timezone
            </label>
            <select
              value={preferences.timezone}
              onChange={(e) => setPreferences((p) => ({ ...p, timezone: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 bg-white"
            >
              <option value="Asia/Kolkata">India Standard Time (IST)</option>
              <option value="America/New_York">Eastern Time (ET)</option>
              <option value="America/Los_Angeles">Pacific Time (PT)</option>
              <option value="Europe/London">Greenwich Mean Time (GMT)</option>
              <option value="Asia/Dubai">Gulf Standard Time (GST)</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <button
            onClick={() => toast.success("Display preferences saved")}
            className="px-4 py-2 rounded-md text-sm font-medium text-white flex items-center gap-2 hover:opacity-90"
            style={{ backgroundColor: "#2C3E7C" }}
          >
            <Save size={15} /> Save Preferences
          </button>
        </div>
      </div>

      {/* ── Active Sessions ── */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-5 flex items-center gap-2">
          <Laptop size={18} style={{ color: "#2C3E7C" }} />
          Active Sessions
        </h2>

        <div className="space-y-3">
          {/* Current session */}
          <div className="flex items-start justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: "#2C3E7C" }}
              >
                <Laptop className="text-white" size={18} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Browser · This Device</p>
                <p className="text-xs text-gray-500">Last active: Now</p>
                <p className="text-xs font-medium mt-0.5 text-green-600">Current Session</p>
              </div>
            </div>
          </div>

          {/* Other session */}
          <div className="flex items-start justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gray-300 shrink-0">
                <Smartphone className="text-white" size={18} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Mobile · Safari</p>
                <p className="text-xs text-gray-500">Last active: 2 hours ago</p>
              </div>
            </div>
            <button
              onClick={() => toast.success("Session revoked")}
              className="text-xs text-red-600 hover:text-red-700 font-medium shrink-0"
            >
              Revoke
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
