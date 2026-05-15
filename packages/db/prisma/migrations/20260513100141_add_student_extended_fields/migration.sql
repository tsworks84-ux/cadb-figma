-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "discountAmount" DOUBLE PRECISION,
ADD COLUMN     "nationality" TEXT DEFAULT 'Indian',
ADD COLUMN     "paidFee" DOUBLE PRECISION,
ADD COLUMN     "parentAddress" JSONB,
ADD COLUMN     "parentOccupation" TEXT,
ADD COLUMN     "paymentMode" TEXT,
ADD COLUMN     "receiptNumber" TEXT,
ADD COLUMN     "rollNumber" TEXT,
ADD COLUMN     "schoolId" TEXT,
ADD COLUMN     "totalFee" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "Student_schoolId_idx" ON "Student"("schoolId");

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;
