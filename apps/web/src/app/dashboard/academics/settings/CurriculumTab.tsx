"use client";

import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft, ChevronDown, ChevronRight, ChevronUp, Download, FileSpreadsheet, Pencil,
  Plus, Trash2, Upload, X, Check, ToggleLeft, ToggleRight, Search,
} from "lucide-react";
import { api } from "@/lib/api";

/**
 * Academic Settings → Curriculum: one curriculum per subject × grade × board,
 * holding a chapter → topic → subtopic outline. Built row by row here or
 * imported from the xlsx template; the New Exam form offers it as topic choices.
 */

const D = { line: "#e6e8ef", muted: "#7c8598", ink: "#111827", nav2: "#28245f", bg: "#f4f6fa", accent: "#eef2ff" };
const BASE = "/api/v1/academics/curricula";
// Suggestions only — the board is free text, and boards already in use are added.
const BOARD_SUGGESTIONS = ["CBSE", "ICSE", "State Board", "IGCSE", "IB", "Foundation", "JEE/NEET"];

type Level = "CHAPTER" | "TOPIC" | "SUBTOPIC";
type Item = { id: string; parentId: string | null; level: Level; name: string; sortOrder: number };
type CurriculumRow = {
  id: string; board: string; isActive: boolean; updatedAt: string;
  subject: { id: string; code: string; name: string };
  grade: { id: string; name: string };
  counts: { chapters: number; topics: number; subtopics: number };
};
type Target = { subjectId: string; gradeId: string; board: string };

const errMsg = (e: any) => e?.response?.data?.error ?? "Something went wrong";

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  Object.assign(document.createElement("a"), { href: url, download: filename }).click();
  URL.revokeObjectURL(url);
}
async function downloadFrom(path: string, filename: string) {
  try {
    const res = await api.get(path, { responseType: "blob" });
    download(res.data, filename);
  } catch (e: any) {
    // Error bodies arrive as a Blob too.
    const text = e?.response?.data instanceof Blob ? await e.response.data.text() : "";
    toast.error((() => { try { return JSON.parse(text).error; } catch { return "Download failed"; } })());
  }
}

// ── Small primitives ────────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = { width: "100%", borderRadius: 10, border: `1px solid ${D.line}`, padding: "8px 12px", fontSize: 13, outline: "none", background: "#fff", boxSizing: "border-box", minHeight: 38 };
const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: D.muted, display: "block", marginBottom: 4 };
const ghostBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, padding: "0 14px", height: 38, borderRadius: 10, border: `1px solid ${D.line}`, background: "#fff", color: D.ink, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" };
const primaryBtn: React.CSSProperties = { ...ghostBtn, background: D.nav2, color: "#fff", border: "none", fontWeight: 600 };
const iconBtn: React.CSSProperties = { padding: 6, borderRadius: 8, border: `1px solid ${D.line}`, background: "#fff", color: D.muted, cursor: "pointer", display: "flex", lineHeight: 1 };

// Native <select> ignores border/padding on some platforms — draw our own chevron.
function Select({ value, onChange, children, style }: { value: string; onChange: (v: string) => void; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ position: "relative", ...style }}>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="appearance-none" style={{ ...inputStyle, paddingRight: 30, cursor: "pointer" }}>
        {children}
      </select>
      <ChevronDown size={14} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: D.muted, pointerEvents: "none" }} />
    </div>
  );
}

function useLookups() {
  const subjects = useQuery({ queryKey: ["subjects", false], queryFn: () => api.get("/api/v1/academics/subjects?all=false").then((r) => r.data.data as { id: string; code: string; name: string }[]) });
  const grades = useQuery({ queryKey: ["grades", false], queryFn: () => api.get("/api/v1/academics/grades?all=false").then((r) => r.data.data as { id: string; name: string; sortOrder: number }[]) });
  const boards = useQuery({ queryKey: ["curriculum-boards"], queryFn: () => api.get(`${BASE}/boards`).then((r) => r.data.data as string[]) });
  const boardOptions = useMemo(() => [...new Set([...BOARD_SUGGESTIONS, ...(boards.data ?? [])])], [boards.data]);
  return { subjects: subjects.data ?? [], grades: [...(grades.data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder), boardOptions };
}

function TargetFields({ value, onChange, disabled }: { value: Target; onChange: (t: Target) => void; disabled?: boolean }) {
  const { subjects, grades, boardOptions } = useLookups();
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3" style={{ gap: 10 }}>
      <div>
        <label style={labelStyle}>Subject *</label>
        {disabled ? <div style={{ ...inputStyle, background: D.bg }}>{subjects.find((s) => s.id === value.subjectId)?.name ?? "—"}</div> : (
          <Select value={value.subjectId} onChange={(v) => onChange({ ...value, subjectId: v })}>
            <option value="">Select subject</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        )}
      </div>
      <div>
        <label style={labelStyle}>Grade *</label>
        {disabled ? <div style={{ ...inputStyle, background: D.bg }}>{grades.find((g) => g.id === value.gradeId)?.name ?? "—"}</div> : (
          <Select value={value.gradeId} onChange={(v) => onChange({ ...value, gradeId: v })}>
            <option value="">Select grade</option>
            {grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </Select>
        )}
      </div>
      <div>
        <label style={labelStyle}>Board *</label>
        {disabled ? <div style={{ ...inputStyle, background: D.bg }}>{value.board}</div> : (
          <>
            <input list="curriculum-boards" value={value.board} onChange={(e) => onChange({ ...value, board: e.target.value })} placeholder="e.g. CBSE" style={inputStyle} />
            <datalist id="curriculum-boards">{boardOptions.map((b) => <option key={b} value={b} />)}</datalist>
          </>
        )}
      </div>
    </div>
  );
}

// ── Import modal ───────────────────────────────────────────────────────────────
type DryRun = {
  totalRows: number; existingRows: number; mode: "replace" | "append";
  counts: { chapters: number; topics: number; subtopics: number };
  errors: { row: number; message: string }[];
  preview: { name: string; topics: string[]; moreTopics: number }[];
};

function ImportModal({ initial, locked, onClose, onDone }: { initial: Target; locked?: boolean; onClose: () => void; onDone: (id: string) => void }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState<Target>(initial);
  const [mode, setMode] = useState<"replace" | "append">("replace");
  const [file, setFile] = useState<File | null>(null);
  const [check, setCheck] = useState<DryRun | null>(null);
  const [busy, setBusy] = useState(false);

  const ready = !!(target.subjectId && target.gradeId && target.board.trim());
  const qs = (dry: boolean) => new URLSearchParams({ subjectId: target.subjectId, gradeId: target.gradeId, board: target.board.trim(), mode, dryRun: String(dry) }).toString();

  async function validate(f: File, m = mode) {
    if (!ready) { toast.error("Choose a subject, grade and board first"); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await api.post(`${BASE}/import?${new URLSearchParams({ subjectId: target.subjectId, gradeId: target.gradeId, board: target.board.trim(), mode: m, dryRun: "true" })}`, fd);
      setCheck(res.data.data);
    } catch (e) { toast.error(errMsg(e)); setCheck(null); }
    finally { setBusy(false); }
  }

  async function commit() {
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.post(`${BASE}/import?${qs(false)}`, fd);
      const d = res.data.data;
      toast.success(`Imported ${d.counts.chapters} chapters, ${d.counts.topics} topics, ${d.counts.subtopics} subtopics`);
      qc.invalidateQueries({ queryKey: ["curricula"] });
      qc.invalidateQueries({ queryKey: ["curriculum"] });
      qc.invalidateQueries({ queryKey: ["curriculum-boards"] });
      qc.invalidateQueries({ queryKey: ["curriculum-outline"] });
      onDone(d.id);
    } catch (e: any) {
      if (e?.response?.data?.data?.errors && check) setCheck({ ...check, errors: e.response.data.data.errors });
      toast.error(errMsg(e));
    } finally { setBusy(false); }
  }

  const errors = check?.errors ?? [];
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white" style={{ padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: D.ink }}>Import curriculum</h2>
          <button onClick={onClose} style={{ ...iconBtn, border: "none" }}><X size={16} /></button>
        </div>

        <TargetFields value={target} onChange={(t) => { setTarget(t); setCheck(null); }} disabled={locked} />

        <div style={{ marginTop: 14 }}>
          <label style={labelStyle}>When this curriculum already has rows</label>
          <div className="flex flex-col sm:flex-row" style={{ gap: 8 }}>
            {([["replace", "Replace everything", "The file becomes the whole curriculum"], ["append", "Add to it", "New rows are merged in by name; nothing is removed"]] as const).map(([m, title, desc]) => (
              <label key={m} style={{ flex: 1, display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 12px", borderRadius: 10, border: `1px solid ${mode === m ? D.nav2 : D.line}`, background: mode === m ? D.accent : "#fff", cursor: "pointer" }}>
                <input type="radio" checked={mode === m} onChange={() => { setMode(m); if (file) validate(file, m); }} style={{ accentColor: D.nav2, marginTop: 3, flexShrink: 0 }} />
                <span><span style={{ display: "block", fontSize: 13, fontWeight: 600, color: D.ink }}>{title}</span><span style={{ fontSize: 12, color: D.muted }}>{desc}</span></span>
              </label>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 14, padding: 14, borderRadius: 12, border: `1px dashed ${D.line}`, background: D.bg }}>
          <div className="flex flex-col sm:flex-row sm:items-center" style={{ gap: 10, justifyContent: "space-between" }}>
            <p style={{ margin: 0, fontSize: 12, color: D.muted }}>
              Columns <b>Chapter</b>, <b>Topic</b>, <b>Subtopic</b> — blank cells continue the chapter/topic above.
            </p>
            <button onClick={() => downloadFrom(`${BASE}/template`, "curriculum_import_template.xlsx")} style={ghostBtn}><FileSpreadsheet size={14} /> Template</button>
          </div>
          <input ref={fileRef} type="file" accept=".xlsx,.csv" hidden onChange={(e) => { const f = e.target.files?.[0] ?? null; e.target.value = ""; setFile(f); setCheck(null); if (f) validate(f); }} />
          <button onClick={() => fileRef.current?.click()} disabled={busy} style={{ ...ghostBtn, marginTop: 10, width: "100%", justifyContent: "center" }}>
            <Upload size={14} /> {file ? file.name : "Choose .xlsx file"}
          </button>
        </div>

        {busy && !check && <p style={{ fontSize: 12, color: D.muted, marginTop: 10 }}>Checking the file…</p>}
        {check && (
          <div style={{ marginTop: 14 }}>
            <div className="grid grid-cols-3" style={{ gap: 8 }}>
              {([["Chapters", check.counts.chapters], ["Topics", check.counts.topics], ["Subtopics", check.counts.subtopics]] as const).map(([l, v]) => (
                <div key={l} style={{ borderRadius: 10, border: `1px solid ${D.line}`, padding: "8px 12px" }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: D.muted, textTransform: "uppercase" }}>{l}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: D.ink }}>{v}</div>
                </div>
              ))}
            </div>
            {check.existingRows > 0 && (
              <p style={{ margin: "10px 0 0", fontSize: 12, color: check.mode === "replace" ? "#b45309" : D.muted }}>
                {check.mode === "replace"
                  ? `This curriculum already has ${check.existingRows} rows — they will be replaced.`
                  : `Merging into the existing ${check.existingRows} rows.`}
              </p>
            )}
            {errors.length > 0 && (
              <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: "#fef2f2", border: "1px solid #fecaca", maxHeight: 140, overflowY: "auto" }}>
                <p style={{ margin: "0 0 4px", fontSize: 12, fontWeight: 600, color: "#b91c1c" }}>{errors.length} problem{errors.length === 1 ? "" : "s"} — fix the file and choose it again</p>
                {errors.slice(0, 50).map((er, i) => <p key={i} style={{ margin: 0, fontSize: 12, color: "#991b1b" }}>{er.row ? `Row ${er.row}: ` : ""}{er.message}</p>)}
              </div>
            )}
            {check.preview.length > 0 && (
              <div style={{ marginTop: 10, borderRadius: 10, border: `1px solid ${D.line}`, maxHeight: 200, overflowY: "auto" }}>
                {check.preview.map((c, i) => (
                  <div key={i} style={{ padding: "8px 12px", borderTop: i ? `1px solid ${D.line}` : "none" }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: D.ink }}>{c.name}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: D.muted }}>{c.topics.join(" · ")}{c.moreTopics ? ` · +${c.moreTopics} more` : ""}</p>
                  </div>
                ))}
                {check.counts.chapters > check.preview.length && <p style={{ margin: 0, padding: "6px 12px", fontSize: 12, color: D.muted, borderTop: `1px solid ${D.line}` }}>+{check.counts.chapters - check.preview.length} more chapters</p>}
              </div>
            )}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button onClick={onClose} style={ghostBtn}>Cancel</button>
          <button onClick={commit} disabled={!check || errors.length > 0 || check.counts.chapters === 0 || busy}
            style={{ ...primaryBtn, opacity: !check || errors.length > 0 || check.counts.chapters === 0 || busy ? 0.5 : 1 }}>
            {busy && check ? "Importing…" : "Import"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Outline editor ─────────────────────────────────────────────────────────────
const CHILD: Record<Level, Level | null> = { CHAPTER: "TOPIC", TOPIC: "SUBTOPIC", SUBTOPIC: null };
const LEVEL_LABEL: Record<Level, string> = { CHAPTER: "chapter", TOPIC: "topic", SUBTOPIC: "subtopic" };

function AddRow({ placeholder, onAdd, onCancel, indent }: { placeholder: string; onAdd: (name: string) => Promise<unknown>; onCancel?: () => void; indent: number }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    const n = name.trim();
    if (!n) return;
    setBusy(true);
    try { await onAdd(n); setName(""); } catch { /* toast shown by caller */ } finally { setBusy(false); }
  }
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", padding: `6px 12px 6px ${12 + indent}px` }}>
      <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={placeholder}
        onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") onCancel?.(); }} style={{ ...inputStyle, minHeight: 34, padding: "6px 10px" }} />
      <button onClick={submit} disabled={!name.trim() || busy} style={{ ...iconBtn, background: D.nav2, color: "#fff", border: "none", opacity: !name.trim() || busy ? 0.5 : 1 }}><Check size={14} /></button>
      {onCancel && <button onClick={onCancel} style={iconBtn}><X size={14} /></button>}
    </div>
  );
}

function OutlineNode({ item, childrenOf, depth, canEdit, open, toggle, filter, actions, isFirst, isLast }: {
  item: Item; childrenOf: (id: string) => Item[]; depth: number; canEdit: boolean;
  open: Set<string>; toggle: (id: string) => void; filter: string;
  actions: { add: (parentId: string, name: string) => Promise<unknown>; rename: (id: string, name: string) => Promise<unknown>; move: (id: string, dir: "up" | "down") => void; remove: (item: Item) => void };
  isFirst: boolean; isLast: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.name);
  const [adding, setAdding] = useState(false);
  const kids = childrenOf(item.id);
  const childLevel = CHILD[item.level];
  const expanded = open.has(item.id) || !!filter;
  const indent = depth * 22;
  const subCount = item.level === "CHAPTER" ? kids.reduce((n, k) => n + childrenOf(k.id).length, 0) : 0;
  const summary = item.level === "CHAPTER"
    ? `${kids.length} topic${kids.length === 1 ? "" : "s"}${subCount ? ` · ${subCount} subtopic${subCount === 1 ? "" : "s"}` : ""}`
    : item.level === "TOPIC" && kids.length ? `${kids.length} subtopic${kids.length === 1 ? "" : "s"}` : "";

  return (
    <>
      <div className="group" style={{ display: "flex", alignItems: "center", gap: 6, padding: `8px 12px 8px ${12 + indent}px`, borderTop: `1px solid ${D.line}`, background: item.level === "CHAPTER" ? "#fafbfe" : "#fff" }}>
        {childLevel ? (
          <button onClick={() => toggle(item.id)} style={{ border: "none", background: "none", padding: 2, cursor: "pointer", color: D.muted, display: "flex", visibility: kids.length || canEdit ? "visible" : "hidden" }}>
            {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </button>
        ) : <span style={{ width: 19, flexShrink: 0, textAlign: "center", color: D.line }}>•</span>}

        {editing ? (
          <div style={{ flex: 1, display: "flex", gap: 6 }}>
            <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} style={{ ...inputStyle, minHeight: 32, padding: "5px 10px" }}
              onKeyDown={(e) => { if (e.key === "Enter" && draft.trim()) actions.rename(item.id, draft.trim()).then(() => setEditing(false), () => {}); if (e.key === "Escape") setEditing(false); }} />
            <button onClick={() => draft.trim() && actions.rename(item.id, draft.trim()).then(() => setEditing(false), () => {})} style={{ ...iconBtn, background: D.nav2, color: "#fff", border: "none" }}><Check size={13} /></button>
            <button onClick={() => { setEditing(false); setDraft(item.name); }} style={iconBtn}><X size={13} /></button>
          </div>
        ) : (
          <div onClick={() => childLevel && toggle(item.id)} style={{ flex: 1, minWidth: 0, cursor: childLevel ? "pointer" : "default" }}>
            <span style={{ fontSize: 13, fontWeight: item.level === "CHAPTER" ? 600 : item.level === "TOPIC" ? 500 : 400, color: item.level === "SUBTOPIC" ? "#374151" : D.ink, wordBreak: "break-word" }}>{item.name}</span>
            {summary && <span style={{ marginLeft: 8, fontSize: 11, color: D.muted, whiteSpace: "nowrap" }}>{summary}</span>}
          </div>
        )}

        {canEdit && !editing && (
          // Always visible on touch screens; revealed on hover on desktop.
          <div className="flex md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity" style={{ gap: 4, flexShrink: 0 }}>
            {childLevel && <button title={`Add ${LEVEL_LABEL[childLevel]}`} onClick={() => { setAdding(true); if (!open.has(item.id)) toggle(item.id); }} style={iconBtn}><Plus size={13} /></button>}
            <button title="Move up" disabled={isFirst} onClick={() => actions.move(item.id, "up")} style={{ ...iconBtn, opacity: isFirst ? 0.35 : 1 }}><ChevronUp size={13} /></button>
            <button title="Move down" disabled={isLast} onClick={() => actions.move(item.id, "down")} style={{ ...iconBtn, opacity: isLast ? 0.35 : 1 }}><ChevronDown size={13} /></button>
            <button title="Rename" onClick={() => { setDraft(item.name); setEditing(true); }} style={iconBtn}><Pencil size={13} /></button>
            <button title="Delete" onClick={() => actions.remove(item)} style={iconBtn}><Trash2 size={13} /></button>
          </div>
        )}
      </div>

      {expanded && kids.map((k, i) => (
        <OutlineNode key={k.id} item={k} childrenOf={childrenOf} depth={depth + 1} canEdit={canEdit} open={open} toggle={toggle} filter={filter}
          actions={actions} isFirst={i === 0} isLast={i === kids.length - 1} />
      ))}
      {expanded && adding && childLevel && (
        <AddRow indent={indent + 22} placeholder={`New ${LEVEL_LABEL[childLevel]} in "${item.name}"`} onAdd={(n) => actions.add(item.id, n)} onCancel={() => setAdding(false)} />
      )}
    </>
  );
}

function CurriculumDetail({ id, canEdit, onBack }: { id: string; canEdit: boolean; onBack: () => void }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const [addingChapter, setAddingChapter] = useState(false);
  const [importing, setImporting] = useState(false);
  const [editingBoard, setEditingBoard] = useState(false);
  const [board, setBoard] = useState("");
  const { boardOptions } = useLookups();

  const { data: c, isLoading } = useQuery({ queryKey: ["curriculum", id], queryFn: () => api.get(`${BASE}/${id}`).then((r) => r.data.data) });
  const items: Item[] = c?.items ?? [];

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["curriculum", id] });
    qc.invalidateQueries({ queryKey: ["curricula"] });
    qc.invalidateQueries({ queryKey: ["curriculum-outline"] });
  };

  // When filtering, keep rows that match and every ancestor of a match.
  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return null;
    const byId = new Map(items.map((i) => [i.id, i]));
    const keep = new Set<string>();
    for (const i of items) {
      if (!i.name.toLowerCase().includes(q)) continue;
      let cur: Item | undefined = i;
      while (cur) { keep.add(cur.id); cur = cur.parentId ? byId.get(cur.parentId) : undefined; }
    }
    return keep;
  }, [items, filter]);

  const childrenOf = (pid: string | null) => items
    .filter((i) => i.parentId === pid && (!visible || visible.has(i.id)))
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const chapters = childrenOf(null);
  const counts = { chapters: items.filter((i) => i.level === "CHAPTER").length, topics: items.filter((i) => i.level === "TOPIC").length, subtopics: items.filter((i) => i.level === "SUBTOPIC").length };

  const toggle = (iid: string) => setOpen((s) => { const n = new Set(s); if (n.has(iid)) n.delete(iid); else n.add(iid); return n; });

  const actions = {
    add: (parentId: string | null, name: string) => api.post(`${BASE}/${id}/items`, { parentId, name }).then(refresh, (e) => { toast.error(errMsg(e)); throw e; }),
    rename: (iid: string, name: string) => api.patch(`${BASE}/items/${iid}`, { name }).then(refresh, (e) => { toast.error(errMsg(e)); throw e; }),
    move: (iid: string, dir: "up" | "down") => { api.patch(`${BASE}/items/${iid}`, { move: dir }).then(refresh, (e) => toast.error(errMsg(e))); },
    remove: (item: Item) => {
      const under = items.filter((i) => i.parentId === item.id).length;
      if (!confirm(`Delete ${LEVEL_LABEL[item.level]} "${item.name}"${under ? " and everything under it" : ""}?`)) return;
      api.delete(`${BASE}/items/${item.id}`).then(refresh, (e) => toast.error(errMsg(e)));
    },
  };

  const metaMut = useMutation({
    mutationFn: (data: { board?: string; isActive?: boolean }) => api.patch(`${BASE}/${id}`, data),
    onSuccess: () => { setEditingBoard(false); refresh(); qc.invalidateQueries({ queryKey: ["curriculum-boards"] }); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const deleteMut = useMutation({
    mutationFn: () => api.delete(`${BASE}/${id}`),
    onSuccess: () => { toast.success("Curriculum deleted"); qc.invalidateQueries({ queryKey: ["curricula"] }); qc.invalidateQueries({ queryKey: ["curriculum-outline"] }); onBack(); },
    onError: (e) => toast.error(errMsg(e)),
  });

  if (isLoading || !c) return <div style={{ height: 200, borderRadius: 16, background: "#f0f2f8" }} />;
  const title = `${c.subject.name} · ${c.grade.name}`;

  return (
    <>
      <button onClick={onBack} style={{ ...ghostBtn, border: "none", padding: 0, height: "auto", background: "none", color: D.muted, marginBottom: 12 }}><ArrowLeft size={14} /> All curricula</button>

      <div className="flex flex-col sm:flex-row sm:items-start" style={{ justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: D.ink }}>{title}</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
            {editingBoard ? (
              <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input list="curriculum-boards-edit" autoFocus value={board} onChange={(e) => setBoard(e.target.value)} style={{ ...inputStyle, width: 160, minHeight: 32, padding: "5px 10px" }} />
                <datalist id="curriculum-boards-edit">{boardOptions.map((b) => <option key={b} value={b} />)}</datalist>
                <button onClick={() => board.trim() && metaMut.mutate({ board: board.trim() })} style={{ ...iconBtn, background: D.nav2, color: "#fff", border: "none" }}><Check size={13} /></button>
                <button onClick={() => setEditingBoard(false)} style={iconBtn}><X size={13} /></button>
              </span>
            ) : (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 20, background: D.accent, color: D.nav2, padding: "2px 10px", fontSize: 12, fontWeight: 600 }}>
                {c.board}
                {canEdit && <button title="Change board" onClick={() => { setBoard(c.board); setEditingBoard(true); }} style={{ border: "none", background: "none", padding: 0, cursor: "pointer", color: D.nav2, display: "flex" }}><Pencil size={11} /></button>}
              </span>
            )}
            <span style={{ fontSize: 12, color: D.muted }}>{counts.chapters} chapters · {counts.topics} topics · {counts.subtopics} subtopics</span>
            {canEdit ? (
              <button onClick={() => metaMut.mutate({ isActive: !c.isActive })} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 500, color: c.isActive ? "#16a34a" : D.muted, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                {c.isActive ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}{c.isActive ? "Active" : "Inactive"}
              </button>
            ) : !c.isActive && <span style={{ fontSize: 12, color: D.muted }}>Inactive</span>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => downloadFrom(`${BASE}/${id}/export`, `curriculum_${title.replace(/[^a-z0-9]+/gi, "_")}_${c.board.replace(/[^a-z0-9]+/gi, "_")}.xlsx`)} style={ghostBtn}><Download size={14} /> Export</button>
          {canEdit && <button onClick={() => setImporting(true)} style={ghostBtn}><Upload size={14} /> Import</button>}
          {canEdit && <button onClick={() => { if (confirm(`Delete the ${title} (${c.board}) curriculum and all ${items.length} rows?`)) deleteMut.mutate(); }} style={{ ...ghostBtn, color: "#b91c1c" }}><Trash2 size={14} /></button>}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row" style={{ gap: 8, marginBottom: 12 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: D.muted }} />
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search chapters, topics, subtopics…" style={{ ...inputStyle, paddingLeft: 32 }} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setOpen(new Set(items.filter((i) => i.level !== "SUBTOPIC").map((i) => i.id)))} style={ghostBtn}>Expand all</button>
          <button onClick={() => setOpen(new Set())} style={ghostBtn}>Collapse</button>
        </div>
      </div>

      <div style={{ borderRadius: 14, border: `1px solid ${D.line}`, background: "#fff", overflow: "hidden" }}>
        <div style={{ marginTop: -1 }}>
          {chapters.length === 0 && !addingChapter && (
            <p style={{ margin: 0, padding: "28px 16px", textAlign: "center", fontSize: 13, color: D.muted, borderTop: `1px solid ${D.line}` }}>
              {filter ? "Nothing matches that search." : "No chapters yet — add one below or import the template."}
            </p>
          )}
          {chapters.map((ch, i) => (
            <OutlineNode key={ch.id} item={ch} childrenOf={childrenOf} depth={0} canEdit={canEdit} open={open} toggle={toggle} filter={filter}
              actions={actions} isFirst={i === 0} isLast={i === chapters.length - 1} />
          ))}
        </div>
        {canEdit && (
          <div style={{ borderTop: `1px solid ${D.line}` }}>
            {addingChapter
              ? <AddRow indent={0} placeholder="New chapter name" onAdd={(n) => actions.add(null, n)} onCancel={() => setAddingChapter(false)} />
              : <button onClick={() => setAddingChapter(true)} style={{ width: "100%", padding: "10px 12px", border: "none", background: "none", textAlign: "left", fontSize: 13, fontWeight: 600, color: D.nav2, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}><Plus size={14} /> Add chapter</button>}
          </div>
        )}
      </div>

      {importing && (
        <ImportModal locked initial={{ subjectId: c.subject.id, gradeId: c.grade.id, board: c.board }} onClose={() => setImporting(false)} onDone={() => setImporting(false)} />
      )}
    </>
  );
}

// ── List ───────────────────────────────────────────────────────────────────────
export default function CurriculumTab({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [form, setForm] = useState<Target>({ subjectId: "", gradeId: "", board: "" });
  const [fSubject, setFSubject] = useState("");
  const [fGrade, setFGrade] = useState("");
  const [fBoard, setFBoard] = useState("");
  const [showInactive, setShowInactive] = useState(true);
  const { subjects, grades } = useLookups();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["curricula", showInactive],
    queryFn: () => api.get(`${BASE}?all=${showInactive}`).then((r) => r.data.data as CurriculumRow[]),
  });
  const createMut = useMutation({
    mutationFn: () => api.post(BASE, { ...form, board: form.board.trim() }),
    onSuccess: (res) => {
      toast.success("Curriculum created — add chapters or import a file");
      setAdding(false); setForm({ subjectId: "", gradeId: "", board: "" });
      qc.invalidateQueries({ queryKey: ["curricula"] }); qc.invalidateQueries({ queryKey: ["curriculum-boards"] });
      setOpenId(res.data.data.id);
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  if (openId) return <CurriculumDetail id={openId} canEdit={canEdit} onBack={() => setOpenId(null)} />;

  const boards = [...new Set(rows.map((r) => r.board))].sort();
  const filtered = rows.filter((r) => (!fSubject || r.subject.id === fSubject) && (!fGrade || r.grade.id === fGrade) && (!fBoard || r.board === fBoard));
  const totals = rows.reduce((t, r) => ({ topics: t.topics + r.counts.topics, subtopics: t.subtopics + r.counts.subtopics }), { topics: 0, subtopics: 0 });

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-start" style={{ justifyContent: "space-between", gap: 12, marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: D.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: D.nav2, flexShrink: 0 }}>CU</div>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: D.ink }}>Curriculum</h1>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: D.muted }}>Chapter, topic and subtopic lists by subject, grade and board — used when setting exams.</p>
          </div>
        </div>
        {canEdit && (
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button onClick={() => setImporting(true)} style={{ ...ghostBtn, height: 42, borderRadius: 12 }}><Upload size={14} /> Import</button>
            <button onClick={() => setAdding(true)} style={{ ...primaryBtn, height: 42, borderRadius: 12, padding: "0 20px" }}>+ New Curriculum</button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3" style={{ gap: 12, marginBottom: 20 }}>
        {([["Curricula", rows.length], ["Topics", totals.topics], ["Subtopics", totals.subtopics]] as const).map(([l, v]) => (
          <div key={l} style={{ background: "#fff", border: `1px solid ${D.line}`, borderRadius: 14, padding: "14px 18px" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: D.muted, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4 }}>{l}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: D.ink }}>{v.toLocaleString("en-IN")}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:flex" style={{ gap: 8, marginBottom: 16, alignItems: "center" }}>
        <Select value={fSubject} onChange={setFSubject} style={{ minWidth: 150 }}>
          <option value="">All subjects</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
        <Select value={fGrade} onChange={setFGrade} style={{ minWidth: 120 }}>
          <option value="">All grades</option>
          {grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </Select>
        <Select value={fBoard} onChange={setFBoard} style={{ minWidth: 130 }}>
          <option value="">All boards</option>
          {boards.map((b) => <option key={b} value={b}>{b}</option>)}
        </Select>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 500, color: D.muted, cursor: "pointer", whiteSpace: "nowrap" }}>
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} style={{ accentColor: D.nav2 }} />
          Show inactive
        </label>
      </div>

      {adding && (
        <div style={{ borderRadius: 14, border: `1px solid ${D.accent}`, background: "#f8f9ff", padding: 16, marginBottom: 16 }}>
          <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 600, color: D.nav2 }}>New Curriculum</p>
          <TargetFields value={form} onChange={setForm} />
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginTop: 12 }}>
            <button onClick={() => setAdding(false)} style={ghostBtn}>Cancel</button>
            <button onClick={() => createMut.mutate()} disabled={!form.subjectId || !form.gradeId || !form.board.trim() || createMut.isPending}
              style={{ ...primaryBtn, opacity: !form.subjectId || !form.gradeId || !form.board.trim() || createMut.isPending ? 0.5 : 1 }}>Create</button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{[1, 2, 3].map((i) => <div key={i} style={{ height: 48, borderRadius: 12, background: "#f0f2f8" }} />)}</div>
      ) : filtered.length === 0 ? (
        <div style={{ borderRadius: 16, border: `1px dashed ${D.line}`, background: "#fff", padding: "48px 24px", textAlign: "center" }}>
          <h3 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 700, color: D.ink }}>{rows.length ? "No curriculum matches these filters" : "No curricula yet"}</h3>
          <p style={{ margin: 0, fontSize: 13, color: D.muted }}>Create one for a subject, grade and board, then add chapters by hand or import the Excel template.</p>
        </div>
      ) : (
        <div style={{ borderRadius: 16, border: `1px solid ${D.line}`, overflow: "hidden", background: "#fff" }}>
          {/* Table on wide screens, stacked cards on phones */}
          <table className="hidden sm:table" style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
            <thead style={{ background: D.bg, borderBottom: `1px solid ${D.line}` }}>
              <tr>{["Subject", "Grade", "Board", "Chapters", "Topics", "Subtopics", "Status", ""].map((h) => <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 600, color: D.muted, textTransform: "uppercase", letterSpacing: ".05em" }}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} onClick={() => setOpenId(r.id)} className="hover:bg-slate-50" style={{ borderTop: `1px solid ${D.line}`, cursor: "pointer", opacity: r.isActive ? 1 : 0.6 }}>
                  <td style={{ padding: "12px 16px", fontWeight: 600, color: D.ink }}>{r.subject.name}</td>
                  <td style={{ padding: "12px 16px" }}>{r.grade.name}</td>
                  <td style={{ padding: "12px 16px" }}><span style={{ borderRadius: 20, background: D.accent, color: D.nav2, padding: "2px 10px", fontSize: 12, fontWeight: 600 }}>{r.board}</span></td>
                  <td style={{ padding: "12px 16px", color: D.muted }}>{r.counts.chapters}</td>
                  <td style={{ padding: "12px 16px", color: D.muted }}>{r.counts.topics}</td>
                  <td style={{ padding: "12px 16px", color: D.muted }}>{r.counts.subtopics}</td>
                  <td style={{ padding: "12px 16px", fontSize: 12, color: r.isActive ? "#16a34a" : D.muted }}>{r.isActive ? "Active" : "Inactive"}</td>
                  <td style={{ padding: "12px 16px", textAlign: "right", color: D.muted }}><ChevronRight size={15} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="sm:hidden">
            {filtered.map((r, i) => (
              <button key={r.id} onClick={() => setOpenId(r.id)} style={{ display: "flex", width: "100%", alignItems: "center", gap: 10, padding: "12px 14px", border: "none", borderTop: i ? `1px solid ${D.line}` : "none", background: "#fff", textAlign: "left", opacity: r.isActive ? 1 : 0.6 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: D.ink }}>{r.subject.name} · {r.grade.name} <span style={{ marginLeft: 4, borderRadius: 20, background: D.accent, color: D.nav2, padding: "1px 8px", fontSize: 11 }}>{r.board}</span></p>
                  <p style={{ margin: "3px 0 0", fontSize: 12, color: D.muted }}>{r.counts.chapters} chapters · {r.counts.topics} topics · {r.counts.subtopics} subtopics{r.isActive ? "" : " · Inactive"}</p>
                </div>
                <ChevronRight size={16} style={{ color: D.muted }} />
              </button>
            ))}
          </div>
        </div>
      )}

      {importing && (
        <ImportModal initial={{ subjectId: fSubject, gradeId: fGrade, board: fBoard }} onClose={() => setImporting(false)} onDone={(id) => { setImporting(false); setOpenId(id); }} />
      )}
    </>
  );
}
