import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export { PrismaClient } from "@prisma/client";
export type {
  Employee,
  Department,
  Designation,
  Qualification,
  Certification,
  SalaryStructure,
  SalaryStructureItem,
  BankDetail,
  SalarySlip,
  LeaveBalance,
  LeaveApplication,
  ReimbursementClaim,
  ClaimReceipt,
  PolicyDocument,
  PolicyAcknowledgement,
  TrainingProgram,
  TrainingEnrollment,
  AuditLog,
  Session,
} from "@prisma/client";

export {
  Gender,
  MaritalStatus,
  BloodGroup,
  EmploymentType,
  EmploymentStatus,
  DegreeLevel,
  LeaveType,
  LeaveStatus,
  ClaimType,
  ClaimStatus,
  TrainingStatus,
  PolicyCategory,
  SalaryComponent,
} from "@prisma/client";
