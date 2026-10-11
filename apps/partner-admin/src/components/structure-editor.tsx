"use client";

import clsx from "clsx";
import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useBoards, useGrades, useSchools } from "@/lib/queries";
import type { Structure } from "@/lib/types";
import { Badge, Button, Select } from "./ui";

/**
 * Grades the project covers, the schools under it, and the board each school
 * runs for each grade. One board per grade per school; a school can run
 * different boards for different grades (e.g. ICSE 8–10, ISC 11–12).
 */
export function StructureEditor({ value, onChange }: { value: Structure; onChange: (v: Structure) => void }) {
  const { data: grades = [] } = useGrades();
  const { data: schools = [] } = useSchools();
  const { data: boards = [] } = useBoards();
  const [adding, setAdding] = useState("");

  const gradeName = useMemo(() => new Map(grades.map((g) => [g.id, g.name])), [grades]);
  const schoolById = useMemo(() => new Map(schools.map((s) => [s.id, s])), [schools]);
  const projectGrades = grades.filter((g) => value.gradeIds.includes(g.id));
  const activeBoards = boards.filter((b) => b.isActive);

  const toggleGrade = (id: string) => {
    if (value.gradeIds.includes(id)) {
      onChange({
        gradeIds: value.gradeIds.filter((g) => g !== id),
        schools: value.schools.map((s) => ({ ...s, grades: s.grades.filter((g) => g.gradeId !== id) })),
      });
    } else {
      onChange({ ...value, gradeIds: [...value.gradeIds, id] });
    }
  };

  const addSchool = () => {
    if (!adding) return;
    onChange({ ...value, schools: [...value.schools, { schoolId: adding, grades: [] }] });
    setAdding("");
  };

  const removeSchool = (schoolId: string) => onChange({ ...value, schools: value.schools.filter((s) => s.schoolId !== schoolId) });

  const setBoard = (schoolId: string, gradeId: string, boardId: string) =>
    onChange({
      ...value,
      schools: value.schools.map((s) => {
        if (s.schoolId !== schoolId) return s;
        const rest = s.grades.filter((g) => g.gradeId !== gradeId);
        return { ...s, grades: boardId ? [...rest, { gradeId, boardId }] : rest };
      }),
    });

  const setAllBoards = (schoolId: string, boardId: string) =>
    onChange({
      ...value,
      schools: value.schools.map((s) =>
        s.schoolId === schoolId ? { ...s, grades: boardId ? value.gradeIds.map((gradeId) => ({ gradeId, boardId })) : [] } : s,
      ),
    });

  const available = schools.filter((s) => !value.schools.some((x) => x.schoolId === s.id));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm font-medium text-ink">Grades catered to</p>
        <p className="mb-2 text-xs text-ink-muted">Tap to add or remove. Removing a grade clears its boards below.</p>
        <div className="flex flex-wrap gap-2">
          {grades.map((g) => {
            const on = value.gradeIds.includes(g.id);
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => toggleGrade(g.id)}
                aria-pressed={on}
                className={clsx(
                  "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                  on ? "border-brand bg-brand text-white" : "border-line bg-white text-ink-soft hover:border-brand/50",
                )}
              >
                {g.name}
              </button>
            );
          })}
          {grades.length === 0 && <p className="text-sm text-ink-muted">No grades in CADB yet.</p>}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div>
          <p className="text-sm font-medium text-ink">Schools and boards</p>
          <p className="text-xs text-ink-muted">Removing a school also removes every partner user's access to it in this project.</p>
        </div>

        {value.schools.map((s) => {
          const school = schoolById.get(s.schoolId);
          const boardFor = new Map(s.grades.map((g) => [g.gradeId, g.boardId]));
          const missing = projectGrades.filter((g) => !boardFor.has(g.id)).length;
          return (
            <div key={s.schoolId} className="rounded-lg border border-line">
              <div className="flex flex-col gap-2 border-b border-line bg-canvas/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{school?.name ?? "School no longer in CADB"}</p>
                  <p className="text-xs text-ink-muted">
                    {[school?.city, school?.board && `CADB lists: ${school.board}`].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {missing > 0 && <Badge tone="amber">{missing} grade{missing > 1 ? "s" : ""} without a board</Badge>}
                  <Button type="button" size="sm" variant="ghost" onClick={() => removeSchool(s.schoolId)} aria-label={`Remove ${school?.name ?? "school"}`}>
                    <Trash2 className="h-4 w-4" /> Remove
                  </Button>
                </div>
              </div>

              {projectGrades.length === 0 ? (
                <p className="px-4 py-3 text-sm text-ink-muted">Choose the project's grades first.</p>
              ) : (
                <div className="flex flex-col gap-3 px-4 py-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <span className="text-xs font-medium uppercase tracking-wide text-ink-muted sm:w-28">All grades</span>
                    <Select className="sm:w-64" value="" onChange={(e) => setAllBoards(s.schoolId, e.target.value)} aria-label="Set one board for all grades">
                      <option value="">Set one board for every grade…</option>
                      {activeBoards.map((b) => (
                        <option key={b.id} value={b.id}>{b.code}</option>
                      ))}
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {projectGrades.map((g) => (
                      <div key={g.id} className="flex min-w-0 flex-col gap-1">
                        <span className="text-xs font-medium text-ink-soft">Grade {gradeName.get(g.id)}</span>
                        <Select value={boardFor.get(g.id) ?? ""} onChange={(e) => setBoard(s.schoolId, g.id, e.target.value)} aria-label={`Board for grade ${g.name}`}>
                          <option value="">No board</option>
                          {boards
                            .filter((b) => b.isActive || b.id === boardFor.get(g.id))
                            .map((b) => (
                              <option key={b.id} value={b.id}>{b.code}</option>
                            ))}
                        </Select>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Select className="sm:max-w-md sm:flex-1" value={adding} onChange={(e) => setAdding(e.target.value)} aria-label="School to add">
            <option value="">Add a school from CADB…</option>
            {available.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.city ? ` · ${s.city}` : ""}
                {!s.isActive ? " (inactive)" : ""}
              </option>
            ))}
          </Select>
          <Button type="button" onClick={addSchool} disabled={!adding}>
            <Plus className="h-4 w-4" /> Add school
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Same project grades and per-school boards, ignoring order. */
export function sameStructure(a: Structure, b: Structure) {
  const norm = (s: Structure) =>
    JSON.stringify({
      g: [...s.gradeIds].sort(),
      s: [...s.schools]
        .map((x) => ({ id: x.schoolId, g: [...x.grades].map((y) => `${y.gradeId}:${y.boardId}`).sort() }))
        .sort((p, q) => p.id.localeCompare(q.id)),
    });
  return norm(a) === norm(b);
}
