-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "refundAmount" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "StudentRefund" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "refundMode" TEXT,
    "refundDate" TIMESTAMP(3),
    "referenceNumber" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentRefund_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentRefund_studentId_idx" ON "StudentRefund"("studentId");

-- AddForeignKey
ALTER TABLE "StudentRefund" ADD CONSTRAINT "StudentRefund_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
