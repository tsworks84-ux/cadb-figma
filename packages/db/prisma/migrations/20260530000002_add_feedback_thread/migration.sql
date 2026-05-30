-- AlterEnum: add RESPONDED and CLOSED_BY_STUDENT
ALTER TYPE "FeedbackStatus" ADD VALUE 'RESPONDED';
ALTER TYPE "FeedbackStatus" ADD VALUE 'CLOSED_BY_STUDENT';

-- CreateTable
CREATE TABLE "FeedbackMessage" (
    "id" TEXT NOT NULL,
    "feedbackId" TEXT NOT NULL,
    "senderType" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "senderName" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "attachmentUrl" TEXT,
    "attachmentName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedbackMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeedbackMessage_feedbackId_idx" ON "FeedbackMessage"("feedbackId");

-- AddForeignKey
ALTER TABLE "FeedbackMessage" ADD CONSTRAINT "FeedbackMessage_feedbackId_fkey"
    FOREIGN KEY ("feedbackId") REFERENCES "StudentFeedback"("id") ON DELETE CASCADE ON UPDATE CASCADE;
