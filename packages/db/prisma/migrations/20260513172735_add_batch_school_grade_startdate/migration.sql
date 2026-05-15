-- AlterTable
ALTER TABLE "Batch" ADD COLUMN     "gradeId" TEXT,
ADD COLUMN     "schoolId" TEXT,
ADD COLUMN     "startDate" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Batch_schoolId_idx" ON "Batch"("schoolId");

-- CreateIndex
CREATE INDEX "Batch_gradeId_idx" ON "Batch"("gradeId");

-- AddForeignKey
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE SET NULL ON UPDATE CASCADE;
