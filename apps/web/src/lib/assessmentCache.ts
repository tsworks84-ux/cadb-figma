import type { QueryClient } from "@tanstack/react-query";

/**
 * Every cache an exam touches, invalidated together.
 *
 * The list (["assessments", params]), the detail page (["assessment", id]),
 * its marks grid (["assessment-results", id]) and the stats panel
 * (["assessment-stats", params]) are four separate keys, and "assessment" is
 * not a prefix of "assessments" — so invalidating one leaves the others alone.
 * With the app's 5-minute staleTime and refetchOnWindowFocus off, that meant an
 * exam edited from the list still opened with its old subjects and max marks
 * for minutes afterwards, and only a delete-and-recreate (a fresh id, so a
 * fresh cache key) showed the change. Refresh all four on any exam write.
 */
export function invalidateAssessments(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ["assessments"] });
  qc.invalidateQueries({ queryKey: ["assessment"] });
  qc.invalidateQueries({ queryKey: ["assessment-results"] });
  qc.invalidateQueries({ queryKey: ["assessment-stats"] });
}
