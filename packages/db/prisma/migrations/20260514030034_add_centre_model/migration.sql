-- CreateTable
CREATE TABLE "Centre" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cityId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Centre_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Centre_name_key" ON "Centre"("name");

-- CreateIndex
CREATE INDEX "Centre_cityId_idx" ON "Centre"("cityId");

-- CreateIndex
CREATE INDEX "Centre_isActive_idx" ON "Centre"("isActive");

-- AddForeignKey
ALTER TABLE "Centre" ADD CONSTRAINT "Centre_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;
