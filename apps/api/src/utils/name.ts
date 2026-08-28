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
  return [person.firstName, person.middleName, person.lastName].filter(Boolean).join(" ");
}
