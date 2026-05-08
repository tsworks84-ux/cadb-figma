-- CreateTable
CREATE TABLE "EmployeeDepartment" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "isHead" BOOLEAN NOT NULL DEFAULT false,
    "addedById" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeDepartment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmployeeDepartment_employeeId_idx" ON "EmployeeDepartment"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeDepartment_departmentId_idx" ON "EmployeeDepartment"("departmentId");

-- CreateIndex
CREATE INDEX "EmployeeDepartment_isHead_idx" ON "EmployeeDepartment"("isHead");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeDepartment_employeeId_departmentId_key" ON "EmployeeDepartment"("employeeId", "departmentId");

-- AddForeignKey
ALTER TABLE "EmployeeDepartment" ADD CONSTRAINT "EmployeeDepartment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeDepartment" ADD CONSTRAINT "EmployeeDepartment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeDepartment" ADD CONSTRAINT "EmployeeDepartment_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
