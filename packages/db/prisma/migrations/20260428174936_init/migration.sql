-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "MaritalStatus" AS ENUM ('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED');

-- CreateEnum
CREATE TYPE "BloodGroup" AS ENUM ('A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'AB_POS', 'AB_NEG', 'O_POS', 'O_NEG');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'VISITING', 'INTERN');

-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('ACTIVE', 'ON_LEAVE', 'PROBATION', 'TERMINATED', 'RESIGNED', 'RETIRED');

-- CreateEnum
CREATE TYPE "DegreeLevel" AS ENUM ('UG', 'PG', 'PHD', 'DIPLOMA', 'CERTIFICATION', 'OTHER');

-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('CASUAL', 'SICK', 'EARNED', 'MATERNITY', 'PATERNITY', 'COMPENSATORY', 'UNPAID', 'SPECIAL');

-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ClaimType" AS ENUM ('TRAVEL', 'MEDICAL', 'FOOD', 'ACCOMMODATION', 'TRAINING', 'OTHER');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'PAID');

-- CreateEnum
CREATE TYPE "TrainingStatus" AS ENUM ('ENROLLED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PolicyCategory" AS ENUM ('HR', 'FINANCE', 'IT', 'OPERATIONS', 'COMPLIANCE', 'ACADEMIC', 'OTHER');

-- CreateEnum
CREATE TYPE "SalaryComponent" AS ENUM ('BASIC', 'HRA', 'CONVEYANCE', 'MEDICAL', 'SPECIAL_ALLOWANCE', 'PF_EMPLOYER', 'ESI_EMPLOYER', 'GRATUITY', 'BONUS', 'INCENTIVE', 'TDS', 'PF_EMPLOYEE', 'ESI_EMPLOYEE', 'PROFESSIONAL_TAX', 'ADVANCE_DEDUCTION');

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "headId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Designation" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "grade" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Designation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "employeeCode" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "middleName" TEXT,
    "gender" "Gender" NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "maritalStatus" "MaritalStatus",
    "bloodGroup" "BloodGroup",
    "nationality" TEXT NOT NULL DEFAULT 'Indian',
    "religion" TEXT,
    "photoUrl" TEXT,
    "personalPhone" TEXT NOT NULL,
    "officialPhone" TEXT,
    "personalEmail" TEXT,
    "currentAddress" JSONB NOT NULL,
    "permanentAddress" JSONB,
    "emergencyContactName" TEXT NOT NULL,
    "emergencyContactPhone" TEXT NOT NULL,
    "emergencyRelation" TEXT NOT NULL,
    "aadhaarEncrypted" TEXT,
    "panEncrypted" TEXT,
    "passportNumber" TEXT,
    "passportExpiry" TIMESTAMP(3),
    "departmentId" TEXT NOT NULL,
    "designationId" TEXT NOT NULL,
    "reportingToId" TEXT,
    "employmentType" "EmploymentType" NOT NULL DEFAULT 'FULL_TIME',
    "status" "EmploymentStatus" NOT NULL DEFAULT 'PROBATION',
    "joiningDate" TIMESTAMP(3) NOT NULL,
    "confirmationDate" TIMESTAMP(3),
    "terminationDate" TIMESTAMP(3),
    "terminationReason" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Qualification" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "level" "DegreeLevel" NOT NULL,
    "degreeName" TEXT NOT NULL,
    "specialization" TEXT,
    "institution" TEXT NOT NULL,
    "boardUniversity" TEXT NOT NULL,
    "yearOfPassing" INTEGER NOT NULL,
    "percentage" DOUBLE PRECISION,
    "cgpa" DOUBLE PRECISION,
    "documentUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Qualification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Certification" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "issuingBody" TEXT NOT NULL,
    "credentialId" TEXT,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "documentUrl" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Certification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryStructure" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "ctc" DOUBLE PRECISION NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "components" "SalaryComponent"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalaryStructure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryStructureItem" (
    "id" TEXT NOT NULL,
    "salaryStructureId" TEXT NOT NULL,
    "component" "SalaryComponent" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "isPercentage" BOOLEAN NOT NULL DEFAULT false,
    "percentageOf" "SalaryComponent",

    CONSTRAINT "SalaryStructureItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankDetail" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "ifscCode" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "branchName" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalarySlip" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "grossPay" DOUBLE PRECISION NOT NULL,
    "totalDeductions" DOUBLE PRECISION NOT NULL,
    "netPay" DOUBLE PRECISION NOT NULL,
    "pdfUrl" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "SalarySlip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveBalance" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "leaveType" "LeaveType" NOT NULL,
    "year" INTEGER NOT NULL,
    "allocated" DOUBLE PRECISION NOT NULL,
    "used" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pending" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "carried" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "LeaveBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveApplication" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "leaveType" "LeaveType" NOT NULL,
    "fromDate" TIMESTAMP(3) NOT NULL,
    "toDate" TIMESTAMP(3) NOT NULL,
    "totalDays" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "approverId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionNote" TEXT,
    "documentUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReimbursementClaim" (
    "id" TEXT NOT NULL,
    "claimNumber" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "claimType" "ClaimType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "claimedAmount" DOUBLE PRECISION NOT NULL,
    "approvedAmount" DOUBLE PRECISION,
    "status" "ClaimStatus" NOT NULL DEFAULT 'DRAFT',
    "approverId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionNote" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReimbursementClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaimReceipt" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClaimReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyDocument" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" "PolicyCategory" NOT NULL,
    "version" TEXT NOT NULL,
    "description" TEXT,
    "fileUrl" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "requiresAck" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PolicyDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyAcknowledgement" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolicyAcknowledgement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingProgram" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "provider" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'ONLINE',
    "durationHours" DOUBLE PRECISION,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "seats" INTEGER,
    "isMandatory" BOOLEAN NOT NULL DEFAULT false,
    "certificateTemplateUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingEnrollment" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "status" "TrainingStatus" NOT NULL DEFAULT 'ENROLLED',
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "score" DOUBLE PRECISION,
    "certificateUrl" TEXT,
    "feedback" TEXT,

    CONSTRAINT "TrainingEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "oldValues" JSONB,
    "newValues" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Department_code_key" ON "Department"("code");

-- CreateIndex
CREATE INDEX "Department_code_idx" ON "Department"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Designation_title_key" ON "Designation"("title");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_employeeCode_key" ON "Employee"("employeeCode");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_email_key" ON "Employee"("email");

-- CreateIndex
CREATE INDEX "Employee_departmentId_idx" ON "Employee"("departmentId");

-- CreateIndex
CREATE INDEX "Employee_designationId_idx" ON "Employee"("designationId");

-- CreateIndex
CREATE INDEX "Employee_status_idx" ON "Employee"("status");

-- CreateIndex
CREATE INDEX "Employee_employmentType_idx" ON "Employee"("employmentType");

-- CreateIndex
CREATE INDEX "Employee_deletedAt_idx" ON "Employee"("deletedAt");

-- CreateIndex
CREATE INDEX "Employee_employeeCode_idx" ON "Employee"("employeeCode");

-- CreateIndex
CREATE INDEX "Qualification_employeeId_idx" ON "Qualification"("employeeId");

-- CreateIndex
CREATE INDEX "Qualification_level_idx" ON "Qualification"("level");

-- CreateIndex
CREATE INDEX "Certification_employeeId_idx" ON "Certification"("employeeId");

-- CreateIndex
CREATE INDEX "Certification_expiryDate_idx" ON "Certification"("expiryDate");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryStructure_employeeId_key" ON "SalaryStructure"("employeeId");

-- CreateIndex
CREATE INDEX "SalaryStructure_employeeId_idx" ON "SalaryStructure"("employeeId");

-- CreateIndex
CREATE INDEX "SalaryStructure_effectiveFrom_idx" ON "SalaryStructure"("effectiveFrom");

-- CreateIndex
CREATE INDEX "SalaryStructureItem_salaryStructureId_idx" ON "SalaryStructureItem"("salaryStructureId");

-- CreateIndex
CREATE INDEX "BankDetail_employeeId_idx" ON "BankDetail"("employeeId");

-- CreateIndex
CREATE INDEX "SalarySlip_employeeId_idx" ON "SalarySlip"("employeeId");

-- CreateIndex
CREATE INDEX "SalarySlip_year_month_idx" ON "SalarySlip"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "SalarySlip_employeeId_month_year_key" ON "SalarySlip"("employeeId", "month", "year");

-- CreateIndex
CREATE INDEX "LeaveBalance_employeeId_idx" ON "LeaveBalance"("employeeId");

-- CreateIndex
CREATE INDEX "LeaveBalance_year_idx" ON "LeaveBalance"("year");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveBalance_employeeId_leaveType_year_key" ON "LeaveBalance"("employeeId", "leaveType", "year");

-- CreateIndex
CREATE INDEX "LeaveApplication_employeeId_idx" ON "LeaveApplication"("employeeId");

-- CreateIndex
CREATE INDEX "LeaveApplication_status_idx" ON "LeaveApplication"("status");

-- CreateIndex
CREATE INDEX "LeaveApplication_fromDate_toDate_idx" ON "LeaveApplication"("fromDate", "toDate");

-- CreateIndex
CREATE INDEX "LeaveApplication_approverId_idx" ON "LeaveApplication"("approverId");

-- CreateIndex
CREATE UNIQUE INDEX "ReimbursementClaim_claimNumber_key" ON "ReimbursementClaim"("claimNumber");

-- CreateIndex
CREATE INDEX "ReimbursementClaim_employeeId_idx" ON "ReimbursementClaim"("employeeId");

-- CreateIndex
CREATE INDEX "ReimbursementClaim_status_idx" ON "ReimbursementClaim"("status");

-- CreateIndex
CREATE INDEX "ReimbursementClaim_claimType_idx" ON "ReimbursementClaim"("claimType");

-- CreateIndex
CREATE INDEX "ReimbursementClaim_approverId_idx" ON "ReimbursementClaim"("approverId");

-- CreateIndex
CREATE INDEX "ClaimReceipt_claimId_idx" ON "ClaimReceipt"("claimId");

-- CreateIndex
CREATE INDEX "PolicyDocument_category_idx" ON "PolicyDocument"("category");

-- CreateIndex
CREATE INDEX "PolicyDocument_isActive_idx" ON "PolicyDocument"("isActive");

-- CreateIndex
CREATE INDEX "PolicyAcknowledgement_employeeId_idx" ON "PolicyAcknowledgement"("employeeId");

-- CreateIndex
CREATE INDEX "PolicyAcknowledgement_policyId_idx" ON "PolicyAcknowledgement"("policyId");

-- CreateIndex
CREATE UNIQUE INDEX "PolicyAcknowledgement_employeeId_policyId_key" ON "PolicyAcknowledgement"("employeeId", "policyId");

-- CreateIndex
CREATE INDEX "TrainingProgram_startDate_idx" ON "TrainingProgram"("startDate");

-- CreateIndex
CREATE INDEX "TrainingProgram_isMandatory_idx" ON "TrainingProgram"("isMandatory");

-- CreateIndex
CREATE INDEX "TrainingEnrollment_employeeId_idx" ON "TrainingEnrollment"("employeeId");

-- CreateIndex
CREATE INDEX "TrainingEnrollment_programId_idx" ON "TrainingEnrollment"("programId");

-- CreateIndex
CREATE INDEX "TrainingEnrollment_status_idx" ON "TrainingEnrollment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingEnrollment_employeeId_programId_key" ON "TrainingEnrollment"("employeeId", "programId");

-- CreateIndex
CREATE INDEX "AuditLog_employeeId_idx" ON "AuditLog"("employeeId");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Session_refreshToken_key" ON "Session"("refreshToken");

-- CreateIndex
CREATE INDEX "Session_employeeId_idx" ON "Session"("employeeId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_headId_fkey" FOREIGN KEY ("headId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_designationId_fkey" FOREIGN KEY ("designationId") REFERENCES "Designation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_reportingToId_fkey" FOREIGN KEY ("reportingToId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Qualification" ADD CONSTRAINT "Qualification_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certification" ADD CONSTRAINT "Certification_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryStructure" ADD CONSTRAINT "SalaryStructure_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryStructureItem" ADD CONSTRAINT "SalaryStructureItem_salaryStructureId_fkey" FOREIGN KEY ("salaryStructureId") REFERENCES "SalaryStructure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankDetail" ADD CONSTRAINT "BankDetail_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalarySlip" ADD CONSTRAINT "SalarySlip_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveBalance" ADD CONSTRAINT "LeaveBalance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveApplication" ADD CONSTRAINT "LeaveApplication_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveApplication" ADD CONSTRAINT "LeaveApplication_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReimbursementClaim" ADD CONSTRAINT "ReimbursementClaim_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReimbursementClaim" ADD CONSTRAINT "ReimbursementClaim_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimReceipt" ADD CONSTRAINT "ClaimReceipt_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "ReimbursementClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyAcknowledgement" ADD CONSTRAINT "PolicyAcknowledgement_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyAcknowledgement" ADD CONSTRAINT "PolicyAcknowledgement_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "PolicyDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingEnrollment" ADD CONSTRAINT "TrainingEnrollment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingEnrollment" ADD CONSTRAINT "TrainingEnrollment_programId_fkey" FOREIGN KEY ("programId") REFERENCES "TrainingProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
