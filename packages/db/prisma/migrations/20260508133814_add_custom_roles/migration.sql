-- CreateTable
CREATE TABLE "CustomRole" (
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomRole_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "RoleDepartmentAccess" (
    "id" TEXT NOT NULL,
    "roleName" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,

    CONSTRAINT "RoleDepartmentAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoleDepartmentAccess_roleName_idx" ON "RoleDepartmentAccess"("roleName");

-- CreateIndex
CREATE INDEX "RoleDepartmentAccess_departmentId_idx" ON "RoleDepartmentAccess"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "RoleDepartmentAccess_roleName_departmentId_key" ON "RoleDepartmentAccess"("roleName", "departmentId");

-- AddForeignKey
ALTER TABLE "RoleDepartmentAccess" ADD CONSTRAINT "RoleDepartmentAccess_roleName_fkey" FOREIGN KEY ("roleName") REFERENCES "CustomRole"("name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleDepartmentAccess" ADD CONSTRAINT "RoleDepartmentAccess_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
