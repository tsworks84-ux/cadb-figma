"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Plus, Search, Store } from "lucide-react";
import { api } from "@/lib/api";
import {
  BTN_PRIMARY, BTN_SECONDARY, FIELD, NoAccess, PageHeader, PaymentRequestModal, SelectField, VendorFormModal,
  VendorStatusBadge, VendorsNav, errorText, inr, useVendorMeta, type VendorStatus,
} from "@/components/vendors/shared";

type VendorRow = {
  id: string; vendorCode: string; legalName: string; tradeName: string | null; category: string;
  city: string | null; state: string | null; gstin: string | null; contactPerson: string | null;
  phone: string | null; email: string | null; status: VendorStatus; statusNote: string | null;
  outstanding: number | null;
};

const TABS: { value: "" | VendorStatus; label: string }[] = [
  { value: "", label: "All" },
  { value: "PENDING_APPROVAL", label: "Pending approval" },
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "REJECTED", label: "Rejected" },
];

export default function VendorsPage() {
  const router = useRouter();
  const { data: meta, isLoading: metaLoading } = useVendorMeta();
  const access = meta?.access;
  const [status, setStatus] = useState<"" | VendorStatus>("");
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [registering, setRegistering] = useState(false);
  const [raising, setRaising] = useState(false);
  const term = search.trim();

  const { data, isLoading, isError, error, refetch } = useQuery<{ data: VendorRow[]; counts: Record<string, number> }>({
    queryKey: ["vendors", status, category, term],
    queryFn: () => api.get("/api/v1/vendors", { params: { status: status || undefined, category: category || undefined, q: term || undefined } })
      .then((r) => ({ data: r.data.data, counts: r.data.counts })),
    enabled: !!access?.canBrowseVendors,
    placeholderData: (prev) => prev,
  });

  // Requesters without registry access land on Payments instead.
  const toPayments = !!access && !access.canBrowseVendors && (access.payments.create || access.seesAllPayments);
  useEffect(() => { if (toPayments) router.replace("/dashboard/vendors/payments"); }, [toPayments, router]);

  if (metaLoading || toPayments) return <div className="py-16 text-center text-sm text-gray-400">Loading…</div>;
  if (!meta || !access) return <NoAccess what="Vendors" />;
  if (!access.canBrowseVendors) return <NoAccess what="Vendors" />;

  const counts = data?.counts ?? {};
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const vendors = data?.data ?? [];
  const showOutstanding = access.seesAllPayments;

  return (
    <div className="space-y-4">
      {registering && (
        <VendorFormModal meta={meta} onClose={() => setRegistering(false)} onSaved={(id) => router.push(`/dashboard/vendors/${id}`)} />
      )}
      {raising && <PaymentRequestModal onClose={() => setRaising(false)} onCreated={(id) => router.push(`/dashboard/vendors/payments?open=${id}`)} />}

      <PageHeader
        title="Vendors"
        subtitle="Vendor registry, onboarding and payments"
        actions={
          <>
            {access.payments.create && (
              <button onClick={() => setRaising(true)} className={`${BTN_SECONDARY} w-full sm:w-auto`}>New payment request</button>
            )}
            {access.vendors.create && (
              <button onClick={() => setRegistering(true)} className={`${BTN_PRIMARY} w-full sm:w-auto`}>
                <Plus size={16} /> Register vendor
              </button>
            )}
          </>
        }
      />
      <VendorsNav access={access} />

      {/* Status tabs */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:flex-wrap sm:px-0">
        {TABS.map((t) => {
          const active = status === t.value;
          const n = t.value ? counts[t.value] ?? 0 : total;
          return (
            <button
              key={t.value || "all"}
              onClick={() => setStatus(t.value)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                active ? "border-[#2C3E7C] bg-[#2C3E7C] text-white" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 active:bg-gray-100"
              }`}
            >
              {t.label}
              <span className={`text-xs ${active ? "text-white/70" : t.value === "PENDING_APPROVAL" && n > 0 ? "font-semibold text-amber-600" : "text-gray-400"}`}>{n}</span>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, code, GSTIN, PAN, city…" className={`${FIELD} pl-9`} />
        </div>
        <SelectField
          value={category}
          onChange={setCategory}
          placeholder="All categories"
          options={meta.categories.map((c) => ({ value: c, label: c }))}
          className="w-full sm:w-60"
        />
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-sm text-gray-400">Loading vendors…</div>
      ) : isError ? (
        <div className="py-16 text-center">
          <p className="text-sm text-red-600">{errorText(error, "Could not load vendors")}</p>
          <button onClick={() => refetch()} className="mt-2 text-sm font-medium text-[#2C3E7C] hover:underline">Try again</button>
        </div>
      ) : vendors.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white py-14 text-center">
          <Store className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-2 text-sm font-medium text-gray-700">{term || category || status ? "No vendors match" : "No vendors registered yet"}</p>
          {access.vendors.create && !term && !category && !status && (
            <button onClick={() => setRegistering(true)} className={`${BTN_PRIMARY} mt-4`}><Plus size={16} /> Register vendor</button>
          )}
        </div>
      ) : (
        <>
          {/* Mobile: cards */}
          <ul className="space-y-2 md:hidden">
            {vendors.map((v) => (
              <li key={v.id}>
                <Link href={`/dashboard/vendors/${v.id}`} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 active:bg-gray-50">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-semibold text-gray-900">{v.legalName}</p>
                    </div>
                    <p className="truncate text-xs text-gray-500">{v.vendorCode} · {v.category}{v.city ? ` · ${v.city}` : ""}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <VendorStatusBadge status={v.status} />
                      {showOutstanding && (v.outstanding ?? 0) > 0 && <span className="text-xs font-medium text-sky-700">{inr(v.outstanding)} due</span>}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
                </Link>
              </li>
            ))}
          </ul>

          {/* Desktop: table */}
          <div className="hidden overflow-hidden rounded-xl border border-gray-200 bg-white md:block">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-2.5">Vendor</th>
                  <th className="px-4 py-2.5">Category</th>
                  <th className="hidden px-4 py-2.5 lg:table-cell">GSTIN</th>
                  <th className="hidden px-4 py-2.5 xl:table-cell">Contact</th>
                  <th className="px-4 py-2.5">Status</th>
                  {showOutstanding && <th className="px-4 py-2.5 text-right">Cleared, unpaid</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {vendors.map((v) => (
                  <tr key={v.id} onClick={() => router.push(`/dashboard/vendors/${v.id}`)} className="cursor-pointer hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/vendors/${v.id}`} className="font-medium text-gray-900 hover:text-[#2C3E7C]" onClick={(e) => e.stopPropagation()}>
                        {v.legalName}
                      </Link>
                      <p className="text-xs text-gray-400">{v.vendorCode}{v.tradeName ? ` · ${v.tradeName}` : ""}{v.city ? ` · ${v.city}` : ""}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{v.category}</td>
                    <td className="hidden px-4 py-3 font-mono text-xs text-gray-600 lg:table-cell">{v.gstin ?? "—"}</td>
                    <td className="hidden px-4 py-3 text-gray-600 xl:table-cell">
                      {v.contactPerson ?? "—"}
                      {v.phone && <span className="block text-xs text-gray-400">{v.phone}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <VendorStatusBadge status={v.status} />
                      {v.status !== "ACTIVE" && v.statusNote && <p className="mt-0.5 max-w-[14rem] truncate text-xs text-gray-400" title={v.statusNote}>{v.statusNote}</p>}
                    </td>
                    {showOutstanding && (
                      <td className="px-4 py-3 text-right font-medium text-gray-900">{(v.outstanding ?? 0) > 0 ? inr(v.outstanding) : <span className="text-gray-300">—</span>}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
