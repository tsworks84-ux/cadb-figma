"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X, Check, CalendarDays, Download } from "lucide-react";

// ── Helpers ──────────────────────────────────────────────────────────────────

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function dayName(d: Date | string) { return DAY_NAMES[new Date(d).getDay()]; }

function fmtDate(d: string | Date) {
  const date = new Date(d);
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }).replace(/ /g, "-");
}

function diffDays(from: string | Date, to: string | Date): number {
  return Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000) + 1;
}

// ── Form state ────────────────────────────────────────────────────────────────

type HolidayForm = { name: string; fromDate: string; toDate: string; description: string };
const BLANK: HolidayForm = { name: "", fromDate: "", toDate: "", description: "" };

// ── Row editor ────────────────────────────────────────────────────────────────

function EditRow({
  form, onChange, onSave, onCancel, saving,
}: {
  form: HolidayForm;
  onChange: (f: HolidayForm) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const days = form.fromDate && form.toDate ? diffDays(form.fromDate, form.toDate) : "—";
  return (
    <tr className="bg-blue-50">
      <td className="px-4 py-2">
        <input
          autoFocus
          placeholder="Holiday name"
          value={form.name}
          onChange={(e) => onChange({ ...form, name: e.target.value })}
          className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
        />
        <input
          placeholder="Description (optional)"
          value={form.description}
          onChange={(e) => onChange({ ...form, description: e.target.value })}
          className="w-full mt-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 focus:border-blue-400 focus:outline-none"
        />
      </td>
      <td className="px-4 py-2">
        <input
          type="date"
          value={form.fromDate}
          onChange={(e) => onChange({ ...form, fromDate: e.target.value, toDate: e.target.value || form.toDate })}
          className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
        />
      </td>
      <td className="px-4 py-2 text-sm text-gray-500">
        {form.fromDate ? dayName(form.fromDate) : "—"}
      </td>
      <td className="px-4 py-2">
        <input
          type="date"
          value={form.toDate}
          min={form.fromDate}
          onChange={(e) => onChange({ ...form, toDate: e.target.value })}
          className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
        />
      </td>
      <td className="px-4 py-2 text-sm text-gray-500">
        {form.toDate ? dayName(form.toDate) : "—"}
      </td>
      <td className="px-4 py-2 text-center text-sm font-semibold text-gray-700">{days}</td>
      <td className="px-4 py-2">
        <div className="flex gap-1.5">
          <button
            onClick={onSave}
            disabled={saving || !form.name || !form.fromDate || !form.toDate}
            className="rounded-lg bg-blue-600 text-white px-3 py-1.5 text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-1"
          >
            <Check className="h-3 w-3" /> {saving ? "…" : "Save"}
          </button>
          <button onClick={onCancel} className="rounded-lg border border-gray-200 px-2 py-1.5 text-gray-500 hover:bg-gray-50">
            <X className="h-3 w-3" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function HolidaysPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const isAdmin = user?.role === "SUPER_ADMIN" || user?.role === "HR_ADMIN";

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<HolidayForm>(BLANK);

  const { data: holidays, isLoading } = useQuery({
    queryKey: ["holidays", year],
    queryFn: () => api.get(`/api/v1/holidays?year=${year}`).then((r) => r.data.data),
  });

  const createMut = useMutation({
    mutationFn: () => api.post("/api/v1/holidays", {
      name: form.name,
      fromDate: new Date(form.fromDate).toISOString(),
      toDate: new Date(form.toDate).toISOString(),
      description: form.description || undefined,
    }),
    onSuccess: () => {
      toast.success("Holiday added");
      setAdding(false);
      setForm(BLANK);
      qc.invalidateQueries({ queryKey: ["holidays", year] });
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });

  const updateMut = useMutation({
    mutationFn: () => api.put(`/api/v1/holidays/${editId}`, {
      name: form.name,
      fromDate: new Date(form.fromDate).toISOString(),
      toDate: new Date(form.toDate).toISOString(),
      description: form.description || undefined,
    }),
    onSuccess: () => {
      toast.success("Holiday updated");
      setEditId(null);
      setForm(BLANK);
      qc.invalidateQueries({ queryKey: ["holidays", year] });
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/holidays/${id}`),
    onSuccess: () => { toast.success("Holiday removed"); qc.invalidateQueries({ queryKey: ["holidays", year] }); },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Cannot delete"),
  });

  function startEdit(h: any) {
    setEditId(h.id);
    setAdding(false);
    setForm({
      name: h.name,
      fromDate: new Date(h.fromDate).toISOString().split("T")[0],
      toDate: new Date(h.toDate).toISOString().split("T")[0],
      description: h.description ?? "",
    });
  }

  function cancelEdit() {
    setEditId(null);
    setAdding(false);
    setForm(BLANK);
  }

  const totalDays = (holidays ?? []).reduce((s: number, h: any) => s + h.numberOfDays, 0);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Holiday Calendar</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Official holidays for {year}.{isAdmin ? " Manage the list below." : " Declared by your organisation."}
          </p>
        </div>

        {/* Year selector */}
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-gray-200 bg-white overflow-hidden">
            {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
              <button
                key={y}
                onClick={() => { setYear(y); setAdding(false); setEditId(null); }}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  year === y ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {y}–{String(y + 1).slice(-2)}
              </button>
            ))}
          </div>
          {isAdmin && (
            <button
              onClick={() => { setAdding(true); setEditId(null); setForm({ ...BLANK, fromDate: `${year}-01-01`, toDate: `${year}-01-01` }); }}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" /> Add Holiday
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
        {/* Title bar — matches the blue header in the screenshot */}
        <div className="bg-slate-700 text-white text-center py-3">
          <h2 className="text-sm font-bold uppercase tracking-wider">
            Employees' Holiday List — {year}–{String(year + 1).slice(-2)}
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-blue-100 border-b border-blue-200">
                <th className="px-4 py-3 text-left font-bold text-gray-800 uppercase text-xs tracking-wide w-1/3">Holiday</th>
                <th className="px-4 py-3 text-center font-bold text-gray-800 uppercase text-xs tracking-wide" colSpan={2}>From</th>
                <th className="px-4 py-3 text-center font-bold text-gray-800 uppercase text-xs tracking-wide" colSpan={2}>To</th>
                <th className="px-4 py-3 text-center font-bold text-gray-800 uppercase text-xs tracking-wide">No. of Days</th>
                {isAdmin && <th className="px-4 py-3 w-24" />}
              </tr>
              <tr className="bg-blue-50 border-b border-blue-100 text-xs font-semibold text-gray-500 uppercase">
                <th className="px-4 py-2" />
                <th className="px-4 py-2 text-center">Date</th>
                <th className="px-4 py-2 text-center">Day</th>
                <th className="px-4 py-2 text-center">Date</th>
                <th className="px-4 py-2 text-center">Day</th>
                <th className="px-4 py-2" />
                {isAdmin && <th className="px-4 py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={isAdmin ? 7 : 6} className="px-4 py-10 text-center text-gray-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-4 w-4 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
                      Loading…
                    </div>
                  </td>
                </tr>
              ) : !holidays?.length && !adding ? (
                <tr>
                  <td colSpan={isAdmin ? 7 : 6} className="px-4 py-14 text-center">
                    <CalendarDays className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">No holidays declared for {year}.</p>
                    {isAdmin && <p className="text-xs text-gray-400 mt-1">Use "Add Holiday" to declare the first one.</p>}
                  </td>
                </tr>
              ) : (
                <>
                  {(holidays as any[]).map((h, idx) =>
                    editId === h.id ? (
                      <EditRow
                        key={h.id}
                        form={form}
                        onChange={setForm}
                        onSave={() => updateMut.mutate()}
                        onCancel={cancelEdit}
                        saving={updateMut.isPending}
                      />
                    ) : (
                      <tr key={h.id} className={idx % 2 === 0 ? "bg-white hover:bg-gray-50" : "bg-gray-50/50 hover:bg-gray-100/50"}>
                        <td className="px-4 py-3 font-bold text-gray-800">
                          {h.name}
                          {h.description && <p className="text-xs font-normal text-gray-400 mt-0.5">{h.description}</p>}
                        </td>
                        <td className="px-4 py-3 text-center text-gray-700">{fmtDate(h.fromDate)}</td>
                        <td className="px-4 py-3 text-center text-gray-500">{dayName(h.fromDate)}</td>
                        <td className="px-4 py-3 text-center text-gray-700">{fmtDate(h.toDate)}</td>
                        <td className="px-4 py-3 text-center text-gray-500">{dayName(h.toDate)}</td>
                        <td className="px-4 py-3 text-center font-bold text-gray-800">{h.numberOfDays}</td>
                        {isAdmin && (
                          <td className="px-4 py-3">
                            <div className="flex gap-1.5 justify-end">
                              <button
                                onClick={() => startEdit(h)}
                                className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-blue-600 hover:border-blue-300"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => { if (confirm(`Remove "${h.name}"?`)) deleteMut.mutate(h.id); }}
                                disabled={deleteMut.isPending}
                                className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200 disabled:opacity-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  )}
                  {/* Inline add row */}
                  {adding && (
                    <EditRow
                      form={form}
                      onChange={setForm}
                      onSave={() => createMut.mutate()}
                      onCancel={cancelEdit}
                      saving={createMut.isPending}
                    />
                  )}
                </>
              )}

              {/* Total row */}
              {(holidays?.length > 0 || adding) && (
                <tr className="bg-blue-50 border-t-2 border-blue-200">
                  <td colSpan={isAdmin ? 5 : 5} className="px-4 py-3 text-right font-bold text-gray-700 text-sm uppercase tracking-wide">
                    Total Holidays
                  </td>
                  <td className="px-4 py-3 text-center font-bold text-blue-700 text-lg">{totalDays}</td>
                  {isAdmin && <td />}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upcoming holidays callout (employee view) */}
      {!isAdmin && holidays?.length > 0 && (() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const next = (holidays as any[]).find((h) => new Date(h.fromDate) >= today);
        if (!next) return null;
        const daysUntil = Math.round((new Date(next.fromDate).getTime() - today.getTime()) / 86_400_000);
        return (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 shrink-0">
              <CalendarDays className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-900">Next holiday: {next.name}</p>
              <p className="text-xs text-amber-700 mt-0.5">
                {fmtDate(next.fromDate)}
                {next.numberOfDays > 1 ? ` – ${fmtDate(next.toDate)} (${next.numberOfDays} days)` : ""}
                {" · "}
                {daysUntil === 0 ? "Today!" : daysUntil === 1 ? "Tomorrow" : `${daysUntil} days away`}
              </p>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
