"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, ChevronDown, Copy, Save, Users, Layers, Info, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import {
  ExamsHeader, AccessDenied, Select, Field, PersonPicker, inputCls, btnPrimary, btnSecondary, btnDanger,
  apiError, personName, useExamMe, Modal, Chip, OWNER_ROLE_LABEL, TEAM_ROLE_LABEL, CollapsibleCard, type Person, type OwnerRole, type TeamRole,
} from "@/components/exams/shared";
import { Notice } from "@/components/exams/StageDialogs";

type TeamMember = { id: string; role: TeamRole; employee: Person };
type StageDef = {
  sequenceNo: number; name: string; description: string | null; offsetDays: number;
  ownerRole: OwnerRole; scope: "EXAM" | "SUBJECT"; mode: "PEN_PAPER" | "ONLINE" | null;
  action: "NOTIFY_STUDENTS" | "RELEASE_RESULTS" | null; canBypass: boolean;
  approver: "SUBJECT_HEAD" | "CONTROLLER" | null; form: "BLUEPRINT" | null;
};
type ExamType = {
  id: string; academicYear: string; name: string; description: string | null; isActive: boolean;
  stages: StageDef[]; _count: { exams: number };
};

export default function ExamSettingsPage() {
  const { data: me, isLoading } = useExamMe();
  if (isLoading) return null;
  if (!me?.canViewBoard) return <AccessDenied message="Exam settings are for the exam team and Super Admins." />;
  const canEdit = me.canManageSettings;

  return (
    <div className="space-y-4">
      <ExamsHeader
        title="Exam Settings"
        subtitle={canEdit
          ? "Who runs exams, which exam types exist each academic year, and the stages and timings each type follows."
          : "Read-only — only a Super Admin can change these."}
      />
      <TeamSection canEdit={canEdit} />
      <SubjectHeadsSection canEdit={canEdit} />
      <TypesSection canEdit={canEdit} />
    </div>
  );
}

// ─── Team ─────────────────────────────────────────────────────────────────────

function TeamSection({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const { data: team = [] } = useQuery<TeamMember[]>({
    queryKey: ["exam-team"],
    queryFn: () => api.get("/api/v1/exams/settings/team").then((r) => r.data.data),
  });
  const [person, setPerson] = useState<Person | null>(null);
  const [role, setRole] = useState<TeamRole>("CONTROLLER");
  const [err, setErr] = useState<string | null>(null);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["exam-team"] }); qc.invalidateQueries({ queryKey: ["exam-me"] }); };

  const add = async () => {
    if (!person) return;
    setErr(null);
    try {
      await api.post("/api/v1/exams/settings/team", { employeeId: person.id, role });
      setPerson(null); refresh();
    } catch (e) { setErr(apiError(e)); }
  };
  const remove = async (m: TeamMember) => {
    if (!confirm(`Remove ${personName(m.employee)} from the exam team? Stages they already own stay with them.`)) return;
    try { await api.delete(`/api/v1/exams/settings/team/${m.id}`); refresh(); } catch (e) { setErr(apiError(e)); }
  };

  return (
    <CollapsibleCard id="settings-team" icon={Users} title="Exam team"
      summary={team.length === 0 ? "No one yet" : team.map((m) => `${personName(m.employee)} (${m.role === "CONTROLLER" ? "Controller" : m.role === "EXECUTIVE" ? "Executive" : "Viewer"})`).join(" · ")}>
      <div className="space-y-4">
        <p className="text-xs text-gray-500">
          Controllers and Executives run exams: they see the Exam Board and set up exams. Viewers see the board and every exam but can&apos;t change anything.
          Faculty who set and review papers don&apos;t need to be here — they&apos;re picked per exam and see their work under My Tasks.
          To give a whole role read-only or setup access, use Administration → Roles &amp; Permissions → Examinations.
        </p>
        {team.length === 0 ? (
          <p className="text-sm text-gray-400">No one on the exam team yet.</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {team.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{personName(m.employee)} <span className="text-gray-400 font-normal">· {m.employee.employeeCode}</span></p>
                  <Chip className={m.role === "CONTROLLER" ? "bg-indigo-50 text-indigo-700" : m.role === "EXECUTIVE" ? "bg-sky-50 text-sky-700" : "bg-gray-100 text-gray-600"}>{TEAM_ROLE_LABEL[m.role]}</Chip>
                </div>
                {canEdit && <button className="text-gray-400 hover:text-red-600 p-1" onClick={() => remove(m)} aria-label="Remove"><Trash2 className="h-4 w-4" /></button>}
              </li>
            ))}
          </ul>
        )}
        {canEdit && (
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_16rem_auto] gap-2 items-end">
            <Field label="Add person"><PersonPicker value={person} onChange={setPerson} /></Field>
            <Field label="Role">
              <Select value={role} onChange={(e) => setRole(e.target.value as any)}>
                <option value="CONTROLLER">{TEAM_ROLE_LABEL.CONTROLLER}</option>
                <option value="EXECUTIVE">{TEAM_ROLE_LABEL.EXECUTIVE}</option>
                <option value="VIEWER">{TEAM_ROLE_LABEL.VIEWER}</option>
              </Select>
            </Field>
            <button className={btnPrimary} onClick={add} disabled={!person}><Plus className="h-4 w-4" /> Add</button>
          </div>
        )}
        {err && <p className="text-sm text-red-600">{err}</p>}
      </div>
    </CollapsibleCard>
  );
}

// ─── Subject heads ────────────────────────────────────────────────────────────

type SubjectHead = { id: string; code: string; name: string; head: Person | null };

function SubjectHeadsSection({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const { data: subjects = [], isLoading } = useQuery<SubjectHead[]>({
    queryKey: ["exam-subject-heads"],
    queryFn: () => api.get("/api/v1/exams/settings/subject-heads").then((r) => r.data.data),
  });
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const setHead = async (subjectId: string, head: Person | null) => {
    setErr(null); setSaving(subjectId);
    try {
      await api.put(`/api/v1/exams/settings/subject-heads/${subjectId}`, { headId: head?.id ?? null });
      qc.invalidateQueries({ queryKey: ["exam-subject-heads"] });
      qc.invalidateQueries({ queryKey: ["exam-detail"] });
    } catch (e) { setErr(apiError(e)); } finally { setSaving(null); }
  };

  return (
    <CollapsibleCard id="settings-heads" icon={ShieldCheck} title="Subject heads"
      summary={isLoading ? undefined : `${subjects.filter((x) => x.head).length} of ${subjects.length} subjects have a head`}>
      <div className="space-y-3">
        <p className="text-xs text-gray-500">
          The subject head (HoD) approves each exam&apos;s blueprint for their subject. An exam can name a different approver for a paper in its setup.
          With no head set, the exam&apos;s Controller approves. Nobody approves their own blueprint: if the head set the paper, it goes to the Controller.
        </p>
        {isLoading ? <p className="text-sm text-gray-400">Loading…</p>
          : subjects.length === 0 ? <p className="text-sm text-gray-400">No active subjects.</p>
          : (
            <ul className="divide-y divide-gray-50">
              {subjects.map((sub) => (
                <li key={sub.id} className="grid grid-cols-1 sm:grid-cols-[12rem_1fr] gap-2 py-2.5 sm:items-center">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{sub.name}</p>
                    <p className="text-[11px] text-gray-400">{sub.code}</p>
                  </div>
                  {canEdit ? (
                    <div className={saving === sub.id ? "opacity-60 pointer-events-none" : ""}>
                      <PersonPicker value={sub.head} onChange={(p) => setHead(sub.id, p)} />
                    </div>
                  ) : (
                    <p className={`text-sm ${sub.head ? "text-gray-800" : "text-gray-400"}`}>{sub.head ? personName(sub.head) : "Not set (Controller approves)"}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        {err && <p className="text-sm text-red-600">{err}</p>}
      </div>
    </CollapsibleCard>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

function TypesSection({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const { data: years = [] } = useQuery<{ id: string; name: string; isActive: boolean }[]>({
    queryKey: ["exam-academic-years"],
    queryFn: () => api.get("/api/v1/exams/settings/academic-years").then((r) => r.data.data),
  });
  const [year, setYear] = useState("");
  useEffect(() => {
    if (!year && years.length) setYear((years.find((y) => y.isActive) ?? years[0]).name);
  }, [years, year]);

  const { data: types = [], isLoading } = useQuery<ExamType[]>({
    queryKey: ["exam-types", year],
    queryFn: () => api.get("/api/v1/exams/settings/types", { params: { academicYear: year } }).then((r) => r.data.data),
    enabled: !!year,
  });
  const [creating, setCreating] = useState(false);
  const [copying, setCopying] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ["exam-types"] });

  return (
    <CollapsibleCard id="settings-types" icon={Layers} title="Exam types & timings" defaultOpen
      summary={year ? `${year}: ${types.length} type${types.length === 1 ? "" : "s"}` : undefined}>
        <div className="flex flex-wrap gap-2">
          <div className="w-full sm:w-44">
            <Select value={year} onChange={(e) => setYear(e.target.value)}>
              {years.map((y) => <option key={y.id} value={y.name}>{y.name}</option>)}
            </Select>
          </div>
          {canEdit && year && <>
            <button className={`${btnSecondary} flex-1 sm:flex-none`} onClick={() => setCopying(true)}><Copy className="h-4 w-4" /> Copy from year</button>
            <button className={`${btnPrimary} flex-1 sm:flex-none`} onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New type</button>
          </>}
        </div>
      <div className="space-y-2">
        <p className="text-xs text-gray-500">
          Offsets count days from the exam date: −14 means two weeks before, +4 means four days after. A deadline that lands on a Sunday
          or holiday moves to the working day before. Changing a type affects exams set up from now on; exams already set up keep their stages.
        </p>
        {isLoading ? <p className="text-sm text-gray-400">Loading…</p>
          : types.length === 0 ? <p className="text-sm text-gray-400">No exam types for {year || "this year"} yet.</p>
          : types.map((t) => <TypeCard key={t.id} type={t} canEdit={canEdit} onChanged={refresh} />)}
      </div>

      {creating && <NewTypeDialog year={year} types={types} onClose={() => setCreating(false)} onCreated={() => { setCreating(false); refresh(); }} />}
      {copying && <CopyYearDialog toYear={year} years={years.map((y) => y.name)} onClose={() => setCopying(false)} onCopied={() => { setCopying(false); refresh(); }} />}
    </CollapsibleCard>
  );
}

function NewTypeDialog({ year, types, onClose, onCreated }: { year: string; types: ExamType[]; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [copyFrom, setCopyFrom] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    setSaving(true); setErr(null);
    try {
      await api.post("/api/v1/exams/settings/types", { academicYear: year, name, description: description || null, copyFromTypeId: copyFrom || undefined });
      onCreated();
    } catch (e) { setErr(apiError(e)); } finally { setSaving(false); }
  };
  return (
    <Modal title={`New exam type · ${year}`} onClose={onClose} footer={<>
      <button className={btnSecondary} onClick={onClose}>Cancel</button>
      <button className={btnPrimary} onClick={submit} disabled={saving || !name.trim()}>{saving ? "Creating…" : "Create"}</button>
    </>}>
      <Field label="Name"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Weekly Test, Term Exam, Full Mock" /></Field>
      <Field label="Description (optional)"><input className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
      <Field label="Start from" hint="You can edit every stage after creating it.">
        <Select value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)}>
          <option value="">Standard exam cycle (16 stages)</option>
          {types.map((t) => <option key={t.id} value={t.id}>Copy of {t.name}</option>)}
        </Select>
      </Field>
      {err && <p className="text-sm text-red-600">{err}</p>}
    </Modal>
  );
}

function CopyYearDialog({ toYear, years, onClose, onCopied }: { toYear: string; years: string[]; onClose: () => void; onCopied: () => void }) {
  const others = years.filter((y) => y !== toYear);
  const [fromYear, setFromYear] = useState(others[0] ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    setSaving(true); setErr(null);
    try {
      const r = await api.post("/api/v1/exams/settings/types/copy-year", { fromYear, toYear });
      const d = r.data.data;
      alert(`Copied ${d.copied} type(s)${d.skipped ? `; ${d.skipped} skipped because ${toYear} already has a type with that name` : ""}.`);
      onCopied();
    } catch (e) { setErr(apiError(e)); } finally { setSaving(false); }
  };
  return (
    <Modal title={`Copy exam types into ${toYear}`} onClose={onClose} footer={<>
      <button className={btnSecondary} onClick={onClose}>Cancel</button>
      <button className={btnPrimary} onClick={submit} disabled={saving || !fromYear}>{saving ? "Copying…" : "Copy"}</button>
    </>}>
      {others.length === 0 ? <p className="text-sm text-gray-500">There is no other academic year to copy from.</p> : (
        <Field label="Copy every type, with its stages, from">
          <Select value={fromYear} onChange={(e) => setFromYear(e.target.value)}>
            {others.map((y) => <option key={y} value={y}>{y}</option>)}
          </Select>
        </Field>
      )}
      {err && <p className="text-sm text-red-600">{err}</p>}
    </Modal>
  );
}

const fmtOffset = (n: number) => (n === 0 ? "Exam day" : n < 0 ? `${-n} day${n === -1 ? "" : "s"} before` : `${n} day${n === 1 ? "" : "s"} after`);

/** A stage being edited, with a stable key so rows keep their open state while steps are renumbered. */
type Draft = StageDef & { _k: string };
let keySeq = 0;
const withKeys = (list: StageDef[]): Draft[] => list.map((s) => ({ ...s, _k: `k${++keySeq}` }));

function TypeCard({ type: t, canEdit, onChanged }: { type: ExamType; canEdit: boolean; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [stages, setStages] = useState<Draft[]>(() => withKeys(t.stages));
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { setStages(withKeys(t.stages)); setDirty(false); setExpanded(new Set()); }, [t.stages]);

  const update = (k: string, patch: Partial<StageDef>) => { setStages((s) => s.map((x) => (x._k === k ? { ...x, ...patch } : x))); setDirty(true); };
  const removeRow = (k: string) => { setStages((s) => s.filter((x) => x._k !== k)); setDirty(true); };
  const toggleRow = (k: string) => setExpanded((e) => { const n = new Set(e); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const addRow = () => {
    const next = Math.max(0, ...stages.map((s) => s.sequenceNo)) + 1;
    const row = withKeys([{ sequenceNo: next, name: "", description: null, offsetDays: 0, ownerRole: "EXECUTIVE", scope: "EXAM", mode: null, action: null, canBypass: false, approver: null, form: null }])[0];
    setStages((s) => [...s, row]);
    setExpanded((e) => new Set(e).add(row._k));
    setDirty(true);
  };
  const save = async () => {
    setSaving(true); setErr(null);
    try {
      const clean = [...stages].sort((a, b) => a.sequenceNo - b.sequenceNo).map(({ _k, ...rest }) => rest);
      await api.put(`/api/v1/exams/settings/types/${t.id}/stages`, { stages: clean });
      setDirty(false); onChanged();
    } catch (e) { setErr(apiError(e)); } finally { setSaving(false); }
  };
  const discard = () => { setStages(withKeys(t.stages)); setDirty(false); setErr(null); };
  const toggleActive = async () => {
    try { await api.patch(`/api/v1/exams/settings/types/${t.id}`, { isActive: !t.isActive }); onChanged(); } catch (e) { setErr(apiError(e)); }
  };
  const del = async () => {
    if (!confirm(`Delete exam type "${t.name}"?`)) return;
    try { await api.delete(`/api/v1/exams/settings/types/${t.id}`); onChanged(); } catch (e) { setErr(apiError(e)); }
  };

  const hasRelease = stages.some((s) => s.action === "RELEASE_RESULTS");
  const sorted = [...stages].sort((a, b) => a.sequenceNo - b.sequenceNo);
  const allOpen = sorted.length > 0 && sorted.every((s) => expanded.has(s._k));

  return (
    <div className="rounded-xl border border-gray-100">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 active:bg-gray-100 rounded-xl">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-gray-900">{t.name}</p>
            {!t.isActive && <Chip className="bg-gray-100 text-gray-500">Inactive</Chip>}
            {dirty && <Chip className="bg-amber-50 text-amber-700">Unsaved changes</Chip>}
          </div>
          <p className="text-xs text-gray-500">{t.stages.length} stages · used by {t._count.exams} exam{t._count.exams === 1 ? "" : "s"}{t.description ? ` · ${t.description}` : ""}</p>
        </div>
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="px-3 pb-3 sm:px-4 sm:pb-4 space-y-3">
          {!hasRelease && (
            <Notice icon={Info} tone="amber">This type has no “release results” stage, so marks on its exams show to students as soon as they&apos;re entered.</Notice>
          )}
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-gray-500">Tap a stage to {canEdit ? "edit" : "see"} it.</p>
            <button className="text-xs font-semibold text-[#2C3E7C] hover:underline"
              onClick={() => setExpanded(allOpen ? new Set() : new Set(sorted.map((s) => s._k)))}>
              {allOpen ? "Collapse all" : "Expand all"}
            </button>
          </div>
          <ol className="rounded-xl border border-gray-100 divide-y divide-gray-100 overflow-hidden">
            {sorted.map((s) => (
              <StageEditorRow key={s._k} stage={s} open={expanded.has(s._k)} canEdit={canEdit}
                onToggle={() => toggleRow(s._k)} onChange={(patch) => update(s._k, patch)} onRemove={() => removeRow(s._k)} />
            ))}
          </ol>
          {err && <p className="text-sm text-red-600">{err}</p>}
          {canEdit && (
            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2">
                <button className={btnSecondary} onClick={addRow}><Plus className="h-4 w-4" /> Add stage</button>
                <button className={btnSecondary} onClick={toggleActive}>{t.isActive ? "Deactivate" : "Activate"}</button>
                {t._count.exams === 0 && <button className={btnDanger} onClick={del} aria-label="Delete type"><Trash2 className="h-4 w-4" /></button>}
              </div>
              <div className="flex gap-2">
                {dirty && <button className={btnSecondary} onClick={discard}>Discard</button>}
                <button className={btnPrimary} onClick={save} disabled={!dirty || saving}><Save className="h-4 w-4" /> {saving ? "Saving…" : "Save stages"}</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const SHORT_ROLE: Record<OwnerRole, string> = { CONTROLLER: "Controller", EXECUTIVE: "Executive", PAPER_SETTER: "Paper setter", REVIEWER: "Reviewer" };

/** One stage: a single summary line, expanding into its settings. */
function StageEditorRow({ stage: s, open, canEdit, onToggle, onChange, onRemove }: {
  stage: Draft; open: boolean; canEdit: boolean; onToggle: () => void; onChange: (p: Partial<StageDef>) => void; onRemove: () => void;
}) {
  const chips: [string, string][] = [];
  if (s.approver) chips.push([s.approver === "SUBJECT_HEAD" ? "HoD approves" : "Controller approves", "bg-violet-50 text-violet-700"]);
  if (s.form === "BLUEPRINT") chips.push(["Blueprint form", "bg-indigo-50 text-indigo-700"]);
  if (s.action === "NOTIFY_STUDENTS") chips.push(["Emails students", "bg-blue-50 text-blue-700"]);
  if (s.action === "RELEASE_RESULTS") chips.push(["Releases results", "bg-emerald-50 text-emerald-700"]);
  if (s.mode) chips.push([s.mode === "ONLINE" ? "Online only" : "Pen & paper only", "bg-gray-100 text-gray-600"]);
  if (s.canBypass) chips.push(["Can bypass", "bg-gray-100 text-gray-600"]);
  const paperRole = s.ownerRole === "PAPER_SETTER" || s.ownerRole === "REVIEWER";

  return (
    <li className={open ? "bg-gray-50/60" : "bg-white"}>
      <button type="button" onClick={onToggle} aria-expanded={open}
        className="w-full flex items-start sm:items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 active:bg-gray-100">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[11px] font-bold text-gray-600">{s.sequenceNo}</span>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium truncate ${s.name ? "text-gray-900" : "text-gray-400 italic"}`}>{s.name || "Untitled stage"}</p>
          <p className="text-xs text-gray-500">{fmtOffset(s.offsetDays)} · {SHORT_ROLE[s.ownerRole]}{s.scope === "SUBJECT" ? " · per subject" : ""}</p>
        </div>
        {chips.length > 0 && (
          <div className="hidden md:flex flex-wrap justify-end gap-1 max-w-[50%]">
            {chips.map(([label, cls]) => <Chip key={label} className={cls}>{label}</Chip>)}
          </div>
        )}
        <ChevronDown className={`h-4 w-4 mt-1 sm:mt-0 text-gray-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {!open && chips.length > 0 && (
        <div className="md:hidden flex flex-wrap gap-1 px-3 pb-2.5 pl-12 -mt-1">
          {chips.map(([label, cls]) => <Chip key={label} className={cls}>{label}</Chip>)}
        </div>
      )}

      {open && (
        <div className="px-3 pb-3 pl-3 sm:pl-12 space-y-4">
          <FieldGroup title="Basics">
            <div className="sm:col-span-2">
              <Field label="Stage name"><input className={inputCls} disabled={!canEdit} value={s.name} onChange={(e) => onChange({ name: e.target.value })} /></Field>
            </div>
            <Field label="Step"><input type="number" className={inputCls} disabled={!canEdit} value={s.sequenceNo} onChange={(e) => onChange({ sequenceNo: parseInt(e.target.value) || 0 })} /></Field>
            <Field label="Due (days from exam)" hint={fmtOffset(s.offsetDays)}>
              <input type="number" className={inputCls} disabled={!canEdit} value={s.offsetDays} onChange={(e) => onChange({ offsetDays: parseInt(e.target.value) || 0 })} />
            </Field>
            <Field label="Owner">
              <Select disabled={!canEdit} value={s.ownerRole} onChange={(e) => {
                const ownerRole = e.target.value as OwnerRole;
                onChange({ ownerRole, ...(ownerRole === "PAPER_SETTER" || ownerRole === "REVIEWER" ? { scope: "SUBJECT" as const } : {}) });
              }}>
                {(Object.keys(OWNER_ROLE_LABEL) as OwnerRole[]).map((r) => <option key={r} value={r}>{OWNER_ROLE_LABEL[r]}</option>)}
              </Select>
            </Field>
            <Field label="Applies to">
              <Select disabled={!canEdit} value={s.scope} onChange={(e) => onChange({ scope: e.target.value as StageDef["scope"] })}>
                <option value="EXAM" disabled={paperRole || s.form === "BLUEPRINT" || s.approver === "SUBJECT_HEAD"}>Whole exam</option>
                <option value="SUBJECT">Each paper/subject</option>
              </Select>
            </Field>
          </FieldGroup>

          <FieldGroup title="Sign-off">
            <Field label="Approved by" hint={s.approver ? "Owner submits; approval closes it" : "Owner marks it done"}>
              <Select disabled={!canEdit} value={s.approver ?? ""} onChange={(e) => {
                const approver = (e.target.value || null) as StageDef["approver"];
                onChange({ approver, ...(approver === "SUBJECT_HEAD" ? { scope: "SUBJECT" as const } : {}), ...(!approver ? { form: null } : {}) });
              }}>
                <option value="">No approval</option>
                <option value="SUBJECT_HEAD">Subject head (HoD)</option>
                <option value="CONTROLLER">Controller of Examinations</option>
              </Select>
            </Field>
            <Field label="Form to fill">
              <Select disabled={!canEdit} value={s.form ?? ""} onChange={(e) => {
                const form = (e.target.value || null) as StageDef["form"];
                onChange({ form, ...(form === "BLUEPRINT" ? { scope: "SUBJECT" as const, approver: s.approver ?? "SUBJECT_HEAD" } : {}) });
              }}>
                <option value="">None</option>
                <option value="BLUEPRINT">Blueprint</option>
              </Select>
            </Field>
            <Field label="When done">
              <Select disabled={!canEdit} value={s.action ?? ""} onChange={(e) => onChange({ action: (e.target.value || null) as StageDef["action"], ...(e.target.value ? { canBypass: false } : {}) })}>
                <option value="">Nothing extra</option>
                <option value="NOTIFY_STUDENTS">Email exam notice</option>
                <option value="RELEASE_RESULTS">Release results</option>
              </Select>
            </Field>
            <Field label="Mode">
              <Select disabled={!canEdit} value={s.mode ?? ""} onChange={(e) => onChange({ mode: (e.target.value || null) as StageDef["mode"] })}>
                <option value="">Both modes</option>
                <option value="PEN_PAPER">Pen &amp; paper only</option>
                <option value="ONLINE">Online only</option>
              </Select>
            </Field>
            <label className="sm:col-span-2 flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" className="h-4 w-4" disabled={!canEdit || !!s.action} checked={s.canBypass} onChange={(e) => onChange({ canBypass: e.target.checked })} />
              Controller can bypass this stage with a reason
            </label>
          </FieldGroup>

          <Field label="Instructions for the owner">
            <textarea className={`${inputCls} min-h-[64px]`} disabled={!canEdit} value={s.description ?? ""} onChange={(e) => onChange({ description: e.target.value || null })} />
          </Field>

          {canEdit && (
            <div className="flex justify-end">
              <button className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-red-600" onClick={onRemove}><Trash2 className="h-3.5 w-3.5" /> Remove stage</button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2">{title}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">{children}</div>
    </div>
  );
}
