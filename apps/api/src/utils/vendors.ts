import { prisma } from "@cadb/db";
import type { JwtPayload } from "@cadb/types";
import type { FastifyReply, FastifyRequest } from "fastify";
import { createReadStream, existsSync, mkdirSync, unlinkSync, writeFileSync } from "fs";
import { dirname, extname, join } from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";

// ─── ACCESS ──────────────────────────────────────────────────────────────────

type Flags = { view: boolean; create: boolean; edit: boolean; delete: boolean; approve: boolean };
export type VendorAccess = {
  vendors: Flags;
  payments: Flags;
  /** May open the vendor registry at all (list + detail). */
  canBrowseVendors: boolean;
  /** Sees every payment request, not just the ones they raised. */
  seesAllPayments: boolean;
  /** Sees full bank account numbers. Everyone else gets them masked. */
  seesBankDetails: boolean;
  isSuperAdmin: boolean;
};

const ALL: Flags = { view: true, create: true, edit: true, delete: true, approve: true };
const NONE: Flags = { view: false, create: false, edit: false, delete: false, approve: false };

/**
 * Both vendor modules for the caller, in one query. Every built-in role goes
 * through the matrix too (no hard-coded HR bypass): these are new modules, so
 * the Super Admin decides from scratch who approves and who pays.
 */
export async function vendorAccess(user: JwtPayload): Promise<VendorAccess> {
  let vendors = NONE;
  let payments = NONE;
  if (user.role === "SUPER_ADMIN") {
    vendors = ALL;
    payments = ALL;
  } else {
    const rows = await prisma.rolePermission.findMany({
      where: { role: user.role, module: { in: ["VENDORS", "VENDOR_PAYMENTS"] } },
    });
    const toFlags = (m: string): Flags => {
      const r = rows.find((x) => x.module === m);
      return r
        ? { view: r.canView, create: r.canCreate, edit: r.canEdit, delete: r.canDelete, approve: r.canApprove }
        : NONE;
    };
    vendors = toFlags("VENDORS");
    payments = toFlags("VENDOR_PAYMENTS");
  }
  return {
    vendors,
    payments,
    canBrowseVendors: vendors.view || vendors.create || vendors.edit || vendors.approve || vendors.delete,
    seesAllPayments: payments.view || payments.approve || payments.edit || payments.delete,
    // Accounts must see where the money goes, and approvers should be able to check it.
    seesBankDetails: vendors.edit || vendors.approve || payments.edit || payments.approve,
    isSuperAdmin: user.role === "SUPER_ADMIN",
  };
}

export function forbid(reply: FastifyReply, error = "Insufficient permissions") {
  return reply.status(403).send({ success: false, error, statusCode: 403 });
}

export function bad(reply: FastifyReply, error: string, statusCode = 400) {
  return reply.status(statusCode).send({ success: false, error, statusCode });
}

/** "XXXXXX1234" — enough to recognise an account without being able to pay into it. */
export function maskAccount(n: string | null | undefined): string | null {
  if (!n) return null;
  return n.length <= 4 ? n : `${"•".repeat(Math.min(n.length - 4, 8))}${n.slice(-4)}`;
}

// ─── VALIDATION ──────────────────────────────────────────────────────────────

export const VENDOR_CATEGORIES = [
  "Books & Study Material", "Printing & Stationery", "IT & Software", "Electronics & Equipment",
  "Furniture", "Facility & Maintenance", "Housekeeping & Security", "Catering & Pantry",
  "Transport & Travel", "Marketing & Advertising", "Rent & Utilities", "Professional Services",
  "Events", "Other",
] as const;

export const VENDOR_DOC_TYPES = {
  GST_CERTIFICATE: "GST certificate",
  PAN_CARD: "PAN card",
  CANCELLED_CHEQUE: "Cancelled cheque / bank letter",
  AGREEMENT: "Agreement / contract",
  MSME_CERTIFICATE: "MSME (Udyam) certificate",
  INVOICE: "Invoice",
  PAYMENT_PROOF: "Payment proof",
  OTHER: "Other",
} as const;
export type VendorDocType = keyof typeof VENDOR_DOC_TYPES;
export const VENDOR_ONBOARDING_DOCS: VendorDocType[] = [
  "GST_CERTIFICATE", "PAN_CARD", "CANCELLED_CHEQUE", "AGREEMENT", "MSME_CERTIFICATE", "OTHER",
];
export const PAYMENT_DOCS: VendorDocType[] = ["INVOICE", "PAYMENT_PROOF", "OTHER"];

export const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export const PAN_RE = /^[A-Z]{5}\d{4}[A-Z]$/;
export const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const PINCODE_RE = /^\d{6}$/;

/** Today's calendar date in IST as YYYY-MM-DD. */
export function todayIST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

/** A strict YYYY-MM-DD → Date at UTC midnight, or null if it isn't a real date. */
export function parseDay(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value ? null : d;
}

export const round2 = (n: number) => Math.round(n * 100) / 100;
/** Half a paisa — the tolerance for comparing Float rupee sums. */
export const EPS = 0.005;

export const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });

// ─── NUMBERING ───────────────────────────────────────────────────────────────

function isUniqueClash(err: unknown): boolean {
  return (err as { code?: string })?.code === "P2002";
}

/**
 * Runs `create` with the next number in a `PREFIX0001` sequence, retrying on the
 * rare collision when two requests pick the same number at once (the column is
 * unique, so a clash fails loudly rather than duplicating).
 */
async function withNextNumber<T>(
  prefix: string,
  width: number,
  latest: (prefix: string) => Promise<string | null>,
  create: (number: string) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const last = await latest(prefix);
    const n = last ? parseInt(last.slice(prefix.length), 10) + 1 + attempt : 1 + attempt;
    try {
      return await create(`${prefix}${String(n).padStart(width, "0")}`);
    } catch (err) {
      if (!isUniqueClash(err)) throw err;
    }
  }
  throw new Error(`Could not allocate a number for ${prefix}`);
}

export function createWithVendorCode<T>(create: (code: string) => Promise<T>) {
  return withNextNumber("VEN-", 4, async (prefix) => (await prisma.vendor.findFirst({
    where: { vendorCode: { startsWith: prefix } },
    orderBy: { vendorCode: "desc" },
    select: { vendorCode: true },
  }))?.vendorCode ?? null, create);
}

export function createWithPaymentNumber<T>(create: (number: string) => Promise<T>) {
  const ym = todayIST().slice(0, 7).replace("-", "");
  return withNextNumber(`VP-${ym}-`, 4, async (prefix) => (await prisma.vendorPayment.findFirst({
    where: { paymentNumber: { startsWith: prefix } },
    orderBy: { paymentNumber: "desc" },
    select: { paymentNumber: true },
  }))?.paymentNumber ?? null, create);
}

// ─── PRIVATE FILE STORAGE ────────────────────────────────────────────────────
//
// Deliberately NOT under uploads/: that tree is served to anyone with the URL.
// Vendor files (PAN cards, cancelled cheques, invoices) are only ever streamed
// back through an authenticated route that re-checks access.

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORAGE_DIR = join(__dirname, "../../storage/vendors");
mkdirSync(STORAGE_DIR, { recursive: true });

export const MAX_VENDOR_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

type ParsedUpload =
  | { ok: true; buffer: Buffer; fileName: string; mimeType: string; fields: Record<string, string> }
  | { ok: false; status: number; error: string };

/** Reads one file plus any text fields from a multipart request, enforcing type and size. */
export async function readUpload(request: FastifyRequest): Promise<ParsedUpload> {
  const fields: Record<string, string> = {};
  let file: { buffer: Buffer; fileName: string; mimeType: string } | null = null;
  const parts = request.parts({
    limits: { fileSize: MAX_VENDOR_FILE_BYTES, files: 1 },
    throwFileSizeLimit: false,
  } as any);
  for await (const part of parts) {
    if (part.type === "file") {
      if (!ALLOWED_MIME[part.mimetype]) {
        part.file.resume();
        return { ok: false, status: 400, error: "Only PDF, JPG, PNG or WEBP files are allowed" };
      }
      const chunks: Buffer[] = [];
      for await (const chunk of part.file) chunks.push(chunk as Buffer);
      if (part.file.truncated) {
        return { ok: false, status: 413, error: `File is too large. The maximum is ${MAX_VENDOR_FILE_BYTES / 1024 / 1024} MB.` };
      }
      file = { buffer: Buffer.concat(chunks), fileName: part.filename || "document", mimeType: part.mimetype };
    } else {
      fields[part.fieldname] = String(part.value ?? "");
    }
  }
  if (!file || file.buffer.length === 0) return { ok: false, status: 400, error: "No file uploaded" };
  return { ok: true, ...file, fields };
}

export function storeFile(buffer: Buffer, mimeType: string, originalName: string): string {
  const ext = ALLOWED_MIME[mimeType] ?? (extname(originalName).toLowerCase() || "");
  const stored = `${randomUUID()}${ext}`;
  writeFileSync(join(STORAGE_DIR, stored), buffer);
  return stored;
}

export function removeStoredFile(storedName: string) {
  try { unlinkSync(join(STORAGE_DIR, storedName)); } catch { /* already gone */ }
}

export function streamStoredFile(storedName: string) {
  const path = join(STORAGE_DIR, storedName);
  return existsSync(path) ? createReadStream(path) : null;
}
