import { prisma } from "@cadb/db";

// Auto-set CONCLUDED when both attendance is marked AND an assignment is linked.
// Skips if already CANCELLED or CONCLUDED.
export async function maybeAutoConcludes(scheduleId: string) {
  const s = await prisma.schedule.findUnique({
    where: { id: scheduleId },
    select: {
      status: true,
      _count: { select: { attendances: true, assignments: true } },
    },
  });
  if (!s || s.status === "CANCELLED" || s.status === "CONCLUDED") return;
  if (s._count.attendances > 0 && s._count.assignments > 0) {
    await prisma.schedule.update({ where: { id: scheduleId }, data: { status: "CONCLUDED" } });
  }
}
