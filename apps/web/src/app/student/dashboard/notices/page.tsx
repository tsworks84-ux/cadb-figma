"use client";

import { useStudentAuthStore } from "@/store/studentAuth";
import { useQuery } from "@tanstack/react-query";
import { studentApi } from "@/lib/studentApi";
import { Bell, Info, AlertTriangle, AlertCircle, Pin } from "lucide-react";
import { formatDate } from "@/lib/utils";

type AnnType = "GENERAL" | "IMPORTANT" | "URGENT";
const ANN_META: Record<AnnType, { border: string; bg: string; icon: React.ElementType; iconColor: string; badge: string; label: string }> = {
  GENERAL:   { border: "border-l-blue-400",   bg: "bg-blue-50",   icon: Info,         iconColor: "text-blue-500",   badge: "bg-blue-100 text-blue-700",   label: "General"   },
  IMPORTANT: { border: "border-l-orange-400", bg: "bg-orange-50", icon: AlertTriangle, iconColor: "text-orange-500", badge: "bg-orange-100 text-orange-700", label: "Important" },
  URGENT:    { border: "border-l-red-500",    bg: "bg-red-50",    icon: AlertCircle,  iconColor: "text-red-500",    badge: "bg-red-100 text-red-700",     label: "Urgent"    },
};

export default function StudentNoticesPage() {
  const { accessToken } = useStudentAuthStore();

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ["student-announcements-full"],
    queryFn: () => studentApi.get("/api/v1/student/announcements").then((r) => r.data.data ?? []),
    enabled: !!accessToken,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 60 * 1000,
  });

  const pinned = (announcements as any[]).filter((a: any) => a.pinned);
  const rest   = (announcements as any[]).filter((a: any) => !a.pinned);

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Bell className="h-5 w-5 text-amber-500" />
        <h1 className="text-lg font-bold text-gray-900">Notice Board</h1>
        {(announcements as any[]).length > 0 && (
          <span className="inline-flex h-6 items-center rounded-full bg-amber-100 text-amber-700 text-xs font-bold px-2">
            {(announcements as any[]).length}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="h-6 w-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (announcements as any[]).length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 flex flex-col items-center justify-center py-20 text-center px-6">
          <Bell className="h-10 w-10 text-gray-200 mb-3" />
          <p className="text-sm font-semibold text-gray-400">No announcements</p>
          <p className="text-xs text-gray-300 mt-1">Notices from your institution will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pinned.length > 0 && (
            <>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">
                Pinned
              </p>
              {pinned.map((a: any) => <NoticeCard key={a.id} a={a} />)}
              {rest.length > 0 && (
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 pt-2">
                  All Notices
                </p>
              )}
            </>
          )}
          {rest.map((a: any) => <NoticeCard key={a.id} a={a} />)}
        </div>
      )}
    </div>
  );
}

function NoticeCard({ a }: { a: any }) {
  const meta = ANN_META[a.type as AnnType] ?? ANN_META.GENERAL;
  const Icon = meta.icon;
  return (
    <div className={`rounded-xl border-l-4 px-5 py-4 ${meta.border} ${meta.bg}`}>
      <div className="flex items-start gap-3">
        {a.pinned && <Pin className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />}
        <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${meta.iconColor}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-gray-900">{a.title}</p>
            <span className={`shrink-0 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.badge}`}>
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
