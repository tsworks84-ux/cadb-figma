/**
 * Employment statuses, split by whether the person is still on staff.
 *
 *   • Working: can be picked in any staff dropdown (new joiners start on PROBATION).
 *   • Archived: has left. Hidden from pickers and from the main Employees list;
 *     shown under Employees → Archive.
 *   • DRAFT is neither: an unfinished onboarding record. It stays on the main
 *     list (so HR can finish it) but is never offered in a picker.
 */
export const WORKING_STATUSES = ["ACTIVE", "PROBATION", "ON_LEAVE", "NOTICE_PERIOD"] as const;
export const ARCHIVED_STATUSES = ["TERMINATED", "RESIGNED", "RETIRED", "EXITED"] as const;
