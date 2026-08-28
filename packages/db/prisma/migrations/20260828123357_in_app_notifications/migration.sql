-- AlterEnum
ALTER TYPE "NotificationChannel" ADD VALUE 'IN_APP';

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "dismissedAt" TIMESTAMP(3),
ADD COLUMN     "readAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "NotificationSetting" ADD COLUMN     "inAppEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "Notification_recipientId_channel_dismissedAt_createdAt_idx" ON "Notification"("recipientId", "channel", "dismissedAt", "createdAt");
