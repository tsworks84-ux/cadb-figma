"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import {
  Plus, Pin, Pencil, Trash2, X,
  Megaphone, Archive, Send, ChevronDown, ChevronUp,
  Paperclip, FileText, ImageIcon, Download, CheckCircle2, Users,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type AnnStatus   = "DRAFT" | "PUBLISHED" | "ARCHIVED";
type AnnType     = "GENERAL" | "IMPORTANT" | "URGENT";
type AnnAudience = "ALL_EMPLOYEES" | "MANAGERS" | "HR_ONLY";

interface AttachmentMeta {
  name: string;
  url: string;
  size: number;
  type: string;
}

interface Announcement {
  id: string;
  title: string;
  body: string;
  type: AnnType;
  status: AnnStatus;
  audience: AnnAudience;
  pinned: boolean;
  attachments: AttachmentMeta[];
  publishedAt?: string | null;
  notifiedCount: number;
  createdAt: string;
  updatedAt: string;
  postedBy: {
    firstName: string; lastName: string;
    photoUrl?: string | null;
    designation?: { title: string } | null;
  };
  _count: { views: number; acks: number };
  acknowledged?: boolean;
}

interface AnnStats {
  total: number; pinned: number; drafts: number; published: number;
  archived: number; seenRate: number; totalEmployees: number;
}

interface AdminData {
  data: Announcement[];
  stats: AnnStats | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const AUDIENCE_LABEL: Record<AnnAudience, string> = {
  ALL_EMPLOYEES: "All employees",
  MANAGERS:      "Managers",
  HR_ONLY:       "HR only",
};

function getInitials(first: string, last: string) {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}

function timeAgo(iso: string) {
  return formatDistanceToNow(new Date(iso), { addSuffix: true });
}

function fmtDateTime(iso: string) {
  return format(new Date(iso), "MMM d, h:mm a");
}


const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// ─── Status / type badges ─────────────────────────────────────────────────────

function StatusBadge({ status }: { status: AnnStatus }) {
  const map: Record<AnnStatus, string> = {
    PUBLISHED: "bg-green-100 text-green-700 border border-green-200",
    DRAFT:     "bg-gray-100 text-gray-500 border border-gray-200",
    ARCHIVED:  "bg-red-50 text-red-400 border border-red-100",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${map[status]}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

// ─── Form ─────────────────────────────────────────────────────────────────────

interface FormState {
  title: string; body: string;
  type: AnnType; audience: AnnAudience;
  pinned: boolean;
  attachments: AttachmentMeta[];
}

const DEFAULT_FORM: FormState = { title: "", body: "", type: "GENERAL", audience: "ALL_EMPLOYEES", pinned: false, attachments: [] };

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentIcon({ type }: { type: string }) {
  if (type === "application/pdf") return <FileText className="h-4 w-4 text-red-500" />;
  return <ImageIcon className="h-4 w-4 text-blue-500" />;
}

function AnnouncementForm({
  initial, onSaveDraft, onPublish, onCancel, saving, publishing,
}: {
  initial?: Partial<FormState>;
  onSaveDraft: (f: FormState) => void;
  onPublish: (f: FormState) => void;
  onCancel: () => void;
  saving: boolean; publishing: boolean;
}) {
  const [form, setForm] = useState<FormState>({ ...DEFAULT_FORM, ...initial });
  const [uploading, setUploading] = useState(false);
  const set = (k: keyof FormState, v: string | boolean) => setForm((p) => ({ ...p, [k]: v }));
  const valid = form.title.trim().length > 0 && form.body.trim().length > 0;

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const allowed = ["application/pdf", "image/jpeg", "image/png"];
    if (!allowed.includes(file.type)) {
      toast.error("Only PDF, JPG, PNG allowed");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large (max 5 MB)");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    setUploading(true);
    try {
      const res = await api.post<{ data: AttachmentMeta }>("/api/v1/announcements/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setForm((p) => ({ ...p, attachments: [...p.attachments, res.data.data] }));
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function removeAttachment(url: string) {
    setForm((p) => ({ ...p, attachments: p.attachments.filter((a) => a.url !== url) }));
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-500 mb-1">Title <span className="text-red-400">*</span></label>
          <input
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="e.g. Monthly operations review on Friday"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Priority</label>
          <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            value={form.type} onChange={(e) => set("type", e.target.value as AnnType)}>
            <option value="GENERAL">General</option>
            <option value="IMPORTANT">Important</option>
            <option value="URGENT">Urgent</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Message <span className="text-red-400">*</span></label>
        <textarea
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
          placeholder="Start with the decision, deadline, or action required…"
          rows={4}
          value={form.body}
          onChange={(e) => set("body", e.target.value)}
        />
        <p className="text-xs text-gray-400 mt-0.5 text-right">{form.body.length}/5000</p>
      </div>
      <div className="grid grid-cols-2 gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Audience</label>
          <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            value={form.audience} onChange={(e) => set("audience", e.target.value as AnnAudience)}>
            <option value="ALL_EMPLOYEES">All Employees</option>
            <option value="MANAGERS">Managers</option>
            <option value="HR_ONLY">HR Only</option>
          </select>
        </div>
        <label className="flex items-center gap-2 cursor-pointer pb-1.5">
          <button
            type="button"
            onClick={() => set("pinned", !form.pinned)}
            className={`flex h-5 w-9 items-center rounded-full transition-colors ${form.pinned ? "bg-blue-600" : "bg-gray-200"}`}
          >
            <div className={`h-4 w-4 rounded-full bg-white shadow-sm mx-0.5 transition-transform ${form.pinned ? "translate-x-4" : ""}`} />
          </button>
          <span className="text-sm text-gray-600 flex items-center gap-1">
            <Pin className="h-3.5 w-3.5 text-gray-400" /> Pin to top
          </span>
        </label>
      </div>
      {/* Attachments */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <label className="text-xs font-medium text-gray-500">Attachments</label>
          <label className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border border-dashed border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-600 cursor-pointer transition-colors ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
            <Paperclip className="h-3.5 w-3.5" />
            {uploading ? "Uploading…" : "Attach file"}
            <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileChange} disabled={uploading} />
          </label>
          <span className="text-xs text-gray-400">PDF, JPG, PNG · max 5 MB</span>
        </div>
        {form.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {form.attachments.map((a) => (
              <div key={a.url} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700">
                <AttachmentIcon type={a.type} />
                <span className="max-w-[140px] truncate">{a.name}</span>
                <span className="text-gray-400">({formatBytes(a.size)})</span>
                <button onClick={() => removeAttachment(a.url)} className="ml-1 text-gray-400 hover:text-red-500">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-1 border-t border-gray-100">
        <button onClick={onCancel} className="px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">
          Cancel
        </button>
        <button
          disabled={!valid || saving}
          onClick={() => valid && onSaveDraft(form)}
          className="px-4 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? "Saving…" : "Save Draft"}
        </button>
        <button
          disabled={!valid || publishing}
          onClick={() => valid && onPublish(form)}
          className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Send className="h-3.5 w-3.5" />
          {publishing ? "Publishing…" : "Publish"}
        </button>
      </div>
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

const LEFT_BORDER: Record<AnnStatus, string> = {
  PUBLISHED: "border-l-green-400",
  DRAFT:     "border-l-gray-300",
  ARCHIVED:  "border-l-red-300",
};

function AnnouncementCard({
  a, isAdmin, onEdit, onDelete, onPublish, onArchive, onTogglePin, onAcknowledge, onViewAcks, totalEmployees,
}: {
  a: Announcement; isAdmin: boolean; totalEmployees: number;
  onEdit?: (a: Announcement) => void;
  onDelete?: (id: string) => void;
  onPublish?: (id: string) => void;
  onArchive?: (id: string) => void;
  onTogglePin?: (id: string, pinned: boolean) => void;
  onAcknowledge?: (id: string) => void;
  onViewAcks?: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const seenCount = a._count.views;
  const ackCount  = a._count.acks;
  const notified  = a.notifiedCount > 0 ? a.notifiedCount : totalEmployees;
  const seenPct   = notified > 0 ? Math.min(100, Math.round((seenCount / notified) * 100)) : 0;
  const ackPct    = notified > 0 ? Math.min(100, Math.round((ackCount  / notified) * 100)) : 0;

  const timestamp = a.status === "PUBLISHED" && a.publishedAt
    ? fmtDateTime(a.publishedAt)
    : a.status === "DRAFT"
    ? `Draft saved ${timeAgo(a.updatedAt)}`
    : `Archived ${timeAgo(a.updatedAt)}`;

  return (
    <div className={`bg-white rounded-xl border border-gray-100 border-l-4 ${LEFT_BORDER[a.status]} shadow-sm overflow-hidden`}>
      {/* Header row */}
      <div className="flex items-start gap-3 px-5 pt-4 pb-3">
        {/* Avatar */}
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-bold overflow-hidden">
          {a.postedBy.photoUrl
            ? <img src={`${API_BASE}${a.postedBy.photoUrl}`} alt="" className="h-full w-full object-cover" />
            : getInitials(a.postedBy.firstName, a.postedBy.lastName)
          }
        </div>
        {/* Author + time */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-700">
            {a.postedBy.firstName} {a.postedBy.lastName}
            <span className="font-normal text-gray-400"> · {timestamp}</span>
          </p>
        </div>
        {/* Badges */}
        <div className="flex items-center gap-1.5 shrink-0">
          {a.pinned && (
            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200">
              <Pin className="h-2.5 w-2.5" /> Pinned
            </span>
          )}
          <StatusBadge status={a.status} />
          <button onClick={() => setExpanded(!expanded)} className="p-1 text-gray-300 hover:text-gray-500 ml-1">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Body */}
      {expanded && (
        <div className="px-5 pb-3">
          <h3 className="text-base font-bold text-gray-900 mb-1.5">{a.title}</h3>
          <p className="text-sm text-gray-600 leading-relaxed line-clamp-3">{a.body}</p>
          {a.attachments?.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {a.attachments.map((att) => (
                <a
                  key={att.url}
                  href={`${API_BASE}${att.url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors"
                >
                  <AttachmentIcon type={att.type} />
                  <span className="max-w-[160px] truncate">{att.name}</span>
                  <span className="text-gray-400">({formatBytes(att.size)})</span>
                  <Download className="h-3 w-3 ml-0.5 text-gray-400" />
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between px-5 py-2.5 border-t border-gray-50 bg-gray-50/50">
        <p className="text-xs text-gray-400">
          {a.status === "PUBLISHED" ? (
            <>
              {AUDIENCE_LABEL[a.audience]} · <span className="font-medium text-gray-600">{notified} notified</span> · <span className={seenPct >= 80 ? "text-green-600 font-medium" : ""}>{seenPct}% seen</span>
              {isAdmin && (
                <>
                  {" · "}
                  <button
                    onClick={() => onViewAcks?.(a.id)}
                    className={`font-medium hover:underline ${ackPct >= 80 ? "text-green-600" : "text-gray-500"}`}
                  >
                    <span className="inline-flex items-center gap-0.5">
                      <CheckCircle2 className="h-3 w-3" /> {ackCount} acknowledged ({ackPct}%)
                    </span>
                  </button>
                </>
              )}
            </>
          ) : a.status === "DRAFT" ? (
            <span className="text-gray-400">Not published yet</span>
          ) : (
            <span className="text-gray-400">Archived · {AUDIENCE_LABEL[a.audience]}</span>
          )}
        </p>
        <div className="flex items-center gap-3">
          {/* Acknowledge button for employees */}
          {!isAdmin && a.status === "PUBLISHED" && (
            a.acknowledged ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
                <CheckCircle2 className="h-3.5 w-3.5" /> Acknowledged
              </span>
            ) : (
              <button
                onClick={() => onAcknowledge?.(a.id)}
                className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Acknowledge
              </button>
            )
          )}
          {/* Admin actions */}
          {isAdmin && (
            <>
              {a.status === "DRAFT" && (
                <>
                  <button onClick={() => onEdit?.(a)} className="text-xs font-medium text-blue-600 hover:underline">Continue Editing</button>
                  <button onClick={() => onPublish?.(a.id)} className="text-xs font-medium text-green-600 hover:underline flex items-center gap-0.5">
                    <Send className="h-3 w-3" /> Publish
                  </button>
                  <button onClick={() => onDelete?.(a.id)} className="text-xs font-medium text-red-500 hover:underline">Delete</button>
                </>
              )}
              {a.status === "PUBLISHED" && (
                <>
                  <button
                    onClick={() => onTogglePin?.(a.id, !a.pinned)}
                    className={`text-xs font-medium hover:underline ${a.pinned ? "text-amber-600" : "text-gray-400 hover:text-amber-600"}`}
                  >
                    {a.pinned ? "Unpin" : "Pin"}
                  </button>
                  <button onClick={() => onEdit?.(a)} className="text-xs font-medium text-blue-600 hover:underline">Edit</button>
                  <button onClick={() => onArchive?.(a.id)} className="text-xs font-medium text-gray-400 hover:text-gray-700 hover:underline flex items-center gap-0.5">
                    <Archive className="h-3 w-3" /> Archive
                  </button>
                </>
              )}
              {a.status === "ARCHIVED" && (
                <>
                  <button onClick={() => onPublish?.(a.id)} className="text-xs font-medium text-green-600 hover:underline">Re-publish</button>
                  <button onClick={() => onDelete?.(a.id)} className="text-xs font-medium text-red-500 hover:underline">Delete</button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Acknowledgements modal ───────────────────────────────────────────────────

interface AckRow {
  id: string;
  ackedAt: string;
  employee: {
    id: string; firstName: string; lastName: string;
    photoUrl?: string | null; employeeCode: string;
    designation?: { title: string } | null;
  };
}

function AcknowledgementsModal({ announcementId, title, onClose }: { announcementId: string; title: string; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["ann-acks", announcementId],
    queryFn: () => api.get<{ data: AckRow[]; count: number }>(`/api/v1/announcements/${announcementId}/acknowledgements`).then((r) => r.data),
  });

  const rows = data?.data ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="font-semibold text-gray-900">Acknowledgements</p>
            <p className="text-xs text-gray-400 mt-0.5 max-w-xs truncate">{title}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
          {isLoading && (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 p-2 animate-pulse">
                  <div className="h-8 w-8 rounded-full bg-gray-200" />
                  <div className="flex-1">
                    <div className="h-3 w-32 bg-gray-200 rounded mb-1" />
                    <div className="h-2.5 w-20 bg-gray-100 rounded" />
                  </div>
                </div>
              ))}
            </div>
          )}
          {!isLoading && rows.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Users className="h-10 w-10 text-gray-200 mb-2" />
              <p className="text-sm text-gray-400">No acknowledgements yet</p>
            </div>
          )}
          {rows.map((row) => (
            <div key={row.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-bold overflow-hidden">
                {row.employee.photoUrl
                  ? <img src={`${API_BASE}${row.employee.photoUrl}`} alt="" className="h-full w-full object-cover" />
                  : getInitials(row.employee.firstName, row.employee.lastName)
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{row.employee.firstName} {row.employee.lastName}</p>
                <p className="text-xs text-gray-400 truncate">{row.employee.designation?.title ?? row.employee.employeeCode}</p>
              </div>
              <p className="text-xs text-gray-400 shrink-0">{fmtDateTime(row.ackedAt)}</p>
            </div>
          ))}
        </div>
        <div className="px-5 py-3 border-t border-gray-100">
          <p className="text-xs text-gray-400">{data?.count ?? 0} employee{(data?.count ?? 0) !== 1 ? "s" : ""} acknowledged</p>
        </div>
      </div>
    </div>
  );
}

// ─── Month grouping helpers ───────────────────────────────────────────────────

const ANN_MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function annMonthKey(a: Announcement) {
  const d = new Date(a.publishedAt ?? a.createdAt);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function annMonthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return `${ANN_MONTH_NAMES[m - 1]} ${y}`;
}

function annCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// ─── Month section wrapper (collapsible) ─────────────────────────────────────

function MonthSection({ monthKey, announcements, defaultOpen, children }: {
  monthKey: string;
  announcements: Announcement[];
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const isCurrent = monthKey === annCurrentMonthKey();

  return (
    <div className="space-y-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-colors mb-2"
      >
        <div className="flex items-center gap-3">
          <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${open ? "" : "-rotate-90"}`} />
          <span className="text-sm font-semibold text-gray-700">{annMonthLabel(monthKey)}</span>
          {isCurrent && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Current</span>
          )}
          <span className="text-xs text-gray-400">
            {announcements.length} notice{announcements.length !== 1 ? "s" : ""}
          </span>
        </div>
        <span className="text-xs text-gray-400 pr-1">
          {open ? "Collapse" : "Expand"}
        </span>
      </button>
      {open && <div className="space-y-3">{children}</div>}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type FilterTab = "all" | "pinned" | "drafts" | "archived";

export default function AnnouncementsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = user?.role === "SUPER_ADMIN" || user?.role === "HR_ADMIN";

  const [tab, setTab]         = useState<FilterTab>("all");
  const [search, setSearch]   = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]  = useState<Announcement | null>(null);
  const [acksModal, setAcksModal] = useState<{ id: string; title: string } | null>(null);

  const QK = isAdmin ? ["announcements", "admin"] : ["announcements"];

  const { data: adminData, isLoading } = useQuery({
    queryKey: QK,
    queryFn: () =>
      isAdmin
        ? api.get<AdminData>("/api/v1/announcements/all").then((r) => r.data)
        : api.get<{ data: Announcement[] }>("/api/v1/announcements").then((r) => ({ data: r.data.data, stats: null })),
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 30 * 1000,
  });

  const all   = adminData?.data ?? [];
  const stats = adminData?.stats ?? null;

  const filtered = useMemo(() => {
    let list = all;
    if (tab === "pinned")   list = list.filter((a) => a.pinned);
    if (tab === "drafts")   list = list.filter((a) => a.status === "DRAFT");
    if (tab === "archived") list = list.filter((a) => a.status === "ARCHIVED");
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((a) =>
        a.title.toLowerCase().includes(q) ||
        a.body.toLowerCase().includes(q) ||
        `${a.postedBy.firstName} ${a.postedBy.lastName}`.toLowerCase().includes(q)
      );
    }
    return list;
  }, [all, tab, search]);

  // ── Mutations ──────────────────────────────────────────────────────────────

  function patchList(updated: Announcement) {
    queryClient.setQueryData<AdminData>(QK, (old) =>
      old ? { ...old, data: old.data.map((a) => a.id === updated.id ? updated : a) } : old
    );
  }

  function removeFromList(id: string) {
    queryClient.setQueryData<AdminData>(QK, (old) =>
      old ? { ...old, data: old.data.filter((a) => a.id !== id) } : old
    );
  }

  function addToList(a: Announcement) {
    queryClient.setQueryData<AdminData>(QK, (old) =>
      old ? { ...old, data: [a, ...old.data] } : old
    );
  }

  const createMut = useMutation({
    mutationFn: (body: object) => api.post<{ data: Announcement }>("/api/v1/announcements", body),
    onSuccess: (res) => {
      addToList(res.data.data);
      setShowForm(false);
      toast.success("Notice posted");
      queryClient.invalidateQueries({ queryKey: QK });
    },
    onError: () => toast.error("Failed to create"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) =>
      api.patch<{ data: Announcement }>(`/api/v1/announcements/${id}`, body),
    onSuccess: (res) => {
      patchList(res.data.data);
      setEditing(null);
      toast.success("Updated");
      queryClient.invalidateQueries({ queryKey: QK });
    },
    onError: () => toast.error("Failed to update"),
  });

  const publishMut = useMutation({
    mutationFn: (id: string) => api.post<{ data: Announcement }>(`/api/v1/announcements/${id}/publish`),
    onSuccess: (res) => {
      patchList(res.data.data);
      toast.success("Published");
      queryClient.invalidateQueries({ queryKey: QK });
    },
    onError: () => toast.error("Failed to publish"),
  });

  const archiveMut = useMutation({
    mutationFn: (id: string) => api.post<{ data: Announcement }>(`/api/v1/announcements/${id}/archive`),
    onSuccess: (res) => {
      patchList(res.data.data);
      toast.success("Archived");
      queryClient.invalidateQueries({ queryKey: QK });
    },
    onError: () => toast.error("Failed to archive"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/announcements/${id}`),
    onSuccess: (_, id) => {
      removeFromList(id);
      toast.success("Deleted");
      queryClient.invalidateQueries({ queryKey: QK });
    },
    onError: () => toast.error("Failed to delete"),
  });

  const acknowledgeMut = useMutation({
    mutationFn: (id: string) => api.post(`/api/v1/announcements/${id}/acknowledge`),
    onSuccess: (_, id) => {
      queryClient.setQueryData<AdminData>(QK, (old) =>
        old ? {
          ...old,
          data: old.data.map((a) =>
            a.id === id
              ? { ...a, acknowledged: true, _count: { ...a._count, acks: a._count.acks + 1 } }
              : a
          ),
        } : old
      );
      toast.success("Acknowledged");
    },
    onError: () => toast.error("Failed to acknowledge"),
  });

  function handleSaveDraft(f: FormState) {
    const body = buildBody(f, false);
    if (editing) updateMut.mutate({ id: editing.id, ...body });
    else createMut.mutate(body);
  }

  function handlePublish(f: FormState) {
    if (editing) {
      updateMut.mutate({ id: editing.id, ...buildBody(f, false) }, {
        onSuccess: () => publishMut.mutate(editing.id),
      });
    } else {
      createMut.mutate(buildBody(f, true));
    }
  }

  function buildBody(f: FormState, publish: boolean) {
    return { title: f.title, body: f.body, type: f.type, audience: f.audience, pinned: f.pinned, attachments: f.attachments, publish };
  }

  function openEdit(a: Announcement) {
    setEditing(a);
    setShowForm(true);
  }

  // ── Tabs ───────────────────────────────────────────────────────────────────

  const tabs: { key: FilterTab; label: string; count?: number }[] = [
    { key: "all",      label: "All",      count: all.length },
    { key: "pinned",   label: "Pinned",   count: all.filter((a) => a.pinned).length },
    { key: "drafts",   label: "Drafts",   count: stats?.drafts },
    { key: "archived", label: "Archived", count: stats?.archived ?? all.filter((a) => a.status === "ARCHIVED").length },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">

      {/* Page header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-xs font-semibold text-blue-600 uppercase tracking-widest mb-1">Team Communications</p>
          <h1 className="text-3xl font-bold text-gray-900">Notice Board</h1>
          <p className="text-sm text-gray-400 mt-1 max-w-xl">
            Publish updates that every team member can scan quickly. Pin critical notices, save drafts, and review what has already gone out.
          </p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2 shrink-0 mt-1">
            <button
              onClick={() => { setEditing(null); setShowForm(true); }}
              className="px-4 py-2 text-sm font-medium border border-gray-300 text-gray-700 bg-white rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
            >
              Save Draft
            </button>
            <button
              onClick={() => { setEditing(null); setShowForm(true); }}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4" /> New Notice
            </button>
          </div>
        )}
      </div>

      {/* Form (slide down) */}
      {showForm && isAdmin && (
        <div className="mb-6 p-5 bg-white border border-blue-100 rounded-xl shadow-sm animate-slide-down-reveal">
          <div className="flex items-center justify-between mb-4">
            <p className="font-semibold text-gray-800">{editing ? "Edit Notice" : "New Notice"}</p>
            <button onClick={() => { setShowForm(false); setEditing(null); }} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
          </div>
          <AnnouncementForm
            initial={editing ? {
              title: editing.title, body: editing.body, type: editing.type,
              audience: editing.audience, pinned: editing.pinned,
              attachments: editing.attachments ?? [],
            } : undefined}
            onSaveDraft={handleSaveDraft}
            onPublish={handlePublish}
            onCancel={() => { setShowForm(false); setEditing(null); }}
            saving={createMut.isPending || updateMut.isPending}
            publishing={publishMut.isPending}
          />
        </div>
      )}

      {/* Search + Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
        <div className="relative flex-1">
          <Megaphone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-300" />
          <input
            className="w-full border border-gray-200 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
            placeholder="Search announcements by title, audience, or author"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 shrink-0">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tab === t.key
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}{t.count !== undefined ? ` ${t.count}` : ""}
            </button>
          ))}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex gap-5 items-start">

        {/* Main feed */}
        <div className="flex-1 min-w-0 space-y-3">
          {isLoading && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 animate-pulse">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-8 w-8 rounded-full bg-gray-200" />
                    <div className="h-3 w-40 bg-gray-200 rounded" />
                    <div className="ml-auto h-5 w-20 bg-gray-100 rounded-full" />
                  </div>
                  <div className="h-5 w-2/3 bg-gray-200 rounded mb-2" />
                  <div className="h-3 w-full bg-gray-100 rounded mb-1" />
                  <div className="h-3 w-5/6 bg-gray-100 rounded" />
                </div>
              ))}
            </div>
          )}

          {!isLoading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-xl border border-gray-100">
              <Megaphone className="h-12 w-12 text-gray-200 mb-3" />
              <p className="text-gray-500 font-medium">
                {search ? "No announcements match your search" : "Nothing here yet"}
              </p>
              {isAdmin && !search && (
                <p className="text-sm text-gray-400 mt-1">Post a notice to notify all employees.</p>
              )}
            </div>
          )}

          {(() => {
            const curKey = annCurrentMonthKey();
            const groups = new Map<string, Announcement[]>();
            for (const a of filtered) {
              const key = annMonthKey(a);
              if (!groups.has(key)) groups.set(key, []);
              groups.get(key)!.push(a);
            }
            const sortedKeys = [...groups.keys()].sort((a, b) => b.localeCompare(a));

            return sortedKeys.map((key) => {
              const group = groups.get(key)!;
              return (
                <MonthSection
                  key={key}
                  monthKey={key}
                  announcements={group}
                  defaultOpen={key === curKey}
                >
                  {group.map((a) => (
                    <AnnouncementCard
                      key={a.id}
                      a={a}
                      isAdmin={isAdmin}
                      totalEmployees={stats?.totalEmployees ?? 0}
                      onEdit={openEdit}
                      onDelete={(id) => deleteMut.mutate(id)}
                      onPublish={(id) => publishMut.mutate(id)}
                      onArchive={(id) => archiveMut.mutate(id)}
                      onTogglePin={(id, pinned) => updateMut.mutate({ id, pinned })}
                      onAcknowledge={(id) => acknowledgeMut.mutate(id)}
                      onViewAcks={(id) => setAcksModal({ id, title: a.title })}
                    />
                  ))}
                </MonthSection>
              );
            });
          })()}
        </div>

        {/* Right sidebar */}
        {isAdmin && stats && (
          <div className="w-64 shrink-0 space-y-4">

            {/* Overview */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <p className="text-sm font-semibold text-gray-800 mb-3">Overview</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Total",    value: stats.total },
                  { label: "Pinned",   value: stats.pinned },
                  { label: "Drafts",   value: stats.drafts },
                  { label: "Seen rate", value: `${stats.seenRate}%` },
                ].map((s) => (
                  <div key={s.label} className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xl font-bold text-gray-900">{s.value}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}
      </div>

      {acksModal && (
        <AcknowledgementsModal
          announcementId={acksModal.id}
          title={acksModal.title}
          onClose={() => setAcksModal(null)}
        />
      )}
    </div>
  );
}
