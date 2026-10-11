# @cadb/partner-db

Phase 2 partner data: partners, projects, partner users, grants and logs. It
lives in its own Postgres schema, `partner`, inside the CADB database. CADB's
own schema (`public`), Prisma client and migrations are never touched.

Design: [`docs/phase-2/partner-dashboard-design.html`](../../docs/phase-2/partner-dashboard-design.html)

## Logins

| Login | Can | Cannot |
|---|---|---|
| `partner_ro_<env>` | `SELECT` on the CADB academic tables listed in `sql/02-grants.sql`; Student by explicit column list | read credentials, HR, fees ledgers or anything not listed; write anything; queries over 30s |
| `partner_rw_<env>` | read/write rows in `partner.*` | touch `public.*`; create or drop tables; edit migration history |
| DB owner | run partner migrations and `02-grants.sql` | — |

`<env>` is `local`, `staging` or `prod`. Roles are cluster-wide in Postgres,
so each environment has its own pair even when databases share a server.

New CADB tables or Student columns are **not** granted automatically. Add them
to `sql/02-grants.sql` on purpose and re-run it.

## Set up an environment

Order matters: roles → migrations → grants → verify.

```sh
# 1. Logins (needs CREATEROLE: local superuser / `sudo -u postgres` on the server)
PARTNER_RO_PASSWORD=… PARTNER_RW_PASSWORD=… psql -d <db> -v env=<env> -f sql/01-roles.sql

# 2. Tables, as the DB owner. The URL MUST end in ?schema=partner —
#    the first migration refuses to run anywhere else.
PARTNER_DATABASE_URL="postgresql://<owner>@<host>:5432/<db>?schema=partner" npx prisma migrate deploy

# 3. Grants, as the DB owner. Re-run after every partner migration.
psql -d <db> -v env=<env> -v expected_db=<db> -f sql/02-grants.sql

# 4. Prove it (24 checks; exits non-zero on any failure)
PARTNER_RO_PASSWORD=… PARTNER_RW_PASSWORD=… scripts/verify-access.sh <env> <db> [host] [port]
```

Locally, `packages/partner-db/.env` (git-ignored) holds the URLs and passwords.
Local Postgres trusts localhost connections, so passwords are not exercised
there; the server checks them.

## New migrations

```sh
npx prisma migrate dev --create-only --name <name>   # review the SQL first
npx prisma migrate deploy
psql -d <db> -v env=<env> -v expected_db=<db> -f sql/02-grants.sql
```

Partner migrations only add. Each one ships with a reverse script under
`sql/` when it is not covered by `99-remove-partner.sql`.

## Remove Phase 2 entirely

Back up first, then, as a superuser on the target database:

```sh
psql -d <db> -v env=<env> -v expected_db=<db> -v confirm=REMOVE-PARTNER -f sql/99-remove-partner.sql
```

Drops the `partner` schema and both logins. CADB's tables are unchanged
(tested: identical table set before and after).

## Rules for code using this package

- Never store a foreign key into `public`. CADB ids are plain strings. A
  cross-schema FK would make Postgres block CADB's own deletes.
- Reads of CADB data use `@cadb/db` connected as `partner_ro_<env>`, and must
  always use an explicit `select` on Student. `SELECT *` is refused because
  the credential columns are not granted.
- The client generates to `generated/client`, never `@prisma/client`, so it
  cannot overwrite CADB's client.
