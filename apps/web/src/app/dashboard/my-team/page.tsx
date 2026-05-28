"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import {
  UsersRound, CalendarOff, CheckCircle2, ListTodo,
  Search, Plus, Trash2, UserPlus, X,
  ChevronUp, ChevronDown, ChevronsUpDown, Paperclip,
  Clock, AlertTriangle, CircleDot, CheckCircle, Ban,
  Filter, CornerDownRight, Send, CalendarDays,
  Activity, ClipboardList,
} from "lucide-react";
import { toast } from "sonner";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TeamMember {
  id: string;
  memberId: string;
  addedAt: string;
  presence: "PRESENT" | "ON_LEAVE";
  activeLeave: { leaveType: string; fromDate: string; toDate: string } | null;
  tasks: { total: number; due: number; completed: number };
  member: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    photoUrl: string | null;
    status: string;
    designation: { title: string } | null;
    department: { name: string } | null;
  };
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  assignedDate: string;
  dueDate: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  status: "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  attachmentUrl: string | null;
  attachmentName: string | null;
  assignedBy: { id: string; firstName: string; lastName: string; employeeCode: string };
  assignedTo: { id: string; firstName: string; lastName: string; employeeCode: string };
  createdAt: string;
}

type SortDir = "asc" | "desc" | null;
type SortCol = keyof Task | null;

interface MemberLeave {
  id: string;
  leaveType: string;
  fromDate: string;
  toDate: string;
  totalDays: number;
  reason: string;
  status: string;
  createdAt: string;
  approver: { firstName: string; lastName: string } | null;
  rejectionNote?: string | null;
}

const LEAVE_LABEL: Record<string, string> = {
  CASUAL: "Casual", SICK: "Sick", EARNED: "Earned",
  MATERNITY: "Maternity", PATERNITY: "Paternity",
  COMPENSATORY: "Comp-off", UNPAID: "Unpaid", SPECIAL: "Special",
};

const LEAVE_STATUS_STYLES: Record<string, string> = {
  PENDING:   "bg-yellow-100 text-yellow-700",
  APPROVED:  "bg-green-100 text-green-700",
  REJECTED:  "bg-red-100 text-red-600",
  CANCELLED: "bg-gray-100 text-gray-400",
};

interface TaskComment {
  id: string;
  body: string;
  createdAt: string;
  parentId: string | null;
  author: { id: string; firstName: string; lastName: string; photoUrl: string | null };
  replies: TaskComment[];
}

interface TaskDetail extends Task {
  assignedBy: { id: string; firstName: string; lastName: string; employeeCode: string; photoUrl: string | null };
  assignedTo: { id: string; firstName: string; lastName: string; employeeCode: string; photoUrl: string | null };
  comments: TaskComment[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const PRIORITY_META = {
  LOW:    { label: "Low",    color: "text-slate-500",  bg: "bg-slate-100", border: "border-l-slate-300" },
  MEDIUM: { label: "Medium", color: "text-blue-600",   bg: "bg-blue-50",   border: "border-l-blue-400"  },
  HIGH:   { label: "High",   color: "text-orange-600", bg: "bg-orange-50", border: "border-l-orange-400" },
  URGENT: { label: "Urgent", color: "text-red-600",    bg: "bg-red-50",    border: "border-l-red-500"   },
};

const STATUS_META = {
  OPEN:        { label: "Open",        icon: CircleDot,    color: "text-blue-600",  bg: "bg-blue-50"   },
  IN_PROGRESS: { label: "In Progress", icon: Clock,        color: "text-orange-600",bg: "bg-orange-50" },
  COMPLETED:   { label: "Completed",   icon: CheckCircle,  color: "text-green-600", bg: "bg-green-50"  },
  CANCELLED:   { label: "Cancelled",   icon: Ban,          color: "text-gray-400",  bg: "bg-gray-100"  },
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function isOverdue(task: Task) {
  return task.status !== "COMPLETED" && task.status !== "CANCELLED" && new Date(task.dueDate) < new Date();
}

function fmtDateTime(d: string) {
  return new Date(d).toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── Small author avatar ───────────────────────────────────────────────────────

function AuthorAvatar({ author }: { author: { firstName: string; lastName: string; photoUrl: string | null } }) {
  return (
    <div className="h-8 w-8 shrink-0 rounded-full bg-blue-500 text-white text-xs font-bold flex items-center justify-center overflow-hidden">
      {author.photoUrl
        ? <img src={`${API_URL}${author.photoUrl}`} alt="" className="h-full w-full object-cover" />
        : `${author.firstName[0]}${author.lastName[0]}`}
    </div>
  );
}

// ── Comment thread ────────────────────────────────────────────────────────────

function CommentItem({
  comment, currentUserId, canDelete, taskId, onDeleted, depth = 0,
}: {
  comment: TaskComment;
  currentUserId: string;
  canDelete: (comment: TaskComment) => boolean;
  taskId: string;
  onDeleted: () => void;
  depth?: number;
}) {
  const queryClient = useQueryClient();
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState("");

  const deleteMut = useMutation({
    mutationFn: () => api.delete(`/api/v1/tasks/${taskId}/comments/${comment.id}`),
    onSuccess: () => { onDeleted(); queryClient.invalidateQueries({ queryKey: ["task-detail", taskId] }); },
    onError: (err: any) => toast.error(err.response?.data?.error ?? "Failed"),
  });

  const replyMut = useMutation({
    mutationFn: () => api.post(`/api/v1/tasks/${taskId}/comments`, { body: replyText.trim(), parentId: comment.id }),
    onSuccess: () => {
      setReplyText("");
      setReplying(false);
      queryClient.invalidateQueries({ queryKey: ["task-detail", taskId] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? "Failed"),
  });

  return (
    <div className={depth > 0 ? "ml-10 mt-2" : ""}>
      <div className="flex gap-3 group">
        <AuthorAvatar author={comment.author} />
        <div className="flex-1 min-w-0">
          <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-xs font-semibold text-gray-800">
                {comment.author.firstName} {comment.author.lastName}
              </span>
              <span className="text-[11px] text-gray-400 whitespace-nowrap">{fmtDateTime(comment.createdAt)}</span>
            </div>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{comment.body}</p>
          </div>
          <div className="flex items-center gap-3 mt-1 px-1">
            {depth === 0 && (
              <button
                onClick={() => setReplying((v) => !v)}
                className="text-[11px] text-gray-400 hover:text-blue-600 font-medium flex items-center gap-0.5"
              >
                <CornerDownRight className="h-3 w-3" /> Reply
              </button>
            )}
            {canDelete(comment) && (
              <button
                onClick={() => deleteMut.mutate()}
                disabled={deleteMut.isPending}
                className="text-[11px] text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                Delete
              </button>
            )}
          </div>

          {replying && (
            <div className="mt-2 flex gap-2">
              <input
                autoFocus
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && replyText.trim()) { e.preventDefault(); replyMut.mutate(); } }}
                placeholder={`Reply to ${comment.author.firstName}…`}
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={() => replyMut.mutate()}
                disabled={!replyText.trim() || replyMut.isPending}
                className="rounded-lg bg-blue-600 text-white px-3 py-2 disabled:opacity-50 hover:bg-blue-700"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => setReplying(false)} className="text-gray-400 hover:text-gray-600 px-1">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {comment.replies.map((r) => (
        <CommentItem
          key={r.id}
          comment={r}
          currentUserId={currentUserId}
          canDelete={canDelete}
          taskId={taskId}
          onDeleted={onDeleted}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

// ── Task Detail Inline (expands below table row) ─────────────────────────────

function TaskDetailInline({ task: listTask, onClose }: { task: Task; onClose: () => void }) {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);

  // Scroll into view as soon as this mounts
  useEffect(() => {
    panelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);

  // Only fetch comments — task metadata is already in listTask (instant display)
  const { data: detail } = useQuery<TaskDetail>({
    queryKey: ["task-detail", listTask.id],
    queryFn: () => api.get(`/api/v1/tasks/${listTask.id}`).then((r) => r.data.data),
    staleTime: 3 * 60 * 1000,  // don't re-fetch comments within 3 min
  });

  const comments = detail?.comments ?? [];

  const commentMut = useMutation({
    mutationFn: () => api.post(`/api/v1/tasks/${listTask.id}/comments`, { body: newComment.trim() }),
    onSuccess: () => {
      setNewComment("");
      queryClient.invalidateQueries({ queryKey: ["task-detail", listTask.id] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? "Failed"),
  });

  const canDelete = (c: TaskComment) =>
    c.author.id === user?.id || user?.role === "SUPER_ADMIN" || user?.role === "HR_ADMIN";

  const pm = PRIORITY_META[listTask.priority];
  const sm = STATUS_META[listTask.status];
  const overdue = isOverdue(listTask);

  return (
    <div ref={panelRef} className="border-t-2 border-blue-500 bg-white shadow-[inset_0_2px_8px_rgba(0,0,0,0.06)]">
      {/* Header */}
      <div className="flex items-start justify-between px-8 py-4 bg-gradient-to-r from-blue-50 to-indigo-50/50 border-b border-blue-100">
        <div className="flex-1 min-w-0 pr-4">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${sm.bg} ${sm.color}`}>
              {sm.label}
            </span>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${pm.bg} ${pm.color}`}>
              {pm.label}
            </span>
            {overdue && (
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-red-50 text-red-600">
                <AlertTriangle className="h-3 w-3" /> Overdue
              </span>
            )}
          </div>
          <h3 className="text-lg font-bold text-gray-900 leading-snug">{listTask.title}</h3>
        </div>
        <button onClick={onClose} className="shrink-0 text-gray-400 hover:text-gray-700 rounded-lg p-1.5 hover:bg-white/80">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Meta grid — shown immediately from listTask */}
      <div className="px-8 py-4 grid grid-cols-4 gap-x-8 gap-y-2 border-b border-gray-100 text-sm">
        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Assigned By</p>
          <p className="text-gray-700">{listTask.assignedBy.firstName} {listTask.assignedBy.lastName}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Assigned To</p>
          <p className="text-gray-700">{listTask.assignedTo.firstName} {listTask.assignedTo.lastName}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Assigned Date</p>
          <p className="text-gray-700">{fmtDate(listTask.assignedDate)}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Due Date</p>
          <p className={`font-medium ${overdue ? "text-red-600" : "text-gray-700"}`}>{fmtDate(listTask.dueDate)}</p>
        </div>
      </div>

      {/* Description */}
      {listTask.description && (
        <div className="px-8 py-3 border-b border-gray-100">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Description</p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{listTask.description}</p>
        </div>
      )}

      {/* Attachment */}
      {listTask.attachmentName && (
        <div className="px-8 py-2.5 border-b border-gray-100">
          <a
            href={`${API_URL}${listTask.attachmentUrl}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"
          >
            <Paperclip className="h-4 w-4" />{listTask.attachmentName}
          </a>
        </div>
      )}

      {/* Comments — loads async, shows spinner inline */}
      <div className="px-8 py-4 border-b border-gray-100">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Updates &amp; Comments
          {comments.length > 0 && <span className="ml-2 text-blue-500">{comments.length}</span>}
        </p>
        {!detail ? (
          <div className="flex items-center gap-2 py-4 text-gray-400 text-xs">
            <div className="h-3.5 w-3.5 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
            Loading comments…
          </div>
        ) : comments.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-5 border border-dashed border-gray-200 rounded-xl">
            No updates yet — be the first to add one.
          </p>
        ) : (
          <div className="space-y-4">
            {comments.map((c) => (
              <CommentItem
                key={c.id}
                comment={c}
                currentUserId={user?.id ?? ""}
                canDelete={canDelete}
                taskId={listTask.id}
                onDeleted={() => queryClient.invalidateQueries({ queryKey: ["task-detail", listTask.id] })}
              />
            ))}
          </div>
        )}
      </div>

      {/* New comment */}
      <div className="px-8 py-4 bg-gray-50">
        <div className="flex gap-3 items-end">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && newComment.trim()) { e.preventDefault(); commentMut.mutate(); } }}
            rows={2}
            placeholder="Add an update or comment… (Enter to submit, Shift+Enter for new line)"
            className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-white"
          />
          <button
            onClick={() => commentMut.mutate()}
            disabled={!newComment.trim() || commentMut.isPending}
            className="shrink-0 rounded-xl bg-blue-600 text-white px-4 py-2.5 hover:bg-blue-700 disabled:opacity-50 font-medium text-sm inline-flex items-center gap-1.5"
          >
            <Send className="h-3.5 w-3.5" />
            Post
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ member, size = "md" }: { member: TeamMember["member"]; size?: "sm" | "md" }) {
  const cls = size === "sm"
    ? "h-8 w-8 text-xs"
    : "h-11 w-11 text-sm";
  return (
    <div className={`${cls} shrink-0 rounded-full bg-blue-500 text-white font-bold flex items-center justify-center overflow-hidden`}>
      {member.photoUrl
        ? <img src={`${API_URL}${member.photoUrl}`} alt="" className="h-full w-full object-cover" />
        : `${member.firstName[0]}${member.lastName[0]}`}
    </div>
  );
}

// ── Add Member Panel ──────────────────────────────────────────────────────────

function AddMemberPanel({ ownerId, onClose }: { ownerId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const { data: results = [] } = useQuery<any[]>({
    queryKey: ["team-search", ownerId, debouncedQ],
    queryFn: () =>
      api.get(`/api/v1/employees/${ownerId}/team/search`, { params: { q: debouncedQ } }).then((r) => r.data.data),
    enabled: debouncedQ.length > 0,
    staleTime: 60 * 1000,
  });

  const addMutation = useMutation({
    mutationFn: (memberId: string) => api.post(`/api/v1/employees/${ownerId}/team`, { memberId }),
    onSuccess: () => {
      toast.success("Team member added");
      queryClient.invalidateQueries({ queryKey: ["my-team", ownerId] });
      queryClient.invalidateQueries({ queryKey: ["team-search", ownerId] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? "Failed to add"),
  });

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-blue-100">
        <div className="flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-blue-600" />
          <p className="font-semibold text-blue-900 text-sm">Add Team Member</p>
        </div>
        <button onClick={onClose} className="text-blue-400 hover:text-blue-700">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            autoFocus value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or employee code…"
            className="w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          />
        </div>
        {results.length > 0 ? (
          <ul className="mt-3 rounded-xl border border-gray-200 bg-white divide-y divide-gray-50 max-h-64 overflow-y-auto shadow-sm">
            {results.map((emp: any) => (
              <li key={emp.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-bold overflow-hidden">
                  {emp.photoUrl
                    ? <img src={`${API_URL}${emp.photoUrl}`} alt="" className="h-full w-full object-cover" />
                    : `${emp.firstName[0]}${emp.lastName[0]}`}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{emp.firstName} {emp.lastName}</p>
                  <p className="text-xs text-gray-500 truncate">{emp.employeeCode} · {emp.designation?.title} · {emp.department?.name}</p>
                </div>
                <button
                  onClick={() => addMutation.mutate(emp.id)}
                  disabled={addMutation.isPending}
                  className="shrink-0 inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
                  style={{ backgroundColor: "#2C3E7C" }}
                >
                  <Plus className="h-3 w-3" /> Add
                </button>
              </li>
            ))}
          </ul>
        ) : q.length > 0 ? (
          <p className="mt-3 text-sm text-gray-400 text-center py-4 bg-white rounded-xl border border-gray-100">No matching employees found</p>
        ) : (
          <p className="mt-3 text-xs text-blue-600 text-center py-3">Start typing to search all employees</p>
        )}
      </div>
    </div>
  );
}

// ── New Task Modal ────────────────────────────────────────────────────────────

interface NewTaskModalProps {
  assigneeId: string;
  assigneeName: string;
  onClose: () => void;
  onCreated: (newTask: Task) => void;
}

function NewTaskModal({ assigneeId, assigneeName, onClose, onCreated }: NewTaskModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    assignedDate: new Date().toISOString().split("T")[0],
    dueDate: "",
    priority: "MEDIUM" as Task["priority"],
  });
  const [file, setFile] = useState<File | null>(null);

  const createMut = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      fd.append("title", form.title);
      fd.append("description", form.description);
      fd.append("assignedToId", assigneeId);
      fd.append("assignedDate", new Date(form.assignedDate).toISOString());
      fd.append("dueDate", new Date(form.dueDate).toISOString());
      fd.append("priority", form.priority);
      if (file) fd.append("file", file);
      return api.post("/api/v1/tasks", fd, { headers: { "Content-Type": "multipart/form-data" } });
    },
    onSuccess: (res) => {
      toast.success("Task assigned");
      onCreated(res.data.data as Task);
      onClose();
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? "Failed to create task"),
  });

  const canSubmit = form.title.trim() && form.dueDate;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">New Task</h2>
            <p className="text-xs text-gray-500 mt-0.5">Assign to {assigneeName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 rounded-lg p-1.5 hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Topic / Title <span className="text-red-500">*</span></label>
            <input
              autoFocus
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="What needs to be done?"
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={6}
              placeholder="Provide details, context, or acceptance criteria…"
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            />
          </div>

          {/* Dates + Priority row */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Assigned Date</label>
              <input
                type="date" max="2099-12-31" min="1900-01-01"
                value={form.assignedDate}
                onChange={(e) => setForm({ ...form, assignedDate: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Due Date <span className="text-red-500">*</span></label>
              <input
                type="date" max="2099-12-31"
                value={form.dueDate}
                min={form.assignedDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value as Task["priority"] })}
                className={`w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium ${PRIORITY_META[form.priority].color}`}
              >
                {(["LOW", "MEDIUM", "HIGH", "URGENT"] as const).map((p) => (
                  <option key={p} value={p}>{PRIORITY_META[p].label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Attachment — compact icon row */}
          <input ref={fileRef} type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              title="Attach a file"
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            >
              <Paperclip className="h-3.5 w-3.5" />
              {file ? "Change file" : "Attach file"}
            </button>
            {file && (
              <>
                <span className="text-xs text-blue-700 truncate max-w-xs">{file.name}</span>
                <button onClick={() => setFile(null)} className="text-gray-400 hover:text-red-500 shrink-0">
                  <X className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100">Cancel</button>
          <button
            onClick={() => createMut.mutate()}
            disabled={!canSubmit || createMut.isPending}
            className="px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {createMut.isPending ? "Assigning…" : "Assign Task"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sort Header ───────────────────────────────────────────────────────────────

function SortTh({
  col, label, sortCol, sortDir, onSort, className = "",
}: {
  col: SortCol; label: string; sortCol: SortCol; sortDir: SortDir;
  onSort: (col: SortCol) => void; className?: string;
}) {
  const active = sortCol === col;
  return (
    <button
      onClick={() => onSort(col)}
      className={`flex items-center gap-1 text-[11px] font-bold text-gray-400 uppercase tracking-wide cursor-pointer select-none hover:text-gray-600 transition-colors shrink-0 ${className}`}
    >
      {label}
      {active
        ? sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
        : <ChevronsUpDown className="h-3 w-3 text-gray-300" />}
    </button>
  );
}

// ── Task Panel (drawer-style overlay) ────────────────────────────────────────

interface TaskPanelProps {
  member: TeamMember;
  canAssign: boolean;
  onClose: () => void;
}

function TaskPanel({ member, canAssign, onClose }: TaskPanelProps) {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [showNew, setShowNew] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [sortCol, setSortCol] = useState<SortCol>("dueDate");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPriority, setFilterPriority] = useState("");

  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ["tasks", member.memberId],
    queryFn: () =>
      api.get(`/api/v1/tasks?assignedToId=${member.memberId}`).then((r) => r.data.data),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/tasks/${id}`),
    onSuccess: (_, deletedId) => {
      toast.success("Task removed");
      // Update task list cache directly — no refetch needed
      queryClient.setQueryData<Task[]>(["tasks", member.memberId], (old) =>
        old ? old.filter((t) => t.id !== deletedId) : []
      );
      // Update the member's task count in the team list without a full refetch
      queryClient.setQueryData<TeamMember[]>(["my-team", user?.id], (old) =>
        old
          ? old.map((m) =>
              m.memberId === member.memberId
                ? { ...m, tasks: { ...m.tasks, total: Math.max(0, m.tasks.total - 1) } }
                : m
            )
          : old
      );
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? "Failed"),
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/api/v1/tasks/${id}`, { status }),
    onSuccess: (res) => {
      // Patch the task in the list cache directly
      const updated = res.data.data as Task;
      queryClient.setQueryData<Task[]>(["tasks", member.memberId], (old) =>
        old ? old.map((t) => (t.id === updated.id ? updated : t)) : []
      );
      // Keep the team-level completed count in sync
      queryClient.setQueryData<TeamMember[]>(["my-team", user?.id], (old) => {
        if (!old) return old;
        return old.map((m) => {
          if (m.memberId !== member.memberId) return m;
          const tasks = queryClient.getQueryData<Task[]>(["tasks", member.memberId]) ?? [];
          const completed = tasks.filter((t) => t.status === "COMPLETED").length;
          return { ...m, tasks: { ...m.tasks, completed } };
        });
      });
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? "Failed"),
  });

  function handleSort(col: SortCol) {
    if (sortCol === col) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  }

  const filtered = useMemo(() => {
    let list = [...tasks];
    if (filterStatus) list = list.filter((t) => t.status === filterStatus);
    if (filterPriority) list = list.filter((t) => t.priority === filterPriority);
    if (sortCol) {
      list.sort((a, b) => {
        const av = a[sortCol as keyof Task] ?? "";
        const bv = b[sortCol as keyof Task] ?? "";
        const cmp = String(av).localeCompare(String(bv));
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return list;
  }, [tasks, filterStatus, filterPriority, sortCol, sortDir]);

  const stats = useMemo(() => ({
    total: tasks.length,
    open: tasks.filter((t) => t.status === "OPEN").length,
    inProgress: tasks.filter((t) => t.status === "IN_PROGRESS").length,
    completed: tasks.filter((t) => t.status === "COMPLETED").length,
    overdue: tasks.filter(isOverdue).length,
  }), [tasks]);

  return (
    <>
    <div className="bg-white">
      {/* Action bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-blue-600/5 border-b border-blue-100">
        <p className="text-xs text-blue-700 font-medium">
          {isLoading ? "Loading…" : `${tasks.length} task${tasks.length !== 1 ? "s" : ""} assigned`}
        </p>
        {canAssign && (
          <button
            onClick={() => setShowNew(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" /> New Task
          </button>
        )}
      </div>

        {/* Stats cards + progress bar */}
        <div className="px-6 pt-4 pb-3 bg-gradient-to-b from-slate-50 to-white border-b border-gray-100">
          <div className="grid grid-cols-5 gap-3 mb-3">
            {[
              { label: "Total",       value: stats.total,      Icon: ListTodo,      color: "text-slate-700",  bg: "bg-white",       ring: "ring-slate-200" },
              { label: "Open",        value: stats.open,       Icon: CircleDot,     color: "text-blue-600",   bg: "bg-blue-50",     ring: "ring-blue-100"  },
              { label: "In Progress", value: stats.inProgress, Icon: Clock,         color: "text-amber-600",  bg: "bg-amber-50",    ring: "ring-amber-100" },
              { label: "Completed",   value: stats.completed,  Icon: CheckCircle,   color: "text-emerald-600",bg: "bg-emerald-50",  ring: "ring-emerald-100"},
              { label: "Overdue",     value: stats.overdue,    Icon: AlertTriangle, color: "text-red-600",    bg: "bg-red-50",      ring: "ring-red-100"   },
            ].map(({ label, value, Icon, color, bg, ring }) => (
              <div key={label} className={`rounded-xl ${bg} ring-1 ${ring} px-4 py-3 flex items-center gap-3`}>
                <div className="h-9 w-9 rounded-lg bg-white shadow-sm flex items-center justify-center shrink-0">
                  <Icon className={`h-4 w-4 ${color}`} />
                </div>
                <div>
                  <p className={`text-2xl font-bold tabular-nums leading-none ${color}`}>{value}</p>
                  <p className="text-[11px] text-gray-400 font-medium mt-0.5">{label}</p>
                </div>
              </div>
            ))}
          </div>
          {stats.total > 0 && (
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-700"
                  style={{ width: `${Math.round((stats.completed / stats.total) * 100)}%` }}
                />
              </div>
              <span className="text-xs text-gray-400 font-medium tabular-nums shrink-0">
                {Math.round((stats.completed / stats.total) * 100)}% complete
              </span>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 px-6 py-2.5 border-b border-gray-100 bg-white">
          <Filter className="h-3.5 w-3.5 text-gray-400 shrink-0" />
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All statuses</option>
            {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All priorities</option>
            {Object.entries(PRIORITY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          {(filterStatus || filterPriority) && (
            <button onClick={() => { setFilterStatus(""); setFilterPriority(""); }} className="text-xs text-blue-600 hover:underline">
              Clear
            </button>
          )}
          <span className="ml-auto text-xs text-gray-400">{filtered.length} task{filtered.length !== 1 ? "s" : ""}</span>
        </div>

        {/* Task list */}
        <div className="max-h-[520px] overflow-auto bg-gray-50/40">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <div className="h-5 w-5 rounded-full border-2 border-blue-400 border-t-transparent animate-spin mr-2" />
              Loading tasks…
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center">
              <ListTodo className="h-10 w-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400 font-medium">
                {tasks.length === 0 ? "No tasks assigned yet" : "No tasks match the current filters"}
              </p>
              {canAssign && tasks.length === 0 && (
                <p className="text-xs text-gray-400 mt-1">Click <strong>New Task</strong> to assign one.</p>
              )}
            </div>
          ) : (
            <>
              {/* Column header */}
              <div className="sticky top-0 z-10 flex items-center gap-4 px-5 py-2.5 bg-white border-b border-gray-200 shadow-sm">
                <span className="w-7 text-[11px] font-bold text-gray-400 uppercase">#</span>
                <SortTh col="title"    label="Topic"    sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="flex-1" />
                <SortTh col="priority" label="Priority" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="w-24" />
                <SortTh col="status"   label="Status"   sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="w-36" />
                <SortTh col="dueDate"  label="Due"      sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="w-28" />
                <span className="w-8" />
              </div>

              {/* Cards */}
              <div className="flex flex-col gap-2 p-4">
                {filtered.map((task, idx) => {
                  const pm = PRIORITY_META[task.priority];
                  const sm = STATUS_META[task.status];
                  const StatusIcon = sm.icon;
                  const overdue = isOverdue(task);
                  const isExpanded = selectedTaskId === task.id;

                  return (
                    <div
                      key={task.id}
                      className={`rounded-xl overflow-hidden transition-all duration-200
                        ${isExpanded
                          ? "ring-2 ring-blue-400 shadow-lg"
                          : "ring-1 ring-gray-200 shadow-sm hover:shadow-md hover:ring-gray-300"}`}
                    >
                      {/* Row */}
                      <div
                        onClick={() => setSelectedTaskId(isExpanded ? null : task.id)}
                        className={`flex items-center gap-4 px-4 py-3.5 cursor-pointer group border-l-4 ${pm.border}
                          ${isExpanded ? "bg-blue-50/50" : "bg-white hover:bg-slate-50/80"} transition-colors`}
                      >
                        <span className="w-7 text-xs text-gray-400 tabular-nums shrink-0">{idx + 1}</span>

                        {/* Title */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={`font-semibold text-sm leading-tight truncate
                              ${overdue ? "text-red-700" : isExpanded ? "text-blue-700" : "text-gray-900"}`}>
                              {task.title}
                            </p>
                            {overdue && <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                          </div>
                          {!isExpanded && task.description && (
                            <p className="text-xs text-gray-400 mt-0.5 truncate">{task.description}</p>
                          )}
                          {!isExpanded && (
                            <p className="text-[11px] text-gray-300 mt-0.5">Assigned {fmtDate(task.assignedDate)}</p>
                          )}
                        </div>

                        {/* Priority */}
                        <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full w-20 text-center ${pm.bg} ${pm.color}`}>
                          {pm.label}
                        </span>

                        {/* Status */}
                        <div className="shrink-0 w-36">
                          {canAssign ? (
                            <select
                              value={task.status}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => { e.stopPropagation(); statusMut.mutate({ id: task.id, status: e.target.value }); }}
                              className={`w-full rounded-full px-2.5 py-1 text-xs font-semibold border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400 ${sm.bg} ${sm.color}`}
                            >
                              {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                            </select>
                          ) : (
                            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${sm.bg} ${sm.color}`}>
                              <StatusIcon className="h-3 w-3" />{sm.label}
                            </span>
                          )}
                        </div>

                        {/* Due date */}
                        <div className="shrink-0 w-28 text-right">
                          <p className={`text-xs font-semibold ${overdue ? "text-red-600" : "text-gray-600"}`}>
                            {fmtDate(task.dueDate)}
                          </p>
                          {overdue && <p className="text-[10px] text-red-400">overdue</p>}
                        </div>

                        {/* Delete */}
                        <div className="shrink-0 w-8 flex justify-center">
                          {(task.assignedBy.id === user?.id || user?.role === "SUPER_ADMIN" || user?.role === "HR_ADMIN") && (
                            <button
                              onClick={(e) => { e.stopPropagation(); if (confirm(`Delete "${task.title}"?`)) deleteMut.mutate(task.id); }}
                              disabled={deleteMut.isPending}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-500 rounded p-1"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Inline expansion — inside the card */}
                      {isExpanded && (
                        <div className="animate-slide-down-reveal">
                          <TaskDetailInline task={task} onClose={() => setSelectedTaskId(null)} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {showNew && (
        <NewTaskModal
          assigneeId={member.memberId}
          assigneeName={`${member.member.firstName} ${member.member.lastName}`}
          onClose={() => setShowNew(false)}
          onCreated={(newTask) => {
            queryClient.setQueryData<Task[]>(["tasks", member.memberId], (old) =>
              old ? [newTask, ...old] : [newTask]
            );
            queryClient.setQueryData<TeamMember[]>(["my-team", user?.id], (old) =>
              old
                ? old.map((m) =>
                    m.memberId === member.memberId
                      ? { ...m, tasks: { ...m.tasks, total: m.tasks.total + 1 } }
                      : m
                  )
                : old
            );
          }}
        />
      )}
    </>
  );
}

// ── Leave Panel ───────────────────────────────────────────────────────────────

function LeavePanel({ memberId }: { memberId: string }) {
  const { data: leaves = [], isLoading } = useQuery<MemberLeave[]>({
    queryKey: ["member-leaves", memberId],
    queryFn: () => api.get(`/api/v1/leaves/employee/${memberId}`).then((r) => r.data.data),
    staleTime: 2 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <div className="h-5 w-5 rounded-full border-2 border-blue-400 border-t-transparent animate-spin mr-2" />
        Loading leave records…
      </div>
    );
  }

  if (leaves.length === 0) {
    return (
      <div className="py-20 text-center">
        <CalendarDays className="h-10 w-10 text-gray-200 mx-auto mb-3" />
        <p className="text-sm text-gray-400 font-medium">No leave applications found</p>
      </div>
    );
  }

  return (
    <div className="overflow-auto max-h-[520px]">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-white z-10 shadow-sm">
          <tr className="border-b border-gray-200">
            <th className="px-5 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wide">Type</th>
            <th className="px-5 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wide">Dates</th>
            <th className="px-5 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wide">Days</th>
            <th className="px-5 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wide">Reason</th>
            <th className="px-5 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wide">Status</th>
            <th className="px-5 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wide">Applied</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {leaves.map((l) => {
            const from = new Date(l.fromDate);
            const to = new Date(l.toDate);
            const sameDay = l.fromDate.slice(0, 10) === l.toDate.slice(0, 10);
            const fmt = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
            const dateStr = sameDay ? fmt(from) : `${fmt(from)} – ${fmt(to)}`;
            return (
              <tr key={l.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-5 py-3.5 font-medium text-gray-800">
                  {LEAVE_LABEL[l.leaveType] ?? l.leaveType}
                </td>
                <td className="px-5 py-3.5 text-gray-600 whitespace-nowrap">{dateStr}</td>
                <td className="px-5 py-3.5 text-gray-600 tabular-nums">{l.totalDays}</td>
                <td className="px-5 py-3.5 text-gray-500 max-w-[200px]">
                  <p className="truncate">{l.reason}</p>
                  {l.rejectionNote && (
                    <p className="text-xs text-red-400 mt-0.5">{l.rejectionNote}</p>
                  )}
                </td>
                <td className="px-5 py-3.5">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${LEAVE_STATUS_STYLES[l.status] ?? "bg-gray-100 text-gray-500"}`}>
                    {l.status.charAt(0) + l.status.slice(1).toLowerCase()}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-gray-400 text-xs whitespace-nowrap">
                  {new Date(l.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Member Expanded Panel (tabs: Tasks | Leave Records) ───────────────────────

function MemberExpandedPanel({ member, canAssign }: { member: TeamMember; canAssign: boolean }) {
  const [tab, setTab] = useState<"tasks" | "leaves">("tasks");

  return (
    <>
      <div className="flex items-center gap-1 border-b border-gray-200 bg-gray-50/50 px-4">
        {(["tasks", "leaves"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            {t === "tasks" ? "Tasks" : "Leave Records"}
          </button>
        ))}
      </div>
      {tab === "tasks"
        ? <TaskPanel member={member} canAssign={canAssign} onClose={() => {}} />
        : <LeavePanel memberId={member.memberId} />
      }
    </>
  );
}

// ── Member Card (Figma-style rich card) ──────────────────────────────────────

function MemberCard({
  tm, canManage, canAssign, onAssignTask, onRemove,
}: {
  tm: TeamMember;
  canManage: boolean;
  canAssign: boolean;
  onAssignTask: () => void;
  onRemove: () => void;
}) {
  const [expandedTab, setExpandedTab] = useState<null | "tasks" | "leaves">(null);
  const initials = `${tm.member.firstName[0]}${tm.member.lastName[0]}`;
  const pct = tm.tasks.total > 0 ? Math.round((tm.tasks.completed / tm.tasks.total) * 100) : 0;
  const isOnLeave = tm.presence === "ON_LEAVE";

  return (
    <div className="bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow overflow-hidden">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start gap-4 mb-4">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-white font-semibold text-lg flex-shrink-0 overflow-hidden"
            style={{ backgroundColor: "#2C3E7C" }}
          >
            {tm.member.photoUrl
              ? <img src={`${API_URL}${tm.member.photoUrl}`} alt="" className="h-full w-full object-cover" />
              : initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-1">
              <div className="flex-1 min-w-0 pr-2">
                <h3 className="text-lg font-semibold text-gray-900 truncate">
                  {tm.member.firstName} {tm.member.lastName}
                </h3>
                <p className="text-sm text-gray-600 truncate">{tm.member.designation?.title ?? "—"}</p>
              </div>
              {/* Bin + Leave Records tab stacked */}
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                {canManage && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Remove ${tm.member.firstName} ${tm.member.lastName} from your team?`))
                        onRemove();
                    }}
                    className="p-2 hover:bg-red-50 rounded-md text-gray-300 hover:text-red-500"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
                <button
                  onClick={() => setExpandedTab(expandedTab === "leaves" ? null : "leaves")}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    expandedTab === "leaves"
                      ? "bg-orange-50 text-orange-600 border border-orange-200"
                      : "text-gray-700 hover:bg-gray-50 border border-gray-200"
                  }`}
                >
                  <CalendarDays size={14} />
                  Leave
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span
                className="px-2 py-1 rounded-md text-xs font-medium"
                style={
                  isOnLeave
                    ? { backgroundColor: "#F2994A15", color: "#F2994A", border: "1px solid #F2994A30" }
                    : { backgroundColor: "#10b98115", color: "#059669", border: "1px solid #10b98130" }
                }
              >
                {isOnLeave ? "On Leave" : "Active"}
              </span>
              <span className="text-xs text-gray-500">{tm.member.employeeCode}</span>
              {tm.member.department?.name && (
                <>
                  <span className="text-xs text-gray-400">•</span>
                  <span className="text-xs text-gray-500">{tm.member.department.name}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Active leave banner */}
        {tm.activeLeave && (
          <div className="flex items-center gap-2 mb-4 p-2.5 bg-orange-50 border border-orange-100 rounded-md text-xs text-orange-700">
            <CalendarOff size={14} className="shrink-0" />
            <span>
              {LEAVE_LABEL[tm.activeLeave.leaveType] ?? tm.activeLeave.leaveType} ·{" "}
              {fmtDate(tm.activeLeave.fromDate)} – {fmtDate(tm.activeLeave.toDate)}
            </span>
          </div>
        )}

        {/* Metrics grid */}
        <div className="grid grid-cols-3 gap-3 py-4 border-t border-b border-gray-200 mb-4">
          <div>
            <div className="flex items-center gap-1 mb-1">
              <Activity size={14} className="text-gray-500" />
              <span className="text-xs text-gray-600">Progress</span>
            </div>
            <p className="text-lg font-semibold text-gray-900">{pct}%</p>
            <div className="w-full bg-gray-200 rounded-full h-1 mt-1">
              <div
                className="h-1 rounded-full"
                style={{
                  width: `${pct}%`,
                  backgroundColor: pct >= 80 ? "#10b981" : pct >= 40 ? "#F2994A" : "#E07A5F",
                }}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center gap-1 mb-1">
              <CheckCircle2 size={14} className="text-gray-500" />
              <span className="text-xs text-gray-600">Tasks</span>
            </div>
            <p className="text-lg font-semibold text-gray-900">
              {tm.tasks.total - tm.tasks.completed}
            </p>
            <p className="text-xs text-gray-500">{tm.tasks.completed} done</p>
          </div>

          <div>
            <div className="flex items-center gap-1 mb-1">
              <AlertTriangle size={14} className="text-gray-500" />
              <span className="text-xs text-gray-600">Overdue</span>
            </div>
            <p className={`text-lg font-semibold ${tm.tasks.due > 0 ? "text-red-600" : "text-gray-900"}`}>
              {tm.tasks.due}
            </p>
            {tm.tasks.due > 0 && <p className="text-xs text-red-500">overdue</p>}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={() => setExpandedTab(expandedTab === "tasks" ? null : "tasks")}
            className="flex-1 px-4 py-2 border rounded-md text-sm font-medium hover:bg-blue-50 transition-colors"
            style={{ borderColor: "#2C3E7C", color: "#2C3E7C" }}
          >
            {expandedTab === "tasks" ? "Hide Tasks" : "View Tasks"}
          </button>
          {canAssign && (
            <button
              onClick={(e) => { e.stopPropagation(); onAssignTask(); }}
              className="px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Assign Task
            </button>
          )}
        </div>
      </div>

      {/* Expanded panels */}
      {expandedTab === "tasks" && (
        <div className="border-t border-blue-100 animate-slide-down-reveal">
          <TaskPanel member={tm} canAssign={canAssign} onClose={() => setExpandedTab(null)} />
        </div>
      )}
      {expandedTab === "leaves" && (
        <div className="border-t border-orange-100 animate-slide-down-reveal">
          <LeavePanel memberId={tm.memberId} />
        </div>
      )}
    </div>
  );
}

// ── Assign-Task Picker ────────────────────────────────────────────────────────

function AssignTaskPicker({
  team, onSelect, onClose,
}: {
  team: TeamMember[];
  onSelect: (tm: TeamMember) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">Select Team Member</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-3 max-h-80 overflow-y-auto">
          {team.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No team members to assign to.</p>
          ) : (
            team.map((tm) => (
              <button
                key={tm.id}
                onClick={() => { onSelect(tm); onClose(); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-50 text-left transition-colors"
              >
                <Avatar member={tm.member} size="sm" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">
                    {tm.member.firstName} {tm.member.lastName}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {tm.member.designation?.title ?? tm.member.employeeCode}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── My Team Page ──────────────────────────────────────────────────────────────

export default function MyTeamPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [assignTaskTarget, setAssignTaskTarget] = useState<TeamMember | null>(null);
  const [showAssignPicker, setShowAssignPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "on-leave">("all");

  const canManage =
    user?.role === "SUPER_ADMIN" ||
    user?.role === "HR_ADMIN" ||
    user?.role === "DEPT_HEAD";
  const canAssignTasks = true;

  const { data: team = [], isLoading } = useQuery<TeamMember[]>({
    queryKey: ["my-team", user?.id],
    queryFn: () =>
      user?.id
        ? api.get(`/api/v1/employees/${user.id}/team`).then((r) => r.data.data)
        : Promise.resolve([]),
    enabled: !!user?.id,
  });

  const removeMutation = useMutation({
    mutationFn: (memberId: string) =>
      api.delete(`/api/v1/employees/${user!.id}/team/${memberId}`),
    onSuccess: () => {
      toast.success("Member removed");
      queryClient.invalidateQueries({ queryKey: ["my-team", user?.id] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? "Failed"),
  });

  const present = team.filter((m) => m.presence === "PRESENT").length;
  const onLeave = team.filter((m) => m.presence === "ON_LEAVE").length;
  const totalActiveTasks = team.reduce((acc, m) => acc + (m.tasks.total - m.tasks.completed), 0);
  const totalOverdue = team.reduce((acc, m) => acc + m.tasks.due, 0);
  const avgCompletionPct = team.length > 0
    ? Math.round(
        team.reduce((acc, m) => {
          const pct = m.tasks.total > 0 ? (m.tasks.completed / m.tasks.total) * 100 : 0;
          return acc + pct;
        }, 0) / team.length
      )
    : 0;
  const presenceRate = team.length > 0 ? Math.round((present / team.length) * 100) : 0;

  const filtered = useMemo(() => {
    return team.filter((tm) => {
      const q = searchQuery.toLowerCase();
      const name = `${tm.member.firstName} ${tm.member.lastName}`.toLowerCase();
      const role = tm.member.designation?.title?.toLowerCase() ?? "";
      const dept = tm.member.department?.name?.toLowerCase() ?? "";
      const matchesSearch = !q || name.includes(q) || role.includes(q) || dept.includes(q);
      const matchesFilter =
        filterStatus === "all" ||
        (filterStatus === "active" && tm.presence === "PRESENT") ||
        (filterStatus === "on-leave" && tm.presence === "ON_LEAVE");
      return matchesSearch && matchesFilter;
    });
  }, [team, searchQuery, filterStatus]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div
              className="w-8 h-8 rounded-md flex items-center justify-center"
              style={{ backgroundColor: "#2C3E7C" }}
            >
              <UsersRound className="text-white" size={18} />
            </div>
            <div>
              <p className="text-sm text-gray-500 uppercase tracking-wide">Team Management</p>
              <h1 className="text-2xl font-semibold text-gray-900">My Team</h1>
            </div>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Manage your team members, assign tasks, and track performance
          </p>
        </div>
        <div className="flex gap-2 md:gap-3 flex-wrap md:flex-nowrap w-full md:w-auto">
          {canAssignTasks && team.length > 0 && (
            <button
              onClick={() => setShowAssignPicker(true)}
              className="flex-1 md:flex-initial px-3 md:px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2"
            >
              <ClipboardList size={18} />
              <span className="hidden sm:inline">Assign Task</span>
              <span className="sm:hidden">Task</span>
            </button>
          )}
          {canManage && (
            <button
              onClick={() => setShowAdd((v) => !v)}
              className="flex-1 md:flex-initial px-3 md:px-4 py-2 rounded-md text-sm font-medium text-white flex items-center justify-center gap-2"
              style={{ backgroundColor: "#2C3E7C" }}
            >
              {showAdd ? <X size={18} /> : <UserPlus size={18} />}
              <span className="hidden sm:inline">{showAdd ? "Cancel" : "Add Team Member"}</span>
              <span className="sm:hidden">{showAdd ? "Cancel" : "Add Member"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Add Member Panel */}
      {showAdd && user?.id && (
        <AddMemberPanel ownerId={user.id} onClose={() => setShowAdd(false)} />
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content — left 2/3 */}
        <div className="lg:col-span-2 space-y-4">
          {/* Search and filter */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
              <div className="flex-1 relative min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder="Search by name, role, or department…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-offset-0"
                />
              </div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
                className="px-3 py-2 border border-gray-200 rounded-md text-sm text-gray-700 focus:outline-none bg-white"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="on-leave">On Leave</option>
              </select>
            </div>
          </div>

          {/* Team member cards */}
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse">
                  <div className="flex items-start gap-4">
                    <div className="w-16 h-16 rounded-full bg-gray-200 shrink-0" />
                    <div className="flex-1 space-y-2 pt-2">
                      <div className="h-4 bg-gray-200 rounded w-40" />
                      <div className="h-3 bg-gray-100 rounded w-56" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-gray-200 py-20 text-center bg-white">
              <UsersRound className="mx-auto h-12 w-12 text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">
                {team.length === 0 ? "No team members yet" : "No members match your search"}
              </p>
              {team.length === 0 && canManage && (
                <p className="text-sm text-gray-400 mt-1">
                  Click <strong>Add Team Member</strong> above to build your team.
                </p>
              )}
              {team.length === 0 && !canManage && (
                <p className="text-sm text-gray-400 mt-1">
                  Ask your HR or admin to add team members to your profile.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filtered.map((tm) => (
                <MemberCard
                  key={tm.id}
                  tm={tm}
                  canManage={canManage}
                  canAssign={canAssignTasks}
                  onAssignTask={() => setAssignTaskTarget(tm)}
                  onRemove={() => removeMutation.mutate(tm.memberId)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right sidebar — 1/3 */}
        <div className="space-y-4">
          {/* Team Overview */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wide">
              Team Overview
            </h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Members</p>
                <p className="text-3xl font-semibold text-gray-900">{team.length}</p>
              </div>
              <div className="pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600 mb-1">Active Members</p>
                <p className="text-3xl font-semibold" style={{ color: "#2C3E7C" }}>{present}</p>
              </div>
              <div className="pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600 mb-1">On Leave</p>
                <p className="text-3xl font-semibold text-orange-500">{onLeave}</p>
              </div>
              <div className="pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600 mb-1">Active Tasks</p>
                <p className="text-3xl font-semibold text-gray-900">{totalActiveTasks}</p>
              </div>
            </div>
          </div>

          {/* Team Analytics */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wide">
              Team Analytics
            </h3>
            <div className="space-y-5">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: "#2C3E7C20" }}
                  >
                    <Activity style={{ color: "#2C3E7C" }} size={16} />
                  </div>
                  <p className="text-xs text-gray-600 font-medium">Avg. Task Completion</p>
                </div>
                <div className="flex items-baseline gap-2 mb-2">
                  <p className="text-2xl font-semibold text-gray-900">{avgCompletionPct}%</p>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div
                    className="h-1.5 rounded-full"
                    style={{
                      width: `${avgCompletionPct}%`,
                      backgroundColor:
                        avgCompletionPct >= 80 ? "#10b981" : avgCompletionPct >= 50 ? "#F2994A" : "#E07A5F",
                    }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {avgCompletionPct >= 80
                    ? "Excellent progress"
                    : avgCompletionPct >= 50
                    ? "On track"
                    : "Needs attention"}
                </p>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                    <UsersRound className="text-blue-600" size={16} />
                  </div>
                  <p className="text-xs text-gray-600 font-medium">Presence Rate</p>
                </div>
                <div className="flex items-baseline gap-2 mb-2">
                  <p className="text-2xl font-semibold text-gray-900">{presenceRate}%</p>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div
                    className="bg-blue-600 h-1.5 rounded-full"
                    style={{ width: `${presenceRate}%` }}
                  />
                </div>
              </div>

              {team.length > 0 && (
                <div className="pt-4 border-t border-gray-200">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                      <AlertTriangle className="text-red-500" size={16} />
                    </div>
                    <p className="text-xs text-gray-600 font-medium">Overdue Tasks</p>
                  </div>
                  <p className="text-2xl font-semibold text-gray-900">{totalOverdue}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Assign Task Picker Modal */}
      {showAssignPicker && (
        <AssignTaskPicker
          team={team}
          onSelect={(tm) => setAssignTaskTarget(tm)}
          onClose={() => setShowAssignPicker(false)}
        />
      )}

      {/* New Task Modal (from per-card or header picker) */}
      {assignTaskTarget && (
        <NewTaskModal
          assigneeId={assignTaskTarget.memberId}
          assigneeName={`${assignTaskTarget.member.firstName} ${assignTaskTarget.member.lastName}`}
          onClose={() => setAssignTaskTarget(null)}
          onCreated={(newTask) => {
            queryClient.setQueryData<Task[]>(["tasks", assignTaskTarget.memberId], (old) =>
              old ? [newTask, ...old] : [newTask]
            );
            queryClient.setQueryData<TeamMember[]>(["my-team", user?.id], (old) =>
              old
                ? old.map((m) =>
                    m.memberId === assignTaskTarget.memberId
                      ? { ...m, tasks: { ...m.tasks, total: m.tasks.total + 1 } }
                      : m
                  )
                : old
            );
          }}
        />
      )}
    </div>
  );
}
