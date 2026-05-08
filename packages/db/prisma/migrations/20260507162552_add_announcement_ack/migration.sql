-- CreateTable
CREATE TABLE "AnnouncementAck" (
    "id" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "ackedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnnouncementAck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnnouncementAck_announcementId_idx" ON "AnnouncementAck"("announcementId");

-- CreateIndex
CREATE INDEX "AnnouncementAck_employeeId_idx" ON "AnnouncementAck"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "AnnouncementAck_announcementId_employeeId_key" ON "AnnouncementAck"("announcementId", "employeeId");

-- AddForeignKey
ALTER TABLE "AnnouncementAck" ADD CONSTRAINT "AnnouncementAck_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementAck" ADD CONSTRAINT "AnnouncementAck_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
