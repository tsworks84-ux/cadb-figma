-- AlterTable
ALTER TABLE "Batch" ADD COLUMN     "courseIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "schoolIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "targetStrength" INTEGER;
