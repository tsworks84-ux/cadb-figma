-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "fee" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "discountType" TEXT,
ADD COLUMN     "paymentDate" TIMESTAMP(3),
ADD COLUMN     "paymentNote" TEXT;

-- CreateTable
CREATE TABLE "StudentInstalment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "instalmentNo" INTEGER NOT NULL,
    "label" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),
    "paidAmount" DOUBLE PRECISION,
    "paymentMode" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentInstalment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentInstalment_studentId_idx" ON "StudentInstalment"("studentId");

-- AddForeignKey
ALTER TABLE "StudentInstalment" ADD CONSTRAINT "StudentInstalment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
