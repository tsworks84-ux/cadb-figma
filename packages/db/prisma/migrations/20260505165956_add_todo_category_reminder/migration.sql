-- AlterEnum
ALTER TYPE "ReminderType" ADD VALUE 'THIRTY_MIN_BEFORE';

-- AlterTable
ALTER TABLE "PersonalTodo" ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'General';
