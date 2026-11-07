# CADB — Centum Academy Dashboard

CADB is the internal operations platform for **Centum Academy**: HR and payroll inputs for staff
(~500 employees), academic operations for students (~10,000 students), and a separate portal for
students themselves. It runs in production at **https://cadb.centumacademy.com**.

This README is the entry point for a developer taking over the codebase. Read it top to bottom once;
then use the documents in [`docs/`](docs/) as reference.

| Document | Read it when you need to… |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | understand how the pieces fit: request flow, auth, background jobs, storage |
| [docs/ACCESS_CONTROL.md](docs/ACCESS_CONTROL.md) | change who can see or do something (roles, permission matrix, reporting line) |
| [docs/BUSINESS_RULES.md](docs/BUSINESS_RULES.md) | touch leave, LoP, claims, fees, assessments — the rules the code enforces |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | ship anything: environments, staging → production runbook, backups, rollback |
| [CHANGELOG.md](CHANGELOG.md) | see what shipped in each release |

---

## 1. What the system does

**Staff side** (`/dashboard/*`, login with employee code + password)

| Area | What it covers |
|---|---|
| Employees | Profiles, documents, bank details, salary structure, position, team; org-wide leave and claim record browsers |
| Leaves & Holidays | Apply / approve / cancel leave, balances with monthly accrual, comp-off, Loss of Pay (LoP), holiday calendar, who-is-away view |
| Claims | Reimbursement claims with receipts, approval, payment, cancellation |
| Notice Board, To-Do, Team | Announcements with acknowledgement, personal to-dos, team view |
| Policies, Training, Resources | Policy documents with acknowledgement, training programmes, a file/video library on a Google Shared Drive |
| Administration | Departments, designations, work locations, leave policies, claim types, roles and permissions |
| Academics | Students, admissions, batches, subjects, class schedule (incl. recurring), attendance, assignments, assessments (exams) with marks import, reports |
| Student Feedback | Threaded student ↔ admin feedback |
| Revenue, MIS Reports | Fee receivable / received / due / refunds; Excel exports (salary disbursement with LoP, leave records, claims, directory) |
| Deletion Log | Audit trail of force-cancellations and deletions |
| Notifications | In-app bell + email (SMTP) for leave/claim/comp-off/announcement events; WhatsApp wired but not live |

**Student side** (`/student/*`, separate login): home, schedule, attendance, assignments, assessments,
notices, feedback, admission/fee details, profile.

---

## 2. Tech stack

| Layer | Technology |
|---|---|
| Monorepo | pnpm workspaces + Turborepo (`pnpm@10`), TypeScript 5.7 everywhere |
| Web | Next.js 15 (App Router), React 19, Tailwind CSS 3, TanStack Query 5, Zustand 5, lucide-react, sonner |
| API | Fastify 5, Zod, `@fastify/jwt`, `@fastify/multipart`, `@fastify/rate-limit`, Swagger at `/docs`, ExcelJS, Nodemailer |
| Database | PostgreSQL 16 via Prisma 6 (`packages/db`) |
| Files | API server's local disk (`apps/api/uploads/`) in staging and production; S3 code path exists but is not used in prod; Google Drive (service account) for the Resources library |
| Hosting | One AWS EC2 Ubuntu box running both production and staging under PM2, nginx + Let's Encrypt in front of production |

Node 22+ is expected (development has been on Node 24).

---

## 3. Repository layout

```
apps/
  api/            Fastify REST API (@cadb/api)
    src/server.ts       plugin + route registration, background jobs
    src/routes/v1/      one file per area (leaves.ts, claims.ts, assessments.ts, …)
    src/utils/          shared domain logic (leave maths, permissions, org hierarchy, notify/, drive, marks import…)
    src/middleware/     authenticate.ts (JWT check)
    scripts/            one-off operational scripts (check-smtp.ts)
  web/            Next.js app (@cadb/web)
    src/app/dashboard/  staff pages        src/app/student/  student portal pages
    src/components/     layout (Sidebar, header, bell), leaves/, resources/, …
    src/hooks/, src/lib/, src/store/  permissions hook, API client, auth store
packages/
  db/             Prisma schema, migrations, generated client (@cadb/db)
  types/          shared TypeScript types — JWT payload, roles, API envelope (@cadb/types)
scripts/deploy-staging.sh   build locally, rsync to staging, restart (the canonical copy)
docs/                       this documentation
figma designs/              original UI design exports (reference only)
```

> `apps/partner-*` and `packages/partner-db` are **not on `main`**. They belong to the Phase 2 white-label
> partner dashboard, developed on the `phase-2` branch (see §10).

---

## 4. Getting started locally

### Prerequisites
- Node 22+ and pnpm 10 (`corepack enable`)
- PostgreSQL 16 running locally
- No Redis needed (a `REDIS_URL` appears in old env files but nothing reads it)

### Setup

```bash
pnpm install

# 1. Environment — copy the examples and fill in values (see §5)
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

# 2. Database
createdb cadb
pnpm --filter @cadb/db exec prisma migrate deploy     # apply all migrations
pnpm --filter @cadb/db exec prisma generate

# 3. Run (two terminals)
pnpm --filter @cadb/api dev                            # API on http://localhost:4000  (Swagger: /docs)
pnpm --filter @cadb/web exec next dev --port 3000      # Web on http://localhost:3000
```

**There is no seed script.** A fresh database has no users, so you cannot log in. Either restore a
sanitised copy of the staging database (ask the project owner), or insert a `SUPER_ADMIN` employee
with a bcrypt (12 rounds) `passwordHash` via `prisma studio` / a short script run from `packages/db`.
Login uses the **employee code**, not the email.

**Local upload gotcha:** if `AWS_S3_BUCKET` is set and you have no AWS credentials, every upload fails
with a bare "Internal server error". Leave it empty locally and files go to `apps/api/uploads/`.

### Everyday commands

| Command | What it does |
|---|---|
| `pnpm --filter @cadb/api typecheck` / `pnpm --filter @cadb/web typecheck` | Type-check one app (do this before every commit — there are no tests, see §9) |
| `pnpm --filter @cadb/db exec prisma migrate dev --name <name>` | Create a migration after editing `schema.prisma` |
| `pnpm db:studio` | Browse the local database |
| `pnpm --filter @cadb/api check-smtp <address>` (run from `apps/api`) | Send a test email with the configured SMTP |

---

## 5. Configuration

API settings come from `apps/api/.env` (development) or the PM2 environment (servers). Web settings are
**baked into the bundle at build time** — `NEXT_PUBLIC_API_URL` must be set correctly *when you build*,
not when you run. Full list with explanations: [`apps/api/.env.example`](apps/api/.env.example) and
[`apps/web/.env.example`](apps/web/.env.example).

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `JWT_SECRET` | yes | Signs access (15 min) and refresh (7 day) tokens |
| `API_PORT` | no | Default 4000 |
| `NEXT_PUBLIC_APP_URL` | no | Web origin, used for CORS and links in emails |
| `SMTP_HOST/PORT/SECURE/USER/PASS/FROM` | for email | Outgoing notification email; without them email is skipped |
| `GOOGLE_DRIVE_SHARED_DRIVE_ID` + `GOOGLE_DRIVE_KEY_FILE` (or `_KEY_JSON`) | for Resources | Service-account access to the academy Shared Drive |
| `RESOURCE_MAX_UPLOAD_MB` | no | Resources upload ceiling |
| `GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI` | optional | Google Calendar connection |
| `WHATSAPP_*`, `DEFAULT_COUNTRY_CODE` | optional | WhatsApp Cloud API notices (not live: needs a WhatsApp Business account) |
| `AWS_REGION`, `AWS_S3_BUCKET` | optional | If the bucket is set, uploads go to S3 instead of local disk |
| `NEXT_PUBLIC_API_URL` (web) | yes | API base URL compiled into the web bundle |

**Secrets are never committed.** `.env*`, `ecosystem.staging.config.cjs`, and the Google service-account
key (`cadb-resources-*.json`) are git-ignored. Where each production secret lives is listed in
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md#secrets); the values themselves are handed over separately.

---

## 6. How the code is organised (conventions)

- **One route file per area** under `apps/api/src/routes/v1/`, registered with its URL prefix in
  `server.ts`. Routes validate input with Zod and answer `{ success, data | error, statusCode }`.
- **Domain rules live in `apps/api/src/utils/`**, not in routes, so every endpoint uses the same maths:
  `leave.ts` (fiscal year, accrual, sandwich day count, LoP per month, `roundDays`), `orgHierarchy.ts`
  (supervisor / department head), `permissions.ts` (`hasPermission`), `notify/` (outbox + templates),
  `marksImport.ts`, `studentImport.ts`, `drive.ts`.
- **Comments explain *why*.** The codebase leans on comments that record the decision and the bug it
  prevents. Keep that habit; many rules here were chosen by the business and are not obvious from the code.
- **Web data fetching** uses TanStack Query with a 5-minute `staleTime`. After any mutation, invalidate
  *every* query key that shows the changed data (singular and plural keys differ across pages). Stale
  caches have repeatedly made saved edits look unsaved.
- **File downloads** go through `api.get(..., { responseType: "blob" })` + a download helper — never a bare
  `<a href>` to the API, which drops the auth header.
- **Forms:** every validated field shows its error message; a silent Zod failure looks like "Save does
  nothing". Native `<select>` uses `appearance-none` + a drawn chevron so it matches the inputs.
- **Mobile:** every UI change must work at phone width (the dashboard shell is a drawer below `lg`).
- **React hooks:** in role-gated pages, do the role check *after* all hooks. An early `return` above a hook
  crashes the page (React error #310) while the login is still loading.
- **Database:** migrations are additive wherever possible (new nullable / defaulted columns, new tables).
  Production data changes need a backup first — see the runbook.

---

## 7. Environments at a glance

| | Production | Staging |
|---|---|---|
| URL | https://cadb.centumacademy.com | http://65.0.41.55:3002 (web), :4001 (API) — no TLS |
| Server dir | `~/CADB` | `~/CADB-staging` |
| PM2 processes | `cadb-api` (:4000), `cadb-web` (:3000) | `cadb-staging-api` (:4001), `cadb-staging-web` (:3002) |
| Database | `cadb` | `cadb_staging` (test data) |
| Git | `main` = what is in production | built from the working tree being tested |

Both run on the **same EC2 host**. The box runs out of memory on TypeScript/Next builds, so **always
build on your own machine and rsync the output** (`apps/api/dist`, `apps/web/.next`). Step-by-step in
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

---

## 8. Branches and releases

- **`main`** — always equals production. Every production release is a commit on `main` plus an annotated
  tag `vX.Y.Z` (semantic: minor = feature, patch = fix). See [CHANGELOG.md](CHANGELOG.md).
- **`staging`** — historical integration branch; production releases since v1.24 are cut from `main`.
- **`phase-2`** — Phase 2 partner dashboard work (merged forward from `main` after each release).
- Work flow: change → type-check → deploy to **staging** → verify → commit on `main` → tag → production
  runbook → merge `main` into `phase-2`.
- Commit messages follow Conventional Commits (`feat(scope): …`, `fix(scope): …`) with a body that says
  what was wrong and why the fix is shaped the way it is.

---

## 9. Known gaps and technical debt (read before you change things)

| Item | Risk | Notes |
|---|---|---|
| **No automated tests, no CI** | High | `.github/workflows` is empty. Verification is type-check + manual/scripted checks on staging. Adding API tests around `utils/leave.ts`, `marksImport.ts` and permissions would pay off first. |
| **Uploaded files are not backed up** | High | The weekly backup covers the database only. Photos, documents and receipts in `apps/api/uploads/` exist only on the server's disk. |
| **`/uploads/*` is unauthenticated** | Medium | Files are served by URL; the random filename is the only protection. |
| **Backups are on the same machine** | Medium | Off-site copy to S3 was planned (bucket exists) but not finished. |
| Hard-coded role checks | Medium | Some endpoints still check role names (`SUPER_ADMIN`, `HR_ADMIN`) instead of the permission matrix, so a custom role can see a ticked box that grants nothing. See [ACCESS_CONTROL](docs/ACCESS_CONTROL.md#4-known-traps). |
| nginx config not in Git | Medium | Lives only on the server (`/etc/nginx/sites-enabled/cadb`). Upload size limits there have caused silent failures twice. |
| CORS origins hard-coded | Low | `server.ts` lists production, the staging IP and localhost ports. |
| Two copies of `deploy-staging.sh` | Low | `scripts/deploy-staging.sh` is current; the root copy is older. |
| Unused env keys | Low | `REDIS_URL`, `JWT_REFRESH_SECRET` are present in env files but unused (refresh tokens use `JWT_SECRET`). |
| `figma designs/` in the repo | Low | 244 design-export files, reference only. |

---

## 10. Phase 2 — partner dashboard (branch `phase-2`)

A white-label dashboard for a school partner (VIBGYOR) built over CADB data: separate services
(`apps/partner-api`, `apps/partner-admin`) and a locked-down `partner` Postgres schema with its own
database logins (`packages/partner-db`). It must carry **no Centum branding**. Milestones done: schema
and logins (M1), partner-admin console on staging (M2). Design draft: `docs/phase-2/` on that branch;
database notes: `packages/partner-db/README.md` on that branch. Nothing from Phase 2 is in production.

---

## 11. Ownership

Product owner and maintainer: **Tushar Sinha**. Server access (SSH key), production secrets, GitHub
access and the Google service-account key are handed over separately, never through this repository.
