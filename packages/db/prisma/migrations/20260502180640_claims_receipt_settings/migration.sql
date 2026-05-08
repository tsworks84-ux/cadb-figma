-- AlterTable
ALTER TABLE "ClaimReceipt" ADD COLUMN     "mimeType" TEXT,
ALTER COLUMN "amount" SET DEFAULT 0;

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);
