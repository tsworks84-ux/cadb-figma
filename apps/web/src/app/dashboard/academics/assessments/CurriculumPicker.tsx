"use client";

/**
 * Pick exam topics from a subject's curriculum (Academic Settings → Curriculum).
 * Ticking a chapter, topic or subtopic adds its name to the subject's topics;
 * unticking removes it. Typed topics still work alongside — this only adds names.
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { api } from "@/lib/api";
import { D } from "./formKit";

type Outline = { name: string; topics: { name: string; subtopics: string[] }[] }[];
type CurriculumOutline = { id: string; board: string; grade: { id: string; name: string }; chapters: Outline };

// Topics are stored comma-joined on ExamSubject.topics, so a comma inside a
// name would split it in two on reload.
export const topicLabel = (name: string) => name.replace(/\s*,\s*/g, " / ").trim();

export function CurriculumPicker({ subjectId, gradeIds, topics, onChange, collapsible = false }: {
  subjectId: string; gradeIds: string[]; topics: string[]; onChange: (t: string[]) => void;
  /** Start as a one-line "Pick from curriculum" link (for forms where topics are secondary). */
  collapsible?: boolean;
}) {
  const [expanded, setExpanded] = useState(!collapsible);
  const { data = [], isLoading } = useQuery({
    queryKey: ["curriculum-outline", subjectId],
    queryFn: () => api.get(`/api/v1/academics/curricula/outline?subjectId=${subjectId}`).then((r) => r.data.data as CurriculumOutline[]),
    enabled: !!subjectId,
    staleTime: 5 * 60_000,
  });

  // Default to a curriculum for the grade of the batches being examined.
  const preferred = useMemo(() => data.find((c) => gradeIds.includes(c.grade.id)) ?? data[0], [data, gradeIds]);
  const [chosenId, setChosenId] = useState<string>("");
  useEffect(() => { setChosenId(""); }, [subjectId]);
  const current = data.find((c) => c.id === chosenId) ?? preferred;

  const [open, setOpen] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const toggleOpen = (k: string) => setOpen((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  const picked = new Set(topics.map((t) => t.toLowerCase()));
  const isPicked = (name: string) => picked.has(topicLabel(name).toLowerCase());
  const flip = (name: string) => {
    const label = topicLabel(name);
    onChange(isPicked(name) ? topics.filter((t) => t.toLowerCase() !== label.toLowerCase()) : [...topics, label]);
  };

  if (!subjectId) return null;
  if (collapsible && !expanded) {
    if (isLoading || !data.length) return null;
    return (
      <button type="button" onClick={() => setExpanded(true)}
        style={{ display: "inline-flex", alignItems: "center", gap: 4, border: "none", background: "none", cursor: "pointer", font: "inherit", fontSize: 12, fontWeight: 700, color: "#4f46e5", padding: "2px 0", marginBottom: 6 }}>
        <ChevronRight style={{ width: 13, height: 13 }} /> Pick from curriculum
      </button>
    );
  }
  if (isLoading) return <p style={{ fontSize: 12, color: D.muted, margin: "0 0 8px" }}>Loading curriculum…</p>;
  if (!data.length) {
    return <p style={{ fontSize: 12, color: D.muted, margin: "0 0 8px" }}>No curriculum for this subject yet — add one in Academic Settings → Curriculum, or type topics below.</p>;
  }

  const needle = q.trim().toLowerCase();
  const hit = (s: string) => !needle || s.toLowerCase().includes(needle);
  const chapters = (current?.chapters ?? [])
    .map((c) => {
      const topicsShown = c.topics
        .map((t) => ({ ...t, subtopics: hit(c.name) || hit(t.name) ? t.subtopics : t.subtopics.filter(hit) }))
        .filter((t) => hit(c.name) || hit(t.name) || t.subtopics.length);
      return { ...c, topics: topicsShown };
    })
    .filter((c) => hit(c.name) || c.topics.length);

  const row = (depth: number): React.CSSProperties => ({ display: "flex", alignItems: "flex-start", gap: 6, padding: `5px 8px 5px ${8 + depth * 20}px` });
  const caret = (k: string, has: boolean) => has
    ? <button type="button" onClick={() => toggleOpen(k)} aria-label="Expand" style={{ border: "none", background: "none", padding: 0, cursor: "pointer", color: D.muted, display: "flex", marginTop: 1 }}>
        {open.has(k) || needle ? <ChevronDown style={{ width: 14, height: 14 }} /> : <ChevronRight style={{ width: 14, height: 14 }} />}
      </button>
    : <span style={{ width: 14, flexShrink: 0 }} />;
  const box = (name: string, weight: number, size = 13) => (
    <label style={{ display: "flex", alignItems: "flex-start", gap: 6, cursor: "pointer", fontSize: size, fontWeight: weight, color: D.ink, minWidth: 0 }}>
      <input type="checkbox" checked={isPicked(name)} onChange={() => flip(name)} style={{ accentColor: "#4f46e5", marginTop: 2, flexShrink: 0 }} />
      <span style={{ wordBreak: "break-word" }}>{name}</span>
    </label>
  );

  return (
    <div style={{ border: `1px solid ${D.line}`, borderRadius: 12, background: "#fbfcfe", marginBottom: 10 }}>
      <div className="flex flex-col sm:flex-row" style={{ gap: 8, padding: 8, borderBottom: `1px solid ${D.line}` }}>
        <div style={{ position: "relative", flexShrink: 0 }}>
        <select value={current?.id ?? ""} onChange={(e) => { setChosenId(e.target.value); setOpen(new Set()); }}
          aria-label="Curriculum" className="appearance-none"
          style={{ minHeight: 34, borderRadius: 10, border: `1px solid ${D.line}`, padding: "4px 28px 4px 10px", fontSize: 13, background: "white", fontWeight: 700, color: D.nav2, width: "100%" }}>
          {data.map((c) => <option key={c.id} value={c.id}>Grade {c.grade.name} · {c.board}</option>)}
        </select>
        <ChevronDown style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", width: 13, height: 13, color: D.muted, pointerEvents: "none" }} />
        </div>
        <div style={{ position: "relative", flex: 1, display: "flex", gap: 6, alignItems: "center" }}>
          {collapsible && (
            <button type="button" onClick={() => setExpanded(false)} style={{ order: 2, border: "none", background: "none", cursor: "pointer", font: "inherit", fontSize: 12, fontWeight: 700, color: D.muted, whiteSpace: "nowrap" }}>Hide</button>
          )}
          <Search style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 13, height: 13, color: D.muted }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the curriculum…"
            style={{ flex: 1, minWidth: 0, minHeight: 34, borderRadius: 10, border: `1px solid ${D.line}`, padding: "4px 10px 4px 30px", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
        </div>
      </div>
      <div style={{ maxHeight: 260, overflowY: "auto", padding: "4px 0" }}>
        {chapters.length === 0 && <p style={{ margin: 0, padding: "10px 12px", fontSize: 12, color: D.muted }}>Nothing matches.</p>}
        {chapters.map((c) => {
          const ck = `c:${c.name}`;
          return (
            <div key={ck}>
              <div style={row(0)}>{caret(ck, c.topics.length > 0)}{box(c.name, 750)}<span style={{ fontSize: 11, color: D.muted, whiteSpace: "nowrap", marginTop: 2 }}>{c.topics.length}</span></div>
              {(open.has(ck) || needle) && c.topics.map((t) => {
                const tk = `${ck}/t:${t.name}`;
                return (
                  <div key={tk}>
                    <div style={row(1)}>{caret(tk, t.subtopics.length > 0)}{box(t.name, 600)}</div>
                    {(open.has(tk) || needle) && t.subtopics.map((s) => (
                      <div key={`${tk}/${s}`} style={row(2)}><span style={{ width: 14, flexShrink: 0 }} />{box(s, 400, 12)}</div>
                    ))}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
