"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle, Ban, Building2, CheckCircle2, Clock, FileText, IndianRupee, Paperclip, Trash2, Upload, X, XCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import {
  BTN_DANGER, BTN_PRIMARY, BTN_SECONDARY, FIELD, Modal, SelectField, errorText, formatBytes,
} from "@/components/resources/shared";

export { BTN_DANGER, BTN_PRIMARY, BTN_SECONDARY, FIELD, Modal, SelectField, errorText };

// ── Types ────────────────────────────────────────────────────────────────────

type Flags = { view: boolean; create: boolean; edit: boolean; delete: boolean; approve: boolean };
export type VendorAccess = {
  vendors: Flags;
  payments: Flags;
  canBrowseVendors: boolean;
  seesAllPayments: boolean;
  seesBankDetails: boolean;
  isSuperAdmin: boolean;
};
export type VendorMeta = {
  categories: string[];
  docTypes: Record<string, string>;
  onboardingDocTypes: string[];
  paymentDocTypes: string[];
  access: VendorAccess;
};

export type VendorStatus = "PENDING_APPROVAL" | "ACTIVE" | "REJECTED" | "INACTIVE";
export type PaymentStatus = "PENDING_APPROVAL" | "APPROVED" | "PARTIALLY_PAID" | "PAID" | "REJECTED" | "CANCELLED";
export type Person = { id: string; firstName: string; lastName: string; employeeCode: string };

export type VendorDoc = {
  id: string; docType: string; fileName: string; mimeType: string; sizeBytes: number;
  createdAt: string; uploadedBy?: Person;
};

export type Vendor = {
  id: string; vendorCode: string; legalName: string; tradeName: string | null; category: string;
  contactPerson: string | null; phone: string | null; email: string | null; address: string | null;
  city: string | null; state: string | null; pincode: string | null; gstin: string | null; pan: string | null;
  udyamNumber: string | null; paymentTermsDays: number | null;
  bankAccountName: string | null; bankAccountNumber: string | null; bankIfsc: string | null;
  bankName: string | null; bankBranch: string | null; upiId: string | null;
  notes: string | null; status: VendorStatus; statusNote: string | null;
  createdAt: string; reviewedAt: string | null;
};

export type PaymentTxn = {
  id: string; amount: number; tdsAmount: number; mode: string; transactionRef: string | null;
  paymentDate: string; remarks: string | null; createdAt: string; recordedBy: Person;
};

export type PaymentRow = {
  id: string; paymentNumber: string; invoiceNumber: string | null; invoiceDate: string | null; dueDate: string | null;
  description: string; amount: number; paidAmount: number; tdsAmount: number; balance: number;
  status: PaymentStatus; createdAt: string; decidedAt: string | null; paidAt: string | null;
  vendor: { id: string; vendorCode: string; legalName: string; tradeName: string | null; status: VendorStatus };
  requestedBy: Person; approver: Person | null; department: { id: string; name: string } | null;
  _count: { transactions: number; documents: number };
};

// ── Formatting ───────────────────────────────────────────────────────────────

const inrFmt = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
export const inr = (n: number | null | undefined) => (n == null ? "—" : inrFmt.format(n));
export const personName = (p?: Person | null) => (p ? `${p.firstName} ${p.lastName}`.trim() : "—");
export function fmtDay(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: iso.length <= 10 || iso.endsWith("T00:00:00.000Z") ? "UTC" : undefined });
}
export const todayISO = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

export const PAYMENT_MODES = [
  { value: "NEFT", label: "NEFT" }, { value: "RTGS", label: "RTGS" }, { value: "IMPS", label: "IMPS" },
  { value: "UPI", label: "UPI" }, { value: "CHEQUE", label: "Cheque" }, { value: "DD", label: "Demand draft" },
  { value: "CASH", label: "Cash" }, { value: "CARD", label: "Card" }, { value: "OTHER", label: "Other" },
];
export const modeLabel = (m: string) => PAYMENT_MODES.find((x) => x.value === m)?.label ?? m;

// ── Data ─────────────────────────────────────────────────────────────────────

export function useVendorMeta() {
  return useQuery<VendorMeta>({
    queryKey: ["vendor-meta"],
    queryFn: () => api.get("/api/v1/vendors/meta").then((r) => r.data.data),
    staleTime: 60 * 1000,
  });
}

/** Every key a vendor or payment change can make stale. */
export function invalidateVendors(qc: ReturnType<typeof useQueryClient>) {
  for (const key of ["vendors", "vendor", "vendor-lookup", "vendor-payments", "vendor-payment", "vendor-payment-summary"]) {
    qc.invalidateQueries({ queryKey: [key] });
  }
}

/** Opens an authenticated file in a new tab (a bare href would carry no token). */
export async function openVendorDoc(doc: { id: string; fileName: string }) {
  const tab = window.open("", "_blank");
  try {
    const res = await api.get(`/api/v1/vendors/documents/${doc.id}/file`, { responseType: "blob" });
    const url = URL.createObjectURL(res.data);
    if (tab) tab.location.href = url;
    else {
      const a = document.createElement("a");
      a.href = url; a.download = doc.fileName; a.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (e: any) {
    tab?.close();
    let msg = "Could not open the file";
    try { msg = JSON.parse(await e?.response?.data?.text()).error ?? msg; } catch { /* not JSON */ }
    toast.error(msg);
  }
}

// ── Badges ───────────────────────────────────────────────────────────────────

const VENDOR_STATUS: Record<VendorStatus, { label: string; cls: string }> = {
  PENDING_APPROVAL: { label: "Pending approval", cls: "bg-amber-100 text-amber-800" },
  ACTIVE: { label: "Active", cls: "bg-emerald-100 text-emerald-800" },
  REJECTED: { label: "Rejected", cls: "bg-red-100 text-red-700" },
  INACTIVE: { label: "Inactive", cls: "bg-gray-100 text-gray-600" },
};
export function VendorStatusBadge({ status }: { status: VendorStatus }) {
  const s = VENDOR_STATUS[status];
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>;
}

export const PAYMENT_STATUS: Record<PaymentStatus, { label: string; cls: string; Icon: React.ElementType }> = {
  PENDING_APPROVAL: { label: "Awaiting approval", cls: "bg-amber-100 text-amber-800", Icon: Clock },
  APPROVED: { label: "Cleared for payment", cls: "bg-sky-100 text-sky-800", Icon: CheckCircle2 },
  PARTIALLY_PAID: { label: "Part paid", cls: "bg-indigo-100 text-indigo-800", Icon: IndianRupee },
  PAID: { label: "Paid", cls: "bg-emerald-100 text-emerald-800", Icon: CheckCircle2 },
  REJECTED: { label: "Rejected", cls: "bg-red-100 text-red-700", Icon: XCircle },
  CANCELLED: { label: "Cancelled", cls: "bg-gray-100 text-gray-600", Icon: Ban },
};
export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const s = PAYMENT_STATUS[status];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>
      <s.Icon className="h-3 w-3" /> {s.label}
    </span>
  );
}

// ── Section nav (Vendors | Payments) ─────────────────────────────────────────

export function VendorsNav({ access }: { access?: VendorAccess }) {
  const pathname = usePathname();
  const tabs = [
    ...(access?.canBrowseVendors ? [{ href: "/dashboard/vendors", label: "Vendors" }] : []),
    ...(access && (access.payments.create || access.seesAllPayments) ? [{ href: "/dashboard/vendors/payments", label: "Payments" }] : []),
  ];
  if (tabs.length < 2) return null;
  return (
    <div className="flex gap-1 border-b border-gray-200">
      {tabs.map((t) => {
        const active = t.href === "/dashboard/vendors"
          ? pathname === t.href || (pathname.startsWith("/dashboard/vendors/") && !pathname.startsWith("/dashboard/vendors/payments"))
          : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              active ? "border-[#2C3E7C] text-[#2C3E7C]" : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}

// ── Small form bits ──────────────────────────────────────────────────────────

export function Field({ label, required, hint, children, className = "" }: {
  label: string; required?: boolean; hint?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1 block text-xs font-medium text-gray-600">
        {label}{required && <span className="text-red-500"> *</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-3 mt-1 text-xs font-semibold uppercase tracking-wide text-gray-400">{children}</h3>;
}

/** Ask for a free-text reason; resolves through `onSubmit`. */
export function ReasonModal({ title, label, cta, danger, required = true, pending, onSubmit, onClose }: {
  title: string; label: string; cta: string; danger?: boolean; required?: boolean; pending?: boolean;
  onSubmit: (text: string) => void; onClose: () => void;
}) {
  const [text, setText] = useState("");
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className={BTN_SECONDARY}>Back</button>
          <button
            onClick={() => onSubmit(text.trim())}
            disabled={pending || (required && !text.trim())}
            className={danger ? BTN_DANGER : BTN_PRIMARY}
          >
            {pending ? "Working…" : cta}
          </button>
        </>
      }
    >
      <Field label={label} required={required}>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={1000} autoFocus className={FIELD} />
      </Field>
    </Modal>
  );
}

// ── Vendor form ──────────────────────────────────────────────────────────────

const EMPTY_VENDOR = {
  legalName: "", tradeName: "", category: "", contactPerson: "", phone: "", email: "", address: "", city: "",
  state: "", pincode: "", gstin: "", pan: "", udyamNumber: "", paymentTermsDays: "",
  bankAccountName: "", bankAccountNumber: "", bankIfsc: "", bankName: "", bankBranch: "", upiId: "", notes: "",
};
type VendorDraft = typeof EMPTY_VENDOR;

export function VendorFormModal({ meta, vendor, onClose, onSaved }: {
  meta: VendorMeta; vendor?: Vendor; onClose: () => void; onSaved?: (id: string) => void;
}) {
  const qc = useQueryClient();
  const [d, setD] = useState<VendorDraft>(() => {
    if (!vendor) return EMPTY_VENDOR;
    const out = { ...EMPTY_VENDOR };
    for (const k of Object.keys(EMPTY_VENDOR) as (keyof VendorDraft)[]) {
      const v = (vendor as any)[k];
      out[k] = v == null ? "" : String(v);
    }
    return out;
  });
  const set = (k: keyof VendorDraft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setD((p) => ({ ...p, [k]: e.target.value }));
  const original = useRef(d);
  const bankTouched = vendor && (vendor.status === "ACTIVE" || vendor.status === "INACTIVE")
    && (["bankAccountName", "bankAccountNumber", "bankIfsc", "bankName", "bankBranch", "upiId"] as const)
      .some((k) => d[k] !== original.current[k]);

  const save = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(d)) body[k] = v.trim() === "" ? null : v.trim();
      body.legalName = d.legalName.trim();
      body.category = d.category;
      return vendor
        ? api.patch(`/api/v1/vendors/${vendor.id}`, body)
        : api.post("/api/v1/vendors", body);
    },
    onSuccess: (res) => {
      toast.success(res.data.message ?? (vendor ? "Vendor updated" : "Vendor registered — sent for approval"));
      invalidateVendors(qc);
      onSaved?.(res.data.data.id);
      onClose();
    },
    onError: (e) => toast.error(errorText(e, "Could not save the vendor")),
  });

  const grid = "grid grid-cols-1 gap-3 sm:grid-cols-2";
  return (
    <Modal
      wide
      title={vendor ? `Edit ${vendor.legalName}` : "Register a vendor"}
      subtitle={vendor ? vendor.vendorCode : "The vendor can be paid once an approver signs off"}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className={BTN_SECONDARY}>Cancel</button>
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending || !d.legalName.trim() || !d.category}
            className={BTN_PRIMARY}
          >
            {save.isPending ? "Saving…" : vendor ? "Save changes" : "Register vendor"}
          </button>
        </>
      }
    >
      <div className="space-y-6">
        <section>
          <SectionTitle>Business</SectionTitle>
          <div className={grid}>
            <Field label="Legal name" required><input value={d.legalName} onChange={set("legalName")} maxLength={200} className={FIELD} autoFocus /></Field>
            <Field label="Trade name"><input value={d.tradeName} onChange={set("tradeName")} maxLength={200} className={FIELD} placeholder="If different" /></Field>
            <Field label="Category" required>
              <SelectField value={d.category} onChange={(v) => setD((p) => ({ ...p, category: v }))} placeholder="Select…" options={meta.categories.map((c) => ({ value: c, label: c }))} />
            </Field>
            <Field label="Payment terms (days)" hint="e.g. 30 for net-30">
              <input value={d.paymentTermsDays} onChange={set("paymentTermsDays")} inputMode="numeric" className={FIELD} />
            </Field>
            <Field label="GSTIN"><input value={d.gstin} onChange={set("gstin")} maxLength={15} className={`${FIELD} uppercase`} placeholder="29ABCDE1234F1Z5" /></Field>
            <Field label="PAN"><input value={d.pan} onChange={set("pan")} maxLength={10} className={`${FIELD} uppercase`} placeholder="ABCDE1234F" /></Field>
            <Field label="MSME / Udyam no."><input value={d.udyamNumber} onChange={set("udyamNumber")} maxLength={40} className={FIELD} placeholder="UDYAM-KR-00-0000000" /></Field>
          </div>
        </section>
        <section>
          <SectionTitle>Contact</SectionTitle>
          <div className={grid}>
            <Field label="Contact person"><input value={d.contactPerson} onChange={set("contactPerson")} maxLength={120} className={FIELD} /></Field>
            <Field label="Phone"><input value={d.phone} onChange={set("phone")} inputMode="tel" maxLength={20} className={FIELD} /></Field>
            <Field label="Email"><input value={d.email} onChange={set("email")} type="email" maxLength={200} className={FIELD} /></Field>
            <Field label="Address" className="sm:col-span-2"><textarea value={d.address} onChange={set("address")} rows={2} maxLength={500} className={FIELD} /></Field>
            <Field label="City"><input value={d.city} onChange={set("city")} maxLength={100} className={FIELD} /></Field>
            <Field label="State"><input value={d.state} onChange={set("state")} maxLength={100} className={FIELD} /></Field>
            <Field label="PIN code"><input value={d.pincode} onChange={set("pincode")} inputMode="numeric" maxLength={6} className={FIELD} /></Field>
          </div>
        </section>
        <section>
          <SectionTitle>Bank details</SectionTitle>
          {bankTouched && (
            <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Changing bank details sends this vendor back for approval. No payment can be approved or recorded until someone else signs off.
            </div>
          )}
          <div className={grid}>
            <Field label="Account holder name"><input value={d.bankAccountName} onChange={set("bankAccountName")} maxLength={200} className={FIELD} /></Field>
            <Field label="Account number"><input value={d.bankAccountNumber} onChange={set("bankAccountNumber")} inputMode="numeric" maxLength={20} className={FIELD} /></Field>
            <Field label="IFSC"><input value={d.bankIfsc} onChange={set("bankIfsc")} maxLength={11} className={`${FIELD} uppercase`} placeholder="HDFC0001234" /></Field>
            <Field label="Bank name"><input value={d.bankName} onChange={set("bankName")} maxLength={120} className={FIELD} /></Field>
            <Field label="Branch"><input value={d.bankBranch} onChange={set("bankBranch")} maxLength={120} className={FIELD} /></Field>
            <Field label="UPI ID"><input value={d.upiId} onChange={set("upiId")} maxLength={100} className={FIELD} placeholder="name@bank" /></Field>
          </div>
        </section>
        <section>
          <SectionTitle>Notes</SectionTitle>
          <textarea value={d.notes} onChange={set("notes")} rows={2} maxLength={2000} className={FIELD} placeholder="Anything the approver or Accounts should know" />
        </section>
        {!vendor && (
          <p className="text-xs text-gray-500">You can attach the GST certificate, PAN card and a cancelled cheque from the vendor&apos;s page after registering.</p>
        )}
      </div>
    </Modal>
  );
}

// ── Documents ────────────────────────────────────────────────────────────────

export function DocumentList({ docs, docTypes, uploadTypes, uploadUrl, canUpload, canDelete, emptyText }: {
  docs: VendorDoc[];
  docTypes: Record<string, string>;
  uploadTypes: string[];
  uploadUrl: string;
  canUpload: boolean;
  canDelete: boolean;
  emptyText: string;
}) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState(uploadTypes[0] ?? "OTHER");

  const upload = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append("docType", docType);
      fd.append("file", file);
      return api.post(uploadUrl, fd);
    },
    onSuccess: () => { toast.success("Document attached"); invalidateVendors(qc); },
    onError: (e) => toast.error(errorText(e, "Upload failed")),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/vendors/documents/${id}`),
    onSuccess: () => { toast.success("Document removed"); invalidateVendors(qc); },
    onError: (e) => toast.error(errorText(e, "Could not remove the document")),
  });

  return (
    <div>
      {docs.length === 0 ? (
        <p className="py-2 text-sm text-gray-400">{emptyText}</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {docs.map((doc) => (
            <li key={doc.id} className="flex items-center gap-3 py-2">
              <FileText className="h-4 w-4 shrink-0 text-gray-400" />
              <button onClick={() => openVendorDoc(doc)} className="min-w-0 flex-1 text-left">
                <span className="block truncate text-sm font-medium text-gray-800 hover:text-[#2C3E7C] hover:underline">{doc.fileName}</span>
                <span className="block truncate text-xs text-gray-400">
                  {docTypes[doc.docType] ?? doc.docType} · {formatBytes(doc.sizeBytes)} · {fmtDay(doc.createdAt)}
                </span>
              </button>
              {canDelete && (
                <button
                  onClick={() => { if (confirm(`Remove ${doc.fileName}?`)) remove.mutate(doc.id); }}
                  className="rounded-md p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 active:bg-red-100"
                  aria-label={`Remove ${doc.fileName}`}
                >
                  <Trash2 size={15} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canUpload && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <SelectField
            value={docType}
            onChange={setDocType}
            options={uploadTypes.map((t) => ({ value: t, label: docTypes[t] ?? t }))}
            className="min-w-[12rem] flex-1"
          />
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload.mutate(f);
              e.target.value = "";
            }}
          />
          <button onClick={() => fileRef.current?.click()} disabled={upload.isPending} className={`${BTN_SECONDARY} shrink-0 whitespace-nowrap`}>
            <Upload size={15} /> {upload.isPending ? "Uploading…" : "Attach file"}
          </button>
          <span className="w-full text-xs text-gray-400">PDF or image, up to 10 MB</span>
        </div>
      )}
    </div>
  );
}

// ── Payment request form ─────────────────────────────────────────────────────

type LookupVendor = { id: string; vendorCode: string; legalName: string; tradeName: string | null; paymentTermsDays: number | null };

export function PaymentRequestModal({ defaultVendorId, onClose, onCreated }: {
  defaultVendorId?: string; onClose: () => void; onCreated?: (id: string) => void;
}) {
  const qc = useQueryClient();
  const { data: vendors = [], isLoading } = useQuery<LookupVendor[]>({
    queryKey: ["vendor-lookup"],
    queryFn: () => api.get("/api/v1/vendors/lookup").then((r) => r.data.data),
  });
  const { data: departments = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["departments"],
    queryFn: () => api.get("/api/v1/departments").then((r) => r.data.data),
    staleTime: 5 * 60 * 1000,
  });
  const [d, setD] = useState({
    vendorId: defaultVendorId ?? "", invoiceNumber: "", invoiceDate: "", dueDate: "", amount: "", description: "", departmentId: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const set = (k: keyof typeof d) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setD((p) => ({ ...p, [k]: e.target.value }));

  // Suggest a due date from the vendor's payment terms once an invoice date is known.
  const vendor = vendors.find((v) => v.id === d.vendorId);
  useEffect(() => {
    if (!d.invoiceDate || d.dueDate || vendor?.paymentTermsDays == null) return;
    const due = new Date(`${d.invoiceDate}T00:00:00Z`);
    due.setUTCDate(due.getUTCDate() + vendor.paymentTermsDays);
    setD((p) => ({ ...p, dueDate: due.toISOString().slice(0, 10) }));
  }, [d.invoiceDate, vendor?.paymentTermsDays]); // eslint-disable-line react-hooks/exhaustive-deps

  const create = useMutation({
    mutationFn: async () => {
      const res = await api.post("/api/v1/vendor-payments", {
        ...d, amount: Number(d.amount), departmentId: d.departmentId || null,
      });
      const id = res.data.data.id as string;
      if (file) {
        const fd = new FormData();
        fd.append("docType", "INVOICE");
        fd.append("file", file);
        try { await api.post(`/api/v1/vendor-payments/${id}/documents`, fd); }
        catch (e) { toast.error(errorText(e, "Request raised, but the invoice did not upload — attach it from the request")); }
      }
      return res;
    },
    onSuccess: (res) => {
      toast.success(`${res.data.data.paymentNumber} raised — sent for approval`);
      invalidateVendors(qc);
      onCreated?.(res.data.data.id);
      onClose();
    },
    onError: (e) => toast.error(errorText(e, "Could not raise the request")),
  });

  const amount = Number(d.amount);
  const valid = d.vendorId && d.description.trim().length >= 3 && amount > 0;
  return (
    <Modal
      title="New payment request"
      subtitle="Goes to the approving authority, then to Accounts for payment"
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className={BTN_SECONDARY}>Cancel</button>
          <button onClick={() => create.mutate()} disabled={!valid || create.isPending} className={BTN_PRIMARY}>
            {create.isPending ? "Raising…" : "Raise request"}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Vendor" required className="sm:col-span-2">
          <SelectField
            value={d.vendorId}
            onChange={(v) => setD((p) => ({ ...p, vendorId: v }))}
            placeholder={isLoading ? "Loading…" : vendors.length ? "Select an approved vendor…" : "No approved vendors yet"}
            options={vendors.map((v) => ({ value: v.id, label: `${v.legalName}${v.tradeName ? ` (${v.tradeName})` : ""} · ${v.vendorCode}` }))}
          />
        </Field>
        <Field label="Invoice number"><input value={d.invoiceNumber} onChange={set("invoiceNumber")} maxLength={60} className={FIELD} /></Field>
        <Field label="Amount (₹)" required>
          <input value={d.amount} onChange={set("amount")} inputMode="decimal" className={FIELD} placeholder="0.00" />
        </Field>
        <Field label="Invoice date"><input type="date" value={d.invoiceDate} max={todayISO()} onChange={set("invoiceDate")} className={FIELD} /></Field>
        <Field label="Due date" hint={vendor?.paymentTermsDays != null ? `Vendor terms: ${vendor.paymentTermsDays} days` : undefined}>
          <input type="date" value={d.dueDate} onChange={set("dueDate")} className={FIELD} />
        </Field>
        <Field label="Department / cost centre" className="sm:col-span-2">
          <SelectField
            value={d.departmentId}
            onChange={(v) => setD((p) => ({ ...p, departmentId: v }))}
            placeholder="None"
            options={departments.map((x) => ({ value: x.id, label: x.name }))}
          />
        </Field>
        <Field label="Purpose" required className="sm:col-span-2">
          <textarea value={d.description} onChange={set("description")} rows={3} maxLength={1000} className={FIELD} placeholder="What is being paid for" />
        </Field>
        <Field label="Invoice copy" className="sm:col-span-2">
          <label className={`${BTN_SECONDARY} w-full cursor-pointer justify-start truncate`}>
            <Paperclip size={15} className="shrink-0" />
            <span className="truncate">{file ? file.name : "Attach invoice (PDF or image)"}</span>
            <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
        </Field>
      </div>
    </Modal>
  );
}

// ── Payment detail drawer ────────────────────────────────────────────────────

type PaymentDetail = PaymentRow & {
  decisionNote: string | null; cancelReason: string | null; cancelledAt: string | null;
  vendor: Vendor;
  transactions: PaymentTxn[];
  documents: VendorDoc[];
  can: {
    decide: boolean; recordPayment: boolean; voidTransaction: boolean; cancel: boolean; attach: boolean;
    selfApprovalBlocked: boolean; vendorActive: boolean;
  };
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="shrink-0 text-gray-500">{label}</span>
      <span className="min-w-0 break-words text-right font-medium text-gray-900">{children}</span>
    </div>
  );
}

function RecordPaymentForm({ payment, onDone }: { payment: PaymentDetail; onDone: () => void }) {
  const qc = useQueryClient();
  const [d, setD] = useState({
    amount: String(payment.balance), tdsAmount: "", mode: "NEFT", transactionRef: "", paymentDate: todayISO(), remarks: "",
  });
  const set = (k: keyof typeof d) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setD((p) => ({ ...p, [k]: e.target.value }));
  const amount = Number(d.amount) || 0;
  const tds = Number(d.tdsAmount) || 0;
  const after = Math.round((payment.balance - amount - tds) * 100) / 100;

  const record = useMutation({
    mutationFn: () => api.post(`/api/v1/vendor-payments/${payment.id}/transactions`, {
      ...d, amount, tdsAmount: tds,
    }),
    onSuccess: (res) => { toast.success(res.data.message ?? "Payment recorded"); invalidateVendors(qc); onDone(); },
    onError: (e) => toast.error(errorText(e, "Could not record the payment")),
  });

  const needsRef = d.mode !== "CASH";
  const valid = amount + tds > 0 && after >= -0.005 && d.paymentDate && (!needsRef || d.transactionRef.trim());
  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-3 sm:p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Amount paid (₹)" required><input value={d.amount} onChange={set("amount")} inputMode="decimal" className={FIELD} /></Field>
        <Field label="TDS deducted (₹)"><input value={d.tdsAmount} onChange={set("tdsAmount")} inputMode="decimal" className={FIELD} placeholder="0.00" /></Field>
        <Field label="Mode of payment" required>
          <SelectField value={d.mode} onChange={(v) => setD((p) => ({ ...p, mode: v }))} options={PAYMENT_MODES} />
        </Field>
        <Field label="Date of payment" required>
          <input type="date" value={d.paymentDate} max={todayISO()} onChange={set("paymentDate")} className={FIELD} />
        </Field>
        <Field label={d.mode === "CHEQUE" ? "Cheque number" : "Transaction reference (UTR)"} required={needsRef} className="sm:col-span-2">
          <input value={d.transactionRef} onChange={set("transactionRef")} maxLength={100} className={FIELD} />
        </Field>
        <Field label="Remarks" className="sm:col-span-2">
          <input value={d.remarks} onChange={set("remarks")} maxLength={1000} className={FIELD} placeholder="e.g. TDS u/s 194C" />
        </Field>
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className={`text-xs ${after < -0.005 ? "text-red-600" : "text-gray-500"}`}>
          {after < -0.005 ? `That is ${inr(-after)} more than the balance` : after <= 0.005 ? "This settles the request in full" : `Leaves ${inr(after)} outstanding`}
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <button onClick={onDone} className={BTN_SECONDARY}>Cancel</button>
          <button onClick={() => record.mutate()} disabled={!valid || record.isPending} className={BTN_PRIMARY}>
            {record.isPending ? "Saving…" : "Record payment"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function PaymentDrawer({ id, meta, onClose }: { id: string; meta: VendorMeta; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: p, isLoading, isError, error } = useQuery<PaymentDetail>({
    queryKey: ["vendor-payment", id],
    queryFn: () => api.get(`/api/v1/vendor-payments/${id}`).then((r) => r.data.data),
  });
  const [recording, setRecording] = useState(false);
  const [asking, setAsking] = useState<null | "reject" | "approve" | "cancel" | { voidId: string }>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !asking) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [asking, onClose]);

  const act = useMutation({
    mutationFn: ({ path, body, method = "post" }: { path: string; body: object; method?: "post" | "delete" }) =>
      method === "delete" ? api.delete(path, { data: body }) : api.post(path, body),
    onSuccess: (res) => { toast.success(res.data.message ?? "Done"); setAsking(null); invalidateVendors(qc); },
    onError: (e) => toast.error(errorText(e, "That didn't work")),
  });

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={onClose}>
      <div className="flex h-full w-full flex-col bg-white shadow-xl sm:max-w-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Payment request</p>
            <h2 className="truncate text-lg font-semibold text-gray-900">{p?.paymentNumber ?? "…"}</h2>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 active:bg-gray-200" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4 sm:px-5">
          {isLoading ? (
            <p className="py-10 text-center text-sm text-gray-400">Loading…</p>
          ) : isError || !p ? (
            <p className="py-10 text-center text-sm text-red-600">{errorText(error, "Could not load the request")}</p>
          ) : (
            <>
              {/* Headline */}
              <div className="flex flex-wrap items-center gap-2">
                <PaymentStatusBadge status={p.status} />
                <span className="text-2xl font-bold text-gray-900">{inr(p.amount)}</span>
              </div>

              {p.status === "PENDING_APPROVAL" && !p.can.vendorActive && (
                <Notice tone="amber">The vendor is not active right now ({p.vendor.statusNote ?? p.vendor.status.toLowerCase().replace("_", " ")}). This request can&apos;t be approved until the vendor is.</Notice>
              )}
              {(p.status === "APPROVED" || p.status === "PARTIALLY_PAID") && !p.can.vendorActive && (
                <Notice tone="amber">The vendor&apos;s details are awaiting re-approval ({p.vendor.statusNote ?? "inactive"}). Don&apos;t pay until they are approved.</Notice>
              )}
              {p.can.selfApprovalBlocked && <Notice tone="gray">You raised this request, so someone else has to approve it.</Notice>}
              {p.status === "REJECTED" && p.decisionNote && <Notice tone="red">Rejected by {personName(p.approver)}: {p.decisionNote}</Notice>}
              {p.status === "CANCELLED" && <Notice tone="gray">Cancelled{p.cancelReason ? `: ${p.cancelReason}` : ""}</Notice>}

              {/* Actions */}
              {(p.can.decide || p.can.recordPayment || p.can.cancel) && !recording && (
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  {p.can.decide && (
                    <>
                      <button onClick={() => setAsking("approve")} disabled={!p.can.vendorActive} className={`${BTN_PRIMARY} bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800`}>
                        <CheckCircle2 size={16} /> Approve for payment
                      </button>
                      <button onClick={() => setAsking("reject")} className={BTN_SECONDARY}><XCircle size={16} /> Reject</button>
                    </>
                  )}
                  {p.can.recordPayment && (
                    <button onClick={() => setRecording(true)} disabled={!p.can.vendorActive} className={BTN_PRIMARY}>
                      <IndianRupee size={16} /> Record payment
                    </button>
                  )}
                  {p.can.cancel && (
                    <button onClick={() => setAsking("cancel")} className={`${BTN_SECONDARY} text-red-600`}><Ban size={16} /> Cancel request</button>
                  )}
                </div>
              )}
              {recording && <RecordPaymentForm payment={p} onDone={() => setRecording(false)} />}

              {/* Money */}
              {(p.status === "APPROVED" || p.status === "PARTIALLY_PAID" || p.status === "PAID") && (
                <div className="grid grid-cols-3 gap-2">
                  {[["Paid", p.paidAmount], ["TDS", p.tdsAmount], ["Balance", p.balance]].map(([label, n]) => (
                    <div key={label as string} className="rounded-lg border border-gray-200 px-3 py-2">
                      <p className="text-xs text-gray-500">{label}</p>
                      <p className="truncate text-sm font-semibold text-gray-900" title={inr(n as number)}>{inr(n as number)}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Request */}
              <section>
                <SectionTitle>Request</SectionTitle>
                <div className="divide-y divide-gray-50">
                  <Row label="Vendor">
                    <Link href={`/dashboard/vendors/${p.vendor.id}`} className="text-[#2C3E7C] hover:underline">{p.vendor.legalName}</Link>
                    <span className="block text-xs font-normal text-gray-400">{p.vendor.vendorCode}{p.vendor.gstin ? ` · GSTIN ${p.vendor.gstin}` : ""}</span>
                  </Row>
                  <Row label="Purpose"><span className="whitespace-pre-line font-normal">{p.description}</span></Row>
                  {p.invoiceNumber && <Row label="Invoice">{p.invoiceNumber}{p.invoiceDate ? ` · ${fmtDay(p.invoiceDate)}` : ""}</Row>}
                  {p.dueDate && <Row label="Due">{fmtDay(p.dueDate)}</Row>}
                  {p.department && <Row label="Department">{p.department.name}</Row>}
                  <Row label="Raised by">{personName(p.requestedBy)} · {fmtDay(p.createdAt)}</Row>
                  {p.approver && <Row label={p.status === "REJECTED" ? "Rejected by" : "Approved by"}>{personName(p.approver)} · {fmtDay(p.decidedAt)}</Row>}
                  {p.decisionNote && p.status !== "REJECTED" && <Row label="Approver's note"><span className="font-normal">{p.decisionNote}</span></Row>}
                </div>
              </section>

              {/* Pay to */}
              {(p.vendor.bankAccountNumber || p.vendor.upiId) && (
                <section>
                  <SectionTitle>Pay to</SectionTitle>
                  <div className="rounded-lg border border-gray-200 px-3 py-1">
                    {p.vendor.bankAccountName && <Row label="Account name">{p.vendor.bankAccountName}</Row>}
                    {p.vendor.bankAccountNumber && <Row label="Account no."><span className="font-mono">{p.vendor.bankAccountNumber}</span></Row>}
                    {p.vendor.bankIfsc && <Row label="IFSC"><span className="font-mono">{p.vendor.bankIfsc}</span></Row>}
                    {p.vendor.bankName && <Row label="Bank">{p.vendor.bankName}{p.vendor.bankBranch ? `, ${p.vendor.bankBranch}` : ""}</Row>}
                    {p.vendor.upiId && <Row label="UPI">{p.vendor.upiId}</Row>}
                  </div>
                </section>
              )}

              {/* Transactions */}
              {p.transactions.length > 0 && (
                <section>
                  <SectionTitle>Payments made</SectionTitle>
                  <ul className="space-y-2">
                    {p.transactions.map((t) => (
                      <li key={t.id} className="rounded-lg border border-gray-200 px-3 py-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900">
                              {inr(t.amount)}{t.tdsAmount > 0 && <span className="font-normal text-gray-500"> + {inr(t.tdsAmount)} TDS</span>}
                            </p>
                            <p className="truncate text-xs text-gray-500">
                              {modeLabel(t.mode)}{t.transactionRef ? ` · ${t.transactionRef}` : ""} · {fmtDay(t.paymentDate)}
                            </p>
                            {t.remarks && <p className="mt-0.5 text-xs text-gray-500">{t.remarks}</p>}
                            <p className="mt-0.5 text-xs text-gray-400">Recorded by {personName(t.recordedBy)}</p>
                          </div>
                          {p.can.voidTransaction && (
                            <button
                              onClick={() => setAsking({ voidId: t.id })}
                              className="shrink-0 rounded-md p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 active:bg-red-100"
                              aria-label="Void this payment entry"
                              title="Void this entry"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Documents */}
              <section>
                <SectionTitle>Invoice &amp; documents</SectionTitle>
                <DocumentList
                  docs={p.documents}
                  docTypes={meta.docTypes}
                  uploadTypes={meta.paymentDocTypes}
                  uploadUrl={`/api/v1/vendor-payments/${p.id}/documents`}
                  canUpload={p.can.attach}
                  canDelete={p.can.attach}
                  emptyText="No invoice attached"
                />
              </section>
            </>
          )}
        </div>
      </div>

      {p && asking === "approve" && (
        <ReasonModal
          title={`Approve ${p.paymentNumber}?`}
          label={`Clears ${inr(p.amount)} to ${p.vendor.legalName} for payment. Comment (optional)`}
          cta="Approve"
          required={false}
          pending={act.isPending}
          onClose={() => setAsking(null)}
          onSubmit={(note) => act.mutate({ path: `/api/v1/vendor-payments/${p.id}/decision`, body: { action: "APPROVE", note } })}
        />
      )}
      {p && asking === "reject" && (
        <ReasonModal
          title={`Reject ${p.paymentNumber}?`}
          label="Reason (shown to the requester)"
          cta="Reject"
          danger
          pending={act.isPending}
          onClose={() => setAsking(null)}
          onSubmit={(note) => act.mutate({ path: `/api/v1/vendor-payments/${p.id}/decision`, body: { action: "REJECT", note } })}
        />
      )}
      {p && asking === "cancel" && (
        <ReasonModal
          title={`Cancel ${p.paymentNumber}?`}
          label="Reason"
          cta="Cancel request"
          danger
          pending={act.isPending}
          onClose={() => setAsking(null)}
          onSubmit={(reason) => act.mutate({ path: `/api/v1/vendor-payments/${p.id}/cancel`, body: { reason } })}
        />
      )}
      {p && asking && typeof asking === "object" && (
        <ReasonModal
          title="Void this payment entry?"
          label="Reason — the entry is removed and the balance reopened. This is logged."
          cta="Void entry"
          danger
          pending={act.isPending}
          onClose={() => setAsking(null)}
          onSubmit={(reason) => act.mutate({ path: `/api/v1/vendor-payments/${p.id}/transactions/${asking.voidId}`, body: { reason }, method: "delete" })}
        />
      )}
    </div>
  );
}

export function Notice({ tone, children }: { tone: "amber" | "red" | "gray"; children: React.ReactNode }) {
  const cls = tone === "amber" ? "border-amber-200 bg-amber-50 text-amber-800"
    : tone === "red" ? "border-red-200 bg-red-50 text-red-700"
    : "border-gray-200 bg-gray-50 text-gray-600";
  return (
    <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${cls}`}>
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#2C3E7C]">
          <Building2 className="text-white" size={18} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          <p className="text-sm text-gray-500">{subtitle}</p>
        </div>
      </div>
      {actions && <div className="flex flex-col gap-2 sm:flex-row">{actions}</div>}
    </div>
  );
}

export function NoAccess({ what }: { what: string }) {
  return (
    <div className="py-16 text-center">
      <p className="text-sm font-medium text-gray-700">You don&apos;t have access to {what}</p>
      <p className="mt-1 text-sm text-gray-500">Ask a Super Admin to grant your role access under Roles &amp; Permissions → Vendors.</p>
    </div>
  );
}
