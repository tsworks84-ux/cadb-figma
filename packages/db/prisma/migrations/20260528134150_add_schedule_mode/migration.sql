-- CreateEnum
CREATE TYPE "ClassMode" AS ENUM ('ONLINE', 'OFFLINE');

-- AlterTable
ALTER TABLE "Schedule" ADD COLUMN     "mode" "ClassMode" NOT NULL DEFAULT 'OFFLINE';
