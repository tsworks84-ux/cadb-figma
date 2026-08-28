/**
 * Person's display name. The middle name is optional on students and employees
 * alike, so it is dropped (rather than left as a double space) when absent.
 */
export function fullName(person: {
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
} | null | undefined) {
  if (!person) return "";
  // Trimmed per part, not just joined: most stored names carry stray leading or
  // trailing spaces, which a plain join renders as a gap in the middle of a name.
  return [person.firstName, person.middleName, person.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
}
