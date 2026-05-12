-- CreateTable
CREATE TABLE "PartTimeEntry" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "lectureHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ptmHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "otherHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "otherReason" TEXT,
    "answerScripts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartTimeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PartTimeEntry_employeeId_idx" ON "PartTimeEntry"("employeeId");

-- CreateIndex
CREATE INDEX "PartTimeEntry_date_idx" ON "PartTimeEntry"("date");

-- CreateIndex
CREATE UNIQUE INDEX "PartTimeEntry_employeeId_date_key" ON "PartTimeEntry"("employeeId", "date");

-- AddForeignKey
ALTER TABLE "PartTimeEntry" ADD CONSTRAINT "PartTimeEntry_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
