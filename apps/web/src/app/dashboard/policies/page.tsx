"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth";
import { useState, useRef } from "react";
import {
  FileText, CheckCircle, X, Upload, Plus, Loader2, Trash2,
  Users, Clock, ChevronDown, ChevronUp,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const CATEGORIES = ["HR", "FINANCE", "IT", "OPERATIONS", "COMPLIANCE", "ACADEMIC", "OTHER"] as const;
type Category = typeof CATEGORIES[number];

const CATEGORY_COLOR: Record<Category, string> = {
  HR: "bg-blue-100 text-blue-700",
  FINANCE: "bg-green-100 text-green-700",
  IT: "bg-purple-100 text-purple-700",
  OPERATIONS: "bg-orange-100 text-orange-700",
  COMPLIANCE: "bg-red-100 text-red-700",
  ACADEMIC: "bg-yellow-100 text-yellow-700",
  OTHER: "bg-gray-100 text-gray-700",
};

const CATEGORY_ICON: Record<Category, string> = {
  HR: "👥",
  FINANCE: "💰",
  IT: "💻",
  OPERATIONS: "⚙️",
  COMPLIANCE: "⚖️",
  ACADEMIC: "🎓",
  OTHER: "📄",
};

interface Policy {
  id: string;
  title: string;
  category: Category;
  version: string;
  description?: string;
  fileUrl: string;
  requiresAck: boolean;
  publishedAt: string;
  expiresAt?: string;
  ackCount?: number;
  totalEmployees?: number | null;
  myAcknowledgedAt?: string | null;
}

interface AckEmployee {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  department?: { name: string };
}

interface AckData {
  acknowledged: Array<{ employee: AckEmployee; acknowledgedAt: string }>;
  pending: AckEmployee[];
  counts: { acknowledged: number; pending: number; total: number };
}

function AckTrackerModal({ policy, onClose }: { policy: Policy; onClose: () => void }) {
  const [tab, setTab] = useState<"acknowledged" | "pending">("acknowledged");

  const { data, isLoading } = useQuery<AckData>({
    queryKey: ["policy-acks", policy.id],
    queryFn: () =>
      api.get(`/api/v1/policies/${policy.id}/acknowledgements`).then((r) => r.data.data),
  });

  const pct = data
    ? Math.round((data.counts.acknowledged / Math.max(data.counts.total, 1)) * 100)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-100">
          <div className="min-w-0">
            <h2 className="font-semibold text-gray-900 truncate">{policy.title}</h2>
            <p className="text-xs text-gray-500 mt-0.5">Acknowledgement tracking</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Stats */}
        {data && (
          <div className="px-5 py-4 bg-gray-50 border-b border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                {data.counts.acknowledged} of {data.counts.total} employees acknowledged
              </span>
              <span className="text-sm font-bold text-blue-600">{pct}%</span>
            </div>
            <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
              <div
                className="h-full rounded-full bg-green-500 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setTab("acknowledged")}
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === "acknowledged"
                ? "text-green-700 border-b-2 border-green-500"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <span className="flex items-center justify-center gap-1.5">
              <CheckCircle className="h-3.5 w-3.5" />
              Acknowledged ({data?.counts.acknowledged ?? "—"})
            </span>
          </button>
          <button
            onClick={() => setTab("pending")}
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === "pending"
                ? "text-orange-700 border-b-2 border-orange-500"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <span className="flex items-center justify-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Pending ({data?.counts.pending ?? "—"})
            </span>
          </button>
        </div>

        {/* List */}
        <div className="max-h-80 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : tab === "acknowledged" ? (
            data?.acknowledged.length === 0 ? (
              <p className="text-center py-8 text-sm text-gray-400">No acknowledgements yet.</p>
            ) : (
              <ul className="divide-y divide-gray-50">
                {data?.acknowledged.map((a) => (
                  <li key={a.employee.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {a.employee.firstName} {a.employee.lastName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {a.employee.employeeCode} · {a.employee.department?.name}
                      </p>
                    </div>
                    <span className="text-xs text-gray-400 shrink-0 ml-3">
                      {new Date(a.acknowledgedAt).toLocaleDateString("en-IN", {
                        day: "numeric", month: "short", year: "numeric",
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            )
          ) : (
            data?.pending.length === 0 ? (
              <p className="text-center py-8 text-sm text-green-600 font-medium">All employees have acknowledged!</p>
            ) : (
              <ul className="divide-y divide-gray-50">
                {data?.pending.map((emp) => (
                  <li key={emp.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-600 text-xs font-bold">
                      {emp.firstName[0]}{emp.lastName[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {emp.firstName} {emp.lastName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {emp.employeeCode} · {emp.department?.name}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )
          )}
        </div>
      </div>
    </div>
  );
}

const emptyForm = { title: "", category: "HR" as Category, version: "1.0", description: "", requiresAck: false };

function PdfViewerModal({ policy, onClose }: { policy: Policy; onClose: () => void }) {
  const src = policy.fileUrl.startsWith("http") ? policy.fileUrl : `${API_URL}${policy.fileUrl}`;
  const [loadError, setLoadError] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/70" onClick={onClose}>
      <div
        className="relative flex flex-col bg-white rounded-t-xl mt-12 flex-1 overflow-hidden shadow-2xl mx-4 mb-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-200 bg-gray-50 shrink-0">
          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${CATEGORY_COLOR[policy.category]}`}>
            {policy.category}
          </span>
          <span className="font-semibold text-gray-900 text-sm flex-1 truncate">{policy.title}</span>
          <span className="text-xs text-gray-400 shrink-0">v{policy.version}</span>
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-2 rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-blue-600 hover:bg-blue-50 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            Open in new tab ↗
          </a>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-700 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {/* PDF */}
        {loadError ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-4 text-gray-500">
            <FileText className="h-12 w-12 text-gray-300" />
            <p className="text-sm">Could not load PDF preview.</p>
            <a
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Open PDF directly ↗
            </a>
          </div>
        ) : (
          <iframe
            src={src}
            title={policy.title}
            className="flex-1 w-full border-0"
            onError={() => setLoadError(true)}
          />
        )}
      </div>
    </div>
  );
}

function UploadModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { toast.error("Please select a PDF file"); return; }
    if (!form.title.trim()) { toast.error("Title is required"); return; }

    const fd = new FormData();
    fd.append("file", file);
    fd.append("title", form.title);
    fd.append("category", form.category);
    fd.append("version", form.version);
    if (form.description) fd.append("description", form.description);
    fd.append("requiresAck", String(form.requiresAck));

    setLoading(true);
    try {
      await api.post("/api/v1/policies/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Policy uploaded successfully");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Upload Policy Document</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* File picker */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">PDF File <span className="text-red-500">*</span></label>
            <div
              className="flex items-center gap-3 rounded-lg border-2 border-dashed border-gray-200 px-4 py-3 cursor-pointer hover:border-blue-300 hover:bg-blue-50 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-5 w-5 text-gray-400 shrink-0" />
              <span className="text-sm text-gray-500 truncate">
                {file ? file.name : "Click to select PDF"}
              </span>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Title <span className="text-red-500">*</span></label>
            <input
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Employee Leave Policy AY 2026-27"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
              <select
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as Category }))}
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Version</label>
              <input
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.version}
                onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))}
                placeholder="1.0"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
            <textarea
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={2}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Brief description of this policy"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.requiresAck}
              onChange={(e) => setForm((f) => ({ ...f, requiresAck: e.target.checked }))}
              className="rounded"
            />
            <span className="text-sm text-gray-700">Require employee acknowledgement</span>
          </label>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Upload
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function PoliciesPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = user?.role === "SUPER_ADMIN" || user?.role === "HR_ADMIN";

  const [viewing, setViewing] = useState<Policy | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [trackingPolicy, setTrackingPolicy] = useState<Policy | null>(null);

  const { data: policies, isLoading } = useQuery({
    queryKey: ["policies"],
    queryFn: () => api.get("/api/v1/policies").then((r) => r.data.data),
  });

  const ackMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/v1/policies/${id}/acknowledge`),
    onSuccess: () => {
      toast.success("Policy acknowledged");
      queryClient.invalidateQueries({ queryKey: ["policies"] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? "Failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/policies/${id}`),
    onSuccess: () => {
      toast.success("Policy removed");
      queryClient.invalidateQueries({ queryKey: ["policies"] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? "Failed"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Policy Documents</h1>
          <p className="text-sm text-gray-500 mt-0.5">Company policies and guidelines</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowUpload(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 shadow-sm transition-colors"
          >
            <Plus className="h-4 w-4" />
            Upload Policy
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-gray-200 bg-white p-5 animate-pulse">
              <div className="h-4 bg-gray-100 rounded mb-3" />
              <div className="h-3 bg-gray-100 rounded w-2/3 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : !policies?.length ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 py-16 text-center text-gray-400">
          <FileText className="mx-auto h-10 w-10 mb-2 opacity-40" />
          <p>No policy documents published yet.</p>
          {isAdmin && (
            <button
              onClick={() => setShowUpload(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Upload className="h-4 w-4" /> Upload your first policy
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {policies.map((policy: Policy) => (
            <div
              key={policy.id}
              className="group relative rounded-xl border border-gray-200 bg-white hover:shadow-md hover:border-blue-200 transition-all cursor-pointer"
              onClick={() => setViewing(policy)}
            >
              <div className="p-5">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${CATEGORY_COLOR[policy.category]}`}>
                    {CATEGORY_ICON[policy.category]} {policy.category}
                  </span>
                  <span className="text-xs text-gray-400">v{policy.version}</span>
                </div>

                <div className="flex items-start gap-3 mb-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-500">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900 text-sm leading-snug">{policy.title}</h3>
                    {policy.description && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{policy.description}</p>
                    )}
                  </div>
                </div>

                <p className="text-xs text-gray-400">Published: {formatDate(policy.publishedAt)}</p>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50 rounded-b-xl">
                <span className="text-xs text-blue-600 font-medium group-hover:underline">
                  Click to view document →
                </span>
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  {/* Admin: acknowledgement tracker badge */}
                  {isAdmin && policy.requiresAck && (
                    <button
                      onClick={() => setTrackingPolicy(policy)}
                      className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded px-2 py-1 hover:bg-blue-100 transition-colors"
                    >
                      <Users className="h-3 w-3" />
                      {policy.ackCount ?? 0}
                      {policy.totalEmployees != null && `/${policy.totalEmployees}`} ack
                    </button>
                  )}
                  {/* Employee: acknowledge button or acknowledged badge */}
                  {!isAdmin && policy.requiresAck && (
                    policy.myAcknowledgedAt ? (
                      <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 border border-green-200 rounded px-2 py-1">
                        <CheckCircle className="h-3 w-3" />
                        Acknowledged on {new Date(policy.myAcknowledgedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    ) : (
                      <button
                        onClick={() => ackMutation.mutate(policy.id)}
                        className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 border border-green-200 rounded px-2 py-1 hover:bg-green-100"
                      >
                        <CheckCircle className="h-3 w-3" /> Acknowledge
                      </button>
                    )
                  )}
                  {isAdmin && (
                    <button
                      onClick={() => {
                        if (confirm(`Remove "${policy.title}"?`)) deleteMutation.mutate(policy.id);
                      }}
                      className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {viewing && <PdfViewerModal policy={viewing} onClose={() => setViewing(null)} />}
      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ["policies"] })}
        />
      )}
      {trackingPolicy && (
        <AckTrackerModal policy={trackingPolicy} onClose={() => setTrackingPolicy(null)} />
      )}
    </div>
  );
}
