"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  ArrowLeft, User, Briefcase, IndianRupee,
  Copy, CheckCircle2, Mail, Loader2, Plus, Trash2, AlertTriangle,
  FileText, Check, AlertCircle, ChevronRight,
} from "lucide-react";

// ── Zod schema ────────────────────────────────────────────────────────────────
const schema = z.object({
  firstName:      z.string().min(1, "Required"),
  lastName:       z.string().min(1, "Required"),
  middleName:     z.string().optional(),
  gender:         z.enum(["MALE", "FEMALE", "OTHER"], { required_error: "Required" }),
  dateOfBirth:    z.string().optional(),
  email:          z.string().email("Invalid email"),
  personalEmail:  z.string().email("Invalid email").optional().or(z.literal("")),
  personalPhone:  z.string().length(10, "Must be 10 digits"),
  departmentId:   z.string().min(1, "Select a department"),
  designationId:  z.string().min(1, "Select a designation"),
  reportingToId:  z.string().optional(),
  employmentType: z.enum(["FULL_TIME", "PART_TIME", "CONTRACT", "VISITING", "INTERN"]),
  joiningDate:    z.string().min(1, "Required"),
  role:           z.enum(["SUPER_ADMIN", "HR_ADMIN", "DEPT_HEAD", "EMPLOYEE"]).default("EMPLOYEE"),
  initialPassword: z.string().min(8, "Min 8 chars").optional().or(z.literal("")),
});
type FormData = z.infer<typeof schema>;

const STEPS = [
  { id: "identity",   label: "Identity & Contact", sub: "Basic profile",       icon: User },
  { id: "employment", label: "Employment Details",  sub: "Role and reporting",  icon: Briefcase },
  { id: "salary",     label: "Salary Setup",        sub: "Compensation",        icon: IndianRupee },
];

// ── Tiny UI helpers ───────────────────────────────────────────────────────────
function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-medium text-gray-700 mb-1.5">
      {children}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}
function FieldError({ message }: { message?: string }) {
  return message ? <p className="mt-1 text-xs text-red-500">{message}</p> : null;
}
function Input({ className = "", ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input {...props}
      className={`w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${className}`}
    />
  );
}
function SelectEl({ className = "", children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={`w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none bg-white ${className}`}>
      {children}
    </select>
  );
}
function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl border border-gray-100 bg-gray-50/50">
      <div>
        <p className="text-sm font-medium text-gray-700">{label}</p>
        {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none ${checked ? "bg-blue-600" : "bg-gray-200"}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
      </button>
    </div>
  );
}
function SectionCard({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-sm font-bold text-gray-800">{title}</h2>
        {hint && <span className="text-xs text-gray-400">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n);
}

// ── Searchable Reporting-To combobox ─────────────────────────────────────────
function ReportingToCombobox({ employees, value, onChange }: {
  employees: any[] | undefined; value: string | undefined; onChange: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = employees?.find((e) => e.id === value);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = useMemo(() => {
    if (!employees) return [];
    const q = query.toLowerCase();
    return employees.filter((e) => !q || `${e.firstName} ${e.lastName} ${e.employeeCode}`.toLowerCase().includes(q)).slice(0, 8);
  }, [employees, query]);

  return (
    <div ref={ref} className="relative">
      <Input
        type="text"
        placeholder="Search by name or code…"
        value={open ? query : (selected ? `${selected.firstName} ${selected.lastName} (${selected.employeeCode})` : "")}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => { setQuery(""); setOpen(true); }}
        autoComplete="off"
      />
      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
          {filtered.length === 0 && query && <p className="px-4 py-3 text-sm text-gray-400">No match for &ldquo;{query}&rdquo;</p>}
          {filtered.map((e) => (
            <button key={e.id} type="button" onMouseDown={() => { onChange(e.id); setQuery(""); setOpen(false); }}
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 flex items-center justify-between">
              <span className="font-medium text-gray-900">{e.firstName} {e.lastName}</span>
              <span className="text-xs text-gray-400 font-mono">{e.employeeCode}</span>
            </button>
          ))}
          {value && (
            <button type="button" onMouseDown={() => { onChange(""); setQuery(""); setOpen(false); }}
              className="w-full text-left px-4 py-2.5 text-xs text-gray-400 hover:bg-gray-50 border-t border-gray-100">
              Clear selection
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Income-tax computation (FY 2025-26) ──────────────────────────────────────
interface TaxResult {
  grossAnnual: number; stdDed: number; totalDed: number;
  taxableIncome: number; taxBeforeRebate: number;
  rebate: number; cess: number; totalAnnual: number; monthly: number;
}
function slabTax(income: number, slabs: { upto: number; rate: number }[]): number {
  let tax = 0; let prev = 0;
  for (const s of slabs) {
    if (income <= prev) break;
    tax += (Math.min(income, s.upto) - prev) * s.rate;
    prev = s.upto;
  }
  return tax;
}
function calcNewRegimeTax(grossAnnual: number): TaxResult {
  const stdDed = 75000;
  const taxableIncome = Math.max(0, grossAnnual - stdDed);
  const taxBeforeRebate = Math.round(slabTax(taxableIncome, [
    { upto: 400000, rate: 0 }, { upto: 800000, rate: 0.05 }, { upto: 1200000, rate: 0.10 },
    { upto: 1600000, rate: 0.15 }, { upto: 2000000, rate: 0.20 }, { upto: 2400000, rate: 0.25 },
    { upto: Infinity, rate: 0.30 },
  ]));
  const rebate = taxableIncome <= 1200000 ? taxBeforeRebate : 0;
  const cess   = Math.round((taxBeforeRebate - rebate) * 0.04);
  return { grossAnnual, stdDed, totalDed: stdDed, taxableIncome, taxBeforeRebate, rebate, cess, totalAnnual: taxBeforeRebate - rebate + cess, monthly: Math.round((taxBeforeRebate - rebate + cess) / 12) };
}
function calcOldRegimeTax(grossAnnual: number, hraExempt: number, ded80c: number, ded80d: number, profTaxAnnual: number): TaxResult {
  const stdDed = 50000;
  const cap80c = Math.min(ded80c, 150000);
  const cap80d = Math.min(ded80d, 100000);
  const totalDed = stdDed + hraExempt + cap80c + cap80d + profTaxAnnual;
  const taxableIncome = Math.max(0, grossAnnual - totalDed);
  const taxBeforeRebate = Math.round(slabTax(taxableIncome, [
    { upto: 250000, rate: 0 }, { upto: 500000, rate: 0.05 }, { upto: 1000000, rate: 0.20 }, { upto: Infinity, rate: 0.30 },
  ]));
  const rebate = taxableIncome <= 500000 ? Math.min(taxBeforeRebate, 12500) : 0;
  const cess   = Math.round((taxBeforeRebate - rebate) * 0.04);
  return { grossAnnual, stdDed, totalDed, taxableIncome, taxBeforeRebate, rebate, cess, totalAnnual: taxBeforeRebate - rebate + cess, monthly: Math.round((taxBeforeRebate - rebate + cess) / 12) };
}

// ── Salary form types ─────────────────────────────────────────────────────────
type BonusCriteria = { name: string; weightage: string; description: string };
interface FullTimeSalary {
  ctcAnnual: string; basicPct: string; hraPct: string; conveyance: string; medical: string;
  pfApplicable: boolean; esicApplicable: boolean; professionalTax: string;
  taxRegime: "new" | "old"; monthlyTDS: string; tdsOverride: boolean;
  oldRegimeHRAExempt: string; oldRegime80C: string; oldRegime80D: string;
  bonusPct: string; bonusCriteria: BonusCriteria[];
}
interface PartTimeSalary { lectureRatePerHour: string; ptmRatePerHour: string; answerScriptRate: string; }
interface ContractSalary { retainershipPerMonth: string; travelAllowancePerMonth: string; }
interface VisitingSalary { remunerationPerVisit: string; }

const DEFAULT_FT: FullTimeSalary = {
  ctcAnnual: "", basicPct: "40", hraPct: "50", conveyance: "1600", medical: "1250",
  pfApplicable: true, esicApplicable: false, professionalTax: "200", taxRegime: "new",
  monthlyTDS: "", tdsOverride: false, oldRegimeHRAExempt: "", oldRegime80C: "150000", oldRegime80D: "25000",
  bonusPct: "10",
  bonusCriteria: [
    { name: "Students' Performance", weightage: "40", description: "" },
    { name: "Academic Operations",   weightage: "30", description: "" },
    { name: "Admissions",            weightage: "20", description: "" },
  ],
};
const DEFAULT_PT: PartTimeSalary = { lectureRatePerHour: "", ptmRatePerHour: "", answerScriptRate: "" };
const DEFAULT_CT: ContractSalary = { retainershipPerMonth: "", travelAllowancePerMonth: "" };
const DEFAULT_VI: VisitingSalary = { remunerationPerVisit: "" };

// ── Full-time salary form ─────────────────────────────────────────────────────
function FullTimeSalaryForm({ state, setState }: { state: FullTimeSalary; setState: (s: FullTimeSalary) => void }) {
  const set = (k: keyof FullTimeSalary) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setState({ ...state, [k]: (e.target as HTMLInputElement).type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value });

  const ctc = parseFloat(state.ctcAnnual) || 0;
  const ctcM = ctc / 12;
  const basic = ctcM * (parseFloat(state.basicPct) || 40) / 100;
  const hra = basic * (parseFloat(state.hraPct) || 50) / 100;
  const conv = parseFloat(state.conveyance) || 0;
  const med = parseFloat(state.medical) || 0;
  const pfBase = Math.min(basic, 15000);
  const pfEmp = state.pfApplicable ? Math.round(pfBase * 0.12) : 0;
  const pfEmpr = state.pfApplicable ? Math.round(pfBase * 0.13) : 0;
  const esicEmp = state.esicApplicable && basic <= 21000 ? Math.round(basic * 0.0075) : 0;
  const esicEmpr = state.esicApplicable && basic <= 21000 ? Math.round(basic * 0.0325) : 0;
  const specAllow = Math.max(0, ctcM - basic - hra - conv - med - pfEmpr);
  const gross = basic + hra + conv + med + specAllow;
  const grossAnnual = gross * 12;
  const profTax = parseFloat(state.professionalTax) || 0;
  const bonusAnnual = ctc * (parseFloat(state.bonusPct) || 0) / 100;
  const totalWt = state.bonusCriteria.reduce((s, c) => s + (parseFloat(c.weightage) || 0), 0);

  const hraExemptDefault = Math.round(Math.min(hra * 12, basic * 12 * 0.50));
  const hraExempt = parseFloat(state.oldRegimeHRAExempt) || (state.oldRegimeHRAExempt === "0" ? 0 : hraExemptDefault);
  const ded80c = parseFloat(state.oldRegime80C) || 150000;
  const ded80d = parseFloat(state.oldRegime80D) || 25000;

  const taxResult = state.taxRegime === "new"
    ? calcNewRegimeTax(grossAnnual)
    : calcOldRegimeTax(grossAnnual, hraExempt, ded80c, ded80d, profTax * 12);

  const autoTDS = taxResult.monthly;
  const effectiveTDS = state.tdsOverride ? (parseFloat(state.monthlyTDS) || 0) : autoTDS;
  const deductions = pfEmp + esicEmp + profTax + effectiveTDS;
  const netTakeHome = gross - deductions;

  const [expandedCriteria, setExpandedCriteria] = useState<number | null>(null);
  function addCriteria() {
    const next = state.bonusCriteria.length;
    setState({ ...state, bonusCriteria: [...state.bonusCriteria, { name: "", weightage: "", description: "" }] });
    setExpandedCriteria(next);
  }
  function removeCriteria(i: number) {
    setState({ ...state, bonusCriteria: state.bonusCriteria.filter((_, j) => j !== i) });
    setExpandedCriteria(null);
  }
  function updateCriteria(i: number, field: keyof BonusCriteria, val: string) {
    setState({ ...state, bonusCriteria: state.bonusCriteria.map((c, j) => j === i ? { ...c, [field]: val } : c) });
  }
  function TaxRow({ label, value, sub, color }: { label: string; value: number | string; sub?: boolean; color?: string }) {
    return (
      <div className={`flex justify-between py-1 text-xs ${sub ? "text-gray-400 pl-2" : "text-gray-700"}`}>
        <span>{label}</span>
        <span className={color ?? ""}>{typeof value === "number" ? `₹${fmt(value)}` : value}</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div><Label required>Annual CTC (₹)</Label>
        <Input type="number" min={0} value={state.ctcAnnual} onChange={set("ctcAnnual")} placeholder="e.g. 600000" />
        {ctc > 0 && <p className="text-xs text-gray-400 mt-1">Monthly CTC: ₹{fmt(ctcM)}</p>}
      </div>
      <div className="rounded-xl border border-gray-200 p-4 space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Earnings Breakdown</p>
        <div className="grid grid-cols-2 gap-3">
          <div><Label required>Basic (% of CTC)</Label>
            <div className="flex items-center gap-2">
              <Input type="number" min={1} max={70} value={state.basicPct} onChange={set("basicPct")} className="w-20" />
              <span className="text-sm text-gray-400">% → ₹{fmt(basic)}/mo</span>
            </div>
          </div>
          <div><Label required>HRA (% of Basic)</Label>
            <div className="flex items-center gap-2">
              <Input type="number" min={1} max={100} value={state.hraPct} onChange={set("hraPct")} className="w-20" />
              <span className="text-sm text-gray-400">% → ₹{fmt(hra)}/mo</span>
            </div>
          </div>
          <div><Label>Conveyance (₹/mo)</Label><Input type="number" min={0} value={state.conveyance} onChange={set("conveyance")} placeholder="1600" /></div>
          <div><Label>Medical (₹/mo)</Label><Input type="number" min={0} value={state.medical} onChange={set("medical")} placeholder="1250" /></div>
        </div>
        {ctc > 0 && <div className="rounded-lg bg-gray-50 px-3 py-2 flex items-center justify-between text-sm">
          <span className="text-gray-500">Special Allowance (auto)</span>
          <span className="font-medium text-gray-700">₹{fmt(specAllow)}/mo</span>
        </div>}
      </div>
      <div className="rounded-xl border border-gray-200 p-4 space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Deductions</p>
        <div className="flex items-center gap-5">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={state.pfApplicable} onChange={(e) => setState({ ...state, pfApplicable: e.target.checked })} className="h-4 w-4 rounded border-gray-300 text-blue-600" />
            <span className="text-sm text-gray-700">PF Applicable</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={state.esicApplicable} onChange={(e) => setState({ ...state, esicApplicable: e.target.checked })} className="h-4 w-4 rounded border-gray-300 text-blue-600" />
            <span className="text-sm text-gray-700">ESIC Applicable</span>
          </label>
        </div>
        {state.pfApplicable && ctc > 0 && <p className="text-xs text-gray-400">PF on ₹{fmt(pfBase)}: Employee ₹{fmt(pfEmp)}/mo · Employer ₹{fmt(pfEmpr)}/mo</p>}
        {state.esicApplicable && basic > 21000 && <p className="text-xs text-orange-500">ESIC not applicable — Basic &gt; ₹21,000/mo</p>}
        {state.esicApplicable && basic <= 21000 && ctc > 0 && <p className="text-xs text-gray-400">ESIC: Employee ₹{fmt(esicEmp)}/mo (0.75%) · Employer ₹{fmt(esicEmpr)}/mo (3.25%)</p>}
        <div><Label>Professional Tax (₹/mo)</Label><Input type="number" min={0} value={state.professionalTax} onChange={set("professionalTax")} placeholder="200" className="max-w-[200px]" /></div>
      </div>
      <div className="rounded-xl border border-gray-200 p-4 space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Income Tax / TDS</p>
        <div className="grid grid-cols-2 gap-3">
          {(["new", "old"] as const).map((r) => (
            <label key={r} className={`flex items-center gap-3 rounded-lg border-2 px-3 py-2.5 cursor-pointer transition-colors ${state.taxRegime === r ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"}`}>
              <input type="radio" name="taxRegime" value={r} checked={state.taxRegime === r} onChange={() => setState({ ...state, taxRegime: r })} className="accent-blue-600" />
              <div>
                <p className="text-sm font-semibold text-gray-800">{r === "new" ? "New Regime" : "Old Regime"}</p>
                <p className="text-xs text-gray-400">{r === "new" ? "FY 2025-26 · Std ded ₹75,000" : "HRA exempt + 80C/80D"}</p>
              </div>
            </label>
          ))}
        </div>
        {state.taxRegime === "old" && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 space-y-3">
            <p className="text-xs font-semibold text-amber-700">Old Regime Deductions</p>
            <div className="grid grid-cols-3 gap-2">
              <div><label className="block text-xs text-gray-600 mb-1">HRA Exempt (₹/yr)</label><Input type="number" min={0} value={state.oldRegimeHRAExempt} onChange={set("oldRegimeHRAExempt")} placeholder={`${hraExemptDefault}`} className="text-xs" /><p className="text-xs text-gray-400 mt-0.5">Auto: ₹{fmt(hraExemptDefault)}</p></div>
              <div><label className="block text-xs text-gray-600 mb-1">Sec 80C (₹/yr)</label><Input type="number" min={0} max={150000} value={state.oldRegime80C} onChange={set("oldRegime80C")} placeholder="150000" className="text-xs" /><p className="text-xs text-gray-400 mt-0.5">Cap ₹1.5L</p></div>
              <div><label className="block text-xs text-gray-600 mb-1">Sec 80D (₹/yr)</label><Input type="number" min={0} max={100000} value={state.oldRegime80D} onChange={set("oldRegime80D")} placeholder="25000" className="text-xs" /><p className="text-xs text-gray-400 mt-0.5">Cap ₹1L</p></div>
            </div>
          </div>
        )}
        {ctc > 0 && (
          <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5 space-y-0.5">
            <TaxRow label="Annual Gross Salary" value={grossAnnual} />
            <TaxRow label={`Less: Standard Deduction`} value={`−₹${fmt(state.taxRegime === "new" ? 75000 : 50000)}`} sub />
            {state.taxRegime === "old" && <>
              <TaxRow label="Less: HRA Exemption" value={`−₹${fmt(hraExempt)}`} sub />
              <TaxRow label="Less: Sec 80C" value={`−₹${fmt(Math.min(ded80c, 150000))}`} sub />
              <TaxRow label="Less: Sec 80D" value={`−₹${fmt(Math.min(ded80d, 100000))}`} sub />
              {profTax > 0 && <TaxRow label="Less: Professional Tax" value={`−₹${fmt(profTax * 12)}`} sub />}
            </>}
            <div className="border-t border-gray-200 mt-1 pt-1">
              <TaxRow label="Taxable Income" value={taxResult.taxableIncome} />
              <TaxRow label="Income Tax (slab-wise)" value={taxResult.taxBeforeRebate} />
              {taxResult.rebate > 0 && <TaxRow label={state.taxRegime === "new" ? "Rebate u/s 87A (≤₹12L)" : "Rebate u/s 87A (≤₹5L)"} value={`−₹${fmt(taxResult.rebate)}`} sub color="text-green-600" />}
              <TaxRow label="Health & Education Cess @4%" value={taxResult.cess} sub />
            </div>
            <div className="border-t border-gray-300 mt-1 pt-1 flex justify-between text-xs font-bold text-gray-800"><span>Annual Tax Liability</span><span>₹{fmt(taxResult.totalAnnual)}</span></div>
            <div className="flex justify-between text-xs font-bold text-blue-700"><span>Monthly TDS (÷12)</span><span>₹{fmt(autoTDS)}/mo</span></div>
          </div>
        )}
        <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600">
          <input type="checkbox" checked={state.tdsOverride} onChange={(e) => setState({ ...state, tdsOverride: e.target.checked, monthlyTDS: e.target.checked ? String(autoTDS) : "" })} className="h-4 w-4 rounded border-gray-300" />
          Override TDS amount
        </label>
        {state.tdsOverride && <div><Label>Custom Monthly TDS (₹)</Label><Input type="number" min={0} value={state.monthlyTDS} onChange={set("monthlyTDS")} placeholder={String(autoTDS)} className="max-w-[200px]" /><p className="text-xs text-gray-400 mt-0.5">Auto-computed: ₹{fmt(autoTDS)}/mo</p></div>}
      </div>
      {ctc > 0 && (
        <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 grid grid-cols-3 gap-3 text-center">
          <div><p className="text-xs text-blue-500 font-semibold uppercase tracking-wide">Gross/Month</p><p className="text-base font-bold text-blue-800">₹{fmt(gross)}</p></div>
          <div><p className="text-xs text-blue-500 font-semibold uppercase tracking-wide">Deductions</p><p className="text-base font-bold text-blue-800">₹{fmt(deductions)}</p></div>
          <div><p className="text-xs text-blue-500 font-semibold uppercase tracking-wide">Net Take-Home</p><p className="text-base font-bold text-green-700">₹{fmt(netTakeHome)}</p></div>
        </div>
      )}
      <div className="rounded-xl border border-gray-200 p-4 space-y-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Performance Bonus</p>
        <div className="flex items-center gap-3">
          <div className="w-40"><Label>Bonus (% of CTC)</Label><div className="flex items-center gap-2"><Input type="number" min={0} max={50} value={state.bonusPct} onChange={set("bonusPct")} className="w-20" /><span className="text-sm text-gray-400">%</span></div></div>
          {ctc > 0 && bonusAnnual > 0 && <p className="text-xs text-gray-400 mt-4">Annual bonus target: ₹{fmt(bonusAnnual)}</p>}
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-gray-600">Bonus Criteria</p>
            <button type="button" onClick={addCriteria} className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"><Plus className="h-3 w-3" /> Add Criteria</button>
          </div>
          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Criteria</th>
                <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500 w-28">Weightage (%)</th>
                <th className="px-3 py-2 w-8" />
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {state.bonusCriteria.map((c, i) => (
                  <>
                    <tr key={i} className="align-middle">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <input type="text" value={c.name} onChange={(e) => updateCriteria(i, "name", e.target.value)} className="flex-1 text-sm border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-1" placeholder="Criteria name" />
                          <button type="button" onClick={() => setExpandedCriteria(expandedCriteria === i ? null : i)}
                            className={`relative shrink-0 rounded p-1 transition-colors ${expandedCriteria === i ? "bg-blue-100 text-blue-600" : c.description ? "bg-blue-50 text-blue-500 hover:bg-blue-100" : "text-gray-300 hover:text-gray-500"}`}>
                            <FileText className="h-3.5 w-3.5" />
                            {c.description && expandedCriteria !== i && <span className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-blue-500" />}
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-2"><input type="number" min={0} max={100} value={c.weightage} onChange={(e) => updateCriteria(i, "weightage", e.target.value)} className="w-full text-sm border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-1 text-center" placeholder="0" /></td>
                      <td className="px-3 py-2"><button type="button" onClick={() => removeCriteria(i)} className="text-gray-300 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button></td>
                    </tr>
                    {expandedCriteria === i && (
                      <tr key={`${i}-desc`}><td colSpan={3} className="px-3 pb-3">
                        <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
                          <p className="text-[11px] font-semibold text-blue-600 uppercase tracking-wide mb-1.5">Description / KRA Details</p>
                          <textarea autoFocus value={c.description} onChange={(e) => updateCriteria(i, "description", e.target.value)} rows={4} placeholder="Describe what this criteria measures…" className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-gray-700 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                          <div className="flex justify-end mt-1.5"><button type="button" onClick={() => setExpandedCriteria(null)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Done</button></div>
                        </div>
                      </td></tr>
                    )}
                  </>
                ))}
                <tr className={Math.abs(totalWt - 100) < 0.01 ? "bg-green-50" : totalWt > 0 ? "bg-orange-50" : "bg-gray-50"}>
                  <td className="px-3 py-2 text-xs font-semibold text-gray-500">Total</td>
                  <td className={`px-3 py-2 text-center text-xs font-bold ${Math.abs(totalWt - 100) < 0.01 ? "text-green-600" : "text-orange-600"}`}>{totalWt}%{totalWt > 0 && Math.abs(totalWt - 100) >= 0.01 && <span className="ml-1 font-normal">(should be 100)</span>}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function PartTimeSalaryForm({ state, setState }: { state: PartTimeSalary; setState: (s: PartTimeSalary) => void }) {
  const lecture = parseFloat(state.lectureRatePerHour) || 0;
  const ptm     = parseFloat(state.ptmRatePerHour)     || 0;
  const script  = parseFloat(state.answerScriptRate)   || 0;
  const rows = [
    { label: "Lecture (per hour)", rate: lecture, unit: "/hr" },
    { label: "PTM (per hour)", rate: ptm, unit: "/hr" },
    { label: "Answer Script (per student)", rate: script, unit: "/student" },
  ].filter((r) => r.rate > 0);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Per Hour Rate — Lectures (₹)</Label><Input type="number" min={0} value={state.lectureRatePerHour} onChange={(e) => setState({ ...state, lectureRatePerHour: e.target.value })} placeholder="e.g. 500" /></div>
        <div><Label>Per Hour Rate — PTMs (₹)</Label><Input type="number" min={0} value={state.ptmRatePerHour} onChange={(e) => setState({ ...state, ptmRatePerHour: e.target.value })} placeholder="e.g. 300" /></div>
      </div>
      <div><Label>Per Student — Answer Script Evaluation (₹)</Label><Input type="number" min={0} value={state.answerScriptRate} onChange={(e) => setState({ ...state, answerScriptRate: e.target.value })} placeholder="e.g. 50" /></div>
      {rows.length > 0 && (
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-3 py-2 border-b border-gray-100"><p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">TDS Breakdown (u/s 194J @10%)</p></div>
          <table className="w-full text-sm"><thead><tr className="border-b border-gray-100"><th className="px-3 py-2 text-left text-xs text-gray-400 font-semibold">Type</th><th className="px-3 py-2 text-right text-xs text-gray-400 font-semibold">Rate</th><th className="px-3 py-2 text-right text-xs text-red-400 font-semibold">TDS @10%</th><th className="px-3 py-2 text-right text-xs text-green-600 font-semibold">Net</th></tr></thead>
            <tbody className="divide-y divide-gray-50">{rows.map((r) => (<tr key={r.label}><td className="px-3 py-2 text-gray-700">{r.label}</td><td className="px-3 py-2 text-right text-gray-800 font-medium">₹{fmt(r.rate)}{r.unit}</td><td className="px-3 py-2 text-right text-red-500">−₹{fmt(r.rate * 0.1)}</td><td className="px-3 py-2 text-right text-green-700 font-semibold">₹{fmt(r.rate * 0.9)}</td></tr>))}</tbody>
          </table>
          <p className="px-3 py-2 text-xs text-gray-400 bg-gray-50 border-t border-gray-100">Actual take-home depends on hours / units worked each month.</p>
        </div>
      )}
    </div>
  );
}

function ContractSalaryForm({ state, setState }: { state: ContractSalary; setState: (s: ContractSalary) => void; label: string }) {
  const ret    = parseFloat(state.retainershipPerMonth)    || 0;
  const travel = parseFloat(state.travelAllowancePerMonth) || 0;
  const tds    = Math.round(ret * 0.10);
  const net    = ret - tds + travel;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Retainership per Month (₹)</Label><Input type="number" min={0} value={state.retainershipPerMonth} onChange={(e) => setState({ ...state, retainershipPerMonth: e.target.value })} placeholder="e.g. 30000" /></div>
        <div><Label>Travel Allowance per Month (₹)</Label><Input type="number" min={0} value={state.travelAllowancePerMonth} onChange={(e) => setState({ ...state, travelAllowancePerMonth: e.target.value })} placeholder="e.g. 2000" /></div>
      </div>
      {ret > 0 && (
        <>
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-3 py-2 border-b border-gray-100"><p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">TDS Breakdown (u/s 194C @10%)</p></div>
            <div className="divide-y divide-gray-50">
              <div className="flex justify-between px-3 py-2 text-sm"><span className="text-gray-500">Retainership / month</span><span className="font-medium text-gray-800">₹{fmt(ret)}</span></div>
              <div className="flex justify-between px-3 py-2 text-sm"><span className="text-gray-500">TDS @10%</span><span className="font-medium text-red-500">−₹{fmt(tds)}</span></div>
              {travel > 0 && <div className="flex justify-between px-3 py-2 text-sm"><span className="text-gray-500">Travel Allowance</span><span className="font-medium text-gray-800">+₹{fmt(travel)}</span></div>}
            </div>
          </div>
          <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 grid grid-cols-3 gap-3 text-center">
            <div><p className="text-xs text-blue-500 font-semibold uppercase tracking-wide">Retainership</p><p className="text-base font-bold text-blue-800">₹{fmt(ret)}</p></div>
            <div><p className="text-xs text-red-400 font-semibold uppercase tracking-wide">TDS (10%)</p><p className="text-base font-bold text-red-600">−₹{fmt(tds)}</p></div>
            <div><p className="text-xs text-green-600 font-semibold uppercase tracking-wide">Net Take-Home</p><p className="text-base font-bold text-green-700">₹{fmt(net)}</p></div>
          </div>
        </>
      )}
    </div>
  );
}

function VisitingSalaryForm({ state, setState }: { state: VisitingSalary; setState: (s: VisitingSalary) => void }) {
  const rev = parseFloat(state.remunerationPerVisit) || 0;
  const tds = Math.round(rev * 0.10);
  const net = rev - tds;
  return (
    <div className="space-y-4">
      <div><Label>Remuneration per Visit (₹)</Label><Input type="number" min={0} value={state.remunerationPerVisit} onChange={(e) => setState({ ...state, remunerationPerVisit: e.target.value })} placeholder="e.g. 2000" /></div>
      {rev > 0 && (
        <>
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-3 py-2 border-b border-gray-100"><p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">TDS Breakdown (u/s 194J @10%)</p></div>
            <div className="divide-y divide-gray-50">
              <div className="flex justify-between px-3 py-2 text-sm"><span className="text-gray-500">Remuneration / visit</span><span className="font-medium text-gray-800">₹{fmt(rev)}</span></div>
              <div className="flex justify-between px-3 py-2 text-sm"><span className="text-gray-500">TDS @10%</span><span className="font-medium text-red-500">−₹{fmt(tds)}</span></div>
            </div>
          </div>
          <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 grid grid-cols-3 gap-3 text-center">
            <div><p className="text-xs text-blue-500 font-semibold uppercase tracking-wide">Per Visit</p><p className="text-base font-bold text-blue-800">₹{fmt(rev)}</p></div>
            <div><p className="text-xs text-red-400 font-semibold uppercase tracking-wide">TDS (10%)</p><p className="text-base font-bold text-red-600">−₹{fmt(tds)}</p></div>
            <div><p className="text-xs text-green-600 font-semibold uppercase tracking-wide">Net per Visit</p><p className="text-base font-bold text-green-700">₹{fmt(net)}</p></div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Credentials Dialog ────────────────────────────────────────────────────────
function CredentialsDialog({ employeeId, employeeCode, temporaryPassword, personalEmail, onAddAnother, onGoToList, onViewProfile }: {
  employeeId: string; employeeCode: string; temporaryPassword: string; personalEmail?: string | null;
  onAddAnother: () => void; onGoToList: () => void; onViewProfile: () => void;
}) {
  const [sending, setSending] = useState(false);
  const [sent, setSent]       = useState(false);

  async function sendCredentials() {
    if (!personalEmail) return;
    setSending(true);
    try {
      await api.post(`/api/v1/employees/${employeeId}/send-credentials`, { email: personalEmail, password: temporaryPassword });
      setSent(true); toast.success("Credentials sent");
    } catch { toast.error("Failed to send email"); }
    finally { setSending(false); }
  }
  function copy(text: string, label: string) { navigator.clipboard.writeText(text); toast.success(`${label} copied`); }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div className="bg-green-50 px-6 py-5 flex items-start gap-4 border-b border-green-100">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
          </div>
          <div><h2 className="text-lg font-bold text-gray-900">Employee Created!</h2><p className="text-sm text-gray-500 mt-0.5">Share these credentials with the employee.</p></div>
        </div>
        <div className="px-6 py-5 space-y-3">
          <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div><p className="text-xs text-gray-400 uppercase font-semibold tracking-wide">Employee Code</p><p className="text-base font-bold font-mono text-gray-900 mt-0.5">{employeeCode}</p></div>
              <button onClick={() => copy(employeeCode, "Code")} className="text-gray-400 hover:text-gray-700"><Copy className="h-4 w-4" /></button>
            </div>
            <div className="border-t border-gray-100 pt-3 flex items-center justify-between gap-2">
              <div><p className="text-xs text-gray-400 uppercase font-semibold tracking-wide">Temporary Password</p><p className="text-base font-bold font-mono text-orange-700 mt-0.5">{temporaryPassword}</p></div>
              <button onClick={() => copy(temporaryPassword, "Password")} className="text-gray-400 hover:text-gray-700"><Copy className="h-4 w-4" /></button>
            </div>
          </div>
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">Employee must change password on first login and complete their profile.</p>
          </div>
          {personalEmail && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0"><p className="text-xs font-semibold text-blue-700">Send to personal email</p><p className="text-xs text-blue-600 truncate">{personalEmail}</p></div>
              <button onClick={sendCredentials} disabled={sending || sent} className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
                {sending ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending&hellip;</> : sent ? <><CheckCircle2 className="h-3.5 w-3.5" /> Sent</> : <><Mail className="h-3.5 w-3.5" /> Send Email</>}
              </button>
            </div>
          )}
        </div>
        <div className="flex gap-2 px-6 pb-6">
          <button onClick={onGoToList} className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium hover:bg-gray-50">Employee List</button>
          <button onClick={onViewProfile} className="flex-1 rounded-lg py-2.5 text-sm font-semibold text-white" style={{ backgroundColor: "#2C3E7C" }}>View / Complete Profile →</button>
          <button onClick={onAddAnother} className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium hover:bg-gray-50">Add Another</button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function NewEmployeePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [created, setCreated] = useState<{
    id: string; employeeCode: string; temporaryPassword: string; personalEmail?: string | null;
  } | null>(null);

  const [sendCredentials, setSendCredentials] = useState(true);
  const [activateAccount, setActivateAccount] = useState(true);

  const [ftSalary, setFtSalary] = useState<FullTimeSalary>(DEFAULT_FT);
  const [ptSalary, setPtSalary] = useState<PartTimeSalary>(DEFAULT_PT);
  const [ctSalary, setCtSalary] = useState<ContractSalary>(DEFAULT_CT);
  const [viSalary, setViSalary] = useState<VisitingSalary>(DEFAULT_VI);
  const salarySkippedRef = useRef(false);

  const { register, trigger, getValues, setValue, watch, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { employmentType: "FULL_TIME", role: "EMPLOYEE" },
  });

  const firstName      = watch("firstName");
  const lastName       = watch("lastName");
  const gender         = watch("gender");
  const email          = watch("email");
  const personalPhone  = watch("personalPhone");
  const personalEmail  = watch("personalEmail");
  const employmentType = watch("employmentType");
  const reportingToId  = watch("reportingToId");
  const role           = watch("role");
  const departmentId   = watch("departmentId");
  const designationId  = watch("designationId");
  const joiningDate    = watch("joiningDate");
  const [workLocation, setWorkLocation] = useState("");

  const { data: departments } = useQuery({ queryKey: ["departments"], queryFn: () => api.get("/api/v1/departments").then((r) => r.data.data), staleTime: Infinity });
  const { data: designations } = useQuery({ queryKey: ["designations"], queryFn: () => api.get("/api/v1/designations").then((r) => r.data.data), staleTime: Infinity });
  const { data: employees }    = useQuery({ queryKey: ["employees-list"], queryFn: () => api.get("/api/v1/employees", { params: { limit: 500 } }).then((r) => r.data.data), staleTime: Infinity });
  const { data: workLocations } = useQuery({ queryKey: ["work-locations"], queryFn: () => api.get("/api/v1/work-locations").then((r) => r.data.data as { id: string; name: string }[]), staleTime: Infinity });
  const { data: customRoles = [] } = useQuery<{ name: string; label: string }[]>({ queryKey: ["custom-roles"], queryFn: () => api.get("/api/v1/roles/custom").then((r) => r.data.data), staleTime: 5 * 60 * 1000 });

  // ── Live checklist for Step 1 ─────────────────────────────────────────────
  const checklist = [
    { label: "Name details", desc: "First and last name completed.", ok: !!(firstName?.trim() && lastName?.trim()) },
    { label: "Login email",  desc: "Official email is available.",   ok: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email ?? "") },
    { label: "Gender",       desc: "Select gender before moving ahead.", ok: !!gender, warn: true },
    { label: "Contact number", desc: "10-digit mobile number entered.", ok: (personalPhone ?? "").length === 10 },
  ];
  const completedCount = checklist.filter((c) => c.ok).length;
  const totalRequired  = checklist.length;

  // ── Initials for avatar ───────────────────────────────────────────────────
  const initials = [firstName?.[0], lastName?.[0]].filter(Boolean).join("").toUpperCase() || "?";
  const displayName = [firstName, lastName].filter(Boolean).join(" ") || "New Employee";

  // ── Employment preview values ─────────────────────────────────────────────
  const deptName         = departments?.find((d: any) => d.id === departmentId)?.name ?? "";
  const designationTitle = designations?.find((d: any) => d.id === designationId)?.title ?? "";
  const managerEmp       = employees?.find((e: any) => e.id === reportingToId);
  const managerName      = managerEmp ? `${managerEmp.firstName} ${managerEmp.lastName}` : "";
  const ROLE_LABELS: Record<string, string> = { EMPLOYEE: "Employee", DEPT_HEAD: "Manager", HR_ADMIN: "Admin", SUPER_ADMIN: "Super Admin" };
  const roleLabel        = ROLE_LABELS[role ?? "EMPLOYEE"] ?? "Employee";
  const joiningDateDisplay = joiningDate
    ? new Date(joiningDate + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
    : "";
  const empDetailsReady  = !!(departmentId && designationId && joiningDate);

  function buildSalaryConfig() {
    if (salarySkippedRef.current) return null;
    switch (employmentType) {
      case "FULL_TIME": {
        if (!ftSalary.ctcAnnual) return null;
        const ctcAnnual = parseFloat(ftSalary.ctcAnnual);
        const ctcM = ctcAnnual / 12;
        const basicPct = parseFloat(ftSalary.basicPct) || 40;
        const hraPct   = parseFloat(ftSalary.hraPct) || 50;
        const basic    = ctcM * basicPct / 100;
        const hra      = basic * hraPct / 100;
        const conv     = parseFloat(ftSalary.conveyance) || 0;
        const med      = parseFloat(ftSalary.medical) || 0;
        const pfEmpr   = ftSalary.pfApplicable ? Math.round(Math.min(basic, 15000) * 0.13) : 0;
        const specAllow = Math.max(0, ctcM - basic - hra - conv - med - pfEmpr);
        const gross    = basic + hra + conv + med + specAllow;
        const grossAnnual = gross * 12;
        const profTax  = parseFloat(ftSalary.professionalTax) || 0;
        const hraExemptDef = Math.round(Math.min(hra * 12, basic * 12 * 0.50));
        const hraExempt = parseFloat(ftSalary.oldRegimeHRAExempt) || (ftSalary.oldRegimeHRAExempt === "0" ? 0 : hraExemptDef);
        const ded80c   = parseFloat(ftSalary.oldRegime80C) || 150000;
        const ded80d   = parseFloat(ftSalary.oldRegime80D) || 25000;
        const taxResult = ftSalary.taxRegime === "new" ? calcNewRegimeTax(grossAnnual) : calcOldRegimeTax(grossAnnual, hraExempt, ded80c, ded80d, profTax * 12);
        const monthlyTDS = ftSalary.tdsOverride ? (parseFloat(ftSalary.monthlyTDS) || 0) : taxResult.monthly;
        return { ctcAnnual, basicPct, hraPct, conveyance: conv, medical: med, pfApplicable: ftSalary.pfApplicable, esicApplicable: ftSalary.esicApplicable, professionalTax: profTax, taxRegime: ftSalary.taxRegime, monthlyTDS, oldRegimeHRAExempt: hraExempt, oldRegime80C: ded80c, oldRegime80D: ded80d, bonusPct: parseFloat(ftSalary.bonusPct) || 0, bonusCriteria: ftSalary.bonusCriteria.filter((c) => c.name.trim()).map((c) => ({ name: c.name.trim(), weightage: parseFloat(c.weightage) || 0, description: c.description?.trim() || "" })) };
      }
      case "PART_TIME": {
        if (!ptSalary.lectureRatePerHour && !ptSalary.ptmRatePerHour && !ptSalary.answerScriptRate) return null;
        return { lectureRatePerHour: parseFloat(ptSalary.lectureRatePerHour) || 0, ptmRatePerHour: parseFloat(ptSalary.ptmRatePerHour) || 0, answerScriptRatePerStudent: parseFloat(ptSalary.answerScriptRate) || 0 };
      }
      case "CONTRACT": case "INTERN": {
        if (!ctSalary.retainershipPerMonth) return null;
        return { retainershipPerMonth: parseFloat(ctSalary.retainershipPerMonth) || 0, tdsPercentage: 10, travelAllowancePerMonth: parseFloat(ctSalary.travelAllowancePerMonth) || 0 };
      }
      case "VISITING": {
        if (!viSalary.remunerationPerVisit) return null;
        return { remunerationPerVisit: parseFloat(viSalary.remunerationPerVisit) || 0, tdsPercentage: 10 };
      }
    }
    return null;
  }

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const empRes = await api.post("/api/v1/employees", {
        firstName: data.firstName, lastName: data.lastName, middleName: data.middleName || undefined,
        gender: data.gender, dateOfBirth: data.dateOfBirth || undefined,
        email: data.email, personalEmail: data.personalEmail?.includes("@") ? data.personalEmail : undefined,
        personalPhone: data.personalPhone, departmentId: data.departmentId, designationId: data.designationId,
        reportingToId: data.reportingToId || undefined, employmentType: data.employmentType,
        joiningDate: data.joiningDate, role: data.role, initialPassword: data.initialPassword || undefined,
        workLocation: workLocation || undefined,
      });
      const emp = empRes.data.data;
      const config = buildSalaryConfig();
      if (config) await api.post(`/api/v1/employees/${emp.id}/salary-config`, { employmentType: data.employmentType, config }).catch(() => {});
      return emp;
    },
    onSuccess: (emp) => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      setCreated({ id: emp.id, employeeCode: emp.employeeCode, temporaryPassword: emp.temporaryPassword, personalEmail: emp.personalEmail });
    },
    onError: (err: any) => {
      const data = err.response?.data;
      if (data?.details) toast.error(`Validation failed — check: ${Object.keys(data.details).join(", ")}`);
      else toast.error(data?.error ?? "Failed to create employee");
    },
  });

  const stepFields: Record<number, (keyof FormData)[]> = {
    0: ["firstName", "lastName", "gender", "email", "personalPhone"],
    1: ["departmentId", "designationId", "employmentType", "joiningDate"],
  };

  async function nextStep() {
    const valid = await trigger(stepFields[step] ?? []);
    if (valid) setStep((s) => s + 1);
  }

  async function handleCreate(skipSalary: boolean) {
    salarySkippedRef.current = skipSalary;
    const step0OK = await trigger(["firstName", "lastName", "gender", "email", "personalPhone", "personalEmail"]);
    if (!step0OK) { setStep(0); toast.error("Complete Identity & Contact fields first"); return; }
    const step1OK = await trigger(["departmentId", "designationId", "employmentType", "joiningDate"]);
    if (!step1OK) { setStep(1); toast.error("Complete Employment Details first"); return; }
    createMutation.mutate(getValues());
  }

  async function handleSaveDraft() {
    const step0OK = await trigger(["firstName", "lastName", "gender", "email", "personalPhone"]);
    if (!step0OK) { setStep(0); toast.error("Complete Identity & Contact fields first"); return; }
    const step1OK = await trigger(["departmentId", "designationId", "employmentType", "joiningDate"]);
    if (!step1OK) { setStep(1); toast.error("Complete Employment Details to save draft"); return; }
    salarySkippedRef.current = true;
    draftMutation.mutate(getValues());
  }

  const draftMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const empRes = await api.post("/api/v1/employees", {
        firstName: data.firstName, lastName: data.lastName, middleName: data.middleName || undefined,
        gender: data.gender, dateOfBirth: data.dateOfBirth || undefined,
        email: data.email, personalEmail: data.personalEmail?.includes("@") ? data.personalEmail : undefined,
        personalPhone: data.personalPhone, departmentId: data.departmentId, designationId: data.designationId,
        reportingToId: data.reportingToId || undefined, employmentType: data.employmentType,
        joiningDate: data.joiningDate, role: data.role, workLocation: workLocation || undefined,
        isDraft: true,
      });
      return empRes.data.data;
    },
    onSuccess: (emp) => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success(`Draft saved — ${emp.employeeCode}`);
      router.push("/dashboard/employees");
    },
    onError: (err: any) => {
      const data = err.response?.data;
      if (data?.details) toast.error(`Validation failed — check: ${Object.keys(data.details).join(", ")}`);
      else toast.error(data?.error ?? "Failed to save draft");
    },
  });

  function resetAll() {
    setCreated(null); setStep(0); salarySkippedRef.current = false;
    setFtSalary(DEFAULT_FT); setPtSalary(DEFAULT_PT); setCtSalary(DEFAULT_CT); setViSalary(DEFAULT_VI);
    reset();
  }

  const nextLabel = step === 0 ? "Next: Employment Details" : step === 1 ? "Next: Salary Setup" : "Create Employee";

  return (
    <>
      {created && (
        <CredentialsDialog
          employeeId={created.id} employeeCode={created.employeeCode}
          temporaryPassword={created.temporaryPassword} personalEmail={created.personalEmail}
          onGoToList={() => router.push("/dashboard/employees")}
          onViewProfile={() => router.push(`/dashboard/employees/${created.id}`)}
          onAddAnother={resetAll}
        />
      )}

      {/* Full-page layout */}
      <div className="flex flex-col min-h-[calc(100vh-4rem)] -mx-6 -my-6">

        {/* ── Top header bar ── */}
        <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Add Employee</h1>
              <p className="text-xs text-gray-400 mt-0.5">Add a new employee to your team, send login details, and conduct a successful step-by-step onboarding.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={draftMutation.isPending || createMutation.isPending}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-60 transition-colors"
            >
              {draftMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin inline mr-1" />Saving…</> : "Save Draft"}
            </button>
            <button
              type="button"
              onClick={step < STEPS.length - 1 ? nextStep : () => handleCreate(false)}
              disabled={createMutation.isPending || draftMutation.isPending}
              className="flex items-center gap-1.5 rounded-lg px-5 py-2 text-sm font-semibold text-white disabled:opacity-60 transition-colors"
              style={{ backgroundColor: "#2C3E7C" }}
            >
              {createMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</> : step < STEPS.length - 1 ? <>Next Step <ChevronRight className="h-4 w-4" /></> : "Create Employee"}
            </button>
          </div>
        </div>

        {/* ── Step indicator ── */}
        <div className="bg-white border-b border-gray-100 px-6 py-5 shrink-0">
          <div className="flex items-center justify-between max-w-lg mx-auto">
            {STEPS.map((s, i) => {
              const StepIcon = s.icon;
              const isActive   = i === step;
              const isComplete = i < step;
              return (
                <div key={s.id} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1">
                    <button
                      type="button"
                      onClick={() => setStep(i)}
                      className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 transition-colors ${
                        isComplete ? "bg-green-100" : ""
                      }`}
                      style={isActive ? { backgroundColor: "#2C3E7C" } : isComplete ? {} : { backgroundColor: "#f3f4f6" }}
                    >
                      {isComplete
                        ? <CheckCircle2 className="text-green-600" size={20} />
                        : <StepIcon className={isActive ? "text-white" : "text-gray-500"} size={20} />
                      }
                    </button>
                    <p className={`text-xs font-medium text-center ${isActive ? "text-gray-900" : "text-gray-500"}`}>
                      {s.label}
                    </p>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-2 mb-5 ${isComplete ? "bg-green-400" : "bg-gray-200"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Main content area ── */}
        <div className="flex-1 overflow-auto bg-gray-50">
          <div className="flex gap-6 px-6 py-6 max-w-[1200px] mx-auto">

            {/* ── Form column ── */}
            <form onSubmit={(e) => e.preventDefault()} className="flex-1 min-w-0 space-y-4">

              {/* Step 0: Identity & Contact */}
              {step === 0 && (
                <>
                  <div className="flex items-center gap-3 p-4 rounded-lg mb-2" style={{ backgroundColor: "#2C3E7C" }}>
                    <CheckCircle2 className="text-white shrink-0" size={22} />
                    <div className="text-white">
                      <p className="font-semibold text-sm">Identity & Contact</p>
                      <p className="text-xs text-blue-200">Basics of the new employee</p>
                    </div>
                  </div>
                  <SectionCard title="Legal Name" hint="Shown on HR records">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label required>First name</Label>
                        <Input {...register("firstName")} placeholder="Priya" autoFocus />
                        <FieldError message={errors.firstName?.message} />
                      </div>
                      <div>
                        <Label>Middle name</Label>
                        <Input {...register("middleName")} placeholder="Optional" />
                      </div>
                      <div>
                        <Label required>Last name</Label>
                        <Input {...register("lastName")} placeholder="Sharma" />
                        <FieldError message={errors.lastName?.message} />
                      </div>
                    </div>
                  </SectionCard>

                  <SectionCard title="Personal Details" hint="Used for employee profile">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label required>Gender</Label>
                        <SelectEl {...register("gender")}>
                          <option value="">Select gender</option>
                          <option value="FEMALE">Female</option>
                          <option value="MALE">Male</option>
                          <option value="OTHER">Other</option>
                        </SelectEl>
                        <FieldError message={errors.gender?.message} />
                      </div>
                      <div>
                        <Label>Date of birth</Label>
                        <Input {...register("dateOfBirth")} type="date" max="2099-12-31" min="1900-01-01" />
                      </div>
                      <div>
                        <Label>Employee code</Label>
                        <Input value="" readOnly disabled placeholder="Auto-generated on create" className="bg-gray-50 text-gray-400 cursor-not-allowed" />
                      </div>
                    </div>
                  </SectionCard>

                  <SectionCard title="Contact" hint="Login and communication">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <Label required>Contact number</Label>
                        <Input {...register("personalPhone")} type="tel" placeholder="9876543210" maxLength={10} />
                        <FieldError message={errors.personalPhone?.message} />
                      </div>
                      <div>
                        <Label>Personal email</Label>
                        <Input {...register("personalEmail")} type="email" placeholder="priya@gmail.com" />
                        <p className="text-xs text-gray-400 mt-1">Optional, useful for sending credentials.</p>
                        <FieldError message={errors.personalEmail?.message} />
                      </div>
                    </div>
                    <div>
                      <Label required>Official email</Label>
                      <Input {...register("email")} type="email" placeholder="priya@centumacademy.com" />
                      <p className="text-xs text-gray-400 mt-1">This becomes the login identifier.</p>
                      <FieldError message={errors.email?.message} />
                    </div>
                  </SectionCard>

                  <SectionCard title="Account Setup" hint="Can be changed later">
                    <div className="grid grid-cols-2 gap-3">
                      <Toggle
                        checked={sendCredentials}
                        onChange={setSendCredentials}
                        label="Send login credentials"
                        description="Email the employee once the profile is created."
                      />
                      <Toggle
                        checked={activateAccount}
                        onChange={setActivateAccount}
                        label="Activate employee account"
                        description="Employee can access the dashboard after setup."
                      />
                    </div>
                  </SectionCard>
                </>
              )}

              {/* Step 1: Employment Details */}
              {step === 1 && (
                <div className="rounded-xl border border-gray-100 bg-white overflow-hidden">
                  {/* Card header */}
                  <div className="px-6 py-5 border-b border-gray-100" style={{ backgroundColor: "#2C3E7C" }}>
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="text-white shrink-0" size={22} />
                      <div className="text-white">
                        <p className="font-semibold text-sm">Employment Details</p>
                        <p className="text-xs text-blue-200">Required for job assignment, reporting line, and access</p>
                      </div>
                    </div>
                  </div>

                  {/* Job Assignment */}
                  <div className="px-6 py-5 border-b border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-sm font-semibold text-gray-700">Job Assignment</p>
                      <span className="text-xs text-gray-400">Primary employee placement</span>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label required>Department</Label>
                        <SelectEl {...register("departmentId")}>
                          <option value="">Select department</option>
                          {departments?.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </SelectEl>
                        <FieldError message={errors.departmentId?.message} />
                      </div>
                      <div>
                        <Label required>Designation</Label>
                        <SelectEl {...register("designationId")}>
                          <option value="">Select designation</option>
                          {designations?.map((d: any) => <option key={d.id} value={d.id}>{d.title}</option>)}
                        </SelectEl>
                        <FieldError message={errors.designationId?.message} />
                      </div>
                      <div>
                        <Label required>Employment type</Label>
                        <SelectEl {...register("employmentType")}>
                          <option value="FULL_TIME">Full Time</option>
                          <option value="PART_TIME">Part Time</option>
                          <option value="CONTRACT">Contract</option>
                          <option value="VISITING">Visiting</option>
                          <option value="INTERN">Intern</option>
                        </SelectEl>
                      </div>
                    </div>
                  </div>

                  {/* Reporting & Joining */}
                  <div className="px-6 py-5 border-b border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-sm font-semibold text-gray-700">Reporting & Joining</p>
                      <span className="text-xs text-gray-400">Manager and start date</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div>
                        <Label>Reporting to</Label>
                        <input type="hidden" {...register("reportingToId")} />
                        <ReportingToCombobox employees={employees} value={reportingToId} onChange={(id) => setValue("reportingToId", id)} />
                        <p className="text-xs text-gray-400 mt-1">Search by name, employee code, or department.</p>
                      </div>
                      <div>
                        <Label required>Joining date</Label>
                        <Input {...register("joiningDate")} type="date" max="2099-12-31" min="1900-01-01" />
                        <FieldError message={errors.joiningDate?.message} />
                      </div>
                    </div>
                    {managerEmp && (
                      <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-sm font-bold">
                          {`${managerEmp.firstName?.[0] ?? ""}${managerEmp.lastName?.[0] ?? ""}`.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900">{managerEmp.firstName} {managerEmp.lastName}</p>
                          <p className="text-xs text-gray-400">{managerEmp.designation?.title ?? managerEmp.employeeCode} · Reports for approvals, leave, and reviews</p>
                        </div>
                        <span className="shrink-0 text-xs font-medium text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">Manager selected</span>
                      </div>
                    )}
                  </div>

                  {/* Access Level */}
                  <div className="px-6 py-5 border-b border-gray-100">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-semibold text-gray-700">Access Level</p>
                      <span className="text-xs text-gray-400">Dashboard permissions</span>
                    </div>
                    <SelectEl value={role} onChange={(e) => setValue("role", e.target.value as any)}>
                      <optgroup label="System Roles">
                        <option value="EMPLOYEE">Employee — Self-service dashboard, tasks, leaves, policies and training</option>
                        <option value="DEPT_HEAD">Manager (Dept Head) — Team visibility, leave approvals, task review and reports</option>
                        <option value="HR_ADMIN">HR Admin — Employee data, notice board, policies and configuration</option>
                        <option value="SUPER_ADMIN">Super Admin — Full unrestricted access</option>
                      </optgroup>
                      {customRoles.length > 0 && (
                        <optgroup label="Custom Roles">
                          {customRoles.map((r) => (
                            <option key={r.name} value={r.name}>{r.label}</option>
                          ))}
                        </optgroup>
                      )}
                    </SelectEl>
                  </div>

                  {/* Login Setup */}
                  <div className="px-6 py-5">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-sm font-semibold text-gray-700">Login Setup</p>
                      <span className="text-xs text-gray-400">Optional password override</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Initial password</Label>
                        <Input {...register("initialPassword")} type="text" placeholder={`Centum@${new Date().getFullYear()} (auto)`} className="font-mono" />
                        <p className="text-xs text-gray-400 mt-1">Leave blank to auto-generate. Employee changes this on first login.</p>
                        <FieldError message={errors.initialPassword?.message} />
                      </div>
                      <div>
                        <Label>Work location</Label>
                        <SelectEl value={workLocation} onChange={(e) => setWorkLocation(e.target.value)}>
                          <option value="">Select location</option>
                          {(workLocations ?? []).map((loc) => (
                            <option key={loc.id} value={loc.name}>{loc.name}</option>
                          ))}
                        </SelectEl>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Salary Setup */}
              {step === 2 && (
                <>
                  <div className="flex items-center gap-3 p-4 rounded-lg" style={{ backgroundColor: "#2C3E7C" }}>
                    <CheckCircle2 className="text-white shrink-0" size={22} />
                    <div className="text-white">
                      <p className="font-semibold text-sm">Salary Setup</p>
                      <p className="text-xs text-blue-200">Configure compensation structure</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 rounded-xl bg-blue-50 border border-blue-200 px-4 py-3">
                    <AlertTriangle className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-700">
                      Salary config for <strong>{employmentType.replace("_", " ")}</strong> employee. You can skip and configure later from the employee profile.
                    </p>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-100 p-6">
                    {employmentType === "FULL_TIME"  && <FullTimeSalaryForm state={ftSalary} setState={setFtSalary} />}
                    {employmentType === "PART_TIME"  && <PartTimeSalaryForm state={ptSalary} setState={setPtSalary} />}
                    {(employmentType === "CONTRACT" || employmentType === "INTERN") && <ContractSalaryForm state={ctSalary} setState={setCtSalary} label={employmentType === "INTERN" ? "Intern" : "Contract"} />}
                    {employmentType === "VISITING"   && <VisitingSalaryForm state={viSalary} setState={setViSalary} />}
                  </div>
                </>
              )}
            </form>

            {/* ── Right sidebar ── */}
            <div className="w-72 shrink-0 space-y-4">

              {/* Step 0: Identity profile card + checklist */}
              {step === 0 && (
                <>
                  <div className="bg-white rounded-xl border border-gray-100 p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-base font-bold">
                        {initials}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{displayName}</p>
                        <p className="text-xs text-gray-400">New employee profile</p>
                      </div>
                    </div>
                    <div className="space-y-3 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-gray-400 shrink-0">Official email</span>
                        <span className="font-medium text-gray-800 text-right break-all">{email || "—"}</span>
                      </div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-gray-400 shrink-0">Phone</span>
                        <span className="font-medium text-gray-800">{personalPhone || "—"}</span>
                      </div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-gray-400 shrink-0">Employee code</span>
                        <span className="font-medium text-gray-400 italic">Auto-generated</span>
                      </div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-gray-400 shrink-0">Account status</span>
                        <span className={`font-medium ${activateAccount ? "text-green-600" : "text-gray-500"}`}>
                          {activateAccount ? "Ready to activate" : "Inactive"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-gray-100 p-5">
                    <p className="text-sm font-semibold text-gray-800 mb-3">Step Checklist</p>
                    <div className="space-y-3">
                      {checklist.map((item) => (
                        <div key={item.label} className="flex items-start gap-2.5">
                          <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                            item.ok ? "bg-green-100" : item.warn ? "bg-yellow-100" : "bg-gray-100"
                          }`}>
                            {item.ok
                              ? <Check className="h-3 w-3 text-green-600" />
                              : item.warn
                              ? <AlertCircle className="h-3 w-3 text-yellow-500" />
                              : <AlertCircle className="h-3 w-3 text-gray-300" />}
                          </div>
                          <div>
                            <p className={`text-xs font-semibold ${item.ok ? "text-gray-700" : item.warn ? "text-yellow-700" : "text-gray-400"}`}>{item.label}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{item.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Step 1: Employment preview card + employment checklist + info card */}
              {step === 1 && (
                <>
                  <div className="bg-white rounded-xl border border-gray-100 p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-base font-bold">
                        {initials}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{displayName}</p>
                        <p className="text-xs text-gray-400">Employment preview</p>
                      </div>
                    </div>
                    <div className="space-y-3 text-xs">
                      {[
                        { label: "Department",   value: deptName },
                        { label: "Designation",  value: designationTitle },
                        { label: "Reports to",   value: managerName },
                        { label: "Joining date", value: joiningDateDisplay },
                        { label: "Access",       value: roleLabel },
                      ].map(({ label, value }) => (
                        <div key={label} className="flex items-start justify-between gap-2">
                          <span className="text-gray-400 shrink-0">{label}</span>
                          <span className={`font-medium text-right ${value ? "text-gray-800" : "text-gray-300"}`}>{value || "—"}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-gray-100 p-5">
                    <p className="text-sm font-semibold text-gray-800 mb-3">Step Checklist</p>
                    <div className="space-y-3">
                      {[
                        { label: "Job details",    desc: "Department, designation, and type selected.", ok: !!(departmentId && designationId && employmentType), warn: false },
                        { label: "Manager linked", desc: "Reporting line is ready for approvals.",      ok: !!reportingToId,                                    warn: !reportingToId },
                        { label: "Salary optional", desc: "You can continue to salary setup or create without salary.", ok: false, warn: true },
                      ].map((item) => (
                        <div key={item.label} className="flex items-start gap-2.5">
                          <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                            item.ok ? "bg-green-100" : item.warn ? "bg-yellow-100" : "bg-gray-100"
                          }`}>
                            {item.ok
                              ? <Check className="h-3 w-3 text-green-600" />
                              : <AlertCircle className={`h-3 w-3 ${item.warn ? "text-yellow-500" : "text-gray-300"}`} />}
                          </div>
                          <div>
                            <p className={`text-xs font-semibold ${item.ok ? "text-gray-700" : item.warn ? "text-yellow-700" : "text-gray-400"}`}>{item.label}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{item.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-blue-100 bg-blue-50 p-5">
                    <p className="text-sm font-bold text-blue-800 mb-2">Why This Works Better</p>
                    <p className="text-xs text-blue-700 leading-relaxed">The employment fields now fit into clear sections and the right panel carries useful review information, instead of leaving half the screen blank while the admin fills a narrow form.</p>
                  </div>
                </>
              )}

              {/* Step 2: salary summary placeholder */}
              {step === 2 && (
                <div className="bg-white rounded-xl border border-gray-100 p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-base font-bold">
                      {initials}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{displayName}</p>
                      <p className="text-xs text-gray-400">Salary configuration</p>
                    </div>
                  </div>
                  <div className="space-y-3 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-gray-400 shrink-0">Department</span>
                      <span className="font-medium text-gray-800 text-right">{deptName || "—"}</span>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-gray-400 shrink-0">Employment type</span>
                      <span className="font-medium text-gray-800">{employmentType?.replace("_", " ") ?? "—"}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Bottom footer bar ── */}
        <div className="bg-white border-t border-gray-100 px-6 py-3 flex items-center justify-between shrink-0">
          <p className="text-xs text-gray-500">
            Step {step + 1} of {STEPS.length}
            {step === 0 && (
              <> · <span className={completedCount === totalRequired ? "text-green-600 font-medium" : "text-gray-500"}>{completedCount} of {totalRequired} required details completed</span></>
            )}
            {step === 1 && (
              <> · <span className={empDetailsReady ? "text-green-600 font-medium" : "text-gray-500"}>{empDetailsReady ? "Employment details ready" : "Fill in required fields"}</span></>
            )}
          </p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => step === 0 ? router.back() : setStep((s) => s - 1)}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-colors">
              {step === 0 ? "Cancel" : "Back"}
            </button>
            {step === 1 && (
              <button type="button" disabled={createMutation.isPending} onClick={() => handleCreate(true)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-60 transition-colors">
                {createMutation.isPending ? "Creating…" : "Create without Salary"}
              </button>
            )}
            {step === STEPS.length - 1 && (
              <button type="button" disabled={createMutation.isPending} onClick={() => handleCreate(true)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-60 transition-colors">
                Skip & Create
              </button>
            )}
            <button
              type="button"
              onClick={step < STEPS.length - 1 ? nextStep : () => handleCreate(false)}
              disabled={createMutation.isPending}
              className="flex items-center gap-1.5 rounded-lg px-5 py-2 text-sm font-semibold text-white disabled:opacity-60 transition-colors"
              style={{ backgroundColor: "#2C3E7C" }}
            >
              {createMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</> : nextLabel}
              {step < STEPS.length - 1 && !createMutation.isPending && <ChevronRight className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
