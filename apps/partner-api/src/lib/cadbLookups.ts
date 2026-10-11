import { cadb } from "../db.js";

// Small reference tables from CADB, read through the read-only login.

export async function gradeMap() {
  const grades = await cadb.grade.findMany({
    select: { id: true, name: true, sortOrder: true, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return new Map(grades.map((g) => [g.id, g]));
}

export async function schoolMap(ids?: string[]) {
  const schools = await cadb.school.findMany({
    where: ids ? { id: { in: ids } } : undefined,
    select: { id: true, name: true, city: true, board: true, isActive: true },
    orderBy: { name: "asc" },
  });
  return new Map(schools.map((s) => [s.id, s]));
}

export async function academicYearMap() {
  const years = await cadb.academicYear.findMany({
    select: { id: true, name: true, isActive: true, isArchived: true },
    orderBy: { name: "desc" },
  });
  return new Map(years.map((y) => [y.id, y]));
}

/** Ids from `wanted` that do not exist in CADB. */
export async function missingIds(model: "school" | "grade" | "academicYear" | "batch", wanted: string[]) {
  const unique = [...new Set(wanted)];
  if (unique.length === 0) return [];
  const where = { id: { in: unique } };
  const select = { id: true } as const;
  const found =
    model === "school" ? await cadb.school.findMany({ where, select })
    : model === "grade" ? await cadb.grade.findMany({ where, select })
    : model === "academicYear" ? await cadb.academicYear.findMany({ where, select })
    : await cadb.batch.findMany({ where, select });
  const have = new Set(found.map((r) => r.id));
  return unique.filter((id) => !have.has(id));
}

/** Every school a batch is linked to: its primary school plus any extra ones. */
export const batchSchoolIds = (b: { schoolId: string | null; schoolIds: string[] }) =>
  [...new Set([...(b.schoolId ? [b.schoolId] : []), ...b.schoolIds])];
