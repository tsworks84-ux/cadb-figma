# Deployment and operations runbook

How to ship CADB safely, back it up, and roll it back. Production is used every day by the academy's staff
and students, so the procedure is deliberately conservative: **staging first, backup before production,
verify after.**

---

## 1. Infrastructure

| Item | Value |
|---|---|
| Host | One AWS EC2 Ubuntu instance (`65.0.41.55`, user `ubuntu`) running **both** production and staging |
| Access | SSH key (handed over separately; not in the repo). Port 22 is opened in the security group for admin work — close it again afterwards |
| Process manager | PM2 |
| Reverse proxy | nginx with Let's Encrypt (certbot), production only |
| Database | PostgreSQL 16 on the same host; databases `cadb` (production) and `cadb_staging` |

| | Production | Staging |
|---|---|---|
| Public URL | https://cadb.centumacademy.com | http://65.0.41.55:3002 (web), http://65.0.41.55:4001 (API) |
| Code directory | `~/CADB` | `~/CADB-staging` |
| PM2 | `cadb-api` (port 4000, cwd `~/CADB/apps/api`), `cadb-web` (port 3000, cwd `~/CADB/apps/web`) | `cadb-staging-api` (4001), `cadb-staging-web` (3002), started from `ecosystem.staging.config.cjs` |
| API config | `~/CADB/apps/api/.env` | PM2 env in `~/CADB-staging/ecosystem.staging.config.cjs` (overrides the `.env` file) |
| Web build URL | `NEXT_PUBLIC_API_URL=https://cadb.centumacademy.com` | `NEXT_PUBLIC_API_URL=http://65.0.41.55:4001` |
| Uploaded files | `~/CADB/apps/api/uploads/` | `~/CADB-staging/apps/api/uploads/` |

Also on the host (Phase 2, staging only): `partner-staging-api`, `partner-staging-admin` PM2 processes.

### nginx (production)
- Config: `/etc/nginx/sites-enabled/cadb` — a real file (not a symlink); **not in Git**. Back it up to
  `/etc/nginx/backups/` before editing (never into `sites-enabled/`, which nginx would load as a second site).
- Routes: `/api/` → :4000, `/uploads/` → :4000, everything else → :3000.
- `client_max_body_size 12M`. Any larger upload limit in the API must be matched here, or uploads fail with a
  confusing browser error instead of a clear 413.
- Apply changes with `sudo nginx -t && sudo systemctl reload nginx`.

### Secrets
Values are handed over separately. Locations:

| Secret | Where |
|---|---|
| Production DB credentials, `JWT_SECRET`, SMTP, AWS keys | `~/CADB/apps/api/.env` (note: values are wrapped in double quotes) |
| Staging DB + JWT secret | `~/CADB-staging/ecosystem.staging.config.cjs` |
| Google Drive service-account key (Resources) | `~/cadb-secrets/` on the host; locally `cadb-resources-*.json` in the repo root (git-ignored) |
| SSH key to the host | with the project owner |
| GitHub repository | `git@github.com:tsworks84-ux/cadb-figma.git` (SSH) |

---

## 2. Golden rules

1. **Never build on the server.** The instance runs out of memory on `tsc` / `next build`. Build on your
   machine and rsync the output.
2. **Staging before production**, and verify the change there.
3. **Production gets a fresh database backup and a rollback snapshot before every release.**
4. **Migrations must be additive** (new tables; new nullable or defaulted columns). Anything destructive
   needs its own plan, a backup, and sign-off.
5. **Check the web bundle's baked API URL** before uploading it. A staging build in production calls the
   staging API.
6. **Run production commands one at a time**, not as long `&&` chains, so a failure halfway is obvious.
7. **Copy `schema.prisma` to the server before `prisma generate`.** A migration alone does not update the
   schema file the generator reads.

---

## 3. Deploy to staging

The script does the standard case (build locally, rsync, restart):

```bash
./scripts/deploy-staging.sh            # API + web
./scripts/deploy-staging.sh --api-only
./scripts/deploy-staging.sh --web-only
```

(`scripts/deploy-staging.sh` is current; the copy in the repo root is older.) Manual equivalent:

```bash
# API
npx tsc --noEmit false -p apps/api/tsconfig.json
rsync -az -e "ssh -i <key>" apps/api/dist/ ubuntu@65.0.41.55:~/CADB-staging/apps/api/dist/
ssh -i <key> ubuntu@65.0.41.55 "pm2 restart cadb-staging-api"

# Web — the API URL is compiled in
NEXT_PUBLIC_API_URL=http://65.0.41.55:4001 pnpm --filter=@cadb/web build
rsync -az --delete -e "ssh -i <key>" apps/web/.next/ ubuntu@65.0.41.55:~/CADB-staging/apps/web/.next/
ssh -i <key> ubuntu@65.0.41.55 "pm2 restart cadb-staging-web"
```

Staging migrations: rsync `packages/db/prisma/` to `~/CADB-staging/packages/db/prisma/`, then on the server
run `prisma migrate deploy` and `prisma generate` with `DATABASE_URL` pointing at `cadb_staging`.

**Testing on staging without a password:** short-lived tokens can be signed with the staging JWT secret on
the server (payload `{ sub, employeeCode, role, type: "access" }`). One-off scripts on the box must take
`DATABASE_URL` from the ecosystem file and must live inside a workspace package (e.g. `packages/db`) so that
`@prisma/client` resolves. Delete them afterwards.

---

## 4. Release to production

Releases are cut from **`main`**, which must equal production.

### 4.1 Prepare (local)
```bash
git checkout main
# commit the change, then
git tag -a vX.Y.Z -m "vX.Y.Z: <summary>"

npx tsc --noEmit false -p apps/api/tsconfig.json
NEXT_PUBLIC_API_URL=https://cadb.centumacademy.com pnpm --filter=@cadb/web build

# bundle check: expect many production URLs and ZERO staging URLs
grep -rl 'cadb.centumacademy.com' apps/web/.next/static/chunks | wc -l
grep -rl '65.0.41.55' apps/web/.next/static | wc -l      # must be 0
```

### 4.2 Safety net (server)
```bash
ssh … "bash ~/backups/backup-cadb.sh"                      # fresh pg_dump → ~/backups/cadb/
# verify: newest file passes `gzip -t` and has the expected number of CREATE TABLE statements
ssh … "cd ~/CADB/apps && tar czf ~/prod-rollback/api_dist_<date>_<ver>.tar.gz api/dist"
ssh … "cd ~/CADB/apps && tar czf ~/prod-rollback/web_next_<date>_<ver>.tar.gz --exclude=web/.next/cache web/.next"
ssh … "cat ~/CADB/apps/web/.next/BUILD_ID"                 # note the build you are replacing
```
(With `tar`, `--exclude` must come before the path.)

### 4.3 Database migration (only if the release has one)
1. Compare pending migrations: `prisma migrate status` against `cadb`.
2. rsync `packages/db/prisma/` to `~/CADB/packages/db/prisma/` (**schema first**).
3. On the server: `prisma migrate deploy`, then `prisma generate`, with `DATABASE_URL` for `cadb`.
4. Spot-check row counts of key tables before and after.

### 4.4 Ship code
```bash
rsync -az -e "ssh -i <key>" apps/api/dist/ ubuntu@65.0.41.55:~/CADB/apps/api/dist/
rsync -az --delete -e "ssh -i <key>" apps/web/.next/ ubuntu@65.0.41.55:~/CADB/apps/web/.next/
# compare file counts locally vs remote (api/dist, web/.next excluding cache) — must match
ssh … "pm2 restart cadb-api cadb-web"
```
rsync of `dist`/`.next` does not touch the server's `.env` files.

### 4.5 Verify
- `https://cadb.centumacademy.com/` and a changed page → 200.
- `POST /api/v1/auth/login` with `{"employeeCode":"ZZ9999","password":"wrongpass1"}` → **401
  "Invalid credentials"** (proves API + database). Sending `email` instead gives 400 — that is the test's
  mistake, not an outage.
- A new API route without a token → 401 (exists) vs. an unknown route → 404.
- `pm2 jlist` shows both processes online; `~/.pm2/logs/cadb-api-out.log` has no `statusCode: 5xx`.
- Then: push `main` and the tag, merge `main` into `phase-2`, add the release to `CHANGELOG.md`.

---

## 5. Rollback

Code (minutes):
```bash
ssh … "cd ~/CADB/apps && rm -rf api/dist && tar xzf ~/prod-rollback/api_dist_<date>_<ver>.tar.gz"
ssh … "cd ~/CADB/apps && rm -rf web/.next && tar xzf ~/prod-rollback/web_next_<date>_<ver>.tar.gz"
ssh … "pm2 restart cadb-api cadb-web"
```
Database (only if a migration or data change went wrong — this loses writes made since the backup):
restore the matching `~/backups/cadb/*.sql.gz` into `cadb` with `psql`, after stopping `cadb-api`.

---

## 6. Backups

| What | How | Gap |
|---|---|---|
| Production database | `~/backups/backup-cadb.sh` (pg_dump → gzip, atomic write, keeps the newest **8**, logs to `~/backups/backup.log`), cron **Sunday 02:30 UTC**, plus a manual run before every release | Stored on the same disk. Off-site S3 copy was planned (bucket exists) but not finished |
| Staging database | ad-hoc dumps in `~/backups/cadb-staging/` | — |
| Uploaded files (`apps/api/uploads/`) | **none** | Photos, documents and receipts exist only on the server disk |
| Code | GitHub + `~/prod-rollback/` snapshots | — |

Closing the two gaps (off-site database copies, file backups or a move to S3) is the most valuable
operational work outstanding.

---

## 7. Troubleshooting notes

| Symptom | Likely cause |
|---|---|
| Upload fails with "The string did not match the expected pattern" or a generic error | nginx body limit returned an HTML 413; check `client_max_body_size` |
| Upload fails locally with "Internal server error" | `AWS_S3_BUCKET` set without AWS credentials — unset it locally |
| Saved change "doesn't show" | stale TanStack Query cache; invalidate every key that renders the data |
| Page shows "Application error" (React #310) | a hook placed after an early `return` in a role-gated page |
| Custom role sees a feature but gets 403 | endpoint still uses a hard-coded `requireRole`; see ACCESS_CONTROL |
| Emails not arriving | SMTP vars unset (sending is skipped silently), or the Super Admin turned that event off; check `Notification` rows (`status`, `lastError`) |
| API 500s after a schema change | `prisma generate` ran against an old `schema.prisma` on the server |
| Local API tests send real email | `apps/api/.env` may hold live SMTP — blank it for local testing |
