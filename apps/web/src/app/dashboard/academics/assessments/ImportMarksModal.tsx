"use client";

import { useRef, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  X, Download, Upload, FileSpreadsheet, CheckCircle2,
  AlertTriangle, Loader2, ArrowLeft,
} from "lucide-react";

const NAV2 = "#28245f";

type RowError = { row: number; column: string; message: string };
type Preview  = { row: number; name: string; attended: boolean; total: number | null };

type DryRun = {
  totalRows: number;
  validRows: number;
  errors: RowError[];
  preview: Preview[];
};

type Result = {
  imported: number;
  skipped:  number;
  errors:   RowError[];
  students: { name: string; total: number | null; attended: boolean }[];
};

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ImportMarksModal({ examId, examName, onClose, onImported }: {
  examId:   string;
  examName: string;
  onClose:  () => void;
  onImported: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile]               = useState<File | null>(null);
  const [dryRun, setDryRun]           = useState<DryRun | null>(null);
  const [result, setResult]           = useState<Result | null>(null);
  const [checking, setChecking]       = useState(false);
  const [importing, setImporting]     = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [skipInvalid, setSkipInvalid] = useState(false);
  const [dragging, setDragging]       = useState(false);

  const BASE = `/api/v1/academics/assessments/${examId}`;

  async function handleTemplate() {
    setDownloading(true);
    try {
      const res = await api.get(`${BASE}/marks-template`, { responseType: "blob" });
      const safe = examName.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 60);
      download(res.data as Blob, `marks_${safe}.xlsx`);
      toast.success("Template downloaded — it already lists this exam's students");
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? "Could not download the template");
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
      const res = await api.post(`${BASE}/marks-import?dryRun=true`, fd);
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
      const res = await api.post(`${BASE}/marks-import?skipInvalid=${skipInvalid}`, fd);
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
              <h2 className="text-base font-bold text-gray-900 truncate">Import Marks</h2>
              <p className="text-xs text-gray-500 truncate">{examName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-7 py-5">

          {/* ── Done ─────────────────────────────────────────────────────── */}
          {result ? (
            <div className="text-center py-4">
              <div className="h-14 w-14 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="h-7 w-7 text-green-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">
                {result.imported} student{result.imported === 1 ? "" : "s"} updated
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {result.skipped > 0
                  ? `${result.skipped} row${result.skipped === 1 ? "" : "s"} skipped. `
                  : ""}
                Marks are saved — close this to see them in the grid.
              </p>

              {result.students.length > 0 && (
                <div className="mt-5 text-left border border-gray-100 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                  {result.students.map((s, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 px-4 py-2 text-sm border-b border-gray-50 last:border-0">
                      <span className="text-gray-700 truncate">{s.name}</span>
                      <span className={`shrink-0 text-xs font-semibold ${s.attended ? "text-gray-900" : "text-amber-600"}`}>
                        {s.attended ? (s.total ?? "—") : "Absent"}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-center gap-3 mt-6">
                <button onClick={() => { reset(); }} className="px-4 py-2 text-sm text-gray-600 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                  Import another file
                </button>
                <button onClick={onClose} className="px-5 py-2 text-sm font-semibold text-white rounded-lg hover:opacity-90 transition-opacity" style={{ backgroundColor: NAV2 }}>
                  Done
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* ── Step 1 — template ──────────────────────────────────────── */}
              <div className="rounded-xl border border-gray-200 p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <span className="h-6 w-6 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold text-gray-900">Download this exam&apos;s template</h3>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                      It already lists every student in this exam, one row each, with a column per subject and
                      any marks already saved. Fill in the marks, keep the Student ID column as it is, and save.
                    </p>
                    <button
                      onClick={handleTemplate}
                      disabled={downloading}
                      className="mt-3 inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border border-indigo-200 text-indigo-700 hover:bg-indigo-50 transition-colors disabled:opacity-50"
                    >
                      {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                      Download template
                    </button>
                  </div>
                </div>
              </div>

              {/* ── Step 2 — upload ────────────────────────────────────────── */}
              <div className="rounded-xl border border-gray-200 p-4 sm:p-5 mt-4">
                <div className="flex items-start gap-3">
                  <span className="h-6 w-6 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold text-gray-900">Upload the filled file</h3>

                    <div
                      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                      onDragLeave={() => setDragging(false)}
                      onDrop={(e) => {
                        e.preventDefault(); setDragging(false);
                        const f = e.dataTransfer.files?.[0];
                        if (f) handleFile(f);
                      }}
                      onClick={() => inputRef.current?.click()}
                      className={`mt-3 rounded-xl border-2 border-dashed px-4 py-7 text-center cursor-pointer transition-colors ${
                        dragging ? "border-indigo-400 bg-indigo-50/50" : "border-gray-200 hover:border-indigo-300 hover:bg-gray-50"
                      }`}
                    >
                      <input
                        ref={inputRef} type="file" accept=".xlsx,.csv" className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                      />
                      {checking ? (
                        <span className="inline-flex items-center gap-2 text-sm text-gray-500">
                          <Loader2 className="h-4 w-4 animate-spin" /> Checking the file…
                        </span>
                      ) : file ? (
                        <span className="inline-flex items-center gap-2 text-sm font-medium text-gray-800">
                          <FileSpreadsheet className="h-4 w-4 text-indigo-600" /> {file.name}
                        </span>
                      ) : (
                        <>
                          <Upload className="h-5 w-5 text-gray-400 mx-auto mb-2" />
                          <p className="text-sm text-gray-600">Drop the file here, or click to choose</p>
                          <p className="text-xs text-gray-400 mt-1">.xlsx or .csv, up to 5 MB</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Step 3 — what was found ────────────────────────────────── */}
              {dryRun && (
                <div className="rounded-xl border border-gray-200 p-4 sm:p-5 mt-4">
                  <div className="flex items-start gap-3">
                    <span className="h-6 w-6 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-bold text-gray-900">Check what will be saved</h3>

                      <div className="flex flex-wrap gap-2 mt-3">
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-700">
                          {dryRun.totalRows} row{dryRun.totalRows === 1 ? "" : "s"} in the file
                        </span>
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-50 text-green-700">
                          {dryRun.validRows} ready to save
                        </span>
                        {errors.length > 0 && (
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-50 text-red-600">
                            {errors.length} problem{errors.length === 1 ? "" : "s"}
                          </span>
                        )}
                      </div>

                      {errors.length > 0 && (
                        <div className="mt-3 rounded-lg border border-red-100 bg-red-50/60 max-h-48 overflow-y-auto">
                          {errors.map((e, i) => (
                            <div key={i} className="flex items-start gap-2 px-3 py-2 text-xs border-b border-red-100 last:border-0">
                              <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
                              <span className="text-red-700">
                                <strong>Row {e.row}</strong>
                                {e.column ? <> · {e.column}</> : null} — {e.message}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {dryRun.preview.length > 0 && (
                        <div className="mt-3 border border-gray-100 rounded-lg overflow-hidden">
                          <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50 text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                            <span>First {dryRun.preview.length} of {dryRun.validRows}</span>
                            <span>Total</span>
                          </div>
                          {dryRun.preview.map((p) => (
                            <div key={p.row} className="flex items-center justify-between gap-3 px-3 py-1.5 text-sm border-t border-gray-50">
                              <span className="text-gray-700 truncate">{p.name}</span>
                              <span className={`shrink-0 text-xs font-semibold ${p.attended ? "text-gray-900" : "text-amber-600"}`}>
                                {p.attended ? (p.total ?? "—") : "Absent"}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {errors.length > 0 && dryRun.validRows > 0 && (
                        <label className="flex items-center gap-2 mt-3 cursor-pointer">
                          <input
                            type="checkbox" checked={skipInvalid}
                            onChange={(e) => setSkipInvalid(e.target.checked)}
                            className="h-4 w-4 accent-indigo-600"
                          />
                          <span className="text-xs text-gray-600">
                            Save the {dryRun.validRows} good row{dryRun.validRows === 1 ? "" : "s"} and skip the rest
                          </span>
                        </label>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <p className="text-xs text-gray-400 mt-4 leading-relaxed">
                Only the students listed in the file are changed — anyone left out keeps the marks they already have.
              </p>
            </>
          )}
        </div>

        {/* Foot */}
        {!result && (
          <div className="shrink-0 flex items-center justify-between gap-3 px-5 sm:px-7 py-3.5 border-t border-gray-100">
            {file ? (
              <button onClick={reset} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-gray-500 rounded-lg hover:bg-gray-100 transition-colors">
                <ArrowLeft className="h-3.5 w-3.5" /> Choose another file
              </button>
            ) : <span />}
            <div className="flex items-center gap-3">
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={!canImport || importing}
                className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: NAV2 }}
              >
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {dryRun ? `Save ${dryRun.validRows} row${dryRun.validRows === 1 ? "" : "s"}` : "Save marks"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
