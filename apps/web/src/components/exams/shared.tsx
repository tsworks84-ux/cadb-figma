"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ClipboardCheck, LayoutDashboard, ListChecks, Settings2, Search, X, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Person = { id: string; firstName: string; lastName: string; employeeCode?: string };
export type StageStatus = "NOT_STARTED" | "IN_PROGRESS" | "PENDING_APPROVAL" | "DONE" | "BYPASSED";
export type OwnerRole = "CONTROLLER" | "EXECUTIVE" | "PAPER_SETTER" | "REVIEWER";

export type ExamMe = {
  teamRole: "CONTROLLER" | "EXECUTIVE" | null;
  canViewBoard: boolean;
  canManageSettings: boolean;
  openTasks: number;
  overdueTasks: number;
  pendingApprovals: number;
};

export const OWNER_ROLE_LABEL: Record<OwnerRole, string> = {
  CONTROLLER: "Controller of Examinations",
  EXECUTIVE: "Examination Executive",
  PAPER_SETTER: "Paper setter",
  REVIEWER: "Paper reviewer",
};

export const MODE_LABEL: Record<string, string> = { PEN_PAPER: "Pen & paper", ONLINE: "Online (Learnyst)" };

export const personName = (p?: Person | null) => (p ? `${p.firstName} ${p.lastName}`.trim() : "Unassigned");

/** @db.Date values arrive as UTC midnight — format them in UTC so they never shift a day. */
export function fmtDay(iso: string | Date | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
export function fmtDayShort(iso: string | Date | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
}
export function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
export function relDays(n: number) {
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n === -1) return "yesterday";
  return n > 0 ? `in ${n} days` : `${-n} days ago`;
}

export function apiError(e: any, fallback = "Something went wrong") {
  return e?.response?.data?.error ?? fallback;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useExamMe() {
  const user = useAuthStore((s) => s.user);
  return useQuery<ExamMe>({
    queryKey: ["exam-me", user?.id],
    queryFn: () => api.get("/api/v1/exams/me").then((r) => r.data.data),
    enabled: !!user?.id,
    staleTime: 60 * 1000,
  });
}

// ─── Chrome ───────────────────────────────────────────────────────────────────

export function ExamsHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  const pathname = usePathname();
  const { data: me } = useExamMe();
  const tabs = [
    ...(me?.canViewBoard ? [{ href: "/dashboard/exams", label: "Exam Board", icon: LayoutDashboard }] : []),
    { href: "/dashboard/exams/tasks", label: "My Tasks", icon: ListChecks, badge: me?.overdueTasks || 0 },
    ...(me?.canViewBoard ? [{ href: "/dashboard/exams/settings", label: "Settings", icon: Settings2 }] : []),
  ];
  const active = (href: string) => href === "/dashboard/exams" ? pathname === href : pathname.startsWith(href);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: "#2C3E7C" }}>
            <ClipboardCheck className="text-white" size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-sm text-gray-500 uppercase tracking-wide">Examinations</p>
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 truncate">{title}</h1>
          </div>
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {subtitle && <p className="text-sm text-gray-600 -mt-2">{subtitle}</p>}
      {tabs.length > 1 && (
        <div className="flex gap-1 overflow-x-auto scrollbar-none border-b border-gray-200">
          {tabs.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                active(t.href) ? "border-[#2C3E7C] text-[#2C3E7C]" : "border-transparent text-gray-500 hover:text-gray-800 active:text-gray-900"
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
              {"badge" in t && t.badge ? (
                <span className="ml-0.5 rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">{t.badge}</span>
              ) : null}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function AccessDenied({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] text-gray-400 text-center px-4">
      <p className="text-lg font-medium">Access Denied</p>
      <p className="text-sm mt-1">{message}</p>
    </div>
  );
}

// ─── Chips ────────────────────────────────────────────────────────────────────

export function StatusChip({ status, overdue }: { status: StageStatus; overdue?: boolean }) {
  // Awaiting approval says whose court it's in even when late; the due line shows the lateness.
  if (overdue && status !== "PENDING_APPROVAL") return <Chip className="bg-red-100 text-red-700">Overdue</Chip>;
  const map: Record<StageStatus, [string, string]> = {
    NOT_STARTED: ["Not started", "bg-gray-100 text-gray-600"],
    IN_PROGRESS: ["In progress", "bg-blue-100 text-blue-700"],
    PENDING_APPROVAL: ["Awaiting approval", "bg-amber-100 text-amber-800"],
    DONE: ["Done", "bg-emerald-100 text-emerald-700"],
    BYPASSED: ["Bypassed", "bg-amber-100 text-amber-700"],
  };
  const [label, cls] = map[status];
  return <Chip className={cls}>{label}</Chip>;
}

export function HealthChip({ health }: { health: string }) {
  const map: Record<string, [string, string]> = {
    LATE: ["Late", "bg-red-100 text-red-700"],
    DUE_SOON: ["Due soon", "bg-amber-100 text-amber-700"],
    ON_TRACK: ["On track", "bg-emerald-100 text-emerald-700"],
    COMPLETE: ["Complete", "bg-slate-100 text-slate-600"],
  };
  const [label, cls] = map[health] ?? [health, "bg-gray-100 text-gray-600"];
  return <Chip className={cls}>{label}</Chip>;
}

export function Chip({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${className}`}>{children}</span>;
}

// ─── Form controls ────────────────────────────────────────────────────────────

const SELECT_CHEVRON =
  "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e\")";

export const inputCls =
  "w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400";

/** Native select drawn to match the inputs beside it (appearance-none + own chevron). */
export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { className, style, ...rest } = props;
  return (
    <select
      {...rest}
      className={`${inputCls} appearance-none pr-10 ${className ?? ""}`}
      style={{ backgroundImage: SELECT_CHEVRON, backgroundPosition: "right 0.6rem center", backgroundRepeat: "no-repeat", backgroundSize: "1.25rem", ...style }}
    />
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-gray-600 mb-1">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-gray-400 mt-1">{hint}</span>}
    </label>
  );
}

/** Search-as-you-type employee picker backed by /exams/staff. */
export function PersonPicker({
  value, onChange, placeholder = "Search staff…", disabled,
}: {
  value: Person | null;
  onChange: (p: Person | null) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => { const t = setTimeout(() => setDebounced(q), 250); return () => clearTimeout(t); }, [q]);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const { data = [], isFetching } = useQuery<(Person & { designation?: { title: string } | null })[]>({
    queryKey: ["exam-staff", debounced],
    queryFn: () => api.get("/api/v1/exams/staff", { params: { search: debounced } }).then((r) => r.data.data),
    enabled: open,
    staleTime: 60 * 1000,
  });

  if (value && !open) {
    return (
      <div className={`${inputCls} flex items-center justify-between gap-2 ${disabled ? "bg-gray-50" : ""}`}>
        <span className="truncate">{personName(value)}{value.employeeCode ? <span className="text-gray-400"> · {value.employeeCode}</span> : null}</span>
        {!disabled && (
          <button type="button" onClick={() => onChange(null)} className="text-gray-400 hover:text-gray-700 shrink-0" aria-label="Clear">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative" ref={box}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-300" />
      <input
        value={q}
        disabled={disabled}
        onFocus={() => setOpen(true)}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        placeholder={placeholder}
        className={`${inputCls} pl-9`}
      />
      {open && (
        <div className="absolute z-30 mt-1 w-full max-h-64 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
          {isFetching && data.length === 0 ? (
            <div className="flex items-center gap-2 px-3 py-3 text-sm text-gray-400"><Loader2 className="h-4 w-4 animate-spin" /> Searching…</div>
          ) : data.length === 0 ? (
            <div className="px-3 py-3 text-sm text-gray-400">No one found</div>
          ) : data.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => { onChange(p); setOpen(false); setQ(""); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 active:bg-gray-100"
            >
              <span className="font-medium text-gray-800">{personName(p)}</span>
              <span className="text-gray-400"> · {p.employeeCode}{p.designation?.title ? ` · ${p.designation.title}` : ""}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export function Modal({ title, onClose, children, footer, wide }: { title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div className={`w-full ${wide ? "sm:max-w-3xl" : "sm:max-w-lg"} max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-xl`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <div className="px-5 py-4 space-y-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 px-5 py-4 border-t border-gray-100">{footer}</div>}
      </div>
    </div>
  );
}

export const btnPrimary =
  "inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white bg-[#2C3E7C] hover:bg-[#23326a] active:bg-[#1c2856] disabled:opacity-50 disabled:cursor-not-allowed";
export const btnSecondary =
  "inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed";
export const btnDanger =
  "inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-red-700 bg-white border border-red-200 hover:bg-red-50 active:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed";
