# Architecture

How CADB is put together, for a developer who needs to change it. For setup see the
[README](../README.md); for shipping see [DEPLOYMENT.md](DEPLOYMENT.md).

---

## 1. The big picture

```
 Browser (staff / student)
      │  HTTPS
      ▼
 nginx  cadb.centumacademy.com  (TLS, upload size limit)
      ├── /api/*      ─────────►  Fastify API  (PM2 cadb-api, :4000)  ──► PostgreSQL `cadb`
      ├── /uploads/*  ─────────►  Fastify API  (static files from apps/api/uploads/)
      └── /*          ─────────►  Next.js web  (PM2 cadb-web, :3000)
                                       │
                                       └── the browser calls the API directly at NEXT_PUBLIC_API_URL
 Fastify API ──► SMTP (notification email)      ──► Google Drive API (Resources library)
             ──► WhatsApp Cloud API (wired, not live)
```

- The **web app renders pages; all data comes from the API** via client-side fetches (TanStack Query).
  Next.js does not talk to the database.
- **One API process** serves staff, students, file downloads and runs the background jobs.
- **One PostgreSQL database** (`cadb`) holds everything. Prisma is the only access path.
- Staging is the same layout on the same host, on other ports, without nginx (see DEPLOYMENT.md).

---

## 2. API (`apps/api`)

### Startup — `src/server.ts`
1. Registers plugins: CORS (fixed origin list, `credentials: true`, exposes `Content-Disposition` for
   Excel/PDF file names), rate limit (**100 requests / minute / IP**), multipart (**5 MB, 1 file**
   default; some routes raise it per route), JWT, Swagger UI at **`/docs`**.
2. Serves `apps/api/uploads/` at `/uploads/*`.
3. Registers every route module under `/api/v1/...` (the list in `server.ts` is the API map).
4. Connects Prisma, starts listening, then starts the background jobs below.

### Route modules — `src/routes/v1/`
One file per area; the URL prefix is set at registration. Main ones:

| Prefix | File | Area |
|---|---|---|
| `/api/v1/auth` | `auth.ts` | staff login, refresh, logout, change password |
| `/api/v1/employees` | `employees.ts`, `documents.ts`, `bankDetails.ts`, `team.ts` | profiles, documents, bank, team, leave balances, payroll period |
| `/api/v1/leaves`, `/comp-off` | `leaves.ts`, `compOff.ts` | apply, approve (with LoP), cancel, balances, who-is-away |
| `/api/v1/claims`, `/claim-types` | `claims.ts`, `claimTypes.ts` | claims lifecycle, claim type config |
| `/api/v1/roles` | `roles.ts` | custom roles, permission matrix, `my-permissions` |
| `/api/v1/leave-policies`, `/holidays`, `/departments`, `/designations`, `/work-locations` | … | administration masters |
| `/api/v1/reports` | `reports.ts` | MIS reports + Excel exports (incl. salary disbursement with LoP) |
| `/api/v1/academics/*` | `academics.ts`, `students.ts`, `schedule.ts`, `assignments.ts`, `assessments.ts`, `academicReports.ts`, `academicSettings.ts` | all academic operations |
| `/api/v1/revenue` | `revenue.ts` | fee receivable / received / due / refunds |
| `/api/v1/student/*` | `student-auth.ts`, `studentPortal.ts`, `studentAnnouncements.ts` | student portal (separate login) |
| `/api/v1/notifications`, `/notification-settings` | … | in-app bell, Super Admin channel toggles |
| `/api/v1/resources` | `resources.ts` | Resources library (Google Drive) |
| `/api/v1/audit-logs` | `auditLogs.ts` | deletion / force-cancel log |

### Response shape
Every route answers `{ success: true, data, meta? }` or `{ success: false, error, statusCode }`.
List endpoints take `limit`/`offset` (or `page`) and return `meta.total`. The web client relies on
`error` for toast messages, so return a sentence a user can act on.

### Shared domain logic — `src/utils/`
Business rules are implemented once here and called from routes. Change the rule here, not in a route.

| File | Responsibility |
|---|---|
| `leave.ts` | fiscal year (Apr–Mar), monthly accrual with joining-date pro-rata, carry-forward, sandwich day count, LoP split by month, `roundDays`, in-force statuses |
| `orgHierarchy.ts` | immediate supervisor, department head, reporting-scope filters |
| `permissions.ts` | permission-matrix checks (`hasPermission`, `requirePermission`, academics helpers) |
| `notify/` | notification events, templates, outbox `enqueue()`, `dispatcher.ts` |
| `marksImport.ts`, `studentImport.ts` | Excel template generation + validated upload parsing |
| `drive.ts` | Google Drive service-account client for Resources |
| `s3.ts` | file storage (S3 when `AWS_S3_BUCKET` is set, otherwise local `uploads/`) |
| `auditLog.ts`, `probation.ts`, `recurrence.ts`, `claimNumber.ts`, `password.ts`, `phone.ts`, `name.ts` | as named |

### Background jobs (in-process timers in `server.ts`)
| Job | Interval | What it does |
|---|---|---|
| Probation check | at start, then daily | confirms employees whose 3-month probation has ended |
| Notification drain | every 30 s | delivers queued notifications (email / WhatsApp), with retry backoff |
| Resources upload cleanup | hourly | removes Drive uploads the browser never finished |

They run inside the API process, so **running two API instances would run them twice**. Keep a single
instance or move the jobs out before scaling horizontally.

---

## 3. Authentication

| | Staff | Students |
|---|---|---|
| Login | `POST /api/v1/auth/login` with **employee code** + password | `POST /api/v1/student/auth/login` |
| Tokens | access JWT 15 min + refresh JWT 7 days, both signed with `JWT_SECRET` | same, refresh carries `userType: "STUDENT"` |
| Passwords | bcrypt, 12 rounds | bcrypt |
| Browser storage | `localStorage`: `cadb_access_token`, `cadb_refresh_token`, and the Zustand store `cadb-auth` (user object) | `cadb_student_access_token`, `cadb_student_refresh_token` |

- The API client (`apps/web/src/lib/api.ts`) attaches the access token and, on a 401, refreshes once and
  retries; if refresh fails it clears storage and sends the user to login.
- The JWT payload carries `sub` (employee id), `employeeCode`, `role` and department info. Use
  `request.user.sub`, not `id`.
- `authenticate` (middleware) verifies the token; authorisation is separate — see
  [ACCESS_CONTROL.md](ACCESS_CONTROL.md).

---

## 4. Web app (`apps/web`)

- **App Router.** Staff pages under `src/app/dashboard/`, student pages under `src/app/student/`.
  Pages are client components that fetch through TanStack Query.
- **Shell:** `src/app/dashboard/layout.tsx` + `src/components/layout/Sidebar.tsx`. The sidebar groups
  links into collapsible, permission-filtered groups; below the `lg` breakpoint it is a slide-in drawer.
  Academics pages use their own layout without the main sidebar.
- **Permissions in the UI:** `hooks/usePermissions.ts` loads `/api/v1/roles/my-permissions` and
  `lib/academicsAccess.ts` decides academics visibility. UI gating is a convenience; **the API is the
  enforcement point**.
- **Caching:** default `staleTime` 5 minutes. After a mutation, invalidate every key that renders the
  changed data (e.g. `lib/assessmentCache.ts` → `invalidateAssessments`).
- **Build-time config:** `NEXT_PUBLIC_API_URL` is compiled into the JavaScript. A build made for staging
  will call the staging API even if deployed to production — the deploy runbook checks the bundle.

---

## 5. Data model (`packages/db/prisma/schema.prisma`)

88 models and 39 enums. The main groups:

| Group | Key models |
|---|---|
| Organisation | `Department`, `EmployeeDepartment` (multi-department membership, `isHead`), `Designation` (grade), `WorkLocation`, `CustomRole`, `RoleDepartmentAccess`, `RolePermission` |
| Employee | `Employee` (`reportingToId` = supervisor), `Qualification`, `Certification`, `EmployeeDocument`, `BankDetail`, salary structure / config / slips, `BonusPlan`/`BonusPayout`, `TeamMembership` |
| Leave | `LeavePolicy` → `LeavePolicyRule` (per leave type) / `LeavePolicyGrade`, `LeaveBalance` (per employee × type × fiscal year: allocated, carried, earned, used, pending), `LeaveApplication` (`totalDays`, `lopDays`, status), `CompOffRequest`, `Holiday`, `PartTimeEntry` |
| Claims | `ClaimTypeConfig`, `ReimbursementClaim`, `ClaimReceipt` |
| Engagement | `Announcement` (+ views/acks), `PolicyDocument` (+ acks), `TrainingProgram` (+ enrollments), `PersonalTodo`, `Task` |
| Students & fees | `Student`, `StudentBatch` (multi-batch), `Batch`, `Course`, `Grade`, `School`, `Centre`/`Location`, `AcademicYear`, `InstalmentPlan`/`StudentInstalment`, `StudentPaymentLog`, `StudentRefund` |
| Academics | `Schedule` (+ batches, attendance; `recurrenceId` ties a series), `Assignment` (+ submissions), `Exam` → `ExamSubject` (paper × subject slot) / `ExamBatch` / `ExamResult` (attended, excluded) → `ExamMark`; `ExamTemplate`; `PTM` |
| Feedback & notifications | `StudentFeedback`/`FeedbackMessage`, `Notification` (outbox + in-app), `NotificationSetting` |
| Resources | `ResourceCategory` → `Resource` (visibility) → `ResourceItem` tree; `ResourceDepartment` |
| Audit & sessions | `AuditLog`, `Session`, `StudentSession`, `AppSetting` |

Migrations live in `packages/db/prisma/migrations/` (82 as of v1.27.0) and are applied with
`prisma migrate deploy`. **Always copy `schema.prisma` to the server before `prisma generate`** —
a migration alone does not update the schema file the generator reads.

---

## 6. Files and storage

| What | Where it lives in production |
|---|---|
| Employee photos, documents, claim receipts, policy files | API server disk, `~/CADB/apps/api/uploads/`, served at `/uploads/<file>` (no auth check) |
| Resources library | Google Shared Drive via a service account; every read is proxied through the API, Drive is never shared with users. Large uploads go browser → Google in 8 MiB resumable chunks |
| Excel exports / templates | generated on the fly with ExcelJS, never stored |

Upload size ceilings stack: nginx `client_max_body_size` (12M in prod) → Fastify multipart default
5 MB → per-route overrides. A file that passes one and fails another produces confusing client errors;
check all three.

---

## 7. Notifications

`notify/` implements an **outbox**: a request that triggers an event (leave applied/approved/rejected,
cancellation requested, claim submitted/approved/rejected/paid, comp-off, announcements) writes
`Notification` rows; the 30-second drain job delivers them and retries with backoff (1/5/15/60/360 min,
5 attempts). Approval events go to the applicant's **immediate supervisor** (`reportingToId`), **every
HR Admin** and **every Super Admin** (`notify/recipients.ts`); decisions go back to the applicant. Department
heads and `Department.hrPartnerId` are deliberately *not* recipients any more (narrowed in v1.18.1), and a
reporting manager can mute team leave/claim emails in Settings. Super Admin can switch each event × channel
off in Administration → Notifications (a missing setting row means *on*). The bell in the header reads
the in-app rows. Email requires SMTP settings; WhatsApp code exists but needs a WhatsApp Business account.
