"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatDate, formatCurrency } from "@/lib/utils";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Plus, X, Upload, FileText, Eye, Trash2, CheckCircle,
  XCircle, Clock, Banknote, AlertTriangle, ChevronDown, Settings, Paperclip,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const CLAIM_TYPES = ["TRAVEL", "MEDICAL", "FOOD", "ACCOMMODATION", "TRAINING", "OTHER"] as const;

const STATUS_COLOR: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  SUBMITTED: "bg-blue-100 text-blue-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  PAID: "bg-purple-100 text-purple-700",
};

const STATUS_ICON: Record<string, React.ElementType> = {
  DRAFT: Clock,
  SUBMITTED: Clock,
  APPROVED: CheckCircle,
  REJECTED: XCircle,
  PAID: Banknote,
};

// ─── Schema ──────────────────────────────────────────────────────────────────

const claimSchema = z.object({
  claimType: z.string().min(1, "Select a type"),
  title: z.string().min(1, "Required"),
  description: z.string().optional(),
  claimedAmount: z.coerce.number().positive("Must be positive"),
});
type ClaimForm = z.infer<typeof claimSchema>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children, wide }: {
  title: string; onClose: () => void; children: React.ReactNode; wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-xl shadow-xl w-full ${wide ? "max-w-2xl" : "max-w-lg"} max-h-[92vh] flex flex-col`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 className="font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-6">{children}</div>
      </div>
    </div>
  );
}

function Badge({ status }: { status: string }) {
  const Icon = STATUS_ICON[status] ?? Clock;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLOR[status] ?? "bg-gray-100 text-gray-600"}`}>
      <Icon className="h-3 w-3" />
      {status}
    </span>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm text-gray-900">{value || <span className="text-gray-300 italic">—</span>}</p>
    </div>
  );
}

// ─── Receipt card ─────────────────────────────────────────────────────────────

function ReceiptCard({ receipt, claimId, canDelete, onDeleted }: {
  receipt: any; claimId: string; canDelete: boolean; onDeleted: () => void;
}) {
  const qc = useQueryClient();
  const isImage = receipt.mimeType?.startsWith("image/");
  const url = `${API_BASE}${receipt.fileUrl}`;

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/api/v1/claims/${claimId}/receipts/${receipt.id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["claim", claimId] }); qc.invalidateQueries({ queryKey: ["my-claims"] }); onDeleted(); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Delete failed"),
  });

  return (
    <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
      {isImage
        ? <img src={url} alt={receipt.fileName} className="h-10 w-10 rounded object-cover shrink-0 border border-gray-200" />
        : <div className="flex h-10 w-10 items-center justify-center rounded bg-red-50 border border-red-100 shrink-0"><FileText className="h-5 w-5 text-red-400" /></div>
      }
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-700 truncate">{receipt.fileName}</p>
        <p className="text-xs text-gray-400">{receipt.mimeType?.split("/")[1]?.toUpperCase()}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <a href={url} target="_blank" rel="noopener noreferrer"
          className="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-gray-200 text-gray-500">
          <Eye className="h-3.5 w-3.5" />
        </a>
        {canDelete && (
          <button
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
            className="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-red-100 text-gray-400 hover:text-red-500 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Receipt uploader ─────────────────────────────────────────────────────────

function ReceiptUploader({ claimId, onUploaded }: { claimId: string; onUploaded: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const token = localStorage.getItem("cadb_access_token");
      const res = await fetch(`${API_BASE}/api/v1/claims/${claimId}/receipts`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Upload failed");
      }
      onUploaded();
      toast.success("Receipt uploaded");
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-200 py-4 text-sm text-gray-500 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600 transition-colors disabled:opacity-50 cursor-pointer"
      >
        {uploading
          ? <div className="h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          : <Upload className="h-4 w-4" />}
        {uploading ? "Uploading…" : "Click to attach receipt (PDF, JPG, PNG · max 5 MB)"}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
      />
    </>
  );
}

// ─── Claim Detail Modal ───────────────────────────────────────────────────────

function ClaimDetailModal({ claimId, onClose, isAdmin }: {
  claimId: string; onClose: () => void; isAdmin: boolean;
}) {
  const qc = useQueryClient();
  const [showApprovalForm, setShowApprovalForm] = useState(false);
  const [approvalAction, setApprovalAction] = useState<"APPROVED" | "REJECTED">("APPROVED");
  const [approvedAmount, setApprovedAmount] = useState("");
  const [note, setNote] = useState("");

  const { data: claim, isLoading } = useQuery({
    queryKey: ["claim", claimId],
    queryFn: () => api.get(`/api/v1/claims/${claimId}`).then((r) => r.data.data),
  });

  const { data: thresholdData } = useQuery({
    queryKey: ["claim-threshold"],
    queryFn: () => api.get("/api/v1/claims/threshold").then((r) => r.data.data),
  });
  const threshold = thresholdData?.threshold ?? 1000;

  const submitMutation = useMutation({
    mutationFn: () => api.patch(`/api/v1/claims/${claimId}/submit`),
    onSuccess: () => {
      toast.success("Claim submitted for approval");
      qc.invalidateQueries({ queryKey: ["my-claims"] });
      qc.invalidateQueries({ queryKey: ["claim", claimId] });
      qc.invalidateQueries({ queryKey: ["pending-claims"] });
      onClose();
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed to submit"),
  });

  const decisionMutation = useMutation({
    mutationFn: () => api.patch(`/api/v1/claims/${claimId}/decision`, {
      action: approvalAction,
      approvedAmount: approvalAction === "APPROVED" ? (parseFloat(approvedAmount) || undefined) : undefined,
      note: note || undefined,
    }),
    onSuccess: () => {
      toast.success(approvalAction === "APPROVED" ? "Claim approved" : "Claim rejected");
      qc.invalidateQueries({ queryKey: ["pending-claims"] });
      qc.invalidateQueries({ queryKey: ["claim", claimId] });
      qc.invalidateQueries({ queryKey: ["admin-all-claims"] });
      setShowApprovalForm(false);
      onClose();
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Decision failed"),
  });

  const payMutation = useMutation({
    mutationFn: () => api.patch(`/api/v1/claims/${claimId}/pay`),
    onSuccess: () => {
      toast.success("Claim marked as paid");
      qc.invalidateQueries({ queryKey: ["admin-all-claims"] });
      qc.invalidateQueries({ queryKey: ["claim", claimId] });
      onClose();
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });

  if (isLoading) {
    return (
      <Modal title="Claim Details" onClose={onClose} wide>
        <div className="space-y-3 animate-pulse">
          <div className="h-5 bg-gray-100 rounded w-1/2" />
          <div className="h-16 bg-gray-100 rounded" />
        </div>
      </Modal>
    );
  }
  if (!claim) return null;

  const isDraft = claim.status === "DRAFT";
  const isSubmitted = claim.status === "SUBMITTED";
  const isApproved = claim.status === "APPROVED";
  const needsReceipt = claim.claimedAmount > threshold && claim.receipts?.length === 0;
  const isOwnClaim = !claim?.employee;
  const canEdit = isDraft && (isOwnClaim || !isAdmin);

  function openApproval(action: "APPROVED" | "REJECTED") {
    setApprovalAction(action);
    setApprovedAmount(String(claim.claimedAmount));
    setNote("");
    setShowApprovalForm(true);
  }

  return (
    <Modal title={`Claim ${claim.claimNumber}`} onClose={onClose} wide>
      <div className="space-y-5">
        {/* Status + header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-semibold text-gray-900 text-lg">{claim.title}</p>
            <p className="text-sm text-gray-500 mt-0.5">{claim.claimType} · {formatDate(claim.createdAt)}</p>
          </div>
          <Badge status={claim.status} />
        </div>

        {/* Fields */}
        <div className="grid grid-cols-2 gap-4 rounded-xl bg-gray-50 border border-gray-100 p-4">
          <Field label="Claimed Amount" value={formatCurrency(claim.claimedAmount)} />
          {claim.approvedAmount != null && (
            <Field label="Approved Amount" value={formatCurrency(claim.approvedAmount)} />
          )}
          <Field label="Submitted By" value={claim.employee ? `${claim.employee.firstName} ${claim.employee.lastName}` : "You"} />
          {claim.approver && (
            <Field label="Approved / Rejected By" value={`${claim.approver.firstName} ${claim.approver.lastName}`} />
          )}
          {claim.approvedAt && <Field label="Approved On" value={formatDate(claim.approvedAt)} />}
          {claim.rejectedAt && <Field label="Rejected On" value={formatDate(claim.rejectedAt)} />}
          {claim.paidAt && <Field label="Paid On" value={formatDate(claim.paidAt)} />}
        </div>

        {claim.description && (
          <div className="text-sm text-gray-700 bg-blue-50 rounded-lg px-4 py-3 border border-blue-100">
            {claim.description}
          </div>
        )}

        {claim.rejectionNote && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3">
            <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-red-700 mb-0.5">Rejection Reason</p>
              <p className="text-sm text-red-700">{claim.rejectionNote}</p>
            </div>
          </div>
        )}

        {/* Receipts */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
              <Paperclip className="h-4 w-4" /> Supporting Documents
              <span className="text-xs font-normal text-gray-400">({claim.receipts?.length ?? 0} attached)</span>
            </p>
          </div>

          {claim.claimedAmount > threshold && (
            <div className={`flex items-center gap-1.5 text-xs mb-2 ${needsReceipt ? "text-orange-600" : "text-green-600"}`}>
              {needsReceipt
                ? <><AlertTriangle className="h-3.5 w-3.5" /> Receipt required for claims above {formatCurrency(threshold)}</>
                : <><CheckCircle className="h-3.5 w-3.5" /> Receipt attached ✓</>
              }
            </div>
          )}

          <div className="space-y-2">
            {claim.receipts?.map((r: any) => (
              <ReceiptCard
                key={r.id}
                receipt={r}
                claimId={claimId}
                canDelete={canEdit}
                onDeleted={() => qc.invalidateQueries({ queryKey: ["claim", claimId] })}
              />
            ))}
            {claim.receipts?.length === 0 && (
              <p className="text-xs text-gray-400 italic">No documents attached.</p>
            )}
          </div>

          {canEdit && (
            <div className="mt-2">
              <ReceiptUploader
                claimId={claimId}
                onUploaded={() => qc.invalidateQueries({ queryKey: ["claim", claimId] })}
              />
            </div>
          )}
        </div>

        {/* Approval form for admin */}
        {isAdmin && isSubmitted && showApprovalForm && (
          <div className={`rounded-xl border p-4 space-y-3 ${approvalAction === "APPROVED" ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
            <p className="text-sm font-semibold text-gray-800">
              {approvalAction === "APPROVED" ? "✓ Approve Claim" : "✗ Reject Claim"}
            </p>
            {approvalAction === "APPROVED" && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Approved Amount (₹)</label>
                <input
                  type="number"
                  value={approvedAmount}
                  onChange={(e) => setApprovedAmount(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-green-400 outline-none"
                  placeholder={String(claim.claimedAmount)}
                />
                <p className="text-xs text-gray-400 mt-0.5">Leave as-is to approve the full claimed amount.</p>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Note {approvalAction === "REJECTED" ? <span className="text-red-500">*</span> : "(optional)"}
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-blue-400 outline-none"
                placeholder={approvalAction === "REJECTED" ? "Reason for rejection…" : "Optional note for employee…"}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowApprovalForm(false)}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => decisionMutation.mutate()}
                disabled={decisionMutation.isPending || (approvalAction === "REJECTED" && !note.trim())}
                className={`px-4 py-1.5 text-xs font-semibold text-white rounded-lg disabled:opacity-50 ${
                  approvalAction === "APPROVED" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {decisionMutation.isPending ? "Saving…" : (approvalAction === "APPROVED" ? "Confirm Approval" : "Confirm Rejection")}
              </button>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 justify-end pt-1 border-t border-gray-100">
          {isDraft && (isOwnClaim || !isAdmin) && (
            <button
              type="button"
              onClick={() => submitMutation.mutate()}
              disabled={submitMutation.isPending || needsReceipt}
              title={needsReceipt ? `Attach a receipt first (required above ${formatCurrency(threshold)})` : undefined}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitMutation.isPending ? "Submitting…" : "Submit for Approval"}
            </button>
          )}
          {isAdmin && isSubmitted && !showApprovalForm && (
            <>
              <button
                type="button"
                onClick={() => openApproval("REJECTED")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
              >
                <XCircle className="h-4 w-4" /> Reject
              </button>
              <button
                type="button"
                onClick={() => openApproval("APPROVED")}
                className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
              >
                <CheckCircle className="h-4 w-4" /> Approve
              </button>
            </>
          )}
          {isAdmin && isApproved && (
            <button
              type="button"
              onClick={() => payMutation.mutate()}
              disabled={payMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
            >
              <Banknote className="h-4 w-4" /> {payMutation.isPending ? "Saving…" : "Mark as Paid"}
            </button>
          )}
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── New Claim Modal ──────────────────────────────────────────────────────────

function NewClaimModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const qc = useQueryClient();
  const { register, handleSubmit, watch, formState: { errors } } = useForm<ClaimForm>({
    resolver: zodResolver(claimSchema),
  });
  const amount = parseFloat(watch("claimedAmount") as any) || 0;

  const { data: thresholdData } = useQuery({
    queryKey: ["claim-threshold"],
    queryFn: () => api.get("/api/v1/claims/threshold").then((r) => r.data.data),
  });
  const threshold = thresholdData?.threshold ?? 1000;

  const createMutation = useMutation({
    mutationFn: (data: ClaimForm) => api.post("/api/v1/claims", { ...data, claimedAmount: Number(data.claimedAmount) }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["my-claims"] });
      toast.success("Draft created — attach your receipts now");
      onCreated(res.data.data.id);
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });

  return (
    <Modal title="New Claim" onClose={onClose}>
      <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Claim Type <span className="text-red-500">*</span></label>
          <select {...register("claimType")} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-400 outline-none">
            <option value="">Select type</option>
            {CLAIM_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>)}
          </select>
          {errors.claimType && <p className="text-xs text-red-500 mt-1">{errors.claimType.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Title <span className="text-red-500">*</span></label>
          <input {...register("title")} placeholder="Brief description" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 outline-none" />
          {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹) <span className="text-red-500">*</span></label>
          <input type="number" step="0.01" {...register("claimedAmount")} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 outline-none" />
          {errors.claimedAmount && <p className="text-xs text-red-500 mt-1">{errors.claimedAmount.message}</p>}
          {amount > threshold && (
            <p className="text-xs text-orange-600 mt-1 flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" />
              You'll need to attach a supporting receipt (required above {formatCurrency(threshold)})
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description <span className="text-gray-400 font-normal">(optional)</span></label>
          <textarea {...register("description")} rows={2} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-blue-400 outline-none" />
        </div>
        <div className="flex gap-2 justify-end pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
          <button type="submit" disabled={createMutation.isPending} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 font-semibold">
            {createMutation.isPending ? "Creating…" : "Create Draft"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Threshold setting pill (admin) ──────────────────────────────────────────

function ThresholdSetting() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");

  const { data } = useQuery({
    queryKey: ["claim-threshold"],
    queryFn: () => api.get("/api/v1/claims/threshold").then((r) => r.data.data),
  });

  const updateMutation = useMutation({
    mutationFn: () => api.patch("/api/v1/claims/threshold", { threshold: parseFloat(value) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["claim-threshold"] });
      toast.success("Threshold updated");
      setEditing(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });

  if (!editing) {
    return (
      <button
        onClick={() => { setValue(String(data?.threshold ?? 1000)); setEditing(true); }}
        className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors"
      >
        <Settings className="h-3.5 w-3.5" />
        Receipt required above {formatCurrency(data?.threshold ?? 1000)}
        <ChevronDown className="h-3 w-3" />
      </button>
    );
  }

  return (
    <div className="inline-flex items-center gap-2 border border-blue-200 rounded-lg px-3 py-1.5 bg-blue-50">
      <span className="text-xs text-blue-700 font-medium">Threshold ₹</span>
      <input
        type="number"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-24 text-xs rounded border border-blue-200 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
        onKeyDown={(e) => { if (e.key === "Enter") updateMutation.mutate(); if (e.key === "Escape") setEditing(false); }}
        autoFocus
      />
      <button
        onClick={() => updateMutation.mutate()}
        disabled={updateMutation.isPending}
        className="text-xs font-semibold text-white bg-blue-600 rounded px-2 py-1 hover:bg-blue-700 disabled:opacity-50"
      >Save</button>
      <button onClick={() => setEditing(false)} className="text-xs text-gray-500 hover:text-gray-700">✕</button>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ClaimsPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === "SUPER_ADMIN" || user?.role === "HR_ADMIN";
  const qc = useQueryClient();

  const [showNewClaim, setShowNewClaim] = useState(false);
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [adminTab, setAdminTab] = useState<"pending" | "all">("pending");

  function prefetchClaim(id: string) {
    qc.prefetchQuery({
      queryKey: ["claim", id],
      queryFn: () => api.get(`/api/v1/claims/${id}`).then((r) => r.data.data),
    });
  }

  const { data: myClaims } = useQuery({
    queryKey: ["my-claims"],
    queryFn: () => api.get("/api/v1/claims/my").then((r) => r.data.data),
  });

  const { data: pendingClaims } = useQuery({
    queryKey: ["pending-claims"],
    queryFn: () => api.get("/api/v1/claims/pending").then((r) => r.data.data),
    enabled: isAdmin,
  });

  const { data: allClaims } = useQuery({
    queryKey: ["admin-all-claims"],
    queryFn: () => api.get("/api/v1/claims/admin/all").then((r) => r.data.data),
    enabled: isAdmin && adminTab === "all",
  });

  function openClaim(id: string) {
    setShowNewClaim(false);
    setSelectedClaimId(id);
  }

  const pendingCount = pendingClaims?.length ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Reimbursement Claims</h1>
        <div className="flex items-center gap-3 flex-wrap">
          {isAdmin && <ThresholdSetting />}
          <button
            onClick={() => setShowNewClaim(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" /> New Claim
          </button>
        </div>
      </div>

      {/* Admin section */}
      {isAdmin && (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="flex items-center gap-1 px-5 py-0 border-b border-gray-100">
            {(["pending", "all"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setAdminTab(tab)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  adminTab === tab ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-800"
                }`}
              >
                {tab === "pending" ? (
                  <span className="flex items-center gap-1.5">
                    Pending Approvals
                    {pendingCount > 0 && (
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-orange-100 text-orange-700 text-xs font-bold">
                        {pendingCount}
                      </span>
                    )}
                  </span>
                ) : "All Claims"}
              </button>
            ))}
          </div>

          {adminTab === "pending" && (
            <div className="divide-y divide-gray-50">
              {!pendingClaims?.length ? (
                <p className="px-6 py-10 text-sm text-center text-gray-400">No claims pending approval.</p>
              ) : (
                pendingClaims.map((claim: any) => (
                  <div key={claim.id} onMouseEnter={() => prefetchClaim(claim.id)} className="px-5 py-4 flex items-center gap-4 hover:bg-gray-50">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-900">{claim.employee.firstName} {claim.employee.lastName}</span>
                        <span className="text-xs text-gray-400">{claim.employee.department?.name}</span>
                        <span className="text-xs font-mono text-gray-400">{claim.claimNumber}</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-0.5">{claim.title}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-gray-500">{claim.claimType}</span>
                        <span className="text-sm font-semibold text-gray-900">{formatCurrency(claim.claimedAmount)}</span>
                        <span className="text-xs text-gray-400">{formatDate(claim.createdAt)}</span>
                        {claim.receipts?.length > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs text-blue-600">
                            <Paperclip className="h-3 w-3" />{claim.receipts.length} doc{claim.receipts.length > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => openClaim(claim.id)}
                      className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                    >
                      Review →
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {adminTab === "all" && (
            <div>
              {!allClaims?.length ? (
                <p className="px-6 py-10 text-sm text-center text-gray-400">No claims found.</p>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase">
                      <th className="px-5 py-3">Employee</th>
                      <th className="px-5 py-3">Claim #</th>
                      <th className="px-5 py-3">Type</th>
                      <th className="px-5 py-3">Title</th>
                      <th className="px-5 py-3">Amount</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Date</th>
                      <th className="px-5 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {allClaims.map((claim: any) => (
                      <tr key={claim.id} onMouseEnter={() => prefetchClaim(claim.id)} className="hover:bg-gray-50">
                        <td className="px-5 py-3 text-sm">{claim.employee.firstName} {claim.employee.lastName}</td>
                        <td className="px-5 py-3 text-xs font-mono text-gray-400">{claim.claimNumber}</td>
                        <td className="px-5 py-3 text-xs text-gray-500">{claim.claimType}</td>
                        <td className="px-5 py-3 text-sm text-gray-800 max-w-xs truncate">{claim.title}</td>
                        <td className="px-5 py-3 text-sm font-semibold">{formatCurrency(claim.claimedAmount)}</td>
                        <td className="px-5 py-3"><Badge status={claim.status} /></td>
                        <td className="px-5 py-3 text-xs text-gray-400">{formatDate(claim.createdAt)}</td>
                        <td className="px-5 py-3">
                          <button onClick={() => openClaim(claim.id)} className="text-xs text-blue-600 hover:underline">View</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}

      {/* My Claims */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">My Claims</h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {["Claim #", "Type", "Title", "Amount", "Status", "Date", "Docs", "Action"].map((h) => (
                <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {!myClaims?.length ? (
              <tr><td colSpan={8} className="px-6 py-10 text-center text-sm text-gray-400">No claims yet. Click <strong>+ New Claim</strong> to get started.</td></tr>
            ) : (
              myClaims.map((claim: any) => (
                <tr key={claim.id} onMouseEnter={() => prefetchClaim(claim.id)} className="hover:bg-gray-50">
                  <td className="px-5 py-4 text-xs font-mono text-gray-400">{claim.claimNumber}</td>
                  <td className="px-5 py-4 text-xs text-gray-500">{claim.claimType}</td>
                  <td className="px-5 py-4 text-sm text-gray-800 max-w-xs truncate">{claim.title}</td>
                  <td className="px-5 py-4 text-sm font-semibold text-gray-900">{formatCurrency(claim.claimedAmount)}</td>
                  <td className="px-5 py-4"><Badge status={claim.status} /></td>
                  <td className="px-5 py-4 text-xs text-gray-400">{formatDate(claim.createdAt)}</td>
                  <td className="px-5 py-4">
                    {claim.receipts?.length > 0
                      ? <span className="inline-flex items-center gap-1 text-xs text-blue-600"><Paperclip className="h-3 w-3" />{claim.receipts.length}</span>
                      : <span className="text-xs text-gray-300">—</span>
                    }
                  </td>
                  <td className="px-5 py-4">
                    <button
                      onClick={() => openClaim(claim.id)}
                      className="text-xs text-blue-600 hover:underline font-medium"
                    >
                      {claim.status === "DRAFT" ? "Manage →" : "View →"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {showNewClaim && (
        <NewClaimModal
          onClose={() => setShowNewClaim(false)}
          onCreated={(id) => { setShowNewClaim(false); openClaim(id); }}
        />
      )}

      {selectedClaimId && (
        <ClaimDetailModal
          claimId={selectedClaimId}
          isAdmin={isAdmin}
          onClose={() => setSelectedClaimId(null)}
        />
      )}
    </div>
  );
}
