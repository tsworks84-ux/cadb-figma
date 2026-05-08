-- CreateTable
CREATE TABLE "TeamMembership" (
    "id" TEXT NOT NULL,
    "teamOwnerId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMembership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeamMembership_teamOwnerId_idx" ON "TeamMembership"("teamOwnerId");

-- CreateIndex
CREATE INDEX "TeamMembership_memberId_idx" ON "TeamMembership"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMembership_teamOwnerId_memberId_key" ON "TeamMembership"("teamOwnerId", "memberId");

-- AddForeignKey
ALTER TABLE "TeamMembership" ADD CONSTRAINT "TeamMembership_teamOwnerId_fkey" FOREIGN KEY ("teamOwnerId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMembership" ADD CONSTRAINT "TeamMembership_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
