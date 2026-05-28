"use client";

import { useStudentAuthStore } from "@/store/studentAuth";
import { useQuery } from "@tanstack/react-query";
import { studentApi } from "@/lib/studentApi";
import { User, MapPin, Users2, GraduationCap } from "lucide-react";
import Image from "next/image";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function Field({ label, value, className = "" }: { label: string; value?: string | null; className?: string }) {
  return (
    <div className={`space-y-0.5 ${className}`}>
      <p className="text-xs font-medium text-gray-400">{label}</p>
      <p className="text-sm text-gray-800">{value || <span className="text-gray-300">—</span>}</p>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-50">
        <Icon className="h-4 w-4 text-emerald-500" />
        <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
      </div>
      <div className="px-5 py-4">{children}</div>
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
      {/* Header skeleton */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="h-20 bg-gray-100 animate-pulse" />
        <div className="px-5 pb-5 pt-3 space-y-2">
          <div className="h-5 w-40 bg-gray-100 rounded animate-pulse" />
          <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
        </div>
      </div>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
          <div className="h-4 w-32 bg-gray-100 rounded animate-pulse" />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((j) => (
              <div key={j} className="space-y-1">
                <div className="h-3 w-16 bg-gray-100 rounded animate-pulse" />
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
  const { accessToken, student: authStudent } = useStudentAuthStore();

  const { data: profile, isLoading, isError } = useQuery({
    queryKey: ["student-portal-profile"],
    queryFn: () => studentApi.get("/api/v1/student/portal/profile").then((r) => r.data.data),
    staleTime: 2 * 60 * 1000,
    enabled: !!accessToken,
  });

  // Always show skeleton until we have the full profile from API
  if (isLoading || (!profile && !isError)) {
    return <Skeleton />;
  }

  // If API failed, still show what we have from auth store (name/code only)
  const s: any = profile ?? authStudent;
  const addr = s?.address ?? {};
  const batches: any[] = profile?.studentBatches ?? [];

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5">
      {/* Header card */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="h-20 bg-gradient-to-r from-emerald-600 to-teal-600" />
        <div className="px-5 pb-5">
          <div className="flex items-end gap-4 -mt-10 mb-4">
            <div className="h-20 w-20 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-2xl font-bold border-4 border-white shadow overflow-hidden shrink-0">
              {s?.photoUrl
                ? (
                  <img
                    src={`${API_BASE}${s.photoUrl}`}
                    alt="Student photo"
                    className="h-full w-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                )
                : null}
              {/* Always render initials as fallback (hidden by image above) */}
              <span className={s?.photoUrl ? "hidden" : ""}>
                {s?.firstName?.[0] ?? ""}{s?.lastName?.[0] ?? ""}
              </span>
            </div>
            <div className="pb-1">
              <h1 className="text-xl font-bold text-gray-900">
                {s?.firstName} {s?.middleName ? `${s.middleName} ` : ""}{s?.lastName}
              </h1>
              <p className="text-sm text-gray-400 font-mono">{s?.studentCode}</p>
            </div>
          </div>
          {batches.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {batches.map((sb: any) => (
                <span key={sb.id} className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
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
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
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
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
          <Field label="Address Line 1" value={addr?.line1} className="sm:col-span-2" />
          <Field label="City"           value={addr?.city} />
          <Field label="State"          value={addr?.state} />
          <Field label="Pincode"        value={addr?.pincode} />
          <Field label="Country"        value={addr?.country} />
        </div>
      </Section>

      {/* Father / Guardian */}
      <Section title="Father / Guardian" icon={Users2}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
          <Field label="Name"       value={s?.parentName} />
          <Field label="Phone"      value={s?.parentPhone} />
          <Field label="Email"      value={s?.parentEmail} />
          <Field label="Relation"   value={s?.parentRelation} />
          <Field label="Occupation" value={s?.parentOccupation} />
        </div>
      </Section>

      {/* Mother */}
      <Section title="Mother" icon={Users2}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
          <Field label="Name"       value={s?.motherName} />
          <Field label="Phone"      value={s?.motherPhone} />
          <Field label="Email"      value={s?.motherEmail} />
          <Field label="Occupation" value={s?.motherOccupation} />
        </div>
      </Section>

      {/* Current Batches */}
      {batches.length > 0 && (
        <Section title="Current Batches" icon={GraduationCap}>
          <div className="space-y-3">
            {batches.map((sb: any) => (
              <div key={sb.id} className="flex items-center gap-4 rounded-xl bg-gray-50 border border-gray-100 px-4 py-3">
                <div className="h-9 w-9 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                  <GraduationCap className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800">{sb.batch?.name}</p>
                  <p className="text-xs text-gray-400">
                    {sb.batch?.academicYear}
                    {sb.batch?.grade?.name ? ` · ${sb.batch.grade.name}` : ""}
                    {sb.batch?.location?.name ? ` · ${sb.batch.location.name}` : ""}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-gray-400">Joined</p>
                  <p className="text-xs font-medium text-gray-600">{fmt(sb.joinedAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
