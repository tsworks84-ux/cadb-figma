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
  Plus, X, Upload, FileText, Eye, Trash2, CheckCircle, CheckCircle2,
  XCircle, Clock, Banknote, AlertTriangle, ChevronDown, Settings, Paperclip,
  Receipt, Calendar, IndianRupee, Tag, AlertCircle, Download,
  Users, ChevronRight,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface ClaimTypeConfig {
  id: string;
  name: string;
  label: string;
  requiresDocument: boolean;
  isSettleable: boolean;
  isActive: boolean;
}

const STATUS_COLOR: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  SUBMITTED: "bg-blue-100 text-blue-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  PAID: "bg-purple-100 text-purple-700",
  CANCELLED: "bg-gray-100 text-gray-400",
  CANCELLATION_PENDING: "bg-amber-100 text-amber-700",
};

const STATUS_ICON: Record<string, React.ElementType> = {
  DRAFT: Clock,
  SUBMITTED: Clock,
  APPROVED: CheckCircle,
  REJECTED: XCircle,
  PAID: Banknote,
  CANCELLED: XCircle,
  CANCELLATION_PENDING: Clock,
};

const STATUS_LABEL: Record<string, string> = {
  CANCELLATION_PENDING: "CANCELLATION PENDING",
};

function statusLabel(status: string) {
  return STATUS_LABEL[status] ?? status;
}

// ─── Schema ──────────────────────────────────────────────────────────────────

const claimSchema = z.object({
  claimType: z.string().min(1, "Select a type"),
  title: z.string().min(1, "Required"),
  description: z.string().optional(),
  claimedAmount: z.coerce.number().positive("Must be positive"),
});
type ClaimForm = z.infer<typeof claimSchema>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

function claimMonthKey(claim: any) {
  const d = new Date(claim.createdAt);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function currentMonthKeyFn() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getFYStart() {
  const now = new Date();
  const fyYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return new Date(fyYear, 3, 1);
}

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
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${STATUS_COLOR[status] ?? "bg-gray-100 text-gray-600"}`}>
      <Icon className="h-3 w-3 shrink-0" />
      {statusLabel(status)}
    </span>
  );
}

// ─── Reason prompt ────────────────────────────────────────────────────────────

/**
 * Confirm dialog that collects a written reason. Required for anything that
 * ends a claim: a withdrawal an approver has to rule on, or an admin override
 * whose only lasting trace is the audit log.
 */
function ReasonPromptModal({
  title, description, label, placeholder, confirmLabel, tone = "danger",
  required = true, isPending, onConfirm, onClose,
}: {
  title: string;
  description: string;
  label: string;
  placeholder: string;
  confirmLabel: string;
  tone?: "danger" | "warning";
  required?: boolean;
  isPending?: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const disabled = (required && !reason.trim()) || !!isPending;
  const accent = tone === "danger"
    ? { box: "border-red-200 bg-red-50", icon: "text-red-500", btn: "bg-red-600 hover:bg-red-700" }
    : { box: "border-amber-200 bg-amber-50", icon: "text-amber-500", btn: "bg-amber-600 hover:bg-amber-700" };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between px-5 sm:px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 shrink-0 ml-3">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-5 sm:px-6 py-5 space-y-4">
          <div className={`flex items-start gap-2.5 rounded-lg border px-4 py-3 ${accent.box}`}>
            <AlertTriangle className={`h-4 w-4 shrink-0 mt-0.5 ${accent.icon}`} />
            <p className="text-sm text-gray-700">{description}</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              {label} {required && <span className="text-red-500">*</span>}
            </label>
            <textarea
              rows={3}
              autoFocus
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={placeholder}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-5 sm:px-6 pb-5">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
            Keep it
          </button>
          <button
            onClick={() => onConfirm(reason.trim())}
            disabled={disabled}
            className={`px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50 ${accent.btn}`}
          >
            {isPending ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
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
      await api.post(`/api/v1/claims/${claimId}/receipts`, fd);
      onUploaded();
      toast.success("Receipt uploaded");
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? e.message ?? "Upload failed");
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
  const { user: currentUser } = useAuthStore();
  const [showApprovalForm, setShowApprovalForm] = useState(false);
  const [approvalAction, setApprovalAction] = useState<"APPROVED" | "REJECTED">("APPROVED");
  const [approvedAmount, setApprovedAmount] = useState("");
  const [note, setNote] = useState("");
  const [pendingAction, setPendingAction] = useState<"withdraw" | "admin-cancel" | "delete" | null>(null);

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

  const deleteMutation = useMutation({
    mutationFn: (reason?: string) => api.delete(`/api/v1/claims/${claimId}`, reason ? { data: { reason } } : undefined),
    onSuccess: () => {
      toast.success("Claim deleted — recorded in the deletion log");
      invalidateClaimLists();
      onClose();
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed to delete"),
  });

  // Employee withdrawal. A submitted claim drops out on the spot; an approved
  // one goes back to whoever approved it.
  const cancelMutation = useMutation({
    mutationFn: (reason: string) => api.patch(`/api/v1/claims/${claimId}/cancel`, { reason }),
    onSuccess: (res) => {
      toast.success(res.data?.message ?? "Claim cancelled");
      invalidateClaimLists();
      onClose();
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed to cancel"),
  });

  const adminCancelMutation = useMutation({
    mutationFn: (reason: string) => api.patch(`/api/v1/claims/${claimId}/admin-cancel`, { reason }),
    onSuccess: () => {
      toast.success("Claim cancelled");
      invalidateClaimLists();
      onClose();
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed to cancel"),
  });

  function invalidateClaimLists() {
    for (const key of ["my-claims", "pending-claims", "admin-all-claims", "claim-cancellation-requests", "audit-logs"]) {
      qc.invalidateQueries({ queryKey: [key] });
    }
    qc.invalidateQueries({ queryKey: ["claim", claimId] });
  }

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
  // `/claims/my` omits the employee join, so a claim with no employee is one of
  // the caller's own by definition.
  const isOwnClaim = !claim.employee || claim.employee.id === currentUser?.id;
  const canEdit = isDraft && isOwnClaim;
  // Approved withdrawals need the approver's sign-off; submitted ones don't.
  // Admins get the override buttons instead — no point offering both on their
  // own claim, since they'd be asking themselves for permission.
  const canWithdraw = isOwnClaim && !isAdmin && (isSubmitted || isApproved);
  const isApprovedWithdrawal = canWithdraw && isApproved;
  const canOverride = isAdmin && claim.status !== "CANCELLED";

  function openApproval(action: "APPROVED" | "REJECTED") {
    setApprovalAction(action);
    setApprovedAmount(String(claim.claimedAmount));
    setNote("");
    setShowApprovalForm(true);
  }

  const prompt = pendingAction === "withdraw"
    ? {
        title: isApprovedWithdrawal ? "Request cancellation" : "Cancel claim",
        description: isApprovedWithdrawal
          ? "This claim is already approved, so the approver has to sign off on cancelling it. It stays approved until they decide."
          : "This claim hasn't been reviewed yet, so it will be withdrawn straight away.",
        label: isApprovedWithdrawal ? "Why are you cancelling?" : "Reason (optional)",
        placeholder: isApprovedWithdrawal ? "e.g. Expense was refunded by the vendor" : "e.g. Submitted by mistake",
        confirmLabel: isApprovedWithdrawal ? "Send request" : "Cancel claim",
        tone: (isApprovedWithdrawal ? "warning" : "danger") as "warning" | "danger",
        required: isApprovedWithdrawal,
        isPending: cancelMutation.isPending,
        onConfirm: (reason: string) => cancelMutation.mutate(reason),
      }
    : pendingAction === "admin-cancel"
    ? {
        title: "Cancel this claim",
        description: "The claim will be voided at whatever stage it is in. The record stays visible to the employee.",
        label: "Reason",
        placeholder: "e.g. Duplicate of an earlier claim",
        confirmLabel: "Cancel claim",
        tone: "danger" as const,
        required: true,
        isPending: adminCancelMutation.isPending,
        onConfirm: (reason: string) => adminCancelMutation.mutate(reason),
      }
    : pendingAction === "delete"
    ? {
        title: "Delete this claim",
        description: isAdmin
          ? "The claim and its receipts will be erased for good. A full copy goes to the deletion log, which is the only trace that will remain — cancel instead if you just want to void it."
          : "This draft and its receipts will be erased for good.",
        label: "Reason",
        placeholder: isAdmin ? "e.g. Filed against the wrong employee" : "e.g. No longer needed",
        confirmLabel: "Delete permanently",
        tone: "danger" as const,
        required: isAdmin,
        isPending: deleteMutation.isPending,
        onConfirm: (reason: string) => deleteMutation.mutate(reason || undefined),
      }
    : null;

  return (
    <Modal title={`Claim ${claim.claimNumber}`} onClose={onClose} wide>
      {prompt && (
        <ReasonPromptModal
          {...prompt}
          onConfirm={(reason) => { prompt.onConfirm(reason); setPendingAction(null); }}
          onClose={() => setPendingAction(null)}
        />
      )}
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-semibold text-gray-900 text-lg">{claim.title}</p>
            <p className="text-sm text-gray-500 mt-0.5">{claim.claimType} · {formatDate(claim.createdAt)}</p>
          </div>
          <Badge status={claim.status} />
        </div>

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

        {/* Cancellation trail */}
        {claim.status === "CANCELLATION_PENDING" && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
            <Clock className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-amber-800 mb-0.5">Cancellation awaiting approval</p>
              <p className="text-sm text-amber-700">{claim.cancelReason}</p>
              <p className="text-xs text-amber-600 mt-1">The claim stays approved until the approver decides.</p>
            </div>
          </div>
        )}
        {claim.status === "CANCELLED" && claim.cancelReason && (
          <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3">
            <p className="text-xs font-semibold text-gray-600 mb-0.5">Cancellation Reason</p>
            <p className="text-sm text-gray-700">{claim.cancelReason}</p>
          </div>
        )}
        {claim.status === "APPROVED" && claim.cancelRejectionNote && (
          <div className="flex items-start gap-2 rounded-lg bg-orange-50 border border-orange-200 px-4 py-3">
            <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-orange-800 mb-0.5">Cancellation declined</p>
              <p className="text-sm text-orange-700">{claim.cancelRejectionNote}</p>
            </div>
          </div>
        )}

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

        <div className="flex flex-wrap gap-2 justify-end pt-1 border-t border-gray-100">
          {isDraft && isOwnClaim && !isAdmin && (
            <button
              type="button"
              onClick={() => setPendingAction("delete")}
              disabled={deleteMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50 mr-auto"
            >
              <Trash2 className="h-4 w-4" />
              {deleteMutation.isPending ? "Deleting…" : "Delete Draft"}
            </button>
          )}
          {/* Admin overrides — reach any claim at any stage. Deleting is logged. */}
          {canOverride && (
            <div className="flex flex-wrap gap-2 mr-auto">
              <button
                type="button"
                onClick={() => setPendingAction("admin-cancel")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100"
              >
                <XCircle className="h-4 w-4" /> Cancel Claim
              </button>
              <button
                type="button"
                onClick={() => setPendingAction("delete")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
              >
                <Trash2 className="h-4 w-4" /> Delete
              </button>
            </div>
          )}
          {canWithdraw && (
            <button
              type="button"
              onClick={() => setPendingAction("withdraw")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
            >
              {isApprovedWithdrawal ? "Request Cancellation" : "Cancel Claim"}
            </button>
          )}
          {isDraft && isOwnClaim && (
            <button
              type="button"
              onClick={() => submitMutation.mutate()}
              disabled={submitMutation.isPending || needsReceipt}
              title={needsReceipt ? `Attach a receipt first (required above ${formatCurrency(threshold)})` : undefined}
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
              style={{ backgroundColor: "#2C3E7C" }}
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

// ─── Claim Approval Modal (Team Claims review) ────────────────────────────────

function ClaimApprovalModal({ claimId, onClose }: { claimId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [decision, setDecision] = useState<"APPROVED" | "REJECTED" | null>(null);
  const [approvedAmount, setApprovedAmount] = useState("");
  const [notes, setNotes] = useState("");

  const { data: claim, isLoading } = useQuery({
    queryKey: ["claim", claimId],
    queryFn: () => api.get(`/api/v1/claims/${claimId}`).then((r) => r.data.data),
    enabled: !!claimId,
  });

  const decisionMutation = useMutation({
    mutationFn: () => api.patch(`/api/v1/claims/${claimId}/decision`, {
      action: decision,
      approvedAmount: decision === "APPROVED" ? (parseFloat(approvedAmount) || undefined) : undefined,
      note: notes.trim() || undefined,
    }),
    onSuccess: () => {
      toast.success(decision === "APPROVED" ? "Claim approved" : "Claim rejected");
      qc.invalidateQueries({ queryKey: ["pending-claims"] });
      qc.invalidateQueries({ queryKey: ["claim", claimId] });
      qc.invalidateQueries({ queryKey: ["admin-all-claims"] });
      onClose();
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Decision failed"),
  });

  if (isLoading || !claim) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl max-w-2xl w-full p-8 text-center text-gray-400">Loading…</div>
      </div>
    );
  }

  const empName = claim.employee
    ? `${claim.employee.firstName} ${claim.employee.lastName}`
    : "Employee";
  const initials = empName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
  const canSubmit = decision !== null && notes.trim().length > 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Review Claim</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Employee Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-white font-medium text-sm"
                style={{ backgroundColor: "#2C3E7C" }}
              >
                {initials}
              </div>
              <div>
                <p className="font-semibold text-gray-900">{empName}</p>
                <p className="text-sm text-gray-500">
                  {claim.employee?.department?.name ?? claim.claimNumber}
                </p>
              </div>
              <div className="ml-auto">
                <Badge status={claim.status} />
              </div>
            </div>
          </div>

          {/* Claim Details grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-1">Claim Type</p>
              <p className="text-sm font-medium text-gray-900">{claim.claimType}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-1">Amount Claimed</p>
              <p className="text-lg font-semibold text-gray-900">{formatCurrency(claim.claimedAmount)}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-1">Claim Title</p>
              <p className="text-sm font-medium text-gray-900">{claim.title}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-1">Submitted On</p>
              <p className="text-sm font-medium text-gray-900">{formatDate(claim.createdAt)}</p>
            </div>
          </div>

          {/* Description */}
          {claim.description && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <FileText size={16} />
                Description
              </label>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-sm text-gray-700">{claim.description}</p>
              </div>
            </div>
          )}

          {/* Approved amount override (when approving) */}
          {decision === "APPROVED" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Approved Amount (₹)
              </label>
              <input
                type="number"
                value={approvedAmount}
                onChange={(e) => setApprovedAmount(e.target.value)}
                placeholder={String(claim.claimedAmount)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-green-400 outline-none"
              />
              <p className="text-xs text-gray-400 mt-1">Leave blank to approve the full claimed amount.</p>
            </div>
          )}

          {/* Attachments */}
          {claim.receipts && claim.receipts.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Supporting Documents ({claim.receipts.length})
              </label>
              <div className="space-y-2">
                {claim.receipts.map((r: any) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText size={16} className="text-gray-400 shrink-0" />
                      <span className="text-sm text-gray-700 truncate">{r.fileName}</span>
                    </div>
                    <a
                      href={`${API_BASE}${r.fileUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 hover:bg-gray-200 rounded text-gray-600 shrink-0"
                    >
                      <Download size={16} />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Decision Buttons */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Your Decision</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setDecision("APPROVED")}
                className={`p-4 rounded-lg border-2 transition-all flex items-center gap-3 ${
                  decision === "APPROVED"
                    ? "border-green-500 bg-green-50"
                    : "border-gray-200 hover:border-green-300"
                }`}
              >
                <CheckCircle2
                  size={24}
                  className={decision === "APPROVED" ? "text-green-600" : "text-gray-400"}
                />
                <div className="text-left">
                  <p className={`text-sm font-medium ${decision === "APPROVED" ? "text-green-900" : "text-gray-700"}`}>
                    Approve
                  </p>
                  <p className="text-xs text-gray-500">Authorize reimbursement</p>
                </div>
              </button>

              <button
                onClick={() => setDecision("REJECTED")}
                className={`p-4 rounded-lg border-2 transition-all flex items-center gap-3 ${
                  decision === "REJECTED"
                    ? "border-red-500 bg-red-50"
                    : "border-gray-200 hover:border-red-300"
                }`}
              >
                <XCircle
                  size={24}
                  className={decision === "REJECTED" ? "text-red-600" : "text-gray-400"}
                />
                <div className="text-left">
                  <p className={`text-sm font-medium ${decision === "REJECTED" ? "text-red-900" : "text-gray-700"}`}>
                    Reject
                  </p>
                  <p className="text-xs text-gray-500">Decline claim</p>
                </div>
              </button>
            </div>
          </div>

          {/* Manager Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <FileText size={16} />
              Manager Notes <span className="text-red-600">*</span>
              <span className="text-xs text-gray-500 font-normal">(Required for record purposes)</span>
            </label>
            <textarea
              placeholder={
                decision === "APPROVED"
                  ? "Add notes for approval record (e.g., verified receipts, amount is reasonable)…"
                  : decision === "REJECTED"
                  ? "Please provide a clear reason for rejection…"
                  : "Make a decision above to add notes…"
              }
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              disabled={!decision}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 resize-none disabled:bg-gray-50 disabled:text-gray-400"
            />
          </div>

          {/* Contextual messages */}
          {decision === "APPROVED" && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-2">
              <CheckCircle2 className="text-green-600 shrink-0 mt-0.5" size={18} />
              <div>
                <p className="text-sm font-medium text-green-900">Claim will be processed for payment</p>
                <p className="text-xs text-green-700 mt-1">
                  The approved amount will be included in the next payroll cycle.
                </p>
              </div>
            </div>
          )}
          {decision === "REJECTED" && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-2">
              <AlertCircle className="text-red-600 shrink-0 mt-0.5" size={18} />
              <div>
                <p className="text-sm font-medium text-red-900">This action will notify the employee</p>
                <p className="text-xs text-red-700 mt-1">
                  Please provide a clear reason to help the employee understand your decision.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => decisionMutation.mutate()}
            disabled={!canSubmit || decisionMutation.isPending}
            className={`px-4 py-2 rounded-lg text-sm font-medium text-white disabled:bg-gray-300 disabled:cursor-not-allowed ${
              decision === "APPROVED"
                ? "bg-green-600 hover:bg-green-700"
                : decision === "REJECTED"
                ? "bg-red-600 hover:bg-red-700"
                : ""
            }`}
          >
            {decisionMutation.isPending
              ? "Saving…"
              : decision === "APPROVED"
              ? "Approve Claim"
              : decision === "REJECTED"
              ? "Reject Claim"
              : "Submit Decision"}
          </button>
        </div>
      </div>
    </div>
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
  const threshold = thresholdData?.threshold ?? 250;

  const { data: claimTypes = [] } = useQuery<ClaimTypeConfig[]>({
    queryKey: ["claim-types"],
    queryFn: () => api.get("/api/v1/claim-types").then((r) => r.data.data),
    staleTime: 5 * 60 * 1000,
  });

  const needsDoc = amount > threshold;

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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">New Claim</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit((d) => createMutation.mutate(d))}>
          <div className="p-6 space-y-5">
            {/* Claim Type */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Tag size={16} />
                Claim Type <span className="text-red-500">*</span>
              </label>
              <select
                {...register("claimType")}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 bg-white text-sm"
              >
                <option value="">Select claim type</option>
                {claimTypes.map((t) => (
                  <option key={t.name} value={t.name}>{t.label}</option>
                ))}
              </select>
              {errors.claimType && <p className="text-xs text-red-500 mt-1">{errors.claimType.message}</p>}
            </div>

            {/* Title */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <FileText size={16} />
                Title <span className="text-red-500">*</span>
              </label>
              <input
                {...register("title")}
                placeholder="Brief description of the expense"
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 text-sm"
              />
              {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title.message}</p>}
            </div>

            {/* Amount */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <IndianRupee size={16} />
                Amount (INR) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                {...register("claimedAmount")}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 text-sm"
              />
              {errors.claimedAmount && <p className="text-xs text-red-500 mt-1">{errors.claimedAmount.message}</p>}
            </div>

            {/* Description */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <FileText size={16} />
                Description
                <span className="text-xs text-gray-500 font-normal">(optional)</span>
              </label>
              <textarea
                {...register("description")}
                placeholder="Provide details about this expense (e.g., purpose, location, event)…"
                rows={3}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 resize-none text-sm"
              />
            </div>

            {/* Receipt Required Notice */}
            {needsDoc && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-start gap-2">
                <AlertCircle className="text-orange-600 shrink-0 mt-0.5" size={18} />
                <div>
                  <p className="text-sm font-medium text-orange-900">Receipt Required</p>
                  <p className="text-xs text-orange-700 mt-1">
                    Supporting documents are mandatory for claims above {formatCurrency(threshold)}. You'll be able to attach receipts after creating the draft.
                  </p>
                </div>
              </div>
            )}

            {/* Claim Summary Preview */}
            {amount > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Claim Summary</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Amount</span>
                    <span className="font-semibold text-gray-900">₹{amount.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Receipt needed</span>
                    <span className={`font-medium ${needsDoc ? "text-orange-600" : "text-green-600"}`}>
                      {needsDoc ? "Yes" : "No"}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: "#2C3E7C" }}
            >
              {createMutation.isPending ? "Creating…" : "Create Draft"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Month group (collapsible past months) ───────────────────────────────────

function MonthGroup({ monthKey, claims, onOpen, prefetch, showEmployee = false }: {
  monthKey: string;
  claims: any[];
  onOpen: (id: string) => void;
  prefetch: (id: string) => void;
  showEmployee?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const total    = claims.reduce((s, c) => s + c.claimedAmount, 0);
  const approved = claims
    .filter((c) => c.status === "APPROVED" || c.status === "PAID")
    .reduce((s, c) => s + (c.approvedAmount ?? c.claimedAmount), 0);

  return (
    <div className="border-t border-gray-100">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full px-6 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${open ? "" : "-rotate-90"}`} />
          <span className="text-sm font-semibold text-gray-700">{monthLabel(monthKey)}</span>
          <span className="text-xs text-gray-400">{claims.length} claim{claims.length !== 1 ? "s" : ""}</span>
        </div>
        <div className="flex items-center gap-4">
          {approved > 0 && (
            <span className="text-xs text-green-600 font-medium">{formatCurrency(approved)} approved</span>
          )}
          <span className="text-sm font-semibold text-gray-900">{formatCurrency(total)} claimed</span>
        </div>
      </button>
      {open && (
        <div className="border-t border-gray-100 overflow-x-auto">
          <table className="w-full">
            <tbody className="divide-y divide-gray-50">
              {claims.map((claim: any) => (
                <tr key={claim.id} onMouseEnter={() => prefetch(claim.id)} className="hover:bg-gray-50">
                  {showEmployee && (
                    <td className="px-5 py-3 text-sm font-medium text-gray-800">
                      {claim.employee?.firstName} {claim.employee?.lastName}
                    </td>
                  )}
                  <td className="px-5 py-4 text-xs font-mono text-gray-400 w-28">{claim.claimNumber}</td>
                  <td className="px-5 py-4 text-xs text-gray-500">{claim.claimType}</td>
                  <td className="px-5 py-4 text-sm text-gray-800 max-w-xs truncate">{claim.title}</td>
                  <td className="px-5 py-4 text-sm font-semibold text-gray-900">{formatCurrency(claim.claimedAmount)}</td>
                  <td className="px-5 py-4"><Badge status={claim.status} /></td>
                  <td className="px-5 py-4 text-xs text-gray-400">{formatDate(claim.createdAt)}</td>
                  {!showEmployee && (
                    <td className="px-5 py-4">
                      {claim.receipts?.length > 0
                        ? <span className="inline-flex items-center gap-1 text-xs text-blue-600"><Paperclip className="h-3 w-3" />{claim.receipts.length}</span>
                        : <span className="text-xs text-gray-300">—</span>}
                    </td>
                  )}
                  <td className="px-5 py-4">
                    <button onClick={() => onOpen(claim.id)} className="text-xs font-medium hover:underline" style={{ color: "#2C3E7C" }}>
                      View →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Cancellation requests (admin) ───────────────────────────────────────────

/**
 * Withdrawals of claims that were already approved. The decision here isn't
 * "is this expense valid" but "do I undo the approval I already gave", so it
 * lives apart from the normal pending queue.
 */
function CancellationRequestsPanel({ onOpen }: { onOpen: (id: string) => void }) {
  const qc = useQueryClient();
  const [deciding, setDeciding] = useState<{ claim: any; action: "APPROVED" | "REJECTED" } | null>(null);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["claim-cancellation-requests"],
    queryFn: () => api.get("/api/v1/claims/cancellation-requests").then((r) => r.data.data),
  });

  const decideMutation = useMutation({
    mutationFn: ({ id, action, note }: { id: string; action: string; note?: string }) =>
      api.patch(`/api/v1/claims/${id}/cancellation-decision`, { action, note }),
    onSuccess: (_d, vars) => {
      toast.success(vars.action === "APPROVED" ? "Claim cancelled" : "Cancellation declined");
      for (const key of ["claim-cancellation-requests", "admin-all-claims", "my-claims", "pending-claims"]) {
        qc.invalidateQueries({ queryKey: [key] });
      }
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Decision failed"),
  });

  if (isLoading) {
    return <p className="px-6 py-10 text-sm text-center text-gray-400">Loading…</p>;
  }
  if (!requests.length) {
    return <p className="px-6 py-10 text-sm text-center text-gray-400">No cancellation requests awaiting a decision.</p>;
  }

  return (
    <>
      {deciding && (
        <ReasonPromptModal
          title={deciding.action === "APPROVED" ? "Approve cancellation" : "Decline cancellation"}
          description={deciding.action === "APPROVED"
            ? `Claim ${deciding.claim.claimNumber} will be cancelled and will not be paid out.`
            : "The claim stays approved. The employee will see your note explaining why."}
          label={deciding.action === "APPROVED" ? "Note (optional)" : "Why are you declining?"}
          placeholder={deciding.action === "APPROVED" ? "e.g. Confirmed with finance" : "e.g. Already included in this month's payout run"}
          confirmLabel={deciding.action === "APPROVED" ? "Approve cancellation" : "Decline"}
          tone={deciding.action === "APPROVED" ? "warning" : "danger"}
          required={deciding.action === "REJECTED"}
          isPending={decideMutation.isPending}
          onConfirm={(note) => {
            decideMutation.mutate({ id: deciding.claim.id, action: deciding.action, note: note || undefined });
            setDeciding(null);
          }}
          onClose={() => setDeciding(null)}
        />
      )}

      <div className="divide-y divide-gray-50">
        {requests.map((claim: any) => (
          <div key={claim.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-start gap-4 hover:bg-gray-50">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-gray-900">
                  {claim.employee?.firstName} {claim.employee?.lastName}
                </span>
                <span className="text-xs text-gray-400">{claim.employee?.department?.name}</span>
                <button
                  onClick={() => onOpen(claim.id)}
                  className="text-xs font-mono text-gray-400 hover:underline"
                >
                  {claim.claimNumber}
                </button>
              </div>
              <p className="text-sm text-gray-600 mt-0.5">{claim.title}</p>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className="text-xs text-gray-500">{claim.claimType}</span>
                <span className="text-sm font-semibold text-gray-900">
                  {formatCurrency(claim.approvedAmount ?? claim.claimedAmount)}
                </span>
                <span className="text-xs text-gray-400">
                  Approved {claim.approvedAt ? formatDate(claim.approvedAt) : "—"}
                </span>
              </div>
              <div className="mt-2 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2">
                <p className="text-xs font-semibold text-amber-800 mb-0.5">Reason for cancelling</p>
                <p className="text-sm text-amber-700">{claim.cancelReason ?? "—"}</p>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => setDeciding({ claim, action: "REJECTED" })}
                className="flex-1 sm:flex-initial rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 whitespace-nowrap"
              >
                Decline
              </button>
              <button
                onClick={() => setDeciding({ claim, action: "APPROVED" })}
                className="flex-1 sm:flex-initial rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 whitespace-nowrap"
              >
                Approve
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
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
      <span className="text-xs font-medium" style={{ color: "#2C3E7C" }}>Threshold ₹</span>
      <input
        type="number"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-24 text-xs rounded border border-blue-200 px-2 py-1 focus:outline-none focus:ring-1"
        onKeyDown={(e) => { if (e.key === "Enter") updateMutation.mutate(); if (e.key === "Escape") setEditing(false); }}
        autoFocus
      />
      <button
        onClick={() => updateMutation.mutate()}
        disabled={updateMutation.isPending}
        className="text-xs font-semibold text-white rounded px-2 py-1 disabled:opacity-50"
        style={{ backgroundColor: "#2C3E7C" }}
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

  const [activeTab, setActiveTab] = useState<"my" | "team">("my");
  const [showNewClaim, setShowNewClaim] = useState(false);
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [reviewClaimId, setReviewClaimId] = useState<string | null>(null);
  const [teamSubTab, setTeamSubTab] = useState<"pending" | "cancellations" | "all">("pending");

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
    enabled: isAdmin && activeTab === "team" && teamSubTab === "all",
  });

  // Fetched alongside the pending count so the sub-tab can carry its own badge.
  const { data: cancellationRequests } = useQuery({
    queryKey: ["claim-cancellation-requests"],
    queryFn: () => api.get("/api/v1/claims/cancellation-requests").then((r) => r.data.data),
    enabled: isAdmin,
  });

  function openClaim(id: string) {
    setShowNewClaim(false);
    setReviewClaimId(null);
    setSelectedClaimId(id);
  }

  const pendingCount = pendingClaims?.length ?? 0;
  const cancellationCount = cancellationRequests?.length ?? 0;

  // Stats for My Claims
  const curKey  = currentMonthKeyFn();
  const fyStart = getFYStart();
  const allMy   = myClaims ?? [];
  const thisMonthList = allMy.filter((c: any) => claimMonthKey(c) === curKey);
  const fyList        = allMy.filter((c: any) => new Date(c.createdAt) >= fyStart);
  const pendingMyList = allMy.filter((c: any) => c.status === "SUBMITTED");
  const approvedList  = allMy.filter((c: any) => c.status === "APPROVED" || c.status === "PAID");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div
              className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
              style={{ backgroundColor: "#2C3E7C" }}
            >
              <Receipt className="text-white" size={18} />
            </div>
            <div>
              <p className="text-sm text-gray-500 uppercase tracking-wide">Finance</p>
              <h1 className="text-2xl font-semibold text-gray-900">Reimbursement Claims</h1>
            </div>
          </div>
          <p className="text-sm md:text-base text-gray-600 mt-1">
            Submit and track expense reimbursements
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap md:flex-nowrap">
          {isAdmin && <ThresholdSetting />}
          <button
            onClick={() => setShowNewClaim(true)}
            className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            style={{ backgroundColor: "#2C3E7C" }}
          >
            <Plus size={18} />
            New Claim
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab("my")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "my"
                ? "border-[#2C3E7C] text-[#2C3E7C]"
                : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            <IndianRupee size={16} />
            My Claims
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab("team")}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "team"
                  ? "border-[#2C3E7C] text-[#2C3E7C]"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              <Users size={16} />
              Team Claims
              {pendingCount > 0 && (
                <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1 rounded-full text-xs font-semibold text-white" style={{ backgroundColor: "#F2994A" }}>
                  {pendingCount}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* ── My Claims Tab ── */}
      {activeTab === "my" && (
        <div className="space-y-6">
          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-md flex items-center justify-center" style={{ backgroundColor: "#EEF1F8" }}>
                  <Calendar size={16} style={{ color: "#2C3E7C" }} />
                </div>
                <p className="text-xs text-gray-500 font-medium">This Month</p>
              </div>
              <p className="text-xl font-bold text-gray-900">
                {formatCurrency(thisMonthList.reduce((s: number, c: any) => s + c.claimedAmount, 0))}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">{thisMonthList.length} claim{thisMonthList.length !== 1 ? "s" : ""}</p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-md flex items-center justify-center" style={{ backgroundColor: "#EEF1F8" }}>
                  <Receipt size={16} style={{ color: "#2C3E7C" }} />
                </div>
                <p className="text-xs text-gray-500 font-medium">This FY</p>
              </div>
              <p className="text-xl font-bold text-gray-900">
                {formatCurrency(fyList.reduce((s: number, c: any) => s + c.claimedAmount, 0))}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">{fyList.length} claim{fyList.length !== 1 ? "s" : ""}</p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-md flex items-center justify-center bg-amber-50">
                  <Clock size={16} className="text-amber-600" />
                </div>
                <p className="text-xs text-gray-500 font-medium">Pending</p>
              </div>
              <p className="text-xl font-bold text-amber-600">{pendingMyList.length}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {pendingMyList.length > 0 ? formatCurrency(pendingMyList.reduce((s: number, c: any) => s + c.claimedAmount, 0)) : "No pending claims"}
              </p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-md flex items-center justify-center bg-green-50">
                  <CheckCircle2 size={16} className="text-green-600" />
                </div>
                <p className="text-xs text-gray-500 font-medium">Approved</p>
              </div>
              <p className="text-xl font-bold text-green-700">
                {formatCurrency(approvedList.reduce((s: number, c: any) => s + (c.approvedAmount ?? c.claimedAmount), 0))}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">{approvedList.length} claim{approvedList.length !== 1 ? "s" : ""}</p>
            </div>
          </div>

          {/* My Claims table */}
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">My Claims</h2>
            </div>

            {!myClaims?.length ? (
              <p className="px-6 py-10 text-center text-sm text-gray-400">
                No claims yet. Click <strong>+ New Claim</strong> to get started.
              </p>
            ) : (() => {
              const groups = new Map<string, any[]>();
              for (const claim of myClaims) {
                const key = claimMonthKey(claim);
                if (!groups.has(key)) groups.set(key, []);
                groups.get(key)!.push(claim);
              }
              const sortedKeys     = [...groups.keys()].sort((a, b) => b.localeCompare(a));
              const curMonthClaims = groups.get(curKey) ?? [];
              const pastKeys       = sortedKeys.filter((k) => k !== curKey);

              return (
                <>
                  {curMonthClaims.length > 0 && (
                    <div>
                      <div className="px-6 py-2.5 border-b flex items-center justify-between" style={{ backgroundColor: "#EEF1F8" }}>
                        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#2C3E7C" }}>
                          {monthLabel(curKey)} · Current
                        </span>
                        <span className="text-sm font-semibold" style={{ color: "#2C3E7C" }}>
                          {formatCurrency(curMonthClaims.reduce((s: number, c: any) => s + c.claimedAmount, 0))} claimed
                        </span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-gray-100 bg-gray-50">
                              {["Claim #", "Type", "Title", "Amount", "Status", "Date", "Docs", ""].map((h) => (
                                <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {curMonthClaims.map((claim: any) => (
                              <tr key={claim.id} onMouseEnter={() => prefetchClaim(claim.id)} className="hover:bg-gray-50">
                                <td className="px-5 py-4 text-xs font-mono text-gray-400">{claim.claimNumber}</td>
                                <td className="px-5 py-4 text-xs text-gray-500">{claim.claimType}</td>
                                <td className="px-5 py-4 text-sm text-gray-800 max-w-xs truncate">{claim.title}</td>
                                <td className="px-5 py-4 text-sm font-semibold text-gray-900">{formatCurrency(claim.claimedAmount)}</td>
                                <td className="px-5 py-4"><Badge status={claim.status} /></td>
                                <td className="px-5 py-4 text-xs text-gray-400">{formatDate(claim.createdAt)}</td>
                                <td className="px-5 py-4">
                                  {claim.receipts?.length > 0
                                    ? <span className="inline-flex items-center gap-1 text-xs" style={{ color: "#2C3E7C" }}><Paperclip className="h-3 w-3" />{claim.receipts.length}</span>
                                    : <span className="text-xs text-gray-300">—</span>}
                                </td>
                                <td className="px-5 py-4">
                                  <button onClick={() => openClaim(claim.id)} className="text-xs font-medium hover:underline" style={{ color: "#2C3E7C" }}>
                                    {claim.status === "DRAFT" ? "Manage →" : "View →"}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {pastKeys.map((key) => (
                    <MonthGroup
                      key={key}
                      monthKey={key}
                      claims={groups.get(key)!}
                      onOpen={openClaim}
                      prefetch={prefetchClaim}
                    />
                  ))}

                  {curMonthClaims.length === 0 && pastKeys.length === 0 && (
                    <p className="px-6 py-10 text-center text-sm text-gray-400">No claims this month.</p>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── Team Claims Tab ── */}
      {activeTab === "team" && isAdmin && (
        <div className="space-y-4">
          {/* Sub-tabs */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-1 px-5 py-0 border-b border-gray-100 overflow-x-auto">
              {(["pending", "cancellations", "all"] as const).map((tab) => {
                const badge = tab === "pending" ? pendingCount : tab === "cancellations" ? cancellationCount : 0;
                const label = tab === "pending" ? "Pending Approvals"
                  : tab === "cancellations" ? "Cancellations"
                  : "All Claims";
                return (
                  <button
                    key={tab}
                    onClick={() => setTeamSubTab(tab)}
                    className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                      teamSubTab === tab
                        ? "border-[#2C3E7C] text-[#2C3E7C]"
                        : "border-transparent text-gray-500 hover:text-gray-800"
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      {label}
                      {badge > 0 && (
                        <span className="inline-flex h-5 min-w-[20px] px-1 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: "#F2994A" }}>
                          {badge}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Pending sub-tab */}
            {teamSubTab === "pending" && (
              <div className="divide-y divide-gray-50">
                {!pendingClaims?.length ? (
                  <p className="px-6 py-10 text-sm text-center text-gray-400">No claims pending approval.</p>
                ) : (
                  pendingClaims.map((claim: any) => (
                    <div key={claim.id} onMouseEnter={() => prefetchClaim(claim.id)} className="px-5 py-4 flex items-center gap-4 hover:bg-gray-50">
                      {/* Employee avatar */}
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
                        style={{ backgroundColor: "#2C3E7C" }}
                      >
                        {`${claim.employee?.firstName?.[0] ?? ""}${claim.employee?.lastName?.[0] ?? ""}`.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-gray-900">
                            {claim.employee?.firstName} {claim.employee?.lastName}
                          </span>
                          <span className="text-xs text-gray-400">{claim.employee?.department?.name}</span>
                          <span className="text-xs font-mono text-gray-400">{claim.claimNumber}</span>
                        </div>
                        <p className="text-sm text-gray-600 mt-0.5">{claim.title}</p>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <span className="text-xs text-gray-500">{claim.claimType}</span>
                          <span className="text-sm font-semibold text-gray-900">{formatCurrency(claim.claimedAmount)}</span>
                          <span className="text-xs text-gray-400">{formatDate(claim.createdAt)}</span>
                          {claim.receipts?.length > 0 && (
                            <span className="inline-flex items-center gap-1 text-xs" style={{ color: "#2C3E7C" }}>
                              <Paperclip className="h-3 w-3" />{claim.receipts.length} doc{claim.receipts.length > 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => setReviewClaimId(claim.id)}
                        className="shrink-0 inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                        style={{ backgroundColor: "#2C3E7C" }}
                      >
                        Review <ChevronRight size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Cancellations sub-tab */}
            {teamSubTab === "cancellations" && <CancellationRequestsPanel onOpen={openClaim} />}

            {/* All Claims sub-tab */}
            {teamSubTab === "all" && (
              <div>
                {!allClaims?.length ? (
                  <p className="px-6 py-10 text-sm text-center text-gray-400">No claims found.</p>
                ) : (() => {
                  const groups = new Map<string, any[]>();
                  for (const claim of allClaims) {
                    const key = claimMonthKey(claim);
                    if (!groups.has(key)) groups.set(key, []);
                    groups.get(key)!.push(claim);
                  }
                  const sortedKeys     = [...groups.keys()].sort((a, b) => b.localeCompare(a));
                  const curMonthClaims = groups.get(curKey) ?? [];
                  const pastKeys       = sortedKeys.filter((k) => k !== curKey);

                  return (
                    <>
                      {curMonthClaims.length > 0 && (
                        <div>
                          <div className="px-6 py-2.5 border-b flex items-center justify-between" style={{ backgroundColor: "#EEF1F8" }}>
                            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#2C3E7C" }}>
                              {monthLabel(curKey)} · Current
                            </span>
                            <span className="text-sm font-semibold" style={{ color: "#2C3E7C" }}>
                              {formatCurrency(curMonthClaims.reduce((s: number, c: any) => s + c.claimedAmount, 0))} claimed
                            </span>
                          </div>
                          <div className="overflow-x-auto">
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
                                {curMonthClaims.map((claim: any) => (
                                  <tr key={claim.id} onMouseEnter={() => prefetchClaim(claim.id)} className="hover:bg-gray-50">
                                    <td className="px-5 py-3 text-sm font-medium text-gray-800">{claim.employee?.firstName} {claim.employee?.lastName}</td>
                                    <td className="px-5 py-3 text-xs font-mono text-gray-400">{claim.claimNumber}</td>
                                    <td className="px-5 py-3 text-xs text-gray-500">{claim.claimType}</td>
                                    <td className="px-5 py-3 text-sm text-gray-800 max-w-xs truncate">{claim.title}</td>
                                    <td className="px-5 py-3 text-sm font-semibold">{formatCurrency(claim.claimedAmount)}</td>
                                    <td className="px-5 py-3"><Badge status={claim.status} /></td>
                                    <td className="px-5 py-3 text-xs text-gray-400">{formatDate(claim.createdAt)}</td>
                                    <td className="px-5 py-3">
                                      <button onClick={() => openClaim(claim.id)} className="text-xs font-medium hover:underline" style={{ color: "#2C3E7C" }}>View</button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {pastKeys.map((key) => (
                        <MonthGroup
                          key={key}
                          monthKey={key}
                          claims={groups.get(key)!}
                          onOpen={openClaim}
                          prefetch={prefetchClaim}
                          showEmployee
                        />
                      ))}
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      )}

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

      {reviewClaimId && (
        <ClaimApprovalModal
          claimId={reviewClaimId}
          onClose={() => setReviewClaimId(null)}
        />
      )}
    </div>
  );
}
