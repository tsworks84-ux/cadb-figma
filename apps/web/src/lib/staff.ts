/**
 * Which staff a dropdown may offer. Mirrors apps/api/src/utils/staffStatus.ts.
 *
 *   • Only people still on staff (new joiners start on PROBATION, so it counts).
 *   • With a subject chosen, only that subject's faculty — anyone who teaches it
 *     in a batch (`subjectIds` from /employees/lookup). If nobody is mapped to the
 *     subject yet, the full on-staff list is offered rather than an empty one.
 *   • `keep` ids stay in the list even if they no longer qualify, so a saved
 *     choice still shows its name when an old record is edited.
 */
export const WORKING_STATUSES = new Set(["ACTIVE", "PROBATION", "ON_LEAVE", "NOTICE_PERIOD"]);

type Staff = { id: string; status?: string | null; subjectIds?: string[] };

export function pickableStaff<T extends Staff>(
  list: T[],
  opts: { subjectId?: string | null; keep?: (string | null | undefined)[] } = {},
): T[] {
  const keep = new Set(opts.keep?.filter(Boolean) as string[] | undefined);
  const working = list.filter((e) => !e.status || WORKING_STATUSES.has(e.status));
  let pool = working;
  if (opts.subjectId) {
    const teaches = working.filter((e) => e.subjectIds?.includes(opts.subjectId!));
    if (teaches.length) pool = teaches;
  }
  if (keep.size === 0) return pool;
  const ids = new Set(pool.map((e) => e.id));
  return list.filter((e) => ids.has(e.id) || keep.has(e.id));
}
