import "dotenv/config";
import { readFileSync } from "fs";
import { prisma } from "@cadb/db";
import { outlineCounts, writeOutline, type Outline } from "../utils/curriculum.js";

/**
 * Loads the initial curricula into Academic Settings → Curriculum, from
 * apps/api/seed/curriculum-centum-pow.json — the "CENTUM POW" sheet (Foundation,
 * CBSE, JEE/NEET) plus the ICSE sheets of the Foundation-programme PoW workbooks,
 * normalised (see docs/BUSINESS_RULES.md §6.5).
 *
 * Each entry is { grade, subject, board, chapters } where grade is a Grade.name
 * (VIII…XII) and subject a Subject.code (PHY/CHE/MAT/BIO). A curriculum that
 * already exists is left alone unless --replace is passed, so a second run, or a
 * run after someone has edited a curriculum in the app, changes nothing.
 *
 * Dry run unless --apply:
 *
 *     node dist/scripts/seed-curriculum.js seed/curriculum-centum-pow.json
 *     node dist/scripts/seed-curriculum.js seed/curriculum-centum-pow.json --apply [--replace]
 */

type Entry = { grade: string; subject: string; board: string; chapters: Outline };

async function main() {
  const file = process.argv[2];
  const apply = process.argv.includes("--apply");
  const replace = process.argv.includes("--replace");
  if (!file || file.startsWith("--")) throw new Error("Usage: seed-curriculum <file.json> [--apply] [--replace]");

  const entries: Entry[] = JSON.parse(readFileSync(file, "utf8"));
  const [subjects, grades] = await Promise.all([
    prisma.subject.findMany({ select: { id: true, code: true } }),
    prisma.grade.findMany({ select: { id: true, name: true } }),
  ]);
  const subjectId = new Map(subjects.map((s) => [s.code.toUpperCase(), s.id]));
  const gradeId = new Map(grades.map((g) => [g.name.toUpperCase(), g.id]));

  let wrote = 0, skipped = 0, missing = 0;
  for (const e of entries) {
    const label = `${e.grade.padEnd(4)} ${e.subject} ${e.board.padEnd(8)}`;
    const sid = subjectId.get(e.subject.toUpperCase());
    const gid = gradeId.get(e.grade.toUpperCase());
    const n = outlineCounts(e.chapters);
    if (!sid || !gid) {
      console.log(`${label}  MISSING ${!sid ? `subject ${e.subject}` : ""} ${!gid ? `grade ${e.grade}` : ""}`);
      missing++;
      continue;
    }
    const key = { subjectId: sid, gradeId: gid, board: e.board };
    const existing = await prisma.curriculum.findUnique({ where: { subjectId_gradeId_board: key }, select: { id: true } });
    if (existing && !replace) {
      console.log(`${label}  exists — skipped`);
      skipped++;
      continue;
    }
    console.log(`${label}  ${existing ? "replace" : "create "}  ${n.chapters} chapters, ${n.topics} topics, ${n.subtopics} subtopics`);
    if (!apply) continue;
    await prisma.$transaction(async (tx) => {
      const c = existing ?? (await tx.curriculum.create({ data: key }));
      await writeOutline(tx, c.id, e.chapters, "replace");
    }, { timeout: 60_000 });
    wrote++;
  }
  console.log(`\n${apply ? "Wrote" : "Would write"} ${apply ? wrote : entries.length - skipped - missing}, skipped ${skipped}, missing refs ${missing}.${apply ? "" : " Dry run — pass --apply."}`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
