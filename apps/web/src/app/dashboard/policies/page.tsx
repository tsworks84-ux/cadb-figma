"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth";
import { useState, useRef } from "react";
import {
  FileText, CheckCircle, X, Upload, Plus, Loader2, Trash2,
  Users, Clock, Shield, Search, Eye, Calendar, File, Tag, AlertCircle,
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

// ─── Ack Tracker Modal ────────────────────────────────────────────────────────

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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-100">
          <div className="min-w-0">
            <h2 className="font-semibold text-gray-900 truncate">{policy.title}</h2>
            <p className="text-xs text-gray-500 mt-0.5">Acknowledgement tracking</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>

        {data && (
          <div className="px-5 py-4 bg-gray-50 border-b border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                {data.counts.acknowledged} of {data.counts.total} employees acknowledged
              </span>
              <span className="text-sm font-bold text-blue-600">{pct}%</span>
            </div>
            <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
              <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}

        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setTab("acknowledged")}
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${tab === "acknowledged" ? "text-green-700 border-b-2 border-green-500" : "text-gray-500 hover:text-gray-700"}`}
          >
            <span className="flex items-center justify-center gap-1.5">
              <CheckCircle className="h-3.5 w-3.5" />
              Acknowledged ({data?.counts.acknowledged ?? "—"})
            </span>
          </button>
          <button
            onClick={() => setTab("pending")}
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${tab === "pending" ? "text-orange-700 border-b-2 border-orange-500" : "text-gray-500 hover:text-gray-700"}`}
          >
            <span className="flex items-center justify-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Pending ({data?.counts.pending ?? "—"})
            </span>
          </button>
        </div>

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
                      <p className="text-sm font-medium text-gray-900">{a.employee.firstName} {a.employee.lastName}</p>
                      <p className="text-xs text-gray-500">{a.employee.employeeCode} · {a.employee.department?.name}</p>
                    </div>
                    <span className="text-xs text-gray-400 shrink-0 ml-3">
                      {new Date(a.acknowledgedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
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
                      <p className="text-sm font-medium text-gray-900">{emp.firstName} {emp.lastName}</p>
                      <p className="text-xs text-gray-500">{emp.employeeCode} · {emp.department?.name}</p>
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

// ─── PDF Viewer Modal ─────────────────────────────────────────────────────────

function PdfViewerModal({ policy, onClose }: { policy: Policy; onClose: () => void }) {
  const src = policy.fileUrl.startsWith("http") ? policy.fileUrl : `${API_URL}${policy.fileUrl}`;
  const [loadError, setLoadError] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/70" onClick={onClose}>
      <div className="relative flex flex-col bg-white rounded-t-xl mt-12 flex-1 overflow-hidden shadow-2xl mx-4 mb-0" onClick={(e) => e.stopPropagation()}>
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
          <button onClick={onClose} className="rounded-full p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-700 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        {loadError ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-4 text-gray-500">
            <FileText className="h-12 w-12 text-gray-300" />
            <p className="text-sm">Could not load PDF preview.</p>
            <a href={src} target="_blank" rel="noopener noreferrer" className="rounded-lg px-4 py-2 text-sm font-medium text-white hover:opacity-90" style={{ backgroundColor: "#2C3E7C" }}>
              Open PDF directly ↗
            </a>
          </div>
        ) : (
          <iframe src={src} title={policy.title} className="flex-1 w-full border-0" onError={() => setLoadError(true)} />
        )}
      </div>
    </div>
  );
}

// ─── Upload Modal ─────────────────────────────────────────────────────────────

const emptyForm = { title: "", category: "HR" as Category, version: "1.0", description: "", requiresAck: false };

// Must match MAX_POLICY_BYTES on the API, and stay under nginx's
// client_max_body_size on prod (12M).
const MAX_POLICY_MB = 10;

function UploadModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function handlePick(picked: File | null) {
    if (!picked) { setFile(null); return; }
    if (!picked.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Only PDF files are allowed");
      return;
    }
    if (picked.size > MAX_POLICY_MB * 1024 * 1024) {
      toast.error(`"${picked.name}" is ${(picked.size / 1024 / 1024).toFixed(1)} MB. The maximum policy size is ${MAX_POLICY_MB} MB.`);
      return;
    }
    setFile(picked);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { toast.error("Please select a PDF file"); return; }
    if (!form.title.trim()) { toast.error("Title is required"); return; }

    if (file.size > MAX_POLICY_MB * 1024 * 1024) {
      toast.error(`"${file.name}" is ${(file.size / 1024 / 1024).toFixed(1)} MB. The maximum policy size is ${MAX_POLICY_MB} MB.`);
      return;
    }

    const fd = new FormData();
    fd.append("file", file);
    fd.append("title", form.title);
    fd.append("category", form.category);
    fd.append("version", form.version);
    if (form.description) fd.append("description", form.description);
    fd.append("requiresAck", String(form.requiresAck));

    setLoading(true);
    try {
      await api.post("/api/v1/policies/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success("Policy uploaded successfully");
      onSuccess();
      onClose();
    } catch (err: any) {
      // A 413 from the reverse proxy comes back as an HTML page with no JSON
      // body, so fall back to a size message rather than a bare "Upload failed".
      const fallback =
        err.response?.status === 413
          ? `File is too large. The maximum policy size is ${MAX_POLICY_MB} MB.`
          : "Upload failed";
      toast.error(err.response?.data?.error ?? fallback);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Upload Policy</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-5">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Policy Title <span className="text-red-500">*</span></label>
              <input
                type="text"
                placeholder="e.g., Leave Policy, Reimbursement Policy"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 text-sm"
              />
            </div>

            {/* Category + Version */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <Tag size={16} /> Category
                </label>
                <select
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as Category }))}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 text-sm"
                >
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Version</label>
                <input
                  value={form.version}
                  onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))}
                  placeholder="1.0"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 text-sm"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <FileText size={16} /> Description
                <span className="text-xs text-gray-500 font-normal">(Optional)</span>
              </label>
              <textarea
                placeholder="Brief description of this policy..."
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 resize-none text-sm"
              />
            </div>

            {/* File Upload */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Upload size={16} /> Policy Document <span className="text-red-600">*</span>
              </label>
              {!file ? (
                <label className="block cursor-pointer">
                  <input type="file" accept="application/pdf,.pdf" onChange={(e) => handlePick(e.target.files?.[0] ?? null)} className="hidden" ref={fileRef} />
                  <div className="flex flex-col items-center justify-center gap-2 px-4 py-8 border-2 border-dashed border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                    <Upload size={32} className="text-gray-400" />
                    <p className="text-sm font-medium text-gray-700">Click to upload policy document</p>
                    <p className="text-xs text-gray-500">PDF (Max {MAX_POLICY_MB}MB)</p>
                  </div>
                </label>
              ) : (
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <File size={24} className="text-gray-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                      <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <button onClick={() => setFile(null)} className="p-2 hover:bg-gray-200 rounded text-gray-400 hover:text-red-600">
                    <X size={18} />
                  </button>
                </div>
              )}
            </div>

            {/* Require Ack */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.requiresAck}
                onChange={(e) => setForm((f) => ({ ...f, requiresAck: e.target.checked }))}
                className="rounded"
                style={{ accentColor: "#2C3E7C" }}
              />
              <span className="text-sm text-gray-700">Require employee acknowledgement</span>
            </label>

            {/* Info Note */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-2">
              <AlertCircle className="text-blue-600 shrink-0 mt-0.5" size={16} />
              <p className="text-xs text-blue-800">
                Once uploaded, this policy will be immediately visible to all employees.
              </p>
            </div>

            {/* Preview */}
            {form.title && form.category && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Preview</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Title</span>
                    <span className="font-medium text-gray-900">{form.title}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Category</span>
                    <span className="font-medium text-gray-900">{form.category}</span>
                  </div>
                  {file && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Document</span>
                      <span className="font-medium text-gray-900">{file.name}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !form.title.trim() || !file}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-60 hover:opacity-90"
              style={{ backgroundColor: "#2C3E7C" }}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Upload Policy
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PoliciesPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = user?.role === "SUPER_ADMIN" || user?.role === "HR_ADMIN";

  const [viewing, setViewing] = useState<Policy | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [trackingPolicy, setTrackingPolicy] = useState<Policy | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"ALL" | Category>("ALL");

  const { data: policies, isLoading } = useQuery({
    queryKey: ["policies"],
    queryFn: () => api.get("/api/v1/policies").then((r) => r.data.data),
  });

  const ackMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/v1/policies/${id}/acknowledge`),
    onSuccess: () => { toast.success("Policy acknowledged"); queryClient.invalidateQueries({ queryKey: ["policies"] }); },
    onError: (err: any) => toast.error(err.response?.data?.error ?? "Failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/policies/${id}`),
    onSuccess: () => { toast.success("Policy removed"); queryClient.invalidateQueries({ queryKey: ["policies"] }); },
    onError: (err: any) => toast.error(err.response?.data?.error ?? "Failed"),
  });

  const filtered = (policies ?? []).filter((p: Policy) => {
    const matchesSearch =
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase()) ||
      (p.description ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === "ALL" || p.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: "#2C3E7C" }}>
              <Shield className="text-white" size={18} />
            </div>
            <div>
              <p className="text-sm text-gray-500 uppercase tracking-wide">Company</p>
              <h1 className="text-2xl font-semibold text-gray-900">Policy Documents</h1>
            </div>
          </div>
          <p className="text-sm md:text-base text-gray-600 mt-1">Company policies and guidelines</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowUpload(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium text-white hover:opacity-90"
            style={{ backgroundColor: "#2C3E7C" }}
          >
            <Plus size={18} /> Upload Policy
          </button>
        )}
      </div>

      {/* Search + Filter */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search policies..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 text-sm"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as "ALL" | Category)}
            className="px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 bg-white"
          >
            <option value="ALL">All Categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-gray-200 bg-white p-5 animate-pulse">
              <div className="flex gap-3 mb-3">
                <div className="w-12 h-12 bg-gray-200 rounded-lg shrink-0" />
                <div className="flex-1"><div className="h-4 bg-gray-200 rounded mb-2" /><div className="h-3 w-1/2 bg-gray-100 rounded" /></div>
              </div>
              <div className="h-3 bg-gray-100 rounded mb-2" /><div className="h-3 w-2/3 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <FileText className="mx-auto text-gray-300 mb-4" size={48} />
          <p className="text-base font-medium text-gray-900 mb-1">
            {search || categoryFilter !== "ALL" ? "No matching policies found." : "No policy documents published yet."}
          </p>
          <p className="text-sm text-gray-500 mb-4">
            {isAdmin ? "Start by uploading your first policy document." : "Check back later for policy updates."}
          </p>
          {isAdmin && !search && categoryFilter === "ALL" && (
            <button
              onClick={() => setShowUpload(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium text-white mx-auto hover:opacity-90"
              style={{ backgroundColor: "#2C3E7C" }}
            >
              <Upload size={18} /> Upload your first policy
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((policy: Policy) => (
            <div key={policy.id} className="bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-all p-5">
              {/* Card Header */}
              <div className="flex items-start gap-3 mb-3">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "#2C3E7C" }}>
                  <FileText className="text-white" size={22} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-gray-900 mb-1 leading-snug">{policy.title}</h3>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_COLOR[policy.category]}`}>
                      {policy.category}
                    </span>
                    <span className="text-xs text-gray-400">v{policy.version}</span>
                  </div>
                </div>
                {isAdmin && (
                  <button
                    onClick={() => { if (confirm(`Remove "${policy.title}"?`)) deleteMutation.mutate(policy.id); }}
                    className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-red-600 shrink-0"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>

              {/* Description */}
              {policy.description && (
                <p className="text-xs text-gray-500 mb-3 line-clamp-2">{policy.description}</p>
              )}

              {/* Meta details */}
              <div className="space-y-1.5 mb-4">
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <Calendar size={13} className="text-gray-400" />
                  <span>Published {formatDate(policy.publishedAt)}</span>
                </div>
                {policy.requiresAck && (
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <Users size={13} className="text-gray-400" />
                    <span>
                      {isAdmin
                        ? `${policy.ackCount ?? 0}${policy.totalEmployees != null ? `/${policy.totalEmployees}` : ""} acknowledged`
                        : policy.myAcknowledgedAt
                        ? "You acknowledged this"
                        : "Acknowledgement required"
                      }
                    </span>
                    {isAdmin && (
                      <button
                        onClick={() => setTrackingPolicy(policy)}
                        className="text-xs underline hover:no-underline ml-1"
                        style={{ color: "#2C3E7C" }}
                      >
                        Track →
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => setViewing(policy)}
                  className="flex-1 px-4 py-2 rounded-md text-sm font-medium text-white flex items-center justify-center gap-2 hover:opacity-90"
                  style={{ backgroundColor: "#2C3E7C" }}
                >
                  <Eye size={16} /> View Policy
                </button>
                {!isAdmin && policy.requiresAck && !policy.myAcknowledgedAt && (
                  <button
                    onClick={() => ackMutation.mutate(policy.id)}
                    disabled={ackMutation.isPending}
                    className="px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <CheckCircle size={15} className="text-green-600" /> Acknowledge
                  </button>
                )}
                {!isAdmin && policy.requiresAck && policy.myAcknowledgedAt && (
                  <div className="px-3 py-2 flex items-center gap-1.5 text-xs text-green-600 font-medium">
                    <CheckCircle size={14} /> Acknowledged
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Admin stats bar */}
      {isAdmin && (policies?.length ?? 0) > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-900">
              {policies?.length} {policies?.length === 1 ? "policy" : "policies"} published
            </p>
            <p className="text-xs text-gray-600 mt-0.5">
              Showing {filtered.length} of {policies?.length}
            </p>
          </div>
          <FileText className="text-blue-600" size={24} />
        </div>
      )}

      {/* Modals */}
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
