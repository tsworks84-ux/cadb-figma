"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { resolvePhotoUrl } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Plus, Pin, X, Send, FileText, Search, Filter,
  Eye, CheckCircle2, Users, Calendar, AlertCircle,
  MoreVertical, TrendingUp, Paperclip, Download, ImageIcon, Archive,
  Info, ChevronUp, ChevronDown, Mail, Phone, MessageSquare,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type AnnStatus   = "DRAFT" | "PUBLISHED" | "ARCHIVED";
type AnnType     = "GENERAL" | "IMPORTANT" | "URGENT";
type AnnAudience = "ALL_EMPLOYEES" | "MANAGERS" | "HR_ONLY" | "STUDENTS";

interface AttachmentMeta {
  name: string; url: string; size: number; type: string;
}

interface Announcement {
  id: string; title: string; body: string;
  type: AnnType; status: AnnStatus; audience: AnnAudience;
  pinned: boolean; attachments: AttachmentMeta[];
  publishedAt?: string | null; notifiedCount: number;
  createdAt: string; updatedAt: string;
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

interface AdminData { data: Announcement[]; stats: AnnStats | null; }

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIMARY = "#2C3E7C";

const TYPE_PRIORITY: Record<AnnType, { color: string; label: string; barColor: string }> = {
  GENERAL:   { color: "#A8D08D", label: "Low",    barColor: "#A8D08D" },
  IMPORTANT: { color: "#F2994A", label: "Medium", barColor: "#F2994A" },
  URGENT:    { color: "#E07A5F", label: "High",   barColor: "#E07A5F" },
};

const AUDIENCE_LABEL: Record<AnnAudience, string> = {
  ALL_EMPLOYEES: "All Employees",
  MANAGERS:      "Managers",
  HR_ONLY:       "HR Only",
  STUDENTS:      "Students",
};

const AUDIENCE_STYLE: Record<AnnAudience, { bg: string; text: string }> = {
  ALL_EMPLOYEES: { bg: "#2C3E7C15", text: PRIMARY },
  MANAGERS:      { bg: "#F2994A15", text: "#F2994A" },
  HR_ONLY:       { bg: "#A8D08D30", text: "#689F5B" },
  STUDENTS:      { bg: "#8B5CF615", text: "#7C3AED" },
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function fmtDate(iso: string) {
  return format(new Date(iso), "MMM d, yyyy");
}
function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function getInitials(first: string, last: string) {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}
function AttachmentIcon({ type }: { type: string }) {
  if (type === "application/pdf") return <FileText className="h-4 w-4 text-red-500" />;
  return <ImageIcon className="h-4 w-4 text-blue-500" />;
}

// ─── Notice Card (Figma design) ───────────────────────────────────────────────

function NoticeCard({
  a, isAdmin, totalEmployees, onEdit, onDelete, onPublish, onArchive,
  onTogglePin, onAcknowledge, onViewAcks,
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
  const [menuOpen, setMenuOpen] = useState(false);
  const priority = TYPE_PRIORITY[a.type];
  const notified = a.notifiedCount > 0 ? a.notifiedCount : totalEmployees;
  const viewed = a._count.views;
  const acked  = a._count.acks;
  const viewPct = notified > 0 ? Math.min(100, Math.round((viewed / notified) * 100)) : 0;
  const ackPct  = notified > 0 ? Math.min(100, Math.round((acked  / notified) * 100)) : 0;
  const ackBarColor = ackPct >= 80 ? "#10b981" : ackPct >= 60 ? "#F2994A" : "#E07A5F";
  const dateStr = fmtDate(a.publishedAt ?? a.createdAt);
  const audStyle = AUDIENCE_STYLE[a.audience];

  return (
    <div className="bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow overflow-hidden">
      {/* Priority colour bar */}
      <div className="h-1" style={{ backgroundColor: priority.barColor }} />

      <div className="p-5 sm:p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 pr-2">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <h3 className="text-base font-semibold text-gray-900">{a.title}</h3>
              {a.type === "URGENT" && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium text-red-700 bg-red-50">
                  <AlertCircle size={11} /> High Priority
                </span>
              )}
              {a.pinned && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium text-amber-700 bg-amber-50">
                  <Pin size={11} /> Pinned
                </span>
              )}
              {a.status === "DRAFT" && (
                <span className="px-2 py-0.5 rounded text-xs font-medium text-gray-500 bg-gray-100">Draft</span>
              )}
              {a.status === "ARCHIVED" && (
                <span className="px-2 py-0.5 rounded text-xs font-medium text-red-500 bg-red-50">Archived</span>
              )}
            </div>
            <p className="text-sm text-gray-600 line-clamp-2">{a.body}</p>
          </div>

          {/* Context menu */}
          {isAdmin && (
            <div className="relative shrink-0">
              <button onClick={() => setMenuOpen(!menuOpen)} className="p-1.5 hover:bg-gray-100 rounded-md">
                <MoreVertical size={18} className="text-gray-400" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-8 z-10 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[140px]" onMouseLeave={() => setMenuOpen(false)}>
                  {a.status !== "ARCHIVED" && (
                    <button onClick={() => { onEdit?.(a); setMenuOpen(false); }} className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">Edit</button>
                  )}
                  {a.status === "DRAFT" && (
                    <button onClick={() => { onPublish?.(a.id); setMenuOpen(false); }} className="w-full px-3 py-2 text-left text-sm text-green-600 hover:bg-gray-50">Publish</button>
                  )}
                  {a.status === "PUBLISHED" && (
                    <>
                      <button onClick={() => { onTogglePin?.(a.id, !a.pinned); setMenuOpen(false); }} className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">{a.pinned ? "Unpin" : "Pin"}</button>
                      <button onClick={() => { onArchive?.(a.id); setMenuOpen(false); }} className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">Archive</button>
                    </>
                  )}
                  {a.status === "ARCHIVED" && (
                    <button onClick={() => { onPublish?.(a.id); setMenuOpen(false); }} className="w-full px-3 py-2 text-left text-sm text-green-600 hover:bg-gray-50">Re-publish</button>
                  )}
                  <button onClick={() => { onDelete?.(a.id); setMenuOpen(false); }} className="w-full px-3 py-2 text-left text-sm text-red-500 hover:bg-gray-50">Delete</button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-3 mb-3 text-sm text-gray-500">
          <span className="flex items-center gap-1"><Calendar size={13} />{dateStr}</span>
          <span>·</span>
          <span>{a.postedBy.firstName} {a.postedBy.lastName}</span>
          <span>·</span>
          <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: `${PRIMARY}15`, color: PRIMARY }}>
            {a.type.charAt(0) + a.type.slice(1).toLowerCase()}
          </span>
        </div>

        {/* Audience tag */}
        <div className="flex items-center gap-2 mb-4">
          <Users size={14} className="text-gray-400" />
          <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: audStyle.bg, color: audStyle.text }}>
            {AUDIENCE_LABEL[a.audience]}
          </span>
        </div>

        {/* Attachments */}
        {a.attachments?.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {a.attachments.map((att) => (
              <a key={att.url} href={`${API_BASE}${att.url}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 border border-gray-200 rounded-md text-xs text-gray-600 hover:bg-blue-50 hover:border-blue-200 transition-colors">
                <AttachmentIcon type={att.type} />
                <span className="max-w-[140px] truncate">{att.name}</span>
                <Download className="h-3 w-3 text-gray-400" />
              </a>
            ))}
          </div>
        )}

        {/* Engagement stats — only for published */}
        {a.status === "PUBLISHED" && (
          <>
            <div className="grid grid-cols-3 gap-3 pt-4 border-t border-gray-100 mb-4">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <Users size={14} className="text-gray-400" />
                  <span className="text-xs text-gray-500">Recipients</span>
                </div>
                <p className="text-base font-semibold text-gray-900">{notified}</p>
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <Eye size={14} className="text-blue-500" />
                  <span className="text-xs text-gray-500">Viewed</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <p className="text-base font-semibold text-gray-900">{viewed}</p>
                  <span className="text-xs text-blue-600">({viewPct}%)</span>
                </div>
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <CheckCircle2 size={14} className="text-emerald-500" />
                  <span className="text-xs text-gray-500">Acknowledged</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <p className="text-base font-semibold text-gray-900">{acked}</p>
                  <span className={`text-xs ${ackPct >= 80 ? "text-emerald-600" : ackPct >= 60 ? "text-yellow-600" : "text-red-500"}`}>({ackPct}%)</span>
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mb-4">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Acknowledgment Progress</span>
                <span>{ackPct}% Complete</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div className="h-1.5 rounded-full transition-all" style={{ width: `${ackPct}%`, backgroundColor: ackBarColor }} />
              </div>
            </div>
          </>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          {isAdmin && a.status === "PUBLISHED" && (
            <>
              <button
                onClick={() => onViewAcks?.(a.id)}
                className="flex-1 sm:flex-none px-4 py-2 border rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
                style={{ borderColor: PRIMARY, color: PRIMARY }}
              >
                View Details
              </button>
              <button className="px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                Send Reminder
              </button>
            </>
          )}
          {!isAdmin && a.status === "PUBLISHED" && (
            a.acknowledged ? (
              <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-600">
                <CheckCircle2 size={16} /> Acknowledged
              </span>
            ) : (
              <button
                onClick={() => onAcknowledge?.(a.id)}
                className="px-4 py-2 rounded-md text-sm font-medium text-white flex items-center gap-2"
                style={{ backgroundColor: PRIMARY }}
              >
                <CheckCircle2 size={16} /> Acknowledge
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Create / Edit Modal (Figma design) ──────────────────────────────────────

interface FormState {
  title: string; body: string; type: AnnType; audience: AnnAudience;
  pinned: boolean; attachments: AttachmentMeta[];
  requireAcknowledgment: boolean; scheduledDate: string;
}
const DEFAULT_FORM: FormState = {
  title: "", body: "", type: "GENERAL", audience: "ALL_EMPLOYEES",
  pinned: false, attachments: [], requireAcknowledgment: true, scheduledDate: "",
};

const AUDIENCE_TILES: { value: AnnAudience; label: string; active: { border: string; bg: string; icon: string; text: string }; }[] = [
  { value: "ALL_EMPLOYEES", label: "All Staff",
    active: { border: "#2C3E7C", bg: "#2C3E7C10", icon: "bg-blue-100 text-blue-600",   text: "text-blue-700" } },
  { value: "MANAGERS",      label: "Managers",
    active: { border: "#F2994A", bg: "#F2994A10", icon: "bg-orange-100 text-orange-500", text: "text-orange-700" } },
  { value: "HR_ONLY",       label: "HR Only",
    active: { border: "#A8D08D", bg: "#A8D08D20", icon: "bg-green-100 text-green-600",  text: "text-green-700" } },
  { value: "STUDENTS",      label: "Students",
    active: { border: "#7C3AED", bg: "#8B5CF610", icon: "bg-purple-100 text-purple-600", text: "text-purple-700" } },
];

function NoticeModal({
  initial, onSaveDraft, onPublish, onClose, saving, publishing,
}: {
  initial?: Partial<FormState>;
  onSaveDraft: (f: FormState) => void;
  onPublish: (f: FormState) => void;
  onClose: () => void;
  saving: boolean; publishing: boolean;
}) {
  const [form, setForm] = useState<FormState>({ ...DEFAULT_FORM, ...initial });
  const [uploading, setUploading] = useState(false);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((p) => ({ ...p, [k]: v }));
  const valid = form.title.trim().length > 0 && form.body.trim().length > 0;

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const allowed = ["application/pdf", "image/jpeg", "image/png"];
    if (!allowed.includes(file.type)) { toast.error("Only PDF, JPG, PNG allowed"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("File too large (max 5 MB)"); return; }
    const fd = new FormData();
    fd.append("file", file);
    setUploading(true);
    try {
      const res = await api.post<{ data: AttachmentMeta }>("/api/v1/announcements/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setForm((p) => ({ ...p, attachments: [...p.attachments, res.data.data] }));
    } catch { toast.error("Upload failed"); }
    finally { setUploading(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: PRIMARY }}>
              <FileText className="text-white" size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{initial?.title ? "Edit Notice" : "Create New Notice"}</h2>
              <p className="text-sm text-gray-500">Publish important updates and announcements</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-md transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Notice Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text" value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="e.g. Mid-Term Examination Schedule"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Category + Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Category <span className="text-red-500">*</span></label>
              <select value={form.type} onChange={(e) => set("type", e.target.value as AnnType)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="GENERAL">General</option>
                <option value="IMPORTANT">Important</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Priority</label>
              <select value={form.type} onChange={(e) => set("type", e.target.value as AnnType)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="GENERAL">Low Priority</option>
                <option value="IMPORTANT">Medium Priority</option>
                <option value="URGENT">High Priority</option>
              </select>
            </div>
          </div>

          {/* Content */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Notice Content <span className="text-red-500">*</span>
            </label>
            <textarea value={form.body} onChange={(e) => set("body", e.target.value)}
              placeholder="Enter the detailed notice content here..."
              rows={6} className="w-full px-3 py-2.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            <p className="text-xs text-gray-400 mt-1">{form.body.length} characters</p>
          </div>

          {/* Target Audience — visual tiles */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Target Audience <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-3">
              {AUDIENCE_TILES.map((tile) => {
                const selected = form.audience === tile.value;
                return (
                  <button
                    key={tile.value}
                    type="button"
                    onClick={() => set("audience", tile.value)}
                    className="p-4 border-2 rounded-xl transition-all text-center"
                    style={selected
                      ? { borderColor: tile.active.border, backgroundColor: tile.active.bg }
                      : { borderColor: "#e5e7eb", backgroundColor: "white" }
                    }
                  >
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2 ${selected ? tile.active.icon : "bg-gray-100"}`}>
                      <Users size={22} className={selected ? "" : "text-gray-400"} />
                    </div>
                    <span className={`text-sm font-medium ${selected ? tile.active.text : "text-gray-700"}`}>
                      {tile.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Require Acknowledgment */}
          <label className="flex items-start gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
            <div className="mt-0.5 shrink-0">
              <input
                type="checkbox"
                checked={form.requireAcknowledgment}
                onChange={(e) => set("requireAcknowledgment", e.target.checked)}
                className="w-4 h-4 rounded"
                style={{ accentColor: PRIMARY }}
              />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Require Acknowledgment</p>
              <p className="text-xs text-gray-500 mt-0.5">Recipients must acknowledge they have read this notice</p>
            </div>
          </label>

          {/* Schedule for Later */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Schedule for Later (Optional)</label>
            <input
              type="datetime-local"
              value={form.scheduledDate}
              onChange={(e) => set("scheduledDate", e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-400 mt-1">Leave empty to publish immediately</p>
          </div>

          {/* Pin toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <button type="button" onClick={() => set("pinned", !form.pinned)}
              className={`flex h-5 w-9 items-center rounded-full transition-colors ${form.pinned ? "bg-blue-600" : "bg-gray-200"}`}>
              <div className={`h-4 w-4 rounded-full bg-white shadow-sm mx-0.5 transition-transform ${form.pinned ? "translate-x-4" : ""}`} />
            </button>
            <span className="text-sm text-gray-600 flex items-center gap-1">
              <Pin className="h-3.5 w-3.5 text-gray-400" /> Pin to top
            </span>
          </label>

          {/* Attachments */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium text-gray-700">Attachments</span>
              <label className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border border-dashed border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-600 cursor-pointer transition-colors ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
                <Paperclip className="h-3.5 w-3.5" />
                {uploading ? "Uploading…" : "Attach file"}
                <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileChange} disabled={uploading} />
              </label>
              <span className="text-xs text-gray-400">PDF, JPG, PNG · max 5 MB</span>
            </div>
            {form.attachments.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {form.attachments.map((a) => (
                  <div key={a.url} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-md text-xs text-gray-700">
                    <AttachmentIcon type={a.type} />
                    <span className="max-w-[140px] truncate">{a.name}</span>
                    <span className="text-gray-400">({formatBytes(a.size)})</span>
                    <button onClick={() => setForm((p) => ({ ...p, attachments: p.attachments.filter((x) => x.url !== a.url) }))} className="ml-1 text-gray-400 hover:text-red-500">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-between rounded-b-xl">
          <p className="text-sm text-gray-500">
            Will be sent to <span className="font-medium text-gray-700">{AUDIENCE_LABEL[form.audience]}</span>
          </p>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-white transition-colors">
              Cancel
            </button>
            <button
              disabled={!valid || saving}
              onClick={() => valid && onSaveDraft(form)}
              className="px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-white disabled:opacity-40 transition-colors">
              {saving ? "Saving…" : "Save as Draft"}
            </button>
            <button
              disabled={!valid || publishing}
              onClick={() => valid && onPublish(form)}
              className="px-5 py-2 rounded-md text-sm font-medium text-white flex items-center gap-2 disabled:opacity-40 transition-colors"
              style={{ backgroundColor: PRIMARY }}
            >
              <Send size={16} />
              {publishing ? "Publishing…" : "Publish Notice"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Acks Modal ───────────────────────────────────────────────────────────────

interface AckRow {
  id: string; ackedAt: string;
  employee: { id: string; firstName: string; lastName: string; photoUrl?: string | null; employeeCode: string; designation?: { title: string } | null };
}

function AcknowledgementsModal({ announcementId, title, onClose }: { announcementId: string; title: string; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["ann-acks", announcementId],
    queryFn: () => api.get<{ data: AckRow[]; count: number }>(`/api/v1/announcements/${announcementId}/acknowledgements`).then((r) => r.data),
  });
  const rows = data?.data ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="font-semibold text-gray-900">Acknowledgements</p>
            <p className="text-xs text-gray-400 mt-0.5 max-w-xs truncate">{title}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
          {isLoading && [1,2,3].map((i) => (
            <div key={i} className="flex items-center gap-3 p-2 animate-pulse">
              <div className="h-8 w-8 rounded-full bg-gray-200" />
              <div className="flex-1"><div className="h-3 w-32 bg-gray-200 rounded mb-1" /><div className="h-2.5 w-20 bg-gray-100 rounded" /></div>
            </div>
          ))}
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
                  ? <img src={resolvePhotoUrl(row.employee.photoUrl)!} alt="" className="h-full w-full object-cover" />
                  : getInitials(row.employee.firstName, row.employee.lastName)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{row.employee.firstName} {row.employee.lastName}</p>
                <p className="text-xs text-gray-400">{row.employee.designation?.title ?? row.employee.employeeCode}</p>
              </div>
              <p className="text-xs text-gray-400 shrink-0">{format(new Date(row.ackedAt), "MMM d, h:mm a")}</p>
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

// ─── Directory Widget ─────────────────────────────────────────────────────────

const ROLE_PURPOSE: Record<string, string[]> = {
  SUPER_ADMIN: ["Administration", "General Info"],
  HR_ADMIN:    ["HR Queries", "Staff Grievances"],
  DEPT_HEAD:   ["Academic Feedback", "Department Queries"],
};

function DirectoryWidget() {
  const [expanded, setExpanded] = useState(true);
  const [search, setSearch]     = useState("");

  const { data: employees } = useQuery({
    queryKey: ["employees"],
    queryFn: () => api.get("/api/v1/employees").then((r) => r.data.data),
    staleTime: 5 * 60 * 1000,
  });

  const keyPeople = (employees ?? []).filter((e: any) =>
    ["SUPER_ADMIN", "HR_ADMIN", "DEPT_HEAD"].includes(e.role)
  );

  const filtered = search.trim()
    ? keyPeople.filter((e: any) =>
        `${e.firstName} ${e.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
        (e.role ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (e.department?.name ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : keyPeople;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between mb-4"
      >
        <div className="flex items-center gap-2">
          <Info size={16} style={{ color: "#2C3E7C" }} />
          <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wider">Directory</h3>
          <span className="text-xs text-gray-500">({keyPeople.length})</span>
        </div>
        {expanded
          ? <ChevronUp size={18} className="text-gray-400" />
          : <ChevronDown size={18} className="text-gray-400" />
        }
      </button>

      {expanded && (
        <>
          <p className="text-xs text-gray-600 mb-3">Key contacts for information and support</p>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input
              type="text"
              placeholder="Search by name or role..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-4 py-2 border border-gray-200 rounded-md text-xs focus:outline-none focus:ring-2"
            />
          </div>

          {filtered.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">No contacts found</p>
          ) : (
            <div className="space-y-4">
              {filtered.map((person: any) => {
                const initials = `${person.firstName?.[0] ?? ""}${person.lastName?.[0] ?? ""}`.toUpperCase();
                const purposes = ROLE_PURPOSE[person.role] ?? [person.role?.replace(/_/g, " ") ?? ""];
                return (
                  <div key={person.id} className="pb-4 border-b border-gray-100 last:border-b-0 last:pb-0">
                    <div className="flex items-start gap-3 mb-2">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-medium text-sm shrink-0 overflow-hidden"
                        style={{ backgroundColor: "#2C3E7C" }}
                      >
                        {person.photoUrl
                          ? <img src={resolvePhotoUrl(person.photoUrl)!} alt="" className="h-full w-full object-cover" />
                          : initials
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-gray-900 truncate">
                          {person.firstName} {person.lastName}
                        </h4>
                        <p className="text-xs text-gray-500">
                          {person.designation?.title ?? person.role?.replace(/_/g, " ")}
                        </p>
                      </div>
                    </div>

                    {person.department?.name && (
                      <p className="text-xs text-gray-600 mb-1.5 pl-[52px]">{person.department.name}</p>
                    )}

                    <div className="flex flex-wrap gap-1 mb-2 pl-[52px]">
                      {purposes.map((p: string, i: number) => (
                        <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded">
                          {p}
                        </span>
                      ))}
                    </div>

                    <div className="space-y-1 pl-[52px]">
                      {person.email && (
                        <a href={`mailto:${person.email}`} className="flex items-center gap-2 text-xs text-gray-600 hover:text-blue-600 group">
                          <Mail size={12} className="text-gray-400 group-hover:text-blue-600 shrink-0" />
                          <span className="truncate">{person.email}</span>
                        </a>
                      )}
                      {person.phone && (
                        <a href={`tel:${person.phone}`} className="flex items-center gap-2 text-xs text-gray-600 hover:text-blue-600 group">
                          <Phone size={12} className="text-gray-400 group-hover:text-blue-600 shrink-0" />
                          <span>{person.phone}</span>
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-4 pt-3 border-t border-gray-200">
            <div className="bg-blue-50 border border-blue-100 rounded-md p-3 flex items-start gap-2">
              <MessageSquare size={13} className="text-blue-600 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-900">
                Reach out for queries or concerns. Response time: 24–48 hours.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AnnouncementsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = user?.role === "SUPER_ADMIN" || user?.role === "HR_ADMIN";

  const [search, setSearch]       = useState("");
  const [filterAud, setFilterAud] = useState<"all" | AnnAudience>("all");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState<Announcement | null>(null);
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
    if (filterAud !== "all") list = list.filter((a) => a.audience === filterAud);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((a) => a.title.toLowerCase().includes(q) || a.body.toLowerCase().includes(q) || `${a.postedBy.firstName} ${a.postedBy.lastName}`.toLowerCase().includes(q));
    }
    return list;
  }, [all, filterAud, search]);

  // ── Analytics for sidebar ──────────────────────────────────────────────────

  const published = all.filter((a) => a.status === "PUBLISHED");
  const totalEmployees = stats?.totalEmployees ?? 0;
  const totalReach     = published.reduce((s, a) => s + (a.notifiedCount > 0 ? a.notifiedCount : totalEmployees), 0);
  const totalViewed    = published.reduce((s, a) => s + a._count.views, 0);
  const totalAcked     = published.reduce((s, a) => s + a._count.acks, 0);
  const avgViewPct     = totalReach > 0 ? Math.round((totalViewed / totalReach) * 100) : 0;
  const avgAckPct      = totalReach > 0 ? Math.round((totalAcked  / totalReach) * 100) : 0;

  // ── Mutations ──────────────────────────────────────────────────────────────

  function patchList(updated: Announcement) {
    queryClient.setQueryData<AdminData>(QK, (old) => old ? { ...old, data: old.data.map((a) => a.id === updated.id ? updated : a) } : old);
  }
  function removeFromList(id: string) {
    queryClient.setQueryData<AdminData>(QK, (old) => old ? { ...old, data: old.data.filter((a) => a.id !== id) } : old);
  }
  function addToList(a: Announcement) {
    queryClient.setQueryData<AdminData>(QK, (old) => old ? { ...old, data: [a, ...old.data] } : old);
  }

  const createMut = useMutation({
    mutationFn: (body: object) => api.post<{ data: Announcement }>("/api/v1/announcements", body),
    onSuccess: (res) => { addToList(res.data.data); setShowModal(false); toast.success("Notice posted"); queryClient.invalidateQueries({ queryKey: QK }); },
    onError: () => toast.error("Failed to create"),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) => api.patch<{ data: Announcement }>(`/api/v1/announcements/${id}`, body),
    onSuccess: (res) => { patchList(res.data.data); setEditing(null); setShowModal(false); toast.success("Updated"); queryClient.invalidateQueries({ queryKey: QK }); },
    onError: () => toast.error("Failed to update"),
  });
  const publishMut = useMutation({
    mutationFn: (id: string) => api.post<{ data: Announcement }>(`/api/v1/announcements/${id}/publish`),
    onSuccess: (res) => { patchList(res.data.data); toast.success("Published"); queryClient.invalidateQueries({ queryKey: QK }); },
    onError: () => toast.error("Failed to publish"),
  });
  const archiveMut = useMutation({
    mutationFn: (id: string) => api.post<{ data: Announcement }>(`/api/v1/announcements/${id}/archive`),
    onSuccess: (res) => { patchList(res.data.data); toast.success("Archived"); queryClient.invalidateQueries({ queryKey: QK }); },
    onError: () => toast.error("Failed to archive"),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/announcements/${id}`),
    onSuccess: (_, id) => { removeFromList(id); toast.success("Deleted"); queryClient.invalidateQueries({ queryKey: QK }); },
    onError: () => toast.error("Failed to delete"),
  });
  const acknowledgeMut = useMutation({
    mutationFn: (id: string) => api.post(`/api/v1/announcements/${id}/acknowledge`),
    onSuccess: (_, id) => {
      queryClient.setQueryData<AdminData>(QK, (old) => old ? { ...old, data: old.data.map((a) => a.id === id ? { ...a, acknowledged: true, _count: { ...a._count, acks: a._count.acks + 1 } } : a) } : old);
      toast.success("Acknowledged");
    },
    onError: () => toast.error("Failed to acknowledge"),
  });

  function buildBody(f: FormState, publish: boolean) {
    return { title: f.title, body: f.body, type: f.type, audience: f.audience, pinned: f.pinned, attachments: f.attachments, publish };
  }
  function handleSaveDraft(f: FormState) {
    if (editing) updateMut.mutate({ id: editing.id, ...buildBody(f, false) });
    else createMut.mutate(buildBody(f, false));
  }
  function handlePublish(f: FormState) {
    if (editing) {
      updateMut.mutate({ id: editing.id, ...buildBody(f, false) }, { onSuccess: () => publishMut.mutate(editing.id) });
    } else {
      createMut.mutate(buildBody(f, true));
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: PRIMARY }}>
              <FileText className="text-white" size={18} />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-widest font-medium">Team Communication</p>
              <h1 className="text-2xl font-bold text-gray-900 leading-tight">Notice Board</h1>
            </div>
          </div>
          <p className="text-sm text-gray-500 ml-12">Publish updates that every team member can quickly view and acknowledge</p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => { setEditing(null); setShowModal(true); }}
              className="px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Save Draft
            </button>
            <button
              onClick={() => { setEditing(null); setShowModal(true); }}
              className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium text-white transition-colors"
              style={{ backgroundColor: PRIMARY }}
            >
              <Plus size={18} /> New Notice
            </button>
          </div>
        )}
      </div>

      {/* Two column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Main — notices list */}
        <div className="lg:col-span-2 space-y-4">

          {/* Search + filter */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search notices by title, category, or author..."
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-2">
                <select
                  value={filterAud}
                  onChange={(e) => setFilterAud(e.target.value as "all" | AnnAudience)}
                  className="flex-1 sm:flex-none px-3 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Audiences</option>
                  <option value="ALL_EMPLOYEES">All Employees</option>
                  <option value="MANAGERS">Managers</option>
                  <option value="HR_ONLY">HR Only</option>
                  <option value="STUDENTS">Students</option>
                </select>
                <button className="p-2 border border-gray-200 rounded-md text-gray-600 hover:bg-gray-50">
                  <Filter size={18} />
                </button>
              </div>
            </div>
          </div>

          {/* List */}
          {isLoading && (
            <div className="space-y-4">
              {[1,2,3].map((i) => (
                <div key={i} className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse">
                  <div className="h-4 w-2/3 bg-gray-200 rounded mb-3" />
                  <div className="h-3 w-full bg-gray-100 rounded mb-2" />
                  <div className="h-3 w-5/6 bg-gray-100 rounded" />
                </div>
              ))}
            </div>
          )}

          {!isLoading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 bg-white rounded-lg border border-gray-200 text-center">
              <FileText className="h-12 w-12 text-gray-200 mb-3" />
              <p className="text-gray-500 font-medium">{search ? "No notices match your search" : "No notices yet"}</p>
              {isAdmin && !search && <p className="text-sm text-gray-400 mt-1">Create a new notice to notify your team.</p>}
            </div>
          )}

          {filtered.map((a) => (
            <NoticeCard
              key={a.id} a={a} isAdmin={isAdmin}
              totalEmployees={stats?.totalEmployees ?? 0}
              onEdit={(ann) => { setEditing(ann); setShowModal(true); }}
              onDelete={(id) => deleteMut.mutate(id)}
              onPublish={(id) => publishMut.mutate(id)}
              onArchive={(id) => archiveMut.mutate(id)}
              onTogglePin={(id, pinned) => updateMut.mutate({ id, pinned })}
              onAcknowledge={(id) => acknowledgeMut.mutate(id)}
              onViewAcks={(id) => setAcksModal({ id, title: a.title })}
            />
          ))}
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">

          {/* Overview */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-4">Overview</h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500 mb-1">Total</p>
                <p className="text-3xl font-semibold text-gray-900">{all.length}</p>
              </div>
              <div className="pt-4 border-t border-gray-100">
                <p className="text-sm text-gray-500 mb-1">Active</p>
                <p className="text-3xl font-semibold" style={{ color: PRIMARY }}>{published.length}</p>
              </div>
              <div className="pt-4 border-t border-gray-100">
                <p className="text-sm text-gray-500 mb-1">Drafts</p>
                <p className="text-3xl font-semibold text-gray-900">{stats?.drafts ?? all.filter((a) => a.status === "DRAFT").length}</p>
              </div>
              <div className="pt-4 border-t border-gray-100">
                <p className="text-sm text-gray-500 mb-1">Avg. Acknowledgment</p>
                <div className="flex items-baseline gap-1">
                  <p className="text-3xl font-semibold text-emerald-600">{avgAckPct}%</p>
                  <TrendingUp size={18} className="text-emerald-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Engagement Analytics */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-4">Engagement Analytics</h3>

            <div className="space-y-5">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                    <Users size={15} className="text-blue-600" />
                  </div>
                  <p className="text-xs text-gray-600 font-medium">Total Reach</p>
                </div>
                <p className="text-2xl font-semibold text-gray-900">{totalReach.toLocaleString()}</p>
                <p className="text-xs text-gray-400 mt-0.5">Across all notices</p>
              </div>

              <div className="pt-4 border-t border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
                    <Eye size={15} className="text-purple-600" />
                  </div>
                  <p className="text-xs text-gray-600 font-medium">View Rate</p>
                </div>
                <div className="flex items-baseline gap-2 mb-2">
                  <p className="text-2xl font-semibold text-gray-900">{avgViewPct}%</p>
                  <span className="text-xs text-gray-400">({totalViewed})</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div className="bg-purple-600 h-1.5 rounded-full" style={{ width: `${avgViewPct}%` }} />
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <CheckCircle2 size={15} className="text-emerald-600" />
                  </div>
                  <p className="text-xs text-gray-600 font-medium">Acknowledgment</p>
                </div>
                <div className="flex items-baseline gap-2 mb-2">
                  <p className="text-2xl font-semibold text-gray-900">{avgAckPct}%</p>
                  <span className="text-xs text-gray-400">({totalAcked})</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div className="bg-emerald-600 h-1.5 rounded-full" style={{ width: `${avgAckPct}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Directory */}
          <DirectoryWidget />

        </div>
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <NoticeModal
          initial={editing ? { title: editing.title, body: editing.body, type: editing.type, audience: editing.audience, pinned: editing.pinned, attachments: editing.attachments ?? [] } : undefined}
          onSaveDraft={handleSaveDraft}
          onPublish={handlePublish}
          onClose={() => { setShowModal(false); setEditing(null); }}
          saving={createMut.isPending || updateMut.isPending}
          publishing={publishMut.isPending}
        />
      )}

      {/* Acks Modal */}
      {acksModal && (
        <AcknowledgementsModal announcementId={acksModal.id} title={acksModal.title} onClose={() => setAcksModal(null)} />
      )}
    </div>
  );
}
