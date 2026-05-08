/*
  Warnings:

  - You are about to drop the column `isActive` on the `Announcement` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "AnnouncementStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AnnouncementAudience" AS ENUM ('ALL_EMPLOYEES', 'MANAGERS', 'HR_ONLY');

-- DropIndex
DROP INDEX "Announcement_isActive_idx";

-- AlterTable
ALTER TABLE "Announcement" DROP COLUMN "isActive",
ADD COLUMN     "audience" "AnnouncementAudience" NOT NULL DEFAULT 'ALL_EMPLOYEES',
ADD COLUMN     "notifiedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "status" "AnnouncementStatus" NOT NULL DEFAULT 'DRAFT';

-- CreateTable
CREATE TABLE "AnnouncementView" (
    "id" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnnouncementView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnnouncementView_announcementId_idx" ON "AnnouncementView"("announcementId");

-- CreateIndex
CREATE INDEX "AnnouncementView_employeeId_idx" ON "AnnouncementView"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "AnnouncementView_announcementId_employeeId_key" ON "AnnouncementView"("announcementId", "employeeId");

-- CreateIndex
CREATE INDEX "Announcement_status_idx" ON "Announcement"("status");

-- AddForeignKey
ALTER TABLE "AnnouncementView" ADD CONSTRAINT "AnnouncementView_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementView" ADD CONSTRAINT "AnnouncementView_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
