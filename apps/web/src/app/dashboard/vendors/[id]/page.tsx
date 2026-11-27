"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Ban, CheckCircle2, Pencil, Plus, RotateCcw, Trash2, XCircle } from "lucide-react";
import { api } from "@/lib/api";
import {
  BTN_PRIMARY, BTN_SECONDARY, DocumentList, NoAccess, Notice, PaymentDrawer, PaymentRequestModal,
  PaymentStatusBadge, ReasonModal, SectionTitle, VendorFormModal, VendorStatusBadge, VendorsNav,
  errorText, fmtDay, inr, invalidateVendors, personName, useVendorMeta,
  type PaymentStatus, type Person, type Vendor, type VendorDoc,
} from "@/components/vendors/shared";

type VendorDetail = Vendor & {
  createdBy: Person; reviewedBy: Person | null;
  documents: VendorDoc[];
  payments: {
    id: string; paymentNumber: string; invoiceNumber: string | null; invoiceDate: string | null; description: string;
    amount: number; paidAmount: number; tdsAmount: number; status: PaymentStatus; createdAt: string; paidAt: string | null;
  }[] | null;
  totals: { approved: number; paid: number; tds: number; pending: number; outstanding: number } | null;
  can: { edit: boolean; review: boolean; toggleActive: boolean; delete: boolean };
};

function Detail({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className={`mt-0.5 break-words text-sm text-gray-900 ${mono ? "font-mono" : ""}`}>{value || <span className="text-gray-300">—</span>}</dd>
    </div>
  );
}

const CARD = "rounded-xl border border-gray-200 bg-white p-4 sm:p-5";
const DL = "grid grid-cols-2 gap-x-4 gap-y-3 sm:gap-x-6 lg:grid-cols-3";

export default function VendorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { data: meta } = useVendorMeta();
  const access = meta?.access;

  const { data: v, isLoading, isError, error } = useQuery<VendorDetail>({
    queryKey: ["vendor", id],
    queryFn: () => api.get(`/api/v1/vendors/${id}`).then((r) => r.data.data),
    enabled: !!access?.canBrowseVendors,
  });

  const [editing, setEditing] = useState(false);
  const [raising, setRaising] = useState(false);
  const [openPayment, setOpenPayment] = useState<string | null>(null);
  const [asking, setAsking] = useState<null | "approve" | "reject" | "deactivate" | "reactivate" | "delete">(null);

  const act = useMutation({
    mutationFn: ({ path, body, method = "post" }: { path: string; body: object; method?: "post" | "delete" }) =>
      method === "delete" ? api.delete(path, { data: body }) : api.post(path, body),
    onSuccess: (res, vars) => {
      toast.success(res.data.message ?? "Done");
      setAsking(null);
      invalidateVendors(qc);
      if (vars.method === "delete") router.push("/dashboard/vendors");
    },
    onError: (e) => toast.error(errorText(e, "That didn't work")),
  });

  if (!meta) return <div className="py-16 text-center text-sm text-gray-400">Loading…</div>;
  if (!access?.canBrowseVendors) return <NoAccess what="Vendors" />;
  if (isLoading) return <div className="py-16 text-center text-sm text-gray-400">Loading vendor…</div>;
  if (isError || !v) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-red-600">{errorText(error, "Could not load the vendor")}</p>
        <Link href="/dashboard/vendors" className="mt-2 inline-block text-sm font-medium text-[#2C3E7C] hover:underline">Back to vendors</Link>
      </div>
    );
  }

  const address = [v.address, v.city, v.state, v.pincode].filter(Boolean).join(", ");

  return (
    <div className="space-y-4">
      {editing && <VendorFormModal meta={meta} vendor={v} onClose={() => setEditing(false)} />}
      {raising && <PaymentRequestModal defaultVendorId={v.id} onClose={() => setRaising(false)} onCreated={(pid) => setOpenPayment(pid)} />}
      {openPayment && <PaymentDrawer id={openPayment} meta={meta} onClose={() => setOpenPayment(null)} />}

      <VendorsNav access={access} />
      <Link href="/dashboard/vendors" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeft size={15} /> All vendors
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">{v.legalName}</h1>
            <VendorStatusBadge status={v.status} />
          </div>
          <p className="mt-0.5 text-sm text-gray-500">
            {v.vendorCode}{v.tradeName ? ` · trading as ${v.tradeName}` : ""} · {v.category}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {v.can.review && (
            <>
              <button onClick={() => setAsking("approve")} className={`${BTN_PRIMARY} bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800`}>
                <CheckCircle2 size={16} /> Approve vendor
              </button>
              <button onClick={() => setAsking("reject")} className={BTN_SECONDARY}><XCircle size={16} /> Reject</button>
            </>
          )}
          {access.payments.create && v.status === "ACTIVE" && (
            <button onClick={() => setRaising(true)} className={BTN_PRIMARY}><Plus size={16} /> Payment request</button>
          )}
          {v.can.edit && <button onClick={() => setEditing(true)} className={BTN_SECONDARY}><Pencil size={15} /> Edit</button>}
          {v.can.toggleActive && v.status === "ACTIVE" && (
            <button onClick={() => setAsking("deactivate")} className={BTN_SECONDARY}><Ban size={15} /> Deactivate</button>
          )}
          {v.can.toggleActive && v.status === "INACTIVE" && (
            <button onClick={() => setAsking("reactivate")} className={BTN_SECONDARY}><RotateCcw size={15} /> Reactivate</button>
          )}
          {v.can.delete && (!v.payments || v.payments.length === 0) && (
            <button onClick={() => setAsking("delete")} className={`${BTN_SECONDARY} text-red-600`}><Trash2 size={15} /> Delete</button>
          )}
        </div>
      </div>

      {v.status === "PENDING_APPROVAL" && (
        <Notice tone="amber">
          Awaiting approval{v.statusNote ? ` — ${v.statusNote}` : ""}. No payments can be raised or made until it is approved.
          {access.vendors.approve && !v.can.review && " You submitted this, so someone else has to approve it."}
        </Notice>
      )}
      {v.status === "REJECTED" && <Notice tone="red">Rejected{v.reviewedBy ? ` by ${personName(v.reviewedBy)}` : ""}: {v.statusNote ?? "no reason given"}. Editing the vendor resubmits it.</Notice>}
      {v.status === "INACTIVE" && <Notice tone="gray">Deactivated{v.statusNote ? `: ${v.statusNote}` : ""}. No new payment requests can be raised.</Notice>}

      {/* Money summary */}
      {v.totals && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: "Awaiting approval", value: v.totals.pending },
            { label: "Cleared, unpaid", value: v.totals.outstanding, strong: true },
            { label: "Paid to date", value: v.totals.paid },
            { label: "TDS deducted", value: v.totals.tds },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-gray-200 bg-white px-4 py-3">
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className={`mt-0.5 truncate text-lg font-semibold ${s.strong && s.value > 0 ? "text-sky-700" : "text-gray-900"}`} title={inr(s.value)}>{inr(s.value)}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <section className={CARD}>
            <SectionTitle>Business &amp; contact</SectionTitle>
            <dl className={DL}>
              <Detail label="GSTIN" value={v.gstin} mono />
              <Detail label="PAN" value={v.pan} mono />
              <Detail label="MSME / Udyam" value={v.udyamNumber} />
              <Detail label="Payment terms" value={v.paymentTermsDays != null ? `${v.paymentTermsDays} days` : null} />
              <Detail label="Contact person" value={v.contactPerson} />
              <Detail label="Phone" value={v.phone && <a href={`tel:${v.phone}`} className="text-[#2C3E7C] hover:underline">{v.phone}</a>} />
              <Detail label="Email" value={v.email && <a href={`mailto:${v.email}`} className="text-[#2C3E7C] hover:underline">{v.email}</a>} />
              <div className="col-span-2"><Detail label="Address" value={address} /></div>
            </dl>
            {v.notes && <p className="mt-4 whitespace-pre-line rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">{v.notes}</p>}
          </section>

          <section className={CARD}>
            <SectionTitle>Bank details</SectionTitle>
            <dl className={DL}>
              <Detail label="Account holder" value={v.bankAccountName} />
              <Detail label="Account number" value={v.bankAccountNumber} mono />
              <Detail label="IFSC" value={v.bankIfsc} mono />
              <Detail label="Bank" value={v.bankName} />
              <Detail label="Branch" value={v.bankBranch} />
              <Detail label="UPI ID" value={v.upiId} />
            </dl>
            {!access.seesBankDetails && v.bankAccountNumber && (
              <p className="mt-3 text-xs text-gray-400">The account number is masked for your role.</p>
            )}
          </section>

          {v.payments && (
            <section className={CARD}>
              <div className="flex items-center justify-between">
                <SectionTitle>Payment requests</SectionTitle>
                <Link href={`/dashboard/vendors/payments?vendorId=${v.id}`} className="mb-3 text-xs font-medium text-[#2C3E7C] hover:underline">Open in Payments</Link>
              </div>
              {v.payments.length === 0 ? (
                <p className="py-2 text-sm text-gray-400">No payment requests yet.</p>
              ) : (
                <ul className="-mx-2 divide-y divide-gray-100">
                  {v.payments.map((p) => (
                    <li key={p.id}>
                      <button onClick={() => setOpenPayment(p.id)} className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-gray-50 active:bg-gray-100">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-gray-900">{p.paymentNumber}{p.invoiceNumber ? ` · Inv ${p.invoiceNumber}` : ""}</p>
                          <p className="truncate text-xs text-gray-500">{p.description} · {fmtDay(p.createdAt)}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-semibold text-gray-900">{inr(p.amount)}</p>
                          <PaymentStatusBadge status={p.status} />
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>

        <div className="space-y-4">
          <section className={CARD}>
            <SectionTitle>Onboarding documents</SectionTitle>
            <DocumentList
              docs={v.documents}
              docTypes={meta.docTypes}
              uploadTypes={meta.onboardingDocTypes}
              uploadUrl={`/api/v1/vendors/${v.id}/documents`}
              canUpload={v.can.edit}
              canDelete={v.can.edit}
              emptyText="No documents yet. Typically: GST certificate, PAN card, cancelled cheque."
            />
          </section>
          <section className={CARD}>
            <SectionTitle>History</SectionTitle>
            <dl className="space-y-3">
              <Detail label="Registered" value={`${fmtDay(v.createdAt)} by ${personName(v.createdBy)}`} />
              {v.reviewedBy && <Detail label="Last reviewed" value={`${fmtDay(v.reviewedAt)} by ${personName(v.reviewedBy)}`} />}
            </dl>
          </section>
        </div>
      </div>

      {asking === "approve" && (
        <ReasonModal
          title={`Approve ${v.legalName}?`}
          label="Comment (optional)"
          cta="Approve vendor"
          required={false}
          pending={act.isPending}
          onClose={() => setAsking(null)}
          onSubmit={(note) => act.mutate({ path: `/api/v1/vendors/${v.id}/review`, body: { action: "APPROVE", note } })}
        />
      )}
      {asking === "reject" && (
        <ReasonModal
          title={`Reject ${v.legalName}?`} label="Reason" cta="Reject" danger pending={act.isPending}
          onClose={() => setAsking(null)}
          onSubmit={(note) => act.mutate({ path: `/api/v1/vendors/${v.id}/review`, body: { action: "REJECT", note } })}
        />
      )}
      {asking === "deactivate" && (
        <ReasonModal
          title={`Deactivate ${v.legalName}?`} label="Reason" cta="Deactivate" danger pending={act.isPending}
          onClose={() => setAsking(null)}
          onSubmit={(note) => act.mutate({ path: `/api/v1/vendors/${v.id}/status`, body: { status: "INACTIVE", note } })}
        />
      )}
      {asking === "reactivate" && (
        <ReasonModal
          title={`Reactivate ${v.legalName}?`} label="Comment (optional)" cta="Reactivate" required={false} pending={act.isPending}
          onClose={() => setAsking(null)}
          onSubmit={(note) => act.mutate({ path: `/api/v1/vendors/${v.id}/status`, body: { status: "ACTIVE", note } })}
        />
      )}
      {asking === "delete" && (
        <ReasonModal
          title={`Delete ${v.legalName}?`} label="Reason — this removes the vendor and its documents, and is logged" cta="Delete vendor" danger pending={act.isPending}
          onClose={() => setAsking(null)}
          onSubmit={(reason) => act.mutate({ path: `/api/v1/vendors/${v.id}`, body: { reason }, method: "delete" })}
        />
      )}
    </div>
  );
}
