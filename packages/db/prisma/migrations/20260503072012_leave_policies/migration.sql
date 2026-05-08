-- CreateTable
CREATE TABLE "LeavePolicy" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeavePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeavePolicyRule" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "leaveType" "LeaveType" NOT NULL,
    "daysPerYear" DOUBLE PRECISION NOT NULL,
    "maxCarryForward" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "LeavePolicyRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeavePolicyGrade" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "grade" TEXT NOT NULL,

    CONSTRAINT "LeavePolicyGrade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeavePolicyRule_policyId_idx" ON "LeavePolicyRule"("policyId");

-- CreateIndex
CREATE UNIQUE INDEX "LeavePolicyRule_policyId_leaveType_key" ON "LeavePolicyRule"("policyId", "leaveType");

-- CreateIndex
CREATE INDEX "LeavePolicyGrade_policyId_idx" ON "LeavePolicyGrade"("policyId");

-- CreateIndex
CREATE UNIQUE INDEX "LeavePolicyGrade_policyId_grade_key" ON "LeavePolicyGrade"("policyId", "grade");

-- AddForeignKey
ALTER TABLE "LeavePolicyRule" ADD CONSTRAINT "LeavePolicyRule_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "LeavePolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeavePolicyGrade" ADD CONSTRAINT "LeavePolicyGrade_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "LeavePolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
