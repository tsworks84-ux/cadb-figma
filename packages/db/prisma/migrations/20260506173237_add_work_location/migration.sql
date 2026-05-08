-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "workLocation" TEXT;

-- CreateTable
CREATE TABLE "WorkLocation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkLocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkLocation_name_key" ON "WorkLocation"("name");
