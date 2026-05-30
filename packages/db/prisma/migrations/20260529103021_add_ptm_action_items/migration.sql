-- CreateEnum
CREATE TYPE "PTMActionStatus" AS ENUM ('YET_TO_START', 'ONGOING', 'COMPLETED');

-- CreateTable
CREATE TABLE "PTMActionItem" (
    "id" TEXT NOT NULL,
    "ptmId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "PTMActionStatus" NOT NULL DEFAULT 'YET_TO_START',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PTMActionItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PTMActionItem_ptmId_idx" ON "PTMActionItem"("ptmId");

-- AddForeignKey
ALTER TABLE "PTMActionItem" ADD CONSTRAINT "PTMActionItem_ptmId_fkey" FOREIGN KEY ("ptmId") REFERENCES "PTM"("id") ON DELETE CASCADE ON UPDATE CASCADE;
