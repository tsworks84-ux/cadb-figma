-- AlterTable
ALTER TABLE "Employee" ALTER COLUMN "gender" DROP NOT NULL,
ALTER COLUMN "dateOfBirth" DROP NOT NULL,
ALTER COLUMN "personalPhone" DROP NOT NULL,
ALTER COLUMN "currentAddress" DROP NOT NULL,
ALTER COLUMN "emergencyContactName" DROP NOT NULL,
ALTER COLUMN "emergencyContactPhone" DROP NOT NULL,
ALTER COLUMN "emergencyRelation" DROP NOT NULL;
