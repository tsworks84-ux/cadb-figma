-- CreateEnum
CREATE TYPE "ReminderType" AS ENUM ('NONE', 'ON_DUE_DATE', 'ONE_HOUR_BEFORE', 'THREE_HOURS_BEFORE', 'ONE_DAY_BEFORE', 'TWO_DAYS_BEFORE', 'ONE_WEEK_BEFORE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "TodoPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateTable
CREATE TABLE "PersonalTodo" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3),
    "priority" "TodoPriority" NOT NULL DEFAULT 'MEDIUM',
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "reminderType" "ReminderType" NOT NULL DEFAULT 'NONE',
    "reminderAt" TIMESTAMP(3),
    "googleEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalTodo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoogleCalendarConnection" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "calendarId" TEXT NOT NULL DEFAULT 'primary',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleCalendarConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PersonalTodo_employeeId_idx" ON "PersonalTodo"("employeeId");

-- CreateIndex
CREATE INDEX "PersonalTodo_dueDate_idx" ON "PersonalTodo"("dueDate");

-- CreateIndex
CREATE INDEX "PersonalTodo_completed_idx" ON "PersonalTodo"("completed");

-- CreateIndex
CREATE UNIQUE INDEX "GoogleCalendarConnection_employeeId_key" ON "GoogleCalendarConnection"("employeeId");

-- CreateIndex
CREATE INDEX "GoogleCalendarConnection_employeeId_idx" ON "GoogleCalendarConnection"("employeeId");

-- AddForeignKey
ALTER TABLE "PersonalTodo" ADD CONSTRAINT "PersonalTodo_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoogleCalendarConnection" ADD CONSTRAINT "GoogleCalendarConnection_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
