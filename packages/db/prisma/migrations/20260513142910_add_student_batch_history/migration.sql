-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "batchAssignedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "StudentBatchHistory" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "batchId" TEXT,
    "batchName" TEXT NOT NULL,
    "academicYear" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL,
    "removedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentBatchHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentBatchHistory_studentId_idx" ON "StudentBatchHistory"("studentId");

-- AddForeignKey
ALTER TABLE "StudentBatchHistory" ADD CONSTRAINT "StudentBatchHistory_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentBatchHistory" ADD CONSTRAINT "StudentBatchHistory_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
