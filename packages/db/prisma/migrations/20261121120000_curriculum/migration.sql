-- CreateEnum
CREATE TYPE "CurriculumLevel" AS ENUM ('CHAPTER', 'TOPIC', 'SUBTOPIC');

-- CreateTable
CREATE TABLE "Curriculum" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "gradeId" TEXT NOT NULL,
    "board" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Curriculum_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CurriculumItem" (
    "id" TEXT NOT NULL,
    "curriculumId" TEXT NOT NULL,
    "parentId" TEXT,
    "level" "CurriculumLevel" NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CurriculumItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Curriculum_gradeId_idx" ON "Curriculum"("gradeId");

-- CreateIndex
CREATE UNIQUE INDEX "Curriculum_subjectId_gradeId_board_key" ON "Curriculum"("subjectId", "gradeId", "board");

-- CreateIndex
CREATE INDEX "CurriculumItem_curriculumId_sortOrder_idx" ON "CurriculumItem"("curriculumId", "sortOrder");

-- CreateIndex
CREATE INDEX "CurriculumItem_parentId_idx" ON "CurriculumItem"("parentId");

-- AddForeignKey
ALTER TABLE "Curriculum" ADD CONSTRAINT "Curriculum_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Curriculum" ADD CONSTRAINT "Curriculum_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurriculumItem" ADD CONSTRAINT "CurriculumItem_curriculumId_fkey" FOREIGN KEY ("curriculumId") REFERENCES "Curriculum"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurriculumItem" ADD CONSTRAINT "CurriculumItem_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "CurriculumItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
