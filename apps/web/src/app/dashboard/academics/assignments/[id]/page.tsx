"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  ArrowLeft, BookOpen, User, Calendar, Clock, Paperclip,
  CheckCircle2, XCircle, RotateCcw, Loader2, X, Check,
  ChevronDown, Search,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { format, parseISO } from "date-fns";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  try { return format(parseISO(iso.includes("T") ? iso : iso + "T00:00:00"), "dd MMM yyyy"); } catch { return iso; }
}

const SUBMISSION_STATUS = ["NOT_SUBMITTED", "SUBMITTED", "IN_PROCESS", "APPROVED", "REJECTED"] as const;
type SubStatus = typeof SUBMISSION_STATUS[number];

const STATUS_LABEL: Record<SubStatus, string> = {
  NOT_SUBMITTED: "Not Submitted",
  SUBMITTED:     "Submitted",
  IN_PROCESS:    "In Process",
  APPROVED:      "Approved",
  REJECTED:      "Rejected",
};

// "Status" column — whether student has submitted
const SUBMIT_LABEL: Record<SubStatus, string> = {
  NOT_SUBMITTED: "Not Submitted",
  SUBMITTED:     "Submitted",
  IN_PROCESS:    "Submitted",
  APPROVED:      "Submitted",
  REJECTED:      "Submitted",
};

// "Approval Status" column
const APPROVAL_LABEL: Record<SubStatus, string> = {
  NOT_SUBMITTED: "Pending",
  SUBMITTED:     "Pending",
  IN_PROCESS:    "In Process",
  APPROVED:      "Approved",
  REJECTED:      "Rejected",
};

const SUBMIT_COLORS: Record<SubStatus, string> = {
  NOT_SUBMITTED: "text-red-600",
  SUBMITTED:     "text-green-600",
  IN_PROCESS:    "text-blue-600",
  APPROVED:      "text-green-700",
  REJECTED:      "text-red-600",
};

const APPROVAL_COLORS: Record<SubStatus, string> = {
  NOT_SUBMITTED: "text-amber-600",
  SUBMITTED:     "text-amber-600",
  IN_PROCESS:    "text-blue-600",
  APPROVED:      "text-green-600",
  REJECTED:      "text-red-600",
};

const STATUS_BG: Record<SubStatus, string> = {
  NOT_SUBMITTED: "bg-red-50 text-red-700 border-red-100",
  SUBMITTED:     "bg-blue-50 text-blue-700 border-blue-100",
  IN_PROCESS:    "bg-violet-50 text-violet-700 border-violet-100",
  APPROVED:      "bg-green-50 text-green-700 border-green-100",
  REJECTED:      "bg-red-50 text-red-700 border-red-100",
};

// ── Review modal ──────────────────────────────────────────────────────────────

function ReviewModal({
  open, onClose, submission, assignmentId, onSaved,
}: {
  open: boolean; onClose: () => void; assignmentId: string;
  submission: any; onSaved: () => void;
}) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus]       = useState<SubStatus>("NOT_SUBMITTED");
  const [note,   setNote]         = useState("");
  const [file,   setFile]         = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (open && submission) {
      setStatus(submission.status ?? "NOT_SUBMITTED");
      setNote(submission.reviewNote ?? "");
      setFile(null);
    }
  }, [open, submission]);

  const updateMut = useMutation({
    mutationFn: () =>
      api.patch(`/api/v1/academics/assignments/${assignmentId}/submissions/${submission.student.id}`,
        { status, reviewNote: note }).then((r) => r.data),
    onSuccess: async (res) => {
      if (!res.success) { toast.error(res.error); return; }
      if (file) {
        setUploading(true);
        try {
          const fd = new FormData(); fd.append("file", file);
          await api.post(
            `/api/v1/academics/assignments/${assignmentId}/submissions/${submission.student.id}/attachment`,
            fd, { headers: { "Content-Type": "multipart/form-data" } }
          );
        } catch { toast.error("Status saved but file upload failed"); }
        setUploading(false);
      }
      qc.invalidateQueries({ queryKey: ["assignment-submissions", assignmentId] });
      toast.success("Submission updated");
      onSaved();
      onClose();
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });

  if (!open || !submission) return null;
  const busy = updateMut.isPending || uploading;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <div>
            <p className="text-sm font-semibold text-gray-900">
              {submission.student.firstName} {submission.student.lastName}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {submission.student.studentCode}
              {submission.student.rollNumber ? ` · Roll ${submission.student.rollNumber}` : ""}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-400">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Current status badge */}
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_BG[submission.status as SubStatus ?? "NOT_SUBMITTED"]}`}>
              {STATUS_LABEL[submission.status as SubStatus ?? "NOT_SUBMITTED"]}
            </span>
            {submission.submittedAt && (
              <span className="text-xs text-gray-400">
                Submitted {fmtDate(submission.submittedAt)}
              </span>
            )}
          </div>

          {/* Student attachment */}
          {submission.attachmentUrl && (
            <div className="flex items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2">
              <Paperclip className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
              <a href={submission.attachmentUrl} target="_blank" rel="noreferrer"
                className="text-xs font-medium text-indigo-700 hover:underline truncate">
                {submission.attachmentName ?? "View submission"}
              </a>
            </div>
          )}

          {/* Status select */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Update Status</label>
            <div className="grid grid-cols-1 gap-1.5">
              {SUBMISSION_STATUS.map((s) => (
                <button key={s} type="button" onClick={() => setStatus(s)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs text-left transition-colors ${
                    status === s ? STATUS_BG[s] + " ring-1 ring-offset-1 ring-current" : "border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                  }`}>
                  {status === s && <Check className="h-3.5 w-3.5 shrink-0" />}
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Review note */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Review Note</label>
            <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="Feedback, comments, or review notes…"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none" />
          </div>

          {/* Attachment upload */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Add / Replace Attachment</label>
            <div className="flex items-center gap-2">
              <input ref={fileRef} type="file" className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              <button type="button" onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
                <Paperclip className="h-3.5 w-3.5" /> Choose file
              </button>
              {file
                ? <span className="text-xs text-indigo-700 truncate max-w-[180px]">{file.name}</span>
                : <span className="text-xs text-gray-400">No file</span>}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 pb-5 pt-2 border-t border-gray-100">
          <button onClick={onClose} disabled={busy}
            className="px-4 py-2 text-sm text-gray-500 rounded-lg hover:bg-gray-100">
            Cancel
          </button>
          <button onClick={() => updateMut.mutate()} disabled={busy}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Submission row ─────────────────────────────────────────────────────────────

function SubmissionRow({ sub, canEdit, onReview }: {
  sub: any; canEdit: boolean; onReview: (sub: any) => void;
}) {
  const status = (sub.status ?? "NOT_SUBMITTED") as SubStatus;
  return (
    <tr className="hover:bg-gray-50/60 transition-colors group border-b border-gray-100 last:border-0">
      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
        {sub.student?.rollNumber ?? "—"}
      </td>
      <td className="px-4 py-3">
        <p className="text-sm font-medium text-gray-900">
          {sub.student?.firstName} {sub.student?.lastName}
        </p>
        <p className="text-xs text-gray-400">{sub.student?.studentCode}</p>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <span className={`text-xs font-medium ${APPROVAL_COLORS[status]}`}>
          {APPROVAL_LABEL[status]}
        </span>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <span className={`text-xs font-medium ${SUBMIT_COLORS[status]}`}>
          {SUBMIT_LABEL[status]}
        </span>
      </td>
      <td className="px-4 py-3">
        {sub.reviewNote && (
          <p className="text-xs text-gray-500 max-w-[200px] truncate" title={sub.reviewNote}>
            {sub.reviewNote}
          </p>
        )}
        {sub.attachmentUrl && (
          <a href={sub.attachmentUrl} target="_blank" rel="noreferrer"
            className="flex items-center gap-1 text-xs text-indigo-600 hover:underline mt-0.5">
            <Paperclip className="h-3 w-3" />{sub.attachmentName ?? "View file"}
          </a>
        )}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        {canEdit && (
          <button onClick={() => onReview(sub)}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors opacity-0 group-hover:opacity-100 sm:opacity-100">
            Review
          </button>
        )}
      </td>
    </tr>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AssignmentDetailPage() {
  const { id }  = useParams<{ id: string }>();
  const router  = useRouter();
  const { user } = useAuthStore();
  const qc      = useQueryClient();
  const canEdit = user?.role === "SUPER_ADMIN" || user?.role === "HR_ADMIN";

  const [search,       setSearch]       = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [reviewTarget, setReviewTarget] = useState<any | null>(null);

  // Fetch assignment details
  const { data: aData, isLoading: aLoading } = useQuery({
    queryKey: ["assignment", id],
    queryFn:  () => api.get(`/api/v1/academics/assignments/${id}`).then((r) => r.data),
    enabled:  !!id,
  });

  // Fetch submissions
  const { data: subData, isLoading: subLoading } = useQuery({
    queryKey: ["assignment-submissions", id],
    queryFn:  () => api.get(`/api/v1/academics/assignments/${id}/submissions`).then((r) => r.data),
    enabled:  !!id,
  });

  const assignment: any        = aData?.data ?? null;
  const currentSubs: any[]     = subData?.data?.current  ?? [];
  const removedSubs: any[]     = subData?.data?.removed  ?? [];

  // Status mutation
  const statusMut = useMutation({
    mutationFn: (status: string) =>
      api.patch(`/api/v1/academics/assignments/${id}/status`, { status }).then((r) => r.data),
    onSuccess: (res) => {
      if (!res.success) { toast.error(res.error); return; }
      qc.invalidateQueries({ queryKey: ["assignment", id] });
      qc.invalidateQueries({ queryKey: ["assignments"] });
      toast.success("Assignment marked as complete");
    },
  });

  // Derived counts
  const total      = currentSubs.length;
  const submitted  = currentSubs.filter((s) => s.status !== "NOT_SUBMITTED").length;
  const pending    = currentSubs.filter((s) => ["NOT_SUBMITTED", "SUBMITTED"].includes(s.status)).length;
  const inProcess  = currentSubs.filter((s) => s.status === "IN_PROCESS").length;
  const approved   = currentSubs.filter((s) => s.status === "APPROVED").length;
  const rejected   = currentSubs.filter((s) => s.status === "REJECTED").length;

  // Filtered submissions
  const filtered = currentSubs.filter((s) => {
    const nameMatch = !search ||
      `${s.student?.firstName} ${s.student?.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
      (s.student?.studentCode ?? "").toLowerCase().includes(search.toLowerCase());
    const statusMatch = filterStatus === "ALL" || s.status === filterStatus;
    return nameMatch && statusMatch;
  });

  const batchNames = assignment?.batches?.map((ab: any) => ab.batch?.name).filter(Boolean).join(", ") ?? "—";

  if (aLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-400">Assignment not found.</p>
        <button onClick={() => router.back()} className="mt-4 text-sm text-indigo-600 hover:underline">Go back</button>
      </div>
    );
  }

  const STATUS_FILTER_TABS = [
    { key: "ALL",           label: "All" },
    { key: "NOT_SUBMITTED", label: "Not Submitted" },
    { key: "SUBMITTED",     label: "Submitted" },
    { key: "IN_PROCESS",    label: "In Process" },
    { key: "APPROVED",      label: "Approved" },
    { key: "REJECTED",      label: "Rejected" },
  ];

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-gray-50">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100 px-4 sm:px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <button onClick={() => router.back()}
              className="mt-0.5 p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="p-1.5 bg-indigo-100 rounded-lg shrink-0">
                  <BookOpen className="h-4 w-4 text-indigo-600" />
                </div>
                <h1 className="text-base font-bold text-gray-900 leading-tight">{assignment.name}</h1>
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium shrink-0 ${
                  assignment.status === "DUE"       ? "bg-amber-50 text-amber-700 border-amber-200" :
                  assignment.status === "COMPLETED" ? "bg-green-50 text-green-700 border-green-200" :
                                                      "bg-gray-100 text-gray-500 border-gray-200"
                }`}>
                  {assignment.status.charAt(0) + assignment.status.slice(1).toLowerCase()}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 mt-2 text-xs text-gray-500">
                <span><span className="font-medium text-gray-700">Academic Year:</span> {assignment.academicYear}</span>
                <span><span className="font-medium text-gray-700">Batch:</span> {batchNames}</span>
                {assignment.subject && <span><span className="font-medium text-gray-700">Subject:</span> {assignment.subject.name}</span>}
                {assignment.employee && <span><span className="font-medium text-gray-700">Faculty:</span> {assignment.employee.firstName} {assignment.employee.lastName}</span>}
                <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /><span className="font-medium text-gray-700">Given:</span> {fmtDate(assignment.assignmentDate)}</span>
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /><span className="font-medium text-gray-700">Due:</span> {fmtDate(assignment.submissionDate)}</span>
              </div>
            </div>
          </div>
          {canEdit && assignment.status === "DUE" && (
            <button
              onClick={() => { if (confirm("Mark this assignment as complete?")) statusMut.mutate("COMPLETED"); }}
              disabled={statusMut.isPending}
              className="shrink-0 flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors">
              {statusMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              Mark Complete
            </button>
          )}
        </div>
      </div>

      {/* ── Stats cards ────────────────────────────────────────────────────── */}
      <div className="px-4 sm:px-6 pt-4">
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
          {[
            { label: "Students",   value: total,     color: "border-indigo-100 bg-indigo-50",  text: "text-indigo-700" },
            { label: "Submitted",  value: submitted,  color: "border-green-100 bg-green-50",   text: "text-green-700" },
            { label: "Pending",    value: pending,    color: "border-amber-100 bg-amber-50",   text: "text-amber-700" },
            { label: "In Process", value: inProcess,  color: "border-violet-100 bg-violet-50", text: "text-violet-700" },
            { label: "Approved",   value: approved,   color: "border-green-100 bg-green-50",   text: "text-green-800" },
            { label: "Rejected",   value: rejected,   color: "border-red-100 bg-red-50",       text: "text-red-700" },
          ].map(({ label, value, color, text }) => (
            <div key={label} className={`rounded-xl border p-3 ${color}`}>
              <p className="text-[10px] font-medium text-gray-500 mb-0.5">{label}</p>
              <p className={`text-xl font-bold ${text}`}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Filter bar ─────────────────────────────────────────────────────── */}
      <div className="px-4 sm:px-6 pt-4 pb-1">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-300 pointer-events-none" />
            <input type="text" placeholder="Search student…" value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-200 pl-8 pr-3 py-1.5 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white" />
          </div>
          {/* Status filter tabs */}
          <div className="flex flex-wrap gap-1.5">
            {STATUS_FILTER_TABS.map(({ key, label }) => (
              <button key={key} onClick={() => setFilterStatus(key)}
                className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                  filterStatus === key
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                }`}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Student submission table ────────────────────────────────────────── */}
      <div className="px-4 sm:px-6 py-4 space-y-4">
        {subLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-14 rounded-xl bg-gray-100 animate-pulse" />)}
          </div>
        ) : (
          <>
            {/* Students Appearing */}
            <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/60">
                <p className="text-xs font-semibold text-indigo-700">
                  Students Appearing ({filtered.length})
                </p>
              </div>
              {filtered.length === 0 ? (
                <div className="py-10 text-center">
                  <User className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No students match this filter</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        {["Roll No", "Student", "Approval Status", "Status", "Review Note / File", canEdit ? "Action" : ""].map((h) => (
                          <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((sub: any) => (
                        <SubmissionRow key={sub.studentId ?? sub.student?.id} sub={sub}
                          canEdit={canEdit} onReview={setReviewTarget} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Students Removed */}
            {removedSubs.length > 0 && (
              <div className="rounded-2xl border border-red-100 bg-white shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-red-100 bg-red-50/40">
                  <p className="text-xs font-semibold text-red-700">
                    Students Removed ({removedSubs.length})
                  </p>
                  <p className="text-[10px] text-red-400 mt-0.5">These students are no longer in the assigned batch</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        {["Roll No", "Student", "Approval Status", "Status", "Review Note / File", canEdit ? "Action" : ""].map((h) => (
                          <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {removedSubs.map((sub: any) => (
                        <SubmissionRow key={sub.studentId} sub={sub}
                          canEdit={canEdit} onReview={setReviewTarget} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Review modal */}
      <ReviewModal
        open={!!reviewTarget}
        onClose={() => setReviewTarget(null)}
        submission={reviewTarget}
        assignmentId={id}
        onSaved={() => setReviewTarget(null)}
      />
    </div>
  );
}
