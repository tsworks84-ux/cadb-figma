import ExcelJS from "exceljs";
import { randomUUID } from "crypto";
import type { prisma } from "@cadb/db";

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Curriculum outlines — chapter → topic → subtopic — as read from and written to
 * xlsx, and as written to the CurriculumItem table. Pure apart from writeOutline,
 * so the dry-run preview and the committed import run the same parser.
 */

export type OutlineTopic = { name: string; subtopics: string[] };
export type OutlineChapter = { name: string; topics: OutlineTopic[] };
export type Outline = OutlineChapter[];

export const SHEET_CURRICULUM = "Curriculum";
export const MAX_CURRICULUM_ROWS = 5000;
export const MAX_NAME_LENGTH = 300;

const HEADER_FILL = "FF28245F";

const tidy = (s: string) => s.replace(/\s+/g, " ").trim();
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** Adds a node, merging with an existing sibling of the same name (case-insensitive). */
export function addToOutline(outline: Outline, chapter: string, topic?: string | null, subtopic?: string | null) {
  let ch = outline.find((c) => same(c.name, chapter));
  if (!ch) outline.push((ch = { name: chapter, topics: [] }));
  if (!topic) return;
  let tp = ch.topics.find((t) => same(t.name, topic));
  if (!tp) ch.topics.push((tp = { name: topic, subtopics: [] }));
  if (subtopic && !tp.subtopics.some((s) => same(s, subtopic))) tp.subtopics.push(subtopic);
}

export function outlineCounts(outline: Outline) {
  let topics = 0, subtopics = 0;
  for (const c of outline) {
    topics += c.topics.length;
    for (const t of c.topics) subtopics += t.subtopics.length;
  }
  return { chapters: outline.length, topics, subtopics };
}

function cellText(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (typeof v === "object") {
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("text" in v && v.text != null) return String(v.text);
    if ("result" in v && v.result != null) return String(v.result);
    return "";
  }
  return String(v);
}

export interface CurriculumParse {
  outline: Outline;
  errors: { row: number; message: string }[];
  totalRows: number;
}

/**
 * Reads the first sheet that has Chapter / Topic / Subtopic headers (in any
 * columns, within the first 10 rows — so a POW sheet with a leading "Sl. No."
 * column reads as-is). Chapter and Topic carry forward: a row with only a
 * Subtopic belongs to the last Topic above it, and a row with only a Topic to the
 * last Chapter. Fully filled rows work too; repeated names merge.
 */
export function parseCurriculumWorkbook(wb: ExcelJS.Workbook): CurriculumParse {
  const errors: CurriculumParse["errors"] = [];
  const outline: Outline = [];

  let ws: ExcelJS.Worksheet | undefined;
  let headerRow = 0;
  let cols = { chapter: 0, topic: 0, subtopic: 0 };
  const sheets = [wb.getWorksheet(SHEET_CURRICULUM), ...wb.worksheets].filter(Boolean) as ExcelJS.Worksheet[];
  for (const sheet of sheets) {
    for (let r = 1; r <= Math.min(10, sheet.rowCount); r++) {
      const found = { chapter: 0, topic: 0, subtopic: 0 };
      sheet.getRow(r).eachCell((cell, c) => {
        const h = cellText(cell.value).toLowerCase().replace(/[^a-z]/g, "");
        if (!h) return;
        if (h.startsWith("sub")) found.subtopic ||= c;          // "Subtopic", "Sub Topic", "Subtopics"
        else if (h.startsWith("topic")) found.topic ||= c;      // "Topic", "Topics", "Topic Name"
        else if (h.startsWith("chap")) found.chapter ||= c;     // "Chapter", "Chaper Name"
      });
      if (found.chapter && found.topic) { ws = sheet; headerRow = r; cols = found; break; }
    }
    if (ws) break;
  }
  if (!ws) {
    errors.push({ row: 0, message: "No sheet has Chapter and Topic column headers. Use the downloaded template." });
    return { outline, errors, totalRows: 0 };
  }

  let chapter = "", topic = "", totalRows = 0;
  const read = (r: number, c: number) => (c ? tidy(cellText(ws!.getRow(r).getCell(c).value)) : "");
  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const ch = read(r, cols.chapter), tp = read(r, cols.topic), st = read(r, cols.subtopic);
    if (!ch && !tp && !st) continue;
    // Header rows repeated mid-sheet (common when sheets are pasted together).
    if (/^chap/i.test(ch) && /^topic/i.test(tp)) continue;
    // The POW sheets' "Level-1 | Level-2 | JEE Module | NEET Module" divider rows.
    if (/^level-?\s*\d+$/i.test(ch) && /module/i.test(tp + st)) continue;
    totalRows++;
    if (totalRows > MAX_CURRICULUM_ROWS) {
      errors.push({ row: r, message: `More than ${MAX_CURRICULUM_ROWS} rows — split the file` });
      break;
    }
    const tooLong = [ch, tp, st].find((x) => x.length > MAX_NAME_LENGTH);
    if (tooLong) { errors.push({ row: r, message: `"${tooLong.slice(0, 40)}…" is longer than ${MAX_NAME_LENGTH} characters` }); continue; }

    if (ch) { chapter = ch; topic = ""; }
    if (tp) topic = tp;
    if (!chapter) { errors.push({ row: r, message: "No chapter above this row" }); continue; }
    if (st && !topic) { errors.push({ row: r, message: `Subtopic "${st}" has no topic above it` }); continue; }
    addToOutline(outline, chapter, topic || null, st || null);
  }
  return { outline, errors, totalRows };
}

/** The import template, or — given an outline — that curriculum as a re-importable file. */
export function buildCurriculumWorkbook(outline?: Outline, title?: string): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(SHEET_CURRICULUM, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = [
    { header: "Chapter", key: "chapter", width: 40 },
    { header: "Topic", key: "topic", width: 44 },
    { header: "Subtopic", key: "subtopic", width: 50 },
  ];
  const head = ws.getRow(1);
  head.font = { bold: true, color: { argb: "FFFFFFFF" } };
  head.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } }; });

  const rows: [string, string, string][] = [];
  const source: Outline = outline ?? [
    { name: "Units and Measurement", topics: [
      { name: "Physical Quantities", subtopics: ["Fundamental and Derived Quantities", "SI Units"] },
      { name: "Dimensional Analysis", subtopics: ["Dimensional Formula", "Checking Equations"] },
    ] },
    { name: "Motion in a Straight Line", topics: [{ name: "Equations of Motion", subtopics: [] }] },
  ];
  for (const c of source) {
    if (!c.topics.length) { rows.push([c.name, "", ""]); continue; }
    c.topics.forEach((t, ti) => {
      if (!t.subtopics.length) { rows.push([ti === 0 ? c.name : "", t.name, ""]); return; }
      t.subtopics.forEach((s, si) => rows.push([ti === 0 && si === 0 ? c.name : "", si === 0 ? t.name : "", s]));
    });
  }
  rows.forEach((r) => ws.addRow(r));
  ws.getColumn(1).font = { bold: true };
  head.font = { bold: true, color: { argb: "FFFFFFFF" } };

  const help = wb.addWorksheet("Instructions");
  help.getColumn(1).width = 110;
  [
    title ? `Curriculum: ${title}` : "Curriculum import template",
    "",
    "One row per subtopic. Fill Chapter only on the first row of a chapter and Topic only on the first row of a topic —",
    "blank Chapter / Topic cells continue the one above. Filling every cell on every row also works.",
    "A topic with no subtopics is a row with Chapter/Topic and an empty Subtopic. A chapter on its own row is allowed.",
    "Rows are kept in sheet order. Names repeated under the same parent are merged.",
    outline ? "This file is an export — edit it and import it back to replace the curriculum." : "Replace the example rows with your own before importing.",
    "Subject, grade and board are chosen in the app when you import, not in this file.",
  ].forEach((line, i) => { const r = help.addRow([line]); if (i === 0) r.font = { bold: true, size: 13 }; });
  return wb;
}

export async function loadCurriculumWorkbook(buffer: Buffer, filename: string): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  if (/\.csv$/i.test(filename)) {
    const { Readable } = await import("stream");
    await wb.csv.read(Readable.from(buffer.toString("utf8")));
    return wb;
  }
  await wb.xlsx.load(buffer as any);
  return wb;
}

type FlatItem = { id: string; parentId: string | null; level: "CHAPTER" | "TOPIC" | "SUBTOPIC"; name: string; sortOrder: number };

/** Rebuilds the nested outline from CurriculumItem rows. */
export function toOutline(items: FlatItem[]): Outline {
  const byParent = new Map<string | null, FlatItem[]>();
  for (const i of items) {
    const list = byParent.get(i.parentId) ?? [];
    list.push(i);
    byParent.set(i.parentId, list);
  }
  const kids = (id: string | null) => (byParent.get(id) ?? []).sort((a, b) => a.sortOrder - b.sortOrder);
  return kids(null).map((c) => ({
    name: c.name,
    topics: kids(c.id).map((t) => ({ name: t.name, subtopics: kids(t.id).map((s) => s.name) })),
  }));
}

/**
 * Writes an outline into a curriculum. `replace` clears it first; `append` merges
 * by name into what is there, adding new nodes after the existing siblings.
 */
export async function writeOutline(tx: Tx, curriculumId: string, outline: Outline, mode: "replace" | "append") {
  if (mode === "replace") await tx.curriculumItem.deleteMany({ where: { curriculumId } });

  const existing: FlatItem[] = mode === "append"
    ? await tx.curriculumItem.findMany({ where: { curriculumId }, select: { id: true, parentId: true, level: true, name: true, sortOrder: true } })
    : [];
  const children = new Map<string | null, FlatItem[]>();
  for (const i of existing) {
    const list = children.get(i.parentId) ?? [];
    list.push(i);
    children.set(i.parentId, list);
  }
  const created: (FlatItem & { curriculumId: string })[] = [];
  const place = (parentId: string | null, level: FlatItem["level"], name: string): string => {
    const siblings = children.get(parentId) ?? [];
    const hit = siblings.find((s) => same(s.name, name));
    if (hit) return hit.id;
    const item = { id: randomUUID(), parentId, level, name, sortOrder: siblings.reduce((m, s) => Math.max(m, s.sortOrder + 1), 0), curriculumId };
    siblings.push(item);
    children.set(parentId, siblings);
    created.push(item);
    return item.id;
  };
  for (const c of outline) {
    const cid = place(null, "CHAPTER", c.name);
    for (const t of c.topics) {
      const tid = place(cid, "TOPIC", t.name);
      for (const s of t.subtopics) place(tid, "SUBTOPIC", s);
    }
  }
  // Parents before children so the self-referencing FK is satisfied.
  for (const level of ["CHAPTER", "TOPIC", "SUBTOPIC"] as const) {
    const batch = created.filter((i) => i.level === level);
    for (let i = 0; i < batch.length; i += 1000) {
      await tx.curriculumItem.createMany({ data: batch.slice(i, i + 1000) });
    }
  }
  return created.length;
}
