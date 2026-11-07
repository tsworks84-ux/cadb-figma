# Access control

Who can see and do what, and where that is decided in the code. Authorisation in CADB has **three
independent sources** — read all three before changing a permission, because a feature is usually gated
by more than one.

1. **Role** — four built-in roles plus admin-created custom roles.
2. **Permission matrix** — per role × module flags in the `RolePermission` table.
3. **Reporting line** — supervisor / department head relationships, regardless of role.

The API is the enforcement point. The web UI hides what you cannot use, but every rule must also be
checked server-side.

---

## 1. Roles

| Role | Code prefix | Intent |
|---|---|---|
| `SUPER_ADMIN` | `SA` | Everything. Bypasses the permission matrix entirely (its grants are implicit and not editable). |
| `HR_ADMIN` | `HR` | HR operations: employees, leave/claim administration, payroll reports. Goes through the matrix for Academics and most modules. |
| `DEPT_HEAD` | `DH` | Head of a department; sees and approves within their scope. |
| `EMPLOYEE` | `EM` | Self-service. |
| *custom roles* | — | Created in Administration → Custom Roles (`CustomRole`). Start with **no grants** (deny-all); a Super Admin ticks modules in Roles & Permissions. Optionally limited to departments (`RoleDepartmentAccess`); a role with **zero departments** has no employee-directory access at all — used for module-only roles such as an Academic Coordinator. |

The role is carried in the JWT (`request.user.role`). Employee codes are `YYMM` + a 3-digit serial
(e.g. `2603001`); the Super Admin account is `SA0001`.

---

## 2. Permission matrix

`RolePermission(role, module)` holds six flags: `canView`, `canCreate`, `canEdit`, `canDelete`,
`canApprove`, `canAppraise`. The module list and **default grants per built-in role** are in
`apps/api/src/routes/v1/roles.ts` (`MODULES`, `DEFAULT_PERMISSIONS`). When a module is added to
`MODULES`, `backfillMissingModules` creates the missing rows with the defaults the next time a role's
permissions are read — so a new module needs its defaults written there.

| Group | Modules | Notes |
|---|---|---|
| Employee records | `EMP_PROFILE`, `EMP_DOCUMENTS`, `EMP_SALARY`, `EMP_BANK`, `EMP_LEAVES`, `EMP_PAYOUT` | One employee's data on their profile tabs |
| Org-wide records | `EMP_ALL_LEAVES`, `EMP_ALL_CLAIMS` | Employees → Leaves / Claims browsers. View = list; Approve = decide |
| Self-service | `LEAVES`, `CLAIMS`, `POLICIES`, `TRAINING` | Pages every employee uses |
| MIS reports | `MIS_EMP_DIRECTORY`, `MIS_SALARY_STRUCT`, `MIS_SALARY_DISB`, `MIS_LEAVE_RECORDS`, `MIS_HOLIDAYS`, `MIS_CLAIMS` | One card each; the matrix is the **only** control (no role bypass) |
| Academics | `ACA_OVERVIEW`, `ACA_BATCH`, `ACA_SUBJECT`, `ACA_SETTINGS`, `STU_PROFILE`, `STU_ADMISSION`, `STU_ATTENDANCE`, `STU_ASSIGNMENT`, `STU_ASSESSMENT`, `STU_TIMETABLE` | Every role except Super Admin — **HR included** — goes through the matrix |
| Administration | `ADM_DEPARTMENTS`, `ADM_DESIGNATIONS`, `ADM_LEAVE_POLICIES`, `ADM_WORK_LOCATIONS`, `ADM_CLAIM_TYPES` | One per tab, so a single tab can be delegated |
| Resources | `RESOURCES` | View = open library; Create = add own; Edit/Delete/Approve(Hide) = moderate others' |

**Helpers** (`apps/api/src/utils/permissions.ts`): `hasPermission(user, module, action)`,
`hasAnyPermission`, `requirePermission(module, action)` (route preHandler), `isCustomRole(role)`,
academics helpers. The web reads the caller's grants from `GET /api/v1/roles/my-permissions`
(`hooks/usePermissions.ts`; Super Admin short-circuits to allow-all and skips the call).

### Things that are deliberately *not* in the matrix (Super Admin only)
Custom Roles and Roles & Permissions tabs (granting them would let the holder grant themselves
everything), Administration → Notifications channel toggles, Revenue, Student Feedback, the unfiltered
Academics view.

### Super Admin + HR only, also deliberately outside the matrix
Force-cancel and permanent delete of leaves/claims, and the Deletion Log (`/api/v1/audit-logs`) that
records them — whoever can delete can always see what was deleted. An old `canDelete` flag on
`EMP_LEAVES` exists in the matrix but is intentionally ignored here.

---

## 3. Reporting-line authority

Some powers come from the org chart, whatever the role (`apps/api/src/utils/orgHierarchy.ts`):

- **Immediate supervisor** — `Employee.reportingToId`.
- **Department head** — stored twice and kept in sync by `employees.ts`: `EmployeeDepartment.isHead`
  (the multi-department source of truth) and the legacy single `Department.headId`. Both are read, and a
  head has authority over anyone whose primary *or* secondary department they head.

Self never counts: nobody supervises or approves themselves, even as a department head.

| Action | Who may do it |
|---|---|
| View / approve / reject a leave | the applicant's supervisor or department head; HR Admin / Super Admin; custom roles with `EMP_LEAVES` (view/approve); roles with `EMP_ALL_LEAVES` (`hasLeaveAuthorityOver` in `leaves.ts`) |
| See the applicant's balance while deciding | the same people (`GET /leaves/balances/employee/:id`) |
| **Approve a leave with less Loss of Pay than its balance shortfall** (a waiver) | **only** the immediate supervisor, HR Admin or Super Admin (`canWaiveLop` in `leaves.ts`). Department heads and custom roles can approve but cannot excuse the pay |
| Review claims | roles holding `EMP_ALL_CLAIMS` approve (no longer hard-coded to SA/HR) |
| Receive approval notifications | supervisor + every HR Admin + every Super Admin (see ARCHITECTURE §7) |

Employee profile access (`assertCanAccess` in `employees.ts`) combines role, department scope of custom
roles, and the reporting line; your own profile is always reachable.

---

## 4. Known traps

1. **Hard-coded role checks.** Many endpoints were written as `requireRole("SUPER_ADMIN", "HR_ADMIN")`
   before the matrix existed. Where that survives, a custom role can have a ticked checkbox that grants
   nothing (silent 403). When converting one, follow the guardrail below.
2. **Guardrail: extend matrix checks to custom roles only** (`isCustomRole`) unless the area is meant to be
   matrix-only. Built-in `DEPT_HEAD`/`EMPLOYEE` carry broad default `canView` flags (e.g. `EMP_LEAVES`) that
   are *meant* to be team-scoped by the reporting line; gating purely on the flag would widen them.
   Exceptions where the matrix is the sole control: Academics and MIS.
3. **UI gate ≠ API gate.** Hiding a sidebar link does not protect a page; the Settings page, for example, is
   intentionally self-service for everyone and was once only "protected" by the sidebar.
4. **Do not re-add a blanket HR bypass to Academics.** It used to override the matrix and made the
   checkboxes decorative for HR.
5. **Test every permission change with a custom role** that holds exactly the grant you expect, on staging.
