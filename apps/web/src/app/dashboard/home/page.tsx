"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { formatDate, formatCurrency, getInitials } from "@/lib/utils";
import Link from "next/link";
import { useState } from "react";
import {
  CalendarOff, Receipt, GraduationCap, Shield, Clock,
  CheckCircle, AlertCircle, User, Pencil, AlertTriangle,
  Megaphone, Info, Pin, TrendingUp, TrendingDown,
  Users, Briefcase, Headphones, BarChart2, UserCheck, FileText,
  Activity, Star, ChevronRight, CalendarDays,
} from "lucide-react";

// ── Super Admin Dashboard ──────────────────────────────────────────────────────

function MetricCard({ icon: Icon, trend, trendUp, title, value, sub }: {
  icon: React.ElementType; trend: string; trendUp: boolean;
  title: string; value: string; sub: string;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100">
          <Icon className="h-5 w-5 text-gray-500" />
        </div>
        <span className={`flex items-center gap-1 text-xs font-medium ${trendUp ? "text-green-500" : "text-red-500"}`}>
          {trendUp ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
          {trend}
        </span>
      </div>
      <p className="text-sm text-gray-500 mb-1">{title}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, subtitle, linkLabel = "View Details" }: {
  icon: React.ElementType; title: string; subtitle: string; linkLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#354070]">
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <p className="text-xs text-gray-400">{subtitle}</p>
        </div>
      </div>
      <button className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 transition-colors">
        {linkLabel} <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function SuperAdminDashboard() {
  const { user } = useAuthStore();

  const now = new Date();
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening";
  const dateStr = now.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  const currentYear = (() => {
    const d = new Date();
    const y = d.getFullYear();
    const start = d.getMonth() >= 3 ? y : y - 1; // April = month 3
    return `${start}-${String(start + 1).slice(-2)}`;
  })();

  return (
    <div className="-m-6 bg-white min-h-screen">
      {/* Top bar — the bell lives in the app header now, so this is the clock */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 sm:px-6 py-3 flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-1.5 ml-auto text-xs text-gray-500">
          <Clock className="h-4 w-4" />
          <span>{dateStr}, {timeStr}</span>
        </div>
      </div>

      {/* Greeting */}
      <div className="px-4 sm:px-8 py-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{greeting}, {user?.firstName} {user?.lastName}</h1>
          <p className="text-sm text-gray-400 mt-1">Super Administrator · Administration · Director</p>
        </div>
        <div className="flex items-center gap-5 shrink-0">
          <div>
            <p className="text-xs text-gray-400">System Status</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="h-2 w-2 rounded-full bg-green-500 inline-block" />
              <span className="text-sm font-semibold text-gray-800">Operational</span>
            </div>
          </div>
          <div className="w-px h-8 bg-gray-200" />
          <div>
            <p className="text-xs text-gray-400">Current Session</p>
            <p className="text-sm font-semibold text-gray-800 mt-0.5">
              {currentYear ? `Academic Year ${currentYear}` : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="px-4 sm:px-8 py-6 space-y-8">

        {/* Student Performance Metrics */}
        <div>
          <SectionHeader icon={Users} title="Student Performance Metrics" subtitle="Academic performance and attendance analytics" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <MetricCard icon={UserCheck} trend="+2.3%" trendUp title="Average Daily Attendance" value="92.5%" sub="Last 30 days" />
            <MetricCard icon={TrendingUp} trend="+5.1%" trendUp title="Average Test Performance" value="78.4%" sub="Across all subjects" />
            <MetricCard icon={FileText} trend="-1.2%" trendUp={false} title="Average Assignment Submission Rate" value="85.7%" sub="On-time submissions" />
          </div>
        </div>

        {/* Faculty & Staff Analytics */}
        <div>
          <SectionHeader icon={Briefcase} title="Faculty & Staff Analytics" subtitle="Employee performance and workforce metrics" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <MetricCard icon={Activity} trend="+3.5%" trendUp title="Average Employee Workload" value="78%" sub="Capacity utilization" />
            <MetricCard icon={Star} trend="+0.2" trendUp title="Average Employee Quality Score" value="4.6/5" sub="Based on peer reviews" />
            <MetricCard icon={Briefcase} trend="+8" trendUp title="Total Number of Employees" value="247" sub="Active staff members" />
          </div>
        </div>

        {/* Parent Relations & Support */}
        <div>
          <SectionHeader icon={Headphones} title="Parent Relations & Support" subtitle="Service requests and stakeholder engagement" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <MetricCard icon={Headphones} trend="+12" trendUp title="Total Number of Service Requests" value="124" sub="This month" />
            <MetricCard icon={Clock} trend="-0.5 days" trendUp={false} title="Average Turn Around Time" value="2.3 days" sub="Resolution time" />
            <MetricCard icon={Clock} trend="-6" trendUp={false} title="Number of Open SRs" value="18" sub="Pending resolution" />
          </div>
        </div>

        {/* Administrative Alerts */}
        <div>
          <SectionHeader icon={BarChart2} title="Administrative Alerts" subtitle="Key highlights and notifications" linkLabel="View All" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-start gap-4 rounded-xl border border-green-100 bg-green-50 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-100">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Test Performance Improved</p>
                <p className="text-xs text-gray-500 mt-1">Grade 10 mathematics scores increased by 12% this quarter</p>
              </div>
            </div>
            <div className="flex items-start gap-4 rounded-xl border border-amber-100 bg-amber-50 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Priority Service Requests</p>
                <p className="text-xs text-gray-500 mt-1">5 service requests require immediate administrative review</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

type AnnType = "GENERAL" | "IMPORTANT" | "URGENT";
interface Announcement {
  id: string; title: string; body: string; type: AnnType; pinned: boolean;
  createdAt: string; expiresAt?: string | null;
  postedBy: { firstName: string; lastName: string };
}
const ANN_META: Record<AnnType, { border: string; bg: string; icon: React.ElementType; iconColor: string; badge: string }> = {
  GENERAL:   { border: "border-l-blue-400",  bg: "bg-blue-50",   icon: Info,          iconColor: "text-blue-500",   badge: "bg-blue-100 text-blue-700" },
  IMPORTANT: { border: "border-l-orange-400",bg: "bg-orange-50", icon: AlertTriangle,  iconColor: "text-orange-500", badge: "bg-orange-100 text-orange-700" },
  URGENT:    { border: "border-l-red-500",   bg: "bg-red-50",    icon: AlertCircle,   iconColor: "text-red-500",    badge: "bg-red-100 text-red-700" },
};

function StatCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

const LEAVE_COLOR: Record<string, string> = {
  CASUAL: "bg-blue-500", SICK: "bg-red-500", EARNED: "bg-green-500",
  MATERNITY: "bg-pink-500", PATERNITY: "bg-indigo-500",
  COMPENSATORY: "bg-yellow-500", UNPAID: "bg-gray-400", SPECIAL: "bg-purple-500",
};

// ── Faculty Schedule Widget ────────────────────────────────────────────────────

const SLOT_STATUS: Record<string, { bg: string; text: string; border: string; dot: string; label: string }> = {
  UPCOMING:  { bg: "bg-blue-50",   text: "text-blue-700",  border: "border-blue-200",  dot: "bg-blue-500",   label: "Upcoming"  },
  ONGOING:   { bg: "bg-green-50",  text: "text-green-700", border: "border-green-200", dot: "bg-green-500",  label: "Ongoing"   },
  COMPLETED: { bg: "bg-gray-50",   text: "text-gray-500",  border: "border-gray-200",  dot: "bg-gray-400",   label: "Completed" },
  CONCLUDED: { bg: "bg-gray-50",   text: "text-gray-500",  border: "border-gray-200",  dot: "bg-gray-400",   label: "Concluded" },
  CANCELLED: { bg: "bg-red-50",    text: "text-red-600",   border: "border-red-200",   dot: "bg-red-400",    label: "Cancelled" },
};

function toLocalDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function ScheduleSlotCard({ s }: { s: any }) {
  const st = SLOT_STATUS[s.status] ?? SLOT_STATUS.UPCOMING;
  const batches = s.batches?.map((b: any) => b.batch?.name).filter(Boolean).join(", ");
  return (
    <div className="flex items-start gap-3 rounded-lg border border-gray-100 bg-white p-3 shadow-sm">
      {/* Time */}
      <div className="shrink-0 w-[68px] text-right">
        <p className="text-xs font-bold text-gray-800 tabular-nums">{fmtTime(s.startTime)}</p>
        <p className="text-[11px] text-gray-400 tabular-nums">{fmtTime(s.endTime)}</p>
      </div>
      {/* Dot */}
      <div className="flex items-center justify-center pt-1.5 shrink-0">
        <div className={`w-2.5 h-2.5 rounded-full ${st.dot}`} />
      </div>
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-0.5">
          <span className="text-sm font-semibold text-gray-900 truncate">{s.subject?.name ?? "Class"}</span>
          <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full border font-semibold ${st.bg} ${st.text} ${st.border}`}>
            {st.label}
          </span>
        </div>
        {batches && <p className="text-xs text-gray-500 mt-0.5">{batches}</p>}
        {s.location?.name && <p className="text-xs text-gray-400 mt-0.5">📍 {s.location.name}</p>}
        {s.topics && <p className="text-xs text-indigo-600 mt-0.5 italic truncate">Topic: {s.topics}</p>}
      </div>
    </div>
  );
}

function FacultyScheduleWidget({ employeeId }: { employeeId: string }) {
  const [pickedDate, setPickedDate] = useState("");  // "" = default (today + tomorrow)

  const todayDate    = new Date(); todayDate.setHours(0, 0, 0, 0);
  const tomorrowDate = new Date(todayDate); tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const todayStr     = toLocalDateStr(todayDate);
  const tomorrowStr  = toLocalDateStr(tomorrowDate);

  const isDefault = !pickedDate;
  const dateFrom  = isDefault ? todayStr    : pickedDate;
  const dateTo    = isDefault ? tomorrowStr : pickedDate;

  const { data, isLoading } = useQuery({
    queryKey: ["faculty-schedule", employeeId, dateFrom, dateTo],
    queryFn: () =>
      api.get("/api/v1/academics/schedules", { params: { employeeId, dateFrom, dateTo, limit: 50 } })
        .then((r) => r.data.data as any[]),
    staleTime: 2 * 60 * 1000,
    enabled: !!employeeId,
  });

  const schedules = data ?? [];
  const grouped: Record<string, any[]> = {};
  for (const s of schedules) {
    const key = s.date?.split("T")[0] ?? "";
    if (key) (grouped[key] ??= []).push(s);
  }

  const displayDates = isDefault ? [todayStr, tomorrowStr] : [pickedDate];

  return (
    <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-5 py-4 border-b border-gray-100">
        <div>
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-indigo-600" /> My Schedule
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {isDefault
              ? "Today & tomorrow"
              : new Date(`${pickedDate}T00:00:00`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!isDefault && (
            <button onClick={() => setPickedDate("")} className="text-xs text-indigo-600 hover:underline">
              ← Today
            </button>
          )}
          <input
            type="date" max="2099-12-31" min="1900-01-01"
            value={pickedDate}
            onChange={(e) => setPickedDate(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          />
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-5">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-lg bg-gray-100 animate-pulse" />)}
          </div>
        ) : (
          displayDates.map((dateStr) => {
            const daySlots = (grouped[dateStr] ?? [])
              .slice()
              .sort((a: any, b: any) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

            const dateObj  = new Date(`${dateStr}T00:00:00`);
            const dayTag   = dateStr === todayStr ? "Today" : dateStr === tomorrowStr ? "Tomorrow" : "";
            const fullDate = dateObj.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

            return (
              <div key={dateStr}>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                  {dayTag ? `${dayTag} · ` : ""}{fullDate}
                </p>
                {daySlots.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-200 py-6 text-center">
                    <CalendarDays className="h-6 w-6 text-gray-300 mx-auto mb-1.5" />
                    <p className="text-sm text-gray-400">No classes scheduled</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {daySlots.map((s: any) => <ScheduleSlotCard key={s.id} s={s} />)}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function HomeDashboardPage() {
  const { user } = useAuthStore();

  const { data: profile } = useQuery({
    queryKey: ["employee", user?.id],
    queryFn: () =>
      user ? api.get(`/api/v1/employees/${user.id}`).then((r) => r.data.data) : null,
    enabled: !!user?.id,
    staleTime: 0,
  });

  const { data: leaveBalances } = useQuery({
    queryKey: ["my-leave-balances"],
    queryFn: () =>
      user ? api.get(`/api/v1/employees/${user.id}/leave-balances`).then((r) => r.data.data) : null,
    enabled: !!user?.id,
  });

  const { data: myLeaves } = useQuery({
    queryKey: ["my-leaves"],
    queryFn: () => api.get("/api/v1/leaves/my").then((r) => r.data.data),
  });

  const { data: myClaims } = useQuery({
    queryKey: ["my-claims"],
    queryFn: () => api.get("/api/v1/claims/my").then((r) => r.data.data),
  });

  const { data: enrollments } = useQuery({
    queryKey: ["my-enrollments"],
    queryFn: () => api.get("/api/v1/training/my-enrollments").then((r) => r.data.data),
  });

  const { data: policies } = useQuery({
    queryKey: ["policies"],
    queryFn: () => api.get("/api/v1/policies").then((r) => r.data.data),
  });

  // Detect faculty: employee has any schedule entries (as assigned faculty)
  const { data: facultyCheck, isLoading: facultyCheckLoading } = useQuery({
    queryKey: ["faculty-check", user?.id],
    queryFn: () =>
      api.get("/api/v1/academics/schedules", { params: { employeeId: user?.id, limit: 1 } })
        .then((r) => r.data),
    enabled: !!user?.id && user?.role !== "SUPER_ADMIN",
    staleTime: 10 * 60 * 1000,
  });
  const isFaculty = (facultyCheck?.meta?.total ?? 0) > 0;

  const { data: _annResult } = useQuery({
    queryKey: ["announcements"],
    queryFn: () => api.get<{ data: Announcement[] }>("/api/v1/announcements").then((r) => ({ data: r.data.data, stats: null })),
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 60 * 1000,
  });
  const announcements = _annResult?.data;

  const pendingLeaves = myLeaves?.filter((l: any) => l.status === "PENDING") ?? [];
  const draftClaims = myClaims?.filter((c: any) => c.status === "DRAFT") ?? [];
  const pendingClaims = myClaims?.filter((c: any) => c.status === "SUBMITTED") ?? [];
  const ongoingTraining = enrollments?.filter((e: any) => e.status !== "COMPLETED" && e.status !== "CANCELLED") ?? [];
  const unacknowledgedPolicies = policies?.filter((p: any) => p.requiresAck) ?? [];

  const totalLeaveAvailable = leaveBalances
    ?.reduce((sum: number, lb: any) => sum + (lb.balance ?? Math.max(0, (lb.allocated - lb.used - lb.pending))), 0) ?? 0;

  const profileMissing: string[] = (profile as any)?.profileMissing ?? [];
  const profileScore: number = (profile as any)?.profileScore ?? 0;
  const profileTotal: number = (profile as any)?.profileTotal ?? 7;
  const profileComplete: boolean = (profile as any)?.profileComplete ?? false;

  if (user?.role === "SUPER_ADMIN") return <SuperAdminDashboard />;

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-white text-xl font-bold">
            {user ? getInitials(user.firstName, user.lastName) : "?"}
          </div>
          <div>
            <h1 className="text-xl font-bold">Good {getGreeting()}, {user?.firstName}!</h1>
            <p className="text-blue-100 text-sm mt-0.5">
              {profile?.designation?.title ?? ""}{profile?.department ? ` · ${profile.department.name}` : ""}
            </p>
            <p className="text-blue-200 text-xs mt-1 font-mono">{user?.employeeCode}</p>
          </div>
          <div className="ml-auto hidden sm:flex flex-col items-end gap-2 text-right">
            <Link
              href={user ? `/dashboard/employees/${user.id}?edit=true` : "#"}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/20 hover:bg-white/30 px-3 py-1.5 text-xs font-medium text-white transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit Profile
            </Link>
            <div>
              <p className="text-blue-100 text-xs">Joined</p>
              <p className="text-white text-sm font-medium">{profile?.joiningDate ? formatDate(profile.joiningDate) : "—"}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Profile completeness nudge */}
      {profile && !profileComplete && (
        <Link
          href={user ? `/dashboard/employees/${user.id}?edit=true` : "#"}
          className="flex items-start gap-4 rounded-xl border border-orange-200 bg-orange-50 px-5 py-4 hover:bg-orange-100 transition-colors"
        >
          <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-orange-800">
              Your profile is {Math.round((profileScore / profileTotal) * 100)}% complete
            </p>
            <p className="text-xs text-orange-600 mt-0.5">
              Still needed: {profileMissing.join(", ")}
            </p>
            <div className="mt-2 h-1.5 rounded-full bg-orange-200 overflow-hidden">
              <div
                className="h-full rounded-full bg-orange-500 transition-all"
                style={{ width: `${Math.round((profileScore / profileTotal) * 100)}%` }}
              />
            </div>
          </div>
          <span className="text-xs font-semibold text-orange-700 whitespace-nowrap">Update now →</span>
        </Link>
      )}

      {/* Notice Board */}
      {announcements && announcements.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-blue-600" /> Notice Board
            </h2>
            <Link href="/dashboard/announcements" className="text-xs text-blue-600 hover:underline">View all →</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {announcements.slice(0, 3).map((a) => {
              const meta = ANN_META[a.type];
              const Icon = meta.icon;
              return (
                <div key={a.id} className={`flex items-start gap-3 px-4 py-3.5 border-l-4 ${meta.border} ${meta.bg}`}>
                  {a.pinned && <Pin className="h-3.5 w-3.5 text-blue-400 shrink-0 mt-0.5" />}
                  <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${meta.iconColor}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">{a.title}</p>
                      {a.type !== "GENERAL" && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${meta.badge}`}>{a.type}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{a.body}</p>
                    <p className="text-[11px] text-gray-400 mt-1">
                      {a.postedBy.firstName} {a.postedBy.lastName} · {formatDate(a.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          {announcements.length > 3 && (
            <Link
              href="/dashboard/announcements"
              className="flex items-center justify-center px-4 py-2.5 text-xs text-blue-600 hover:bg-blue-50 transition-colors border-t border-gray-100"
            >
              +{announcements.length - 3} more notices →
            </Link>
          )}
        </div>
      )}

      {/* Quick stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Leave Available"
          value={totalLeaveAvailable}
          sub="days across all types"
          icon={CalendarOff}
          color="bg-blue-50 text-blue-600"
        />
        <StatCard
          label="Pending Leaves"
          value={pendingLeaves.length}
          sub="awaiting approval"
          icon={Clock}
          color="bg-orange-50 text-orange-600"
        />
        <StatCard
          label="Claims"
          value={draftClaims.length + pendingClaims.length}
          sub={`${draftClaims.length} draft · ${pendingClaims.length} submitted`}
          icon={Receipt}
          color="bg-green-50 text-green-600"
        />
        <StatCard
          label="Training"
          value={ongoingTraining.length}
          sub="in progress"
          icon={GraduationCap}
          color="bg-purple-50 text-purple-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Schedule (faculty) or Leave Balance (non-faculty) */}
        {facultyCheckLoading ? (
          <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white p-5 space-y-3">
            <div className="h-4 bg-gray-100 rounded w-1/3 animate-pulse" />
            {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />)}
          </div>
        ) : isFaculty ? (
          <FacultyScheduleWidget employeeId={user!.id} />
        ) : (
          /* Leave Balances */
          <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <CalendarOff className="h-4 w-4 text-blue-600" /> Leave Balance Summary
                </h2>
                {leaveBalances?.length > 0 && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    FY {new Date().getMonth() >= 3 ? new Date().getFullYear() : new Date().getFullYear() - 1}–{new Date().getMonth() >= 3 ? new Date().getFullYear() + 1 : new Date().getFullYear()} · accrued monthly
                  </p>
                )}
              </div>
              <Link href="/dashboard/leaves" className="text-xs text-blue-600 hover:underline">Apply Leave →</Link>
            </div>
            {!leaveBalances?.length ? (
              <p className="px-5 py-8 text-sm text-gray-400 text-center">No leave policy assigned yet.</p>
            ) : (
              <div className="p-4 grid grid-cols-2 gap-3">
                {leaveBalances.map((lb: any) => {
                  const LEAVE_COLORS: Record<string, { bg: string; accent: string }> = {
                    CASUAL:       { bg: "bg-blue-50",   accent: "text-blue-600" },
                    SICK:         { bg: "bg-red-50",    accent: "text-red-600" },
                    EARNED:       { bg: "bg-green-50",  accent: "text-green-600" },
                    MATERNITY:    { bg: "bg-pink-50",   accent: "text-pink-600" },
                    PATERNITY:    { bg: "bg-indigo-50", accent: "text-indigo-600" },
                    COMPENSATORY: { bg: "bg-orange-50", accent: "text-orange-600" },
                    UNPAID:       { bg: "bg-gray-50",   accent: "text-gray-600" },
                    SPECIAL:      { bg: "bg-purple-50", accent: "text-purple-600" },
                  };
                  const colors = LEAVE_COLORS[lb.leaveType] ?? { bg: "bg-gray-50", accent: "text-gray-600" };
                  const pct = lb.accrued > 0 ? Math.min(100, (lb.availed / lb.accrued) * 100) : 0;
                  return (
                    <div key={lb.id} className={`rounded-xl p-3 ${colors.bg}`}>
                      <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${colors.accent}`}>
                        {lb.leaveType.replace(/_/g, " ")}
                      </p>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Accrued</span>
                          <span className="font-semibold text-gray-800">{lb.accrued}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Availed</span>
                          <span className="font-semibold text-gray-800">{lb.availed}</span>
                        </div>
                        <div className="flex justify-between text-xs border-t border-black/5 pt-1">
                          <span className="text-gray-500">Balance</span>
                          <span className={`font-bold ${lb.balance <= 0 ? "text-red-600" : colors.accent}`}>
                            {lb.balance}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2 h-1.5 rounded-full bg-black/10 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${pct >= 100 ? "bg-red-500" : "bg-current opacity-60"} ${colors.accent}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="mt-1 text-right text-[10px] text-gray-400">{lb.used} used · {lb.pending} pending</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Quick Actions */}
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Quick Actions</h2>
          </div>
          <div className="p-3 space-y-2">
            {[
              { label: "Apply for Leave", href: "/dashboard/leaves", icon: CalendarOff, color: "text-blue-600 bg-blue-50" },
              { label: "Submit a Claim", href: "/dashboard/claims", icon: Receipt, color: "text-green-600 bg-green-50" },
              { label: "View Training", href: "/dashboard/training", icon: GraduationCap, color: "text-purple-600 bg-purple-50" },
              { label: "Read Policies", href: "/dashboard/policies", icon: Shield, color: "text-orange-600 bg-orange-50" },
              { label: "My Profile", href: user ? `/dashboard/employees/${user.id}` : "#", icon: User, color: "text-gray-600 bg-gray-50" },
            ].map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-gray-50 transition-colors group"
              >
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${action.color}`}>
                  <action.icon className="h-4 w-4" />
                </div>
                <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">{action.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent Leave Applications */}
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-500" /> Recent Leaves
            </h2>
            <Link href="/dashboard/leaves" className="text-xs text-blue-600 hover:underline">View all →</Link>
          </div>
          {!myLeaves?.length ? (
            <p className="px-5 py-8 text-sm text-gray-400 text-center">No leave applications.</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {myLeaves.slice(0, 4).map((leave: any) => (
                <div key={leave.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{leave.leaveType.replace("_", " ")}</p>
                    <p className="text-xs text-gray-400">{formatDate(leave.fromDate)} · {leave.totalDays} day(s)</p>
                  </div>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${
                    leave.status === "APPROVED" ? "bg-green-100 text-green-700" :
                    leave.status === "REJECTED" ? "bg-red-100 text-red-700" :
                    leave.status === "CANCELLED" ? "bg-gray-100 text-gray-500" :
                    leave.status === "CANCELLATION_PENDING" ? "bg-amber-100 text-amber-700" :
                    "bg-yellow-100 text-yellow-700"}`}>
                    {leave.status === "CANCELLATION_PENDING" ? "CANCELLATION PENDING" : leave.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Claims */}
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Receipt className="h-4 w-4 text-green-600" /> Recent Claims
            </h2>
            <Link href="/dashboard/claims" className="text-xs text-blue-600 hover:underline">View all →</Link>
          </div>
          {!myClaims?.length ? (
            <p className="px-5 py-8 text-sm text-gray-400 text-center">No claims submitted.</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {myClaims.slice(0, 4).map((claim: any) => (
                <div key={claim.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{claim.title}</p>
                    <p className="text-xs text-gray-400">{claim.claimType} · {formatCurrency(claim.claimedAmount)}</p>
                  </div>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${
                    claim.status === "APPROVED" || claim.status === "PAID" ? "bg-green-100 text-green-700" :
                    claim.status === "REJECTED" ? "bg-red-100 text-red-700" :
                    claim.status === "SUBMITTED" ? "bg-blue-100 text-blue-700" :
                    claim.status === "CANCELLATION_PENDING" ? "bg-amber-100 text-amber-700" :
                    "bg-gray-100 text-gray-700"}`}>
                    {claim.status === "CANCELLATION_PENDING" ? "CANCELLATION PENDING" : claim.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Training in progress */}
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-purple-600" /> My Training
            </h2>
            <Link href="/dashboard/training" className="text-xs text-blue-600 hover:underline">View all →</Link>
          </div>
          {!enrollments?.length ? (
            <p className="px-5 py-8 text-sm text-gray-400 text-center">No training enrollments.</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {enrollments.slice(0, 4).map((e: any) => (
                <div key={e.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{e.program.title}</p>
                    <p className="text-xs text-gray-400">{e.program.provider ?? "Internal"} · {e.program.mode}</p>
                  </div>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    e.status === "COMPLETED" ? "bg-green-100 text-green-700" :
                    e.status === "IN_PROGRESS" ? "bg-yellow-100 text-yellow-700" :
                    "bg-blue-100 text-blue-700"}`}>
                    {e.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Policies to acknowledge */}
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Shield className="h-4 w-4 text-orange-500" /> Policies
              {unacknowledgedPolicies.length > 0 && (
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-orange-100 text-orange-700 text-xs font-bold">
                  {unacknowledgedPolicies.length}
                </span>
              )}
            </h2>
            <Link href="/dashboard/policies" className="text-xs text-blue-600 hover:underline">View all →</Link>
          </div>
          {!policies?.length ? (
            <p className="px-5 py-8 text-sm text-gray-400 text-center">No policies published.</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {policies.slice(0, 4).map((p: any) => (
                <div key={p.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{p.title}</p>
                    <p className="text-xs text-gray-400">{p.category} · v{p.version}</p>
                  </div>
                  {p.requiresAck ? (
                    <AlertCircle className="h-4 w-4 text-orange-500 shrink-0" />
                  ) : (
                    <CheckCircle className="h-4 w-4 text-gray-300 shrink-0" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}
