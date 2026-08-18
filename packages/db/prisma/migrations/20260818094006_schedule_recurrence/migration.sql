-- AlterTable
ALTER TABLE "Schedule" ADD COLUMN     "recurrenceId" TEXT;

-- CreateIndex
CREATE INDEX "Schedule_recurrenceId_idx" ON "Schedule"("recurrenceId");
