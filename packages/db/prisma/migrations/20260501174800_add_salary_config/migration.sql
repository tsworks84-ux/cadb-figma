-- CreateTable
CREATE TABLE "EmployeeSalaryConfig" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "employmentType" "EmploymentType" NOT NULL,
    "config" JSONB NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeSalaryConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeSalaryConfig_employeeId_key" ON "EmployeeSalaryConfig"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeSalaryConfig_employeeId_idx" ON "EmployeeSalaryConfig"("employeeId");

-- AddForeignKey
ALTER TABLE "EmployeeSalaryConfig" ADD CONSTRAINT "EmployeeSalaryConfig_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
