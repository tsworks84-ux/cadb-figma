"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth";
import { ChevronLeft, ChevronRight, Clock, Save, CheckCircle2, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TimesheetEntry {
  id?:          string;
  date:         string; // ISO string or YYYY-MM-DD
  lectureHours: number;
  ptmHours:     number;
  otherHours:   number;
  otherReason:  string;
  answerScripts:number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTH_NAMES = ["January","February","March","April","May","June",
  "July","August","September","October","November","December"];

const DAY_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function toYMD(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isWeekend(d: Date) {
  const w = d.getDay();
  return w === 0 || w === 6;
}

function isFuture(ymd: string) {
  return ymd > toYMD(new Date());
}

function fmtDate(ymd: string) {
  const d = new Date(ymd + "T00:00:00");
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0, 3)}`;
}

// ── Row component ─────────────────────────────────────────────────────────────

function EntryRow({
  date,
  saved,
  onSave,
}: {
  date: string;
  saved: TimesheetEntry | undefined;
  onSave: (e: TimesheetEntry) => Promise<void>;
}) {
  const [lectureHours,  setLectureHours]  = useState(saved?.lectureHours  ?? 0);
  const [ptmHours,      setPtmHours]      = useState(saved?.ptmHours      ?? 0);
  const [otherHours,    setOtherHours]    = useState(saved?.otherHours    ?? 0);
  const [otherReason,   setOtherReason]   = useState(saved?.otherReason   ?? "");
  const [answerScripts, setAnswerScripts] = useState(saved?.answerScripts ?? 0);
  const [saving,        setSaving]        = useState(false);
  const [dirty,         setDirty]         = useState(false);

  // Sync from parent if remote data changes
  useEffect(() => {
    setLectureHours(saved?.lectureHours  ?? 0);
    setPtmHours    (saved?.ptmHours      ?? 0);
    setOtherHours  (saved?.otherHours    ?? 0);
    setOtherReason (saved?.otherReason   ?? "");
    setAnswerScripts(saved?.answerScripts ?? 0);
    setDirty(false);
  }, [saved]);

  const weekend = isWeekend(new Date(date + "T00:00:00"));
  const future  = isFuture(date);
  const disabled = future;

  const totalHours = lectureHours + ptmHours + otherHours;
  const hasSaved   = !!saved?.id;
  const d          = new Date(date + "T00:00:00");

  async function handleSave() {
    if (disabled) return;
    setSaving(true);
    try {
      await onSave({ date, lectureHours, ptmHours, otherHours, otherReason, answerScripts });
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }

  const numInput = (
    val: number,
    setter: (v: number) => void,
    placeholder = "0"
  ) => (
    <input
      type="number"
      min={0}
      max={24}
      step={0.5}
      value={val || ""}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => { setter(parseFloat(e.target.value) || 0); setDirty(true); }}
      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-gray-50 disabled:text-gray-300"
    />
  );

  return (
    <tr className={`border-b border-gray-50 ${weekend ? "bg-gray-50/60" : "bg-white"} ${future ? "opacity-40" : ""}`}>
      {/* Date */}
      <td className="px-4 py-2 whitespace-nowrap">
        <p className="text-sm font-semibold text-gray-800">{fmtDate(date)}</p>
        <p className={`text-xs ${weekend ? "text-orange-400" : "text-gray-400"}`}>{DAY_SHORT[d.getDay()]}</p>
      </td>

      {/* Lecture Hours */}
      <td className="px-3 py-2">{numInput(lectureHours, setLectureHours, "0")}</td>

      {/* PTM Hours */}
      <td className="px-3 py-2">{numInput(ptmHours, setPtmHours, "0")}</td>

      {/* Other Hours */}
      <td className="px-3 py-2">{numInput(otherHours, setOtherHours, "0")}</td>

      {/* Other Reason */}
      <td className="px-3 py-2">
        <input
          type="text"
          value={otherReason}
          disabled={disabled || otherHours === 0}
          placeholder={otherHours > 0 ? "Enter reason…" : "—"}
          maxLength={200}
          onChange={(e) => { setOtherReason(e.target.value); setDirty(true); }}
          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-gray-50 disabled:text-gray-300"
        />
      </td>

      {/* Answer Scripts */}
      <td className="px-3 py-2">
        <input
          type="number"
          min={0}
          step={1}
          value={answerScripts || ""}
          placeholder="0"
          disabled={disabled}
          onChange={(e) => { setAnswerScripts(parseInt(e.target.value) || 0); setDirty(true); }}
          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-gray-50 disabled:text-gray-300"
        />
      </td>

      {/* Total hours */}
      <td className="px-3 py-2 text-sm font-semibold text-indigo-700 text-center whitespace-nowrap">
        {totalHours > 0 ? totalHours : "—"}
      </td>

      {/* Save button */}
      <td className="px-3 py-2 text-center">
        {future ? (
          <span className="text-xs text-gray-300">—</span>
        ) : dirty ? (
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 mx-auto"
          >
            {saving ? <span className="animate-spin text-xs">⟳</span> : <Save className="h-3 w-3" />}
            Save
          </button>
        ) : hasSaved ? (
          <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
        ) : (
          <span className="text-gray-200 text-xs">—</span>
        )}
      </td>
    </tr>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TimesheetPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const queryClient = useQueryClient();

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year,  setYear]  = useState(now.getFullYear());

  const monthStr = `${year}-${String(month).padStart(2, "0")}`;

  // Redirect non-part-timers
  useEffect(() => {
    // We check from the profile query below; wait until loaded
  }, []);

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["employee", user?.id],
    queryFn: () => api.get(`/api/v1/employees/${user?.id}`).then((r) => r.data.data),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  const isPartTime = profile?.employmentType === "PART_TIME";

  const { data: entries = [], isLoading } = useQuery<TimesheetEntry[]>({
    queryKey: ["timesheet", monthStr],
    queryFn: () => api.get(`/api/v1/timesheet?month=${monthStr}`).then((r) =>
      r.data.data.map((e: any) => ({
        ...e,
        date:        e.date.slice(0, 10),
        otherReason: e.otherReason ?? "",
      }))
    ),
    enabled: isPartTime,
    staleTime: 60_000,
  });

  const saveMut = useMutation({
    mutationFn: (entry: TimesheetEntry) => api.put("/api/v1/timesheet/entry", entry),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timesheet", monthStr] });
      toast.success("Entry saved");
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed to save"),
  });

  const savedByDate = Object.fromEntries(entries.map((e) => [e.date, e]));

  // Build all days of the selected month
  const daysInMonth = new Date(year, month, 0).getDate();
  const allDates = Array.from({ length: daysInMonth }, (_, i) => {
    const d = i + 1;
    return `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  });

  // Summary
  const totalLecture  = entries.reduce((s, e) => s + e.lectureHours, 0);
  const totalPtm      = entries.reduce((s, e) => s + e.ptmHours, 0);
  const totalOther    = entries.reduce((s, e) => s + e.otherHours, 0);
  const totalScripts  = entries.reduce((s, e) => s + e.answerScripts, 0);
  const totalHours    = totalLecture + totalPtm + totalOther;

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    const next = new Date(year, month, 1);
    if (next > now) return;
    if (month === 12) { setMonth(1); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  }
  const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear();

  const handleSave = useCallback(async (entry: TimesheetEntry) => {
    await saveMut.mutateAsync(entry);
  }, [saveMut]);

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-400 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isPartTime) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center max-w-sm">
          <AlertCircle className="h-12 w-12 text-orange-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Not Applicable</h2>
          <p className="text-sm text-gray-500">Timesheet entry is only for part-time employees.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600 mb-1">Part-Time</p>
            <h1 className="text-3xl font-bold text-gray-900">My Timesheet</h1>
            <p className="text-sm text-gray-400 mt-1.5 max-w-md leading-relaxed">
              Log your daily hours for lecture sessions, PTMs, and other activities.
            </p>
          </div>
        </div>

        {/* Month nav + summary strip */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-6 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-indigo-500" />
              <h2 className="font-semibold text-gray-900">{MONTH_NAMES[month - 1]} {year}</h2>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button onClick={nextMonth} disabled={isCurrentMonth} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 disabled:opacity-30">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Summary strip */}
          <div className="grid grid-cols-5 divide-x divide-gray-100 px-0">
            {[
              { label: "Lecture Hours", value: totalLecture, color: "text-blue-700" },
              { label: "PTM Hours",     value: totalPtm,     color: "text-purple-700" },
              { label: "Other Hours",   value: totalOther,   color: "text-orange-600" },
              { label: "Answer Scripts",value: totalScripts, color: "text-green-700" },
              { label: "Total Hours",   value: totalHours,   color: "text-indigo-700" },
            ].map(({ label, value, color }) => (
              <div key={label} className="px-5 py-4">
                <p className="text-xs text-gray-400 mb-1">{label}</p>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Timesheet grid */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin h-6 w-6 border-4 border-indigo-400 border-t-transparent rounded-full" />
              </div>
            ) : (
              <table className="w-full min-w-[820px]">
                <thead className="bg-indigo-600 text-white">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider w-24">Date</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider w-28">Lecture Hours</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider w-24">PTM Hours</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider w-24">Other Hours</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider">Reason (Others)</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider w-28">Answer Scripts</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider w-20">Total Hrs</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {allDates.map((date) => (
                    <EntryRow
                      key={date}
                      date={date}
                      saved={savedByDate[date]}
                      onSave={handleSave}
                    />
                  ))}
                </tbody>
                {/* Summary footer */}
                <tfoot>
                  <tr className="bg-indigo-50 border-t-2 border-indigo-200 font-semibold">
                    <td className="px-4 py-3 text-sm text-indigo-800">Monthly Total</td>
                    <td className="px-3 py-3 text-center text-sm text-blue-700">{totalLecture}</td>
                    <td className="px-3 py-3 text-center text-sm text-purple-700">{totalPtm}</td>
                    <td className="px-3 py-3 text-center text-sm text-orange-600">{totalOther}</td>
                    <td className="px-3 py-3 text-gray-400 text-xs italic">—</td>
                    <td className="px-3 py-3 text-center text-sm text-green-700">{totalScripts} scripts</td>
                    <td className="px-3 py-3 text-center text-sm text-indigo-700">{totalHours} hrs</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>

        <p className="text-xs text-gray-400 mt-4 text-center">
          Weekends are shown in grey but can still be logged. Future dates are locked.
          Each row is saved individually — click Save after editing a row.
        </p>
      </div>
    </div>
  );
}
