"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  MessageSquare, Plus, X, Loader2, CheckCircle2, MapPin,
  ChevronDown, ChevronUp, Trash2, Pencil, Users,
} from "lucide-react";

// ── Status maps ───────────────────────────────────────────────────────────────

const PTM_STATUS: Record<string, { label: string; bg: string; text: string; border: string }> = {
  SCHEDULED: { label: "Scheduled", bg: "bg-blue-50",   text: "text-blue-700",  border: "border-blue-200"  },
  COMPLETED: { label: "Completed", bg: "bg-green-50",  text: "text-green-700", border: "border-green-200" },
  CANCELLED: { label: "Cancelled", bg: "bg-red-50",    text: "text-red-700",   border: "border-red-200"   },
};

const ACTION_STATUS: Record<string, { label: string; bg: string; text: string; border: string; dot: string }> = {
  YET_TO_START: { label: "Yet to Start", bg: "bg-gray-50",  text: "text-gray-600",  border: "border-gray-200",  dot: "bg-gray-400"  },
  ONGOING:      { label: "Ongoing",      bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-500" },
  COMPLETED:    { label: "Completed",    bg: "bg-green-50", text: "text-green-700", border: "border-green-200", dot: "bg-green-500" },
};

// ── Schedule Modal ────────────────────────────────────────────────────────────

function PTMScheduleModal({ student, onClose }: { student: any; onClose: () => void }) {
  const qc = useQueryClient();
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm]       = useState({ date: today, startTime: "09:00", endTime: "09:30", venue: "", agenda: "" });
  const [search, setSearch]   = useState("");
  const [selected, setSelected] = useState<any[]>([]);
  const [sending, setSending] = useState(false);

  const { data: empResults = [] } = useQuery({
    queryKey: ["emp-search-ptm", search],
    queryFn: () => search.length >= 2
      ? api.get(`/api/v1/employees?search=${encodeURIComponent(search)}&limit=8`).then((r) => r.data.data)
      : Promise.resolve([]),
    staleTime: 10_000,
    enabled: search.length >= 2,
  });

  const addAttendee    = (emp: any) => { if (!selected.find((s) => s.id === emp.id)) setSelected((p) => [...p, emp]); setSearch(""); };
  const removeAttendee = (id: string) => setSelected((p) => p.filter((e) => e.id !== id));

  const save = async () => {
    if (!form.date || !form.startTime) { toast.error("Date and start time are required"); return; }
    setSending(true);
    try {
      await api.post(`/api/v1/academics/students/${student.id}/ptms`, {
        ...form, attendeeIds: selected.map((e) => e.id),
      });
      toast.success("PTM scheduled — emails sent to attendees & parents");
      qc.invalidateQueries({ queryKey: ["student-ptms", student.id] });
      onClose();
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? "Failed to schedule PTM");
    } finally { setSending(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}>

        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div>
            <h2 className="font-black text-gray-900">Schedule a PTM</h2>
            <p className="text-xs text-gray-400 mt-0.5">{student.firstName} {student.lastName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X className="h-4 w-4" /></button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Date + Time */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-3 sm:col-span-1">
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Date *</label>
              <input type="date" value={form.date} min={today} max="2099-12-31"
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-indigo-400 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Start Time *</label>
              <input type="time" value={form.startTime}
                onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-indigo-400 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">End Time</label>
              <input type="time" value={form.endTime}
                onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-indigo-400 focus:outline-none" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Venue</label>
            <input type="text" placeholder="e.g. Conference Room B" value={form.venue}
              onChange={(e) => setForm((f) => ({ ...f, venue: e.target.value }))}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-indigo-400 focus:outline-none" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Agenda</label>
            <textarea rows={3} placeholder="Topics to discuss…" value={form.agenda}
              onChange={(e) => setForm((f) => ({ ...f, agenda: e.target.value }))}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-indigo-400 focus:outline-none resize-none" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Attendees (Teachers / Faculty)</label>
            {selected.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {selected.map((emp) => (
                  <span key={emp.id} className="inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold rounded-full px-3 py-1">
                    {emp.firstName} {emp.lastName}
                    <button type="button" onClick={() => removeAttendee(emp.id)} className="hover:text-red-500 transition-colors"><X className="h-3 w-3" /></button>
                  </span>
                ))}
              </div>
            )}
            <div className="relative">
              <input type="text" placeholder="Type name to search…" value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-indigo-400 focus:outline-none" />
              {(empResults as any[]).length > 0 && search.length >= 2 && (
                <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
                  {(empResults as any[]).map((emp) => {
                    const already = !!selected.find((s) => s.id === emp.id);
                    return (
                      <button key={emp.id} type="button" onClick={() => !already && addAttendee(emp)} disabled={already}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${already ? "opacity-40 cursor-default" : "hover:bg-indigo-50"}`}>
                        <div className="h-7 w-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700 shrink-0">
                          {(emp.firstName[0] ?? "") + (emp.lastName[0] ?? "")}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-800">{emp.firstName} {emp.lastName}</p>
                          <p className="text-xs text-gray-400">{emp.designation?.title ?? ""}{emp.department ? ` · ${emp.department.name}` : ""}</p>
                        </div>
                        {already && <span className="ml-auto text-xs text-green-600 font-semibold">Added</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <p className="text-[11px] text-gray-400 mt-1.5">Emails will be sent to all added teachers and to the student&apos;s parents.</p>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3 sticky bottom-0 bg-white">
          <button onClick={onClose} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={save} disabled={sending || !form.date || !form.startTime}
            className="inline-flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-extrabold text-white disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,#28245f,#4f46e5)", boxShadow: "0 8px 20px rgba(79,70,229,.3)" }}>
            {sending ? <><Loader2 className="h-4 w-4 animate-spin" /> Scheduling…</> : <>Schedule & Send Invite</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Discussion Panel ──────────────────────────────────────────────────────────

function PTMDiscussionPanel({ ptm, studentId, canEdit }: { ptm: any; studentId: string; canEdit: boolean }) {
  const qc = useQueryClient();
  const [notes, setNotes]         = useState<string>(ptm.notes ?? "");
  const [notesDirty, setNotesDirty] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [newItem, setNewItem]     = useState("");
  const [addingItem, setAddingItem] = useState(false);
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [editText, setEditText]   = useState("");
  const items: any[]              = ptm.actionItems ?? [];

  const saveNotes = async () => {
    setSavingNotes(true);
    try {
      await api.patch(`/api/v1/academics/students/${studentId}/ptms/${ptm.id}`, { notes });
      qc.invalidateQueries({ queryKey: ["student-ptms", studentId] });
      setNotesDirty(false);
      toast.success("Discussion notes saved");
    } catch { toast.error("Failed to save notes"); }
    finally { setSavingNotes(false); }
  };

  const addActionItem = async () => {
    if (!newItem.trim()) return;
    setAddingItem(true);
    try {
      await api.post(`/api/v1/academics/students/${studentId}/ptms/${ptm.id}/action-items`, { description: newItem.trim() });
      qc.invalidateQueries({ queryKey: ["student-ptms", studentId] });
      setNewItem("");
      toast.success("Action item added");
    } catch { toast.error("Failed to add"); }
    finally { setAddingItem(false); }
  };

  const updateItemStatus = async (itemId: string, status: string) => {
    try {
      await api.patch(`/api/v1/academics/students/${studentId}/ptms/${ptm.id}/action-items/${itemId}`, { status });
      qc.invalidateQueries({ queryKey: ["student-ptms", studentId] });
    } catch { toast.error("Failed to update status"); }
  };

  const saveItemEdit = async (itemId: string) => {
    if (!editText.trim()) return;
    try {
      await api.patch(`/api/v1/academics/students/${studentId}/ptms/${ptm.id}/action-items/${itemId}`, { description: editText.trim() });
      qc.invalidateQueries({ queryKey: ["student-ptms", studentId] });
      setEditItemId(null);
      toast.success("Updated");
    } catch { toast.error("Failed to update"); }
  };

  const deleteItem = async (itemId: string) => {
    try {
      await api.delete(`/api/v1/academics/students/${studentId}/ptms/${ptm.id}/action-items/${itemId}`);
      qc.invalidateQueries({ queryKey: ["student-ptms", studentId] });
      toast.success("Deleted");
    } catch { toast.error("Failed to delete"); }
  };

  return (
    <div className="border-t border-gray-100 bg-gray-50/60 px-5 py-4 space-y-5">
      {/* General Discussion */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <MessageSquare className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
          <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">General Discussion</p>
        </div>
        {canEdit ? (
          <div className="space-y-2">
            <textarea rows={3} value={notes} placeholder="Add discussion notes…"
              onChange={(e) => { setNotes(e.target.value); setNotesDirty(true); }}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none resize-none" />
            {notesDirty && (
              <div className="flex justify-end">
                <button onClick={saveNotes} disabled={savingNotes}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                  {savingNotes ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                  Save Notes
                </button>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-500 whitespace-pre-wrap leading-relaxed">
            {notes || <span className="italic text-gray-400">No discussion notes added.</span>}
          </p>
        )}
      </div>

      {/* Action Items */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
          <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">Action Items</p>
          {items.length > 0 && (
            <span className="ml-auto text-[10px] font-bold text-gray-400">
              {items.filter((i) => i.status === "COMPLETED").length}/{items.length} done
            </span>
          )}
        </div>

        {items.length > 0 && (
          <div className="space-y-2 mb-3">
            {items.map((item: any) => {
              const ast = ACTION_STATUS[item.status] ?? ACTION_STATUS.YET_TO_START;
              return (
                <div key={item.id} className={`rounded-xl border ${ast.border} ${ast.bg} flex items-start gap-3 px-3 py-2.5`}>
                  <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${ast.dot}`} />
                  <div className="flex-1 min-w-0">
                    {editItemId === item.id ? (
                      <div className="flex gap-2">
                        <input autoFocus value={editText} onChange={(e) => setEditText(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") saveItemEdit(item.id); if (e.key === "Escape") setEditItemId(null); }}
                          className="flex-1 rounded-lg border border-indigo-300 bg-white px-2 py-1 text-sm focus:outline-none" />
                        <button onClick={() => saveItemEdit(item.id)} className="rounded-lg bg-indigo-600 text-white px-2.5 py-1 text-xs font-bold hover:bg-indigo-700">Save</button>
                        <button onClick={() => setEditItemId(null)} className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-500 hover:bg-white">Cancel</button>
                      </div>
                    ) : (
                      <p className={`text-sm font-medium leading-snug ${item.status === "COMPLETED" ? "line-through text-gray-400" : "text-gray-800"}`}>
                        {item.description}
                      </p>
                    )}
                  </div>
                  {canEdit && editItemId !== item.id && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <select value={item.status} onChange={(e) => updateItemStatus(item.id, e.target.value)}
                        className={`rounded-lg border text-[11px] font-bold px-1.5 py-0.5 focus:outline-none cursor-pointer ${ast.bg} ${ast.text} ${ast.border}`}>
                        <option value="YET_TO_START">Yet to Start</option>
                        <option value="ONGOING">Ongoing</option>
                        <option value="COMPLETED">Completed</option>
                      </select>
                      <button onClick={() => { setEditItemId(item.id); setEditText(item.description); }}
                        className="p-1 rounded-lg border border-gray-200 hover:bg-white text-gray-400 hover:text-indigo-600 transition-colors">
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button onClick={() => { if (confirm("Delete this action item?")) deleteItem(item.id); }}
                        className="p-1 rounded-lg border border-gray-200 hover:bg-red-50 hover:border-red-200 text-gray-400 hover:text-red-500 transition-colors">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {canEdit && (
          <div className="flex gap-2">
            <input type="text" placeholder="Add an action item…" value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addActionItem(); }}
              className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none" />
            <button onClick={addActionItem} disabled={addingItem || !newItem.trim()}
              className="rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white disabled:opacity-40 transition-colors px-3 py-2">
              {addingItem ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </button>
          </div>
        )}
        {items.length === 0 && !canEdit && <p className="text-xs italic text-gray-400">No action items recorded.</p>}
      </div>
    </div>
  );
}

// ── Student PTM panel ─────────────────────────────────────────────────────────

function StudentPTMPanel({ student, canEdit }: { student: any; canEdit: boolean }) {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen]   = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["student-ptms", student.id],
    queryFn: () => api.get(`/api/v1/academics/students/${student.id}/ptms`).then((r) => r.data.data),
    staleTime: 0,
  });

  const statusMut = useMutation({
    mutationFn: ({ ptmId, status }: { ptmId: string; status: string }) =>
      api.patch(`/api/v1/academics/students/${student.id}/ptms/${ptmId}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["student-ptms", student.id] }),
    onError:   (e: any) => toast.error(e.response?.data?.error ?? "Failed to update"),
  });

  const deleteMut = useMutation({
    mutationFn: (ptmId: string) => api.delete(`/api/v1/academics/students/${student.id}/ptms/${ptmId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["student-ptms", student.id] }); toast.success("PTM deleted"); },
    onError:   (e: any) => toast.error(e.response?.data?.error ?? "Failed to delete"),
  });

  const ptms: any[] = data ?? [];

  const grouped = useMemo(() => {
    const m = new Map<string, { label: string; items: any[] }>();
    for (const p of ptms) {
      const d = new Date(p.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
      if (!m.has(key)) m.set(key, { label, items: [] });
      m.get(key)!.items.push(p);
    }
    return Array.from(m.entries()).sort((a, b) => b[0].localeCompare(a[0])).map(([, v]) => v);
  }, [ptms]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-700">Parent–Teacher Meetings</p>
          <p className="text-xs text-gray-400 mt-0.5">{ptms.length} meeting{ptms.length !== 1 ? "s" : ""} on record</p>
        </div>
        {canEdit && (
          <button onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold text-white"
            style={{ background: "linear-gradient(135deg,#28245f,#4f46e5)" }}>
            <Plus className="h-3.5 w-3.5" /> Schedule a PTM
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-xl bg-gray-100 animate-pulse" />)}</div>
      ) : ptms.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400 bg-white rounded-xl border border-gray-100">
          <MessageSquare className="h-10 w-10 mb-3 text-gray-200" />
          <p className="text-sm font-semibold">No PTMs scheduled yet</p>
          {canEdit && (
            <button onClick={() => setModalOpen(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold text-white"
              style={{ background: "linear-gradient(135deg,#28245f,#4f46e5)" }}>
              <Plus className="h-3.5 w-3.5" /> Schedule first PTM
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map((group) => (
            <div key={group.label}>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">{group.label}</p>
              <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50 overflow-hidden">
                {group.items.map((ptm: any) => {
                  const st = PTM_STATUS[ptm.status] ?? PTM_STATUS.SCHEDULED;
                  const d  = new Date(ptm.date);
                  const isPast     = d < new Date(new Date().toDateString());
                  const isExpanded = expandedId === ptm.id;
                  const actionDone  = (ptm.actionItems ?? []).filter((i: any) => i.status === "COMPLETED").length;
                  const actionTotal = (ptm.actionItems ?? []).length;
                  return (
                    <div key={ptm.id} className="overflow-hidden">
                      <div className="flex items-start gap-4 px-5 py-4 hover:bg-gray-50/60 transition-colors cursor-pointer select-none"
                        onClick={() => setExpandedId(isExpanded ? null : ptm.id)}>
                        <div className="shrink-0 w-12 text-center pt-0.5">
                          <p className="text-xl font-black text-gray-800 leading-none">{d.getDate()}</p>
                          <p className="text-[10px] font-bold text-gray-400 uppercase">{d.toLocaleDateString("en-IN", { month: "short" })}</p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-gray-900">{ptm.startTime}{ptm.endTime ? ` – ${ptm.endTime}` : ""}</span>
                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${st.bg} ${st.text} ${st.border}`}>{st.label}</span>
                            {isPast && ptm.status === "SCHEDULED" && (
                              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">Past</span>
                            )}
                            {actionTotal > 0 && (
                              <span className={`text-[10px] font-bold rounded-full border px-2 py-0.5 ${actionDone === actionTotal ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-50 text-gray-500 border-gray-200"}`}>
                                {actionDone}/{actionTotal} actions
                              </span>
                            )}
                          </div>
                          {ptm.venue   && <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1"><MapPin className="h-3 w-3 shrink-0" />{ptm.venue}</p>}
                          {ptm.agenda  && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{ptm.agenda}</p>}
                          {ptm.attendees?.length > 0 && (
                            <p className="text-xs text-gray-400 mt-1">
                              👩‍🏫 {ptm.attendees.map((a: any) => `${a.employee.firstName} ${a.employee.lastName}`).join(", ")}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                          {canEdit && ptm.status === "SCHEDULED" && (
                            <button onClick={() => statusMut.mutate({ ptmId: ptm.id, status: "COMPLETED" })} title="Mark Completed"
                              className="p-1.5 rounded-lg border border-gray-200 hover:bg-green-50 hover:border-green-200 hover:text-green-600 text-gray-400 transition-colors">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {canEdit && ptm.status !== "CANCELLED" && (
                            <button onClick={() => statusMut.mutate({ ptmId: ptm.id, status: "CANCELLED" })} title="Cancel PTM"
                              className="p-1.5 rounded-lg border border-gray-200 hover:bg-red-50 hover:border-red-200 hover:text-red-500 text-gray-400 transition-colors">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {canEdit && (
                            <button onClick={() => { if (confirm("Delete this PTM?")) deleteMut.mutate(ptm.id); }} title="Delete"
                              className="p-1.5 rounded-lg border border-gray-200 hover:bg-red-50 hover:border-red-200 hover:text-red-500 text-gray-400 transition-colors">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <div className="ml-1 p-1.5 rounded-lg text-gray-300">
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </div>
                        </div>
                      </div>
                      {isExpanded && <PTMDiscussionPanel ptm={ptm} studentId={student.id} canEdit={canEdit} />}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && <PTMScheduleModal student={student} onClose={() => setModalOpen(false)} />}
    </div>
  );
}

// ── Schedule Batch PTM ────────────────────────────────────────────────────────

type ScheduleResult = { studentId: string; name: string; ok: boolean; error?: string };

function ScheduleBatchPTM({ students, canEdit }: { students: any[]; canEdit: boolean }) {
  const qc = useQueryClient();
  const today = new Date().toISOString().split("T")[0];

  const [form, setForm]           = useState({ date: today, startTime: "09:00", endTime: "09:30", venue: "", agenda: "" });
  const [empSearch, setEmpSearch] = useState("");
  const [attendees, setAttendees] = useState<any[]>([]);
  const [checked, setChecked]     = useState<Set<string>>(() => new Set(students.map((s) => s.id)));
  const [sending, setSending]     = useState(false);
  const [results, setResults]     = useState<ScheduleResult[] | null>(null);

  const { data: empResults = [] } = useQuery({
    queryKey: ["emp-search-ptm-batch", empSearch],
    queryFn: () => empSearch.length >= 2
      ? api.get(`/api/v1/employees?search=${encodeURIComponent(empSearch)}&limit=8`).then((r) => r.data.data)
      : Promise.resolve([]),
    staleTime: 10_000,
    enabled: empSearch.length >= 2,
  });

  const toggleStudent = (id: string) =>
    setChecked((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const toggleAll = () =>
    setChecked(checked.size === students.length ? new Set() : new Set(students.map((s) => s.id)));

  const addAttendee    = (emp: any) => { if (!attendees.find((a) => a.id === emp.id)) setAttendees((p) => [...p, emp]); setEmpSearch(""); };
  const removeAttendee = (id: string) => setAttendees((p) => p.filter((a) => a.id !== id));

  const schedule = async () => {
    if (!form.date || !form.startTime) { toast.error("Date and start time are required"); return; }
    if (checked.size === 0) { toast.error("Select at least one student"); return; }
    setSending(true);
    setResults(null);
    const payload = { ...form, attendeeIds: attendees.map((a) => a.id) };
    const targets = students.filter((s) => checked.has(s.id));
    const out: ScheduleResult[] = await Promise.all(
      targets.map(async (s) => {
        try {
          await api.post(`/api/v1/academics/students/${s.id}/ptms`, payload);
          qc.invalidateQueries({ queryKey: ["student-ptms", s.id] });
          return { studentId: s.id, name: `${s.firstName} ${s.lastName}`, ok: true };
        } catch (e: any) {
          return { studentId: s.id, name: `${s.firstName} ${s.lastName}`, ok: false, error: e.response?.data?.error ?? "Failed" };
        }
      })
    );
    setSending(false);
    setResults(out);
    const failed = out.filter((r) => !r.ok).length;
    if (failed === 0) toast.success(`PTM scheduled for ${out.length} student${out.length !== 1 ? "s" : ""}`);
    else toast.error(`${failed} failed, ${out.length - failed} succeeded`);
  };

  if (!canEdit) {
    return (
      <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-gray-100 text-gray-400">
        <Users className="h-10 w-10 mb-3 text-gray-200" />
        <p className="text-sm">You don't have permission to schedule PTMs.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 items-start">
      {/* ── Form ── */}
      <div className="flex-1 min-w-0 bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50">
          <p className="font-semibold text-gray-800 text-sm">Meeting Details</p>
          <p className="text-xs text-gray-400 mt-0.5">Same details will be used for all selected students</p>
        </div>
        <div className="px-5 py-5 space-y-5">
          {/* Date + Time */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-3 sm:col-span-1">
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Date *</label>
              <input type="date" value={form.date} min={today} max="2099-12-31"
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-indigo-400 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Start Time *</label>
              <input type="time" value={form.startTime}
                onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-indigo-400 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">End Time</label>
              <input type="time" value={form.endTime}
                onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-indigo-400 focus:outline-none" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Venue</label>
            <input type="text" placeholder="e.g. Conference Room B" value={form.venue}
              onChange={(e) => setForm((f) => ({ ...f, venue: e.target.value }))}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-indigo-400 focus:outline-none" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Agenda</label>
            <textarea rows={3} placeholder="Topics to discuss…" value={form.agenda}
              onChange={(e) => setForm((f) => ({ ...f, agenda: e.target.value }))}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-indigo-400 focus:outline-none resize-none" />
          </div>

          {/* Attendees */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Attendees (Teachers / Faculty)</label>
            {attendees.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {attendees.map((emp) => (
                  <span key={emp.id} className="inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold rounded-full px-3 py-1">
                    {emp.firstName} {emp.lastName}
                    <button type="button" onClick={() => removeAttendee(emp.id)} className="hover:text-red-500"><X className="h-3 w-3" /></button>
                  </span>
                ))}
              </div>
            )}
            <div className="relative">
              <input type="text" placeholder="Type name to search…" value={empSearch}
                onChange={(e) => setEmpSearch(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-indigo-400 focus:outline-none" />
              {(empResults as any[]).length > 0 && empSearch.length >= 2 && (
                <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
                  {(empResults as any[]).map((emp) => {
                    const already = !!attendees.find((a) => a.id === emp.id);
                    return (
                      <button key={emp.id} type="button" onClick={() => !already && addAttendee(emp)} disabled={already}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm ${already ? "opacity-40 cursor-default" : "hover:bg-indigo-50"}`}>
                        <div className="h-7 w-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700 shrink-0">
                          {emp.firstName[0]}{emp.lastName[0]}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-800">{emp.firstName} {emp.lastName}</p>
                          <p className="text-xs text-gray-400">{emp.designation?.title ?? ""}{emp.department ? ` · ${emp.department.name}` : ""}</p>
                        </div>
                        {already && <span className="ml-auto text-xs text-green-600 font-semibold">Added</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <p className="text-[11px] text-gray-400 mt-1.5">Emails will be sent to all teachers and each student&apos;s parents.</p>
          </div>

          <button onClick={schedule} disabled={sending || checked.size === 0}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-extrabold text-white disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,#28245f,#4f46e5)", boxShadow: "0 8px 20px rgba(79,70,229,.3)" }}>
            {sending
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Scheduling…</>
              : <><Plus className="h-4 w-4" /> Schedule PTM for {checked.size} Student{checked.size !== 1 ? "s" : ""}</>}
          </button>
        </div>
      </div>

      {/* ── Student checklist / Results ── */}
      <div className="w-full lg:w-72 shrink-0 bg-white rounded-xl border border-gray-100 overflow-hidden">
        {results ? (
          <>
            <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Results</p>
              <button onClick={() => setResults(null)} className="text-xs text-indigo-600 hover:underline">Schedule again</button>
            </div>
            <div className="divide-y divide-gray-50 max-h-[60vh] overflow-y-auto">
              {results.map((r) => (
                <div key={r.studentId} className="flex items-center gap-3 px-4 py-3">
                  <div className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 ${r.ok ? "bg-green-100" : "bg-red-100"}`}>
                    {r.ok
                      ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                      : <X className="h-3.5 w-3.5 text-red-500" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800 truncate">{r.name}</p>
                    {!r.ok && <p className="text-xs text-red-500 truncate">{r.error}</p>}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Students ({checked.size}/{students.length})
              </p>
              <button onClick={toggleAll} className="text-xs text-indigo-600 hover:underline">
                {checked.size === students.length ? "Deselect all" : "Select all"}
              </button>
            </div>
            <div className="divide-y divide-gray-50 max-h-[60vh] overflow-y-auto">
              {students.map((s) => {
                const on = checked.has(s.id);
                return (
                  <label key={s.id} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors">
                    <input type="checkbox" checked={on} onChange={() => toggleStudent(s.id)}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
                    <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${on ? "bg-indigo-100 text-indigo-600" : "bg-gray-100 text-gray-400"}`}>
                      {s.firstName[0]}{s.lastName[0]}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm font-medium truncate ${on ? "text-gray-800" : "text-gray-400"}`}>{s.firstName} {s.lastName}</p>
                      <p className="text-xs text-gray-400 truncate">{s.studentCode}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Batch PTM Tab (exported) ──────────────────────────────────────────────────

export function BatchPTMTab({ students, studentsLoading, canEdit }: {
  students: any[];
  studentsLoading: boolean;
  canEdit: boolean;
}) {
  const [view, setView]       = useState<"individual" | "batch">("individual");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = students.find((s) => s.id === selectedId) ?? null;

  if (studentsLoading) {
    return <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-xl bg-white animate-pulse" />)}</div>;
  }

  if (students.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 py-16 text-center bg-white">
        <Users className="h-10 w-10 text-gray-200 mx-auto mb-2" />
        <p className="text-sm text-gray-400">No students in this batch yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Inner tab bar ── */}
      <div className="flex gap-1 bg-white rounded-xl border border-gray-100 p-1 w-fit">
        <button
          onClick={() => setView("individual")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            view === "individual" ? "bg-indigo-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
          }`}
        >
          <MessageSquare className="h-3.5 w-3.5" /> Student PTMs
        </button>
        <button
          onClick={() => setView("batch")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            view === "batch" ? "bg-indigo-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
          }`}
        >
          <Users className="h-3.5 w-3.5" /> Schedule Batch PTM
        </button>
      </div>

      {/* ── Individual view ── */}
      {view === "individual" && (
        <div className="flex flex-col lg:flex-row gap-4 items-start">
          <div className="w-full lg:w-64 shrink-0 bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Students</p>
            </div>
            <div className="divide-y divide-gray-50 max-h-[70vh] overflow-y-auto">
              {students.map((s) => {
                const isActive = s.id === selectedId;
                return (
                  <button key={s.id} onClick={() => setSelectedId(isActive ? null : s.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                      isActive ? "bg-indigo-50 border-l-2 border-indigo-500" : "hover:bg-gray-50 border-l-2 border-transparent"
                    }`}>
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      isActive ? "bg-indigo-500 text-white" : "bg-indigo-100 text-indigo-600"
                    }`}>
                      {s.firstName[0]}{s.lastName[0]}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm font-medium truncate ${isActive ? "text-indigo-700" : "text-gray-800"}`}>{s.firstName} {s.lastName}</p>
                      <p className="text-xs text-gray-400 truncate">{s.studentCode}</p>
                    </div>
                    <MessageSquare className={`h-3.5 w-3.5 shrink-0 ml-auto ${isActive ? "text-indigo-400" : "text-gray-300"}`} />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            {selected ? (
              <StudentPTMPanel student={selected} canEdit={canEdit} />
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400 bg-white rounded-xl border border-gray-100">
                <MessageSquare className="h-10 w-10 mb-3 text-gray-200" />
                <p className="text-sm font-semibold">Select a student to view their PTMs</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Batch schedule view ── */}
      {view === "batch" && <ScheduleBatchPTM students={students} canEdit={canEdit} />}
    </div>
  );
}
