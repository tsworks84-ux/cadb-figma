import type { FastifyInstance } from "fastify";
import { z } from "zod";
import ExcelJS from "exceljs";
import { prisma } from "@cadb/db";
import type { JwtPayload } from "@cadb/types";
import { authenticate } from "../../middleware/authenticate.js";
import { recordAudit } from "../../utils/auditLog.js";
import { employeesWithPermission, notifyVendorStaff } from "../../utils/notify/vendor.js";
import {
  vendorAccess, forbid, bad, maskAccount, PAYMENT_DOCS, readUpload, storeFile, parseDay, todayIST,
  createWithPaymentNumber, round2, EPS, inr, type VendorAccess, type VendorDocType,
} from "../../utils/vendors.js";

/**
 * Vendor payments: request → approval by the designated authority → payment by
 * Accounts.
 *
 * Permission matrix, module VENDOR_PAYMENTS:
 *   Create  — raise a payment request (you always see your own)
 *   Approve — the approving authority: approve (= clear for payment) or reject
 *   Edit    — Accounts: record payments made against cleared requests
 *   View    — see every request (Approve / Edit / Delete imply it)
 *   Delete  — void a wrongly recorded payment transaction
 *
 * Status: PENDING_APPROVAL → APPROVED (cleared) → PARTIALLY_PAID → PAID,
 *         or REJECTED / CANCELLED.
 * Nobody approves their own request (Super Admin excepted), and money only moves
 * to a vendor whose details are currently approved.
 */

const MODES = ["NEFT", "RTGS", "IMPS", "UPI", "CHEQUE", "DD", "CASH", "CARD", "OTHER"] as const;
const OPEN_STATUSES = ["APPROVED", "PARTIALLY_PAID"] as const;

const blank = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

const requestSchema = z.object({
  vendorId: z.string().min(1, "Pick a vendor"),
  invoiceNumber: z.preprocess(blank, z.string().trim().max(60).optional().nullable()),
  invoiceDate: z.preprocess(blank, z.string().optional().nullable()),
  dueDate: z.preprocess(blank, z.string().optional().nullable()),
  description: z.string().trim().min(3, "Describe what the payment is for").max(1000),
  amount: z.coerce.number().positive("Amount must be more than zero").max(1e10),
  departmentId: z.preprocess(blank, z.string().optional().nullable()),
});

const txnSchema = z.object({
  amount: z.coerce.number().min(0).max(1e10),
  tdsAmount: z.preprocess(blank, z.coerce.number().min(0).max(1e10).optional()),
  mode: z.enum(MODES),
  transactionRef: z.preprocess(blank, z.string().trim().max(100).optional().nullable()),
  paymentDate: z.string(),
  remarks: z.preprocess(blank, z.string().trim().max(1000).optional().nullable()),
});

const employeeBrief = { select: { id: true, firstName: true, lastName: true, employeeCode: true } } as const;
const nameOf = (e: { firstName: string; lastName: string } | null | undefined) =>
  e ? `${e.firstName} ${e.lastName}`.trim() : "Someone";

/** Where a caller may look: everything, or only what they raised. */
function scopeWhere(user: JwtPayload, access: VendorAccess) {
  return access.seesAllPayments ? {} : { requestedById: user.sub };
}

function balanceOf(p: { amount: number; paidAmount: number; tdsAmount: number }) {
  return round2(p.amount - p.paidAmount - p.tdsAmount);
}

function listWhere(q: Record<string, string | undefined>, user: JwtPayload, access: VendorAccess) {
  const where: any = { ...scopeWhere(user, access) };
  if (q.status === "OPEN") where.status = { in: OPEN_STATUSES };
  else if (q.status) where.status = q.status;
  if (q.vendorId) where.vendorId = q.vendorId;
  if (q.mine === "1") where.requestedById = user.sub;
  const from = parseDay(q.from);
  const to = parseDay(q.to);
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lt: new Date(to.getTime() + 86_400_000) } : {}),
    };
  }
  const term = q.q?.trim();
  if (term) {
    where.OR = [
      { paymentNumber: { contains: term, mode: "insensitive" } },
      { invoiceNumber: { contains: term, mode: "insensitive" } },
      { description: { contains: term, mode: "insensitive" } },
      { vendor: { legalName: { contains: term, mode: "insensitive" } } },
      { vendor: { tradeName: { contains: term, mode: "insensitive" } } },
      { vendor: { vendorCode: { contains: term, mode: "insensitive" } } },
      { transactions: { some: { transactionRef: { contains: term, mode: "insensitive" } } } },
    ];
  }
  return where;
}

async function notifyFields(paymentId: string) {
  const p = await prisma.vendorPayment.findUnique({
    where: { id: paymentId },
    include: { vendor: true, requestedBy: employeeBrief, approver: employeeBrief },
  });
  if (!p) return null;
  return {
    p,
    fields: {
      paymentNumber: p.paymentNumber,
      vendorName: p.vendor.legalName,
      vendorCode: p.vendor.vendorCode,
      amount: inr.format(p.amount),
      invoiceNumber: p.invoiceNumber ?? undefined,
      reason: p.description,
      requesterName: nameOf(p.requestedBy),
      approverName: nameOf(p.approver),
      decisionNote: p.decisionNote ?? undefined,
      paidSummary: `${inr.format(p.paidAmount)} paid${p.tdsAmount > 0 ? ` + ${inr.format(p.tdsAmount)} TDS` : ""}`,
    },
  };
}

/** Re-derives the running totals and status from the transaction rows. */
async function recompute(tx: any, paymentId: string) {
  const payment = await tx.vendorPayment.findUnique({ where: { id: paymentId } });
  const sums = await tx.vendorPaymentTransaction.aggregate({
    where: { paymentId },
    _sum: { amount: true, tdsAmount: true },
    _max: { paymentDate: true },
  });
  const paid = round2(sums._sum.amount ?? 0);
  const tds = round2(sums._sum.tdsAmount ?? 0);
  const settled = paid + tds >= payment.amount - EPS;
  const status = settled ? "PAID" : paid + tds > EPS ? "PARTIALLY_PAID" : "APPROVED";
  return tx.vendorPayment.update({
    where: { id: paymentId },
    data: { paidAmount: paid, tdsAmount: tds, status, paidAt: settled ? sums._max.paymentDate : null },
  });
}

export async function vendorPaymentRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  // ── Counts per status (tab badges) + money totals ─────────────────────────
  fastify.get("/summary", async (request, reply) => {
    const user = request.user as JwtPayload;
    const access = await vendorAccess(user);
    if (!access.payments.create && !access.seesAllPayments) return forbid(reply);
    const where = scopeWhere(user, access);
    const [byStatus, open] = await Promise.all([
      prisma.vendorPayment.groupBy({ by: ["status"], where, _count: { _all: true }, _sum: { amount: true } }),
      prisma.vendorPayment.findMany({
        where: { ...where, status: { in: [...OPEN_STATUSES] } },
        select: { amount: true, paidAmount: true, tdsAmount: true },
      }),
    ]);
    const counts = Object.fromEntries(byStatus.map((s) => [s.status, s._count._all]));
    const amounts = Object.fromEntries(byStatus.map((s) => [s.status, round2(s._sum.amount ?? 0)]));
    return reply.send({
      success: true,
      data: {
        counts,
        amounts,
        clearedOutstanding: round2(open.reduce((n, p) => n + balanceOf(p), 0)),
      },
    });
  });

  // ── List ──────────────────────────────────────────────────────────────────
  fastify.get("/", async (request, reply) => {
    const user = request.user as JwtPayload;
    const access = await vendorAccess(user);
    if (!access.payments.create && !access.seesAllPayments) return forbid(reply);
    const q = request.query as Record<string, string | undefined>;

    const data = await prisma.vendorPayment.findMany({
      where: listWhere(q, user, access),
      include: {
        vendor: { select: { id: true, vendorCode: true, legalName: true, tradeName: true, status: true } },
        requestedBy: employeeBrief,
        approver: employeeBrief,
        department: { select: { id: true, name: true } },
        _count: { select: { transactions: true, documents: true } },
      },
      // Oldest first while something is waiting on someone; newest first otherwise.
      orderBy: q.status === "PENDING_APPROVAL" || q.status === "OPEN" ? { createdAt: "asc" } : { createdAt: "desc" },
      take: 500,
    });
    return reply.send({ success: true, data: data.map((p) => ({ ...p, balance: balanceOf(p) })) });
  });

  // ── Excel export (same filters as the list) ───────────────────────────────
  fastify.get("/export", async (request, reply) => {
    const user = request.user as JwtPayload;
    const access = await vendorAccess(user);
    if (!access.seesAllPayments) return forbid(reply);
    const q = request.query as Record<string, string | undefined>;

    const rows = await prisma.vendorPayment.findMany({
      where: listWhere(q, user, access),
      include: {
        vendor: { select: { vendorCode: true, legalName: true, gstin: true } },
        requestedBy: employeeBrief,
        approver: employeeBrief,
        department: { select: { name: true } },
        transactions: { orderBy: { paymentDate: "asc" } },
      },
      orderBy: { createdAt: "desc" },
      take: 5000,
    });

    const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");
    const wb = new ExcelJS.Workbook();
    const reqSheet = wb.addWorksheet("Payment requests");
    reqSheet.columns = [
      { header: "Request No.", key: "no", width: 18 }, { header: "Raised on", key: "raised", width: 12 },
      { header: "Vendor code", key: "vcode", width: 11 }, { header: "Vendor", key: "vendor", width: 32 },
      { header: "GSTIN", key: "gstin", width: 17 }, { header: "Invoice No.", key: "inv", width: 16 },
      { header: "Invoice date", key: "invDate", width: 12 }, { header: "Due date", key: "due", width: 12 },
      { header: "Department", key: "dept", width: 18 }, { header: "Purpose", key: "desc", width: 40 },
      { header: "Amount", key: "amount", width: 14 }, { header: "Paid", key: "paid", width: 14 },
      { header: "TDS", key: "tds", width: 12 }, { header: "Balance", key: "balance", width: 14 },
      { header: "Status", key: "status", width: 16 }, { header: "Requested by", key: "by", width: 22 },
      { header: "Decided by", key: "approver", width: 22 }, { header: "Decided on", key: "decided", width: 12 },
      { header: "Paid on", key: "paidAt", width: 12 },
    ];
    const txnSheet = wb.addWorksheet("Transactions");
    txnSheet.columns = [
      { header: "Request No.", key: "no", width: 18 }, { header: "Vendor", key: "vendor", width: 32 },
      { header: "Payment date", key: "date", width: 12 }, { header: "Mode", key: "mode", width: 9 },
      { header: "Transaction ref.", key: "ref", width: 24 }, { header: "Amount", key: "amount", width: 14 },
      { header: "TDS", key: "tds", width: 12 }, { header: "Remarks", key: "remarks", width: 40 },
    ];
    for (const p of rows) {
      reqSheet.addRow({
        no: p.paymentNumber, raised: day(p.createdAt), vcode: p.vendor.vendorCode, vendor: p.vendor.legalName,
        gstin: p.vendor.gstin ?? "", inv: p.invoiceNumber ?? "", invDate: day(p.invoiceDate), due: day(p.dueDate),
        dept: p.department?.name ?? "", desc: p.description, amount: p.amount, paid: p.paidAmount, tds: p.tdsAmount,
        balance: ["REJECTED", "CANCELLED"].includes(p.status) ? 0 : balanceOf(p), status: p.status.replace(/_/g, " "),
        by: nameOf(p.requestedBy), approver: p.approver ? nameOf(p.approver) : "", decided: day(p.decidedAt),
        paidAt: day(p.paidAt),
      });
      for (const t of p.transactions) {
        txnSheet.addRow({
          no: p.paymentNumber, vendor: p.vendor.legalName, date: day(t.paymentDate), mode: t.mode,
          ref: t.transactionRef ?? "", amount: t.amount, tds: t.tdsAmount, remarks: t.remarks ?? "",
        });
      }
    }
    for (const sheet of [reqSheet, txnSheet]) {
      sheet.getRow(1).font = { bold: true };
      sheet.views = [{ state: "frozen", ySplit: 1 }];
    }
    for (const key of ["amount", "paid", "tds", "balance"]) reqSheet.getColumn(key).numFmt = "#,##0.00";
    for (const key of ["amount", "tds"]) txnSheet.getColumn(key).numFmt = "#,##0.00";

    const buffer = await wb.xlsx.writeBuffer();
    return reply
      .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .header("Content-Disposition", `attachment; filename="vendor_payments_${todayIST()}.xlsx"`)
      .send(Buffer.from(buffer));
  });

  // ── Detail ────────────────────────────────────────────────────────────────
  fastify.get("/:id", async (request, reply) => {
    const user = request.user as JwtPayload;
    const access = await vendorAccess(user);
    const { id } = request.params as { id: string };
    const p = await prisma.vendorPayment.findFirst({
      where: { id, ...scopeWhere(user, access) },
      include: {
        vendor: {
          select: {
            id: true, vendorCode: true, legalName: true, tradeName: true, status: true, statusNote: true,
            gstin: true, pan: true, paymentTermsDays: true, contactPerson: true, phone: true, email: true,
            bankAccountName: true, bankAccountNumber: true, bankIfsc: true, bankName: true, bankBranch: true, upiId: true,
          },
        },
        requestedBy: employeeBrief,
        approver: employeeBrief,
        department: { select: { id: true, name: true } },
        transactions: { include: { recordedBy: employeeBrief }, orderBy: [{ paymentDate: "asc" }, { createdAt: "asc" }] },
        documents: { include: { uploadedBy: employeeBrief }, orderBy: { createdAt: "asc" } },
      },
    });
    if (!p) return bad(reply, "Payment request not found", 404);

    const vendorActive = p.vendor.status === "ACTIVE";
    const isRequester = p.requestedById === user.sub;
    const open = p.status === "APPROVED" || p.status === "PARTIALLY_PAID";
    return reply.send({
      success: true,
      data: {
        ...p,
        vendor: access.seesBankDetails ? p.vendor : { ...p.vendor, bankAccountNumber: maskAccount(p.vendor.bankAccountNumber) },
        documents: p.documents.map(({ storedName: _s, ...d }) => d),
        balance: balanceOf(p),
        can: {
          decide: access.payments.approve && p.status === "PENDING_APPROVAL" && (access.isSuperAdmin || !isRequester),
          recordPayment: access.payments.edit && open,
          voidTransaction: access.payments.delete,
          cancel: (isRequester && p.status === "PENDING_APPROVAL")
            || (access.payments.approve && p.status === "APPROVED" && p.transactions.length === 0),
          attach: (isRequester && p.status === "PENDING_APPROVAL") || access.payments.edit || access.payments.approve,
          selfApprovalBlocked: access.payments.approve && p.status === "PENDING_APPROVAL" && isRequester && !access.isSuperAdmin,
          vendorActive,
        },
      },
    });
  });

  // ── Raise a request ───────────────────────────────────────────────────────
  fastify.post("/", async (request, reply) => {
    const user = request.user as JwtPayload;
    const access = await vendorAccess(user);
    if (!access.payments.create) return forbid(reply);
    const parsed = requestSchema.safeParse(request.body);
    if (!parsed.success) return bad(reply, parsed.error.issues[0]?.message ?? "Validation failed");
    const d = parsed.data;

    const vendor = await prisma.vendor.findUnique({ where: { id: d.vendorId } });
    if (!vendor) return bad(reply, "Vendor not found", 404);
    if (vendor.status !== "ACTIVE") return bad(reply, "Payments can only be raised against an approved, active vendor", 409);

    const invoiceDate = d.invoiceDate ? parseDay(d.invoiceDate) : null;
    const dueDate = d.dueDate ? parseDay(d.dueDate) : null;
    if (d.invoiceDate && !invoiceDate) return bad(reply, "Invalid invoice date");
    if (d.dueDate && !dueDate) return bad(reply, "Invalid due date");
    if (d.invoiceDate && d.invoiceDate > todayIST()) return bad(reply, "Invoice date cannot be in the future");

    if (d.departmentId) {
      const dept = await prisma.department.findUnique({ where: { id: d.departmentId }, select: { id: true } });
      if (!dept) return bad(reply, "Department not found");
    }

    // The same invoice paid twice is the classic vendor-payment mistake.
    if (d.invoiceNumber) {
      const dupe = await prisma.vendorPayment.findFirst({
        where: {
          vendorId: d.vendorId,
          invoiceNumber: { equals: d.invoiceNumber, mode: "insensitive" },
          status: { notIn: ["REJECTED", "CANCELLED"] },
        },
        select: { paymentNumber: true },
      });
      if (dupe) return bad(reply, `Invoice ${d.invoiceNumber} from this vendor is already on request ${dupe.paymentNumber}`, 409);
    }

    const created = await createWithPaymentNumber((paymentNumber) => prisma.vendorPayment.create({
      data: {
        paymentNumber, vendorId: d.vendorId, invoiceNumber: d.invoiceNumber ?? null, invoiceDate, dueDate,
        description: d.description, amount: round2(d.amount), departmentId: d.departmentId ?? null,
        requestedById: user.sub, status: "PENDING_APPROVAL",
      },
    }));

    const info = await notifyFields(created.id);
    if (info) {
      await notifyVendorStaff("VENDOR_PAYMENT_REQUESTED", {
        entityType: "VendorPayment", entityId: created.id,
        employeeIds: await employeesWithPermission("VENDOR_PAYMENTS", "canApprove"),
        excludeId: user.sub,
        path: `/dashboard/vendors/payments?open=${created.id}`,
        fields: info.fields,
      });
    }
    return reply.status(201).send({ success: true, data: created });
  });

  // ── Attach invoice / proof ────────────────────────────────────────────────
  fastify.post("/:id/documents", async (request, reply) => {
    const user = request.user as JwtPayload;
    const access = await vendorAccess(user);
    const { id } = request.params as { id: string };
    const p = await prisma.vendorPayment.findUnique({ where: { id } });
    if (!p) return bad(reply, "Payment request not found", 404);
    const allowed = (p.requestedById === user.sub && p.status === "PENDING_APPROVAL")
      || access.payments.edit || access.payments.approve;
    if (!allowed) return forbid(reply);

    const upload = await readUpload(request);
    if (!upload.ok) return bad(reply, upload.error, upload.status);
    const docType = (upload.fields.docType || "INVOICE") as VendorDocType;
    if (!PAYMENT_DOCS.includes(docType)) return bad(reply, "Invalid document type");

    const storedName = storeFile(upload.buffer, upload.mimeType, upload.fileName);
    const doc = await prisma.vendorDocument.create({
      data: {
        vendorId: p.vendorId, paymentId: id, docType, fileName: upload.fileName.slice(0, 200), storedName,
        mimeType: upload.mimeType, sizeBytes: upload.buffer.length, uploadedById: user.sub,
      },
    });
    const { storedName: _s, ...data } = doc;
    return reply.status(201).send({ success: true, data });
  });

  // ── Approving authority decides ───────────────────────────────────────────
  fastify.post("/:id/decision", async (request, reply) => {
    const user = request.user as JwtPayload;
    const access = await vendorAccess(user);
    if (!access.payments.approve) return forbid(reply);
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { action?: string; note?: string };
    const note = body.note?.trim() || null;
    if (body.action !== "APPROVE" && body.action !== "REJECT") return bad(reply, "action must be APPROVE or REJECT");
    if (body.action === "REJECT" && !note) return bad(reply, "Give a reason for rejecting");

    const p = await prisma.vendorPayment.findUnique({ where: { id }, include: { vendor: { select: { status: true } } } });
    if (!p) return bad(reply, "Payment request not found", 404);
    if (p.status !== "PENDING_APPROVAL") return bad(reply, "This request is not awaiting approval", 409);
    if (!access.isSuperAdmin && p.requestedById === user.sub) {
      return forbid(reply, "You raised this request — someone else has to approve it");
    }
    if (body.action === "APPROVE" && p.vendor.status !== "ACTIVE") {
      return bad(reply, "The vendor is not active (its details may be awaiting re-approval) — it can't be cleared for payment yet", 409);
    }

    // Conditional update: two approvers clicking at once can't both decide.
    const res = await prisma.vendorPayment.updateMany({
      where: { id, status: "PENDING_APPROVAL" },
      data: {
        status: body.action === "APPROVE" ? "APPROVED" : "REJECTED",
        approverId: user.sub, decidedAt: new Date(), decisionNote: note,
      },
    });
    if (res.count === 0) return bad(reply, "This request was decided by someone else just now", 409);

    const info = await notifyFields(id);
    if (info) {
      const path = `/dashboard/vendors/payments?open=${id}`;
      if (body.action === "APPROVE") {
        const accounts = await employeesWithPermission("VENDOR_PAYMENTS", "canEdit");
        await notifyVendorStaff("VENDOR_PAYMENT_APPROVED", {
          entityType: "VendorPayment", entityId: id, employeeIds: [info.p.requestedById, ...accounts],
          excludeId: user.sub, path, fields: info.fields,
        });
      } else {
        await notifyVendorStaff("VENDOR_PAYMENT_REJECTED", {
          entityType: "VendorPayment", entityId: id, employeeIds: [info.p.requestedById],
          excludeId: user.sub, path, fields: info.fields,
        });
      }
    }
    return reply.send({
      success: true,
      message: body.action === "APPROVE" ? "Approved — cleared for payment" : "Request rejected",
    });
  });

  // ── Cancel ────────────────────────────────────────────────────────────────
  // The requester can withdraw while it awaits approval; an approver can pull
  // back a clearance as long as no money has gone out against it.
  fastify.post("/:id/cancel", async (request, reply) => {
    const user = request.user as JwtPayload;
    const access = await vendorAccess(user);
    const { id } = request.params as { id: string };
    const reason = ((request.body ?? {}) as { reason?: string }).reason?.trim();
    if (!reason) return bad(reply, "Give a reason for cancelling");

    const p = await prisma.vendorPayment.findUnique({ where: { id }, include: { _count: { select: { transactions: true } } } });
    if (!p) return bad(reply, "Payment request not found", 404);
    const allowed = (p.requestedById === user.sub && p.status === "PENDING_APPROVAL")
      || (access.payments.approve && p.status === "APPROVED" && p._count.transactions === 0);
    if (!allowed) {
      return bad(reply, p.status === "PENDING_APPROVAL" || p.status === "APPROVED"
        ? "You can't cancel this request"
        : `A request that is ${p.status.replace(/_/g, " ").toLowerCase()} can't be cancelled`, 403);
    }
    const res = await prisma.vendorPayment.updateMany({
      where: { id, status: p.status, transactions: { none: {} } },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: reason },
    });
    if (res.count === 0) return bad(reply, "The request changed just now — reload and try again", 409);
    return reply.send({ success: true, message: "Request cancelled" });
  });

  // ── Accounts records a payment ────────────────────────────────────────────
  fastify.post("/:id/transactions", async (request, reply) => {
    const user = request.user as JwtPayload;
    const access = await vendorAccess(user);
    if (!access.payments.edit) return forbid(reply);
    const { id } = request.params as { id: string };
    const parsed = txnSchema.safeParse(request.body);
    if (!parsed.success) return bad(reply, parsed.error.issues[0]?.message ?? "Validation failed");
    const d = parsed.data;
    const tds = round2(d.tdsAmount ?? 0);
    const amount = round2(d.amount);

    if (amount + tds <= 0) return bad(reply, "Enter the amount paid");
    const paymentDate = parseDay(d.paymentDate);
    if (!paymentDate) return bad(reply, "Enter a valid payment date");
    if (d.paymentDate > todayIST()) return bad(reply, "Payment date cannot be in the future");
    if (d.mode !== "CASH" && !d.transactionRef) return bad(reply, "Enter the transaction reference (UTR / cheque no.)");

    try {
      const result = await prisma.$transaction(async (tx) => {
        // Lock the request row so two clerks can't both pay the last balance.
        await tx.$queryRaw`SELECT id FROM "VendorPayment" WHERE id = ${id} FOR UPDATE`;
        const p = await tx.vendorPayment.findUnique({ where: { id }, include: { vendor: { select: { status: true } } } });
        if (!p) throw new HttpError(404, "Payment request not found");
        if (p.status !== "APPROVED" && p.status !== "PARTIALLY_PAID") {
          throw new HttpError(409, p.status === "PAID" ? "This request is already paid in full" : "This request has not been cleared for payment");
        }
        if (p.vendor.status !== "ACTIVE") {
          throw new HttpError(409, "The vendor is not active (its bank details may be awaiting re-approval) — payment can't be recorded");
        }
        const balance = balanceOf(p);
        if (amount + tds > balance + EPS) {
          throw new HttpError(400, `That is more than the balance of ${inr.format(balance)}`);
        }
        await tx.vendorPaymentTransaction.create({
          data: {
            paymentId: id, amount, tdsAmount: tds, mode: d.mode, transactionRef: d.transactionRef ?? null,
            paymentDate, remarks: d.remarks ?? null, recordedById: user.sub,
          },
        });
        return recompute(tx, id);
      });

      if (result.status === "PAID") {
        const info = await notifyFields(id);
        if (info) {
          await notifyVendorStaff("VENDOR_PAYMENT_PAID", {
            entityType: "VendorPayment", entityId: id, employeeIds: [info.p.requestedById],
            excludeId: user.sub, path: `/dashboard/vendors/payments?open=${id}`, fields: info.fields,
          });
        }
      }
      return reply.status(201).send({
        success: true,
        data: result,
        message: result.status === "PAID" ? "Payment recorded — request settled in full" : "Part payment recorded",
      });
    } catch (err) {
      if (err instanceof HttpError) return bad(reply, err.message, err.status);
      throw err;
    }
  });

  // ── Void a wrongly recorded transaction ───────────────────────────────────
  fastify.delete("/:id/transactions/:txnId", async (request, reply) => {
    const user = request.user as JwtPayload;
    const access = await vendorAccess(user);
    if (!access.payments.delete) return forbid(reply);
    const { id, txnId } = request.params as { id: string; txnId: string };
    const reason = ((request.body ?? {}) as { reason?: string }).reason?.trim();
    if (!reason) return bad(reply, "A reason is required");

    const txn = await prisma.vendorPaymentTransaction.findFirst({
      where: { id: txnId, paymentId: id },
      include: { payment: { include: { vendor: { select: { legalName: true, vendorCode: true } } } } },
    });
    if (!txn) return bad(reply, "Transaction not found", 404);

    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "VendorPayment" WHERE id = ${id} FOR UPDATE`;
      await tx.vendorPaymentTransaction.delete({ where: { id: txnId } });
      await recompute(tx, id);
    });

    await recordAudit({
      request, action: "DELETE", entity: "VendorPaymentTransaction", entityId: txnId,
      summary: `${txn.payment.paymentNumber} · ${txn.payment.vendor.legalName} (${txn.payment.vendor.vendorCode}) · ${inr.format(txn.amount)}${txn.tdsAmount ? ` + ${inr.format(txn.tdsAmount)} TDS` : ""} · ${txn.mode} ${txn.transactionRef ?? ""} · ${txn.paymentDate.toISOString().slice(0, 10)}`.trim(),
      oldValues: { ...txn, payment: undefined },
      newValues: { reason },
    });
    return reply.send({ success: true, message: "Transaction voided" });
  });
}

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
