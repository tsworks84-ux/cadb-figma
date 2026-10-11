-- Guard: these tables belong in the "partner" schema only. Without
-- ?schema=partner on the connection URL they would land in CADB's "public"
-- schema, so refuse to run there.
DO $$
BEGIN
  IF current_schema() IS DISTINCT FROM 'partner' THEN
    RAISE EXCEPTION 'partner migrations must run with search_path = partner (got %)', current_schema();
  END IF;
END
$$;

-- CreateEnum
CREATE TYPE "ProjectType" AS ENUM ('SIP', 'ASP');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SchoolAccessLevel" AS ENUM ('FULL', 'SUMMARY', 'BENCHMARK');

-- CreateEnum
CREATE TYPE "DataGroup" AS ENUM ('IDENTITY', 'ACADEMIC', 'PERSONAL', 'PARENT_CONTACT', 'FEES');

-- CreateEnum
CREATE TYPE "AccessAction" AS ENUM ('LOGIN', 'VIEW', 'DOWNLOAD');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('OWNER', 'MANAGER');

-- CreateTable
CREATE TABLE "Partner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "logoUrl" TEXT,
    "brandColor" TEXT,
    "domain" TEXT,
    "emailFrom" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "type" "ProjectType" NOT NULL,
    "internalName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "startAcademicYearId" TEXT NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectGrade" (
    "projectId" TEXT NOT NULL,
    "gradeId" TEXT NOT NULL,

    CONSTRAINT "ProjectGrade_pkey" PRIMARY KEY ("projectId","gradeId")
);

-- CreateTable
CREATE TABLE "Board" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Board_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectSchool" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectSchool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectSchoolGrade" (
    "projectSchoolId" TEXT NOT NULL,
    "gradeId" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,

    CONSTRAINT "ProjectSchoolGrade_pkey" PRIMARY KEY ("projectSchoolId","gradeId")
);

-- CreateTable
CREATE TABLE "ProjectBatch" (
    "batchId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedById" TEXT,

    CONSTRAINT "ProjectBatch_pkey" PRIMARY KEY ("batchId")
);

-- CreateTable
CREATE TABLE "PartnerRole" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerRolePermission" (
    "roleId" TEXT NOT NULL,
    "reportKey" TEXT NOT NULL,
    "canView" BOOLEAN NOT NULL DEFAULT false,
    "canDownload" BOOLEAN NOT NULL DEFAULT false,
    "dataGroups" "DataGroup"[] DEFAULT ARRAY[]::"DataGroup"[],

    CONSTRAINT "PartnerRolePermission_pkey" PRIMARY KEY ("roleId","reportKey")
);

-- CreateTable
CREATE TABLE "PartnerUser" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerUserOverride" (
    "userId" TEXT NOT NULL,
    "reportKey" TEXT NOT NULL,
    "canView" BOOLEAN NOT NULL DEFAULT false,
    "canDownload" BOOLEAN NOT NULL DEFAULT false,
    "dataGroups" "DataGroup"[] DEFAULT ARRAY[]::"DataGroup"[],

    CONSTRAINT "PartnerUserOverride_pkey" PRIMARY KEY ("userId","reportKey")
);

-- CreateTable
CREATE TABLE "PartnerProjectGrant" (
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grantedById" TEXT,

    CONSTRAINT "PartnerProjectGrant_pkey" PRIMARY KEY ("userId","projectId")
);

-- CreateTable
CREATE TABLE "PartnerSchoolGrant" (
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "level" "SchoolAccessLevel" NOT NULL,

    CONSTRAINT "PartnerSchoolGrant_pkey" PRIMARY KEY ("userId","projectId","schoolId")
);

-- CreateTable
CREATE TABLE "PartnerSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "PartnerSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerAccessLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" "AccessAction" NOT NULL,
    "reportKey" TEXT,
    "projectId" TEXT,
    "schoolIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "filters" JSONB,
    "rowCount" INTEGER,
    "ip" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerAccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'MANAGER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Partner_name_key" ON "Partner"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Partner_domain_key" ON "Partner"("domain");

-- CreateIndex
CREATE INDEX "Project_status_idx" ON "Project"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Project_partnerId_internalName_key" ON "Project"("partnerId", "internalName");

-- CreateIndex
CREATE UNIQUE INDEX "Board_code_key" ON "Board"("code");

-- CreateIndex
CREATE INDEX "ProjectSchool_schoolId_idx" ON "ProjectSchool"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectSchool_projectId_schoolId_key" ON "ProjectSchool"("projectId", "schoolId");

-- CreateIndex
CREATE INDEX "ProjectSchoolGrade_boardId_idx" ON "ProjectSchoolGrade"("boardId");

-- CreateIndex
CREATE INDEX "ProjectBatch_projectId_idx" ON "ProjectBatch"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerRole_partnerId_name_key" ON "PartnerRole"("partnerId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerUser_email_key" ON "PartnerUser"("email");

-- CreateIndex
CREATE INDEX "PartnerUser_partnerId_idx" ON "PartnerUser"("partnerId");

-- CreateIndex
CREATE INDEX "PartnerProjectGrant_projectId_idx" ON "PartnerProjectGrant"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerSession_tokenHash_key" ON "PartnerSession"("tokenHash");

-- CreateIndex
CREATE INDEX "PartnerSession_userId_idx" ON "PartnerSession"("userId");

-- CreateIndex
CREATE INDEX "PartnerAccessLog_userId_at_idx" ON "PartnerAccessLog"("userId", "at");

-- CreateIndex
CREATE INDEX "PartnerAccessLog_at_idx" ON "PartnerAccessLog"("at");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_employeeId_key" ON "AdminUser"("employeeId");

-- CreateIndex
CREATE INDEX "AdminAuditLog_entityType_entityId_idx" ON "AdminAuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AdminAuditLog_at_idx" ON "AdminAuditLog"("at");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectGrade" ADD CONSTRAINT "ProjectGrade_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectSchool" ADD CONSTRAINT "ProjectSchool_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectSchoolGrade" ADD CONSTRAINT "ProjectSchoolGrade_projectSchoolId_fkey" FOREIGN KEY ("projectSchoolId") REFERENCES "ProjectSchool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectSchoolGrade" ADD CONSTRAINT "ProjectSchoolGrade_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectBatch" ADD CONSTRAINT "ProjectBatch_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerRole" ADD CONSTRAINT "PartnerRole_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerRolePermission" ADD CONSTRAINT "PartnerRolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "PartnerRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerUser" ADD CONSTRAINT "PartnerUser_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerUser" ADD CONSTRAINT "PartnerUser_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "PartnerRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerUserOverride" ADD CONSTRAINT "PartnerUserOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "PartnerUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerProjectGrant" ADD CONSTRAINT "PartnerProjectGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "PartnerUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerProjectGrant" ADD CONSTRAINT "PartnerProjectGrant_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerSchoolGrant" ADD CONSTRAINT "PartnerSchoolGrant_userId_projectId_fkey" FOREIGN KEY ("userId", "projectId") REFERENCES "PartnerProjectGrant"("userId", "projectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerSession" ADD CONSTRAINT "PartnerSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "PartnerUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerAccessLog" ADD CONSTRAINT "PartnerAccessLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "PartnerUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed: boards. Admins can add more from partner-admin.
INSERT INTO "Board" ("id", "code", "name", "sortOrder", "updatedAt") VALUES
  ('board_cbse',  'CBSE',  'Central Board of Secondary Education',           10, CURRENT_TIMESTAMP),
  ('board_icse',  'ICSE',  'Indian Certificate of Secondary Education',      20, CURRENT_TIMESTAMP),
  ('board_isc',   'ISC',   'Indian School Certificate',                      30, CURRENT_TIMESTAMP),
  ('board_igcse', 'IGCSE', 'Cambridge IGCSE',                                40, CURRENT_TIMESTAMP),
  ('board_cie',   'CIE',   'Cambridge International (AS & A Level)',         50, CURRENT_TIMESTAMP),
  ('board_ib',    'IB',    'International Baccalaureate',                    60, CURRENT_TIMESTAMP),
  ('board_puc',   'PUC',   'Pre-University Course (Karnataka)',              70, CURRENT_TIMESTAMP);
