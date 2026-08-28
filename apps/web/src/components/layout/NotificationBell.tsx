"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  Bell, X, CalendarOff, Receipt, CalendarPlus, Megaphone, CheckCheck,
} from "lucide-react";

/**
 * The bell. Reads the in-app side of the notification outbox, so approvals
 * waiting on you and decisions taken on your own requests land in the same
 * place, whatever else the event was also emailed to.
 */

type Group = "Leaves" | "Comp-off" | "Claims" | "Announcements";

type Item = {
  id: string;
  event: string;
  group: Group;
  title: string;
  body: string;
  path: string;
  read: boolean;
  createdAt: string;
};

const GROUP_META: Record<Group, { icon: React.ElementType; tone: string }> = {
  Leaves:        { icon: CalendarOff,  tone: "bg-blue-50 text-blue-600" },
  "Comp-off":    { icon: CalendarPlus, tone: "bg-teal-50 text-teal-600" },
  Claims:        { icon: Receipt,      tone: "bg-violet-50 text-violet-600" },
  Announcements: { icon: Megaphone,    tone: "bg-amber-50 text-amber-600" },
};

/** "3m", "4h", "2d" — a feed wants elapsed time, not a formatted date. */
function ago(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

export function NotificationBell({ tone = "light" }: { tone?: "light" | "dark" }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.get("/api/v1/notifications").then((r) => r.data.data),
    // The feed is written by other people's actions, so nothing in this tab
    // invalidates it — it has to come back on a timer and on refocus.
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: true,
    staleTime: 30 * 1000,
  });

  const items: Item[] = data?.items ?? [];
  const unread: number = data?.unreadCount ?? 0;

  const refresh = () => qc.invalidateQueries({ queryKey: ["notifications"] });

  const readOne  = useMutation({ mutationFn: (id: string) => api.patch(`/api/v1/notifications/${id}/read`) });
  const readAll  = useMutation({ mutationFn: () => api.post("/api/v1/notifications/read-all"), onSuccess: refresh });
  const clearOne = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/notifications/${id}`),
    onSuccess: refresh,
    onError: () => toast.error("Could not clear that notification"),
  });
  const clearAll = useMutation({
    mutationFn: () => api.delete("/api/v1/notifications"),
    onSuccess: () => { refresh(); toast.success("Notifications cleared"); },
    onError: () => toast.error("Could not clear notifications"),
  });

  // Close on outside click and on Escape — the panel overlays the page content.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function openItem(item: Item) {
    setOpen(false);
    if (!item.read) readOne.mutate(item.id, { onSuccess: refresh });
    router.push(item.path);
  }

  const iconColor = tone === "dark" ? "text-white/80" : "text-gray-500";
  const hoverBg   = tone === "dark" ? "hover:bg-white/10" : "hover:bg-gray-50";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        className={`relative p-2 rounded-lg transition-colors ${hoverBg}`}
      >
        <Bell className={`h-5 w-5 ${iconColor}`} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[1.05rem] h-[1.05rem] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-[1.05rem] text-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Below sm the panel is a full-width sheet — a 22rem dropdown anchored
              to the right edge would run off a 360px screen. The 4.75rem top
              clears the tallest bar the bell sits in (the 72px Academics nav);
              from sm up it anchors to the button and the offset stops mattering. */}
          <div className="fixed inset-0 z-40 bg-black/20 sm:hidden" onClick={() => setOpen(false)} />
          <div
            className="fixed left-2 right-2 top-[4.75rem] z-50 rounded-xl border border-gray-200 bg-white shadow-xl overflow-hidden
                       sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-[22rem]"
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
              <span className="text-sm font-semibold text-gray-900">Notifications</span>
              {unread > 0 && (
                <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-[11px] font-semibold text-red-600">{unread} new</span>
              )}
              <div className="ml-auto flex items-center gap-1">
                {unread > 0 && (
                  <button
                    onClick={() => readAll.mutate()}
                    title="Mark all as read"
                    className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  >
                    <CheckCheck className="h-4 w-4" />
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {items.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <Bell className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">You&apos;re all caught up</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50 max-h-[60vh] sm:max-h-96 overflow-y-auto">
                {items.map((item) => {
                  const meta = GROUP_META[item.group] ?? GROUP_META.Leaves;
                  const Icon = meta.icon;
                  return (
                    <div
                      key={item.id}
                      className={`group flex items-start gap-3 px-3 py-3 transition-colors ${item.read ? "bg-white" : "bg-blue-50/40"} hover:bg-gray-50`}
                    >
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${meta.tone}`}>
                        <Icon className="h-4 w-4" />
                      </span>

                      <button onClick={() => openItem(item)} className="flex-1 min-w-0 text-left">
                        <p className={`text-sm truncate ${item.read ? "font-medium text-gray-700" : "font-semibold text-gray-900"}`}>
                          {item.title}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{item.body}</p>
                        <p className="text-[11px] text-gray-400 mt-1">{ago(item.createdAt)}</p>
                      </button>

                      <button
                        onClick={() => clearOne.mutate(item.id)}
                        aria-label="Clear this notification"
                        title="Clear"
                        // Always visible on touch, where there is no hover to reveal it.
                        className="shrink-0 p-1 rounded-md text-gray-300 hover:bg-gray-200 hover:text-gray-600 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex items-center justify-between border-t border-gray-100 px-3 py-2">
              <Link
                href="/dashboard/announcements"
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 transition-colors"
              >
                All announcements →
              </Link>
              {items.length > 0 && (
                <button
                  onClick={() => clearAll.mutate()}
                  disabled={clearAll.isPending}
                  className="rounded-lg px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 hover:text-red-600 disabled:opacity-50 transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
