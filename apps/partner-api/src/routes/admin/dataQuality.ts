import type { FastifyInstance } from "fastify";
import { cadb, partnerDb } from "../../db.js";
import { requireAdmin } from "../../lib/auth.js";
import { academicYearMap, batchSchoolIds, gradeMap, schoolMap } from "../../lib/cadbLookups.js";

type Severity = "error" | "warning" | "info";
interface Check {
  key: string;
  title: string;
  help: string;
  severity: Severity;
  count: number;
  sample: Record<string, unknown>[];
}

const SAMPLE = 25;
const check = (key: string, severity: Severity, title: string, help: string, rows: Record<string, unknown>[]): Check => ({
  key, severity, title, help, count: rows.length, sample: rows.slice(0, SAMPLE),
});
const studentName = (s: { firstName: string; middleName: string | null; lastName: string }) =>
  [s.firstName, s.middleName, s.lastName].filter(Boolean).join(" ");

// Problems that would make partner data wrong or incomplete. Everything here
// is read-only; fixes happen in CADB or in the project setup.
export async function adminDataQualityRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAdmin);

  app.get("/data-quality", async () => {
    const projects = await partnerDb.project.findMany({
      include: { grades: true, schools: { include: { grades: true } }, batches: true },
    });
    const active = projects.filter((p) => p.status === "ACTIVE");
    const projectName = new Map(projects.map((p) => [p.id, p.internalName]));
    const assigned = projects.flatMap((p) => p.batches.map((b) => ({ batchId: b.batchId, projectId: p.id })));
    const projectOfBatch = new Map(assigned.map((a) => [a.batchId, a.projectId]));

    const [schools, grades, years, allBatches] = await Promise.all([
      schoolMap(),
      gradeMap(),
      academicYearMap(),
      cadb.batch.findMany({
        select: { id: true, name: true, academicYear: true, schoolId: true, schoolIds: true, isActive: true, isArchived: true },
      }),
    ]);
    const batchById = new Map(allBatches.map((b) => [b.id, b]));

    const checks: Check[] = [];

    // 1. Links to CADB records that no longer exist.
    const dangling: Record<string, unknown>[] = [];
    for (const p of projects) {
      if (!years.has(p.startAcademicYearId)) dangling.push({ project: p.internalName, kind: "Academic year", id: p.startAcademicYearId });
      for (const g of p.grades) if (!grades.has(g.gradeId)) dangling.push({ project: p.internalName, kind: "Grade", id: g.gradeId });
      for (const s of p.schools) if (!schools.has(s.schoolId)) dangling.push({ project: p.internalName, kind: "School", id: s.schoolId });
      for (const b of p.batches) if (!batchById.has(b.batchId)) dangling.push({ project: p.internalName, kind: "Batch", id: b.batchId });
    }
    checks.push(check("dangling", "error", "Project links to CADB records that no longer exist",
      "Something was deleted in CADB after it was added to a project. Remove it from the project.", dangling));

    // 2. Students in project batches with no school — they appear in no partner data.
    const projectBatchIds = assigned.map((a) => a.batchId);
    const memberships = projectBatchIds.length
      ? await cadb.studentBatch.findMany({
          where: { batchId: { in: projectBatchIds } },
          select: {
            batchId: true,
            student: { select: { id: true, studentCode: true, firstName: true, middleName: true, lastName: true, schoolId: true, status: true } },
          },
        })
      : [];
    const noSchool = memberships.filter((m) => !m.student.schoolId).map((m) => ({
      student: studentName(m.student), code: m.student.studentCode,
      batch: batchById.get(m.batchId)?.name ?? m.batchId, project: projectName.get(projectOfBatch.get(m.batchId)!) ?? null,
    }));
    checks.push(check("student-no-school", "error", "Students in project batches with no school set",
      "Partners only see students whose own school is in the project. Set the school on these students in CADB.", noSchool));

    // 3. Students whose own school isn't one of their project's schools.
    const projectSchoolSet = new Map(projects.map((p) => [p.id, new Set(p.schools.map((s) => s.schoolId))]));
    const outside = memberships
      .filter((m) => m.student.schoolId && !projectSchoolSet.get(projectOfBatch.get(m.batchId)!)?.has(m.student.schoolId))
      .map((m) => ({
        student: studentName(m.student), code: m.student.studentCode,
        school: schools.get(m.student.schoolId!)?.name ?? m.student.schoolId,
        batch: batchById.get(m.batchId)?.name ?? m.batchId, project: projectName.get(projectOfBatch.get(m.batchId)!) ?? null,
      }));
    checks.push(check("student-school-outside", "warning", "Students whose school is not in their batch's project",
      "These students are left out of partner data on purpose, so a principal never sees another school's children. Add the school to the project if they should be included.", outside));

    // 4. Batches linked to schools the project doesn't include.
    const batchOutside: Record<string, unknown>[] = [];
    for (const a of assigned) {
      const b = batchById.get(a.batchId);
      if (!b) continue;
      const extra = batchSchoolIds(b).filter((id) => !projectSchoolSet.get(a.projectId)!.has(id));
      if (extra.length) batchOutside.push({ batch: b.name, project: projectName.get(a.projectId), schools: extra.map((id) => schools.get(id)?.name ?? id).join(", ") });
    }
    checks.push(check("batch-school-outside", "warning", "Batches linked to schools outside their project",
      "Students from those schools are left out of partner data.", batchOutside));

    // 5. Project grades with no board at a school.
    const noBoard: Record<string, unknown>[] = [];
    for (const p of active) {
      for (const s of p.schools) {
        const covered = new Set(s.grades.map((g) => g.gradeId));
        for (const g of p.grades) {
          if (!covered.has(g.gradeId)) noBoard.push({ project: p.internalName, school: schools.get(s.schoolId)?.name ?? s.schoolId, grade: grades.get(g.gradeId)?.name ?? g.gradeId });
        }
      }
    }
    checks.push(check("grade-no-board", "warning", "Grades with no board at a project school",
      "Set the board for each grade the school runs, or remove the grade from the project.", noBoard));

    // 6. Active projects with no batches yet.
    checks.push(check("project-no-batches", "info", "Active projects with no batches",
      "Partners see nothing for a project until its batches are assigned.",
      active.filter((p) => p.batches.length === 0).map((p) => ({ project: p.internalName }))));

    // 7. Active CADB batches not in any project.
    const unassigned = allBatches
      .filter((b) => b.isActive && !b.isArchived && !projectOfBatch.has(b.id))
      .sort((a, b) => b.academicYear.localeCompare(a.academicYear) || a.name.localeCompare(b.name))
      .map((b) => ({ batch: b.name, academicYear: b.academicYear, schools: batchSchoolIds(b).map((id) => schools.get(id)?.name ?? id).join(", ") || "—" }));
    checks.push(check("batch-unassigned", "info", "Active batches not in any project",
      "Expected for batches of our own programs. Assign partner batches on the Batches page.", unassigned));

    // 8. Archived projects still holding batches.
    checks.push(check("archived-with-batches", "info", "Archived projects still holding batches",
      "Partners no longer see these. Move the batches if they belong to a new project.",
      projects.filter((p) => p.status === "ARCHIVED" && p.batches.length > 0).map((p) => ({ project: p.internalName, batches: p.batches.length }))));

    // 9. Inactive CADB schools in active projects.
    const inactiveSchools: Record<string, unknown>[] = [];
    for (const p of active) for (const s of p.schools) {
      const school = schools.get(s.schoolId);
      if (school && !school.isActive) inactiveSchools.push({ project: p.internalName, school: school.name });
    }
    checks.push(check("inactive-school", "warning", "Inactive CADB schools in active projects",
      "The school is switched off in CADB but still part of a project.", inactiveSchools));

    return { generatedAt: new Date(), checks };
  });
}
