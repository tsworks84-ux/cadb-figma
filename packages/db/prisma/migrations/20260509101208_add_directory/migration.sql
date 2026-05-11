-- AlterTable
ALTER TABLE "ClaimTypeConfig" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "DirectoryEntry" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "areas" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DirectoryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DirectoryEntry_employeeId_key" ON "DirectoryEntry"("employeeId");

-- CreateIndex
CREATE INDEX "DirectoryEntry_displayOrder_idx" ON "DirectoryEntry"("displayOrder");

-- AddForeignKey
ALTER TABLE "DirectoryEntry" ADD CONSTRAINT "DirectoryEntry_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
