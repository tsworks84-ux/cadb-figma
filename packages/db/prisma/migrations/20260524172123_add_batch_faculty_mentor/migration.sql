-- AlterTable
ALTER TABLE "Batch" ADD COLUMN     "facultyMentorId" TEXT;

-- AddForeignKey
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_facultyMentorId_fkey" FOREIGN KEY ("facultyMentorId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
