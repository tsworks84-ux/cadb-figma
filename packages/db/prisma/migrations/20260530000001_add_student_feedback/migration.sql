-- CreateEnum
CREATE TYPE "FeedbackType" AS ENUM ('SUGGESTION', 'CONCERN');

-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateTable
CREATE TABLE "StudentFeedback" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "type" "FeedbackType" NOT NULL,
    "message" TEXT NOT NULL,
    "status" "FeedbackStatus" NOT NULL DEFAULT 'OPEN',
    "retractedAt" TIMESTAMP(3),
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentFeedback_studentId_idx" ON "StudentFeedback"("studentId");

-- CreateIndex
CREATE INDEX "StudentFeedback_status_idx" ON "StudentFeedback"("status");

-- AddForeignKey
ALTER TABLE "StudentFeedback" ADD CONSTRAINT "StudentFeedback_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
