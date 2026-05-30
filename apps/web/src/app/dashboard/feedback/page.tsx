"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  MessageSquare, Lightbulb, AlertCircle, Clock, CheckCircle2,
  X, Send, Paperclip, ChevronDown, User, Search,
  RotateCcw, XCircle, Loader2,
} from "lucide-react";

// ─── types ────────────────────────────────────────────────────────────────────

type FBType   = "SUGGESTION" | "CONCERN";
type FBStatus = "OPEN" | "RESPONDED" | "CLOSED" | "CLOSED_BY_STUDENT";

interface FBMessage {
  id:             string;
  senderType:     "STUDENT" | "ADMIN";
  senderName:     string;
  message:        string;
  attachmentUrl?: string;
  attachmentName?: string;
  createdAt:      string;
}

interface FBItem {
  id:        string;
  type:      FBType;
  message:   string;
  status:    FBStatus;
  createdAt: string;
  updatedAt: string;
  student:   {
    id: string; studentCode: string;
    firstName: string; lastName: string;
    photoUrl?: string; email?: string; phone?: string;
    studentBatches: { batch: { name: string; academicYear: string } }[];
  };
  messages:  FBMessage[];
  _count?:   { messages: number };
}

// ─── constants ────────────────────────────────────────────────────────────────

const TYPE_META: Record<FBType, { label: string; icon: React.ElementType; iconCls: string; badge: string; border: string }> = {
  SUGGESTION: { label: "Suggestion", icon: Lightbulb,    iconCls: "text-sky-500",   badge: "bg-sky-100 text-sky-700 border-sky-200",       border: "border-l-sky-400"   },
  CONCERN:    { label: "Concern",    icon: AlertCircle,  iconCls: "text-amber-500", badge: "bg-amber-100 text-amber-700 border-amber-200", border: "border-l-amber-400" },
};

const STATUS_META: Record<FBStatus, { label: string; icon: React.ElementType; badge: string }> = {
  OPEN:             { label: "Open",               icon: Clock,         badge: "bg-amber-50  text-amber-700  border-amber-200"  },
  RESPONDED:        { label: "Awaiting Student",   icon: Clock,         badge: "bg-sky-50    text-sky-700    border-sky-200"    },
  CLOSED:           { label: "Resolved",           icon: CheckCircle2,  badge: "bg-gray-100  text-gray-500   border-gray-200"   },
  CLOSED_BY_STUDENT:{ label: "Closed by Student",  icon: CheckCircle2,  badge: "bg-teal-50   text-teal-700   border-teal-200"   },
};

const STATUS_FILTERS = [
  { key: "",                label: "All"           },
  { key: "OPEN",            label: "Open"          },
  { key: "RESPONDED",       label: "Awaiting"      },
  { key: "CLOSED",          label: "Closed"        },
  { key: "CLOSED_BY_STUDENT", label: "Closed by Student" },
] as const;

function fmtDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const diff  = Math.floor((today.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
  if (diff === 1) return "Yesterday";
  if (diff < 7)  return `${diff}d ago`;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function fmtFull(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

// ─── slide-over panel ─────────────────────────────────────────────────────────

function FeedbackPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const qc        = useQueryClient();
  const fileRef   = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [reply, setReply]           = useState("");
  const [attachment, setAttachment] = useState<{ url: string; name: string } | null>(null);
  const [uploading, setUploading]   = useState(false);

  const { data: fb, isLoading } = useQuery<FBItem>({
    queryKey: ["admin-feedback-detail", id],
    queryFn:  () => api.get(`/api/v1/feedback/${id}`).then((r) => r.data.data),
    staleTime: 0, refetchOnWindowFocus: true,
  });

  // scroll to bottom on load / new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [fb?.messages.length]);

  const replyMut = useMutation({
    mutationFn: () => api.post(`/api/v1/feedback/${id}/reply`, {
      message: reply.trim(),
      attachmentUrl:  attachment?.url  ?? undefined,
      attachmentName: attachment?.name ?? undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-feedback-detail", id] });
      qc.invalidateQueries({ queryKey: ["admin-feedback-list"] });
      setReply("");
      setAttachment(null);
      toast.success("Reply sent.");
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed to send reply"),
  });

  const closeMut = useMutation({
    mutationFn: () => api.patch(`/api/v1/feedback/${id}/close`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-feedback-detail", id] });
      qc.invalidateQueries({ queryKey: ["admin-feedback-list"] });
      toast.success("Feedback closed.");
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed to close"),
  });

  const reopenMut = useMutation({
    mutationFn: () => api.patch(`/api/v1/feedback/${id}/reopen`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-feedback-detail", id] });
      qc.invalidateQueries({ queryKey: ["admin-feedback-list"] });
      toast.success("Feedback reopened.");
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed to reopen"),
  });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("File must be under 10 MB"); return; }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await api.post("/api/v1/feedback/upload", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setAttachment({ url: res.data.data.url, name: res.data.data.name });
      toast.success("Attachment ready.");
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const isClosed = fb?.status === "CLOSED" || fb?.status === "CLOSED_BY_STUDENT";
  const typeMeta   = fb ? TYPE_META[fb.type]     : null;
  const statusMeta = fb ? STATUS_META[fb.status] : null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 shrink-0">
          {typeMeta && (
            <div className={cn("h-8 w-8 rounded-xl flex items-center justify-center shrink-0",
              fb?.type === "SUGGESTION" ? "bg-sky-50" : "bg-amber-50")}>
              <typeMeta.icon className={cn("h-4 w-4", typeMeta.iconCls)} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate">
              {typeMeta?.label} — {fb?.student.firstName} {fb?.student.lastName}
            </p>
            {statusMeta && (
              <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border mt-0.5", statusMeta.badge)}>
                <statusMeta.icon className="h-2.5 w-2.5" />
                {statusMeta.label}
              </span>
            )}
          </div>
          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {!isClosed && (
              <button onClick={() => closeMut.mutate()}
                disabled={closeMut.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-100 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 transition-colors disabled:opacity-60">
                {closeMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
                Close
              </button>
            )}
            {isClosed && (
              <button onClick={() => reopenMut.mutate()}
                disabled={reopenMut.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg border border-sky-100 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-600 hover:bg-sky-100 transition-colors disabled:opacity-60">
                {reopenMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                Reopen
              </button>
            )}
            <button onClick={onClose}
              className="h-7 w-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-6 w-6 text-sky-400 animate-spin" />
          </div>
        ) : fb ? (
          <>
            {/* Student info banner */}
            <div className="px-5 py-3 border-b border-gray-50 bg-gray-50/60 shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-teal-100 flex items-center justify-center shrink-0">
                  <User className="h-4 w-4 text-teal-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800">
                    {fb.student.firstName} {fb.student.lastName}
                    <span className="ml-2 text-[11px] font-normal text-gray-400 font-mono">{fb.student.studentCode}</span>
                  </p>
                  <p className="text-xs text-gray-400">
                    {fb.student.studentBatches[0]?.batch.academicYear} · {fb.student.studentBatches[0]?.batch.name}
                    {fb.student.email && ` · ${fb.student.email}`}
                  </p>
                </div>
                <p className="text-[10px] text-gray-400 shrink-0">{fmtFull(fb.createdAt)}</p>
              </div>
            </div>

            {/* Thread */}
            <div className="flex-1 overflow-y-auto">

              {/* Original report */}
              <div className="px-5 py-4 border-b border-gray-50">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Original Report</p>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{fb.message}</p>
              </div>

              {/* Activity log */}
              {fb.messages.length > 0 && (
                <div className="px-5 py-4 space-y-2 border-b border-gray-50">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Activity</p>
                  {fb.messages.map((msg) => {
                    const isAdmin = msg.senderType === "ADMIN";
                    return (
                      <div key={msg.id} className={cn(
                        "rounded-lg border px-3.5 py-3",
                        isAdmin ? "bg-teal-50/70 border-teal-100" : "bg-gray-50 border-gray-100",
                      )}>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className={cn(
                            "inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full",
                            isAdmin ? "bg-teal-100 text-teal-700" : "bg-gray-200 text-gray-600",
                          )}>
                            {isAdmin ? `Your Response` : `Student Comment`}
                          </span>
                          <span className="text-[10px] text-gray-400 shrink-0">{msg.senderName} · {fmtDate(msg.createdAt)}</span>
                        </div>
                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                        {msg.attachmentUrl && (
                          <a href={msg.attachmentUrl} target="_blank" rel="noopener noreferrer"
                            className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-white border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                            <Paperclip className="h-3 w-3" />
                            {msg.attachmentName ?? "Attachment"}
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Resolution banner */}
              {isClosed && (
                <div className="px-5 py-4">
                  <div className="flex items-center gap-2.5 rounded-lg bg-gray-50 border border-gray-100 px-4 py-3">
                    <CheckCircle2 className="h-4 w-4 text-gray-400 shrink-0" />
                    <p className="text-xs text-gray-500">
                      {fb.status === "CLOSED" ? "Ticket resolved by admin." : "Ticket closed by student."}
                    </p>
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Response box — only when not closed */}
            {!isClosed && (
              <div className="border-t border-gray-100 px-5 py-4 shrink-0 space-y-3">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Post a Response</p>

                {/* Attachment preview */}
                {attachment && (
                  <div className="flex items-center gap-2 rounded-lg bg-teal-50 border border-teal-100 px-3 py-2">
                    <Paperclip className="h-3.5 w-3.5 text-teal-600 shrink-0" />
                    <span className="flex-1 text-xs text-teal-700 font-medium truncate">{attachment.name}</span>
                    <button onClick={() => setAttachment(null)} className="text-teal-400 hover:text-teal-600 transition-colors">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                <div className={cn(
                  "rounded-lg border-2 transition-colors",
                  reply.length > 0 ? "border-teal-400" : "border-gray-200",
                )}>
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && reply.trim()) {
                        e.preventDefault();
                        replyMut.mutate();
                      }
                    }}
                    placeholder="Write a response…"
                    rows={3}
                    className="w-full rounded-lg px-4 py-3 text-sm text-gray-800 placeholder-gray-400 resize-none focus:outline-none bg-transparent"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => replyMut.mutate()}
                    disabled={replyMut.isPending || !reply.trim()}
                    className="inline-flex items-center gap-2 rounded-lg bg-teal-600 hover:bg-teal-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 transition-colors">
                    {replyMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Post Response
                  </button>
                  <button onClick={() => fileRef.current?.click()} disabled={uploading}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 transition-colors" title="Attach file">
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                    <span className="text-xs">Attach</span>
                  </button>
                  <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileChange} />
                  <p className="ml-auto text-[10px] text-gray-400">⌘+Enter to send</p>
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>
    </>
  );
}

// ─── list row ─────────────────────────────────────────────────────────────────

function FeedbackRow({ item, onClick }: { item: FBItem; onClick: () => void }) {
  const typeMeta   = TYPE_META[item.type];
  const statusMeta = STATUS_META[item.status];
  const TypeIcon   = typeMeta.icon;
  const StatusIcon = statusMeta.icon;
  const lastMsg    = item.messages[0];

  return (
    <button onClick={onClick}
      className={cn(
        "w-full text-left rounded-xl border border-l-[3px] bg-white shadow-sm hover:shadow-md transition-all duration-150 overflow-hidden",
        typeMeta.border,
      )}>
      <div className="px-4 py-3.5 flex items-start gap-3">
        {/* type icon */}
        <div className={cn("h-8 w-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5",
          item.type === "SUGGESTION" ? "bg-sky-50" : "bg-amber-50")}>
          <TypeIcon className={cn("h-4 w-4", typeMeta.iconCls)} />
        </div>

        {/* main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-sm font-semibold text-gray-900">
              {item.student.firstName} {item.student.lastName}
            </span>
            <span className="text-[10px] font-mono text-gray-400">{item.student.studentCode}</span>
            <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border", typeMeta.badge)}>
              {typeMeta.label}
            </span>
            <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border", statusMeta.badge)}>
              <StatusIcon className="h-2.5 w-2.5" />
              {statusMeta.label}
            </span>
          </div>
          <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed">
            {lastMsg
              ? `${lastMsg.senderType === "ADMIN" ? "Admin" : lastMsg.senderName}: ${lastMsg.message}`
              : item.message}
          </p>
          {item.student.studentBatches[0] && (
            <p className="text-[11px] text-gray-400 mt-1">
              {item.student.studentBatches[0].batch.academicYear} · {item.student.studentBatches[0].batch.name}
            </p>
          )}
        </div>

        {/* date + reply count */}
        <div className="shrink-0 text-right space-y-1">
          <p className="text-[11px] text-gray-400">{fmtDate(item.updatedAt)}</p>
          {(item._count?.messages ?? 0) > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 text-gray-500 text-[10px] font-semibold px-2 py-0.5">
              {item._count!.messages} reply{item._count!.messages !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function AdminFeedbackPage() {
  const [activeFilter, setActiveFilter] = useState<string>("");
  const [search,       setSearch]       = useState("");
  const [selectedId,   setSelectedId]   = useState<string | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading } = useQuery<{
    data: FBItem[]; total: number;
    summary: Partial<Record<FBStatus, number>>;
  }>({
    queryKey: ["admin-feedback-list", activeFilter, debouncedSearch],
    queryFn: () =>
      api.get("/api/v1/feedback", {
        params: {
          status: activeFilter || undefined,
          search: debouncedSearch || undefined,
        },
      }).then((r) => r.data),
    staleTime: 0, refetchOnWindowFocus: true,
  });

  const feedback = data?.data ?? [];
  const summary  = data?.summary ?? {};
  const total    = data?.total   ?? 0;

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5">

      {/* Page header */}
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-xl bg-sky-100 flex items-center justify-center">
          <MessageSquare className="h-4 w-4 text-sky-600" />
        </div>
        <h1 className="text-lg font-bold text-gray-900">Student Feedback</h1>
        {total > 0 && (
          <span className="inline-flex h-5 items-center rounded-full bg-sky-100 text-sky-700 text-[10px] font-bold px-2">
            {total}
          </span>
        )}
      </div>

      {/* Summary chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {([
          { key: "OPEN",             label: "Open",             cls: "bg-amber-50  border-amber-100  text-amber-700"  },
          { key: "RESPONDED",        label: "Awaiting Student", cls: "bg-sky-50    border-sky-100    text-sky-700"    },
          { key: "CLOSED",           label: "Resolved",         cls: "bg-gray-50   border-gray-200   text-gray-500"   },
          { key: "CLOSED_BY_STUDENT",label: "Closed by Student",cls: "bg-teal-50   border-teal-100   text-teal-700"   },
        ] as const).map(({ key, label, cls }) => (
          <div key={key} className={cn("rounded-xl border px-4 py-3 shadow-sm", cls)}>
            <p className="text-[11px] font-semibold uppercase opacity-60">{label}</p>
            <p className="text-xl font-bold mt-0.5">{summary[key] ?? 0}</p>
          </div>
        ))}
      </div>

      {/* Search + filter row */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by student name, code, or message…"
            className="w-full rounded-xl border border-gray-200 pl-9 pr-4 py-2.5 text-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-50 transition"
          />
        </div>
        {/* Status filter tabs */}
        <div className="flex items-center gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm overflow-x-auto">
          {STATUS_FILTERS.map(({ key, label }) => (
            <button key={key} onClick={() => setActiveFilter(key)}
              className={cn(
                "shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                activeFilter === key
                  ? "bg-sky-600 text-white shadow-sm"
                  : "text-gray-500 hover:bg-gray-100",
              )}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-6 w-6 text-sky-400 animate-spin" />
        </div>
      ) : feedback.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center py-20 text-center px-6">
          <MessageSquare className="h-10 w-10 text-gray-200 mb-3" />
          <p className="text-sm font-semibold text-gray-400">No feedback found</p>
          <p className="text-xs text-gray-300 mt-1">Student submissions will appear here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {feedback.map((item) => (
            <FeedbackRow key={item.id} item={item} onClick={() => setSelectedId(item.id)} />
          ))}
          {total > feedback.length && (
            <p className="text-xs text-center text-gray-400 py-2">
              Showing {feedback.length} of {total} items
            </p>
          )}
        </div>
      )}

      {/* Detail panel */}
      {selectedId && (
        <FeedbackPanel id={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}
