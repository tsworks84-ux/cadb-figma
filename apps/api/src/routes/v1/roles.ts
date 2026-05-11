import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@cadb/db";
import { authenticate, requireRole } from "../../middleware/authenticate.js";

const ROLES = ["SUPER_ADMIN", "HR_ADMIN", "DEPT_HEAD", "EMPLOYEE"] as const;
const MODULES = [
  "EMP_PROFILE", "EMP_DOCUMENTS", "EMP_SALARY", "EMP_BANK", "EMP_LEAVES", "EMP_PAYOUT",
  "LEAVES", "CLAIMS", "POLICIES", "TRAINING",
  "MIS_EMP_DIRECTORY", "MIS_SALARY_STRUCT", "MIS_SALARY_DISB", "MIS_LEAVE_RECORDS", "MIS_HOLIDAYS", "MIS_CLAIMS",
  "ADMIN",
] as const;

const DEFAULT_PERMISSIONS: Record<string, Record<string, Partial<Record<"canView"|"canCreate"|"canEdit"|"canDelete"|"canApprove"|"canAppraise", boolean>>>> = {
  SUPER_ADMIN: {
    EMP_PROFILE:   { canView: true, canCreate: true, canEdit: true, canDelete: true, canApprove: true, canAppraise: true },
    EMP_DOCUMENTS: { canView: true, canCreate: true, canEdit: true, canDelete: true, canApprove: true, canAppraise: false },
    EMP_SALARY:    { canView: true, canCreate: true, canEdit: true, canDelete: true, canApprove: true, canAppraise: true },
    EMP_BANK:      { canView: true, canCreate: true, canEdit: true, canDelete: true, canApprove: true, canAppraise: false },
    EMP_LEAVES:    { canView: true, canCreate: true, canEdit: true, canDelete: true, canApprove: true, canAppraise: false },
    EMP_PAYOUT:    { canView: true, canCreate: true, canEdit: true, canDelete: true, canApprove: true, canAppraise: false },
    LEAVES:        { canView: true, canCreate: true, canEdit: true, canDelete: true, canApprove: true, canAppraise: false },
    CLAIMS:        { canView: true, canCreate: true, canEdit: true, canDelete: true, canApprove: true, canAppraise: false },
    POLICIES:      { canView: true, canCreate: true, canEdit: true, canDelete: true, canApprove: true, canAppraise: false },
    TRAINING:      { canView: true, canCreate: true, canEdit: true, canDelete: true, canApprove: true, canAppraise: false },
    MIS_EMP_DIRECTORY: { canView: true, canCreate: true, canEdit: true, canDelete: true, canApprove: true, canAppraise: false },
    MIS_SALARY_STRUCT: { canView: true, canCreate: true, canEdit: true, canDelete: true, canApprove: true, canAppraise: false },
    MIS_SALARY_DISB:   { canView: true, canCreate: true, canEdit: true, canDelete: true, canApprove: true, canAppraise: false },
    MIS_LEAVE_RECORDS: { canView: true, canCreate: true, canEdit: true, canDelete: true, canApprove: true, canAppraise: false },
    MIS_HOLIDAYS:      { canView: true, canCreate: true, canEdit: true, canDelete: true, canApprove: true, canAppraise: false },
    MIS_CLAIMS:        { canView: true, canCreate: true, canEdit: true, canDelete: true, canApprove: true, canAppraise: false },
    ADMIN:             { canView: true, canCreate: true, canEdit: true, canDelete: true, canApprove: true, canAppraise: false },
  },
  HR_ADMIN: {
    EMP_PROFILE:   { canView: true, canCreate: true, canEdit: true, canDelete: false, canApprove: false, canAppraise: false },
    EMP_DOCUMENTS: { canView: true, canCreate: true, canEdit: true, canDelete: true,  canApprove: false, canAppraise: false },
    EMP_SALARY:    { canView: true, canCreate: true, canEdit: true, canDelete: false, canApprove: false, canAppraise: true },
    EMP_BANK:      { canView: true, canCreate: true, canEdit: true, canDelete: false, canApprove: false, canAppraise: false },
    EMP_LEAVES:    { canView: true, canCreate: true, canEdit: true, canDelete: false, canApprove: true,  canAppraise: false },
    EMP_PAYOUT:    { canView: true, canCreate: true, canEdit: true, canDelete: false, canApprove: false, canAppraise: false },
    LEAVES:        { canView: true, canCreate: true, canEdit: true, canDelete: false, canApprove: true,  canAppraise: false },
    CLAIMS:        { canView: true, canCreate: true, canEdit: true, canDelete: false, canApprove: true,  canAppraise: false },
    POLICIES:      { canView: true, canCreate: true, canEdit: true, canDelete: false, canApprove: false, canAppraise: false },
    TRAINING:      { canView: true, canCreate: true, canEdit: true, canDelete: false, canApprove: false, canAppraise: false },
    MIS_EMP_DIRECTORY: { canView: true,  canCreate: false, canEdit: false, canDelete: false, canApprove: false, canAppraise: false },
    MIS_SALARY_STRUCT: { canView: true,  canCreate: false, canEdit: false, canDelete: false, canApprove: false, canAppraise: false },
    MIS_SALARY_DISB:   { canView: true,  canCreate: false, canEdit: false, canDelete: false, canApprove: false, canAppraise: false },
    MIS_LEAVE_RECORDS: { canView: true,  canCreate: false, canEdit: false, canDelete: false, canApprove: false, canAppraise: false },
    MIS_HOLIDAYS:      { canView: true,  canCreate: false, canEdit: false, canDelete: false, canApprove: false, canAppraise: false },
    MIS_CLAIMS:        { canView: true,  canCreate: false, canEdit: false, canDelete: false, canApprove: false, canAppraise: false },
    ADMIN:             { canView: true,  canCreate: true,  canEdit: true,  canDelete: false, canApprove: false, canAppraise: false },
  },
  DEPT_HEAD: {
    EMP_PROFILE:   { canView: true,  canCreate: false, canEdit: false, canDelete: false, canApprove: false, canAppraise: false },
    EMP_DOCUMENTS: { canView: true,  canCreate: false, canEdit: false, canDelete: false, canApprove: false, canAppraise: false },
    EMP_SALARY:    { canView: false, canCreate: false, canEdit: false, canDelete: false, canApprove: false, canAppraise: true },
    EMP_BANK:      { canView: false, canCreate: false, canEdit: false, canDelete: false, canApprove: false, canAppraise: false },
    EMP_LEAVES:    { canView: true,  canCreate: false, canEdit: false, canDelete: false, canApprove: true,  canAppraise: false },
    EMP_PAYOUT:    { canView: false, canCreate: false, canEdit: false, canDelete: false, canApprove: false, canAppraise: false },
    LEAVES:        { canView: true,  canCreate: true,  canEdit: false, canDelete: false, canApprove: true,  canAppraise: false },
    CLAIMS:        { canView: true,  canCreate: true,  canEdit: false, canDelete: false, canApprove: true,  canAppraise: false },
    POLICIES:      { canView: true,  canCreate: false, canEdit: false, canDelete: false, canApprove: false, canAppraise: false },
    TRAINING:      { canView: true,  canCreate: false, canEdit: false, canDelete: false, canApprove: false, canAppraise: false },
    MIS_EMP_DIRECTORY: { canView: false, canCreate: false, canEdit: false, canDelete: false, canApprove: false, canAppraise: false },
    MIS_SALARY_STRUCT: { canView: false, canCreate: false, canEdit: false, canDelete: false, canApprove: false, canAppraise: false },
    MIS_SALARY_DISB:   { canView: false, canCreate: false, canEdit: false, canDelete: false, canApprove: false, canAppraise: false },
    MIS_LEAVE_RECORDS: { canView: true,  canCreate: false, canEdit: false, canDelete: false, canApprove: false, canAppraise: false },
    MIS_HOLIDAYS:      { canView: false, canCreate: false, canEdit: false, canDelete: false, canApprove: false, canAppraise: false },
    MIS_CLAIMS:        { canView: false, canCreate: false, canEdit: false, canDelete: false, canApprove: false, canAppraise: false },
    ADMIN:             { canView: false, canCreate: false, canEdit: false, canDelete: false, canApprove: false, canAppraise: false },
  },
  EMPLOYEE: {
    EMP_PROFILE:   { canView: true,  canCreate: false, canEdit: false, canDelete: false, canApprove: false, canAppraise: false },
    EMP_DOCUMENTS: { canView: true,  canCreate: false, canEdit: false, canDelete: false, canApprove: false, canAppraise: false },
    EMP_SALARY:    { canView: true,  canCreate: false, canEdit: false, canDelete: false, canApprove: false, canAppraise: false },
    EMP_BANK:      { canView: true,  canCreate: false, canEdit: false, canDelete: false, canApprove: false, canAppraise: false },
    EMP_LEAVES:    { canView: true,  canCreate: false, canEdit: false, canDelete: false, canApprove: false, canAppraise: false },
    EMP_PAYOUT:    { canView: true,  canCreate: false, canEdit: false, canDelete: false, canApprove: false, canAppraise: false },
    LEAVES:        { canView: true,  canCreate: true,  canEdit: false, canDelete: true,  canApprove: false, canAppraise: false },
    CLAIMS:        { canView: true,  canCreate: true,  canEdit: true,  canDelete: false, canApprove: false, canAppraise: false },
    POLICIES:      { canView: true,  canCreate: false, canEdit: false, canDelete: false, canApprove: false, canAppraise: false },
    TRAINING:      { canView: true,  canCreate: false, canEdit: false, canDelete: false, canApprove: false, canAppraise: false },
    MIS_EMP_DIRECTORY: { canView: false, canCreate: false, canEdit: false, canDelete: false, canApprove: false, canAppraise: false },
    MIS_SALARY_STRUCT: { canView: false, canCreate: false, canEdit: false, canDelete: false, canApprove: false, canAppraise: false },
    MIS_SALARY_DISB:   { canView: false, canCreate: false, canEdit: false, canDelete: false, canApprove: false, canAppraise: false },
    MIS_LEAVE_RECORDS: { canView: false, canCreate: false, canEdit: false, canDelete: false, canApprove: false, canAppraise: false },
    MIS_HOLIDAYS:      { canView: false, canCreate: false, canEdit: false, canDelete: false, canApprove: false, canAppraise: false },
    MIS_CLAIMS:        { canView: false, canCreate: false, canEdit: false, canDelete: false, canApprove: false, canAppraise: false },
    ADMIN:             { canView: false, canCreate: false, canEdit: false, canDelete: false, canApprove: false, canAppraise: false },
  },
};

export async function roleRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  // GET current user's permissions as a module -> flags map
  fastify.get("/my-permissions", async (request, reply) => {
    const user = request.user as { role: string };
    let rows = await prisma.rolePermission.findMany({ where: { role: user.role } });

    if (rows.length === 0) {
      // Seed defaults for this role on first access
      const seeds = MODULES.map((module) => ({
        role: user.role,
        module,
        ...DEFAULT_PERMISSIONS[user.role]?.[module],
      }));
      await prisma.rolePermission.createMany({ data: seeds, skipDuplicates: true });
      rows = await prisma.rolePermission.findMany({ where: { role: user.role } });
    }

    const map: Record<string, object> = {};
    for (const row of rows) {
      map[row.module] = {
        canView: row.canView,
        canCreate: row.canCreate,
        canEdit: row.canEdit,
        canDelete: row.canDelete,
        canApprove: row.canApprove,
        canAppraise: row.canAppraise,
      };
    }

    return reply.send({ success: true, data: map });
  });

  // GET all role permissions — seed defaults if none exist
  fastify.get("/", async (_request, reply) => {
    let rows = await prisma.rolePermission.findMany({ orderBy: [{ role: "asc" }, { module: "asc" }] });

    if (rows.length === 0) {
      const seeds = [];
      for (const role of ROLES) {
        for (const module of MODULES) {
          const p = DEFAULT_PERMISSIONS[role][module];
          seeds.push({ role, module, ...p });
        }
      }
      await prisma.rolePermission.createMany({ data: seeds });
      rows = await prisma.rolePermission.findMany({ orderBy: [{ role: "asc" }, { module: "asc" }] });
    }

    return reply.send({ success: true, data: rows });
  });

  // PUT /:role/:module — update a single role+module permission set (SA only)
  fastify.put("/:role/:module", { preHandler: requireRole("SUPER_ADMIN") }, async (request, reply) => {
    const { role, module } = request.params as { role: string; module: string };

    // Allow system roles + any custom role that exists in the DB
    const isSystemRole = ROLES.includes(role as any);
    if (!isSystemRole) {
      const exists = await prisma.customRole.findUnique({ where: { name: role } });
      if (!exists) return reply.status(400).send({ success: false, error: "Invalid role" });
    }
    if (!MODULES.includes(module as any)) return reply.status(400).send({ success: false, error: "Invalid module" });

    // SUPER_ADMIN always has all permissions — cannot be downgraded
    if (role === "SUPER_ADMIN") {
      return reply.status(403).send({ success: false, error: "Super Admin permissions cannot be modified", statusCode: 403 });
    }

    const schema = z.object({
      canView:     z.boolean(),
      canCreate:   z.boolean(),
      canEdit:     z.boolean(),
      canDelete:   z.boolean(),
      canApprove:  z.boolean(),
      canAppraise: z.boolean(),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ success: false, error: "Validation failed", statusCode: 400 });

    const data = await prisma.rolePermission.upsert({
      where: { role_module: { role, module } },
      create: { role, module, ...parsed.data },
      update: parsed.data,
    });

    return reply.send({ success: true, data });
  });

  // POST /seed — reset permissions to defaults (SA only)
  fastify.post("/seed", { preHandler: requireRole("SUPER_ADMIN") }, async (_request, reply) => {
    await prisma.rolePermission.deleteMany();
    const seeds = [];
    for (const role of ROLES) {
      for (const module of MODULES) {
        const p = DEFAULT_PERMISSIONS[role][module];
        seeds.push({ role, module, ...p });
      }
    }
    await prisma.rolePermission.createMany({ data: seeds });
    return reply.send({ success: true, message: "Permissions reset to defaults" });
  });

  // ── Custom Roles ─────────────────────────────────────────────────────────────

  // GET /custom — list all custom roles with dept access
  fastify.get("/custom", { preHandler: requireRole("SUPER_ADMIN") }, async (_request, reply) => {
    const roles = await prisma.customRole.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        deptAccess: { select: { departmentId: true } },
      },
    });
    return reply.send({ success: true, data: roles });
  });

  // POST /custom — create a custom role + seed deny-all permissions + set dept access
  fastify.post("/custom", { preHandler: requireRole("SUPER_ADMIN") }, async (request, reply) => {
    const schema = z.object({
      name:          z.string().min(2).max(50).regex(/^[A-Z0-9_]+$/, "Use uppercase letters, digits, underscores"),
      label:         z.string().min(2).max(80),
      departmentIds: z.array(z.string()).min(1, "Select at least one department"),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ success: false, error: parsed.error.errors[0].message });

    const { name, label, departmentIds } = parsed.data;

    // Prevent clashing with system roles
    if (ROLES.includes(name as any)) {
      return reply.status(400).send({ success: false, error: "Name conflicts with a system role" });
    }

    const role = await prisma.customRole.create({
      data: {
        name,
        label,
        deptAccess: { create: departmentIds.map((departmentId) => ({ departmentId })) },
      },
      include: { deptAccess: { select: { departmentId: true } } },
    });

    // Seed deny-all permissions so the role appears in the permissions table immediately
    await prisma.rolePermission.createMany({
      data: MODULES.map((module) => ({ role: name, module })),
      skipDuplicates: true,
    });

    return reply.status(201).send({ success: true, data: role });
  });

  // PATCH /custom/:name — update label and/or department access
  fastify.patch("/custom/:name", { preHandler: requireRole("SUPER_ADMIN") }, async (request, reply) => {
    const { name } = request.params as { name: string };
    const schema = z.object({
      label:         z.string().min(2).max(80).optional(),
      departmentIds: z.array(z.string()).min(1).optional(),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ success: false, error: parsed.error.errors[0].message });

    const existing = await prisma.customRole.findUnique({ where: { name } });
    if (!existing) return reply.status(404).send({ success: false, error: "Role not found" });

    const { label, departmentIds } = parsed.data;

    await prisma.$transaction(async (tx) => {
      if (label) await tx.customRole.update({ where: { name }, data: { label } });
      if (departmentIds) {
        await tx.roleDepartmentAccess.deleteMany({ where: { roleName: name } });
        await tx.roleDepartmentAccess.createMany({
          data: departmentIds.map((departmentId) => ({ roleName: name, departmentId })),
        });
      }
    });

    const updated = await prisma.customRole.findUnique({
      where: { name },
      include: { deptAccess: { select: { departmentId: true } } },
    });
    return reply.send({ success: true, data: updated });
  });

  // DELETE /custom/:name — delete custom role, its permissions, and dept access
  fastify.delete("/custom/:name", { preHandler: requireRole("SUPER_ADMIN") }, async (request, reply) => {
    const { name } = request.params as { name: string };
    const existing = await prisma.customRole.findUnique({ where: { name } });
    if (!existing) return reply.status(404).send({ success: false, error: "Role not found" });

    await prisma.$transaction([
      prisma.rolePermission.deleteMany({ where: { role: name } }),
      prisma.customRole.delete({ where: { name } }),
    ]);

    return reply.send({ success: true, data: null });
  });
}
