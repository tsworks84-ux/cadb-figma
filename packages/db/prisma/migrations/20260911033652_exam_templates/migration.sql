-- CreateTable
CREATE TABLE "ExamTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "numPapers" INTEGER NOT NULL DEFAULT 1,
    "numSubjects" INTEGER NOT NULL DEFAULT 1,
    "totalMarks" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamTemplateSubject" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "paperNum" INTEGER NOT NULL,
    "subjectSlot" INTEGER NOT NULL,
    "subjectId" TEXT,
    "maxMarks" DOUBLE PRECISION,

    CONSTRAINT "ExamTemplateSubject_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExamTemplate_name_key" ON "ExamTemplate"("name");

-- CreateIndex
CREATE INDEX "ExamTemplateSubject_templateId_idx" ON "ExamTemplateSubject"("templateId");

-- CreateIndex
CREATE INDEX "ExamTemplateSubject_subjectId_idx" ON "ExamTemplateSubject"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamTemplateSubject_templateId_paperNum_subjectSlot_key" ON "ExamTemplateSubject"("templateId", "paperNum", "subjectSlot");

-- AddForeignKey
ALTER TABLE "ExamTemplateSubject" ADD CONSTRAINT "ExamTemplateSubject_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ExamTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamTemplateSubject" ADD CONSTRAINT "ExamTemplateSubject_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
