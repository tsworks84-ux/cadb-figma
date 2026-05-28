"use client";

import { useStudentAuthStore } from "@/store/studentAuth";
import { useQuery } from "@tanstack/react-query";
import { studentApi } from "@/lib/studentApi";
import { ClipboardList, IndianRupee, CheckCircle2, Clock, AlertCircle, Banknote, GraduationCap } from "lucide-react";

function Section({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-50">
        <Icon className="h-4 w-4 text-emerald-500" />
        <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-medium text-gray-400">{label}</p>
      <p className="text-sm text-gray-800">{value || <span className="text-gray-300">—</span>}</p>
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
    queryFn: () => studentApi.get("/api/v1/student/portal/profile").then((r) => r.data.data),
    staleTime: 2 * 60 * 1000,
    enabled: !!accessToken,
  });

  if (isLoading || !profile) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
            <div className="h-4 w-40 bg-gray-100 rounded animate-pulse" />
            <div className="grid grid-cols-3 gap-4">
              {[1, 2, 3].map((j) => (
                <div key={j} className="space-y-1">
                  <div className="h-3 w-20 bg-gray-100 rounded animate-pulse" />
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
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5">
      {/* Enrollment Details */}
      <Section title="Enrollment Details" icon={ClipboardList}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
          <Field label="Admission Number" value={s?.admissionNumber} />
          <Field label="Admission Date"   value={fmt(s?.admissionDate)} />
          <Field label="Academic Year"    value={s?.academicYear} />
          <Field label="Grade"            value={s?.grade?.name} />
          <Field label="Course"           value={s?.course?.name} />
          <Field label="School"           value={s?.school?.name} />
        </div>
      </Section>

      {/* Batches */}
      {s?.studentBatches?.length > 0 && (
        <Section title="Current Batches" icon={GraduationCap}>
          <div className="space-y-3">
            {(s.studentBatches as any[]).map((sb: any) => (
              <div key={sb.id} className="flex items-center gap-3 rounded-lg bg-gray-50 border border-gray-100 px-4 py-2.5">
                <GraduationCap className="h-4 w-4 text-emerald-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800">{sb.batch?.name}</p>
                  <p className="text-xs text-gray-400">
                    {sb.batch?.academicYear}
                    {sb.batch?.grade?.name ? ` · ${sb.batch.grade.name}` : ""}
                    {sb.batch?.location?.name ? ` · ${sb.batch.location.name}` : ""}
                  </p>
                </div>
                <p className="text-xs text-gray-400 shrink-0">Joined {fmt(sb.joinedAt)}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Fee Summary */}
      {totalFee > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { label: "Total Fee",   value: fmtCurrency(totalFee),   color: "border-blue-100  bg-blue-50  text-blue-700"  },
              { label: "Paid",        value: fmtCurrency(paidFee),    color: "border-green-100 bg-green-50 text-green-700" },
              { label: "Discount",    value: fmtCurrency(discount),   color: "border-amber-100 bg-amber-50 text-amber-700" },
              { label: "Balance Due", value: fmtCurrency(balanceDue), color: balanceDue > 0 ? "border-red-100 bg-red-50 text-red-700" : "border-green-100 bg-green-50 text-green-700" },
            ].map(({ label, value, color }) => (
              <div key={label} className={`rounded-xl border px-4 py-3 ${color}`}>
                <p className="text-xs font-medium opacity-70">{label}</p>
                <p className="text-lg font-bold mt-0.5">{value}</p>
              </div>
            ))}
          </div>

          {/* Instalment Schedule */}
          {instalments.length > 0 && (
            <Section title="Instalment Schedule" icon={Banknote}>
              <div className="divide-y divide-gray-50">
                {instalments.map((ins: any) => {
                  const isOverdue = !ins.isPaid && ins.dueDate && new Date(ins.dueDate) < new Date();
                  return (
                    <div key={ins.id} className="py-3 flex items-center gap-3">
                      <span className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${ins.isPaid ? "bg-green-100 text-green-700" : isOverdue ? "bg-red-100 text-red-600" : "bg-gray-100 text-gray-500"}`}>
                        {ins.instalmentNo}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800">{ins.label ?? `Instalment ${ins.instalmentNo}`}</p>
                        {ins.dueDate && <p className="text-xs text-gray-400">Due: {fmt(ins.dueDate)}</p>}
                      </div>
                      <span className="text-sm font-bold text-gray-700 shrink-0">{fmtCurrency(ins.amount)}</span>
                      {ins.isPaid ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-100 rounded-full px-2.5 py-1">
                          <CheckCircle2 className="h-3 w-3" /> Paid
                        </span>
                      ) : (
                        <span className={`inline-flex items-center gap-1 text-xs font-medium rounded-full px-2.5 py-1 ${isOverdue ? "text-red-600 bg-red-50 border border-red-100" : "text-amber-600 bg-amber-50 border border-amber-100"}`}>
                          {isOverdue ? <><AlertCircle className="h-3 w-3" /> Overdue</> : <><Clock className="h-3 w-3" /> Pending</>}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          {/* Payment History */}
          {paymentLogs.length > 0 && (
            <Section title="Payment History" icon={IndianRupee}>
              <div className="divide-y divide-gray-50">
                {paymentLogs.map((log: any) => (
                  <div key={log.id} className="py-3 flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-green-50 flex items-center justify-center shrink-0">
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
            </Section>
          )}
        </>
      )}

      {/* Empty state when no admission data */}
      {totalFee === 0 && instalments.length === 0 && !s?.admissionNumber && (
        <div className="bg-white rounded-xl border border-gray-100 flex flex-col items-center justify-center py-16 text-center">
          <ClipboardList className="h-10 w-10 text-gray-200 mb-3" />
          <p className="text-sm font-semibold text-gray-400">No admission record yet</p>
          <p className="text-xs text-gray-300 mt-1">Your fee and enrollment details will appear here once set up by admin.</p>
        </div>
      )}
    </div>
  );
}
