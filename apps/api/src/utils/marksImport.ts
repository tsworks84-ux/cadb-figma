import ExcelJS from "exceljs";

/**
 * Template generation + parsing for the per-exam marks import.
 *
 * Single source of truth for the sheet's shape: the template writer and the
 * parser both derive their column headers from `slotHeaders()`, so a file the
 * user downloaded and filled in always matches on the way back.
 */

export const SHEET_MARKS = "Marks";

const HEADER_FILL   = "FF28245F";
const LOCKED_FILL   = "FFF1F5F9";   // the reference columns nobody should retype
const ENTRY_FILL    = "FFFFFBEB";   // the columns the user fills in

/** Fixed columns that precede the per-slot mark columns. */
export const COL_STUDENT_ID = "Student ID";
export const COL_ROLL       = "Roll No";
export const COL_NAME       = "Student";
export const COL_BATCH      = "Batch";
export const COL_PRESENT    = "Present";
export const COL_TOTAL      = "Total";

const FIXED_HEADERS = [COL_STUDENT_ID, COL_ROLL, COL_NAME, COL_BATCH, COL_PRESENT];

export interface ExamSlot {
  paperNum:    number;
  subjectSlot: number;
  subjectName: string | null;
  maxMarks:    number | null;
}

export interface TemplateStudent {
  id:         string;
  rollNumber: string | null;
  name:       string;
  batchName:  string;
  attended:   boolean;
  /** slotKey → existing mark, so the template round-trips what is already saved. */
  marks:      Record<string, number | null>;
}

export const slotKey = (paperNum: number, subjectSlot: number) => `${paperNum}_${subjectSlot}`;

function normaliseHeader(value: string): string {
  return value.toLowerCase().replace(/\*/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Human-readable, unique header per mark column. Both sides call this, so an
 * untouched template always maps back onto the right slot. Papers are named only
 * when the exam actually has more than one, and a numeric suffix is appended only
 * where two slots would otherwise collide (same subject twice in one paper).
 */
export function slotHeaders(slots: ExamSlot[], numPapers: number): string[] {
  const base = slots.map((s) => {
    const name = s.subjectName?.trim() || `Subject ${s.subjectSlot}`;
    return numPapers > 1 ? `${name} (P${s.paperNum})` : name;
  });
  const counts = new Map<string, number>();
  for (const b of base) counts.set(b, (counts.get(b) ?? 0) + 1);

  const used = new Map<string, number>();
  return base.map((b) => {
    if ((counts.get(b) ?? 0) === 1) return b;
    const n = (used.get(b) ?? 0) + 1;
    used.set(b, n);
    return `${b} #${n}`;
  });
}

/** Per-slot ceiling: the slot's own max, else an even split of the exam total. */
export function slotMax(slot: ExamSlot, totalMarks: number | null, slotCount: number): number | null {
  if (slot.maxMarks != null) return slot.maxMarks;
  if (totalMarks != null && slotCount > 0) return totalMarks / slotCount;
  return null;
}

// ── Template ──────────────────────────────────────────────────────────────────

export function buildMarksTemplate(
  exam: { name: string; examDate: Date | string; totalMarks: number | null; numPapers: number },
  slots: ExamSlot[],
  students: TemplateStudent[],
): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = "CADB — Centum Academy";
  wb.created = new Date();

  const headers = slotHeaders(slots, exam.numPapers);
  const ws = wb.addWorksheet(SHEET_MARKS, { views: [{ state: "frozen", xSplit: 3, ySplit: 1 }] });

  ws.columns = [
    { header: COL_STUDENT_ID, width: 26 },
    { header: COL_ROLL,       width: 14 },
    { header: COL_NAME,       width: 26 },
    { header: COL_BATCH,      width: 24 },
    { header: COL_PRESENT,    width: 10 },
    ...headers.map((h) => ({ header: h, width: Math.max(14, Math.min(h.length + 4, 28)) })),
    { header: COL_TOTAL,      width: 10 },
  ];

  const head = ws.getRow(1);
  head.height = 26;
  head.eachCell((cell) => {
    cell.font      = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    cell.alignment = { vertical: "middle", horizontal: "left" };
  });
  // Spell the ceiling out on the header cell that owns it.
  headers.forEach((_, i) => {
    const max = slotMax(slots[i], exam.totalMarks, slots.length);
    if (max != null) head.getCell(6 + i).note = `Out of ${max}`;
  });
  head.getCell(1).note = "Do not edit — this is how each row is matched back to a student.";
  head.getCell(5).note = "Yes for present, No for absent. Absent students must have no marks.";

  const firstMarkCol = 6;
  const lastMarkCol  = 5 + headers.length;

  students.forEach((s, i) => {
    const row = ws.addRow([
      s.id,
      s.rollNumber ?? "",
      s.name,
      s.batchName,
      s.attended ? "Yes" : "No",
      ...slots.map((slot) => {
        const v = s.marks[slotKey(slot.paperNum, slot.subjectSlot)];
        return v ?? null;
      }),
    ]);
    // Total is a live formula so the person filling it in sees their own arithmetic.
    if (headers.length > 0) {
      const r = row.number;
      row.getCell(lastMarkCol + 1).value = {
        formula: `SUM(${ws.getColumn(firstMarkCol).letter}${r}:${ws.getColumn(lastMarkCol).letter}${r})`,
      } as any;
    }
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      const entry = col >= firstMarkCol && col <= lastMarkCol + 1;
      cell.fill = {
        type: "pattern", pattern: "solid",
        fgColor: { argb: col === 5 || (entry && col <= lastMarkCol) ? ENTRY_FILL : LOCKED_FILL },
      };
      cell.alignment = { horizontal: col >= 5 ? "center" : "left", vertical: "middle" };
      cell.font = { size: 10, color: { argb: col <= 4 ? "FF64748B" : "FF0F172A" } };
      if (col >= firstMarkCol && col <= lastMarkCol) cell.numFmt = "0.##";
    });
    if (i % 2 === 1) {
      // keep the zebra subtle — the fills above already carry the meaning
      row.getCell(3).font = { size: 10, bold: true, color: { argb: "FF0F172A" } };
    }
  });

  // Yes/No dropdown, so attendance can't arrive as "presnt".
  for (let r = 2; r <= students.length + 1; r++) {
    ws.getCell(r, 5).dataValidation = {
      type: "list", allowBlank: true, formulae: ['"Yes,No"'],
    };
  }

  // Sheet 2 — how to use it.
  const help = wb.addWorksheet("Instructions");
  help.columns = [{ header: "", width: 6 }, { header: "", width: 104 }];
  const title = help.addRow(["", `Marks import — ${exam.name}`]);
  title.font = { bold: true, size: 13 };
  help.addRow(["", ""]);
  [
    ["1.", `Fill in the "${SHEET_MARKS}" sheet. One row per student — the rows are already filled in for you.`],
    ["2.", "Do not add, delete or reorder rows, and do not edit the Student ID column — it is how each row is matched back."],
    ["3.", "Enter a number in each subject column. Leave a cell blank if that paper was not marked."],
    ["4.", "Present: Yes or No. An absent student must have every mark left blank."],
    ["5.", "Marks cannot be negative or above the ceiling shown in the header note for that column."],
    ["6.", "The Total column is a formula for your own checking — it is ignored on upload."],
    ["7.", "Save the file and upload it on the exam page. Only the students in the file are updated."],
  ].forEach((r) => help.addRow(r));
  help.addRow(["", ""]);
  help.addRow(["", "COLUMNS"]).font = { bold: true };
  headers.forEach((h, i) => {
    const max = slotMax(slots[i], exam.totalMarks, slots.length);
    help.addRow(["", `${h}${max != null ? `  —  out of ${max}` : ""}`]);
  });
  help.getColumn(2).alignment = { wrapText: true, vertical: "top" };

  return wb;
}

// ── Cell coercion ─────────────────────────────────────────────────────────────

/** ExcelJS hands back rich text, hyperlink objects and formula results — flatten them. */
function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    const v = value as any;
    if (typeof v.text === "string") return v.text.trim();
    if (Array.isArray(v.richText)) return v.richText.map((t: any) => t.text).join("").trim();
    if (v.result != null) return cellText(v.result);
    if (v.hyperlink) return String(v.hyperlink).trim();
  }
  return String(value).trim();
}

const YES = new Set(["yes", "y", "true", "1", "p", "present"]);
const NO  = new Set(["no", "n", "false", "0", "a", "absent"]);

// ── Parsing + validation ──────────────────────────────────────────────────────

export interface RowError { row: number; column: string; message: string }

export interface ParsedMarkRow {
  /** 1-based row number in the spreadsheet, so errors point at what the user sees. */
  row:       number;
  studentId: string;
  name:      string;
  attended:  boolean;
  marks:     { paperNum: number; subjectSlot: number; marks: number | null }[];
  /** For the preview table. */
  total:     number | null;
}

export interface ParseMarksResult {
  rows:      ParsedMarkRow[];
  errors:    RowError[];
  totalRows: number;
}

export async function loadWorkbook(buffer: Buffer, filename: string): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  if (/\.csv$/i.test(filename)) {
    const { Readable } = await import("stream");
    await wb.csv.read(Readable.from(buffer.toString("utf8")));
    wb.worksheets[0].name = SHEET_MARKS;
    return wb;
  }
  await wb.xlsx.load(buffer as any);
  return wb;
}

export function parseMarksWorkbook(
  wb: ExcelJS.Workbook,
  slots: ExamSlot[],
  numPapers: number,
  totalMarks: number | null,
  students: { id: string; rollNumber: string | null; name: string }[],
): ParseMarksResult {
  const errors: RowError[] = [];
  const ws = wb.getWorksheet(SHEET_MARKS) ?? wb.worksheets[0];
  if (!ws) {
    return { rows: [], errors: [{ row: 0, column: "", message: "The file has no worksheets." }], totalRows: 0 };
  }

  const headers = slotHeaders(slots, numPapers);

  // Map the sheet's columns onto ours by header text.
  const fixedCol = new Map<string, number>();
  const slotCol  = new Map<number, number>();   // slot index → column number
  ws.getRow(1).eachCell({ includeEmpty: false }, (cell, col) => {
    const text = normaliseHeader(cellText(cell.value));
    const fixed = FIXED_HEADERS.find((h) => normaliseHeader(h) === text);
    if (fixed) { if (!fixedCol.has(fixed)) fixedCol.set(fixed, col); return; }
    const slotIdx = headers.findIndex((h, i) => normaliseHeader(h) === text && !slotCol.has(i));
    if (slotIdx >= 0) slotCol.set(slotIdx, col);
  });

  if (!fixedCol.has(COL_STUDENT_ID) && !fixedCol.has(COL_ROLL) && !fixedCol.has(COL_NAME)) {
    return {
      rows: [], totalRows: 0,
      errors: [{ row: 1, column: COL_STUDENT_ID, message: `The header row doesn't match this exam's template. Download the template for this exam and fill that in.` }],
    };
  }
  const missingSlots = headers.filter((_, i) => !slotCol.has(i));
  if (missingSlots.length) {
    errors.push({
      row: 1, column: missingSlots[0],
      message: `Missing subject column${missingSlots.length === 1 ? "" : "s"}: ${missingSlots.join(", ")}. Download this exam's template — its columns must match.`,
    });
  }

  // Students are matched on id first, then roll number, then name.
  const byId   = new Map(students.map((s) => [s.id, s]));
  const byRoll = new Map<string, string | null>();
  const byName = new Map<string, string | null>();
  for (const s of students) {
    if (s.rollNumber) {
      const k = s.rollNumber.trim().toLowerCase();
      byRoll.set(k, byRoll.has(k) ? null : s.id);          // null = ambiguous
    }
    const n = s.name.trim().toLowerCase().replace(/\s+/g, " ");
    byName.set(n, byName.has(n) ? null : s.id);
  }

  const rows: ParsedMarkRow[] = [];
  const seenStudents = new Map<string, number>();
  let totalRows = 0;

  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;

    const idText   = fixedCol.has(COL_STUDENT_ID) ? cellText(row.getCell(fixedCol.get(COL_STUDENT_ID)!).value) : "";
    const rollText = fixedCol.has(COL_ROLL)       ? cellText(row.getCell(fixedCol.get(COL_ROLL)!).value)       : "";
    const nameText = fixedCol.has(COL_NAME)       ? cellText(row.getCell(fixedCol.get(COL_NAME)!).value)       : "";

    // A row with nothing identifying it is trailing whitespace, not an error.
    if (!idText && !rollText && !nameText) return;
    totalRows++;

    let studentId: string | null = null;
    if (idText && byId.has(idText)) studentId = idText;
    else if (idText) {
      errors.push({ row: rowNumber, column: COL_STUDENT_ID, message: `No student in this exam has the id "${idText}"` });
      return;
    } else if (rollText) {
      const hit = byRoll.get(rollText.toLowerCase());
      if (hit === undefined)   { errors.push({ row: rowNumber, column: COL_ROLL, message: `No student in this exam has roll number "${rollText}"` }); return; }
      if (hit === null)        { errors.push({ row: rowNumber, column: COL_ROLL, message: `Roll number "${rollText}" matches more than one student — use the Student ID column` }); return; }
      studentId = hit;
    } else {
      const hit = byName.get(nameText.toLowerCase().replace(/\s+/g, " "));
      if (hit === undefined)   { errors.push({ row: rowNumber, column: COL_NAME, message: `"${nameText}" is not a student in this exam` }); return; }
      if (hit === null)        { errors.push({ row: rowNumber, column: COL_NAME, message: `"${nameText}" matches more than one student — use the Student ID column` }); return; }
      studentId = hit;
    }

    const firstSeen = seenStudents.get(studentId);
    if (firstSeen) {
      errors.push({ row: rowNumber, column: COL_NAME, message: `${byId.get(studentId)?.name ?? "This student"} already appears on row ${firstSeen}` });
      return;
    }
    seenStudents.set(studentId, rowNumber);

    // Attendance — blank means present, matching the marks-entry screen's default.
    let attended = true;
    const presentText = fixedCol.has(COL_PRESENT) ? cellText(row.getCell(fixedCol.get(COL_PRESENT)!).value) : "";
    if (presentText) {
      const p = presentText.toLowerCase();
      if (YES.has(p))      attended = true;
      else if (NO.has(p))  attended = false;
      else {
        errors.push({ row: rowNumber, column: COL_PRESENT, message: `"${presentText}" is not a Yes or No` });
        return;
      }
    }

    const marks: ParsedMarkRow["marks"] = [];
    let rowFailed = false;
    let total = 0;
    let anyMark = false;

    slots.forEach((slot, i) => {
      const col = slotCol.get(i);
      if (col === undefined) return;
      const header = headers[i];
      const raw    = row.getCell(col).value;
      const text   = cellText(raw);

      if (text === "") {
        marks.push({ paperNum: slot.paperNum, subjectSlot: slot.subjectSlot, marks: null });
        return;
      }

      const n = Number(text.replace(/\s/g, ""));
      if (!Number.isFinite(n)) {
        errors.push({ row: rowNumber, column: header, message: `"${text}" is not a number` });
        rowFailed = true;
        return;
      }
      if (n < 0) {
        errors.push({ row: rowNumber, column: header, message: `Marks cannot be negative` });
        rowFailed = true;
        return;
      }
      const max = slotMax(slot, totalMarks, slots.length);
      if (max != null && n > max) {
        errors.push({ row: rowNumber, column: header, message: `${n} is above the maximum of ${max}` });
        rowFailed = true;
        return;
      }
      anyMark = true;
      total += n;
      marks.push({ paperNum: slot.paperNum, subjectSlot: slot.subjectSlot, marks: n });
    });

    if (rowFailed) return;

    if (!attended && anyMark) {
      errors.push({
        row: rowNumber, column: COL_PRESENT,
        message: `${byId.get(studentId)!.name} is marked absent but has marks — clear the marks or set Present to Yes`,
      });
      return;
    }

    rows.push({
      row: rowNumber,
      studentId,
      name: byId.get(studentId)!.name,
      attended,
      marks,
      total: anyMark ? total : null,
    });
  });

  return { rows, errors, totalRows };
}
