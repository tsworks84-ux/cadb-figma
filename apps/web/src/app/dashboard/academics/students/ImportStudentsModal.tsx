"use client";

import { useRef, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  X, Download, Upload, FileSpreadsheet, CheckCircle2,
  AlertTriangle, Loader2, ArrowLeft,
} from "lucide-react";

const NAV2 = "#28245f";
const PRIMARY_GRADIENT = "linear-gradient(135deg, #28245f, #4f46e5)";
const BASE = "/api/v1/academics/students";

type RowError = { row: number; column: string; message: string };
type Preview  = { row: number; name: string; email: string; batch: string; grade: string };

type DryRun = {
  totalRows: number;
  validRows: number;
  errors: RowError[];
  preview: Preview[];
};

type Result = {
  created: number;
  skipped: number;
  defaultPassword: string;
  students: { id: string; studentCode: string; name: string }[];
};

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ImportStudentsModal({ onClose, onImported }: {
  onClose: () => void;
  onImported: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile]           = useState<File | null>(null);
  const [dryRun, setDryRun]       = useState<DryRun | null>(null);
  const [result, setResult]       = useState<Result | null>(null);
  const [checking, setChecking]   = useState(false);
  const [importing, setImporting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [skipInvalid, setSkipInvalid] = useState(false);
  const [dragging, setDragging]   = useState(false);

  async function handleTemplate() {
    setDownloading(true);
    try {
      const res = await api.get(`${BASE}/import/template`, { responseType: "blob" });
      download(res.data as Blob, `student_import_template_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success("Template downloaded — fill it in and upload it here");
    } catch {
      toast.error("Could not download the template");
    } finally {
      setDownloading(false);
    }
  }

  async function handleFile(picked: File) {
    if (!/\.(xlsx|csv)$/i.test(picked.name)) {
      toast.error("Choose the .xlsx template (or a .csv with the same columns)");
      return;
    }
    setFile(picked);
    setResult(null);
    setSkipInvalid(false);
    setChecking(true);
    try {
      const fd = new FormData();
      fd.append("file", picked);
      const res = await api.post(`${BASE}/import?dryRun=true`, fd);
      setDryRun(res.data.data);
    } catch (e: any) {
      setFile(null);
      setDryRun(null);
      toast.error(e.response?.data?.error ?? "Could not read that file");
    } finally {
      setChecking(false);
    }
  }

  async function handleImport() {
    if (!file) return;
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.post(`${BASE}/import?skipInvalid=${skipInvalid}`, fd);
      setResult(res.data.data);
      onImported();
    } catch (e: any) {
      const data = e.response?.data;
      if (data?.data?.errors) setDryRun({ ...(dryRun as DryRun), ...data.data, preview: dryRun?.preview ?? [] });
      toast.error(data?.error ?? "Import failed");
    } finally {
      setImporting(false);
    }
  }

  function reset() {
    setFile(null); setDryRun(null); setResult(null); setSkipInvalid(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  const errors    = dryRun?.errors ?? [];
  const canImport = !!dryRun && dryRun.validRows > 0 && (errors.length === 0 || skipInvalid);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6"
      style={{ background: "linear-gradient(135deg, rgba(20,23,53,.72), rgba(40,36,95,.62))" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white w-full sm:max-w-3xl sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">

        {/* Head */}
        <div className="shrink-0 flex items-center justify-between gap-4 px-5 sm:px-7 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="h-5 w-5" style={{ color: NAV2 }} />
            </div>
            <div className="min-w-0">
              <h2 className="font-black text-gray-900 text-lg leading-tight">Import Students</h2>
              <p className="text-xs text-gray-400 truncate">
                {result ? "Import complete" : file ? file.name : "Download the template, fill it in, upload it back"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-7 py-5">

          {/* ── Done ─────────────────────────────────────────────────────── */}
          {result ? (
            <div className="text-center py-6">
              <div className="h-14 w-14 rounded-full bg-green-50 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-7 w-7 text-green-600" />
              </div>
              <h3 className="mt-4 text-xl font-black text-gray-900">
                {result.created} student{result.created === 1 ? "" : "s"} imported
              </h3>
              {result.skipped > 0 && (
                <p className="mt-1 text-sm text-amber-600 font-semibold">{result.skipped} row(s) skipped</p>
              )}
              <p className="mt-2 text-sm text-gray-500">
                Each one signs in with the password{" "}
                <span className="font-mono font-bold text-gray-700">{result.defaultPassword}</span>{" "}
                and is asked to change it on first login.
              </p>
              <div className="mt-5 max-h-48 overflow-y-auto text-left rounded-xl border border-gray-100 divide-y divide-gray-50">
                {result.students.map((s) => (
                  <div key={s.id} className="flex items-center justify-between px-4 py-2 text-sm">
                    <span className="font-semibold text-gray-700 truncate">{s.name}</span>
                    <span className="font-mono text-xs text-gray-400 shrink-0 ml-3">{s.studentCode}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* ── Step 1 — template ──────────────────────────────────────── */}
              <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
                  <div className="flex-1">
                    <p className="text-sm font-black text-gray-900">1 · Download the template</p>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                      An Excel file with every column, a guide sheet, and your live School / Grade /
                      Course / Batch names to copy from. First Name, Last Name and Email are required —
                      everything else is optional.
                    </p>
                  </div>
                  <button
                    onClick={handleTemplate}
                    disabled={downloading}
                    className="shrink-0 min-h-[42px] rounded-xl border border-gray-200 bg-white px-4 text-sm font-extrabold text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    Template
                  </button>
                </div>
              </div>

              {/* ── Step 2 — upload ───────────────────────────────────────── */}
              <p className="text-sm font-black text-gray-900 mt-5 mb-2">2 · Upload the filled file</p>

              {!file ? (
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault(); setDragging(false);
                    const dropped = e.dataTransfer.files?.[0];
                    if (dropped) handleFile(dropped);
                  }}
                  onClick={() => inputRef.current?.click()}
                  className={`rounded-2xl border-2 border-dashed px-6 py-10 text-center cursor-pointer transition-colors ${
                    dragging ? "border-indigo-400 bg-indigo-50/60" : "border-gray-200 hover:border-gray-300 bg-white"
                  }`}
                >
                  <Upload className="h-7 w-7 mx-auto text-gray-300" />
                  <p className="mt-3 text-sm font-bold text-gray-700">Drop the file here, or tap to browse</p>
                  <p className="text-xs text-gray-400 mt-1">.xlsx or .csv · up to 500 students · max 5 MB</p>
                </div>
              ) : checking ? (
                <div className="rounded-2xl border border-gray-100 px-6 py-10 text-center">
                  <Loader2 className="h-6 w-6 mx-auto animate-spin text-indigo-500" />
                  <p className="mt-3 text-sm font-bold text-gray-600">Checking {file.name}…</p>
                </div>
              ) : dryRun && (
                <>
                  {/* Summary */}
                  <div className="grid grid-cols-3 gap-2.5">
                    {[
                      { label: "Rows found", value: dryRun.totalRows, tone: "text-gray-900" },
                      { label: "Ready", value: dryRun.validRows, tone: "text-green-600" },
                      { label: "Problems", value: errors.length, tone: errors.length ? "text-red-600" : "text-gray-900" },
                    ].map((s) => (
                      <div key={s.label} className="rounded-xl border border-gray-100 bg-white px-3 py-3 text-center">
                        <div className={`text-2xl font-black ${s.tone}`}>{s.value}</div>
                        <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mt-0.5">{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Errors */}
                  {errors.length > 0 && (
                    <div className="mt-4 rounded-2xl border border-red-100 bg-red-50/50 overflow-hidden">
                      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-red-100">
                        <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                        <p className="text-sm font-black text-red-700">
                          Fix these in the spreadsheet, then upload again
                        </p>
                      </div>
                      <div className="max-h-56 overflow-y-auto divide-y divide-red-100/70">
                        {errors.slice(0, 100).map((e, i) => (
                          <div key={i} className="px-4 py-2 text-xs flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-3">
                            <span className="font-black text-red-700 shrink-0">
                              Row {e.row}{e.column ? ` · ${e.column}` : ""}
                            </span>
                            <span className="text-red-600/90">{e.message}</span>
                          </div>
                        ))}
                        {errors.length > 100 && (
                          <div className="px-4 py-2 text-xs font-bold text-red-500">
                            …and {errors.length - 100} more
                          </div>
                        )}
                      </div>
                      {dryRun.validRows > 0 && (
                        <label className="flex items-start gap-2 px-4 py-3 border-t border-red-100 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={skipInvalid}
                            onChange={(e) => setSkipInvalid(e.target.checked)}
                            className="mt-0.5 accent-indigo-600"
                          />
                          <span className="text-xs font-semibold text-gray-600">
                            Import the {dryRun.validRows} valid row(s) anyway and skip the rest
                          </span>
                        </label>
                      )}
                    </div>
                  )}

                  {/* Preview */}
                  {dryRun.preview.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs font-black text-gray-400 uppercase tracking-wide mb-2">
                        Preview — first {dryRun.preview.length} of {dryRun.validRows}
                      </p>
                      <div className="rounded-2xl border border-gray-100 overflow-x-auto">
                        <table className="w-full text-sm min-w-[520px]">
                          <thead>
                            <tr className="bg-gray-50 text-left text-[11px] uppercase tracking-wide text-gray-400 font-black">
                              <th className="px-3 py-2">Row</th>
                              <th className="px-3 py-2">Name</th>
                              <th className="px-3 py-2">Email</th>
                              <th className="px-3 py-2">Grade</th>
                              <th className="px-3 py-2">Batch</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {dryRun.preview.map((p) => (
                              <tr key={p.row}>
                                <td className="px-3 py-2 text-gray-400 font-mono text-xs">{p.row}</td>
                                <td className="px-3 py-2 font-bold text-gray-800 whitespace-nowrap">{p.name}</td>
                                <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{p.email}</td>
                                <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{p.grade || "—"}</td>
                                <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{p.batch || "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* Foot */}
        <div className="shrink-0 flex items-center justify-between gap-3 px-5 sm:px-7 py-4 border-t border-gray-100 bg-gray-50/60">
          {result ? (
            <>
              <span />
              <button
                onClick={onClose}
                className="min-h-[42px] rounded-xl px-5 text-sm font-extrabold text-white"
                style={{ background: PRIMARY_GRADIENT }}
              >
                Done
              </button>
            </>
          ) : (
            <>
              <button
                onClick={file ? reset : onClose}
                className="min-h-[42px] rounded-xl border border-gray-200 bg-white px-4 text-sm font-extrabold text-gray-600 hover:bg-gray-100 flex items-center gap-1.5"
              >
                {file && <ArrowLeft className="h-3.5 w-3.5" />}
                {file ? "Choose another file" : "Cancel"}
              </button>
              <button
                onClick={handleImport}
                disabled={!canImport || importing}
                className="min-h-[42px] rounded-xl px-5 text-sm font-extrabold text-white flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: PRIMARY_GRADIENT }}
              >
                {importing && <Loader2 className="h-4 w-4 animate-spin" />}
                {importing
                  ? "Importing…"
                  : dryRun
                    ? `Import ${skipInvalid ? dryRun.validRows : dryRun.totalRows} student${(skipInvalid ? dryRun.validRows : dryRun.totalRows) === 1 ? "" : "s"}`
                    : "Import"}
              </button>
            </>
          )}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.csv"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />
    </div>
  );
}
