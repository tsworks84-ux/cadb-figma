"use client";

import { useStudentAuthStore } from "@/store/studentAuth";
import { useQuery } from "@tanstack/react-query";
import { studentApi } from "@/lib/studentApi";
import { ClipboardList, IndianRupee, CheckCircle2, Clock, AlertCircle, Banknote, GraduationCap } from "lucide-react";

function SectionCard({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-50">
        <div className="h-7 w-7 rounded-lg bg-sky-50 flex items-center justify-center">
          <Icon className="h-3.5 w-3.5 text-sky-600" />
        </div>
        <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
      </div>
      <div className="px-5 py-5">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-sm text-gray-800 font-medium">{value || <span className="text-gray-300 font-normal">—</span>}</p>
    </div>
  );
}

function fmt(v?: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtCurrency(n: number | null | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

export default function StudentAdmissionPage() {
  const { accessToken } = useStudentAuthStore();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["student-portal-profile"],
    queryFn:  () => studentApi.get("/api/v1/student/portal/profile").then((r) => r.data.data),
    staleTime: 2 * 60 * 1000, enabled: !!accessToken,
  });

  if (isLoading || !profile) {
    return (
      <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4 shadow-sm">
            <div className="h-4 w-40 bg-gray-100 rounded animate-pulse" />
            <div className="grid grid-cols-3 gap-4">
              {[1, 2, 3].map((j) => (
                <div key={j} className="space-y-1.5">
                  <div className="h-2.5 w-20 bg-gray-100 rounded animate-pulse" />
                  <div className="h-4 w-28 bg-gray-100 rounded animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const s: any = profile;
  const instalments: any[] = s?.instalments ?? [];
  const paymentLogs: any[] = s?.paymentLogs ?? [];

  const totalFee = s?.totalFee ?? 0;
  const paidFee  = s?.paidFee  ?? 0;
  const discount = s?.discountType === "AMOUNT"
    ? (s?.discountAmount ?? 0)
    : s?.discountType === "PERCENTAGE"
      ? Math.round(totalFee * (s?.discountAmount ?? 0) / 100)
      : 0;
  const netFee     = Math.max(0, totalFee - discount);
  const balanceDue = Math.max(0, netFee - paidFee);

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4">

      {/* Enrollment */}
      <SectionCard title="Enrollment Details" icon={ClipboardList}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-5">
          <Field label="Admission Number" value={s?.admissionNumber} />
          <Field label="Admission Date"   value={fmt(s?.admissionDate)} />
          <Field label="Academic Year"    value={s?.academicYear} />
          <Field label="Grade"            value={s?.grade?.name} />
          <Field label="Course"           value={s?.course?.name} />
          <Field label="School"           value={s?.school?.name} />
        </div>
      </SectionCard>

      {/* Batches */}
      {s?.studentBatches?.length > 0 && (
        <SectionCard title="Current Batches" icon={GraduationCap}>
          <div className="space-y-3">
            {(s.studentBatches as any[]).map((sb: any) => (
              <div key={sb.id} className="flex items-center gap-3 rounded-xl bg-sky-50/60 border border-sky-100 px-4 py-3">
                <div className="h-9 w-9 rounded-xl bg-sky-100 flex items-center justify-center shrink-0">
                  <GraduationCap className="h-4 w-4 text-sky-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800">{sb.batch?.name}</p>
                  <p className="text-xs text-gray-500">
                    {sb.batch?.academicYear}
                    {sb.batch?.grade?.name ? ` · ${sb.batch.grade.name}` : ""}
                    {sb.batch?.location?.name ? ` · ${sb.batch.location.name}` : ""}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase">Joined</p>
                  <p className="text-xs font-semibold text-gray-600">{fmt(sb.joinedAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Fee Summary */}
      {totalFee > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { label: "Total Fee",   value: fmtCurrency(totalFee),   cls: "border-sky-100  bg-sky-50   text-sky-700"   },
              { label: "Paid",        value: fmtCurrency(paidFee),    cls: "border-green-100 bg-green-50 text-green-700" },
              { label: "Discount",    value: fmtCurrency(discount),   cls: "border-amber-100 bg-amber-50 text-amber-700" },
              { label: "Balance Due", value: fmtCurrency(balanceDue), cls: balanceDue > 0 ? "border-red-100 bg-red-50 text-red-700" : "border-green-100 bg-green-50 text-green-700" },
            ].map(({ label, value, cls }) => (
              <div key={label} className={`rounded-2xl border px-4 py-4 shadow-sm ${cls}`}>
                <p className="text-[11px] font-semibold uppercase opacity-60">{label}</p>
                <p className="text-lg font-bold mt-0.5">{value}</p>
              </div>
            ))}
          </div>

          {/* Instalment Schedule */}
          {instalments.length > 0 && (
            <SectionCard title="Instalment Schedule" icon={Banknote}>
              <div className="divide-y divide-gray-50">
                {instalments.map((ins: any) => {
                  const isOverdue = !ins.isPaid && ins.dueDate && new Date(ins.dueDate) < new Date();
                  return (
                    <div key={ins.id} className="py-3.5 flex items-center gap-3">
                      <span className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        ins.isPaid ? "bg-green-100 text-green-700" : isOverdue ? "bg-red-100 text-red-600" : "bg-gray-100 text-gray-500"
                      }`}>
                        {ins.instalmentNo}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800">{ins.label ?? `Instalment ${ins.instalmentNo}`}</p>
                        {ins.dueDate && <p className="text-xs text-gray-400">Due: {fmt(ins.dueDate)}</p>}
                      </div>
                      <span className="text-sm font-bold text-gray-700 shrink-0">{fmtCurrency(ins.amount)}</span>
                      {ins.isPaid ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-100 rounded-full px-2.5 py-1">
                          <CheckCircle2 className="h-3 w-3" /> Paid
                        </span>
                      ) : (
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold rounded-full px-2.5 py-1 ${
                          isOverdue ? "text-red-600 bg-red-50 border border-red-100" : "text-amber-600 bg-amber-50 border border-amber-100"
                        }`}>
                          {isOverdue ? <><AlertCircle className="h-3 w-3" /> Overdue</> : <><Clock className="h-3 w-3" /> Pending</>}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          )}

          {/* Payment History */}
          {paymentLogs.length > 0 && (
            <SectionCard title="Payment History" icon={IndianRupee}>
              <div className="divide-y divide-gray-50">
                {paymentLogs.map((log: any) => (
                  <div key={log.id} className="py-3.5 flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-green-50 border border-green-100 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">{fmtCurrency(log.amount)}</p>
                      <p className="text-xs text-gray-400">
                        {log.paymentMode && `${log.paymentMode} · `}
                        {log.receiptNumber && `Ref: ${log.receiptNumber} · `}
                        {fmt(log.paymentDate ?? log.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
        </>
      )}

      {/* Empty */}
      {totalFee === 0 && instalments.length === 0 && !s?.admissionNumber && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center py-20 text-center">
          <ClipboardList className="h-10 w-10 text-gray-200 mb-3" />
          <p className="text-sm font-semibold text-gray-400">No admission record yet</p>
          <p className="text-xs text-gray-300 mt-1">Your fee and enrollment details will appear here once set up.</p>
        </div>
      )}
    </div>
  );
}
