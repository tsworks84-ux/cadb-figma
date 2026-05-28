"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { studentApi } from "@/lib/studentApi";
import { useStudentAuthStore } from "@/store/studentAuth";
import { BookOpenCheck } from "lucide-react";

const ASSIGN_STYLE: Record<string, { bar: string; bg: string; text: string; border: string; label: string }> = {
  APPROVED:      { bar: "bg-green-500",  bg: "bg-green-50",  text: "text-green-700",  border: "border-green-200",  label: "Approved"     },
  SUBMITTED:     { bar: "bg-blue-500",   bg: "bg-blue-50",   text: "text-blue-700",   border: "border-blue-200",   label: "Submitted"    },
  IN_PROCESS:    { bar: "bg-violet-500", bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200", label: "Under Review" },
  REJECTED:      { bar: "bg-orange-500", bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200", label: "Rejected"     },
  NOT_SUBMITTED: { bar: "bg-amber-400",  bg: "bg-amber-50",  text: "text-amber-700",  border: "border-amber-200",  label: "Pending"      },
  OVERDUE:       { bar: "bg-red-500",    bg: "bg-red-50",    text: "text-red-700",    border: "border-red-200",    label: "Overdue"      },
  ARCHIVED:      { bar: "bg-gray-300",   bg: "bg-gray-50",   text: "text-gray-500",   border: "border-gray-200",   label: "Archived"     },
};

const STATUS_OPTS = [
  { value: "",              label: "All Statuses"  },
  { value: "NOT_SUBMITTED", label: "Pending"       },
  { value: "OVERDUE",       label: "Overdue"       },
  { value: "SUBMITTED",     label: "Submitted"     },
  { value: "IN_PROCESS",    label: "Under Review"  },
  { value: "APPROVED",      label: "Approved"      },
  { value: "REJECTED",      label: "Rejected"      },
];

const rateTextColor = (r: number) => r >= 75 ? "text-green-600" : r >= 50 ? "text-amber-600" : "text-red-600";
const rateBarColor  = (r: number) => r >= 75 ? "bg-green-500"   : r >= 50 ? "bg-amber-500"   : "bg-red-500";

export default function StudentAssignmentsPage() {
  const { accessToken } = useStudentAuthStore();
  const today = new Date();
  const defaultFrom = new Date(today.getFullYear(), today.getMonth() - 2, 1);
  const defaultTo   = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const [dateFrom,      setDateFrom]      = useState(defaultFrom.toISOString().split("T")[0]);
  const [dateTo,        setDateTo]        = useState(defaultTo.toISOString().split("T")[0]);
  const [subjectFilter, setSubjectFilter] = useState("");
  const [statusFilter,  setStatusFilter]  = useState("");
  const [view,          setView]          = useState<"list" | "stats">("list");

  const params = new URLSearchParams({ dateFrom, dateTo });
  if (subjectFilter) params.set("subjectId", subjectFilter);

  const { data, isLoading } = useQuery({
    queryKey: ["student-portal-assignments", dateFrom, dateTo, subjectFilter],
    queryFn: () => studentApi.get(`/api/v1/student/portal/assignments?${params}`).then((r) => r.data),
    staleTime: 2 * 60 * 1000,
    enabled: !!accessToken,
  });

  const allItems: any[] = data?.data ?? [];
  const stats = data?.stats ?? { total: 0, approved: 0, submitted: 0, inProcess: 0, rejected: 0, notSubmitted: 0, overdue: 0, completionRate: 0 };
  const items = statusFilter ? allItems.filter((a) => a.displayStatus === statusFilter) : allItems;

  const subjects = useMemo(() => {
    const map = new Map<string, any>();
    for (const a of allItems) { if (a.subject) map.set(a.subject.id, a.subject); }
    return Array.from(map.values());
  }, [allItems]);

  const monthlyTrend = useMemo(() => {
    const map = new Map<string, { label: string; total: number; approved: number }>();
    for (const a of allItems) {
      if (a.status === "ARCHIVED") continue;
      const d = new Date(a.submissionDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
      if (!map.has(key)) map.set(key, { label, total: 0, approved: 0 });
      const e = map.get(key)!;
      e.total++;
      if (a.displayStatus === "APPROVED") e.approved++;
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, v]) => ({ ...v, rate: v.total > 0 ? Math.round((v.approved / v.total) * 100) : 0 }));
  }, [allItems]);

  const subjectBreakdown = useMemo(() => {
    const map = new Map<string, { id: string; name: string; code: string; total: number; approved: number; overdue: number }>();
    for (const a of allItems) {
      if (!a.subject || a.status === "ARCHIVED") continue;
      const key = a.subject.id;
      if (!map.has(key)) map.set(key, { ...a.subject, total: 0, approved: 0, overdue: 0 });
      const e = map.get(key)!;
      e.total++;
      if (a.displayStatus === "APPROVED") e.approved++;
      if (a.displayStatus === "OVERDUE")  e.overdue++;
    }
    return Array.from(map.values()).map((s) => ({
      ...s,
      rate: s.total > 0 ? Math.round((s.approved / s.total) * 100) : 0,
    }));
  }, [allItems]);

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <BookOpenCheck className="h-5 w-5 text-amber-500" />
        <h1 className="text-lg font-bold text-gray-900">My Assignments</h1>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden shrink-0">
            {(["list", "stats"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                  view === v ? "bg-emerald-600 text-white" : "text-gray-500 hover:bg-gray-50"
                }`}>
                {v === "list" ? "Assignment List" : "Statistics"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-gray-400 font-medium whitespace-nowrap">From</label>
              <input type="date" max="2099-12-31" min="1900-01-01" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-700 focus:outline-none focus:border-emerald-400" />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-gray-400 font-medium whitespace-nowrap">To</label>
              <input type="date" max="2099-12-31" min="1900-01-01" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-700 focus:outline-none focus:border-emerald-400" />
            </div>
          </div>
          {subjects.length > 0 && (
            <select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}
              className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-700 bg-white focus:outline-none focus:border-emerald-400">
              <option value="">All Subjects</option>
              {subjects.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
              ))}
            </select>
          )}
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-700 bg-white focus:outline-none focus:border-emerald-400">
            {STATUS_OPTS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Assigned", value: String(stats.total),          color: "text-gray-800",  bg: "bg-white"     },
          { label: "Approved",       value: String(stats.approved),       color: "text-green-700", bg: "bg-green-50"  },
          { label: "Overdue",        value: String(stats.overdue),        color: "text-red-700",   bg: "bg-red-50"    },
          { label: "Completion %",   value: `${stats.completionRate}%`,   color: rateTextColor(stats.completionRate), bg: "bg-emerald-50" },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`${bg} rounded-xl border border-gray-100 px-4 py-3 text-center`}>
            <p className={`text-2xl font-black ${color}`}>{isLoading ? "—" : value}</p>
            <p className="text-xs text-gray-400 mt-0.5 font-medium">{label}</p>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="h-6 w-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 text-center">
          <BookOpenCheck className="h-8 w-8 text-gray-200 mb-3" />
          <p className="text-sm font-semibold text-gray-400">No assignments found</p>
          <p className="text-xs text-gray-400 mt-1">Try adjusting the date range or filters.</p>
        </div>
      ) : view === "list" ? (
        <div className="space-y-2">
          {items.map((a: any) => {
            const style  = ASSIGN_STYLE[a.displayStatus] ?? ASSIGN_STYLE.NOT_SUBMITTED;
            const dueFmt = new Date(a.submissionDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
            const asnFmt = new Date(a.assignmentDate).toLocaleDateString("en-IN",  { day: "2-digit", month: "short" });
            return (
              <div key={a.id} className={`bg-white rounded-xl border ${style.border} flex overflow-hidden`}>
                <div className={`w-1.5 shrink-0 ${style.bar}`} />
                <div className="flex-1 px-4 py-3 flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4 min-w-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{a.name}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                      {a.subject && (
                        <span className="text-xs text-emerald-600 font-medium">{a.subject.name} ({a.subject.code})</span>
                      )}
                      {a.faculty && (
                        <span className="text-xs text-gray-400">{a.faculty.firstName} {a.faculty.lastName}</span>
                      )}
                    </div>
                    {a.topics && <p className="text-xs text-gray-400 truncate mt-0.5">{a.topics}</p>}
                    {a.submission?.reviewNote && (
                      <p className="text-xs text-orange-600 mt-0.5 italic">"{a.submission.reviewNote}"</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 sm:flex-col sm:items-end shrink-0">
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Assigned {asnFmt}</p>
                      <p className="text-xs font-medium text-gray-600">Due {dueFmt}</p>
                    </div>
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${style.bg} ${style.text}`}>
                      {style.label}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Big completion rate */}
          <div className="bg-white rounded-xl border border-gray-100 p-6 flex flex-col sm:flex-row items-center gap-6">
            <div className="text-center shrink-0">
              <p className={`text-5xl font-black ${rateTextColor(stats.completionRate)}`}>{stats.completionRate}%</p>
              <p className="text-xs text-gray-400 mt-1 font-medium">Completion Rate</p>
              <p className="text-xs text-gray-300 mt-0.5">{stats.approved} of {stats.total} approved</p>
            </div>
            <div className="flex-1 w-full grid grid-cols-3 sm:grid-cols-6 gap-2">
              {[
                { label: "Pending",   value: stats.notSubmitted, color: "text-amber-700",  bg: "bg-amber-50"  },
                { label: "Overdue",   value: stats.overdue,      color: "text-red-700",    bg: "bg-red-50"    },
                { label: "Submitted", value: stats.submitted,    color: "text-blue-700",   bg: "bg-blue-50"   },
                { label: "In Review", value: stats.inProcess,    color: "text-violet-700", bg: "bg-violet-50" },
                { label: "Approved",  value: stats.approved,     color: "text-green-700",  bg: "bg-green-50"  },
                { label: "Rejected",  value: stats.rejected,     color: "text-orange-700", bg: "bg-orange-50" },
              ].map(({ label, value, color, bg }) => (
                <div key={label} className={`${bg} rounded-lg px-3 py-2 text-center`}>
                  <p className={`text-lg font-black ${color}`}>{value}</p>
                  <p className="text-[10px] text-gray-400 font-medium">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Monthly trend */}
          {monthlyTrend.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-50">
                <p className="text-sm font-semibold text-gray-800">Monthly Completion Trend</p>
              </div>
              <div className="px-5 py-4 space-y-3">
                {monthlyTrend.map((m) => (
                  <div key={m.label} className="flex items-center gap-3">
                    <p className="text-xs font-medium text-gray-500 w-20 shrink-0">{m.label}</p>
                    <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div className={`h-2 rounded-full transition-all ${rateBarColor(m.rate)}`}
                        style={{ width: `${m.rate}%` }} />
                    </div>
                    <p className={`text-xs font-bold w-9 text-right shrink-0 ${rateTextColor(m.rate)}`}>{m.rate}%</p>
                    <p className="text-xs text-gray-400 w-16 text-right shrink-0">{m.approved}/{m.total}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Subject breakdown */}
          {subjectBreakdown.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-50">
                <p className="text-sm font-semibold text-gray-800">Subject-wise Breakdown</p>
              </div>
              <div className="divide-y divide-gray-50">
                {subjectBreakdown.map((s) => (
                  <div key={s.id} className="px-5 py-3 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{s.name}</p>
                      <p className="text-xs text-gray-400">{s.code}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-green-600 font-medium">{s.approved} done</span>
                      {s.overdue > 0 && <span className="text-xs text-red-500 font-medium">{s.overdue} overdue</span>}
                      <span className="text-xs text-gray-300">·</span>
                      <span className={`text-sm font-black ${rateTextColor(s.rate)}`}>{s.rate}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
