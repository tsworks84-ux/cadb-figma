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
  BarChart3, Target, Zap, TrendingUp, Play, Square,
  Flag, FileText, Users, Award,
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

// ── New Task Modal ────────────────────────────────────────────────────────────

const PRIORITY_COLORS: Record<TodoPriority, { active: string; inactive: string }> = {
  HIGH:   { active: "bg-red-50 text-red-700 border-red-400",    inactive: "bg-white text-gray-600 border-gray-200 hover:bg-gray-50" },
  MEDIUM: { active: "bg-orange-50 text-orange-700 border-orange-400", inactive: "bg-white text-gray-600 border-gray-200 hover:bg-gray-50" },
  LOW:    { active: "bg-blue-50 text-blue-700 border-blue-400",  inactive: "bg-white text-gray-600 border-gray-200 hover:bg-gray-50" },
};

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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">{modalTitle}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Task Title</label>
            <input
              autoFocus
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2"
              placeholder="What needs to be done?"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 resize-none"
              placeholder="Add details about this task..."
              rows={3}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-2">
                <Calendar size={15} /> Due Date
              </label>
              <input
                type="date"
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2"
                value={form.dueDate}
                onChange={(e) => set("dueDate", e.target.value)}
              />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-2">
                <Clock size={15} /> Due Time
              </label>
              <input
                type="time"
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2"
                value={form.dueTime}
                onChange={(e) => set("dueTime", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-2">
                <Tag size={15} /> Category
              </label>
              <select
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 bg-white"
                value={form.category}
                onChange={(e) => set("category", e.target.value)}
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-2">
                <Flag size={15} /> Priority
              </label>
              <div className="flex gap-2">
                {(["HIGH", "MEDIUM", "LOW"] as TodoPriority[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => set("priority", p)}
                    className={`flex-1 py-2.5 rounded-lg text-xs font-medium border-2 transition-all ${
                      form.priority === p ? PRIORITY_COLORS[p].active : PRIORITY_COLORS[p].inactive
                    }`}
                  >
                    {PRIORITY_META[p].label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {form.dueDate && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Reminder</label>
              <select
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 bg-white"
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
              <label className="block text-sm font-medium text-gray-700 mb-2">Custom reminder time</label>
              <input
                type="datetime-local"
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2"
                value={form.reminderAt}
                onChange={(e) => set("reminderAt", e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            disabled={!form.title.trim() || loading}
            onClick={() => form.title.trim() && onSubmit(form)}
            className="px-5 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            style={{ backgroundColor: "#2C3E7C" }}
          >
            {loading ? "Saving..." : modalTitle === "Edit Task" ? "Save Task" : "Create Task"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Task Stats Modal ──────────────────────────────────────────────────────────

function TaskStatsModal({ todos, onClose }: { todos: Todo[]; onClose: () => void }) {
  const completed = todos.filter((t) => t.completed).length;
  const total = todos.length;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Last 7 days activity
  const weeklyData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = toDateStr(d);
    const dayTodos = todos.filter((t) => t.dueDate && toDateStr(new Date(t.dueDate)) === key);
    return {
      day: d.toLocaleDateString([], { weekday: "short" }),
      completed: dayTodos.filter((t) => t.completed).length,
      total: dayTodos.length,
    };
  });
  const maxVal = Math.max(...weeklyData.map((d) => d.total), 1);

  // Category breakdown from real todos
  const categoryData = CATEGORIES.map((cat) => {
    const count = todos.filter((t) => t.category === cat).length;
    return { category: cat, count, percentage: total > 0 ? Math.round((count / total) * 100) : 0 };
  }).filter((c) => c.count > 0);

  const CATEGORY_COLORS = ["#2C3E7C", "#F2994A", "#A8D08D", "#E07A5F", "#9B59B6", "#3498DB", "#1ABC9C"];

  const achievements = [
    { title: "Task Master",   description: "Complete 50 tasks",          icon: Award,  earned: completed >= 50 },
    { title: "Productive",    description: "Achieve 80%+ completion rate", icon: TrendingUp, earned: completionRate >= 80 },
    { title: "Early Bird",    description: "Complete 5 tasks before 9 AM", icon: Clock,  earned: false },
    { title: "Perfect Week",  description: "Complete all tasks in a week",  icon: Target, earned: false },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Your Statistics</h2>
            <p className="text-sm text-gray-500 mt-1">Insights into your productivity</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Overview Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Completed",       value: completed,           sub: "All time",           bg: "from-blue-50 to-blue-100",     border: "border-blue-200",     icon: <CheckCircle2 className="text-blue-600" size={20} />,   text: "text-blue-900" },
              { label: "Completion Rate", value: `${completionRate}%`, sub: "Of all tasks",       bg: "from-green-50 to-green-100",   border: "border-green-200",    icon: <TrendingUp className="text-green-600" size={20} />,    text: "text-green-900" },
              { label: "Pending",         value: total - completed,   sub: "To be done",         bg: "from-orange-50 to-orange-100", border: "border-orange-200",   icon: <Clock className="text-orange-600" size={20} />,        text: "text-orange-900" },
              { label: "Focus Score",     value: completionRate,      sub: "Out of 100",         bg: "from-purple-50 to-purple-100", border: "border-purple-200",   icon: <Target className="text-purple-600" size={20} />,       text: "text-purple-900" },
            ].map(({ label, value, sub, bg, border, icon, text }) => (
              <div key={label} className={`bg-gradient-to-br ${bg} rounded-lg p-4 border ${border}`}>
                <div className="flex items-center gap-2 mb-2">
                  {icon}
                  <p className={`text-sm font-medium ${text}`}>{label}</p>
                </div>
                <p className={`text-3xl font-semibold ${text}`}>{value}</p>
                <p className={`text-xs mt-1 opacity-70 ${text}`}>{sub}</p>
              </div>
            ))}
          </div>

          {/* Weekly Activity */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Calendar size={18} /> Weekly Activity
            </h3>
            <div className="flex items-end justify-between gap-2 h-40">
              {weeklyData.map((data, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full flex flex-col items-center justify-end" style={{ height: "120px" }}>
                    {data.total > 0 && (
                      <div className="w-full flex flex-col justify-end" style={{ height: "100%" }}>
                        <div
                          className="w-full rounded-t-md"
                          style={{
                            height: `${(data.total / maxVal) * 100}%`,
                            backgroundColor: "#2C3E7C",
                            opacity: data.completed > 0 ? 1 : 0.3,
                          }}
                        />
                      </div>
                    )}
                    {data.total === 0 && <div className="w-full h-1 bg-gray-100 rounded" />}
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-medium text-gray-900">{data.completed}</p>
                    <p className="text-xs text-gray-500">{data.day}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: "#2C3E7C" }} />
                <span className="text-xs text-gray-600">Completed tasks</span>
              </div>
            </div>
          </div>

          {/* Category Breakdown */}
          {categoryData.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <h3 className="text-base font-semibold text-gray-900 mb-4">Tasks by Category</h3>
              <div className="space-y-4">
                {categoryData.map((item, i) => (
                  <div key={item.category}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-gray-900">{item.category}</span>
                      <span className="text-sm text-gray-500">{item.count} tasks ({item.percentage}%)</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{ width: `${item.percentage}%`, backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Achievements */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Award size={18} /> Achievements
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {achievements.map(({ title, description, icon: Icon, earned }) => (
                <div
                  key={title}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    earned ? "bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-300" : "bg-gray-50 border-gray-200"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${earned ? "bg-yellow-100" : "bg-gray-200"}`}>
                      <Icon size={20} className={earned ? "text-yellow-600" : "text-gray-400"} />
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm font-semibold ${earned ? "text-gray-900" : "text-gray-500"}`}>{title}</p>
                      <p className={`text-xs mt-1 ${earned ? "text-gray-600" : "text-gray-400"}`}>{description}</p>
                    </div>
                    {earned && <CheckCircle2 className="text-green-600 shrink-0" size={20} />}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tip */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-5">
            <h3 className="text-base font-semibold text-gray-900 mb-2">Productivity Tip</h3>
            <p className="text-sm text-gray-700">
              {completionRate >= 80
                ? "Excellent work! You're completing most of your tasks. Keep maintaining this pace."
                : "Try breaking large tasks into smaller ones and tackling high-priority items first thing in the morning."}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: "#2C3E7C" }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Log Time Modal ────────────────────────────────────────────────────────────

function LogTimeModal({ onClose }: { onClose: () => void }) {
  const [timeData, setTimeData] = useState({
    date: new Date().toISOString().split("T")[0],
    task: "",
    category: "Lectures",
    startTime: "",
    endTime: "",
    hours: "",
    minutes: "",
    batch: "",
    description: "",
  });

  const categories = ["Lectures", "Doubt Solving", "Exam Paper Work", "Content Creation", "Evaluation Work", "PTM", "Training", "Others"];
  const batches = ["Grade 1A", "Grade 1B", "Grade 2A", "Grade 2B", "Grade 3A", "Grade 3B", "Grade 4A", "Grade 4B", "Grade 5A", "Grade 5B"];
  const showBatch = ["Lectures", "PTM", "Doubt Solving"].includes(timeData.category);

  useEffect(() => {
    if (timeData.startTime && timeData.endTime) {
      const start = new Date(`2000-01-01T${timeData.startTime}`);
      const end = new Date(`2000-01-01T${timeData.endTime}`);
      const diff = end.getTime() - start.getTime();
      if (diff > 0) {
        const totalMin = Math.floor(diff / 60000);
        setTimeData((p) => ({ ...p, hours: String(Math.floor(totalMin / 60)), minutes: String(totalMin % 60) }));
      }
    }
  }, [timeData.startTime, timeData.endTime]);

  const quickDurations = [
    { label: "15m", hours: "0", minutes: "15" },
    { label: "30m", hours: "0", minutes: "30" },
    { label: "45m", hours: "0", minutes: "45" },
    { label: "1h",  hours: "1", minutes: "0"  },
    { label: "1.5h",hours: "1", minutes: "30" },
    { label: "2h",  hours: "2", minutes: "0"  },
    { label: "3h",  hours: "3", minutes: "0"  },
  ];

  const hasPreview = timeData.hours || timeData.minutes || timeData.startTime || timeData.endTime;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Log Time</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Date */}
          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-2">
              <Calendar size={15} /> Date
            </label>
            <input
              type="date"
              value={timeData.date}
              onChange={(e) => setTimeData({ ...timeData, date: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2"
            />
          </div>

          {/* Task Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Task Title</label>
            <input
              type="text"
              placeholder="e.g., Lecture — Mathematics 101"
              value={timeData.task}
              onChange={(e) => setTimeData({ ...timeData, task: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2"
            />
          </div>

          {/* Category */}
          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-2">
              <Tag size={15} /> Category
            </label>
            <select
              value={timeData.category}
              onChange={(e) => setTimeData({ ...timeData, category: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 bg-white"
            >
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Batch (conditional) */}
          {showBatch && (
            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-2">
                <Users size={15} /> Batch / Class
                <span className="text-xs text-gray-500 font-normal">(Optional)</span>
              </label>
              <select
                value={timeData.batch}
                onChange={(e) => setTimeData({ ...timeData, batch: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 bg-white"
              >
                <option value="">Select batch</option>
                {batches.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          )}

          {/* Start / End Time */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-2">
                <Clock size={15} /> Start Time
              </label>
              <input
                type="time"
                value={timeData.startTime}
                onChange={(e) => setTimeData({ ...timeData, startTime: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2"
              />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-2">
                <Clock size={15} /> End Time
              </label>
              <input
                type="time"
                value={timeData.endTime}
                onChange={(e) => setTimeData({ ...timeData, endTime: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2"
              />
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-2">
              <Clock size={15} /> Duration
              {timeData.startTime && timeData.endTime && (
                <span className="text-xs text-gray-500 font-normal">(Auto-calculated)</span>
              )}
            </label>
            <div className="flex gap-3">
              <div className="flex-1">
                <input
                  type="number" min="0" max="23" placeholder="Hours"
                  value={timeData.hours}
                  onChange={(e) => setTimeData({ ...timeData, hours: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2"
                />
                <p className="text-xs text-gray-500 mt-1">Hours</p>
              </div>
              <div className="flex-1">
                <input
                  type="number" min="0" max="59" step="15" placeholder="Minutes"
                  value={timeData.minutes}
                  onChange={(e) => setTimeData({ ...timeData, minutes: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2"
                />
                <p className="text-xs text-gray-500 mt-1">Minutes</p>
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-2">
              <FileText size={15} /> Description
              <span className="text-xs text-gray-500 font-normal">(Optional)</span>
            </label>
            <textarea
              placeholder="Add any additional notes about this work..."
              value={timeData.description}
              onChange={(e) => setTimeData({ ...timeData, description: e.target.value })}
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 resize-none"
            />
          </div>

          {/* Quick Select */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Quick Select</label>
            <div className="flex gap-2 flex-wrap">
              {quickDurations.map(({ label, hours, minutes }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setTimeData({ ...timeData, hours, minutes })}
                  className={`px-3 py-1.5 border rounded-md text-sm font-medium transition-colors ${
                    timeData.hours === hours && timeData.minutes === minutes
                      ? "text-white border-transparent"
                      : "border-gray-200 text-gray-700 hover:bg-gray-50"
                  }`}
                  style={timeData.hours === hours && timeData.minutes === minutes ? { backgroundColor: "#2C3E7C" } : {}}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          {hasPreview && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-1.5">
              {timeData.startTime && timeData.endTime && (
                <p className="text-sm text-gray-700">
                  <span className="font-medium">Time: </span>{timeData.startTime} – {timeData.endTime}
                </p>
              )}
              {(timeData.hours || timeData.minutes) && (
                <p className="text-sm text-gray-700">
                  <span className="font-medium">Duration: </span>
                  {parseInt(timeData.hours || "0") > 0 && `${timeData.hours}h `}
                  {parseInt(timeData.minutes || "0") > 0 && `${timeData.minutes}m`}
                  {!parseInt(timeData.hours || "0") && !parseInt(timeData.minutes || "0") && "0h"}
                </p>
              )}
              {timeData.batch && (
                <p className="text-sm text-gray-700">
                  <span className="font-medium">Batch: </span>{timeData.batch}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: "#2C3E7C" }}
          >
            Log Time
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
  const [activeTab, setActiveTab] = useState<"tasks" | "timesheet">("tasks");
  const [view, setView] = useState<"list" | "calendar">("list");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerTask, setTimerTask] = useState("");
  const [showStats, setShowStats] = useState(false);
  const [showLogTime, setShowLogTime] = useState(false);

  useEffect(() => {
    const cal = searchParams.get("calendar");
    if (cal === "connected") toast.success("Google Calendar connected!");
    if (cal === "error") toast.error("Failed to connect Google Calendar");
  }, [searchParams]);

  useEffect(() => {
    if (!timerRunning) return;
    const interval = setInterval(() => setTimerSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [timerRunning]);

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

  // Sidebar computed values
  const todayTodos = todos.filter((t) => t.dueDate && isSameDay(new Date(t.dueDate), today));
  const todayDone = todayTodos.filter((t) => t.completed).length;
  const todayTotal = todayTodos.length;
  const focusPct = todayTotal > 0 ? Math.round((todayDone / todayTotal) * 100) : 0;
  const upcomingList = todos
    .filter((t) => !t.completed && t.dueDate)
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
    .slice(0, 5);
  const productivity = todos.length > 0 ? Math.round((stats.completed / todos.length) * 100) : 0;

  function formatTimer(s: number) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }

  const STAT_CARDS = [
    { label: "Due Today",  value: stats.dueToday,   bg: "bg-blue-50",   icon: <Calendar className="h-5 w-5 text-blue-600" /> },
    { label: "Pending",    value: stats.pending,     bg: "bg-orange-50", icon: <Clock className="h-5 w-5 text-orange-600" /> },
    { label: "Completed",  value: stats.completed,   bg: "bg-green-50",  icon: <CheckCircle2 className="h-5 w-5 text-green-600" /> },
    { label: "Overdue",    value: stats.overdue,     bg: "bg-red-50",    icon: <AlertTriangle className="h-5 w-5 text-red-500" /> },
  ];

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
              <CheckCircle2 className="text-white" size={18} />
            </div>
            <div>
              <p className="text-sm text-gray-500 uppercase tracking-wide">Personal</p>
              <h1 className="text-2xl font-semibold text-gray-900">My To-Do</h1>
            </div>
          </div>
          <p className="text-sm text-gray-600 mt-1">Organize your work and track your time</p>
        </div>
        <div className="flex gap-2 flex-wrap md:flex-nowrap w-full md:w-auto items-center">
          {calendarConnected ? (
            <button
              onClick={() => {
                api.delete("/api/v1/auth/google/calendar/disconnect").then(() => {
                  queryClient.invalidateQueries({ queryKey: ["todos"] });
                  toast.success("Calendar disconnected");
                });
              }}
              className="flex items-center gap-1.5 px-3 py-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-md hover:bg-green-100 transition-colors"
            >
              <Link2 size={14} /> Google Calendar
            </button>
          ) : (
            <a
              href={`${API_BASE}/api/v1/auth/google/calendar/connect`}
              className="flex items-center gap-1.5 px-3 py-2 text-xs text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
            >
              <Link2Off size={14} /> Connect Calendar
            </a>
          )}
          <button
            onClick={() => setShowStats(true)}
            className="flex-1 md:flex-initial px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2"
          >
            <BarChart3 size={18} />
            <span className="hidden sm:inline">Stats</span>
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex-1 md:flex-initial px-4 py-2 rounded-md text-sm font-medium text-white flex items-center justify-center gap-2"
            style={{ backgroundColor: "#2C3E7C" }}
          >
            <Plus size={18} />
            <span className="hidden sm:inline">New Task</span>
            <span className="sm:hidden">New</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex">
          {([
            { id: "tasks",     label: "My Tasks",   Icon: CheckCircle2 },
            { id: "timesheet", label: "Timesheet",  Icon: Clock },
          ] as const).map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`px-4 py-2.5 text-sm font-medium flex items-center gap-2 transition-colors border-b-2 -mb-px ${
                activeTab === id
                  ? "text-gray-900"
                  : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
              style={activeTab === id ? { borderBottomColor: "#2C3E7C" } : {}}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── My Tasks Tab ── */}
      {activeTab === "tasks" && (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {STAT_CARDS.map(({ label, value, bg, icon }) => (
              <div key={label} className="bg-white rounded-lg border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-2">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${bg}`}>
                    {icon}
                  </div>
                </div>
                <p className="text-3xl font-semibold text-gray-900 mb-1">{value}</p>
                <p className="text-sm text-gray-600">{label}</p>
              </div>
            ))}
          </div>

          {/* Main content grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Task list — left 2/3 */}
            <div className="lg:col-span-2 space-y-4">
              {/* Search + view toggle */}
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type="text"
                      placeholder="Search tasks..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-offset-0"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setView("list")}
                      className={`px-3 py-2 rounded-md text-sm font-medium ${view === "list" ? "text-white" : "text-gray-700 border border-gray-200 hover:bg-gray-50"}`}
                      style={view === "list" ? { backgroundColor: "#2C3E7C" } : {}}
                    >
                      <List size={18} />
                    </button>
                    <button
                      onClick={() => setView("calendar")}
                      className={`px-3 py-2 rounded-md text-sm font-medium ${view === "calendar" ? "text-white" : "text-gray-700 border border-gray-200 hover:bg-gray-50"}`}
                      style={view === "calendar" ? { backgroundColor: "#2C3E7C" } : {}}
                    >
                      <Calendar size={18} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Loading */}
              {isLoading && (
                <div className="bg-white rounded-lg border border-gray-200 flex items-center justify-center py-20">
                  <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full" />
                </div>
              )}

              {/* List View */}
              {!isLoading && view === "list" && (
                <div className="space-y-4">
                  {/* Overdue */}
                  {overdueKeys.length > 0 && (
                    <div className="bg-white rounded-lg border border-red-100 overflow-hidden">
                      <div className="flex items-center gap-2 px-4 py-3 border-b border-red-50 bg-red-50/50">
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                        <span className="text-sm font-semibold text-red-600">Overdue</span>
                        <span className="ml-auto text-xs text-red-400 bg-red-100 px-2 py-0.5 rounded-full">
                          {overdueKeys.reduce((s, k) => s + grouped.byDate[k].length, 0)}
                        </span>
                      </div>
                      {overdueKeys.flatMap((k) =>
                        grouped.byDate[k].map((t) => (
                          <TaskRow key={t.id} todo={t}
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
                    <div key={key} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-50">
                        <Calendar className="h-4 w-4 text-blue-500" />
                        <span className="text-sm font-semibold text-gray-700">{formatDateLabel(key)}</span>
                        <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                          {grouped.byDate[key].length}
                        </span>
                      </div>
                      {grouped.byDate[key].map((t) => (
                        <TaskRow key={t.id} todo={t}
                          onToggle={() => toggle(t.id, !t.completed)}
                          onEdit={() => setEditingTodo(t)}
                          onDelete={() => deleteMut.mutate(t.id)}
                        />
                      ))}
                    </div>
                  ))}

                  {/* No due date */}
                  {grouped.noDue.length > 0 && (
                    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-50">
                        <Clock className="h-4 w-4 text-gray-400" />
                        <span className="text-sm font-semibold text-gray-500">No Due Date</span>
                        <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                          {grouped.noDue.length}
                        </span>
                      </div>
                      {grouped.noDue.map((t) => (
                        <TaskRow key={t.id} todo={t}
                          onToggle={() => toggle(t.id, !t.completed)}
                          onEdit={() => setEditingTodo(t)}
                          onDelete={() => deleteMut.mutate(t.id)}
                        />
                      ))}
                    </div>
                  )}

                  {/* Completed */}
                  {grouped.done.length > 0 && (
                    <details className="bg-white rounded-lg border border-gray-200 overflow-hidden group/details">
                      <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer list-none hover:bg-gray-50">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="text-sm font-semibold text-gray-500">Completed</span>
                        <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                          {grouped.done.length}
                        </span>
                      </summary>
                      {grouped.done.map((t) => (
                        <TaskRow key={t.id} todo={t}
                          onToggle={() => toggle(t.id, false)}
                          onEdit={() => setEditingTodo(t)}
                          onDelete={() => deleteMut.mutate(t.id)}
                        />
                      ))}
                    </details>
                  )}

                  {filtered.length === 0 && (
                    <div className="bg-white rounded-lg border border-gray-200 flex flex-col items-center justify-center py-20">
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
              {!isLoading && view === "calendar" && <CalendarView todos={todos} />}
            </div>

            {/* Sidebar — right 1/3 */}
            <div className="space-y-4">
              {/* Today's Focus */}
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Target size={18} style={{ color: "#2C3E7C" }} />
                  <h3 className="text-sm font-semibold text-gray-900">Today's Focus</h3>
                </div>
                <div className="mb-3">
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-3xl font-semibold text-gray-900">{todayDone}</span>
                    <span className="text-sm text-gray-500">of {todayTotal} tasks done</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all duration-300"
                      style={{ width: `${focusPct}%`, backgroundColor: "#2C3E7C" }}
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  {focusPct === 100 && todayTotal > 0
                    ? "Great job! All tasks completed!"
                    : todayTotal === 0
                    ? "No tasks due today."
                    : "Keep going! You're doing great."}
                </p>
              </div>

              {/* Productivity */}
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <Zap size={18} className="text-yellow-500" />
                    Productivity
                  </h3>
                  <TrendingUp size={16} className="text-green-600" />
                </div>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-3xl font-semibold text-gray-900">{productivity}</span>
                  <span className="text-sm text-gray-500">/ 100</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div
                    className="h-1.5 rounded-full"
                    style={{
                      width: `${productivity}%`,
                      backgroundColor: productivity >= 70 ? "#10b981" : productivity >= 40 ? "#F2994A" : "#E07A5F",
                    }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {productivity >= 70 ? "Excellent work!" : productivity >= 40 ? "Good progress" : "Getting started"}
                </p>
              </div>

              {/* Upcoming */}
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Upcoming</h3>
                <div className="space-y-3">
                  {upcomingList.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">No upcoming tasks</p>
                  ) : (
                    upcomingList.map((t) => {
                      const overdue = !!t.dueDate && isPastDay(toDateStr(new Date(t.dueDate)));
                      const pm = PRIORITY_META[t.priority];
                      return (
                        <div key={t.id} className="flex items-start gap-2.5">
                          <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${pm.dot}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-900 truncate">{t.title}</p>
                            {t.dueDate && (
                              <p className={`text-xs mt-0.5 ${overdue ? "text-red-500" : "text-gray-500"}`}>
                                {overdue ? "Overdue · " : ""}
                                {new Date(t.dueDate).toLocaleDateString([], { month: "short", day: "numeric" })}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Timesheet Tab ── */}
      {activeTab === "timesheet" && (
        <div className="space-y-6">
          {/* Summary stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: "This Week", value: "0h",  bg: "bg-blue-50",   icon: <Clock className="h-5 w-5 text-blue-600" /> },
              { label: "Approved",  value: "0",   bg: "bg-green-50",  icon: <CheckCircle2 className="h-5 w-5 text-green-600" /> },
              { label: "Pending",   value: "0",   bg: "bg-orange-50", icon: <AlertTriangle className="h-5 w-5 text-orange-600" /> },
            ].map(({ label, value, bg, icon }) => (
              <div key={label} className="bg-white rounded-lg border border-gray-200 p-5">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${bg}`}>
                    {icon}
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-gray-900">{value}</p>
                    <p className="text-sm text-gray-600">{label}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Timer */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900">Quick Timer</h3>
              <span className="text-2xl font-mono font-semibold" style={{ color: "#2C3E7C" }}>
                {formatTimer(timerSeconds)}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="What are you working on?"
                value={timerTask}
                onChange={(e) => setTimerTask(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-offset-0"
              />
              {timerRunning ? (
                <button
                  onClick={() => { setTimerRunning(false); setTimerSeconds(0); setTimerTask(""); }}
                  className="px-4 py-2 rounded-md text-sm font-medium text-white flex items-center gap-2 bg-red-500 hover:bg-red-600"
                >
                  <Square size={16} />
                  Stop
                </button>
              ) : (
                <button
                  onClick={() => timerTask.trim() && setTimerRunning(true)}
                  disabled={!timerTask.trim()}
                  className="px-4 py-2 rounded-md text-sm font-medium text-white flex items-center gap-2 disabled:opacity-50"
                  style={{ backgroundColor: "#2C3E7C" }}
                >
                  <Play size={16} />
                  Start
                </button>
              )}
            </div>
            {timerRunning && (
              <p className="text-xs text-gray-500 mt-2">
                Tracking: <span className="font-medium text-gray-700">{timerTask}</span>
              </p>
            )}
          </div>

          {/* Recent Entries */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">Recent Entries</h3>
              <button
                onClick={() => setShowLogTime(true)}
                className="px-4 py-2 rounded-md text-sm font-medium text-white flex items-center gap-2"
                style={{ backgroundColor: "#2C3E7C" }}
              >
                <Plus size={16} />
                Log Time
              </button>
            </div>
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Clock className="h-12 w-12 text-gray-200 mb-3" />
              <p className="text-gray-500 font-medium">No timesheet entries yet</p>
              <p className="text-sm text-gray-400 mt-1">Use the timer above to start tracking your work.</p>
            </div>
          </div>
        </div>
      )}

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

      {/* Stats Modal */}
      {showStats && (
        <TaskStatsModal todos={todos} onClose={() => setShowStats(false)} />
      )}

      {/* Log Time Modal */}
      {showLogTime && (
        <LogTimeModal onClose={() => setShowLogTime(false)} />
      )}
    </div>
  );
}
