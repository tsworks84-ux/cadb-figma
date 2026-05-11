"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth";
import {
  BookUser, Plus, Pencil, Trash2, X, Check, Phone, Mail,
  ChevronUp, ChevronDown, Search, ChevronRight,
} from "lucide-react";
import Image from "next/image";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DirectoryEmployee {
  id:            string;
  firstName:     string;
  lastName:      string;
  photoUrl:      string | null;
  officialPhone: string | null;
  email:         string;
  department:    { name: string };
  designation:   { title: string };
}

interface DirectoryEntry {
  id:           string;
  employeeId:   string;
  areas:        string;
  displayOrder: number;
  employee:     DirectoryEmployee;
}

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ emp, size = 40 }: { emp: DirectoryEmployee; size?: number }) {
  const initials = `${emp.firstName[0]}${emp.lastName[0]}`.toUpperCase();
  if (emp.photoUrl) {
    return (
      <Image
        src={emp.photoUrl}
        alt={`${emp.firstName} ${emp.lastName}`}
        width={size} height={size}
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  const colors = [
    "bg-blue-100 text-blue-700", "bg-violet-100 text-violet-700",
    "bg-emerald-100 text-emerald-700", "bg-amber-100 text-amber-700",
    "bg-rose-100 text-rose-700", "bg-teal-100 text-teal-700",
  ];
  const color = colors[emp.firstName.charCodeAt(0) % colors.length];
  return (
    <div
      className={`rounded-full flex items-center justify-center font-semibold shrink-0 ${color}`}
      style={{ width: size, height: size, fontSize: size * 0.35 }}
    >
      {initials}
    </div>
  );
}

// ── Add / Edit Modal ──────────────────────────────────────────────────────────

function AddEditModal({
  editing,
  onClose,
}: {
  editing: DirectoryEntry | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [search, setSearch]           = useState("");
  const [selectedEmpId, setSelectedEmpId] = useState(editing?.employeeId ?? "");
  const [areas, setAreas]             = useState(editing?.areas ?? "");

  const { data: available = [] } = useQuery<DirectoryEmployee[]>({
    queryKey: ["directory-available"],
    queryFn: () => api.get("/api/v1/directory/available-employees").then((r) => r.data.data),
    enabled: !editing,
  });

  const filtered = available.filter((e) => {
    const q = search.toLowerCase();
    return (
      e.firstName.toLowerCase().includes(q) ||
      e.lastName.toLowerCase().includes(q) ||
      e.department.name.toLowerCase().includes(q) ||
      e.designation.title.toLowerCase().includes(q)
    );
  });

  const selectedEmp = editing
    ? editing.employee
    : available.find((e) => e.id === selectedEmpId);

  const saveMut = useMutation({
    mutationFn: () =>
      editing
        ? api.patch(`/api/v1/directory/${editing.id}`, { areas })
        : api.post("/api/v1/directory", { employeeId: selectedEmpId, areas }),
    onSuccess: () => {
      toast.success(editing ? "Updated" : "Added to directory");
      qc.invalidateQueries({ queryKey: ["directory"] });
      qc.invalidateQueries({ queryKey: ["directory-available"] });
      onClose();
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });

  const canSave = areas.trim().length > 0 && (editing || selectedEmpId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{editing ? "Edit Official" : "Add Official"}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {!editing && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Select Employee</label>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <input
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or department…"
                  className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              </div>
              <div className="max-h-48 overflow-y-auto border border-gray-100 rounded-xl divide-y divide-gray-50">
                {filtered.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">No employees available</p>
                ) : (
                  filtered.map((emp) => (
                    <button
                      key={emp.id}
                      onClick={() => setSelectedEmpId(emp.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-violet-50 transition-colors ${selectedEmpId === emp.id ? "bg-violet-50" : ""}`}
                    >
                      <Avatar emp={emp} size={32} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{emp.firstName} {emp.lastName}</p>
                        <p className="text-xs text-gray-400 truncate">{emp.designation.title} · {emp.department.name}</p>
                      </div>
                      {selectedEmpId === emp.id && <Check className="h-4 w-4 text-violet-600 shrink-0" />}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {selectedEmp && (
            <div className="flex items-center gap-3 bg-violet-50 rounded-xl px-4 py-3">
              <Avatar emp={selectedEmp} size={36} />
              <div>
                <p className="text-sm font-semibold text-gray-800">{selectedEmp.firstName} {selectedEmp.lastName}</p>
                <p className="text-xs text-gray-500">{selectedEmp.designation.title} · {selectedEmp.department.name}</p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Areas / Responsibilities</label>
            <textarea
              value={areas}
              onChange={(e) => setAreas(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="e.g. Leave approvals, Policy queries, Payroll escalations…"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 resize-none"
            />
            <p className="text-xs text-gray-400 mt-1 text-right">{areas.length}/500</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-100">Cancel</button>
          <button
            onClick={() => saveMut.mutate()}
            disabled={!canSave || saveMut.isPending}
            className="flex items-center gap-2 px-5 py-2 bg-violet-600 text-white text-sm font-medium rounded-xl hover:bg-violet-700 disabled:opacity-50 transition-colors"
          >
            {saveMut.isPending ? "Saving…" : editing ? "Save Changes" : "Add to Directory"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DirectoryPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const isSA = user?.role === "SUPER_ADMIN";

  const [modalOpen, setModalOpen]   = useState(false);
  const [editing, setEditing]       = useState<DirectoryEntry | null>(null);
  const [search, setSearch]         = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: entries = [], isLoading } = useQuery<DirectoryEntry[]>({
    queryKey: ["directory"],
    queryFn: () => api.get("/api/v1/directory").then((r) => r.data.data),
    staleTime: 60 * 1000,
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/directory/${id}`),
    onSuccess: () => {
      toast.success("Removed from directory");
      qc.invalidateQueries({ queryKey: ["directory"] });
      qc.invalidateQueries({ queryKey: ["directory-available"] });
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? "Failed"),
  });

  const reorderMut = useMutation({
    mutationFn: (ids: string[]) => api.post("/api/v1/directory/reorder", { ids }),
    onError: () => toast.error("Failed to reorder"),
  });

  function moveEntry(id: string, direction: "up" | "down") {
    const idx = entries.findIndex((e) => e.id === id);
    if (idx < 0) return;
    const next = [...entries];
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= next.length) return;
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    qc.setQueryData(["directory"], next);
    reorderMut.mutate(next.map((e) => e.id));
  }

  const filtered = entries.filter((e) => {
    const q = search.toLowerCase();
    return (
      e.employee.firstName.toLowerCase().includes(q) ||
      e.employee.lastName.toLowerCase().includes(q) ||
      e.employee.department.name.toLowerCase().includes(q) ||
      e.employee.designation.title.toLowerCase().includes(q) ||
      e.areas.toLowerCase().includes(q)
    );
  });

  function openAdd()  { setEditing(null); setModalOpen(true); }
  function openEdit(entry: DirectoryEntry) { setEditing(entry); setModalOpen(true); }
  function toggleExpand(id: string) { setExpandedId((prev) => (prev === id ? null : id)); }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <BookUser className="h-6 w-6 text-violet-600" />
              <h1 className="text-2xl font-bold text-gray-900">Directory</h1>
            </div>
            <p className="text-sm text-gray-400 ml-9">Key contacts and their areas of responsibility.</p>
          </div>
          {isSA && (
            <button
              onClick={openAdd}
              className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 transition-colors"
            >
              <Plus className="h-4 w-4" /> Add Official
            </button>
          )}
        </div>

        {/* Search */}
        {entries.length > 0 && (
          <div className="relative mb-5">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, department, area…"
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
          </div>
        )}

        {/* Table */}
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-white border border-gray-100 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="p-4 bg-violet-50 rounded-2xl mb-4">
              <BookUser className="h-8 w-8 text-violet-400" />
            </div>
            <p className="text-gray-600 font-medium mb-1">
              {search ? "No officials match your search" : "Directory is empty"}
            </p>
            <p className="text-sm text-gray-400">
              {search ? "Try a different search term" : isSA ? 'Click "Add Official" to get started' : "Check back later"}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Table header */}
            <div className="grid gap-4 px-5 py-3 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-400 uppercase tracking-wider"
              style={{ gridTemplateColumns: isSA ? "2.5rem 1fr 1fr 2fr auto" : "2.5rem 1fr 1fr 2fr" }}
            >
              <div>#</div>
              <div>Official</div>
              <div>Department</div>
              <div>Areas of Responsibility</div>
              {isSA && <div className="text-right">Actions</div>}
            </div>

            {/* Rows */}
            <div className="divide-y divide-gray-50">
              {filtered.map((entry, idx) => {
                const emp       = entry.employee;
                const isExpanded = expandedId === entry.id;

                return (
                  <div key={entry.id}>
                    {/* Main row */}
                    <div
                      className="grid gap-4 px-5 py-4 items-center hover:bg-violet-50/30 transition-colors cursor-pointer"
                      style={{ gridTemplateColumns: isSA ? "2.5rem 1fr 1fr 2fr auto" : "2.5rem 1fr 1fr 2fr" }}
                      onClick={() => toggleExpand(entry.id)}
                    >
                      {/* Rank */}
                      <div className="flex items-center justify-center w-7 h-7 rounded-full bg-violet-100 text-violet-700 text-xs font-bold shrink-0">
                        {idx + 1}
                      </div>

                      {/* Official info */}
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar emp={emp} size={38} />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {emp.firstName} {emp.lastName}
                          </p>
                          <p className="text-xs text-violet-600 font-medium truncate">{emp.designation.title}</p>
                        </div>
                        <ChevronRight className={`h-3.5 w-3.5 text-gray-400 shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                      </div>

                      {/* Department */}
                      <div className="text-sm text-gray-600 truncate">{emp.department.name}</div>

                      {/* Areas */}
                      <div className="text-sm text-gray-500 line-clamp-2 leading-relaxed">{entry.areas}</div>

                      {/* Admin actions */}
                      {isSA && (
                        <div className="flex items-center gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => moveEntry(entry.id, "up")}
                            disabled={idx === 0}
                            title="Move up"
                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 disabled:opacity-25 disabled:cursor-not-allowed"
                          >
                            <ChevronUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => moveEntry(entry.id, "down")}
                            disabled={idx === filtered.length - 1}
                            title="Move down"
                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 disabled:opacity-25 disabled:cursor-not-allowed"
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => openEdit(entry)}
                            title="Edit"
                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-blue-600"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => { if (confirm("Remove from directory?")) deleteMut.mutate(entry.id); }}
                            title="Remove"
                            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Expanded contact row */}
                    {isExpanded && (
                      <div className="px-5 pb-4 pt-0 bg-violet-50/40 border-t border-violet-100/60">
                        <div className="ml-[calc(2.5rem+3rem)] flex flex-wrap gap-6">
                          <a
                            href={emp.officialPhone ? `tel:${emp.officialPhone}` : undefined}
                            className={`flex items-center gap-2.5 group ${emp.officialPhone ? "cursor-pointer" : "cursor-default"}`}
                          >
                            <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-violet-100">
                              <Phone className="h-3.5 w-3.5 text-violet-600" />
                            </span>
                            <span className={`text-sm font-medium ${emp.officialPhone ? "text-violet-700 group-hover:underline" : "text-gray-400 italic"}`}>
                              {emp.officialPhone ?? "Phone not on record"}
                            </span>
                          </a>
                          <a href={`mailto:${emp.email}`} className="flex items-center gap-2.5 group cursor-pointer">
                            <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-violet-100">
                              <Mail className="h-3.5 w-3.5 text-violet-600" />
                            </span>
                            <span className="text-sm font-medium text-violet-700 group-hover:underline">
                              {emp.email}
                            </span>
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {modalOpen && (
        <AddEditModal
          editing={editing}
          onClose={() => { setModalOpen(false); setEditing(null); }}
        />
      )}
    </div>
  );
}
