"use client";

import { useState, useRef, useEffect } from "react";
import { useStudentAuthStore } from "@/store/studentAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { studentApi } from "@/lib/studentApi";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  MessageSquare, Plus, Lightbulb, AlertCircle, Trash2,
  CheckCircle2, Clock, X, Send, User, Paperclip,
  RotateCcw, XCircle, ChevronDown, ChevronUp,
} from "lucide-react";

// ─── types ────────────────────────────────────────────────────────────────────

type FeedbackType   = "SUGGESTION" | "CONCERN";
type FeedbackStatus = "OPEN" | "RESPONDED" | "CLOSED" | "CLOSED_BY_STUDENT";

interface FBMessage {
  id:             string;
  senderType:     "STUDENT" | "ADMIN";
  senderName:     string;
  message:        string;
  attachmentUrl?:  string;
  attachmentName?: string;
  createdAt:      string;
}

interface FeedbackItem {
  id:        string;
  type:      FeedbackType;
  message:   string;
  status:    FeedbackStatus;
  createdAt: string;
  updatedAt: string;
  messages:  FBMessage[];
}

// ─── constants ────────────────────────────────────────────────────────────────

const TYPE_META: Record<FeedbackType, {
  label:      string;
  icon:       React.ElementType;
  iconColor:  string;
  badge:      string;
  border:     string;
  bg:         string;
  pillActive: string;
  pill:       string;
  placeholder:string;
}> = {
  SUGGESTION: {
    label:      "Suggestion",
    icon:       Lightbulb,
    iconColor:  "text-sky-500",
    badge:      "bg-sky-100 text-sky-700 border-sky-200",
    border:     "border-l-sky-400",
    bg:         "bg-sky-50/40",
    pill:       "text-sky-600 hover:bg-sky-50 border border-sky-200",
    pillActive: "bg-sky-600 text-white border-sky-600 shadow-sm",
    placeholder:"Share an idea, improvement, or positive suggestion…",
  },
  CONCERN: {
    label:      "Concern",
    icon:       AlertCircle,
    iconColor:  "text-amber-500",
    badge:      "bg-amber-100 text-amber-700 border-amber-200",
    border:     "border-l-amber-400",
    bg:         "bg-amber-50/40",
    pill:       "text-amber-600 hover:bg-amber-50 border border-amber-200",
    pillActive: "bg-amber-500 text-white border-amber-500 shadow-sm",
    placeholder:"Describe an issue, problem, or concern you'd like to raise…",
  },
};

const STATUS_META: Record<FeedbackStatus, {
  label:    string;
  icon:     React.ElementType;
  cls:      string;
  helpText: string;
}> = {
  OPEN:             { label: "Open",            icon: Clock,        cls: "bg-amber-50 text-amber-700 border border-amber-200",  helpText: "Your ticket is open and under review."              },
  RESPONDED:        { label: "Admin Replied",   icon: CheckCircle2, cls: "bg-teal-50  text-teal-700  border border-teal-200",  helpText: "Admin has responded. Add a comment or close the ticket." },
  CLOSED:           { label: "Resolved",        icon: CheckCircle2, cls: "bg-gray-100 text-gray-500  border border-gray-200",  helpText: "This ticket has been resolved by the administration." },
  CLOSED_BY_STUDENT:{ label: "Closed",          icon: CheckCircle2, cls: "bg-gray-100 text-gray-500  border border-gray-200",  helpText: "You closed this ticket."                            },
};

const MAX_CHARS = 1000;

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

// ─── new feedback modal ───────────────────────────────────────────────────────

function FeedbackModal({ onClose }: { onClose: () => void }) {
  const qc                    = useQueryClient();
  const [type, setType]       = useState<FeedbackType>("SUGGESTION");
  const [message, setMessage] = useState("");
  const textareaRef           = useRef<HTMLTextAreaElement>(null);
  const meta                  = TYPE_META[type];
  const charsLeft             = MAX_CHARS - message.length;

  useEffect(() => { setTimeout(() => textareaRef.current?.focus(), 80); }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const mutation = useMutation({
    mutationFn: () => studentApi.post("/api/v1/student/portal/feedback", { type, message: message.trim() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["student-feedback"] }); toast.success("Feedback submitted."); onClose(); },
    onError:   (e: any) => toast.error(e.response?.data?.error ?? "Failed to submit"),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl ring-1 ring-black/5 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-sky-50 flex items-center justify-center">
              <MessageSquare className="h-4 w-4 text-sky-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Submit a Ticket</p>
              <p className="text-xs text-gray-400 mt-0.5">Your submission goes directly to admin</p>
            </div>
          </div>
          <button onClick={onClose} className="h-7 w-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); if (message.trim()) mutation.mutate(); }} className="px-5 py-5 space-y-5">
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2">Feedback Type</p>
            <div className="flex gap-2">
              {(["SUGGESTION", "CONCERN"] as FeedbackType[]).map((t) => {
                const m = TYPE_META[t];
                return (
                  <button key={t} type="button" onClick={() => setType(t)}
                    className={cn("flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all", type === t ? m.pillActive : m.pill)}>
                    <m.icon className="h-3.5 w-3.5" />
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2">Your Message</p>
            <div className={cn("rounded-xl border-2 transition-colors",
              message.length > 0 ? (type === "SUGGESTION" ? "border-sky-300" : "border-amber-300") : "border-gray-200")}>
              <textarea ref={textareaRef} value={message} rows={5}
                onChange={(e) => { if (e.target.value.length <= MAX_CHARS) setMessage(e.target.value); }}
                placeholder={meta.placeholder}
                className="w-full rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 resize-none focus:outline-none bg-transparent" />
              <div className={cn("flex justify-end px-3 pb-2.5 text-[11px] font-medium", charsLeft < 100 ? "text-amber-500" : "text-gray-300")}>
                {charsLeft} chars left
              </div>
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={mutation.isPending || !message.trim()}
              className={cn("flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white transition-all disabled:opacity-50",
                type === "SUGGESTION" ? "bg-sky-600 hover:bg-sky-700" : "bg-amber-500 hover:bg-amber-600")}>
              {mutation.isPending ? <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              {mutation.isPending ? "Submitting…" : "Submit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── retract confirm ──────────────────────────────────────────────────────────

function RetractConfirm({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: () => studentApi.delete(`/api/v1/student/portal/feedback/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["student-feedback"] }); toast.success("Feedback retracted."); onClose(); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-9 w-9 rounded-full bg-red-50 flex items-center justify-center shrink-0">
            <Trash2 className="h-4 w-4 text-red-500" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">Retract Feedback</p>
            <p className="text-xs text-gray-400 mt-0.5">This permanently removes your submission.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-500 hover:bg-gray-50">Keep It</button>
          <button onClick={() => mut.mutate()} disabled={mut.isPending}
            className="flex-1 rounded-xl bg-red-500 hover:bg-red-600 text-white py-2.5 text-sm font-bold disabled:opacity-60">
            {mut.isPending ? "…" : "Yes, Retract"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── feedback card with thread ────────────────────────────────────────────────

function FeedbackCard({ item }: { item: FeedbackItem }) {
  const qc                      = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [reply, setReply]       = useState("");
  const [confirmId, setConfirm] = useState<string | null>(null);
  const typeMeta   = TYPE_META[item.type];
  const statusMeta = STATUS_META[item.status];
  const TypeIcon   = typeMeta.icon;
  const StatusIcon = statusMeta.icon;
  const isAdminClosed   = item.status === "CLOSED";
  const isStudentClosed = item.status === "CLOSED_BY_STUDENT";
  const isClosed        = isAdminClosed || isStudentClosed;

  // Auto-expand if there are unread admin messages
  useEffect(() => {
    if (item.messages.some((m) => m.senderType === "ADMIN") || item.status === "RESPONDED") {
      setExpanded(true);
    }
  }, []);

  const replyMut = useMutation({
    mutationFn: () => studentApi.post(`/api/v1/student/portal/feedback/${item.id}/reply`, { message: reply.trim() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["student-feedback"] }); toast.success("Reply sent."); setReply(""); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed to send reply"),
  });

  const closeMut = useMutation({
    mutationFn: () => studentApi.patch(`/api/v1/student/portal/feedback/${item.id}/close`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["student-feedback"] }); toast.success("Feedback closed."); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });

  return (
    <>
      <div className={cn("bg-white rounded-2xl border border-gray-100 border-l-[3px] shadow-sm overflow-hidden", typeMeta.border)}>
        {/* Card header */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className={cn("w-full flex items-center gap-2 px-4 py-3 border-b border-gray-50 text-left", typeMeta.bg)}>
          <TypeIcon className={cn("h-3.5 w-3.5 shrink-0", typeMeta.iconColor)} />
          <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold border", typeMeta.badge)}>
            {typeMeta.label}
          </span>
          <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold", statusMeta.cls)}>
            <StatusIcon className="h-2.5 w-2.5" />
            {statusMeta.label}
          </span>
          {item.status === "RESPONDED" && (
            <span className="ml-1 inline-flex h-2 w-2 rounded-full bg-teal-500 animate-pulse" title="New response" />
          )}
          <span className="ml-auto text-[10px] text-gray-400">{fmtDate(item.createdAt)}</span>
          {/* Retract (only OPEN/RESPONDED) */}
          {!isClosed && (
            <button type="button"
              onClick={(e) => { e.stopPropagation(); setConfirm(item.id); }}
              className="ml-1 h-6 w-6 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors" title="Retract">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          {expanded ? <ChevronUp className="h-3.5 w-3.5 text-gray-400 shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-gray-400 shrink-0" />}
        </button>

        {/* Original message */}
        <div className="px-4 py-3 border-b border-gray-50">
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{item.message}</p>
        </div>

        {/* Expanded thread */}
        {expanded && (
          <div className="divide-y divide-gray-50">

            {/* Activity log */}
            {item.messages.length > 0 && (
              <div className="px-4 py-3 space-y-2">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Activity</p>
                {item.messages.map((msg) => {
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
                          {isAdmin ? "Admin Response" : "Your Comment"}
                        </span>
                        <span className="text-[10px] text-gray-400 shrink-0">{fmtTime(msg.createdAt)}</span>
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
              <div className="px-4 py-3">
                <div className="flex items-center gap-2.5 rounded-lg bg-gray-50 border border-gray-100 px-4 py-3">
                  <CheckCircle2 className="h-4 w-4 text-gray-400 shrink-0" />
                  <p className="text-xs text-gray-500">{statusMeta.helpText}</p>
                </div>
              </div>
            )}

            {/* Comment box — hidden when admin has closed */}
            {!isAdminClosed && (
              <div className="px-4 py-4 space-y-3">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  {isStudentClosed ? "Reopen with Comment" : "Add a Comment"}
                </p>
                <div className={cn(
                  "rounded-lg border-2 transition-colors",
                  reply.length > 0 ? "border-sky-300" : "border-gray-200",
                )}>
                  <textarea
                    value={reply}
                    onChange={(e) => { if (e.target.value.length <= MAX_CHARS) setReply(e.target.value); }}
                    placeholder={isStudentClosed ? "Add a comment to reopen this ticket…" : "Add a comment…"}
                    rows={3}
                    className="w-full rounded-lg px-4 py-3 text-sm text-gray-800 placeholder-gray-400 resize-none focus:outline-none bg-transparent"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => { if (reply.trim()) replyMut.mutate(); }}
                    disabled={replyMut.isPending || !reply.trim()}
                    className="inline-flex items-center gap-2 rounded-lg bg-sky-600 hover:bg-sky-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 transition-colors">
                    {replyMut.isPending ? <span className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    {isStudentClosed ? "Submit & Reopen" : "Submit Comment"}
                  </button>
                  {!isClosed && (
                    <button onClick={() => closeMut.mutate()} disabled={closeMut.isPending}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-50 disabled:opacity-50 transition-colors">
                      {closeMut.isPending ? <span className="h-3.5 w-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                      Close Ticket
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {confirmId && <RetractConfirm id={confirmId} onClose={() => setConfirm(null)} />}
    </>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function StudentFeedbackPage() {
  const { accessToken } = useStudentAuthStore();
  const [modalOpen, setModalOpen] = useState(false);

  const { data: feedback = [], isLoading } = useQuery<FeedbackItem[]>({
    queryKey: ["student-feedback"],
    queryFn: () => studentApi.get("/api/v1/student/portal/feedback").then((r) => r.data.data ?? []),
    enabled: !!accessToken, staleTime: 0, refetchOnWindowFocus: true, refetchInterval: 30_000,
  });

  const open   = feedback.filter((f) => f.status === "OPEN" || f.status === "RESPONDED");
  const closed = feedback.filter((f) => f.status === "CLOSED" || f.status === "CLOSED_BY_STUDENT");
  const hasNew = feedback.some((f) => f.status === "RESPONDED");

  return (
    <>
      <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-5">

        {/* Page header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-sky-100 flex items-center justify-center">
              <MessageSquare className="h-4 w-4 text-sky-600" />
            </div>
            <h1 className="text-lg font-bold text-gray-900">Feedback</h1>
            {hasNew && (
              <span className="inline-flex h-5 items-center rounded-full bg-teal-100 text-teal-700 text-[10px] font-bold px-2 animate-pulse">
                New response
              </span>
            )}
          </div>
          <button onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Ticket</span>
            <span className="sm:hidden">New</span>
          </button>
        </div>

        {/* Info banner */}
        <div className="rounded-xl bg-sky-50 border border-sky-100 px-4 py-3 flex gap-3 items-start">
          <Lightbulb className="h-4 w-4 text-sky-500 mt-0.5 shrink-0" />
          <p className="text-xs text-sky-700 leading-relaxed">
            Submit a <span className="font-semibold">suggestion</span> or raise a{" "}
            <span className="font-semibold">concern</span>. The administration will review and respond to your ticket.
            You can add comments until the ticket is resolved.
          </p>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center h-40">
            <div className="h-6 w-6 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!isLoading && feedback.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="h-14 w-14 rounded-2xl bg-sky-50 flex items-center justify-center mb-4">
              <MessageSquare className="h-7 w-7 text-sky-300" />
            </div>
            <p className="text-sm font-semibold text-gray-400">No tickets yet</p>
            <p className="text-xs text-gray-300 mt-1 max-w-xs">
              Click &ldquo;New Ticket&rdquo; to submit a suggestion or raise a concern.
            </p>
            <button onClick={() => setModalOpen(true)}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors">
              <Plus className="h-4 w-4" />
              New Ticket
            </button>
          </div>
        )}

        {/* Open tickets */}
        {!isLoading && open.length > 0 && (
          <div className="space-y-3">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest px-1 flex items-center gap-1.5">
              <Clock className="h-3 w-3 text-amber-400" />
              Open Tickets ({open.length})
            </p>
            {open.map((item) => <FeedbackCard key={item.id} item={item} />)}
          </div>
        )}

        {/* Resolved tickets */}
        {!isLoading && closed.length > 0 && (
          <div className="space-y-3">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest px-1 flex items-center gap-1.5">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              Resolved ({closed.length})
            </p>
            {closed.map((item) => <FeedbackCard key={item.id} item={item} />)}
          </div>
        )}
      </div>

      {modalOpen && <FeedbackModal onClose={() => setModalOpen(false)} />}
    </>
  );
}
