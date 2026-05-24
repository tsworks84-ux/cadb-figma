-- CreateTable
CREATE TABLE "StudentPaymentLog" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "instalmentId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "paymentMode" TEXT,
    "paymentDate" TIMESTAMP(3),
    "receiptNumber" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentPaymentLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentPaymentLog_studentId_idx" ON "StudentPaymentLog"("studentId");

-- AddForeignKey
ALTER TABLE "StudentPaymentLog" ADD CONSTRAINT "StudentPaymentLog_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPaymentLog" ADD CONSTRAINT "StudentPaymentLog_instalmentId_fkey" FOREIGN KEY ("instalmentId") REFERENCES "StudentInstalment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
