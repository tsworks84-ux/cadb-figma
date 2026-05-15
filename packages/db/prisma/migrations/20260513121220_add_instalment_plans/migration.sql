-- CreateTable
CREATE TABLE "InstalmentPlan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "courseId" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstalmentPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstalmentPlanItem" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "instalmentNo" INTEGER NOT NULL,
    "label" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "daysFromAdmission" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstalmentPlanItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InstalmentPlan_courseId_idx" ON "InstalmentPlan"("courseId");

-- CreateIndex
CREATE INDEX "InstalmentPlan_isActive_idx" ON "InstalmentPlan"("isActive");

-- CreateIndex
CREATE INDEX "InstalmentPlanItem_planId_idx" ON "InstalmentPlanItem"("planId");

-- AddForeignKey
ALTER TABLE "InstalmentPlan" ADD CONSTRAINT "InstalmentPlan_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstalmentPlanItem" ADD CONSTRAINT "InstalmentPlanItem_planId_fkey" FOREIGN KEY ("planId") REFERENCES "InstalmentPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
