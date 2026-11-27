import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@cadb/db";
import type { JwtPayload } from "@cadb/types";
import { authenticate } from "../../middleware/authenticate.js";
import { recordAudit } from "../../utils/auditLog.js";
import { employeesWithPermission, notifyVendorStaff } from "../../utils/notify/vendor.js";
import {
  vendorAccess, forbid, bad, maskAccount, VENDOR_CATEGORIES, VENDOR_DOC_TYPES, VENDOR_ONBOARDING_DOCS,
  PAYMENT_DOCS, GSTIN_RE, PAN_RE, IFSC_RE, PINCODE_RE, createWithVendorCode, readUpload, storeFile,
  removeStoredFile, streamStoredFile, round2, type VendorAccess, type VendorDocType,
} from "../../utils/vendors.js";

/**
 * Vendor registry: onboarding (register → approve) and the vendor master.
 *
 * Permission matrix, module VENDORS:
 *   View    — browse vendors
 *   Create  — register a vendor (and edit / attach documents to your own until it is approved)
 *   Edit    — update any vendor's details and documents
 *   Approve — approve or reject onboarding; deactivate / reactivate
 *   Delete  — remove a vendor that has no payment requests
 *
 * Bank details are the fraud-sensitive part of a vendor record, so changing them
 * on an approved vendor sends it back for approval, and payments cannot be
 * approved or recorded until someone other than the editor signs off.
 */

const blank = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const optText = (max: number) => z.preprocess(blank, z.string().trim().max(max).optional().nullable());
const optUpper = (re: RegExp, msg: string) =>
  z.preprocess((v) => (typeof v === "string" ? (v.trim() === "" ? undefined : v.trim().toUpperCase()) : v),
    z.string().regex(re, msg).optional().nullable());

const vendorSchema = z.object({
  legalName: z.string().trim().min(2, "Legal name is required").max(200),
  tradeName: optText(200),
  category: z.enum(VENDOR_CATEGORIES),
  contactPerson: optText(120),
  phone: z.preprocess(blank, z.string().trim().regex(/^[0-9+\-\s()]{7,20}$/, "Enter a valid phone number").optional().nullable()),
  email: z.preprocess(blank, z.string().trim().email("Enter a valid email").max(200).optional().nullable()),
  address: optText(500),
  city: optText(100),
  state: optText(100),
  pincode: z.preprocess(blank, z.string().trim().regex(PINCODE_RE, "PIN code must be 6 digits").optional().nullable()),
  gstin: optUpper(GSTIN_RE, "GSTIN must look like 29ABCDE1234F1Z5"),
  pan: optUpper(PAN_RE, "PAN must look like ABCDE1234F"),
  udyamNumber: optText(40),
  paymentTermsDays: z.preprocess((v) => (v === "" || v === null ? undefined : v), z.coerce.number().int().min(0).max(365).optional().nullable()),
  bankAccountName: optText(200),
  bankAccountNumber: z.preprocess(blank, z.string().trim().regex(/^[0-9]{6,20}$/, "Account number must be 6–20 digits").optional().nullable()),
  bankIfsc: optUpper(IFSC_RE, "IFSC must look like HDFC0001234"),
  bankName: optText(120),
  bankBranch: optText(120),
  upiId: z.preprocess(blank, z.string().trim().regex(/^[\w.\-]{2,}@[a-zA-Z]{2,}$/, "Enter a valid UPI ID").optional().nullable()),
  notes: optText(2000),
});

const BANK_FIELDS = ["bankAccountName", "bankAccountNumber", "bankIfsc", "bankName", "bankBranch", "upiId"] as const;

const employeeBrief = { select: { id: true, firstName: true, lastName: true, employeeCode: true } } as const;

/** Masks bank numbers for callers who may see the vendor but not pay it. */
function presentVendor<T extends { bankAccountNumber: string | null }>(v: T, access: VendorAccess) {
  return access.seesBankDetails ? v : { ...v, bankAccountNumber: maskAccount(v.bankAccountNumber) };
}

/** May this caller change this vendor's details / documents? */
function canModify(vendor: { createdById: string; status: string }, user: JwtPayload, access: VendorAccess) {
  if (access.vendors.edit) return true;
  // A registrar can keep fixing their own submission until it is approved.
  return access.vendors.create && vendor.createdById === user.sub
    && (vendor.status === "PENDING_APPROVAL" || vendor.status === "REJECTED");
}

function nameOf(e: { firstName: string; lastName: string } | null | undefined) {
  return e ? `${e.firstName} ${e.lastName}`.trim() : "Someone";
}

async function notifyApprovers(vendor: { id: string; legalName: string; vendorCode: string; category: string; statusNote?: string | null }, actor: JwtPayload) {
  const [approvers, me] = await Promise.all([
    employeesWithPermission("VENDORS", "canApprove"),
    prisma.employee.findUnique({ where: { id: actor.sub }, select: { firstName: true, lastName: true } }),
  ]);
  await notifyVendorStaff("VENDOR_REGISTERED", {
    entityType: "Vendor", entityId: vendor.id, employeeIds: approvers, excludeId: actor.sub,
    path: `/dashboard/vendors/${vendor.id}`,
    fields: {
      vendorName: vendor.legalName, vendorCode: vendor.vendorCode, vendorCategory: vendor.category,
      requesterName: nameOf(me), decisionNote: vendor.statusNote ?? undefined,
    },
  });
}

export async function vendorRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  // ── Meta: categories, document types, and what the caller may do ──────────
  fastify.get("/meta", async (request, reply) => {
    const access = await vendorAccess(request.user as JwtPayload);
    return reply.send({
      success: true,
      data: {
        categories: VENDOR_CATEGORIES,
        docTypes: VENDOR_DOC_TYPES,
        onboardingDocTypes: VENDOR_ONBOARDING_DOCS,
        paymentDocTypes: PAYMENT_DOCS,
        access,
      },
    });
  });

  // ── Active vendors for pickers (raising a payment request) ─────────────────
  fastify.get("/lookup", async (request, reply) => {
    const access = await vendorAccess(request.user as JwtPayload);
    if (!access.canBrowseVendors && !access.payments.create && !access.seesAllPayments) return forbid(reply);
    const data = await prisma.vendor.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, vendorCode: true, legalName: true, tradeName: true, category: true, paymentTermsDays: true },
      orderBy: { legalName: "asc" },
    });
    return reply.send({ success: true, data });
  });

  // ── List ──────────────────────────────────────────────────────────────────
  fastify.get("/", async (request, reply) => {
    const access = await vendorAccess(request.user as JwtPayload);
    if (!access.canBrowseVendors) return forbid(reply);
    const q = request.query as Record<string, string | undefined>;

    const where: any = {};
    if (q.status) where.status = q.status;
    if (q.category) where.category = q.category;
    const term = q.q?.trim();
    if (term) {
      where.OR = ["legalName", "tradeName", "vendorCode", "gstin", "pan", "contactPerson", "city", "phone", "email"]
        .map((f) => ({ [f]: { contains: term, mode: "insensitive" } }));
    }

    const [vendors, counts, open] = await Promise.all([
      prisma.vendor.findMany({
        where,
        select: {
          id: true, vendorCode: true, legalName: true, tradeName: true, category: true, city: true,
          state: true, gstin: true, contactPerson: true, phone: true, email: true, status: true,
          statusNote: true, createdAt: true,
        },
        orderBy: [{ legalName: "asc" }],
        take: 1000,
      }),
      prisma.vendor.groupBy({ by: ["status"], _count: { _all: true } }),
      // Outstanding = approved but not yet fully paid. Only meaningful to people
      // who can see payments, so it is left out for everyone else.
      access.seesAllPayments
        ? prisma.vendorPayment.findMany({
            where: { status: { in: ["APPROVED", "PARTIALLY_PAID"] } },
            select: { vendorId: true, amount: true, paidAmount: true, tdsAmount: true },
          })
        : Promise.resolve([]),
    ]);

    const outstanding = new Map<string, number>();
    for (const p of open) {
      outstanding.set(p.vendorId, (outstanding.get(p.vendorId) ?? 0) + p.amount - p.paidAmount - p.tdsAmount);
    }

    return reply.send({
      success: true,
      data: vendors.map((v) => ({ ...v, outstanding: access.seesAllPayments ? round2(outstanding.get(v.id) ?? 0) : null })),
      counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
    });
  });

  // ── Detail ────────────────────────────────────────────────────────────────
  fastify.get("/:id", async (request, reply) => {
    const user = request.user as JwtPayload;
    const access = await vendorAccess(user);
    if (!access.canBrowseVendors) return forbid(reply);
    const { id } = request.params as { id: string };

    const vendor = await prisma.vendor.findUnique({
      where: { id },
      include: {
        createdBy: employeeBrief,
        reviewedBy: employeeBrief,
        documents: {
          where: { paymentId: null },
          include: { uploadedBy: employeeBrief },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!vendor) return bad(reply, "Vendor not found", 404);

    let payments = null;
    let totals = null;
    if (access.seesAllPayments) {
      payments = await prisma.vendorPayment.findMany({
        where: { vendorId: id },
        select: {
          id: true, paymentNumber: true, invoiceNumber: true, invoiceDate: true, description: true,
          amount: true, paidAmount: true, tdsAmount: true, status: true, createdAt: true, paidAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      });
      const live = payments.filter((p) => !["REJECTED", "CANCELLED"].includes(p.status));
      totals = {
        approved: round2(live.filter((p) => p.status !== "PENDING_APPROVAL").reduce((n, p) => n + p.amount, 0)),
        paid: round2(live.reduce((n, p) => n + p.paidAmount, 0)),
        tds: round2(live.reduce((n, p) => n + p.tdsAmount, 0)),
        pending: round2(live.filter((p) => p.status === "PENDING_APPROVAL").reduce((n, p) => n + p.amount, 0)),
        outstanding: round2(live.filter((p) => p.status === "APPROVED" || p.status === "PARTIALLY_PAID")
          .reduce((n, p) => n + p.amount - p.paidAmount - p.tdsAmount, 0)),
      };
    }

    const { documents, ...rest } = vendor;
    return reply.send({
      success: true,
      data: {
        ...presentVendor(rest, access),
        documents: documents.map(({ storedName: _s, ...d }) => d),
        payments,
        totals,
        can: {
          edit: canModify(vendor, user, access),
          review: access.vendors.approve && vendor.status === "PENDING_APPROVAL"
            && (access.isSuperAdmin || vendor.submittedById !== user.sub),
          toggleActive: access.vendors.approve && (vendor.status === "ACTIVE" || vendor.status === "INACTIVE"),
          delete: access.vendors.delete,
        },
      },
    });
  });

  // ── Register ──────────────────────────────────────────────────────────────
  fastify.post("/", async (request, reply) => {
    const user = request.user as JwtPayload;
    const access = await vendorAccess(user);
    if (!access.vendors.create) return forbid(reply);
    const parsed = vendorSchema.safeParse(request.body);
    if (!parsed.success) return bad(reply, parsed.error.issues[0]?.message ?? "Validation failed");

    if (parsed.data.gstin) {
      const dupe = await prisma.vendor.findUnique({ where: { gstin: parsed.data.gstin }, select: { vendorCode: true, legalName: true } });
      if (dupe) return bad(reply, `GSTIN already registered to ${dupe.legalName} (${dupe.vendorCode})`, 409);
    }

    const vendor = await createWithVendorCode((vendorCode) => prisma.vendor.create({
      data: {
        ...parsed.data, vendorCode, status: "PENDING_APPROVAL",
        createdById: user.sub, submittedById: user.sub, statusNote: "New registration",
      },
    }));
    await notifyApprovers(vendor, user);
    return reply.status(201).send({ success: true, data: vendor });
  });

  // ── Update ────────────────────────────────────────────────────────────────
  fastify.patch("/:id", async (request, reply) => {
    const user = request.user as JwtPayload;
    const access = await vendorAccess(user);
    const { id } = request.params as { id: string };
    const vendor = await prisma.vendor.findUnique({ where: { id } });
    if (!vendor) return bad(reply, "Vendor not found", 404);
    if (!canModify(vendor, user, access)) return forbid(reply);

    const parsed = vendorSchema.partial().safeParse(request.body);
    if (!parsed.success) return bad(reply, parsed.error.issues[0]?.message ?? "Validation failed");
    const data: any = { ...parsed.data };

    if (data.gstin && data.gstin !== vendor.gstin) {
      const dupe = await prisma.vendor.findUnique({ where: { gstin: data.gstin }, select: { id: true, vendorCode: true, legalName: true } });
      if (dupe && dupe.id !== id) return bad(reply, `GSTIN already registered to ${dupe.legalName} (${dupe.vendorCode})`, 409);
    }

    // Masked numbers come back from the form untouched — never store the mask.
    if (typeof data.bankAccountNumber === "string" && data.bankAccountNumber.includes("•")) delete data.bankAccountNumber;

    const norm = (v: unknown) => (v === undefined ? undefined : (v ?? null));
    const bankChanged = BANK_FIELDS.some((f) => f in data && norm(data[f]) !== (vendor as any)[f]);

    let resubmitted = false;
    if (vendor.status === "REJECTED") {
      // Fixing a rejected registration resubmits it.
      Object.assign(data, { status: "PENDING_APPROVAL", statusNote: "Resubmitted after rejection", submittedById: user.sub });
      resubmitted = true;
    } else if (bankChanged && (vendor.status === "ACTIVE" || vendor.status === "INACTIVE")) {
      Object.assign(data, { status: "PENDING_APPROVAL", statusNote: "Bank details changed — needs re-approval", submittedById: user.sub });
      resubmitted = true;
    } else if (vendor.status === "PENDING_APPROVAL") {
      data.submittedById = user.sub;
    }

    const updated = await prisma.vendor.update({ where: { id }, data });
    if (resubmitted) await notifyApprovers(updated, user);
    return reply.send({
      success: true,
      data: updated,
      message: resubmitted ? "Saved — sent for approval" : "Vendor updated",
    });
  });

  // ── Approve / reject onboarding ───────────────────────────────────────────
  fastify.post("/:id/review", async (request, reply) => {
    const user = request.user as JwtPayload;
    const access = await vendorAccess(user);
    if (!access.vendors.approve) return forbid(reply);
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { action?: string; note?: string };
    const note = body.note?.trim() || null;
    if (body.action !== "APPROVE" && body.action !== "REJECT") return bad(reply, "action must be APPROVE or REJECT");
    if (body.action === "REJECT" && !note) return bad(reply, "Give a reason for rejecting");

    const vendor = await prisma.vendor.findUnique({ where: { id } });
    if (!vendor) return bad(reply, "Vendor not found", 404);
    if (vendor.status !== "PENDING_APPROVAL") return bad(reply, "This vendor is not awaiting approval", 409);
    if (!access.isSuperAdmin && vendor.submittedById === user.sub) {
      return forbid(reply, "You submitted this vendor for approval — someone else has to approve it");
    }

    const updated = await prisma.vendor.update({
      where: { id },
      data: {
        status: body.action === "APPROVE" ? "ACTIVE" : "REJECTED",
        statusNote: note,
        reviewedById: user.sub,
        reviewedAt: new Date(),
      },
    });
    return reply.send({ success: true, data: updated, message: body.action === "APPROVE" ? "Vendor approved" : "Vendor rejected" });
  });

  // ── Deactivate / reactivate an approved vendor ────────────────────────────
  fastify.post("/:id/status", async (request, reply) => {
    const user = request.user as JwtPayload;
    const access = await vendorAccess(user);
    if (!access.vendors.approve) return forbid(reply);
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { status?: string; note?: string };
    if (body.status !== "ACTIVE" && body.status !== "INACTIVE") return bad(reply, "status must be ACTIVE or INACTIVE");
    const note = body.note?.trim() || null;
    if (body.status === "INACTIVE" && !note) return bad(reply, "Give a reason for deactivating");

    const vendor = await prisma.vendor.findUnique({ where: { id } });
    if (!vendor) return bad(reply, "Vendor not found", 404);
    if (vendor.status !== "ACTIVE" && vendor.status !== "INACTIVE") {
      return bad(reply, "Only approved vendors can be activated or deactivated", 409);
    }
    const updated = await prisma.vendor.update({
      where: { id },
      data: { status: body.status, statusNote: note, reviewedById: user.sub, reviewedAt: new Date() },
    });
    return reply.send({ success: true, data: updated, message: body.status === "ACTIVE" ? "Vendor reactivated" : "Vendor deactivated" });
  });

  // ── Delete (only when nothing was ever raised against it) ─────────────────
  fastify.delete("/:id", async (request, reply) => {
    const user = request.user as JwtPayload;
    const access = await vendorAccess(user);
    if (!access.vendors.delete) return forbid(reply);
    const { id } = request.params as { id: string };
    const reason = ((request.body ?? {}) as { reason?: string }).reason?.trim();
    if (!reason) return bad(reply, "A reason is required");

    const vendor = await prisma.vendor.findUnique({ where: { id }, include: { documents: true, _count: { select: { payments: true } } } });
    if (!vendor) return bad(reply, "Vendor not found", 404);
    if (vendor._count.payments > 0) {
      return bad(reply, "This vendor has payment requests on record — deactivate it instead", 409);
    }

    await prisma.vendor.delete({ where: { id } });
    for (const d of vendor.documents) removeStoredFile(d.storedName);
    await recordAudit({
      request, action: "DELETE", entity: "Vendor", entityId: id,
      summary: `${vendor.legalName} (${vendor.vendorCode}) · ${vendor.category} · was ${vendor.status}`,
      oldValues: { ...vendor, bankAccountNumber: maskAccount(vendor.bankAccountNumber) },
      newValues: { reason },
    });
    return reply.send({ success: true, data: null });
  });

  // ── Onboarding documents ──────────────────────────────────────────────────
  fastify.post("/:id/documents", async (request, reply) => {
    const user = request.user as JwtPayload;
    const access = await vendorAccess(user);
    const { id } = request.params as { id: string };
    const vendor = await prisma.vendor.findUnique({ where: { id } });
    if (!vendor) return bad(reply, "Vendor not found", 404);
    if (!canModify(vendor, user, access)) return forbid(reply);

    const upload = await readUpload(request);
    if (!upload.ok) return bad(reply, upload.error, upload.status);
    const docType = (upload.fields.docType || "OTHER") as VendorDocType;
    if (!VENDOR_ONBOARDING_DOCS.includes(docType)) return bad(reply, "Invalid document type");

    const storedName = storeFile(upload.buffer, upload.mimeType, upload.fileName);
    const doc = await prisma.vendorDocument.create({
      data: {
        vendorId: id, docType, fileName: upload.fileName.slice(0, 200), storedName,
        mimeType: upload.mimeType, sizeBytes: upload.buffer.length, uploadedById: user.sub,
      },
    });
    const { storedName: _s, ...data } = doc;
    return reply.status(201).send({ success: true, data });
  });

  // ── Download any vendor / payment document (access re-checked) ────────────
  fastify.get("/documents/:docId/file", async (request, reply) => {
    const user = request.user as JwtPayload;
    const access = await vendorAccess(user);
    const { docId } = request.params as { docId: string };
    const doc = await prisma.vendorDocument.findUnique({
      where: { id: docId },
      include: { payment: { select: { requestedById: true } }, vendor: { select: { createdById: true } } },
    });
    if (!doc) return bad(reply, "Document not found", 404);

    const allowed = doc.paymentId
      ? access.seesAllPayments || doc.payment?.requestedById === user.sub
      : access.canBrowseVendors || doc.vendor.createdById === user.sub;
    if (!allowed) return forbid(reply);

    const stream = streamStoredFile(doc.storedName);
    if (!stream) return bad(reply, "The file is missing from storage", 404);
    const safeName = doc.fileName.replace(/[^\w.\- ]+/g, "_");
    return reply
      .header("Content-Type", doc.mimeType)
      .header("Content-Disposition", `inline; filename="${safeName}"`)
      .header("Cache-Control", "private, no-store")
      .send(stream);
  });

  fastify.delete("/documents/:docId", async (request, reply) => {
    const user = request.user as JwtPayload;
    const access = await vendorAccess(user);
    const { docId } = request.params as { docId: string };
    const doc = await prisma.vendorDocument.findUnique({
      where: { id: docId },
      include: { vendor: true, payment: { select: { requestedById: true, status: true } } },
    });
    if (!doc) return bad(reply, "Document not found", 404);

    const allowed = doc.paymentId
      ? access.payments.edit || access.payments.approve
        || (doc.payment?.requestedById === user.sub && doc.payment?.status === "PENDING_APPROVAL")
      : canModify(doc.vendor, user, access);
    if (!allowed) return forbid(reply);

    await prisma.vendorDocument.delete({ where: { id: docId } });
    removeStoredFile(doc.storedName);
    return reply.send({ success: true, data: null });
  });
}
