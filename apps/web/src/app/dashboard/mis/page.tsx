"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  FileSpreadsheet, Download, Users, ChevronDown, ChevronUp,
  CheckSquare, Square, Loader2, BarChart3, DollarSign, Banknote, CalendarDays,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface FieldOption  { key: string; label: string }
interface FieldGroup   { group: string; fields: FieldOption[] }

interface SalaryRow {
  employeeCode:    string;
  name:            string;
  department:      string;
  designation:     string;
  employmentType:  string;
  status:          string;
  ctcAnnual:       number | null;
  ctcMonthly:      number | null;
  effectiveFrom:   string | null;
  effectiveTo:     string | null;
  components:      Record<string, number>;
  grossEarnings:   number;
  totalDeductions: number;
  netSalary:       number;
  hasStructure:    boolean;
}

interface SalaryData {
  rows:       SalaryRow[];
  earnings:   string[];
  deductions: string[];
  labels:     Record<string, string>;
}

interface DisbursementRow {
  employeeCode:    string;
  name:            string;
  department:      string;
  designation:     string;
  accountNumber:   string | null;
  bankName:        string | null;
  basic:           number;
  hra:             number;
  conveyance:      number;
  medical:         number;
  specialAllowance: number;
  pfEmployer:      number;
  esiEmployer:     number;
  gratuity:        number;
  bonusComp:       number;
  incentive:       number;
  grossEarnings:   number;
  lopDays:         number;
  lopAmount:       number;
  claimsAmount:    number;
  bonusAmount:     number;
  tds:             number;
  pfEmployee:      number;
  esiEmployee:     number;
  professionalTax: number;
  advanceDeduction: number;
  totalDeductions: number;
  netPayable:      number;
  ctcMonthly:      number | null;
  hasStructure:    boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

// ── Field Group Panel (for employee directory report) ─────────────────────────

function FieldGroupPanel({
  group, selected, onToggleField, onToggleGroup,
}: {
  group: FieldGroup;
  selected: Set<string>;
  onToggleField: (key: string) => void;
  onToggleGroup: (keys: string[], checked: boolean) => void;
}) {
  const [open, setOpen] = useState(true);
  const keys = group.fields.map((f) => f.key);
  const allChecked  = keys.every((k) => selected.has(k));
  const someChecked = keys.some((k) => selected.has(k));

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <button
        className="flex items-center justify-between w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-2.5">
          <button type="button" className="shrink-0" onClick={(e) => { e.stopPropagation(); onToggleGroup(keys, !allChecked); }}>
            {allChecked ? <CheckSquare className="h-4 w-4 text-blue-600" />
              : someChecked ? <CheckSquare className="h-4 w-4 text-blue-400" />
              : <Square className="h-4 w-4 text-gray-400" />}
          </button>
          <span className="text-sm font-semibold text-gray-700">{group.group}</span>
          <span className="text-xs text-gray-400 bg-white border border-gray-200 rounded-full px-2 py-0.5">
            {keys.filter((k) => selected.has(k)).length}/{keys.length}
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
      </button>
      {open && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 px-4 py-3 bg-white">
          {group.fields.map((f) => (
            <label key={f.key} className="flex items-center gap-2.5 py-1.5 cursor-pointer group" onClick={() => onToggleField(f.key)}>
              <span className="shrink-0">
                {selected.has(f.key)
                  ? <CheckSquare className="h-4 w-4 text-blue-600" />
                  : <Square className="h-4 w-4 text-gray-300 group-hover:text-gray-400" />}
              </span>
              <span className={`text-sm select-none ${selected.has(f.key) ? "text-gray-800" : "text-gray-500"}`}>{f.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Report 1: Employee Directory ──────────────────────────────────────────────

function EmployeeDirectoryReport() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set([
    "employeeCode", "fullName", "email", "personalPhone",
    "department", "designation", "employmentType", "status", "joiningDate",
  ]));
  const [exporting, setExporting] = useState(false);

  const { data: fieldsData, isLoading } = useQuery({
    queryKey: ["report-employee-fields"],
    queryFn: () =>
      api.get<{ success: boolean; data: FieldGroup[] }>("/api/v1/reports/employee-directory/fields")
        .then((r) => r.data.data),
    staleTime: Infinity,
    enabled: open,
  });

  function toggleField(key: string) {
    setSelected((prev) => { const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next; });
  }
  function toggleGroup(keys: string[], check: boolean) {
    setSelected((prev) => { const next = new Set(prev); keys.forEach((k) => check ? next.add(k) : next.delete(k)); return next; });
  }
  function selectAll() { if (!fieldsData) return; setSelected(new Set(fieldsData.flatMap((g) => g.fields.map((f) => f.key)))); }
  function clearAll()  { setSelected(new Set()); }

  async function handleExport() {
    if (selected.size === 0) { toast.error("Select at least one field"); return; }
    setExporting(true);
    try {
      const fields = Array.from(selected).join(",");
      const response = await api.get(`/api/v1/reports/employee-directory/export?fields=${fields}`, { responseType: "blob" });
      triggerDownload(response.data as Blob, `employee_directory_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success("Excel file downloaded");
    } catch {
      toast.error("Failed to export report");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header — always visible */}
      <button
        className="flex items-center justify-between w-full px-6 py-5 text-left hover:bg-gray-50 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 rounded-xl"><Users className="h-5 w-5 text-blue-600" /></div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">Employee Directory</h2>
            <p className="text-xs text-gray-400 mt-0.5">All employee details — choose columns and export to Excel</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 hidden sm:block">{selected.size} field{selected.size !== 1 ? "s" : ""} selected</span>
          <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      {/* Collapsible body */}
      {open && (
        <div className="border-t border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-gray-700">Select columns to include</p>
            <div className="flex items-center gap-3 text-xs">
              <button onClick={selectAll} className="text-blue-600 hover:underline">Select all</button>
              <span className="text-gray-300">|</span>
              <button onClick={clearAll} className="text-gray-500 hover:underline">Clear all</button>
            </div>
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-blue-500" /></div>
          ) : (
            <div className="space-y-3">
              {fieldsData?.map((group) => (
                <FieldGroupPanel key={group.group} group={group} selected={selected} onToggleField={toggleField} onToggleGroup={toggleGroup} />
              ))}
            </div>
          )}
          <div className="flex items-center justify-between mt-5 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400">
              Sorted by department then name. Auto-filter and frozen header included.
            </p>
            <button
              onClick={handleExport}
              disabled={exporting || selected.size === 0}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {exporting ? "Exporting…" : "Export Excel"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Report 2: Salary Structures ───────────────────────────────────────────────

function SalaryStructuresReport() {
  const [open, setOpen] = useState(false);
  const [excelLoading, setExcelLoading] = useState(false);
  const [pdfLoading,   setPdfLoading]   = useState(false);
  const [preview, setPreview] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["report-salary-data"],
    queryFn: () =>
      api.get<{ success: boolean; data: SalaryData }>("/api/v1/reports/salary-structures/data")
        .then((r) => r.data.data),
    enabled: preview,
    staleTime: 5 * 60 * 1000,
  });

  async function handleExcel() {
    setExcelLoading(true);
    try {
      const res = await api.get("/api/v1/reports/salary-structures/export", { responseType: "blob" });
      triggerDownload(res.data as Blob, `salary_structures_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success("Excel downloaded");
    } catch {
      toast.error("Failed to export Excel");
    } finally {
      setExcelLoading(false);
    }
  }

  async function handlePdf() {
    setPdfLoading(true);
    try {
      // Fetch data first (reuse cached if already loaded)
      const salaryData: SalaryData = data ?? await api
        .get<{ success: boolean; data: SalaryData }>("/api/v1/reports/salary-structures/data")
        .then((r) => r.data.data);

      // Dynamically import to avoid SSR issues
      const { default: jsPDF } = await import("jspdf");
      await import("jspdf-autotable");

      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a3" });
      const today = new Date().toLocaleDateString("en-IN");

      // Title
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("Salary Structures Report", 14, 16);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text(`Generated: ${today}  ·  Employees: ${salaryData.rows.length}`, 14, 23);
      doc.setTextColor(0);

      const { earnings, deductions, labels, rows } = salaryData;

      const HEAD_INFO     = ["Code", "Name", "Department", "Designation"];
      const HEAD_EARNINGS = earnings.map((c: string) => labels[c] ?? c);
      const HEAD_GROSS    = ["Gross"];
      const HEAD_DED      = deductions.map((c: string) => labels[c] ?? c);
      const HEAD_TOT_DED  = ["Total Ded."];
      const HEAD_NET      = ["Net Salary", "CTC/Mo"];
      const head = [[...HEAD_INFO, ...HEAD_EARNINGS, ...HEAD_GROSS, ...HEAD_DED, ...HEAD_TOT_DED, ...HEAD_NET]];

      const body = rows.map((r: SalaryRow) => [
        r.employeeCode,
        r.name,
        r.department,
        r.designation,
        ...earnings.map((c: string) => r.hasStructure ? fmt(r.components[c] ?? 0) : "—"),
        r.hasStructure ? fmt(r.grossEarnings) : "—",
        ...deductions.map((c: string) => r.hasStructure ? fmt(r.components[c] ?? 0) : "—"),
        r.hasStructure ? fmt(r.totalDeductions) : "—",
        r.hasStructure ? fmt(r.netSalary) : "—",
        r.hasStructure ? fmt(r.ctcMonthly) : "—",
      ]);

      const infoCount = HEAD_INFO.length;
      const earnCount = HEAD_EARNINGS.length + 1; // +1 gross
      const dedCount  = HEAD_DED.length + 1;       // +1 total

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (doc as any).autoTable({
        head,
        body,
        startY: 28,
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [30, 58, 95], textColor: 255, fontStyle: "bold" },
        columnStyles: {
          // Color earnings columns light green header
          ...Object.fromEntries(
            Array.from({ length: earnCount }, (_, i) => [infoCount + i, { fillColor: [240, 253, 244] }])
          ),
          // Color deduction columns light red
          ...Object.fromEntries(
            Array.from({ length: dedCount }, (_, i) => [infoCount + earnCount + i, { fillColor: [255, 241, 242] }])
          ),
          // Net salary bold
          [infoCount + earnCount + dedCount]: { fontStyle: "bold" },
        },
        alternateRowStyles: { fillColor: [249, 250, 251] },
        margin: { left: 14, right: 14 },
        didParseCell: (hookData: { section: string; column: { index: number }; cell: { styles: { fillColor: number[] | string; fontStyle: string } } }) => {
          if (hookData.section === "head") {
            const ci = hookData.column.index;
            if (ci >= infoCount && ci < infoCount + earnCount) {
              hookData.cell.styles.fillColor = [20, 83, 45];
            } else if (ci >= infoCount + earnCount && ci < infoCount + earnCount + dedCount) {
              hookData.cell.styles.fillColor = [127, 29, 29];
            } else if (ci >= infoCount + earnCount + dedCount) {
              hookData.cell.styles.fillColor = [55, 65, 81];
            }
          }
        },
      });

      // Footer
      const pageCount = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(150);
        doc.text(`Page ${i} of ${pageCount}  ·  CADB Salary Structures Report  ·  ${today}`,
          doc.internal.pageSize.getWidth() / 2, doc.internal.pageSize.getHeight() - 8,
          { align: "center" }
        );
      }

      doc.save(`salary_structures_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success("PDF downloaded");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate PDF");
    } finally {
      setPdfLoading(false);
    }
  }

  const withStructure    = data?.rows.filter((r) => r.hasStructure).length ?? 0;
  const withoutStructure = data?.rows.filter((r) => !r.hasStructure).length ?? 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header — always visible, click to expand */}
      <button
        className="flex items-center justify-between w-full px-6 py-5 text-left hover:bg-gray-50 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-green-50 rounded-xl"><DollarSign className="h-5 w-5 text-green-600" /></div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">Salary Structures</h2>
            <p className="text-xs text-gray-400 mt-0.5">Employee-wise CTC and component breakdown — Excel &amp; PDF</p>
          </div>
        </div>
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Collapsible body */}
      {open && <div className="border-t border-gray-100 p-6">
        {/* Info strips — collapsible */}
        <details className="group mb-6 border border-gray-100 rounded-xl overflow-hidden">
          <summary className="flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer list-none text-sm text-gray-500 select-none">
            <span>What does this report include?</span>
            <ChevronDown className="h-4 w-4 text-gray-400 group-open:rotate-180 transition-transform" />
          </summary>
          <div className="grid grid-cols-3 gap-4 p-4 bg-white">
            <div>
              <p className="text-xs font-medium text-gray-600 mb-1.5">What&apos;s included</p>
              <ul className="text-xs text-gray-500 space-y-1">
                <li>• Employee Code, Name, Dept, Designation</li>
                <li>• All earnings components (monthly)</li>
                <li>• All deduction components (monthly)</li>
                <li>• Gross Pay · Total Deductions · Net Salary</li>
                <li>• CTC (Monthly &amp; Annual) · Effective From</li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-600 mb-1.5">Excel format</p>
              <ul className="text-xs text-gray-500 space-y-1">
                <li>• Two header rows: group + column names</li>
                <li>• Earnings columns highlighted green</li>
                <li>• Deduction columns highlighted red</li>
                <li>• ₹ currency formatting · Frozen headers</li>
                <li>• Auto-filter enabled on all columns</li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-600 mb-1.5">PDF format</p>
              <ul className="text-xs text-gray-500 space-y-1">
                <li>• A3 landscape for full component view</li>
                <li>• Colour-coded section headers</li>
                <li>• Alternating row shading</li>
                <li>• Page numbers in footer</li>
                <li>• Generated client-side, no data sent externally</li>
              </ul>
            </div>
          </div>
        </details>

        {/* Preview toggle */}
        <div className="border border-gray-100 rounded-xl overflow-hidden">
          <button
            className="flex items-center justify-between w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-sm font-medium text-gray-700"
            onClick={() => setPreview(!preview)}
          >
            <span>Preview data ({preview && data ? `${data.rows.length} employees` : "click to load"})</span>
            {preview ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
          </button>

          {preview && (
            <div className="overflow-x-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
              ) : data ? (
                <>
                  {/* Summary bar */}
                  <div className="flex items-center gap-4 px-4 py-2 bg-white border-b border-gray-100 text-xs text-gray-500">
                    <span className="text-green-600 font-medium">{withStructure} with salary structure</span>
                    {withoutStructure > 0 && <span className="text-orange-500">{withoutStructure} without structure (shown as —)</span>}
                  </div>
                  {/* Table */}
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="bg-[#1E3A5F] text-white">
                        <th className="px-3 py-2 text-left whitespace-nowrap">Code</th>
                        <th className="px-3 py-2 text-left whitespace-nowrap">Name</th>
                        <th className="px-3 py-2 text-left whitespace-nowrap">Department</th>
                        <th className="px-3 py-2 text-left whitespace-nowrap">Designation</th>
                        <th className="px-3 py-2 text-right whitespace-nowrap bg-[#14532D]" colSpan={data.earnings.length + 1}>
                          ← Earnings →
                        </th>
                        <th className="px-3 py-2 text-right whitespace-nowrap bg-[#6B0101]" colSpan={data.deductions.length + 1}>
                          ← Deductions →
                        </th>
                        <th className="px-3 py-2 text-right whitespace-nowrap">Net Salary</th>
                        <th className="px-3 py-2 text-right whitespace-nowrap">CTC/Mo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.rows.slice(0, 10).map((r, i) => (
                        <tr key={r.employeeCode} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                          <td className="px-3 py-2 text-gray-500 whitespace-nowrap font-mono">{r.employeeCode}</td>
                          <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">{r.name}</td>
                          <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{r.department}</td>
                          <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{r.designation}</td>
                          {data.earnings.map((c) => (
                            <td key={c} className="px-3 py-2 text-right text-gray-700 whitespace-nowrap bg-green-50/50">
                              {r.hasStructure ? fmt(r.components[c] ?? 0) : "—"}
                            </td>
                          ))}
                          <td className="px-3 py-2 text-right font-semibold text-green-700 bg-green-100/60 whitespace-nowrap">
                            {r.hasStructure ? fmt(r.grossEarnings) : "—"}
                          </td>
                          {data.deductions.map((c) => (
                            <td key={c} className="px-3 py-2 text-right text-gray-700 whitespace-nowrap bg-red-50/50">
                              {r.hasStructure ? fmt(r.components[c] ?? 0) : "—"}
                            </td>
                          ))}
                          <td className="px-3 py-2 text-right font-semibold text-red-700 bg-red-100/60 whitespace-nowrap">
                            {r.hasStructure ? fmt(r.totalDeductions) : "—"}
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-gray-900 whitespace-nowrap">
                            {r.hasStructure ? fmt(r.netSalary) : "—"}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-600 whitespace-nowrap">
                            {r.hasStructure ? fmt(r.ctcMonthly) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {data.rows.length > 10 && (
                    <p className="text-xs text-gray-400 text-center py-2 border-t border-gray-50">
                      Showing 10 of {data.rows.length} rows — full data is in the exported file
                    </p>
                  )}
                </>
              ) : null}
            </div>
          )}
        </div>

        {/* Export buttons */}
        <div className="flex items-center justify-between mt-5 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-400">
            Only employees with a salary structure are exported. Others shown as — in preview.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExcel}
              disabled={excelLoading}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {excelLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
              {excelLoading ? "Exporting…" : "Excel"}
            </button>
            <button
              onClick={handlePdf}
              disabled={pdfLoading}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-xl hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {pdfLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {pdfLoading ? "Generating…" : "PDF"}
            </button>
          </div>
        </div>
      </div>}
    </div>
  );
}

// ── Report 3: Monthly Salary Disbursement ─────────────────────────────────────

function MonthlySalaryDisbursementReport() {
  const today = new Date();
  const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const [open, setOpen]       = useState(false);
  const [month, setMonth]     = useState(defaultMonth);
  const [preview, setPreview] = useState(false);
  const [xlsLoading, setXlsLoading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["report-disbursement", month],
    queryFn: () =>
      api.get<{ success: boolean; data: DisbursementRow[] }>(`/api/v1/reports/salary-disbursement/data?month=${month}`)
        .then((r) => r.data.data),
    enabled: preview && open,
    staleTime: 2 * 60 * 1000,
  });

  async function handleExcel() {
    setXlsLoading(true);
    try {
      const res = await api.get(`/api/v1/reports/salary-disbursement/export?month=${month}`, { responseType: "blob" });
      const [yr, mo] = month.split("-");
      const label = new Date(+yr, +mo - 1, 1).toLocaleString("en-IN", { month: "long", year: "numeric" }).replace(/ /g, "_");
      triggerDownload(res.data as Blob, `salary_disbursement_${label}.xlsx`);
      toast.success("Excel downloaded");
    } catch {
      toast.error("Failed to export");
    } finally {
      setXlsLoading(false);
    }
  }

  const monthLabel = (() => {
    const [yr, mo] = month.split("-");
    return new Date(+yr, +mo - 1, 1).toLocaleString("en-IN", { month: "long", year: "numeric" });
  })();

  const rows = data ?? [];
  const withStructure = rows.filter((r) => r.hasStructure).length;
  const totalNet = rows.reduce((s, r) => s + r.netPayable, 0);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <button
        className="flex items-center justify-between w-full px-6 py-5 text-left hover:bg-gray-50 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-violet-50 rounded-xl"><Banknote className="h-5 w-5 text-violet-600" /></div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">Monthly Salary Disbursement</h2>
            <p className="text-xs text-gray-400 mt-0.5">Full payroll dump with LoP, claims, and bonus for any month</p>
          </div>
        </div>
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Body */}
      {open && (
        <div className="border-t border-gray-100 p-6">
          {/* Info strip */}
          <details className="group mb-6 border border-gray-100 rounded-xl overflow-hidden">
            <summary className="flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer list-none text-sm text-gray-500 select-none">
              <span>What does this report include?</span>
              <ChevronDown className="h-4 w-4 text-gray-400 group-open:rotate-180 transition-transform" />
            </summary>
            <div className="grid grid-cols-3 gap-4 p-4 bg-white">
              <div>
                <p className="text-xs font-medium text-gray-600 mb-1.5">Earnings columns</p>
                <ul className="text-xs text-gray-500 space-y-1">
                  <li>• Basic, HRA, Conveyance, Medical</li>
                  <li>• Special Allowance, Bonus, Incentive</li>
                  <li>• PF &amp; ESI (Employer), Gratuity</li>
                  <li>• Gross Pay (sum of all earnings)</li>
                </ul>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-600 mb-1.5">Adjustments &amp; Deductions</p>
                <ul className="text-xs text-gray-500 space-y-1">
                  <li>• LoP days and LoP amount (basic/working days × days)</li>
                  <li>• Approved reimbursement claims for the month</li>
                  <li>• Bonus payouts scheduled for the month</li>
                  <li>• TDS, PF, ESI (Employee), Prof. Tax, Advance</li>
                </ul>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-600 mb-1.5">Excel format</p>
                <ul className="text-xs text-gray-500 space-y-1">
                  <li>• Title row + group header row + column header row</li>
                  <li>• Green earnings · Purple adjustments · Red deductions</li>
                  <li>• Totals row at the bottom</li>
                  <li>• Bank account number per employee</li>
                  <li>• Frozen top 3 rows + first 2 columns</li>
                </ul>
              </div>
            </div>
          </details>

          {/* Month picker */}
          <div className="flex items-center gap-4 mb-5">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Select Month</label>
              <input
                type="month"
                value={month}
                onChange={(e) => { setMonth(e.target.value); setPreview(false); }}
                className="px-3 py-1.5 border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-400"
              />
            </div>
            <span className="text-sm text-gray-400">{monthLabel}</span>
          </div>

          {/* Preview toggle */}
          <div className="border border-gray-100 rounded-xl overflow-hidden">
            <button
              className="flex items-center justify-between w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-sm font-medium text-gray-700"
              onClick={() => setPreview(!preview)}
            >
              <span>
                Preview data
                {preview && data ? ` · ${withStructure} employees · Net payable: ${fmt(totalNet)}` : " (click to load)"}
              </span>
              {preview ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
            </button>

            {preview && (
              <div className="overflow-x-auto">
                {isLoading ? (
                  <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
                ) : data ? (
                  <>
                    <div className="flex items-center gap-4 px-4 py-2 bg-white border-b border-gray-100 text-xs text-gray-500">
                      <span className="font-medium text-gray-700">{monthLabel}</span>
                      <span className="text-green-600 font-medium">{withStructure} employees with salary structure</span>
                      {rows.length - withStructure > 0 && (
                        <span className="text-orange-500">{rows.length - withStructure} without structure</span>
                      )}
                      <span className="ml-auto font-semibold text-gray-900">Total Net Payable: {fmt(totalNet)}</span>
                    </div>
                    <table className="min-w-full text-xs">
                      <thead>
                        <tr className="bg-[#1E3A5F] text-white text-left">
                          <th className="px-3 py-2 whitespace-nowrap">Code</th>
                          <th className="px-3 py-2 whitespace-nowrap">Name</th>
                          <th className="px-3 py-2 whitespace-nowrap">Department</th>
                          <th className="px-3 py-2 text-right whitespace-nowrap bg-[#14532D]">Gross Pay</th>
                          <th className="px-3 py-2 text-right whitespace-nowrap bg-[#5B21B6]">LoP</th>
                          <th className="px-3 py-2 text-right whitespace-nowrap bg-[#5B21B6]">Claims</th>
                          <th className="px-3 py-2 text-right whitespace-nowrap bg-[#5B21B6]">Bonus</th>
                          <th className="px-3 py-2 text-right whitespace-nowrap bg-[#6B0101]">Total Ded.</th>
                          <th className="px-3 py-2 text-right whitespace-nowrap font-bold">Net Payable</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.slice(0, 10).map((r, i) => (
                          <tr key={r.employeeCode} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                            <td className="px-3 py-2 text-gray-500 font-mono whitespace-nowrap">{r.employeeCode}</td>
                            <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">{r.name}</td>
                            <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{r.department}</td>
                            <td className="px-3 py-2 text-right text-gray-700 bg-green-50/50 whitespace-nowrap">{r.hasStructure ? fmt(r.grossEarnings) : "—"}</td>
                            <td className="px-3 py-2 text-right text-violet-700 bg-violet-50/50 whitespace-nowrap">
                              {r.lopDays > 0 ? `${r.lopDays}d / ${fmt(r.lopAmount)}` : "—"}
                            </td>
                            <td className="px-3 py-2 text-right text-violet-700 bg-violet-50/50 whitespace-nowrap">{r.claimsAmount > 0 ? fmt(r.claimsAmount) : "—"}</td>
                            <td className="px-3 py-2 text-right text-violet-700 bg-violet-50/50 whitespace-nowrap">{r.bonusAmount > 0 ? fmt(r.bonusAmount) : "—"}</td>
                            <td className="px-3 py-2 text-right text-red-700 bg-red-50/60 whitespace-nowrap">{r.hasStructure ? fmt(r.totalDeductions) : "—"}</td>
                            <td className="px-3 py-2 text-right font-bold text-gray-900 whitespace-nowrap">{r.hasStructure ? fmt(r.netPayable) : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {rows.length > 10 && (
                      <p className="text-xs text-gray-400 text-center py-2 border-t border-gray-50">
                        Showing 10 of {rows.length} rows — full data is in the exported file
                      </p>
                    )}
                  </>
                ) : null}
              </div>
            )}
          </div>

          {/* Export */}
          <div className="flex items-center justify-between mt-5 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400">
              LoP = basic ÷ working days in month × unpaid leave days.
              Claims and bonus payouts are for the selected month only.
            </p>
            <button
              onClick={handleExcel}
              disabled={xlsLoading || !month}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-xl hover:bg-violet-700 disabled:opacity-50 transition-colors"
            >
              {xlsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
              {xlsLoading ? "Exporting…" : "Export Excel"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Report 4: Leave Records ───────────────────────────────────────────────────

interface LeaveBalanceSummary {
  leaveType:      string;
  leaveTypeLabel: string;
  allocated:      number;
  used:           number;
  pending:        number;
  carried:        number;
  available:      number;
}

interface LeaveRecordRow {
  employeeCode:   string;
  name:           string;
  department:     string;
  designation:    string;
  balances:       LeaveBalanceSummary[];
  totalAllocated: number;
  totalUsed:      number;
  totalPending:   number;
  totalCarried:   number;
  totalAvailable: number;
}

interface LeaveApplication {
  employeeCode: string;
  name:         string;
  department:   string;
  leaveType:    string;
  fromDate:     string;
  toDate:       string;
  totalDays:    number;
  status:       string;
  appliedOn:    string;
  approver:     string | null;
  resolvedAt:   string | null;
  reason:       string;
}

interface LeaveData {
  rows:         LeaveRecordRow[];
  applications: LeaveApplication[];
}

const STATUS_BADGE: Record<string, string> = {
  APPROVED:  "bg-emerald-50 text-emerald-700",
  PENDING:   "bg-amber-50 text-amber-700",
  REJECTED:  "bg-red-50 text-red-700",
  CANCELLED: "bg-gray-100 text-gray-500",
};

function fmtDays(n: number) {
  return n === 0 ? "—" : n % 1 === 0 ? `${n}d` : `${n}d`;
}

function LeaveRecordsReport() {
  const currentYear = new Date().getFullYear();
  const [open, setOpen]       = useState(false);
  const [year, setYear]       = useState(currentYear);
  const [preview, setPreview] = useState(false);
  const [xlsLoading, setXlsLoading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["report-leave-records", year],
    queryFn: () =>
      api.get<{ success: boolean; data: LeaveData }>(`/api/v1/reports/leave-records/data?year=${year}`)
        .then((r) => r.data.data),
    enabled: preview && open,
    staleTime: 2 * 60 * 1000,
  });

  async function handleExcel() {
    setXlsLoading(true);
    try {
      const res = await api.get(`/api/v1/reports/leave-records/export?year=${year}`, { responseType: "blob" });
      triggerDownload(res.data as Blob, `leave_records_${year}.xlsx`);
      toast.success("Excel downloaded");
    } catch {
      toast.error("Failed to export");
    } finally {
      setXlsLoading(false);
    }
  }

  const rows  = data?.rows ?? [];
  const apps  = data?.applications ?? [];
  const totalApps     = apps.length;
  const approvedApps  = apps.filter((a) => a.status === "APPROVED").length;
  const pendingApps   = apps.filter((a) => a.status === "PENDING").length;

  // Summarise leave type totals across all employees (for the preview header)
  const LEAVE_TYPES = ["CASUAL", "SICK", "EARNED", "UNPAID"] as const;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <button
        className="flex items-center justify-between w-full px-6 py-5 text-left hover:bg-gray-50 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-50 rounded-xl"><CalendarDays className="h-5 w-5 text-amber-600" /></div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">Leave Records</h2>
            <p className="text-xs text-gray-400 mt-0.5">Employee leave balances and application history by year</p>
          </div>
        </div>
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Body */}
      {open && (
        <div className="border-t border-gray-100 p-6">
          {/* Info strip */}
          <details className="group mb-6 border border-gray-100 rounded-xl overflow-hidden">
            <summary className="flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer list-none text-sm text-gray-500 select-none">
              <span>What does this report include?</span>
              <ChevronDown className="h-4 w-4 text-gray-400 group-open:rotate-180 transition-transform" />
            </summary>
            <div className="grid grid-cols-3 gap-4 p-4 bg-white">
              <div>
                <p className="text-xs font-medium text-gray-600 mb-1.5">Sheet 1: Leave Balances</p>
                <ul className="text-xs text-gray-500 space-y-1">
                  <li>• One row per employee</li>
                  <li>• Per leave type: Allocated, Carried, Used, Pending, Available</li>
                  <li>• All 8 leave types (Casual, Sick, Earned, Maternity, etc.)</li>
                  <li>• Total summary columns on the right</li>
                </ul>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-600 mb-1.5">Sheet 2: Leave Applications</p>
                <ul className="text-xs text-gray-500 space-y-1">
                  <li>• All applications that fall within the year</li>
                  <li>• From/To date, days, status, approver name</li>
                  <li>• Colour-coded status (green/amber/red)</li>
                  <li>• Reason column included</li>
                </ul>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-600 mb-1.5">Excel format</p>
                <ul className="text-xs text-gray-500 space-y-1">
                  <li>• Two sheets in one file</li>
                  <li>• Colour-coded header per leave type</li>
                  <li>• Frozen header rows + first two columns</li>
                  <li>• Auto-filter on all columns</li>
                </ul>
              </div>
            </div>
          </details>

          {/* Year picker */}
          <div className="flex items-center gap-4 mb-5">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Select Year</label>
              <input
                type="number"
                min={2020}
                max={currentYear + 1}
                value={year}
                onChange={(e) => { setYear(Number(e.target.value)); setPreview(false); }}
                className="w-24 px-3 py-1.5 border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <span className="text-sm text-gray-400">Calendar Year {year}</span>
          </div>

          {/* Preview toggle */}
          <div className="border border-gray-100 rounded-xl overflow-hidden">
            <button
              className="flex items-center justify-between w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-sm font-medium text-gray-700"
              onClick={() => setPreview(!preview)}
            >
              <span>
                Preview data
                {preview && data
                  ? ` · ${rows.length} employees · ${totalApps} applications (${approvedApps} approved, ${pendingApps} pending)`
                  : " (click to load)"}
              </span>
              {preview ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
            </button>

            {preview && (
              <div className="overflow-x-auto">
                {isLoading ? (
                  <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
                ) : data ? (
                  <>
                    {/* Leave balance summary table — key leave types only */}
                    <div className="px-4 py-2 bg-white border-b border-gray-100 text-xs font-medium text-gray-600">
                      Leave Balances — {year}
                    </div>
                    <table className="min-w-full text-xs">
                      <thead>
                        <tr className="bg-[#1E3A5F] text-white text-left">
                          <th className="px-3 py-2 whitespace-nowrap">Code</th>
                          <th className="px-3 py-2 whitespace-nowrap">Name</th>
                          <th className="px-3 py-2 whitespace-nowrap">Department</th>
                          {LEAVE_TYPES.map((lt) => (
                            <th key={lt} className="px-3 py-2 text-center whitespace-nowrap" colSpan={2}>
                              {lt.charAt(0) + lt.slice(1).toLowerCase()}
                            </th>
                          ))}
                          <th className="px-3 py-2 text-right whitespace-nowrap">Total Used</th>
                          <th className="px-3 py-2 text-right whitespace-nowrap">Available</th>
                        </tr>
                        <tr className="bg-[#162032] text-gray-300 text-left text-[10px]">
                          <th className="px-3 py-1.5" colSpan={3} />
                          {LEAVE_TYPES.flatMap((lt) => [
                            <th key={`${lt}_used`} className="px-2 py-1.5 text-right whitespace-nowrap">Used</th>,
                            <th key={`${lt}_avail`} className="px-2 py-1.5 text-right whitespace-nowrap">Avail.</th>,
                          ])}
                          <th className="px-3 py-1.5" colSpan={2} />
                        </tr>
                      </thead>
                      <tbody>
                        {rows.slice(0, 10).map((r, i) => {
                          const balMap: Record<string, LeaveBalanceSummary> = {};
                          r.balances.forEach((b) => { balMap[b.leaveType] = b; });
                          return (
                            <tr key={r.employeeCode} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                              <td className="px-3 py-2 text-gray-500 font-mono whitespace-nowrap">{r.employeeCode}</td>
                              <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">{r.name}</td>
                              <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{r.department}</td>
                              {LEAVE_TYPES.flatMap((lt) => {
                                const b = balMap[lt];
                                return [
                                  <td key={`${lt}_used`} className="px-2 py-2 text-right text-amber-700 whitespace-nowrap">
                                    {b ? fmtDays(b.used) : "—"}
                                  </td>,
                                  <td key={`${lt}_avail`} className="px-2 py-2 text-right text-emerald-700 whitespace-nowrap">
                                    {b ? fmtDays(b.available) : "—"}
                                  </td>,
                                ];
                              })}
                              <td className="px-3 py-2 text-right font-semibold text-amber-700 whitespace-nowrap">{fmtDays(r.totalUsed)}</td>
                              <td className="px-3 py-2 text-right font-semibold text-emerald-700 whitespace-nowrap">{fmtDays(r.totalAvailable)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {rows.length > 10 && (
                      <p className="text-xs text-gray-400 text-center py-2 border-t border-gray-50">
                        Showing 10 of {rows.length} employees — see full data in the exported file
                      </p>
                    )}

                    {/* Recent applications */}
                    {apps.length > 0 && (
                      <>
                        <div className="px-4 py-2 bg-white border-t border-b border-gray-100 text-xs font-medium text-gray-600 mt-1">
                          Recent Applications — {year} ({apps.length} total)
                        </div>
                        <table className="min-w-full text-xs">
                          <thead>
                            <tr className="bg-[#1E3A5F] text-white text-left">
                              <th className="px-3 py-2 whitespace-nowrap">Code</th>
                              <th className="px-3 py-2 whitespace-nowrap">Employee</th>
                              <th className="px-3 py-2 whitespace-nowrap">Type</th>
                              <th className="px-3 py-2 whitespace-nowrap">From</th>
                              <th className="px-3 py-2 whitespace-nowrap">To</th>
                              <th className="px-3 py-2 text-right whitespace-nowrap">Days</th>
                              <th className="px-3 py-2 whitespace-nowrap">Status</th>
                              <th className="px-3 py-2 whitespace-nowrap">Approver</th>
                            </tr>
                          </thead>
                          <tbody>
                            {apps.slice(0, 8).map((a, i) => (
                              <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                                <td className="px-3 py-2 text-gray-500 font-mono whitespace-nowrap">{a.employeeCode}</td>
                                <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">{a.name}</td>
                                <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{a.leaveType}</td>
                                <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{a.fromDate}</td>
                                <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{a.toDate}</td>
                                <td className="px-3 py-2 text-right text-gray-700 whitespace-nowrap">{a.totalDays}</td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[a.status] ?? "bg-gray-100 text-gray-500"}`}>
                                    {a.status}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{a.approver ?? "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {apps.length > 8 && (
                          <p className="text-xs text-gray-400 text-center py-2 border-t border-gray-50">
                            Showing 8 of {apps.length} applications — full data is in the exported file
                          </p>
                        )}
                      </>
                    )}
                  </>
                ) : null}
              </div>
            )}
          </div>

          {/* Export */}
          <div className="flex items-center justify-between mt-5 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400">
              Two sheets: Leave Balances (one row per employee) and Leave Applications (one row per application).
            </p>
            <button
              onClick={handleExcel}
              disabled={xlsLoading}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-xl hover:bg-amber-700 disabled:opacity-50 transition-colors"
            >
              {xlsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
              {xlsLoading ? "Exporting…" : "Export Excel"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Placeholder card ──────────────────────────────────────────────────────────

function ComingSoonCard({ icon: Icon, title, description }: {
  icon: React.ElementType; title: string; description: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-4 flex items-center gap-4 opacity-60 select-none">
      <div className="p-2.5 bg-gray-50 rounded-xl shrink-0"><Icon className="h-5 w-5 text-gray-400" /></div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        <p className="text-xs text-gray-400 mt-0.5">{description}</p>
      </div>
      <span className="text-xs bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full shrink-0">Coming soon</span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MISReportsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <BarChart3 className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">MIS Reports</h1>
          </div>
          <p className="text-sm text-gray-400 ml-9">
            Generate and download management reports for HR, payroll, and operations.
          </p>
        </div>

        <div className="space-y-3">
          <EmployeeDirectoryReport />
          <SalaryStructuresReport />
          <MonthlySalaryDisbursementReport />
          <LeaveRecordsReport />
          <ComingSoonCard
            icon={FileSpreadsheet}
            title="Holidays List"
            description="Yearly holiday calendar export to Excel and PDF."
          />
        </div>
      </div>
    </div>
  );
}
