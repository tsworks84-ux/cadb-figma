import { prisma } from "@cadb/db";

/**
 * Returns the deduplicated set of batchIds associated with a teacher via
 * any of three channels:
 *   1. facultyMentorId on Batch
 *   2. employeeId on BatchSubject
 *   3. employeeId on Schedule (via ScheduleBatch junction)
 */
export async function getTeacherBatchIds(teacherId: string): Promise<string[]> {
  const [mentorBatches, subjectBatches, scheduleBatches] = await Promise.all([
    prisma.batch.findMany({
      where:  { facultyMentorId: teacherId, isArchived: false },
      select: { id: true },
    }),
    prisma.batchSubject.findMany({
      where:  { employeeId: teacherId },
      select: { batchId: true },
    }),
    prisma.scheduleBatch.findMany({
      where:  { schedule: { employeeId: teacherId } },
      select: { batchId: true },
    }),
  ]);

  const ids = new Set<string>();
  for (const b of mentorBatches)  ids.add(b.id);
  for (const b of subjectBatches) ids.add(b.batchId);
  for (const b of scheduleBatches) ids.add(b.batchId);
  return [...ids];
}
