import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@cadb/db";
import { authenticate, requireRole } from "../../middleware/authenticate.js";

const ROLES = ["SUPER_ADMIN", "HR_ADMIN", "DEPT_HEAD", "EMPLOYEE"] as const;
const MODULES = [
  "EMP_PROFILE", "EMP_DOCUMENTS", "EMP_SALARY", "EMP_BANK", "EMP_LEAVES", "EMP_PAYOUT",
  "LEAVES", "CLAIMS", "POLICIES", "TRAINING",
  "MIS_EMP_DIRECTORY", "MIS_SALARY_STRUCT", "MIS_SALARY_DISB", "MIS_LEAVE_RECORDS", "MIS_HOLIDAYS", "MIS_CLAIMS",
  "ACA_OVERVIEW", "ACA_BATCH", "ACA_SUBJECT", "ACA_SETTINGS",
  "STU_PROFILE", "STU_ADMISSION", "STU_ATTENDANCE", "STU_ASSIGNMENT", "STU_ASSESSMENT", "STU_TIMETABLE",
  // Administration — one module per tab, so the Super Admin can hand out a single
  // tab (e.g. Claim Types) without opening the rest of the section.
  // Custom Roles and Roles & Permissions are deliberately NOT here: granting either
  // would let the holder grant themselves everything, so they stay SUPER_ADMIN-only.
  "ADM_DEPARTMENTS", "ADM_DESIGNATIONS", "ADM_LEAVE_POLICIES", "ADM_WORK_LOCATIONS", "ADM_CLAIM_TYPES",
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
  },
};

// Academics / student modules — wired into the RBAC matrix so they can be assigned to
// custom roles & DEPT_HEAD and take effect. (SUPER_ADMIN / HR_ADMIN also bypass academics
// checks in the UI, but we seed sensible defaults here for consistency and the /seed reset.)
const ACADEMICS_MODULES = [
  "ACA_OVERVIEW", "ACA_BATCH", "ACA_SUBJECT", "ACA_SETTINGS",
  "STU_PROFILE", "STU_ADMISSION", "STU_ATTENDANCE", "STU_ASSIGNMENT", "STU_ASSESSMENT", "STU_TIMETABLE",
] as const;
const ACADEMICS_DEFAULTS: Record<string, Record<"canView"|"canCreate"|"canEdit"|"canDelete"|"canApprove"|"canAppraise", boolean>> = {
  SUPER_ADMIN: { canView: true,  canCreate: true,  canEdit: true,  canDelete: true,  canApprove: true,  canAppraise: false },
  HR_ADMIN:    { canView: true,  canCreate: true,  canEdit: true,  canDelete: false, canApprove: false, canAppraise: false },
  DEPT_HEAD:   { canView: false, canCreate: false, canEdit: false, canDelete: false, canApprove: false, canAppraise: false },
  EMPLOYEE:    { canView: false, canCreate: false, canEdit: false, canDelete: false, canApprove: false, canAppraise: false },
};
for (const role of ROLES) {
  for (const m of ACADEMICS_MODULES) {
    DEFAULT_PERMISSIONS[role][m] = { ...ACADEMICS_DEFAULTS[role] };
  }
}

// Administration tabs. HR_ADMIN's defaults mirror the access it had under the old
// hard-coded `requireRole("SUPER_ADMIN", "HR_ADMIN")` checks — configure, but never
// delete. Everyone else starts denied and is opened up from the permission matrix.
const ADMIN_MODULES = [
  "ADM_DEPARTMENTS", "ADM_DESIGNATIONS", "ADM_LEAVE_POLICIES", "ADM_WORK_LOCATIONS", "ADM_CLAIM_TYPES",
] as const;
const ADMIN_DEFAULTS: Record<string, Record<"canView"|"canCreate"|"canEdit"|"canDelete"|"canApprove"|"canAppraise", boolean>> = {
  SUPER_ADMIN: { canView: true,  canCreate: true,  canEdit: true,  canDelete: true,  canApprove: true,  canAppraise: false },
  HR_ADMIN:    { canView: true,  canCreate: true,  canEdit: true,  canDelete: false, canApprove: false, canAppraise: false },
  DEPT_HEAD:   { canView: false, canCreate: false, canEdit: false, canDelete: false, canApprove: false, canAppraise: false },
  EMPLOYEE:    { canView: false, canCreate: false, canEdit: false, canDelete: false, canApprove: false, canAppraise: false },
};
for (const role of ROLES) {
  for (const m of ADMIN_MODULES) {
    DEFAULT_PERMISSIONS[role][m] = { ...ADMIN_DEFAULTS[role] };
  }
}

/**
 * Adds rows for any (role, module) pair that has no row yet, so modules introduced
 * after a deployment appear in the matrix instead of silently reading as denied.
 * The old all-or-nothing `if (rows.length === 0)` seed never fired on an existing
 * install, which left every new module invisible until permissions were reset.
 *
 * Custom roles get deny-all (the column defaults), matching how they are created.
 */
async function backfillMissingModules(roles: string[]) {
  const existing = await prisma.rolePermission.findMany({
    where: { role: { in: roles } },
    select: { role: true, module: true },
  });
  const have = new Set(existing.map((r) => `${r.role}::${r.module}`));

  const seeds: { role: string; module: string }[] = [];
  for (const role of roles) {
    for (const module of MODULES) {
      if (!have.has(`${role}::${module}`)) {
        seeds.push({ role, module, ...DEFAULT_PERMISSIONS[role]?.[module] });
      }
    }
  }
  if (seeds.length) await prisma.rolePermission.createMany({ data: seeds, skipDuplicates: true });

  // Drop the retired catch-all row so it can't linger in the matrix response.
  await prisma.rolePermission.deleteMany({ where: { role: { in: roles }, module: "ADMIN" } });

  return seeds.length > 0;
}

export async function roleRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  // GET current user's permissions as a module -> flags map
  fastify.get("/my-permissions", async (request, reply) => {
    const user = request.user as { role: string };
    // Backfills any module missing for this role (including ones added after deploy)
    await backfillMissingModules([user.role]);
    const rows = await prisma.rolePermission.findMany({ where: { role: user.role } });

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
    const custom = await prisma.customRole.findMany({ select: { name: true } });
    await backfillMissingModules([...ROLES, ...custom.map((c) => c.name)]);

    const rows = await prisma.rolePermission.findMany({ orderBy: [{ role: "asc" }, { module: "asc" }] });
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
      // Optional: a role that only works inside Academics needs no department
      // access at all. Empty simply means "no employee directory access".
      departmentIds: z.array(z.string()).default([]),
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
      departmentIds: z.array(z.string()).optional(),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ success: false, error: parsed.error.errors[0].message });

    const existing = await prisma.customRole.findUnique({ where: { name } });
    if (!existing) return reply.status(404).send({ success: false, error: "Role not found" });

    const { label, departmentIds } = parsed.data;

    await prisma.$transaction(async (tx) => {
      if (label) await tx.customRole.update({ where: { name }, data: { label } });
      // An empty array is a deliberate "clear all department access", not a no-op.
      if (departmentIds) {
        await tx.roleDepartmentAccess.deleteMany({ where: { roleName: name } });
        if (departmentIds.length) {
          await tx.roleDepartmentAccess.createMany({
            data: departmentIds.map((departmentId) => ({ roleName: name, departmentId })),
          });
        }
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
