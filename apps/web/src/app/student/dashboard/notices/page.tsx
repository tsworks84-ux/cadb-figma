"use client";

import { useMemo } from "react";
import { useStudentAuthStore } from "@/store/studentAuth";
import { useQuery } from "@tanstack/react-query";
import { studentApi } from "@/lib/studentApi";
import { Bell, Info, AlertTriangle, AlertCircle, Pin } from "lucide-react";
import { formatDate } from "@/lib/utils";

type AnnType = "GENERAL" | "IMPORTANT" | "URGENT";
const ANN_META: Record<AnnType, { border: string; bg: string; icon: React.ElementType; iconColor: string; badge: string; label: string }> = {
  GENERAL:   { border: "border-l-sky-400",   bg: "bg-sky-50/60",   icon: Info,          iconColor: "text-sky-500",   badge: "bg-sky-100   text-sky-700",   label: "General"   },
  IMPORTANT: { border: "border-l-amber-400", bg: "bg-amber-50/60", icon: AlertTriangle, iconColor: "text-amber-500", badge: "bg-amber-100 text-amber-700", label: "Important" },
  URGENT:    { border: "border-l-red-500",   bg: "bg-red-50/60",   icon: AlertCircle,  iconColor: "text-red-500",   badge: "bg-red-100   text-red-700",   label: "Urgent"    },
};

function dateGroupKey(dateStr: string) {
  const d         = new Date(dateStr);
  const today     = new Date();
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
  const sameDay   = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, today))     return "Today";
  if (sameDay(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
}

export default function StudentNoticesPage() {
  const { accessToken } = useStudentAuthStore();

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ["student-announcements-full"],
    queryFn:  () => studentApi.get("/api/v1/student/announcements").then((r) => r.data.data ?? []),
    enabled: !!accessToken, staleTime: 0, refetchOnWindowFocus: true, refetchInterval: 60_000,
  });

  const pinned = (announcements as any[]).filter((a: any) => a.pinned);
  const rest   = (announcements as any[]).filter((a: any) => !a.pinned);

  const sortedGroups = useMemo(() => {
    const map = new Map<string, { label: string; sortKey: string; items: any[] }>();
    for (const a of rest) {
      const label   = a.publishedAt ? dateGroupKey(a.publishedAt) : "Older";
      const sortKey = label === "Today" ? "9999-12-31" : label === "Yesterday" ? "9999-12-30" : a.publishedAt ?? "0000-00-00";
      if (!map.has(label)) map.set(label, { label, sortKey, items: [] });
      map.get(label)!.items.push(a);
    }
    return Array.from(map.values()).sort((a, b) => b.sortKey.localeCompare(a.sortKey));
  }, [rest]);

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5">

      {/* Heading */}
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-xl bg-amber-100 flex items-center justify-center">
          <Bell className="h-4 w-4 text-amber-600" />
        </div>
        <h1 className="text-lg font-bold text-gray-900">Notice Board</h1>
        {(announcements as any[]).length > 0 && (
          <span className="inline-flex h-6 items-center rounded-full bg-amber-100 text-amber-700 text-xs font-bold px-2">
            {(announcements as any[]).length}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="h-6 w-6 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (announcements as any[]).length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center py-20 text-center px-6">
          <Bell className="h-10 w-10 text-gray-200 mb-3" />
          <p className="text-sm font-semibold text-gray-400">No announcements</p>
          <p className="text-xs text-gray-300 mt-1">Notices from your institution will appear here.</p>
        </div>
      ) : (
        <div className="space-y-6">

          {/* Pinned */}
          {pinned.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-amber-500 uppercase tracking-widest mb-2 px-1 flex items-center gap-1.5">
                <Pin className="h-3 w-3" /> Pinned
              </p>
              <div className="space-y-3">
                {pinned.map((a: any) => <NoticeCard key={a.id} a={a} />)}
              </div>
            </div>
          )}

          {/* Date-grouped */}
          {sortedGroups.map(({ label, items }) => (
            <div key={label}>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">{label}</p>
              <div className="space-y-3">
                {items.map((a: any) => <NoticeCard key={a.id} a={a} />)}
              </div>
            </div>
          ))}

        </div>
      )}
    </div>
  );
}

function NoticeCard({ a }: { a: any }) {
  const meta = ANN_META[a.type as AnnType] ?? ANN_META.GENERAL;
  const Icon = meta.icon;
  return (
    <div className={`rounded-xl border-l-[3px] px-5 py-4 shadow-sm ${meta.border} ${meta.bg} bg-white`}>
      <div className="flex items-start gap-3">
        {a.pinned && <Pin className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />}
        <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${meta.iconColor}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-gray-900">{a.title}</p>
            <span className={`shrink-0 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${meta.badge}`}>
              {meta.label}
            </span>
          </div>
          <p className="text-sm text-gray-600 mt-1 leading-relaxed">{a.body}</p>
          <p className="text-xs text-gray-400 mt-2">
            {a.postedBy?.firstName} {a.postedBy?.lastName}
            {a.publishedAt ? ` · ${formatDate(a.publishedAt)}` : ""}
          </p>
        </div>
      </div>
    </div>
  );
}
