-- CreateTable: StudentBatch junction for many-to-many student-batch membership
CREATE TABLE "StudentBatch" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentBatch_pkey" PRIMARY KEY ("id")
);

-- Migrate existing single-batch assignments to the junction table
INSERT INTO "StudentBatch" ("id", "studentId", "batchId", "joinedAt")
SELECT
    gen_random_uuid()::text,
    id,
    "batchId",
    COALESCE("batchAssignedAt", now())
FROM "Student"
WHERE "batchId" IS NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "StudentBatch_studentId_batchId_key" ON "StudentBatch"("studentId", "batchId");
CREATE INDEX "StudentBatch_studentId_idx" ON "StudentBatch"("studentId");
CREATE INDEX "StudentBatch_batchId_idx" ON "StudentBatch"("batchId");

-- AddForeignKey
ALTER TABLE "StudentBatch" ADD CONSTRAINT "StudentBatch_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentBatch" ADD CONSTRAINT "StudentBatch_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DropIndex
DROP INDEX IF EXISTS "Student_batchId_idx";

-- AlterTable: remove single-batch columns from Student
ALTER TABLE "Student" DROP COLUMN IF EXISTS "batchId";
ALTER TABLE "Student" DROP COLUMN IF EXISTS "batchAssignedAt";
