import ExcelJS from "exceljs";

/**
 * Bulk student import — template generation, spreadsheet parsing and row
 * validation. The route layer (routes/v1/students.ts) owns the DB writes; this
 * module is pure so the same rules drive both the dry-run preview and the
 * committed import.
 */

export const MAX_IMPORT_ROWS = 500;
export const SHEET_STUDENTS = "Students";

type ColumnType = "string" | "email" | "date" | "number" | "enum";
type LookupKind = "school" | "grade" | "course" | "batch";

export interface ImportColumn {
  header: string;
  /** Target field on Student, or the *Id field a lookup resolves to. */
  key: string;
  type: ColumnType;
  required?: boolean;
  values?: string[];
  lookup?: LookupKind;
  /** Nested under `address` / `parentAddress` in the Student JSON columns. */
  json?: "address";
  note: string;
  width: number;
}

export const IMPORT_COLUMNS: ImportColumn[] = [
  { header: "First Name",        key: "firstName",   type: "string", required: true,  note: "Required.", width: 16 },
  { header: "Last Name",         key: "lastName",    type: "string", required: true,  note: "Required.", width: 16 },
  { header: "Middle Name",       key: "middleName",  type: "string", note: "Optional.", width: 14 },
  { header: "Email",             key: "email",       type: "email",  required: true,  note: "Required. Must be unique — this is the student's login ID.", width: 28 },
  { header: "Phone",             key: "phone",       type: "string", note: "Optional. Digits only, e.g. 9876543210.", width: 14 },
  { header: "Gender",            key: "gender",      type: "enum",   values: ["MALE", "FEMALE", "OTHER"], note: "MALE, FEMALE or OTHER.", width: 10 },
  { header: "Date of Birth",     key: "dateOfBirth", type: "date",   note: "YYYY-MM-DD or DD/MM/YYYY.", width: 14 },
  { header: "Nationality",       key: "nationality", type: "string", note: "Defaults to Indian when blank.", width: 12 },
  { header: "Roll Number",       key: "rollNumber",  type: "string", note: "Optional.", width: 12 },

  { header: "Admission Number",  key: "admissionNumber", type: "string", note: "Optional — generated automatically (ADM-<year>-####) when blank. Must be unique.", width: 18 },
  { header: "Admission Date",    key: "admissionDate",   type: "date",   note: "YYYY-MM-DD or DD/MM/YYYY.", width: 14 },
  { header: "Academic Year",     key: "academicYear",    type: "string", note: "Must match an academic year on the Reference Data sheet.", width: 14 },
  { header: "School",            key: "schoolId", type: "string", lookup: "school", note: "Name must match the Reference Data sheet exactly.", width: 20 },
  { header: "Grade",             key: "gradeId",  type: "string", lookup: "grade",  note: "Name must match the Reference Data sheet exactly.", width: 14 },
  { header: "Course",            key: "courseId", type: "string", lookup: "course", note: "Name must match the Reference Data sheet exactly.", width: 20 },
  { header: "Batch",             key: "batchId",  type: "string", lookup: "batch",  note: "Name must match the Reference Data sheet. If two batches share a name, also fill Academic Year.", width: 22 },

  { header: "Father / Guardian Name", key: "parentName",       type: "string", note: "Optional.", width: 20 },
  { header: "Father Phone",           key: "parentPhone",      type: "string", note: "Optional.", width: 14 },
  { header: "Father Email",           key: "parentEmail",      type: "email",  note: "Optional.", width: 24 },
  { header: "Relation",               key: "parentRelation",   type: "string", note: "e.g. Father, Guardian, Uncle.", width: 12 },
  { header: "Father Occupation",      key: "parentOccupation", type: "string", note: "Optional.", width: 18 },
  { header: "Mother Name",            key: "motherName",       type: "string", note: "Optional.", width: 20 },
  { header: "Mother Phone",           key: "motherPhone",      type: "string", note: "Optional.", width: 14 },
  { header: "Mother Email",           key: "motherEmail",      type: "email",  note: "Optional.", width: 24 },
  { header: "Mother Occupation",      key: "motherOccupation", type: "string", note: "Optional.", width: 18 },
  { header: "Communication Contact",  key: "communicationContact", type: "enum", values: ["FATHER", "MOTHER", "BOTH", "OTHER"], note: "Who the academy contacts: FATHER, MOTHER, BOTH or OTHER.", width: 20 },

  { header: "Total Fee", key: "totalFee", type: "number", note: "Numbers only, no ₹ or commas.", width: 12 },
  { header: "Paid Fee",  key: "paidFee",  type: "number", note: "Numbers only, no ₹ or commas.", width: 12 },

  { header: "Address",  key: "address",  type: "string", json: "address", note: "Street / flat / building.", width: 24 },
  { header: "Area",     key: "area",     type: "string", json: "address", note: "Optional.", width: 14 },
  { header: "Landmark", key: "landmark", type: "string", json: "address", note: "Optional.", width: 14 },
  { header: "City",     key: "city",     type: "string", json: "address", note: "Optional.", width: 14 },
  { header: "State",    key: "state",    type: "string", json: "address", note: "Optional.", width: 14 },
  { header: "Pincode",  key: "pincode",  type: "string", json: "address", note: "Optional.", width: 10 },
  { header: "Country",  key: "country",  type: "string", json: "address", note: "Defaults to India when blank.", width: 12 },
];

/** Headers are matched loosely so light edits (case, spacing, a stray *) still parse. */
function normaliseHeader(value: string): string {
  return value.toLowerCase().replace(/\*/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

const COLUMN_BY_HEADER = new Map<string, ImportColumn>(
  IMPORT_COLUMNS.map((c) => [normaliseHeader(c.header), c])
);

export interface ReferenceData {
  schools:       { id: string; name: string }[];
  grades:        { id: string; name: string }[];
  courses:       { id: string; name: string }[];
  batches:       { id: string; name: string; academicYear: string | null }[];
  academicYears: { name: string }[];
}

// ── Template ──────────────────────────────────────────────────────────────────

const HEADER_FILL = "FF28245F";
const REQUIRED_FILL = "FFFFF4E5";

export function buildTemplateWorkbook(ref: ReferenceData): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = "CADB — Centum Academy";
  wb.created = new Date();

  // Sheet 1 — the sheet the user actually fills in.
  const ws = wb.addWorksheet(SHEET_STUDENTS, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = IMPORT_COLUMNS.map((c) => ({ header: c.required ? `${c.header} *` : c.header, width: c.width }));

  const head = ws.getRow(1);
  head.height = 24;
  head.eachCell((cell, col) => {
    const column = IMPORT_COLUMNS[col - 1];
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    cell.alignment = { vertical: "middle", horizontal: "left" };
    cell.note = column?.note;
  });

  // Tint the three required columns so they read as mandatory at a glance.
  IMPORT_COLUMNS.forEach((c, i) => {
    if (!c.required) return;
    for (let r = 2; r <= 200; r++) {
      ws.getCell(r, i + 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: REQUIRED_FILL } };
    }
  });

  // Dropdowns for the enum columns — cheap guard against typos.
  IMPORT_COLUMNS.forEach((c, i) => {
    if (c.type !== "enum" || !c.values) return;
    for (let r = 2; r <= 200; r++) {
      ws.getCell(r, i + 1).dataValidation = {
        type: "list", allowBlank: true, formulae: [`"${c.values.join(",")}"`],
      };
    }
  });

  // Sheet 2 — what each column means.
  const help = wb.addWorksheet("Instructions");
  help.columns = [
    { header: "Column", width: 26 },
    { header: "Required", width: 10 },
    { header: "Format / Allowed values", width: 46 },
  ];
  styleHeader(help.getRow(1));
  help.addRow(["HOW TO USE", "", ""]).font = { bold: true };
  [
    ["1.", "", `Fill one student per row on the "${SHEET_STUDENTS}" sheet. Do not rename or reorder the header row.`],
    ["2.", "", "Leave a cell blank when you don't have the value — only the three starred columns are mandatory."],
    ["3.", "", "School / Grade / Course / Batch must be typed exactly as they appear on the Reference Data sheet."],
    ["4.", "", `Upload the saved file back on the Students page. Up to ${MAX_IMPORT_ROWS} students per file.`],
    ["5.", "", "Every imported student gets the password Welcome@123 and is asked to change it at first login."],
    ["", "", ""],
  ].forEach((r) => help.addRow(r));
  help.addRow(["COLUMN REFERENCE", "", ""]).font = { bold: true };
  IMPORT_COLUMNS.forEach((c) => {
    help.addRow([c.header, c.required ? "Yes" : "No", c.note]);
  });
  help.getColumn(3).alignment = { wrapText: true, vertical: "top" };

  // Sheet 3 — the live lookup values, so names can be copied rather than guessed.
  const refSheet = wb.addWorksheet("Reference Data");
  refSheet.columns = [
    { header: "Schools", width: 26 },
    { header: "Grades", width: 18 },
    { header: "Courses", width: 26 },
    { header: "Batches", width: 30 },
    { header: "Academic Years", width: 16 },
  ];
  styleHeader(refSheet.getRow(1));
  const longest = Math.max(
    ref.schools.length, ref.grades.length, ref.courses.length,
    ref.batches.length, ref.academicYears.length, 1,
  );
  for (let i = 0; i < longest; i++) {
    refSheet.addRow([
      ref.schools[i]?.name ?? "",
      ref.grades[i]?.name ?? "",
      ref.courses[i]?.name ?? "",
      ref.batches[i] ? `${ref.batches[i].name}${ref.batches[i].academicYear ? `  (${ref.batches[i].academicYear})` : ""}` : "",
      ref.academicYears[i]?.name ?? "",
    ]);
  }

  return wb;
}

function styleHeader(row: ExcelJS.Row) {
  row.height = 22;
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    cell.alignment = { vertical: "middle" };
  });
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
    if (typeof v.text === "string") return v.text.trim();              // hyperlink cell
    if (Array.isArray(v.richText)) return v.richText.map((t: any) => t.text).join("").trim();
    if (v.result != null) return cellText(v.result);                    // formula cell
    if (v.hyperlink) return String(v.hyperlink).replace(/^mailto:/, "").trim();
  }
  return String(value).trim();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Accepts a real Date cell, an Excel serial, YYYY-MM-DD, or DD/MM/YYYY. */
function parseDate(raw: ExcelJS.CellValue, text: string): string | null {
  if (raw instanceof Date) return raw.toISOString().slice(0, 10);
  if (typeof raw === "number") {
    const ms = Math.round((raw - 25569) * 86400 * 1000);   // Excel epoch → Unix
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return validDate(+iso[1], +iso[2], +iso[3]);
  const dmy = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) return validDate(+dmy[3], +dmy[2], +dmy[1]);
  return null;
}

function validDate(y: number, m: number, d: number): string | null {
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  if (y < 1900 || y > 2099) return null;
  return date.toISOString().slice(0, 10);
}

function parseNumber(text: string): number | null {
  const cleaned = text.replace(/[₹,\s]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

// ── Parsing + validation ──────────────────────────────────────────────────────

export interface RowError { row: number; column: string; message: string }

export interface ParsedRow {
  /** 1-based row number in the spreadsheet, so errors point at what the user sees. */
  row: number;
  data: Record<string, any>;
  /** For the preview table — resolved names rather than ids. */
  display: { name: string; email: string; batch: string; grade: string };
}

export interface ParseResult {
  rows: ParsedRow[];
  errors: RowError[];
  totalRows: number;
}

export async function loadWorkbook(buffer: Buffer, filename: string): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  if (/\.csv$/i.test(filename)) {
    const { Readable } = await import("stream");
    await wb.csv.read(Readable.from(buffer.toString("utf8")));
    // csv.read names the sheet "sheet1"; give it the name the parser looks for.
    wb.worksheets[0].name = SHEET_STUDENTS;
    return wb;
  }
  await wb.xlsx.load(buffer as any);
  return wb;
}

function buildLookup(items: { id: string; name: string }[]): Map<string, string | null> {
  const map = new Map<string, string | null>();
  for (const item of items) {
    const key = item.name.trim().toLowerCase();
    // null marks an ambiguous name — two records share it, so we can't pick one.
    map.set(key, map.has(key) ? null : item.id);
  }
  return map;
}

export function parseAndValidate(
  wb: ExcelJS.Workbook,
  ref: ReferenceData,
  existing: { emails: Set<string>; admissionNumbers: Set<string> },
): ParseResult {
  const ws = wb.getWorksheet(SHEET_STUDENTS) ?? wb.worksheets[0];
  if (!ws) {
    return { rows: [], errors: [{ row: 0, column: "", message: "The file has no worksheets." }], totalRows: 0 };
  }

  // Map spreadsheet columns → our schema by header text, tolerating extra columns.
  const colIndex = new Map<number, ImportColumn>();
  const headerRow = ws.getRow(1);
  headerRow.eachCell({ includeEmpty: false }, (cell, col) => {
    const match = COLUMN_BY_HEADER.get(normaliseHeader(cellText(cell.value)));
    if (match) colIndex.set(col, match);
  });

  const seen = new Set(colIndex.values());
  const missing = IMPORT_COLUMNS.filter((c) => c.required && !seen.has(c));
  if (missing.length) {
    return {
      rows: [], totalRows: 0,
      errors: [{
        row: 1, column: missing.map((m) => m.header).join(", "),
        message: `The header row is missing required column(s): ${missing.map((m) => m.header).join(", ")}. Download a fresh template and copy your data into it.`,
      }],
    };
  }

  const lookups: Record<LookupKind, Map<string, string | null>> = {
    school: buildLookup(ref.schools),
    grade:  buildLookup(ref.grades),
    course: buildLookup(ref.courses),
    batch:  buildLookup(ref.batches),
  };
  // Batches are also keyed by "year|name" so same-named batches stay resolvable.
  const batchByYear = new Map<string, string>();
  for (const b of ref.batches) {
    if (b.academicYear) batchByYear.set(`${b.academicYear.toLowerCase()}|${b.name.trim().toLowerCase()}`, b.id);
  }
  const knownYears = new Set(ref.academicYears.map((y) => y.name.trim().toLowerCase()));
  const gradeName  = new Map(ref.grades.map((g) => [g.id, g.name]));
  const batchName  = new Map(ref.batches.map((b) => [b.id, b.name]));

  const rows: ParsedRow[] = [];
  const errors: RowError[] = [];
  const emailsInFile = new Map<string, number>();
  const admissionInFile = new Map<string, number>();
  let totalRows = 0;

  ws.eachRow({ includeEmpty: false }, (excelRow, rowNumber) => {
    if (rowNumber === 1) return;

    // Cells the user cleared can linger as empty strings — treat those rows as blank.
    const values: Record<number, { raw: ExcelJS.CellValue; text: string }> = {};
    let hasContent = false;
    for (const col of colIndex.keys()) {
      const raw = excelRow.getCell(col).value;
      const text = cellText(raw);
      values[col] = { raw, text };
      if (text) hasContent = true;
    }
    if (!hasContent) return;

    totalRows++;
    if (totalRows > MAX_IMPORT_ROWS) {
      if (totalRows === MAX_IMPORT_ROWS + 1) {
        errors.push({
          row: rowNumber, column: "",
          message: `This file has more than ${MAX_IMPORT_ROWS} students. Split it into files of ${MAX_IMPORT_ROWS} rows or fewer.`,
        });
      }
      return;
    }

    const data: Record<string, any> = {};
    const address: Record<string, string> = {};
    const rowErrors: RowError[] = [];
    const fail = (column: string, message: string) => rowErrors.push({ row: rowNumber, column, message });

    for (const [col, column] of colIndex) {
      const { raw, text } = values[col];

      if (!text) {
        if (column.required) fail(column.header, `${column.header} is required.`);
        continue;
      }

      if (column.json === "address") { address[column.key] = text; continue; }

      switch (column.type) {
        case "email": {
          const email = text.toLowerCase();
          if (!EMAIL_RE.test(email)) { fail(column.header, `"${text}" is not a valid email address.`); break; }
          if (column.key === "email") {
            const dupRow = emailsInFile.get(email);
            if (dupRow) { fail(column.header, `Duplicate email — row ${dupRow} in this file already uses "${text}".`); break; }
            if (existing.emails.has(email)) { fail(column.header, `A student with the email "${text}" already exists.`); break; }
            emailsInFile.set(email, rowNumber);
          }
          data[column.key] = email;
          break;
        }
        case "date": {
          const parsed = parseDate(raw, text);
          if (!parsed) { fail(column.header, `"${text}" is not a valid date. Use YYYY-MM-DD or DD/MM/YYYY.`); break; }
          data[column.key] = parsed;
          break;
        }
        case "number": {
          const parsed = parseNumber(text);
          if (parsed === null) { fail(column.header, `"${text}" is not a number.`); break; }
          if (parsed < 0) { fail(column.header, `${column.header} cannot be negative.`); break; }
          data[column.key] = parsed;
          break;
        }
        case "enum": {
          const upper = text.toUpperCase();
          if (!column.values!.includes(upper)) {
            fail(column.header, `"${text}" is not allowed. Use one of: ${column.values!.join(", ")}.`);
            break;
          }
          data[column.key] = upper;
          break;
        }
        default: {
          if (column.lookup) {
            const id = lookups[column.lookup].get(text.toLowerCase());
            if (id === undefined) {
              fail(column.header, `${column.header} "${text}" was not found. Copy the exact name from the Reference Data sheet.`);
            } else if (id === null) {
              // Ambiguous: batches can be disambiguated by the year on the same row.
              const year = cellText(values[findCol(colIndex, "academicYear")!]?.raw ?? null);
              const byYear = column.lookup === "batch" && year
                ? batchByYear.get(`${year.toLowerCase()}|${text.toLowerCase()}`)
                : undefined;
              if (byYear) data[column.key] = byYear;
              else fail(column.header, `More than one ${column.lookup} is called "${text}". Fill in Academic Year to say which one.`);
            } else {
              data[column.key] = id;
            }
            break;
          }
          if (column.key === "admissionNumber") {
            const dupRow = admissionInFile.get(text.toLowerCase());
            if (dupRow) { fail(column.header, `Duplicate admission number — row ${dupRow} in this file already uses "${text}".`); break; }
            if (existing.admissionNumbers.has(text.toLowerCase())) { fail(column.header, `Admission number "${text}" is already in use.`); break; }
            admissionInFile.set(text.toLowerCase(), rowNumber);
          }
          if (column.key === "academicYear" && !knownYears.has(text.toLowerCase())) {
            fail(column.header, `Academic year "${text}" was not found. Copy one from the Reference Data sheet.`);
            break;
          }
          data[column.key] = text;
        }
      }
    }

    if (Object.keys(address).length) {
      data.address = { country: "India", ...address };
    }

    if (rowErrors.length) { errors.push(...rowErrors); return; }

    rows.push({
      row: rowNumber,
      data,
      display: {
        name:  `${data.firstName ?? ""} ${data.lastName ?? ""}`.trim(),
        email: data.email ?? "",
        batch: data.batchId ? batchName.get(data.batchId) ?? "" : "",
        grade: data.gradeId ? gradeName.get(data.gradeId) ?? "" : "",
      },
    });
  });

  return { rows, errors, totalRows };
}

function findCol(colIndex: Map<number, ImportColumn>, key: string): number | undefined {
  for (const [col, column] of colIndex) if (column.key === key) return col;
  return undefined;
}
