"use client";

import { useRef, useState } from "react";
import { useStudentAuthStore } from "@/store/studentAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { studentApi } from "@/lib/studentApi";
import { User, MapPin, Users2, GraduationCap, Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { fullName } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function Field({ label, value, className = "" }: { label: string; value?: string | null; className?: string }) {
  return (
    <div className={`space-y-0.5 ${className}`}>
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-sm text-gray-800 font-medium">{value || <span className="text-gray-300 font-normal">—</span>}</p>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-50">
        <div className="h-7 w-7 rounded-lg bg-sky-50 flex items-center justify-center">
          <Icon className="h-3.5 w-3.5 text-sky-600" />
        </div>
        <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
      </div>
      <div className="px-5 py-5">{children}</div>
    </div>
  );
}

function fmt(v?: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function Skeleton() {
  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5">
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
        <div className="h-28 bg-gradient-to-r from-sky-600 to-teal-600 animate-pulse" />
        <div className="px-5 pb-5 pt-3 space-y-2">
          <div className="h-5 w-44 bg-gray-100 rounded animate-pulse" />
          <div className="h-4 w-28 bg-gray-100 rounded animate-pulse" />
        </div>
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4 shadow-sm">
          <div className="h-4 w-36 bg-gray-100 rounded animate-pulse" />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((j) => (
              <div key={j} className="space-y-1">
                <div className="h-2.5 w-16 bg-gray-100 rounded animate-pulse" />
                <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function StudentProfilePage() {
  const { accessToken, student: authStudent, updateStudent } = useStudentAuthStore();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [localPhotoUrl, setLocalPhotoUrl] = useState<string | null>(null);

  const { data: profile, isLoading, isError } = useQuery({
    queryKey: ["student-portal-profile"],
    queryFn: () => studentApi.get("/api/v1/student/portal/profile").then((r) => r.data.data),
    staleTime: 2 * 60 * 1000,
    enabled: !!accessToken,
  });

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5 MB"); return; }

    const objectUrl = URL.createObjectURL(file);
    setLocalPhotoUrl(objectUrl);
    setUploading(true);

    try {
      const form = new FormData();
      form.append("file", file);
      const res = await studentApi.patch("/api/v1/student/portal/photo", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const newUrl: string = res.data.data.photoUrl;
      queryClient.setQueryData(["student-portal-profile"], (old: any) =>
        old ? { ...old, photoUrl: newUrl } : old,
      );
      updateStudent({ photoUrl: newUrl });
      toast.success("Profile photo updated!");
    } catch (err: any) {
      setLocalPhotoUrl(null);
      toast.error(err.response?.data?.error ?? "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  if (isLoading || (!profile && !isError)) return <Skeleton />;

  const s: any = profile ?? authStudent;
  const addr = s?.address ?? {};
  const batches: any[] = profile?.studentBatches ?? [];

  const displayPhoto = localPhotoUrl ?? (s?.photoUrl ? `${API_BASE}${s.photoUrl}` : null);
  const initials = `${s?.firstName?.[0] ?? ""}${s?.lastName?.[0] ?? ""}`;

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4">

      {/* Hero card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-28 bg-gradient-to-r from-sky-600 to-teal-600 relative">
          {/* subtle pattern overlay */}
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: "radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)", backgroundSize: "30px 30px" }}
          />
        </div>
        <div className="px-5 pb-5">
          {/* Avatar — negative margin pulls it up to overlap the banner */}
          <div className="-mt-12 mb-4">
            <div className="relative inline-block">
              <div className="rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center text-2xl font-bold border-4 border-white shadow-md overflow-hidden" style={{ height: 88, width: 88 }}>
                {displayPhoto ? (
                  <img src={displayPhoto} alt="Profile" className="h-full w-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                ) : <span>{initials}</span>}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-sky-600 hover:bg-sky-700 border-2 border-white flex items-center justify-center shadow-md transition-colors disabled:opacity-60"
                title="Change photo"
              >
                {uploading
                  ? <Loader2 className="h-3.5 w-3.5 text-white animate-spin" />
                  : <Camera className="h-3.5 w-3.5 text-white" />
                }
              </button>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp"
                className="hidden" onChange={handlePhotoChange} />
            </div>
          </div>

          {/* Name — sits cleanly in the white area below the avatar */}
          <div className="mb-4">
            <h1 className="text-xl font-bold text-gray-900">
              {fullName(s)}
            </h1>
            <p className="text-sm text-gray-400 font-mono">{s?.studentCode}</p>
          </div>

          {batches.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {batches.map((sb: any) => (
                <span key={sb.id}
                  className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 border border-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
                  <GraduationCap className="h-3 w-3" />
                  {sb.batch?.academicYear} · {sb.batch?.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Personal Details */}
      <Section title="Personal Details" icon={User}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-5">
          <Field label="First Name"    value={s?.firstName} />
          <Field label="Middle Name"   value={s?.middleName} />
          <Field label="Last Name"     value={s?.lastName} />
          <Field label="Gender"        value={s?.gender} />
          <Field label="Date of Birth" value={fmt(s?.dateOfBirth)} />
          <Field label="Nationality"   value={s?.nationality} />
          <Field label="Roll Number"   value={s?.rollNumber} />
          <Field label="Email"         value={s?.email} />
          <Field label="Phone"         value={s?.phone} />
        </div>
      </Section>

      {/* Address */}
      <Section title="Address" icon={MapPin}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-5">
          <Field label="Address Line 1" value={addr?.line1} className="sm:col-span-2" />
          <Field label="City"           value={addr?.city} />
          <Field label="State"          value={addr?.state} />
          <Field label="Pincode"        value={addr?.pincode} />
          <Field label="Country"        value={addr?.country} />
        </div>
      </Section>

      {/* Father / Guardian */}
      <Section title="Father / Guardian" icon={Users2}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-5">
          <Field label="Name"       value={s?.parentName} />
          <Field label="Phone"      value={s?.parentPhone} />
          <Field label="Email"      value={s?.parentEmail} />
          <Field label="Relation"   value={s?.parentRelation} />
          <Field label="Occupation" value={s?.parentOccupation} />
        </div>
      </Section>

      {/* Mother */}
      <Section title="Mother" icon={Users2}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-5">
          <Field label="Name"       value={s?.motherName} />
          <Field label="Phone"      value={s?.motherPhone} />
          <Field label="Email"      value={s?.motherEmail} />
          <Field label="Occupation" value={s?.motherOccupation} />
        </div>
      </Section>

      {/* Batches */}
      {batches.length > 0 && (
        <Section title="Current Batches" icon={GraduationCap}>
          <div className="space-y-3">
            {batches.map((sb: any) => (
              <div key={sb.id} className="flex items-center gap-4 rounded-xl bg-sky-50/60 border border-sky-100 px-4 py-3">
                <div className="h-9 w-9 rounded-xl bg-sky-100 flex items-center justify-center shrink-0">
                  <GraduationCap className="h-4 w-4 text-sky-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800">{sb.batch?.name}</p>
                  <p className="text-xs text-gray-500">
                    {sb.batch?.academicYear}
                    {sb.batch?.grade?.name ? ` · ${sb.batch.grade.name}` : ""}
                    {sb.batch?.location?.name ? ` · ${sb.batch.location.name}` : ""}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase">Joined</p>
                  <p className="text-xs font-semibold text-gray-600">{fmt(sb.joinedAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
