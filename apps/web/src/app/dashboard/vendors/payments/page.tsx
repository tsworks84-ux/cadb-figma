"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronRight, Download, Plus, Receipt, Search, X } from "lucide-react";
import { api } from "@/lib/api";
import {
  BTN_PRIMARY, BTN_SECONDARY, FIELD, NoAccess, PageHeader, PaymentDrawer, PaymentRequestModal, PaymentStatusBadge,
  VendorsNav, errorText, fmtDay, inr, personName, useVendorMeta, type PaymentRow,
} from "@/components/vendors/shared";

type Tab = "PENDING_APPROVAL" | "OPEN" | "PAID" | "REJECTED" | "CANCELLED" | "";
type Summary = { counts: Record<string, number>; amounts: Record<string, number>; clearedOutstanding: number };

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function PaymentsInner() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { data: meta, isLoading: metaLoading } = useVendorMeta();
  const access = meta?.access;
  const seesAll = !!access?.seesAllPayments;

  // Land each role on the queue that is theirs to work.
  const defaultTab: Tab = access?.payments.approve ? "PENDING_APPROVAL" : access?.payments.edit ? "OPEN" : "";
  const [tab, setTab] = useState<Tab | null>(null);
  const activeTab: Tab = tab ?? defaultTab;
  const [mine, setMine] = useState(false);
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [raising, setRaising] = useState(false);
  const [exporting, setExporting] = useState(false);
  const vendorId = params.get("vendorId") ?? "";
  const openId = params.get("open");
  const term = search.trim();

  const setOpen = (id: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (id) next.set("open", id); else next.delete("open");
    router.replace(`${pathname}${next.toString() ? `?${next}` : ""}`, { scroll: false });
  };
  const clearVendor = () => {
    const next = new URLSearchParams(params.toString());
    next.delete("vendorId");
    router.replace(`${pathname}${next.toString() ? `?${next}` : ""}`, { scroll: false });
  };

  const enabled = !!access && (access.payments.create || seesAll);
  const filters = {
    status: activeTab || undefined, vendorId: vendorId || undefined, q: term || undefined,
    mine: mine ? "1" : undefined, from: from || undefined, to: to || undefined,
  };
  const { data: summary } = useQuery<Summary>({
    queryKey: ["vendor-payment-summary"],
    queryFn: () => api.get("/api/v1/vendor-payments/summary").then((r) => r.data.data),
    enabled,
  });
  const { data: rows = [], isLoading, isError, error, refetch } = useQuery<PaymentRow[]>({
    queryKey: ["vendor-payments", filters],
    queryFn: () => api.get("/api/v1/vendor-payments", { params: filters }).then((r) => r.data.data),
    enabled,
    placeholderData: (prev) => prev,
  });

  // A vendor filter arriving by link should show that vendor's whole history.
  useEffect(() => { if (vendorId) setTab(""); }, [vendorId]);

  if (metaLoading) return <div className="py-16 text-center text-sm text-gray-400">Loading…</div>;
  if (!access || !enabled) return <NoAccess what="Vendor Payments" />;

  const counts = summary?.counts ?? {};
  const amounts = summary?.amounts ?? {};
  const tabs: { value: Tab; label: string; count?: number }[] = [
    { value: "PENDING_APPROVAL", label: "Awaiting approval", count: counts.PENDING_APPROVAL ?? 0 },
    { value: "OPEN", label: "Cleared for payment", count: (counts.APPROVED ?? 0) + (counts.PARTIALLY_PAID ?? 0) },
    { value: "PAID", label: "Paid" },
    { value: "REJECTED", label: "Rejected" },
    { value: "CANCELLED", label: "Cancelled" },
    { value: "", label: "All" },
  ];

  const exportXlsx = async () => {
    setExporting(true);
    try {
      const res = await api.get("/api/v1/vendor-payments/export", { params: filters, responseType: "blob" });
      triggerDownload(res.data, `vendor_payments_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (e: any) {
      let msg = "Export failed";
      try { msg = JSON.parse(await e?.response?.data?.text()).error ?? msg; } catch { /* not JSON */ }
      toast.error(msg);
    } finally {
      setExporting(false);
    }
  };

  const vendorLabel = vendorId ? rows.find((r) => r.vendor.id === vendorId)?.vendor.legalName ?? "selected vendor" : null;
  const hasFilters = !!(term || from || to || vendorId || mine);

  return (
    <div className="space-y-4">
      {raising && <PaymentRequestModal onClose={() => setRaising(false)} onCreated={(id) => setOpen(id)} />}
      {openId && meta && <PaymentDrawer id={openId} meta={meta} onClose={() => setOpen(null)} />}

      <PageHeader
        title="Vendor Payments"
        subtitle={seesAll ? "Requests, approvals and payments to vendors" : "Your payment requests to vendors"}
        actions={
          <>
            {seesAll && (
              <button onClick={exportXlsx} disabled={exporting} className={`${BTN_SECONDARY} w-full sm:w-auto`}>
                <Download size={15} /> {exporting ? "Exporting…" : "Export"}
              </button>
            )}
            {access.payments.create && (
              <button onClick={() => setRaising(true)} className={`${BTN_PRIMARY} w-full sm:w-auto`}>
                <Plus size={16} /> New payment request
              </button>
            )}
          </>
        }
      />
      <VendorsNav access={access} />

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <button onClick={() => setTab("PENDING_APPROVAL")} className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-left hover:shadow-sm active:bg-gray-50">
          <p className="text-xs text-gray-500">Awaiting approval</p>
          <p className="mt-0.5 truncate text-lg font-semibold text-amber-700" title={inr(amounts.PENDING_APPROVAL ?? 0)}>{inr(amounts.PENDING_APPROVAL ?? 0)}</p>
          <p className="text-xs text-gray-400">{counts.PENDING_APPROVAL ?? 0} request{counts.PENDING_APPROVAL === 1 ? "" : "s"}</p>
        </button>
        <button onClick={() => setTab("OPEN")} className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-left hover:shadow-sm active:bg-gray-50">
          <p className="text-xs text-gray-500">Cleared, to be paid</p>
          <p className="mt-0.5 truncate text-lg font-semibold text-sky-700" title={inr(summary?.clearedOutstanding ?? 0)}>{inr(summary?.clearedOutstanding ?? 0)}</p>
          <p className="text-xs text-gray-400">{(counts.APPROVED ?? 0) + (counts.PARTIALLY_PAID ?? 0)} request(s)</p>
        </button>
        <button onClick={() => setTab("PAID")} className="col-span-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-left hover:shadow-sm active:bg-gray-50 lg:col-span-1">
          <p className="text-xs text-gray-500">Paid in full</p>
          <p className="mt-0.5 truncate text-lg font-semibold text-emerald-700" title={inr(amounts.PAID ?? 0)}>{inr(amounts.PAID ?? 0)}</p>
          <p className="text-xs text-gray-400">{counts.PAID ?? 0} request(s)</p>
        </button>
      </div>

      {/* Tabs */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:flex-wrap sm:px-0">
        {tabs.map((t) => {
          const active = activeTab === t.value;
          return (
            <button
              key={t.value || "all"}
              onClick={() => setTab(t.value)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                active ? "border-[#2C3E7C] bg-[#2C3E7C] text-white" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 active:bg-gray-100"
              }`}
            >
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className={`rounded-full px-1.5 text-xs ${active ? "bg-white/20 text-white" : "bg-amber-100 text-amber-800"}`}>{t.count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative w-full lg:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Request no., vendor, invoice, UTR…" className={`${FIELD} pl-9`} />
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={`${FIELD} lg:w-40`} aria-label="Raised from" />
          <span className="text-sm text-gray-400">to</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={`${FIELD} lg:w-40`} aria-label="Raised to" />
        </div>
        {seesAll && access.payments.create && (
          <label className="inline-flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
            Only mine
          </label>
        )}
        {vendorLabel && (
          <span className="inline-flex max-w-full items-center gap-1 self-start rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700 lg:self-auto">
            <span className="truncate">Vendor: {vendorLabel}</span>
            <button onClick={clearVendor} className="rounded-full p-0.5 hover:bg-gray-200" aria-label="Clear vendor filter"><X size={14} /></button>
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-sm text-gray-400">Loading requests…</div>
      ) : isError ? (
        <div className="py-16 text-center">
          <p className="text-sm text-red-600">{errorText(error, "Could not load payment requests")}</p>
          <button onClick={() => refetch()} className="mt-2 text-sm font-medium text-[#2C3E7C] hover:underline">Try again</button>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white py-14 text-center">
          <Receipt className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-2 text-sm font-medium text-gray-700">
            {hasFilters ? "Nothing matches these filters"
              : activeTab === "PENDING_APPROVAL" ? "Nothing is waiting for approval"
              : activeTab === "OPEN" ? "Nothing is waiting to be paid"
              : "No payment requests here"}
          </p>
        </div>
      ) : (
        <>
          {/* Mobile: cards */}
          <ul className="space-y-2 md:hidden">
            {rows.map((p) => (
              <li key={p.id}>
                <button onClick={() => setOpen(p.id)} className="flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 text-left active:bg-gray-50">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate font-semibold text-gray-900">{p.vendor.legalName}</p>
                      <p className="shrink-0 font-semibold text-gray-900">{inr(p.amount)}</p>
                    </div>
                    <p className="truncate text-xs text-gray-500">{p.paymentNumber} · {p.description}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <PaymentStatusBadge status={p.status} />
                      {p.status === "PARTIALLY_PAID" && <span className="text-xs text-gray-500">{inr(p.balance)} left</span>}
                      <span className="text-xs text-gray-400">{fmtDay(p.createdAt)}</span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
                </button>
              </li>
            ))}
          </ul>

          {/* Desktop: table */}
          <div className="hidden overflow-x-auto rounded-xl border border-gray-200 bg-white md:block">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-2.5">Request</th>
                  <th className="px-4 py-2.5">Vendor</th>
                  <th className="hidden px-4 py-2.5 lg:table-cell">Purpose</th>
                  <th className="px-4 py-2.5 text-right">Amount</th>
                  <th className="px-4 py-2.5 text-right">Balance</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="hidden px-4 py-2.5 xl:table-cell">Raised by</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((p) => {
                  const overdue = p.dueDate && (p.status === "APPROVED" || p.status === "PARTIALLY_PAID" || p.status === "PENDING_APPROVAL")
                    && p.dueDate.slice(0, 10) < new Date().toISOString().slice(0, 10);
                  return (
                    <tr key={p.id} onClick={() => setOpen(p.id)} className="cursor-pointer hover:bg-gray-50">
                      <td className="whitespace-nowrap px-4 py-3">
                        <p className="font-medium text-gray-900">{p.paymentNumber}</p>
                        <p className="text-xs text-gray-400">{fmtDay(p.createdAt)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="max-w-[16rem] truncate font-medium text-gray-900">{p.vendor.legalName}</p>
                        <p className="text-xs text-gray-400">
                          {p.invoiceNumber ? `Inv ${p.invoiceNumber}` : p.vendor.vendorCode}
                          {p.dueDate && <span className={overdue ? "font-medium text-red-600" : ""}> · due {fmtDay(p.dueDate)}</span>}
                        </p>
                      </td>
                      <td className="hidden max-w-[14rem] px-4 py-3 lg:table-cell"><p className="truncate text-gray-600" title={p.description}>{p.description}</p></td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-gray-900">{inr(p.amount)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-gray-600">
                        {p.status === "REJECTED" || p.status === "CANCELLED" ? <span className="text-gray-300">—</span> : p.balance > 0 ? inr(p.balance) : <span className="text-emerald-600">Nil</span>}
                      </td>
                      <td className="px-4 py-3"><PaymentStatusBadge status={p.status} /></td>
                      <td className="hidden whitespace-nowrap px-4 py-3 text-gray-600 xl:table-cell">{personName(p.requestedBy)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {rows.length >= 500 && <p className="text-center text-xs text-gray-400">Showing the first 500 — narrow the filters to see the rest.</p>}
        </>
      )}
    </div>
  );
}

export default function VendorPaymentsPage() {
  return (
    <Suspense fallback={<div className="py-16 text-center text-sm text-gray-400">Loading…</div>}>
      <PaymentsInner />
    </Suspense>
  );
}
