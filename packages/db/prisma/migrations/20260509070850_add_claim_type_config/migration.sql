-- Convert claimType from enum to text using cast (preserves existing data)
ALTER TABLE "ReimbursementClaim" ALTER COLUMN "claimType" TYPE TEXT USING "claimType"::TEXT;

-- DropEnum
DROP TYPE "ClaimType";

-- CreateTable
CREATE TABLE "ClaimTypeConfig" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "requiresDocument" BOOLEAN NOT NULL DEFAULT false,
    "isSettleable" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),

    CONSTRAINT "ClaimTypeConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClaimTypeConfig_name_key" ON "ClaimTypeConfig"("name");

-- CreateIndex (drop first in case it exists from before)
DROP INDEX IF EXISTS "ReimbursementClaim_claimType_idx";
CREATE INDEX "ReimbursementClaim_claimType_idx" ON "ReimbursementClaim"("claimType");

-- Seed default claim types
INSERT INTO "ClaimTypeConfig" ("id","name","label","requiresDocument","isSettleable","isActive","createdAt","updatedAt") VALUES
  ('ctc_travel',        'TRAVEL',        'Travel',        false, true,  true, NOW(), NOW()),
  ('ctc_medical',       'MEDICAL',       'Medical',       true,  false, true, NOW(), NOW()),
  ('ctc_food',          'FOOD',          'Food & Meals',  false, true,  true, NOW(), NOW()),
  ('ctc_accommodation', 'ACCOMMODATION', 'Accommodation', false, true,  true, NOW(), NOW()),
  ('ctc_training',      'TRAINING',      'Training',      false, true,  true, NOW(), NOW()),
  ('ctc_other',         'OTHER',         'Other',         false, true,  true, NOW(), NOW());
