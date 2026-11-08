"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, ChevronDown, Copy, Save, Users, Layers, Info, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import {
  ExamsHeader, AccessDenied, Select, Field, PersonPicker, inputCls, btnPrimary, btnSecondary, btnDanger,
  apiError, personName, useExamMe, Modal, Chip, OWNER_ROLE_LABEL, type Person, type OwnerRole,
} from "@/components/exams/shared";
import { Notice } from "@/components/exams/StageDialogs";

type TeamMember = { id: string; role: "CONTROLLER" | "EXECUTIVE"; employee: Person };
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
    <div className="space-y-6">
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
  const [role, setRole] = useState<"CONTROLLER" | "EXECUTIVE">("CONTROLLER");
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
    <section className="rounded-2xl border border-gray-100 bg-white">
      <div className="px-4 py-3 sm:px-6 border-b border-gray-100 flex items-center gap-2">
        <Users className="h-4 w-4 text-gray-400" />
        <h2 className="text-base font-semibold text-gray-900">Exam team</h2>
      </div>
      <div className="px-4 py-4 sm:px-6 space-y-4">
        <p className="text-xs text-gray-500">
          Team members see the Exam Board and can set up exams. Faculty who set and review papers don&apos;t need to be here — they&apos;re picked per exam and see their work under My Tasks.
        </p>
        {team.length === 0 ? (
          <p className="text-sm text-gray-400">No one on the exam team yet.</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {team.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{personName(m.employee)} <span className="text-gray-400 font-normal">· {m.employee.employeeCode}</span></p>
                  <Chip className={m.role === "CONTROLLER" ? "bg-indigo-50 text-indigo-700" : "bg-sky-50 text-sky-700"}>{OWNER_ROLE_LABEL[m.role]}</Chip>
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
                <option value="CONTROLLER">{OWNER_ROLE_LABEL.CONTROLLER}</option>
                <option value="EXECUTIVE">{OWNER_ROLE_LABEL.EXECUTIVE}</option>
              </Select>
            </Field>
            <button className={btnPrimary} onClick={add} disabled={!person}><Plus className="h-4 w-4" /> Add</button>
          </div>
        )}
        {err && <p className="text-sm text-red-600">{err}</p>}
      </div>
    </section>
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
    <section className="rounded-2xl border border-gray-100 bg-white">
      <div className="px-4 py-3 sm:px-6 border-b border-gray-100 flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-gray-400" />
        <h2 className="text-base font-semibold text-gray-900">Subject heads</h2>
      </div>
      <div className="px-4 py-4 sm:px-6 space-y-3">
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
    </section>
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
    <section className="rounded-2xl border border-gray-100 bg-white">
      <div className="px-4 py-3 sm:px-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2 flex-1">
          <Layers className="h-4 w-4 text-gray-400" />
          <h2 className="text-base font-semibold text-gray-900">Exam types & timings</h2>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="sm:w-44">
            <Select value={year} onChange={(e) => setYear(e.target.value)}>
              {years.map((y) => <option key={y.id} value={y.name}>{y.name}</option>)}
            </Select>
          </div>
          {canEdit && year && <>
            <button className={btnSecondary} onClick={() => setCopying(true)}><Copy className="h-4 w-4" /> Copy from year</button>
            <button className={btnPrimary} onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New type</button>
          </>}
        </div>
      </div>
      <div className="px-4 py-4 sm:px-6 space-y-3">
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
    </section>
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

function TypeCard({ type: t, canEdit, onChanged }: { type: ExamType; canEdit: boolean; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [stages, setStages] = useState<StageDef[]>(t.stages);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { setStages(t.stages); setDirty(false); }, [t.stages]);

  const update = (i: number, patch: Partial<StageDef>) => { setStages((s) => s.map((x, j) => (j === i ? { ...x, ...patch } : x))); setDirty(true); };
  const removeRow = (i: number) => { setStages((s) => s.filter((_, j) => j !== i)); setDirty(true); };
  const addRow = () => {
    const next = Math.max(0, ...stages.map((s) => s.sequenceNo)) + 1;
    setStages((s) => [...s, { sequenceNo: next, name: "", description: null, offsetDays: 0, ownerRole: "EXECUTIVE", scope: "EXAM", mode: null, action: null, canBypass: false, approver: null, form: null }]);
    setDirty(true);
  };
  const save = async () => {
    setSaving(true); setErr(null);
    try {
      await api.put(`/api/v1/exams/settings/types/${t.id}/stages`, { stages: [...stages].sort((a, b) => a.sequenceNo - b.sequenceNo) });
      setDirty(false); onChanged();
    } catch (e) { setErr(apiError(e)); } finally { setSaving(false); }
  };
  const toggleActive = async () => {
    try { await api.patch(`/api/v1/exams/settings/types/${t.id}`, { isActive: !t.isActive }); onChanged(); } catch (e) { setErr(apiError(e)); }
  };
  const del = async () => {
    if (!confirm(`Delete exam type "${t.name}"?`)) return;
    try { await api.delete(`/api/v1/exams/settings/types/${t.id}`); onChanged(); } catch (e) { setErr(apiError(e)); }
  };

  const hasRelease = stages.some((s) => s.action === "RELEASE_RESULTS");
  const sorted = [...stages].map((s, i) => ({ s, i })).sort((a, b) => a.s.sequenceNo - b.s.sequenceNo);

  return (
    <div className="rounded-xl border border-gray-100">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 active:bg-gray-100 rounded-xl">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-gray-900">{t.name}</p>
            {!t.isActive && <Chip className="bg-gray-100 text-gray-500">Inactive</Chip>}
          </div>
          <p className="text-xs text-gray-500">{t.stages.length} stages · used by {t._count.exams} exam{t._count.exams === 1 ? "" : "s"}{t.description ? ` · ${t.description}` : ""}</p>
        </div>
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {!hasRelease && (
            <Notice icon={Info} tone="amber">This type has no “release results” stage, so marks on its exams show to students as soon as they&apos;re entered.</Notice>
          )}
          <div className="space-y-2">
            {sorted.map(({ s, i }) => (
              <div key={i} className="rounded-xl border border-gray-100 bg-gray-50/50 p-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2">
                  <Field label="Step">
                    <input type="number" className={inputCls} disabled={!canEdit} value={s.sequenceNo} onChange={(e) => update(i, { sequenceNo: parseInt(e.target.value) || 0 })} />
                  </Field>
                  <div className="lg:col-span-4">
                    <Field label="Stage">
                      <input className={inputCls} disabled={!canEdit} value={s.name} onChange={(e) => update(i, { name: e.target.value })} />
                    </Field>
                  </div>
                  <div className="lg:col-span-2">
                    <Field label="Offset (days)" hint={fmtOffset(s.offsetDays)}>
                      <input type="number" className={inputCls} disabled={!canEdit} value={s.offsetDays} onChange={(e) => update(i, { offsetDays: parseInt(e.target.value) || 0 })} />
                    </Field>
                  </div>
                  <div className="lg:col-span-3">
                    <Field label="Owner">
                      <Select disabled={!canEdit} value={s.ownerRole} onChange={(e) => {
                        const ownerRole = e.target.value as OwnerRole;
                        update(i, { ownerRole, ...(ownerRole === "PAPER_SETTER" || ownerRole === "REVIEWER" ? { scope: "SUBJECT" as const } : {}) });
                      }}>
                        {(Object.keys(OWNER_ROLE_LABEL) as OwnerRole[]).map((r) => <option key={r} value={r}>{OWNER_ROLE_LABEL[r]}</option>)}
                      </Select>
                    </Field>
                  </div>
                  <div className="lg:col-span-2">
                    <Field label="Applies to">
                      <Select disabled={!canEdit} value={s.scope} onChange={(e) => update(i, { scope: e.target.value as any })}>
                        <option value="EXAM" disabled={s.ownerRole === "PAPER_SETTER" || s.ownerRole === "REVIEWER" || s.form === "BLUEPRINT" || s.approver === "SUBJECT_HEAD"}>Whole exam</option>
                        <option value="SUBJECT">Each paper/subject</option>
                      </Select>
                    </Field>
                  </div>
                  <div className="lg:col-span-3">
                    <Field label="Mode">
                      <Select disabled={!canEdit} value={s.mode ?? ""} onChange={(e) => update(i, { mode: (e.target.value || null) as any })}>
                        <option value="">Both modes</option>
                        <option value="PEN_PAPER">Pen &amp; paper only</option>
                        <option value="ONLINE">Online only</option>
                      </Select>
                    </Field>
                  </div>
                  <div className="lg:col-span-3">
                    <Field label="When done">
                      <Select disabled={!canEdit} value={s.action ?? ""} onChange={(e) => update(i, { action: (e.target.value || null) as any, ...(e.target.value ? { canBypass: false } : {}) })}>
                        <option value="">Nothing extra</option>
                        <option value="NOTIFY_STUDENTS">Email exam notice to students &amp; parents</option>
                        <option value="RELEASE_RESULTS">Release results to students &amp; parents</option>
                      </Select>
                    </Field>
                  </div>
                  <div className="lg:col-span-3">
                    <Field label="Approved by" hint={s.approver ? "Owner submits; approval closes it" : "Owner marks it done"}>
                      <Select disabled={!canEdit} value={s.approver ?? ""} onChange={(e) => {
                        const approver = (e.target.value || null) as StageDef["approver"];
                        update(i, { approver, ...(approver === "SUBJECT_HEAD" ? { scope: "SUBJECT" as const } : {}), ...(!approver ? { form: null } : {}) });
                      }}>
                        <option value="">No approval</option>
                        <option value="SUBJECT_HEAD">Subject head (HoD)</option>
                        <option value="CONTROLLER">Controller of Examinations</option>
                      </Select>
                    </Field>
                  </div>
                  <div className="lg:col-span-3">
                    <Field label="Form">
                      <Select disabled={!canEdit} value={s.form ?? ""} onChange={(e) => {
                        const form = (e.target.value || null) as StageDef["form"];
                        update(i, { form, ...(form === "BLUEPRINT" ? { scope: "SUBJECT" as const, approver: s.approver ?? "SUBJECT_HEAD" } : {}) });
                      }}>
                        <option value="">None</option>
                        <option value="BLUEPRINT">Blueprint (marks per chapter, difficulty)</option>
                      </Select>
                    </Field>
                  </div>
                  <div className="lg:col-span-5">
                    <Field label="Instructions for the owner">
                      <input className={inputCls} disabled={!canEdit} value={s.description ?? ""} onChange={(e) => update(i, { description: e.target.value || null })} />
                    </Field>
                  </div>
                  <div className="lg:col-span-1 flex items-end gap-2 pb-1">
                    <label className="flex items-center gap-1.5 text-xs text-gray-600 whitespace-nowrap">
                      <input type="checkbox" disabled={!canEdit || !!s.action} checked={s.canBypass} onChange={(e) => update(i, { canBypass: e.target.checked })} />
                      Can bypass
                    </label>
                  </div>
                </div>
                {canEdit && (
                  <div className="flex justify-end mt-2">
                    <button className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-red-600" onClick={() => removeRow(i)}><Trash2 className="h-3.5 w-3.5" /> Remove stage</button>
                  </div>
                )}
              </div>
            ))}
          </div>
          {err && <p className="text-sm text-red-600">{err}</p>}
          {canEdit && (
            <div className="flex flex-col sm:flex-row gap-2 sm:justify-between">
              <div className="flex gap-2">
                <button className={btnSecondary} onClick={addRow}><Plus className="h-4 w-4" /> Add stage</button>
                <button className={btnSecondary} onClick={toggleActive}>{t.isActive ? "Deactivate" : "Activate"}</button>
                {t._count.exams === 0 && <button className={btnDanger} onClick={del}><Trash2 className="h-4 w-4" /></button>}
              </div>
              <button className={btnPrimary} onClick={save} disabled={!dirty || saving}><Save className="h-4 w-4" /> {saving ? "Saving…" : "Save stages"}</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
