import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "@cadb/db";
import { authenticate, requireRole } from "../../middleware/authenticate.js";
import { hashPassword } from "../../utils/password.js";
import { sendCredentialsMail } from "../../utils/mailer.js";
import type { JwtPayload } from "@cadb/types";
import { randomUUID } from "crypto";
import { uploadFile } from "../../utils/s3.js";
import { createWriteStream, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { pipeline } from "stream/promises";

const __dirname_emp = dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR_EMP = join(__dirname_emp, "../../../uploads");
mkdirSync(UPLOADS_DIR_EMP, { recursive: true });
const ALLOWED_QUAL_MIME = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const MAX_QUAL_SIZE = 5 * 1024 * 1024;

const addressSchema = z.object({
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  pincode: z.string().min(6).max(6),
  country: z.string().default("India"),
});

const createEmployeeSchema = z.object({
  // Required — name + contact + employment
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  middleName: z.string().optional(),
  email: z.string().email(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]),
  personalPhone: z.string().min(10).max(15),
  personalEmail: z.string().email().optional(),
  departmentId: z.string().cuid(),
  designationId: z.string().cuid(),
  reportingToId: z.string().cuid().optional(),
  employmentType: z.enum(["FULL_TIME", "PART_TIME", "CONTRACT", "VISITING", "INTERN"]).default("FULL_TIME"),
  joiningDate: z.string(),
  role: z.string().default("EMPLOYEE"),
  workLocation: z.string().optional(),
  isDraft: z.boolean().optional(),
  initialPassword: z.string().min(8).optional(),
  // Optional — employee fills these in after first login
  dateOfBirth: z.string().optional(),
  maritalStatus: z.enum(["SINGLE", "MARRIED", "DIVORCED", "WIDOWED"]).optional(),
  bloodGroup: z.enum(["A_POS", "A_NEG", "B_POS", "B_NEG", "AB_POS", "AB_NEG", "O_POS", "O_NEG"]).optional(),
  nationality: z.string().default("Indian"),
  currentAddress: addressSchema.optional(),
  permanentAddress: addressSchema.optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  emergencyRelation: z.string().optional(),
});

const qualificationSchema = z.object({
  level: z.enum(["SCHOOL", "UG", "PG", "PHD", "DIPLOMA", "CERTIFICATION", "OTHER"]),
  degreeName: z.string().min(1),
  specialization: z.string().optional(),
  institution: z.string().min(1),
  boardUniversity: z.string().min(1),
  yearOfPassing: z.number().int().min(1950).max(new Date().getFullYear()),
  percentage: z.number().min(0).max(100).optional(),
  cgpa: z.number().min(0).max(10).optional(),
});

const certificationSchema = z.object({
  name: z.string().min(1),
  issuingBody: z.string().min(1),
  credentialId: z.string().optional(),
  issueDate: z.string(),
  expiryDate: z.string().optional(),
});

async function generateEmployeeCode(joiningDate: Date): Promise<string> {
  const yy = String(joiningDate.getFullYear()).slice(-2);
  const mm = String(joiningDate.getMonth() + 1).padStart(2, "0");
  const prefix = `${yy}${mm}`;

  // Serial is global across all employees (not per-month), ignoring special codes like SA0001
  const all = await prisma.employee.findMany({ select: { employeeCode: true } });
  let maxSerial = 0;
  for (const { employeeCode } of all) {
    if (/^\d{7}$/.test(employeeCode)) {
      const s = parseInt(employeeCode.slice(4), 10);
      if (s > maxSerial) maxSerial = s;
    }
  }

  return `${prefix}${String(maxSerial + 1).padStart(3, "0")}`;
}

const PROFILE_FIELDS = [
  { key: "dateOfBirth",          label: "Date of Birth" },
  { key: "bloodGroup",           label: "Blood Group" },
  { key: "maritalStatus",        label: "Marital Status" },
  { key: "currentAddress",       label: "Current Address" },
  { key: "emergencyContactName", label: "Emergency Contact Name" },
  { key: "emergencyContactPhone",label: "Emergency Contact Phone" },
  { key: "emergencyRelation",    label: "Emergency Relation" },
];

function profileCompleteness(emp: Record<string, unknown>) {
  const missing = PROFILE_FIELDS.filter((f) => !emp[f.key]).map((f) => f.label);
  return {
    profileScore:   PROFILE_FIELDS.length - missing.length,
    profileTotal:   PROFILE_FIELDS.length,
    profileComplete: missing.length === 0,
    profileMissing: missing,
  };
}

// Returns true if the target employee belongs to any of the given departments,
// checking both their primary departmentId and any EmployeeDepartment membership rows.
async function isInDepts(employeeId: string, deptIds: string[]): Promise<boolean> {
  if (deptIds.length === 0) return false;
  const emp = await prisma.employee.findFirst({
    where: {
      id: employeeId,
      OR: [
        { departmentId: { in: deptIds } },
        { deptMemberships: { some: { departmentId: { in: deptIds } } } },
      ],
    },
    select: { id: true },
  });
  return emp !== null;
}

// Returns false (and sends 403) if the requester cannot access the target employee.
// SUPER_ADMIN and HR_ADMIN have unrestricted access.
// DEPT_HEAD can only access employees in departments they head.
// Custom roles can only access employees in their configured department access list.
// EMPLOYEE can only access their own record.
async function assertCanAccess(
  user: JwtPayload,
  targetId: string,
  reply: FastifyReply,
): Promise<boolean> {
  if (user.role === "SUPER_ADMIN" || user.role === "HR_ADMIN") return true;
  if (user.sub === targetId) return true;
  if (user.role === "DEPT_HEAD") {
    const headDepts = await prisma.employeeDepartment.findMany({
      where: { employeeId: user.sub, isHead: true },
      select: { departmentId: true },
    });
    const deptIds = headDepts.map((m) => m.departmentId);
    if (await isInDepts(targetId, deptIds)) return true;
  } else if (user.role !== "EMPLOYEE") {
    // Custom role — check RoleDepartmentAccess
    const access = await prisma.roleDepartmentAccess.findMany({
      where: { roleName: user.role },
      select: { departmentId: true },
    });
    if (access.length > 0) {
      const deptIds = access.map((a) => a.departmentId);
      if (await isInDepts(targetId, deptIds)) return true;
    }
  }
  reply.status(403).send({ success: false, error: "Forbidden", statusCode: 403 });
  return false;
}

export async function employeeRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  // ── Employee stats (total, on leave today, onboarded this month, quit this month) ──
  fastify.get("/stats", { preHandler: requireRole("SUPER_ADMIN", "HR_ADMIN") }, async (_request, reply) => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const [total, onLeaveToday, onboardedThisMonth, quitThisMonth] = await Promise.all([
      // Total active employees (not terminated, not deleted)
      prisma.employee.count({
        where: { deletedAt: null, status: { not: "TERMINATED" } },
      }),

      // Distinct employees on approved leave today
      prisma.employee.count({
        where: {
          deletedAt: null,
          status: { not: "TERMINATED" },
          leaveApplications: {
            some: {
              status: "APPROVED",
              fromDate: { lte: todayEnd },
              toDate:   { gte: todayStart },
            },
          },
        },
      }),

      // Joined this calendar month
      prisma.employee.count({
        where: {
          deletedAt: null,
          joiningDate: { gte: monthStart, lte: monthEnd },
        },
      }),

      // Left (terminated) this calendar month
      prisma.employee.count({
        where: {
          deletedAt: null,
          status: "TERMINATED",
          terminationDate: { gte: monthStart, lte: monthEnd },
        },
      }),
    ]);

    const monthName = now.toLocaleString("en-IN", { month: "long" });

    return reply.send({
      success: true,
      data: { total, onLeaveToday, onboardedThisMonth, quitThisMonth, monthName },
    });
  });

  // List employees with pagination + search
  fastify.get("/", async (request, reply) => {
    const user = request.user as JwtPayload;

    // EMPLOYEE role cannot access the directory
    if (user.role === "EMPLOYEE") {
      return reply.status(403).send({ success: false, error: "Forbidden", statusCode: 403 });
    }

    const query = request.query as Record<string, string>;
    const page = Math.max(1, parseInt(query.page ?? "1"));
    const limit = Math.min(100, parseInt(query.limit ?? "20"));
    const skip = (page - 1) * limit;
    const search = query.search ?? "";
    const departmentId = query.departmentId;
    const designationId = query.designationId;
    const status = query.status;
    const employmentType = query.employmentType;
    const gender = query.gender;

    // Resolve the department scope for non-admin roles
    let scopedDeptIds: string[] | null = null;

    if (user.role === "DEPT_HEAD") {
      const headMemberships = await prisma.employeeDepartment.findMany({
        where: { employeeId: user.sub, isHead: true },
        select: { departmentId: true },
      });
      scopedDeptIds = headMemberships.map((m) => m.departmentId);
      // DEPT_HEAD with no departments — return empty list immediately
      if (scopedDeptIds.length === 0) {
        return reply.send({ success: true, data: [], meta: { total: 0, page: 1, limit, totalPages: 0 } });
      }
    } else if (user.role !== "SUPER_ADMIN" && user.role !== "HR_ADMIN") {
      // Custom role — fetch their department access list
      const access = await prisma.roleDepartmentAccess.findMany({
        where: { roleName: user.role },
        select: { departmentId: true },
      });
      if (access.length === 0) {
        return reply.status(403).send({ success: false, error: "Forbidden", statusCode: 403 });
      }
      scopedDeptIds = access.map((a) => a.departmentId);
    }

    // Build AND conditions to avoid OR key collision when search + dept scope both need OR
    const andConditions: any[] = [{ deletedAt: null }];

    if (search) {
      andConditions.push({
        OR: [
          { firstName: { contains: search, mode: "insensitive" as const } },
          { lastName: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
          { employeeCode: { contains: search, mode: "insensitive" as const } },
        ],
      });
    }

    // Scope non-admin roles to their allowed departments (primary or via membership)
    if (scopedDeptIds !== null) {
      andConditions.push({
        OR: [
          { departmentId: { in: scopedDeptIds } },
          { deptMemberships: { some: { departmentId: { in: scopedDeptIds } } } },
        ],
      });
    }

    // Explicit department filter — check both primary dept and memberships
    if (departmentId && (scopedDeptIds === null || scopedDeptIds.includes(departmentId))) {
      andConditions.push({
        OR: [
          { departmentId },
          { deptMemberships: { some: { departmentId } } },
        ],
      });
    }

    if (designationId) andConditions.push({ designationId });
    if (status)        andConditions.push({ status: status as any });
    if (employmentType) andConditions.push({ employmentType: employmentType as any });
    if (gender)        andConditions.push({ gender: gender as any });

    const where: any = { AND: andConditions };

    const [raw, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true, employeeCode: true, firstName: true, lastName: true,
          email: true, personalPhone: true, personalEmail: true, gender: true, status: true,
          employmentType: true, joiningDate: true, photoUrl: true,
          departmentId: true, designationId: true,
          department: { select: { id: true, name: true, code: true } },
          designation: { select: { id: true, title: true } },
          dateOfBirth: true, bloodGroup: true, maritalStatus: true,
          currentAddress: true, emergencyContactName: true,
          emergencyContactPhone: true, emergencyRelation: true,
        },
      }),
      prisma.employee.count({ where }),
    ]);

    const data = raw.map((e) => ({ ...e, ...profileCompleteness(e as any) }));

    return reply.send({
      success: true,
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  });

  // Get single employee (full profile)
  fastify.get("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.user as JwtPayload;

    if (!await assertCanAccess(user, id, reply)) return;

    // Allow an employee to view their own profile even if soft-deleted (they're still logged in)
    const selfView = user.sub === id;
    const employee = await prisma.employee.findFirst({
      where: selfView ? { id } : { id, deletedAt: null },
      include: {
        department: true,
        designation: true,
        reportingTo: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
      },
    });

    if (!employee) {
      return reply.status(404).send({ success: false, error: "Employee not found", statusCode: 404 });
    }

    const { passwordHash, aadhaarEncrypted, panEncrypted, ...safe } = employee;
    // Return masked PAN so the employee can confirm it's on file without exposing the full number
    const maskedPan = panEncrypted
      ? panEncrypted.slice(0, 2) + "XXXXXXX" + panEncrypted.slice(-1)
      : null;
    // Return masked Aadhaar showing only last 4 digits
    const maskedAadhaar = aadhaarEncrypted
      ? "XXXX XXXX " + aadhaarEncrypted.slice(-4)
      : null;
    const completeness = profileCompleteness(safe as any);
    return reply.send({ success: true, data: { ...safe, pan: maskedPan, aadhaar: maskedAadhaar, ...completeness } });
  });

  // Create employee (HR_ADMIN / SUPER_ADMIN only)
  fastify.post("/", { preHandler: requireRole("SUPER_ADMIN", "HR_ADMIN") }, async (request, reply) => {
    const parsed = createEmployeeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false, error: "Validation failed",
        details: parsed.error.flatten().fieldErrors, statusCode: 400,
      });
    }

    const d = parsed.data;
    const joiningDateObj = new Date(d.joiningDate);
    const password = d.initialPassword ?? `Centum@${new Date().getFullYear()}`;
    const passwordHash = await hashPassword(password);
    const actorId = (request.user as JwtPayload).sub;

    let employee;
    let employeeCode = await generateEmployeeCode(joiningDateObj);

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        employee = await prisma.$transaction(async (tx) => {
          const emp = await tx.employee.create({
            data: {
              employeeCode,
              email: d.email,
              passwordHash,
              firstName: d.firstName,
              lastName: d.lastName,
              middleName: d.middleName,
              gender: d.gender,
              personalPhone: d.personalPhone,
              personalEmail: d.personalEmail,
              dateOfBirth: d.dateOfBirth ? new Date(d.dateOfBirth) : undefined,
              maritalStatus: d.maritalStatus,
              bloodGroup: d.bloodGroup,
              nationality: d.nationality,
              currentAddress: d.currentAddress ?? undefined,
              permanentAddress: d.permanentAddress ?? undefined,
              emergencyContactName: d.emergencyContactName,
              emergencyContactPhone: d.emergencyContactPhone,
              emergencyRelation: d.emergencyRelation,
              departmentId: d.departmentId,
              designationId: d.designationId,
              reportingToId: d.reportingToId,
              employmentType: d.employmentType,
              joiningDate: joiningDateObj,
              workLocation: d.workLocation,
              role: d.role,
              status: d.isDraft ? "DRAFT" : "PROBATION",
            },
            select: {
              id: true, employeeCode: true, firstName: true, lastName: true, email: true,
              personalEmail: true,
              department: { select: { name: true } },
              designation: { select: { title: true } },
            },
          });

          await tx.auditLog.create({
            data: {
              employeeId: actorId,
              action: "CREATE",
              entity: "Employee",
              entityId: emp.id,
              newValues: { employeeCode: emp.employeeCode },
            },
          });

          if (d.reportingToId) {
            await tx.teamMembership.upsert({
              where: { teamOwnerId_memberId: { teamOwnerId: d.reportingToId, memberId: emp.id } },
              create: { teamOwnerId: d.reportingToId, memberId: emp.id },
              update: {},
            });
          }

          return emp;
        });
        break; // success — exit retry loop
      } catch (err: any) {
        const targets: string[] = (err?.meta?.target as string[]) ?? [];
        if (err?.code === "P2002" && targets.includes("employeeCode") && attempt < 2) {
          // Auto-generated code collided (race condition) — regenerate and retry
          employeeCode = await generateEmployeeCode(joiningDateObj);
          continue;
        }
        if (err?.code === "P2002") {
          const field = targets.includes("email") ? "email address" : targets.join(", ") || "field";
          return reply.status(409).send({
            success: false,
            error: `An employee with this ${field} already exists.`,
            statusCode: 409,
          });
        }
        if (err?.code === "P2003") {
          return reply.status(400).send({
            success: false,
            error: "Invalid department or designation — the referenced record does not exist.",
            statusCode: 400,
          });
        }
        throw err;
      }
    }

    return reply.status(201).send({
      success: true,
      data: { ...employee, temporaryPassword: password },
      message: "Employee created successfully",
    });
  });

  // Update employee
  fastify.patch("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.user as JwtPayload;

    if (!await assertCanAccess(user, id, reply)) return;

    const body = request.body as Record<string, unknown>;
    // Allow an employee to update their own record even if soft-deleted
    const selfUpdate = user.role === "EMPLOYEE" && user.sub === id;
    const existing = await prisma.employee.findFirst({ where: selfUpdate ? { id } : { id, deletedAt: null } });
    if (!existing) {
      return reply.status(404).send({ success: false, error: "Employee not found", statusCode: 404 });
    }

    // Employees can only update limited fields
    const allowedForEmployee = [
      "personalPhone", "officialPhone", "personalEmail",
      "dateOfBirth", "gender", "maritalStatus", "bloodGroup", "religion", "nationality",
      "currentAddress", "permanentAddress",
      "emergencyContactName", "emergencyContactPhone", "emergencyRelation",
      "panEncrypted", "aadhaarEncrypted", "uanNumber",
    ];
    const updateData: Record<string, unknown> = {};

    if (user.role === "EMPLOYEE") {
      for (const key of allowedForEmployee) {
        if (body[key] !== undefined) updateData[key] = body[key];
      }
    } else {
      Object.assign(updateData, body);
      delete updateData.passwordHash;
      delete updateData.employeeCode; // always auto-generated, never editable
      if (user.role !== "SUPER_ADMIN") {
        delete updateData.role;
      }
    }

    if (updateData.panEncrypted !== undefined) {
      const pan = String(updateData.panEncrypted).toUpperCase();
      if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) {
        return reply.status(400).send({ success: false, error: "Invalid PAN format. Must be like ABCDE1234F", statusCode: 400 });
      }
      updateData.panEncrypted = pan;
    }

    if (updateData.aadhaarEncrypted !== undefined) {
      const aadhaar = String(updateData.aadhaarEncrypted).replace(/\s/g, "");
      if (!/^\d{12}$/.test(aadhaar)) {
        return reply.status(400).send({ success: false, error: "Invalid Aadhaar format. Must be 12 digits", statusCode: 400 });
      }
      updateData.aadhaarEncrypted = aadhaar;
    }

    if (updateData.uanNumber !== undefined) {
      const uan = String(updateData.uanNumber).replace(/\s/g, "");
      if (uan && !/^\d{12}$/.test(uan)) {
        return reply.status(400).send({ success: false, error: "Invalid UAN format. Must be 12 digits", statusCode: 400 });
      }
      updateData.uanNumber = uan || null;
    }

    const updated = await prisma.employee.update({
      where: { id },
      data: updateData as any,
      select: { id: true, employeeCode: true, firstName: true, lastName: true, updatedAt: true },
    });

    // Sync team membership when reporting manager changes
    if (updateData.reportingToId !== undefined) {
      const oldManagerId = (existing as any).reportingToId as string | null;
      const newManagerId = (updateData.reportingToId as string | null) ?? null;

      if (oldManagerId !== newManagerId) {
        if (oldManagerId) {
          await prisma.teamMembership.deleteMany({
            where: { teamOwnerId: oldManagerId, memberId: id },
          });
        }
        if (newManagerId) {
          await prisma.teamMembership.upsert({
            where: { teamOwnerId_memberId: { teamOwnerId: newManagerId, memberId: id } },
            create: { teamOwnerId: newManagerId, memberId: id },
            update: {},
          });
        }
      }
    }

    await prisma.auditLog.create({
      data: {
        employeeId: user.sub,
        action: "UPDATE",
        entity: "Employee",
        entityId: id,
        oldValues: existing as any,
        newValues: updateData as any,
      },
    });

    return reply.send({ success: true, data: updated, message: "Updated successfully" });
  });

  // Bulk status change — activate / deactivate (SUPER_ADMIN only)
  fastify.patch("/bulk", { preHandler: requireRole("SUPER_ADMIN") }, async (request, reply) => {
    const body = request.body as { ids?: string[]; status?: string };
    if (!Array.isArray(body?.ids) || body.ids.length === 0)
      return reply.status(400).send({ success: false, error: "ids array required", statusCode: 400 });
    const allowed = ["ACTIVE", "PROBATION", "ON_LEAVE", "NOTICE_PERIOD", "TERMINATED", "RESIGNED", "RETIRED", "EXITED"];
    if (!body.status || !allowed.includes(body.status))
      return reply.status(400).send({ success: false, error: "Invalid status", statusCode: 400 });
    const updateData: any = { status: body.status };
    if (body.status === "ACTIVE") updateData.deletedAt = null;
    const { count } = await prisma.employee.updateMany({
      where: { id: { in: body.ids } },
      data: updateData,
    });
    await prisma.auditLog.create({
      data: {
        employeeId: (request.user as JwtPayload).sub,
        action: "BULK_STATUS_CHANGE",
        entity: "Employee",
        entityId: body.ids.join(","),
        newValues: { ids: body.ids, status: body.status, count },
      },
    });
    return reply.send({ success: true, data: { count }, message: `${count} employee(s) updated to ${body.status}` });
  });

  // Bulk soft delete — hides from list (SUPER_ADMIN only)
  fastify.delete("/bulk", { preHandler: requireRole("SUPER_ADMIN") }, async (request, reply) => {
    const body = request.body as { ids?: string[] };
    if (!Array.isArray(body?.ids) || body.ids.length === 0) {
      return reply.status(400).send({ success: false, error: "ids array required", statusCode: 400 });
    }
    const now = new Date();
    // Update each row individually so we can tombstone the email per-id
    const updates = await Promise.all(
      body.ids.map((id) =>
        prisma.employee.updateMany({
          where: { id, deletedAt: null },
          data: { deletedAt: now, status: "TERMINATED", email: `deleted_${id}@deleted` },
        })
      )
    );
    const count = updates.reduce((s, r) => s + r.count, 0);
    await prisma.auditLog.create({
      data: {
        employeeId: (request.user as JwtPayload).sub,
        action: "BULK_DELETE",
        entity: "Employee",
        entityId: body.ids.join(","),
        newValues: { ids: body.ids, count },
      },
    });
    return reply.send({ success: true, data: { count }, message: `${count} employee(s) deleted` });
  });

  // Soft delete (SUPER_ADMIN only)
  fastify.delete("/:id", { preHandler: requireRole("SUPER_ADMIN") }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const employee = await prisma.employee.findFirst({ where: { id, deletedAt: null } });
    if (!employee) {
      return reply.status(404).send({ success: false, error: "Employee not found", statusCode: 404 });
    }

    await prisma.employee.update({
      where: { id },
      data: { deletedAt: new Date(), status: "TERMINATED", email: `deleted_${id}@deleted` },
    });

    return reply.send({ success: true, data: null, message: "Employee deleted" });
  });

  // ── Qualifications ──────────────────────────────────────────────────────────
  fastify.get("/:id/qualifications", async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = await prisma.qualification.findMany({ where: { employeeId: id } });
    return reply.send({ success: true, data });
  });

  fastify.post("/:id/qualifications", async (request, reply) => {
    const { id } = request.params as { id: string };

    let bodyData: Record<string, any> = {};
    let documentUrl: string | undefined;

    if (request.isMultipart()) {
      const data = await request.file();
      if (!data) return reply.status(400).send({ success: false, error: "No file in multipart", statusCode: 400 });

      // Parse text fields
      for (const [key, field] of Object.entries(data.fields)) {
        bodyData[key] = (field as any).value;
      }
      // Coerce numeric fields
      if (bodyData.yearOfPassing) bodyData.yearOfPassing = Number(bodyData.yearOfPassing);
      if (bodyData.percentage) bodyData.percentage = bodyData.percentage === "" ? undefined : Number(bodyData.percentage);
      if (bodyData.cgpa) bodyData.cgpa = bodyData.cgpa === "" ? undefined : Number(bodyData.cgpa);

      // Handle file
      if (!ALLOWED_QUAL_MIME.has(data.mimetype)) {
        return reply.status(400).send({ success: false, error: "Only PDF, JPG, PNG allowed", statusCode: 400 });
      }
      const ext = data.filename.split(".").pop() ?? "bin";
      const fileName = `qual_${id}_${randomUUID()}.${ext}`;
      const filePath = join(UPLOADS_DIR_EMP, fileName);
      let fileSize = 0;
      const chunks: Buffer[] = [];
      for await (const chunk of data.file) {
        fileSize += chunk.length;
        if (fileSize > MAX_QUAL_SIZE) {
          return reply.status(413).send({ success: false, error: "File too large (max 5 MB)", statusCode: 413 });
        }
        chunks.push(chunk);
      }
      await pipeline(
        (async function* () { for (const c of chunks) yield c; })(),
        createWriteStream(filePath)
      );
      documentUrl = `/uploads/${fileName}`;
    } else {
      bodyData = request.body as Record<string, any>;
    }

    const parsed = qualificationSchema.safeParse(bodyData);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: "Validation failed", statusCode: 400 });
    }
    const data = await prisma.qualification.create({
      data: { employeeId: id, ...parsed.data, ...(documentUrl ? { documentUrl } : {}) },
    });
    return reply.status(201).send({ success: true, data });
  });

  fastify.delete("/:id/qualifications/:qualId", async (request, reply) => {
    const { id, qualId } = request.params as { id: string; qualId: string };
    const user = request.user as JwtPayload;
    if (!await assertCanAccess(user, id, reply)) return;
    const q = await prisma.qualification.findFirst({ where: { id: qualId, employeeId: id } });
    if (!q) return reply.status(404).send({ success: false, error: "Not found", statusCode: 404 });
    await prisma.qualification.delete({ where: { id: qualId } });
    return reply.send({ success: true, data: null });
  });

  // ── Certifications ──────────────────────────────────────────────────────────
  fastify.get("/:id/certifications", async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = await prisma.certification.findMany({ where: { employeeId: id } });
    return reply.send({ success: true, data });
  });

  fastify.post("/:id/certifications", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = certificationSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: "Validation failed", statusCode: 400 });
    }
    const d = parsed.data;
    const data = await prisma.certification.create({
      data: {
        employeeId: id,
        ...d,
        issueDate: new Date(d.issueDate),
        expiryDate: d.expiryDate ? new Date(d.expiryDate) : undefined,
      },
    });
    return reply.status(201).send({ success: true, data });
  });

  fastify.delete("/:id/certifications/:certId", async (request, reply) => {
    const { id, certId } = request.params as { id: string; certId: string };
    const user = request.user as JwtPayload;
    if (!await assertCanAccess(user, id, reply)) return;
    const c = await prisma.certification.findFirst({ where: { id: certId, employeeId: id } });
    if (!c) return reply.status(404).send({ success: false, error: "Not found", statusCode: 404 });
    await prisma.certification.delete({ where: { id: certId } });
    return reply.send({ success: true, data: null });
  });

  // ── Salary ──────────────────────────────────────────────────────────────────
  fastify.get("/:id/salary", { preHandler: requireRole("SUPER_ADMIN", "HR_ADMIN") }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = await prisma.salaryStructure.findUnique({
      where: { employeeId: id },
      include: { items: true },
    });
    return reply.send({ success: true, data });
  });

  fastify.get("/:id/salary-slips", async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.user as JwtPayload;
    if (!await assertCanAccess(user, id, reply)) return;
    const data = await prisma.salarySlip.findMany({
      where: { employeeId: id },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });
    return reply.send({ success: true, data });
  });

  // ── Photo Upload ────────────────────────────────────────────────────────────
  fastify.patch("/:id/photo", async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.user as JwtPayload;

    // Only the employee themselves can update their own profile photo
    if (user.sub !== id) {
      return reply.status(403).send({ success: false, error: "You can only update your own profile photo", statusCode: 403 });
    }

    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ success: false, error: "No file uploaded", statusCode: 400 });
    }

    const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
    if (!allowed.has(data.mimetype)) {
      return reply.status(400).send({ success: false, error: "Only JPG, PNG, WEBP allowed", statusCode: 400 });
    }

    const ext = data.filename.split(".").pop() ?? "jpg";
    const fileName = `photo_${id}_${randomUUID()}.${ext}`;

    let size = 0;
    const chunks: Buffer[] = [];
    for await (const chunk of data.file) {
      size += chunk.length;
      if (size > 3 * 1024 * 1024) {
        return reply.status(413).send({ success: false, error: "File too large (max 3 MB)", statusCode: 413 });
      }
      chunks.push(chunk);
    }

    const photoUrl = await uploadFile(
      Buffer.concat(chunks),
      `uploads/${fileName}`,
      data.mimetype,
      fileName
    );
    await prisma.employee.update({ where: { id }, data: { photoUrl } });

    return reply.send({ success: true, data: { photoUrl } });
  });

  // ── Send Credentials ────────────────────────────────────────────────────────
  fastify.post("/:id/send-credentials", { preHandler: requireRole("SUPER_ADMIN", "HR_ADMIN") }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { email, password } = request.body as { email: string; password: string };

    if (!email || !password) {
      return reply.status(400).send({ success: false, error: "email and password required", statusCode: 400 });
    }

    const employee = await prisma.employee.findFirst({ where: { id, deletedAt: null }, select: { firstName: true, lastName: true, employeeCode: true } });
    if (!employee) return reply.status(404).send({ success: false, error: "Employee not found", statusCode: 404 });

    try {
      await sendCredentialsMail(
        email,
        `${employee.firstName} ${employee.lastName}`,
        employee.employeeCode,
        password,
      );
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message ?? "Failed to send email", statusCode: 500 });
    }

    return reply.send({ success: true, message: "Credentials email sent" });
  });

  // ── Salary Config ───────────────────────────────────────────────────────────
  fastify.get("/:id/salary-config", async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = await prisma.employeeSalaryConfig.findUnique({ where: { employeeId: id } });
    return reply.send({ success: true, data });
  });

  fastify.post("/:id/salary-config", { preHandler: requireRole("SUPER_ADMIN", "HR_ADMIN") }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { employmentType: string; config: unknown; effectiveFrom?: string };
    const data = await prisma.employeeSalaryConfig.upsert({
      where: { employeeId: id },
      create: {
        employeeId: id,
        employmentType: body.employmentType as any,
        config: body.config as any,
        effectiveFrom: body.effectiveFrom ? new Date(body.effectiveFrom) : new Date(),
      },
      update: {
        employmentType: body.employmentType as any,
        config: body.config as any,
        effectiveFrom: body.effectiveFrom ? new Date(body.effectiveFrom) : new Date(),
        updatedAt: new Date(),
      },
    });
    return reply.send({ success: true, data });
  });

  // ── Monthly Receivables ─────────────────────────────────────────────────────
  fastify.get("/:id/monthly-receivables", async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.user as JwtPayload;
    if (!await assertCanAccess(user, id, reply)) return;

    const q = request.query as Record<string, string>;
    const now = new Date();
    const month = parseInt(q.month ?? String(now.getMonth() + 1)); // 1-12
    const year  = parseInt(q.year  ?? String(now.getFullYear()));

    // Period boundaries
    const periodStart = new Date(year, month - 1, 1);
    const periodEnd   = new Date(year, month, 0, 23, 59, 59, 999);

    // Approved claims in this period (approved this month, not yet paid)
    const claims = await prisma.reimbursementClaim.findMany({
      where: {
        employeeId: id,
        status: { in: ["APPROVED", "PAID"] },
        approvedAt: { gte: periodStart, lte: periodEnd },
      },
      select: {
        id: true, claimNumber: true, title: true, claimType: true,
        claimedAmount: true, approvedAmount: true, status: true, approvedAt: true,
      },
      orderBy: { approvedAt: "asc" },
    });

    // UNPAID (LOP) leaves approved with any day in this period
    const [unpaidLeaves, lopMarkedLeaves] = await Promise.all([
      prisma.leaveApplication.findMany({
        where: {
          employeeId: id,
          leaveType: "UNPAID",
          status: "APPROVED",
          fromDate: { lte: periodEnd },
          toDate:   { gte: periodStart },
        },
        select: { id: true, fromDate: true, toDate: true, totalDays: true, leaveType: true, lopDays: true },
        orderBy: { fromDate: "asc" },
      }),
      prisma.leaveApplication.findMany({
        where: {
          employeeId: id,
          leaveType: { not: "UNPAID" },
          status: "APPROVED",
          lopDays: { gt: 0 },
          fromDate: { lte: periodEnd },
          toDate:   { gte: periodStart },
        },
        select: { id: true, fromDate: true, toDate: true, totalDays: true, leaveType: true, lopDays: true },
        orderBy: { fromDate: "asc" },
      }),
    ]);

    // Clamp UNPAID leave days to the period
    const unpaidLopDays = unpaidLeaves.reduce((sum, l) => {
      const from = l.fromDate < periodStart ? periodStart : l.fromDate;
      const to   = l.toDate   > periodEnd   ? periodEnd   : l.toDate;
      const diff = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
      return sum + Math.min(diff, l.totalDays);
    }, 0);

    // Explicitly marked LoP days from other leave types
    const markedLopDays = lopMarkedLeaves.reduce((sum, l) => sum + l.lopDays, 0);
    const lopDays = unpaidLopDays + markedLopDays;
    const lopLeaves = [...unpaidLeaves, ...lopMarkedLeaves];

    // Salary config
    const salaryConfig = await prisma.employeeSalaryConfig.findUnique({ where: { employeeId: id } });

    // Part-time timesheet summary for the period
    const partTimeEntries = salaryConfig?.employmentType === "PART_TIME"
      ? await prisma.partTimeEntry.findMany({
          where: { employeeId: id, date: { gte: periodStart, lte: periodEnd } },
          orderBy: { date: "asc" },
        })
      : [];

    const timesheetSummary = {
      lectureHours:  partTimeEntries.reduce((s, e) => s + e.lectureHours, 0),
      ptmHours:      partTimeEntries.reduce((s, e) => s + e.ptmHours, 0),
      otherHours:    partTimeEntries.reduce((s, e) => s + e.otherHours, 0),
      answerScripts: partTimeEntries.reduce((s, e) => s + e.answerScripts, 0),
      entries:       partTimeEntries,
    };

    // Bonus payouts scheduled/paid in this period
    const bonusPayouts = await prisma.bonusPayout.findMany({
      where: {
        employeeId: id,
        scheduledDate: { gte: periodStart, lte: periodEnd },
        status: { in: ["SCHEDULED", "PAID"] },
      },
      include: { plan: { select: { id: true, title: true, frequency: true } } },
      orderBy: { scheduledDate: "asc" },
    });

    return reply.send({
      success: true,
      data: {
        period: { month, year },
        salaryConfig,
        claims: { items: claims, total: claims.reduce((s, c) => s + (c.approvedAmount ?? c.claimedAmount), 0) },
        lop: { days: lopDays, leaves: lopLeaves },
        bonus: {
          items: bonusPayouts,
          total: bonusPayouts.reduce((s, p) => s + p.amount, 0),
        },
        timesheet: timesheetSummary,
        miscellaneous: 0,
      },
    });
  });

  // ── Leave Balances ──────────────────────────────────────────────────────────
  fastify.get("/:id/leave-balances", async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.user as JwtPayload;
    if (!await assertCanAccess(user, id, reply)) return;
    const now = new Date();
    const defaultFY = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    const year = parseInt((request.query as any).year ?? defaultFY);

    function computeAccruedLocal(allocated: number, fyYear: number): number {
      const fyStart = new Date(fyYear, 3, 1);
      const fyEndExclusive = new Date(fyYear + 1, 3, 1);
      if (now < fyStart) return 0;
      if (now >= fyEndExclusive) return allocated;
      const monthsElapsed = (now.getFullYear() - fyYear) * 12 + (now.getMonth() + 1) - 3;
      return Math.round((Math.min(monthsElapsed, 12) / 12) * allocated * 10) / 10;
    }

    let balances = await prisma.leaveBalance.findMany({
      where: { employeeId: id, year },
      orderBy: { leaveType: "asc" },
    });

    // Auto-provision from the applicable leave policy if no records exist yet
    if (balances.length === 0) {
      const emp = await prisma.employee.findUnique({
        where: { id },
        select: { designation: { select: { grade: true } } },
      });

      if (emp?.designation?.grade) {
        const policy = await prisma.leavePolicy.findFirst({
          where: {
            isActive: true,
            grades: { some: { grade: emp.designation.grade } },
          },
          include: { rules: true },
        });

        if (policy?.rules.length) {
          await Promise.all(
            policy.rules.map((rule) =>
              prisma.leaveBalance.upsert({
                where: { employeeId_leaveType_year: { employeeId: id, leaveType: rule.leaveType, year } },
                create: { employeeId: id, leaveType: rule.leaveType, year, allocated: rule.daysPerYear },
                update: {},
              })
            )
          );

          balances = await prisma.leaveBalance.findMany({
            where: { employeeId: id, year },
            orderBy: { leaveType: "asc" },
          });
        }
      }
    }

    const data = balances.map((b) => {
      const accrued = computeAccruedLocal(b.allocated, year);
      const availed = b.used + b.pending;
      return {
        ...b,
        accrued,
        availed,
        balance: Math.max(0, accrued - availed),
      };
    });

    return reply.send({ success: true, data });
  });

  // ── Department Memberships ──────────────────────────────────────────────────

  // GET /employees/:id/departments — all departments this employee belongs to
  fastify.get("/:id/departments", async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.user as JwtPayload;
    if (!await assertCanAccess(user, id, reply)) return;

    const employee = await prisma.employee.findUnique({
      where: { id, deletedAt: null },
      select: {
        departmentId: true,
        department: { select: { id: true, name: true, code: true } },
        // New junction-table memberships
        deptMemberships: {
          select: {
            id: true,
            departmentId: true,
            isHead: true,
            addedAt: true,
            department: { select: { id: true, name: true, code: true } },
            addedBy: { select: { firstName: true, lastName: true } },
          },
          orderBy: { addedAt: "asc" },
        },
        // Legacy: departments where this employee is set as head via Department.headId
        headOfDept: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    if (!employee) {
      return reply.status(404).send({ success: false, error: "Employee not found", statusCode: 404 });
    }

    // Merge junction-table memberships with legacy headOfDept, deduplicating by departmentId
    const membershipMap = new Map<string, {
      membershipId: string | null; id: string; name: string; code: string;
      isHead: boolean; addedAt: Date | null; addedBy: string | null;
    }>();

    // Junction-table entries take precedence
    for (const m of employee.deptMemberships) {
      membershipMap.set(m.departmentId, {
        membershipId: m.id,
        ...m.department,
        isHead: m.isHead,
        addedAt: m.addedAt,
        addedBy: m.addedBy ? `${m.addedBy.firstName} ${m.addedBy.lastName}` : null,
      });
    }

    // Legacy headOfDept — add if not already present via junction table, and not the primary dept
    for (const dept of employee.headOfDept) {
      if (!membershipMap.has(dept.id) && dept.id !== employee.departmentId) {
        membershipMap.set(dept.id, {
          membershipId: null,
          ...dept,
          isHead: true,
          addedAt: null,
          addedBy: null,
        });
      } else if (membershipMap.has(dept.id)) {
        // Ensure isHead is true if headOfDept says so
        membershipMap.get(dept.id)!.isHead = true;
      }
    }

    return reply.send({
      success: true,
      data: {
        primary: { ...employee.department, isPrimary: true, isHead: employee.headOfDept.some((d) => d.id === employee.departmentId) },
        additional: Array.from(membershipMap.values()).map((m) => ({
          ...m,
          isPrimary: false,
        })),
      },
    });
  });

  // POST /employees/:id/departments — add to an additional department (HR/SA only)
  fastify.post("/:id/departments", { preHandler: requireRole("SUPER_ADMIN", "HR_ADMIN") }, async (request, reply) => {
    const actor = request.user as JwtPayload;
    const { id } = request.params as { id: string };
    const body = request.body as { departmentId: string; isHead?: boolean };

    if (!body.departmentId) {
      return reply.status(400).send({ success: false, error: "departmentId is required", statusCode: 400 });
    }

    const employee = await prisma.employee.findUnique({ where: { id, deletedAt: null }, select: { departmentId: true, joiningDate: true } });
    if (!employee) {
      return reply.status(404).send({ success: false, error: "Employee not found", statusCode: 404 });
    }
    if (employee.departmentId === body.departmentId) {
      return reply.status(400).send({ success: false, error: "Employee already belongs to this as their primary department", statusCode: 400 });
    }

    const dept = await prisma.department.findUnique({ where: { id: body.departmentId } });
    if (!dept) {
      return reply.status(404).send({ success: false, error: "Department not found", statusCode: 404 });
    }

    const membership = await prisma.employeeDepartment.upsert({
      where: { employeeId_departmentId: { employeeId: id, departmentId: body.departmentId } },
      create: { employeeId: id, departmentId: body.departmentId, isHead: body.isHead ?? false, addedById: actor.sub },
      update: { isHead: body.isHead ?? false },
      include: { department: { select: { id: true, name: true, code: true } } },
    });

    // Sync Department.headId — always overwrite so there's only one head at a time
    if (body.isHead) {
      await prisma.department.update({ where: { id: body.departmentId }, data: { headId: id } });
      // Promote employee role to DEPT_HEAD if they're currently a plain employee
      await prisma.employee.updateMany({ where: { id, role: "EMPLOYEE" }, data: { role: "DEPT_HEAD" } });
    }

    await prisma.auditLog.create({
      data: { employeeId: actor.sub, action: "ADD_DEPT_MEMBERSHIP", entity: "EmployeeDepartment", entityId: membership.id },
    });

    return reply.status(201).send({ success: true, data: membership, message: `Added to ${dept.name}` });
  });

  // PATCH /employees/:id/departments/:deptId — toggle isHead
  fastify.patch("/:id/departments/:deptId", { preHandler: requireRole("SUPER_ADMIN", "HR_ADMIN") }, async (request, reply) => {
    const actor = request.user as JwtPayload;
    const { id, deptId } = request.params as { id: string; deptId: string };
    const body = request.body as { isHead: boolean };

    const membership = await prisma.employeeDepartment.findUnique({
      where: { employeeId_departmentId: { employeeId: id, departmentId: deptId } },
    });
    if (!membership) {
      return reply.status(404).send({ success: false, error: "Membership not found", statusCode: 404 });
    }

    const updated = await prisma.employeeDepartment.update({
      where: { employeeId_departmentId: { employeeId: id, departmentId: deptId } },
      data: { isHead: body.isHead },
      include: { department: { select: { name: true } } },
    });

    // Sync Department.headId — always overwrite when setting, clear only if this person was head
    if (body.isHead) {
      await prisma.department.updateMany({ where: { id: deptId }, data: { headId: id } });
      // Promote employee role to DEPT_HEAD if they're currently a plain employee
      await prisma.employee.updateMany({ where: { id, role: "EMPLOYEE" }, data: { role: "DEPT_HEAD" } });
    } else {
      await prisma.department.updateMany({ where: { id: deptId, headId: id }, data: { headId: null } });
      // Demote role back to EMPLOYEE only if they have no remaining HoD memberships
      const remainingHead = await prisma.employeeDepartment.findFirst({ where: { employeeId: id, isHead: true } });
      if (!remainingHead) {
        await prisma.employee.updateMany({ where: { id, role: "DEPT_HEAD" }, data: { role: "EMPLOYEE" } });
      }
    }

    await prisma.auditLog.create({
      data: { employeeId: actor.sub, action: body.isHead ? "SET_DEPT_HEAD" : "UNSET_DEPT_HEAD", entity: "EmployeeDepartment", entityId: membership.id },
    });

    return reply.send({ success: true, data: updated, message: body.isHead ? `Set as head of ${updated.department.name}` : `Removed as head of ${updated.department.name}` });
  });

  // DELETE /employees/:id/departments/:deptId — remove from additional department
  fastify.delete("/:id/departments/:deptId", { preHandler: requireRole("SUPER_ADMIN", "HR_ADMIN") }, async (request, reply) => {
    const actor = request.user as JwtPayload;
    const { id, deptId } = request.params as { id: string; deptId: string };

    const employee = await prisma.employee.findUnique({ where: { id, deletedAt: null }, select: { departmentId: true } });
    if (!employee) {
      return reply.status(404).send({ success: false, error: "Employee not found", statusCode: 404 });
    }
    if (employee.departmentId === deptId) {
      return reply.status(400).send({ success: false, error: "Cannot remove primary department. Change primary department via employee update instead.", statusCode: 400 });
    }

    const membership = await prisma.employeeDepartment.findUnique({
      where: { employeeId_departmentId: { employeeId: id, departmentId: deptId } },
    });
    if (!membership) {
      return reply.status(404).send({ success: false, error: "Membership not found", statusCode: 404 });
    }

    await prisma.employeeDepartment.delete({ where: { employeeId_departmentId: { employeeId: id, departmentId: deptId } } });

    // Clear headId if this person was the head
    if (membership.isHead) {
      await prisma.department.updateMany({ where: { id: deptId, headId: id }, data: { headId: null } });
    }

    await prisma.auditLog.create({
      data: { employeeId: actor.sub, action: "REMOVE_DEPT_MEMBERSHIP", entity: "EmployeeDepartment", entityId: membership.id },
    });

    return reply.send({ success: true, data: null, message: "Removed from department" });
  });
}
