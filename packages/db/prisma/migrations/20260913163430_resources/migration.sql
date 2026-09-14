-- CreateEnum
CREATE TYPE "ResourceVisibility" AS ENUM ('PRIVATE', 'ALL_STAFF', 'DEPARTMENTS');

-- CreateEnum
CREATE TYPE "ResourceItemKind" AS ENUM ('FOLDER', 'FILE', 'LINK');

-- CreateEnum
CREATE TYPE "ResourceItemStatus" AS ENUM ('UPLOADING', 'READY');

-- CreateTable
CREATE TABLE "ResourceCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "driveFolderId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResourceCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Resource" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "visibility" "ResourceVisibility" NOT NULL DEFAULT 'PRIVATE',
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "hiddenAt" TIMESTAMP(3),
    "hiddenById" TEXT,
    "driveFolderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourceDepartment" (
    "resourceId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,

    CONSTRAINT "ResourceDepartment_pkey" PRIMARY KEY ("resourceId","departmentId")
);

-- CreateTable
CREATE TABLE "ResourceItem" (
    "id" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "parentId" TEXT,
    "kind" "ResourceItemKind" NOT NULL,
    "status" "ResourceItemStatus" NOT NULL DEFAULT 'READY',
    "name" TEXT NOT NULL,
    "url" TEXT,
    "driveFileId" TEXT,
    "mimeType" TEXT,
    "sizeBytes" BIGINT,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ResourceItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ResourceCategory_name_key" ON "ResourceCategory"("name");

-- CreateIndex
CREATE INDEX "Resource_categoryId_idx" ON "Resource"("categoryId");

-- CreateIndex
CREATE INDEX "Resource_ownerId_idx" ON "Resource"("ownerId");

-- CreateIndex
CREATE INDEX "Resource_visibility_deletedAt_idx" ON "Resource"("visibility", "deletedAt");

-- CreateIndex
CREATE INDEX "ResourceDepartment_departmentId_idx" ON "ResourceDepartment"("departmentId");

-- CreateIndex
CREATE INDEX "ResourceItem_resourceId_parentId_idx" ON "ResourceItem"("resourceId", "parentId");

-- CreateIndex
CREATE INDEX "ResourceItem_status_createdAt_idx" ON "ResourceItem"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ResourceCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceDepartment" ADD CONSTRAINT "ResourceDepartment_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceDepartment" ADD CONSTRAINT "ResourceDepartment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceItem" ADD CONSTRAINT "ResourceItem_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceItem" ADD CONSTRAINT "ResourceItem_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ResourceItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceItem" ADD CONSTRAINT "ResourceItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed the default categories. isDefault rows can be renamed but not deleted.
INSERT INTO "ResourceCategory" ("id", "name", "isDefault", "sortOrder", "updatedAt") VALUES
  ('rescat_books',      'Books',              true, 10, CURRENT_TIMESTAMP),
  ('rescat_teaching',   'Teaching Aids',      true, 20, CURRENT_TIMESTAMP),
  ('rescat_reference',  'Reference Material', true, 30, CURRENT_TIMESTAMP),
  ('rescat_videos',     'Videos',             true, 40, CURRENT_TIMESTAMP),
  ('rescat_animations', 'Animations',         true, 50, CURRENT_TIMESTAMP),
  ('rescat_simulations','Simulations',        true, 60, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;
