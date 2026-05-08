-- AlterTable
ALTER TABLE "Announcement" ADD COLUMN     "attachments" JSONB NOT NULL DEFAULT '[]';
