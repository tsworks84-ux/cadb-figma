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
                  className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
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
                type="date"
                value={form.assignedDate}
                onChange={(e) => setForm({ ...form, assignedDate: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Due Date <span className="text-red-500">*</span></label>
              <input
                type="date"
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

// ── My Team Page ──────────────────────────────────────────────────────────────

export default function MyTeamPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);

  // Only admins/dept-head can add or remove team members
  const canManage =
    user?.role === "SUPER_ADMIN" ||
    user?.role === "HR_ADMIN" ||
    user?.role === "DEPT_HEAD";

  // Anyone who owns a team can assign tasks to their members
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Team</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {team.length} member{team.length !== 1 ? "s" : ""}
            {team.length > 0 && ` · ${present} present · ${onLeave} on leave`}
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowAdd((v) => !v)}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium shadow-sm transition-colors ${
              showAdd
                ? "bg-gray-100 text-gray-700 hover:bg-gray-200"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            {showAdd ? <X className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
            {showAdd ? "Cancel" : "Add Member"}
          </button>
        )}
      </div>

      {/* Add panel */}
      {showAdd && user?.id && (
        <AddMemberPanel ownerId={user.id} onClose={() => setShowAdd(false)} />
      )}

      {/* Summary stats */}
      {team.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total Members", value: team.length,  color: "text-blue-600",   bg: "bg-blue-50"   },
            { label: "Present Today", value: present,       color: "text-green-600",  bg: "bg-green-50"  },
            { label: "On Leave",      value: onLeave,       color: "text-orange-600", bg: "bg-orange-50" },
          ].map((s) => (
            <div key={s.label} className={`rounded-xl ${s.bg} p-4 text-center`}>
              <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Team list */}
      {isLoading ? (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={`flex items-center gap-4 px-5 py-4 animate-pulse ${i > 0 ? "border-t border-gray-100" : ""}`}>
              <div className="h-9 w-9 rounded-full bg-gray-200 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-gray-200 rounded w-40" />
                <div className="h-2.5 bg-gray-100 rounded w-56" />
              </div>
              <div className="h-5 w-16 bg-gray-100 rounded-full" />
              <div className="h-3 w-24 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      ) : team.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 py-20 text-center">
          <UsersRound className="mx-auto h-12 w-12 text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No team members yet</p>
          {canManage ? (
            <p className="text-sm text-gray-400 mt-1">Click <strong>Add Member</strong> above to build your team.</p>
          ) : (
            <p className="text-sm text-gray-400 mt-1">Ask your HR or admin to add team members to your profile.</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {/* Column header */}
          <div className="grid grid-cols-[2fr_1.5fr_120px_200px_36px] items-center gap-4 px-5 py-2.5 bg-gray-50 rounded-xl border border-gray-200 text-[11px] font-bold text-gray-400 uppercase tracking-wide">
            <span>Member</span>
            <span>Department · Role</span>
            <span>Status</span>
            <span>Task Progress</span>
            <span />
          </div>

          {/* Accordion member cards */}
          {team.map((tm) => {
            const isExpanded = selectedMember?.id === tm.id;
            const pct = tm.tasks.total > 0 ? Math.round((tm.tasks.completed / tm.tasks.total) * 100) : 0;
            return (
              <div
                key={tm.id}
                className={`rounded-xl overflow-hidden transition-all duration-200 ${
                  isExpanded
                    ? "ring-2 ring-blue-400 shadow-lg"
                    : "ring-1 ring-gray-200 shadow-sm hover:shadow-md hover:ring-gray-300"
                }`}
              >
                {/* Member row */}
                <div
                  onClick={() => setSelectedMember(isExpanded ? null : tm)}
                  className={`grid grid-cols-[2fr_1.5fr_120px_200px_36px] items-center gap-4 px-5 py-3.5 cursor-pointer group transition-colors
                    ${isExpanded ? "bg-blue-50/50" : "bg-white hover:bg-blue-50/20"}`}
                >
                  {/* Name + avatar */}
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar member={tm.member} size="sm" />
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold truncate transition-colors ${isExpanded ? "text-blue-700" : "text-gray-900 group-hover:text-blue-600"}`}>
                        {tm.member.firstName} {tm.member.lastName}
                      </p>
                      <p className="text-xs text-gray-400 truncate">{tm.member.employeeCode}</p>
                    </div>
                  </div>

                  {/* Dept + designation */}
                  <div className="min-w-0">
                    <p className="text-sm text-gray-600 truncate">{tm.member.department?.name}</p>
                    <p className="text-xs text-gray-400 truncate">{tm.member.designation?.title}</p>
                  </div>

                  {/* Presence */}
                  <div>
                    {tm.presence === "ON_LEAVE" ? (
                      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium bg-orange-100 text-orange-700 whitespace-nowrap">
                        <CalendarOff className="h-3 w-3" /> On Leave
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium bg-green-100 text-green-700">
                        <CheckCircle2 className="h-3 w-3" /> Present
                      </span>
                    )}
                  </div>

                  {/* Task progress */}
                  <div className="min-w-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-gray-500 tabular-nums font-medium">
                        {tm.tasks.completed}/{tm.tasks.total} done
                      </span>
                      {tm.tasks.due > 0 && (
                        <span className="text-[11px] text-red-500 font-semibold flex items-center gap-0.5">
                          <AlertTriangle className="h-3 w-3" />{tm.tasks.due} overdue
                        </span>
                      )}
                    </div>
                    <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          tm.tasks.due > 0 ? "bg-gradient-to-r from-orange-400 to-red-400" : "bg-gradient-to-r from-blue-400 to-emerald-400"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {/* Remove */}
                  <div className="flex justify-end">
                    {canManage && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Remove ${tm.member.firstName} ${tm.member.lastName} from your team?`))
                            removeMutation.mutate(tm.memberId);
                        }}
                        disabled={removeMutation.isPending}
                        className="opacity-0 group-hover:opacity-100 transition-opacity rounded p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Inline expansion — tabs: Tasks | Leave Records */}
                {isExpanded && (
                  <div className="animate-slide-down-reveal border-t border-blue-100">
                    <MemberExpandedPanel member={tm} canAssign={canAssignTasks} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
