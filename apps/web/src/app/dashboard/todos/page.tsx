"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";
import {
  Plus, Search, Calendar, ChevronLeft, ChevronRight,
  Clock, AlertTriangle, Link2, Link2Off, X, MoreHorizontal,
  CheckCircle2, Circle, Pencil, Trash2, List, CalendarDays, Tag,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type TodoPriority = "LOW" | "MEDIUM" | "HIGH";
type ReminderType =
  | "NONE" | "ON_DUE_DATE" | "THIRTY_MIN_BEFORE" | "ONE_HOUR_BEFORE"
  | "THREE_HOURS_BEFORE" | "ONE_DAY_BEFORE" | "TWO_DAYS_BEFORE"
  | "ONE_WEEK_BEFORE" | "CUSTOM";

interface Todo {
  id: string;
  title: string;
  description?: string | null;
  dueDate?: string | null;
  priority: TodoPriority;
  completed: boolean;
  completedAt?: string | null;
  reminderType: ReminderType;
  reminderAt?: string | null;
  category: string;
  googleEventId?: string | null;
  createdAt: string;
}

const CATEGORIES = [
  "General", "HR", "Operations", "Student Support",
  "Finance", "IT", "Administration",
] as const;

const PRIORITY_META: Record<TodoPriority, { label: string; badge: string; dot: string; active: string }> = {
  HIGH:   { label: "High",   badge: "bg-red-100 text-red-700",      dot: "bg-red-500",    active: "bg-red-500 text-white border-red-500" },
  MEDIUM: { label: "Medium", badge: "bg-orange-100 text-orange-700", dot: "bg-orange-400", active: "bg-orange-400 text-white border-orange-400" },
  LOW:    { label: "Low",    badge: "bg-green-100 text-green-700",   dot: "bg-green-500",  active: "bg-green-500 text-white border-green-500" },
};

const REMINDER_OPTIONS: { value: ReminderType; label: string }[] = [
  { value: "NONE",               label: "No reminder" },
  { value: "ON_DUE_DATE",        label: "At due time" },
  { value: "THIRTY_MIN_BEFORE",  label: "30 minutes before" },
  { value: "ONE_HOUR_BEFORE",    label: "1 hour before" },
  { value: "THREE_HOURS_BEFORE", label: "3 hours before" },
  { value: "ONE_DAY_BEFORE",     label: "1 day before" },
  { value: "TWO_DAYS_BEFORE",    label: "2 days before" },
  { value: "ONE_WEEK_BEFORE",    label: "1 week before" },
  { value: "CUSTOM",             label: "Custom time" },
];

// ── helpers ──────────────────────────────────────────────────────────────────

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function isPastDay(dateKey: string) {
  const d = new Date(dateKey + "T00:00:00");
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return d < today;
}

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDateLabel(dateKey: string) {
  const d = new Date(dateKey + "T00:00:00");
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  if (isSameDay(d, today)) return "Today";
  if (isSameDay(d, tomorrow)) return "Tomorrow";
  return d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
}

// ── form types ────────────────────────────────────────────────────────────────

interface TodoFormData {
  title: string;
  description: string;
  dueDate: string;
  dueTime: string;
  category: string;
  priority: TodoPriority;
  reminderType: ReminderType;
  reminderAt: string;
}

const DEFAULT_FORM: TodoFormData = {
  title: "", description: "", dueDate: "", dueTime: "",
  category: "General", priority: "MEDIUM", reminderType: "NONE", reminderAt: "",
};

// ── Modal ─────────────────────────────────────────────────────────────────────

function TodoModal({
  modalTitle,
  initial,
  onSubmit,
  onClose,
  loading,
}: {
  modalTitle: string;
  initial?: Partial<TodoFormData>;
  onSubmit: (data: TodoFormData) => void;
  onClose: () => void;
  loading: boolean;
}) {
  const [form, setForm] = useState<TodoFormData>({ ...DEFAULT_FORM, ...initial });
  const set = <K extends keyof TodoFormData>(k: K, v: TodoFormData[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">{modalTitle}</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Task title *</label>
            <input
              autoFocus
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="What do you need to do?"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
            <textarea
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Add description (optional)"
              rows={2}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Due date</label>
              <input
                type="date"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.dueDate}
                onChange={(e) => set("dueDate", e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Due time</label>
              <input
                type="time"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.dueTime}
                onChange={(e) => set("dueTime", e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Category</label>
            <select
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
            >
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {form.dueDate && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Reminder</label>
              <select
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                value={form.reminderType}
                onChange={(e) => set("reminderType", e.target.value as ReminderType)}
              >
                {REMINDER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          )}

          {form.reminderType === "CUSTOM" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Custom reminder time</label>
              <input
                type="datetime-local"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.reminderAt}
                onChange={(e) => set("reminderAt", e.target.value)}
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Priority</label>
            <div className="flex gap-2">
              {(["HIGH", "MEDIUM", "LOW"] as TodoPriority[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => set("priority", p)}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${
                    form.priority === p
                      ? PRIORITY_META[p].active
                      : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {PRIORITY_META[p].label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            disabled={!form.title.trim() || loading}
            onClick={() => form.title.trim() && onSubmit(form)}
            className="px-5 py-2 text-sm font-medium bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Saving..." : "Save Task"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Task Row ──────────────────────────────────────────────────────────────────

function TaskRow({
  todo,
  onToggle,
  onEdit,
  onDelete,
}: {
  todo: Todo;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pm = PRIORITY_META[todo.priority];

  return (
    <div className={`flex items-start gap-3 px-4 py-3 hover:bg-gray-50 rounded-xl group transition-colors ${todo.completed ? "opacity-60" : ""}`}>
      <button onClick={onToggle} className="mt-0.5 shrink-0 transition-colors">
        {todo.completed
          ? <CheckCircle2 className="h-5 w-5 text-green-500" />
          : <Circle className="h-5 w-5 text-gray-300 hover:text-blue-500" />
        }
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${todo.completed ? "line-through text-gray-400" : "text-gray-800"}`}>
          {todo.title}
        </p>
        {todo.description && (
          <p className="text-xs text-gray-400 mt-0.5 truncate">{todo.description}</p>
        )}
        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${pm.badge}`}>
            {pm.label}
          </span>
          {todo.dueDate && (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Clock className="h-3 w-3" />
              {formatTime(todo.dueDate)}
            </span>
          )}
          {todo.category && todo.category !== "General" && (
            <span className="flex items-center gap-1 text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
              <Tag className="h-3 w-3" />
              {todo.category}
            </span>
          )}
        </div>
      </div>
      <div className="relative shrink-0">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="p-1.5 text-gray-300 hover:text-gray-600 hover:bg-gray-100 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 top-8 w-36 bg-white rounded-xl shadow-lg border border-gray-100 z-20 overflow-hidden">
              <button
                onClick={() => { setMenuOpen(false); onEdit(); }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <Pencil className="h-3.5 w-3.5" /> Edit
              </button>
              <button
                onClick={() => { setMenuOpen(false); onDelete(); }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Calendar View ─────────────────────────────────────────────────────────────

function CalendarView({ todos }: { todos: Todo[] }) {
  const [current, setCurrent] = useState(new Date());
  const todayDate = new Date();

  const year = current.getFullYear();
  const month = current.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = firstDay.getDay();
  const totalCells = Math.ceil((startPad + lastDay.getDate()) / 7) * 7;

  const byDay = useMemo(() => {
    const map: Record<string, Todo[]> = {};
    for (const t of todos) {
      if (!t.dueDate) continue;
      const key = toDateStr(new Date(t.dueDate));
      (map[key] ??= []).push(t);
    }
    return map;
  }, [todos]);

  const cells = Array.from({ length: totalCells }, (_, i) => {
    const dayNum = i - startPad + 1;
    if (dayNum < 1 || dayNum > lastDay.getDate()) return null;
    const d = new Date(year, month, dayNum);
    return { date: d, key: toDateStr(d) };
  });

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900">
          {current.toLocaleDateString([], { month: "long", year: "numeric" })}
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrent(new Date(year, month - 1, 1))}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="h-4 w-4 text-gray-600" />
          </button>
          <button
            onClick={() => setCurrent(new Date())}
            className="px-3 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded-lg transition-colors font-medium"
          >
            Today
          </button>
          <button
            onClick={() => setCurrent(new Date(year, month + 1, 1))}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight className="h-4 w-4 text-gray-600" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="py-2 text-center text-xs font-semibold text-gray-400 border-b border-gray-50">
            {d}
          </div>
        ))}
        {cells.map((cell, i) => {
          if (!cell) {
            return (
              <div key={`empty-${i}`} className="h-28 border-b border-r border-gray-50 bg-gray-50/40" />
            );
          }
          const { date, key } = cell;
          const dayTodos = byDay[key] ?? [];
          const isToday = isSameDay(date, todayDate);
          const shown = dayTodos.slice(0, 3);
          const extra = dayTodos.length - 3;

          return (
            <div
              key={key}
              className={`h-28 p-1.5 border-b border-r border-gray-50 transition-colors ${
                dayTodos.length > 0 ? "hover:bg-blue-50/20 cursor-pointer" : ""
              }`}
            >
              <span
                className={`inline-flex items-center justify-center w-7 h-7 text-sm font-medium rounded-full ${
                  isToday
                    ? "bg-blue-600 text-white"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {date.getDate()}
              </span>
              <div className="mt-1 space-y-0.5">
                {shown.map((t) => (
                  <div
                    key={t.id}
                    className={`text-xs px-1.5 py-0.5 rounded truncate ${
                      t.completed
                        ? "bg-gray-100 text-gray-400 line-through"
                        : t.priority === "HIGH"
                        ? "bg-red-100 text-red-700"
                        : t.priority === "MEDIUM"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-green-100 text-green-700"
                    }`}
                  >
                    {t.title}
                  </div>
                ))}
                {extra > 0 && (
                  <div className="text-xs text-gray-400 pl-1">+{extra} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Today Focus Sidebar ───────────────────────────────────────────────────────

function TodayFocus({ todos }: { todos: Todo[] }) {
  const today = new Date();
  const todayTodos = todos.filter((t) => t.dueDate && isSameDay(new Date(t.dueDate), today));
  const done = todayTodos.filter((t) => t.completed).length;
  const total = todayTodos.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const upcoming = todos
    .filter((t) => !t.completed && t.dueDate)
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
    .slice(0, 6);

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-4 text-white">
        <p className="text-xs font-semibold uppercase tracking-wider opacity-80">Today&apos;s Focus</p>
        <p className="text-3xl font-bold mt-1">{total}</p>
        <p className="text-sm opacity-80 mt-0.5">{done} of {total} tasks done</p>
        <div className="mt-3 bg-white/20 rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-white rounded-full h-1.5 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <p className="text-sm font-semibold text-gray-800 mb-3">Upcoming</p>
        {upcoming.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-6">No upcoming tasks</p>
        ) : (
          <div className="space-y-3">
            {upcoming.map((t) => {
              const pm = PRIORITY_META[t.priority];
              const overdue = !!t.dueDate && isPastDay(toDateStr(new Date(t.dueDate)));
              return (
                <div key={t.id} className="flex items-start gap-2.5">
                  <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${pm.dot}`} />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-700 truncate">{t.title}</p>
                    {t.dueDate && (
                      <p className={`text-xs mt-0.5 ${overdue ? "text-red-500" : "text-gray-400"}`}>
                        {overdue ? "Overdue · " : ""}
                        {new Date(t.dueDate).toLocaleDateString([], { month: "short", day: "numeric" })}
                        {" at "}{formatTime(t.dueDate)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function TodosPage() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const [view, setView] = useState<"list" | "calendar">("list");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);

  useEffect(() => {
    const cal = searchParams.get("calendar");
    if (cal === "connected") toast.success("Google Calendar connected!");
    if (cal === "error") toast.error("Failed to connect Google Calendar");
  }, [searchParams]);

  const { data, isLoading } = useQuery({
    queryKey: ["todos"],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: Todo[]; calendarConnected: boolean }>("/api/v1/todos");
      return res.data;
    },
    staleTime: 2 * 60 * 1000,
  });

  const todos = data?.data ?? [];
  const calendarConnected = data?.calendarConnected ?? false;
  const today = new Date();

  const stats = useMemo(() => ({
    dueToday: todos.filter((t) => !t.completed && !!t.dueDate && isSameDay(new Date(t.dueDate), today)).length,
    pending:  todos.filter((t) => !t.completed).length,
    completed: todos.filter((t) => t.completed).length,
    overdue:  todos.filter((t) => !t.completed && !!t.dueDate && isPastDay(toDateStr(new Date(t.dueDate)))).length,
  }), [todos]);

  const filtered = useMemo(() => {
    if (!search.trim()) return todos;
    const q = search.toLowerCase();
    return todos.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.category?.toLowerCase().includes(q)
    );
  }, [todos, search]);

  const grouped = useMemo(() => {
    const byDate: Record<string, Todo[]> = {};
    const noDue: Todo[] = [];
    const done: Todo[] = [];

    for (const t of filtered) {
      if (t.completed) { done.push(t); continue; }
      if (!t.dueDate) { noDue.push(t); continue; }
      const key = toDateStr(new Date(t.dueDate));
      (byDate[key] ??= []).push(t);
    }

    const sortedKeys = Object.keys(byDate).sort();
    return { sortedKeys, byDate, noDue, done };
  }, [filtered]);

  // ── Mutations ──

  const createMut = useMutation({
    mutationFn: (body: object) => api.post("/api/v1/todos", body),
    onSuccess: (res) => {
      queryClient.setQueryData<typeof data>(["todos"], (old) =>
        old ? { ...old, data: [res.data.data, ...old.data] } : old
      );
      setShowCreate(false);
      toast.success("Task created");
    },
    onError: () => toast.error("Failed to create task"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...body }: Record<string, unknown> & { id: string }) =>
      api.patch(`/api/v1/todos/${id}`, body),
    onSuccess: (res, vars) => {
      queryClient.setQueryData<typeof data>(["todos"], (old) =>
        old ? { ...old, data: old.data.map((t) => (t.id === vars.id ? res.data.data : t)) } : old
      );
      setEditingTodo(null);
    },
    onError: () => toast.error("Failed to update task"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/todos/${id}`),
    onSuccess: (_, id) => {
      queryClient.setQueryData<typeof data>(["todos"], (old) =>
        old ? { ...old, data: old.data.filter((t) => t.id !== id) } : old
      );
      toast.success("Task deleted");
    },
    onError: () => toast.error("Failed to delete task"),
  });

  function buildDueDate(dueDate: string, dueTime: string) {
    if (!dueDate) return undefined;
    return new Date(`${dueDate}T${dueTime || "00:00"}`).toISOString();
  }

  function handleCreate(form: TodoFormData) {
    createMut.mutate({
      title: form.title,
      ...(form.description && { description: form.description }),
      ...(buildDueDate(form.dueDate, form.dueTime) && { dueDate: buildDueDate(form.dueDate, form.dueTime) }),
      category: form.category,
      priority: form.priority,
      reminderType: form.reminderType,
      ...(form.reminderAt && form.reminderType === "CUSTOM" && {
        reminderAt: new Date(form.reminderAt).toISOString(),
      }),
    });
  }

  function handleUpdate(form: TodoFormData) {
    if (!editingTodo) return;
    updateMut.mutate({
      id: editingTodo.id,
      title: form.title,
      description: form.description || null,
      dueDate: buildDueDate(form.dueDate, form.dueTime) ?? null,
      category: form.category,
      priority: form.priority,
      reminderType: form.reminderType,
      ...(form.reminderAt && form.reminderType === "CUSTOM" && {
        reminderAt: new Date(form.reminderAt).toISOString(),
      }),
    } as Record<string, unknown> & { id: string });
  }

  function getEditInitial(todo: Todo): Partial<TodoFormData> {
    const d = todo.dueDate ? new Date(todo.dueDate) : null;
    return {
      title: todo.title,
      description: todo.description ?? "",
      dueDate: d ? toDateStr(d) : "",
      dueTime: d ? d.toTimeString().slice(0, 5) : "",
      category: todo.category ?? "General",
      priority: todo.priority,
      reminderType: todo.reminderType,
      reminderAt: todo.reminderAt
        ? (() => {
            const r = new Date(todo.reminderAt!);
            const pad = (n: number) => String(n).padStart(2, "0");
            return `${r.getFullYear()}-${pad(r.getMonth() + 1)}-${pad(r.getDate())}T${pad(r.getHours())}:${pad(r.getMinutes())}`;
          })()
        : "",
    };
  }

  function toggle(id: string, completed: boolean) {
    updateMut.mutate({ id, completed } as Record<string, unknown> & { id: string });
  }

  const overdueKeys = grouped.sortedKeys.filter((k) => isPastDay(k));
  const upcomingKeys = grouped.sortedKeys.filter((k) => !isPastDay(k));

  const STAT_CARDS = [
    { label: "Due Today", value: stats.dueToday, bg: "bg-blue-50",   icon: <Calendar className="h-4 w-4 text-blue-600" /> },
    { label: "Pending",   value: stats.pending,  bg: "bg-orange-50", icon: <Clock className="h-4 w-4 text-orange-600" /> },
    { label: "Completed", value: stats.completed, bg: "bg-green-50", icon: <CheckCircle2 className="h-4 w-4 text-green-600" /> },
    { label: "Overdue",   value: stats.overdue,  bg: "bg-red-50",    icon: <AlertTriangle className="h-4 w-4 text-red-500" /> },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Tasks</h1>
            <p className="text-sm text-gray-400 mt-0.5">Manage and track your personal to-dos</p>
          </div>
          <div className="flex items-center gap-2">
            {calendarConnected ? (
              <button
                onClick={() => {
                  api.delete("/api/v1/auth/google/calendar/disconnect").then(() => {
                    queryClient.invalidateQueries({ queryKey: ["todos"] });
                    toast.success("Calendar disconnected");
                  });
                }}
                className="flex items-center gap-1.5 px-3 py-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-xl hover:bg-green-100 transition-colors"
              >
                <Link2 className="h-3.5 w-3.5" /> Google Calendar
              </button>
            ) : (
              <a
                href={`${API_BASE}/api/v1/auth/google/calendar/connect`}
                className="flex items-center gap-1.5 px-3 py-2 text-xs text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
              >
                <Link2Off className="h-3.5 w-3.5" /> Connect Calendar
              </a>
            )}
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4" /> New Task
            </button>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {STAT_CARDS.map(({ label, value, bg, icon }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">{label}</span>
                <span className={`p-2 rounded-xl ${bg}`}>{icon}</span>
              </div>
              <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
            </div>
          ))}
        </div>

        {/* Search + View toggle */}
        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <button
              onClick={() => setView("list")}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm transition-colors ${
                view === "list" ? "bg-blue-600 text-white" : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              <List className="h-4 w-4" /> List View
            </button>
            <button
              onClick={() => setView("calendar")}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm transition-colors ${
                view === "calendar" ? "bg-blue-600 text-white" : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              <CalendarDays className="h-4 w-4" /> Calendar View
            </button>
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-24">
            <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full" />
          </div>
        )}

        {/* Content */}
        {!isLoading && (
          <div className={view === "list" ? "flex gap-6 items-start" : ""}>
            <div className="flex-1 min-w-0">

              {/* List View */}
              {view === "list" && (
                <div className="space-y-4">

                  {/* Overdue group */}
                  {overdueKeys.length > 0 && (
                    <div className="bg-white rounded-2xl border border-red-100 shadow-sm overflow-hidden">
                      <div className="flex items-center gap-2 px-4 py-3 border-b border-red-50 bg-red-50/50">
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                        <span className="text-sm font-semibold text-red-600">Overdue</span>
                        <span className="ml-auto text-xs text-red-400 bg-red-100 px-2 py-0.5 rounded-full">
                          {overdueKeys.reduce((s, k) => s + grouped.byDate[k].length, 0)}
                        </span>
                      </div>
                      {overdueKeys.flatMap((k) =>
                        grouped.byDate[k].map((t) => (
                          <TaskRow
                            key={t.id}
                            todo={t}
                            onToggle={() => toggle(t.id, !t.completed)}
                            onEdit={() => setEditingTodo(t)}
                            onDelete={() => deleteMut.mutate(t.id)}
                          />
                        ))
                      )}
                    </div>
                  )}

                  {/* Date groups */}
                  {upcomingKeys.map((key) => (
                    <div key={key} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-50">
                        <Calendar className="h-4 w-4 text-blue-500" />
                        <span className="text-sm font-semibold text-gray-700">{formatDateLabel(key)}</span>
                        <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                          {grouped.byDate[key].length}
                        </span>
                      </div>
                      {grouped.byDate[key].map((t) => (
                        <TaskRow
                          key={t.id}
                          todo={t}
                          onToggle={() => toggle(t.id, !t.completed)}
                          onEdit={() => setEditingTodo(t)}
                          onDelete={() => deleteMut.mutate(t.id)}
                        />
                      ))}
                    </div>
                  ))}

                  {/* No due date */}
                  {grouped.noDue.length > 0 && (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-50">
                        <Clock className="h-4 w-4 text-gray-400" />
                        <span className="text-sm font-semibold text-gray-500">No Due Date</span>
                        <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                          {grouped.noDue.length}
                        </span>
                      </div>
                      {grouped.noDue.map((t) => (
                        <TaskRow
                          key={t.id}
                          todo={t}
                          onToggle={() => toggle(t.id, !t.completed)}
                          onEdit={() => setEditingTodo(t)}
                          onDelete={() => deleteMut.mutate(t.id)}
                        />
                      ))}
                    </div>
                  )}

                  {/* Completed */}
                  {grouped.done.length > 0 && (
                    <details className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden group/details">
                      <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer list-none hover:bg-gray-50">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="text-sm font-semibold text-gray-500">Completed</span>
                        <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                          {grouped.done.length}
                        </span>
                      </summary>
                      {grouped.done.map((t) => (
                        <TaskRow
                          key={t.id}
                          todo={t}
                          onToggle={() => toggle(t.id, false)}
                          onEdit={() => setEditingTodo(t)}
                          onDelete={() => deleteMut.mutate(t.id)}
                        />
                      ))}
                    </details>
                  )}

                  {filtered.length === 0 && (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center py-20">
                      <CheckCircle2 className="h-12 w-12 text-gray-200 mb-3" />
                      <p className="text-gray-500 font-medium">
                        {search ? "No tasks found" : "All clear!"}
                      </p>
                      <p className="text-sm text-gray-400 mt-1">
                        {search ? "Try a different search term" : "Click 'New Task' to get started."}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Calendar View */}
              {view === "calendar" && <CalendarView todos={todos} />}
            </div>

            {/* Today Focus Sidebar */}
            {view === "list" && (
              <div className="w-64 shrink-0">
                <TodayFocus todos={todos} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <TodoModal
          modalTitle="Create New Task"
          onSubmit={handleCreate}
          onClose={() => setShowCreate(false)}
          loading={createMut.isPending}
        />
      )}

      {/* Edit Modal */}
      {editingTodo && (
        <TodoModal
          modalTitle="Edit Task"
          initial={getEditInitial(editingTodo)}
          onSubmit={handleUpdate}
          onClose={() => setEditingTodo(null)}
          loading={updateMut.isPending}
        />
      )}
    </div>
  );
}
