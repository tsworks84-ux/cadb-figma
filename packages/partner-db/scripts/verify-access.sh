#!/usr/bin/env bash
# Prove the partner logins can do exactly what they should, and nothing more.
# Every check that writes runs inside a transaction that is rolled back.
#
#   PARTNER_RO_PASSWORD=… PARTNER_RW_PASSWORD=… \
#   scripts/verify-access.sh <env> <database> [host] [port]
#
# Exits non-zero if any check fails.

set -uo pipefail

ENV_NAME="${1:?env (local|staging|prod)}"
DB="${2:?database name}"
HOST="${3:-localhost}"
PORT="${4:-5432}"
RO="partner_ro_${ENV_NAME}"
RW="partner_rw_${ENV_NAME}"
: "${PARTNER_RO_PASSWORD:?}" "${PARTNER_RW_PASSWORD:?}"

pass=0; fail=0

run() { # run <role> <password> <sql>
  PGPASSWORD="$2" PGOPTIONS="-c client_min_messages=warning" \
    psql -X -q -h "$HOST" -p "$PORT" -U "$1" -d "$DB" -v ON_ERROR_STOP=1 -Atc "$3" 2>&1
}

check() { # check <allow|deny> <role> <password> <label> <sql>
  local want="$1" out rc
  out="$(run "$2" "$3" "$5")"; rc=$?
  # A deny only counts when Postgres refused on privileges — a failed
  # connection or a typo in the SQL must not pass as "denied".
  if { [ "$want" = allow ] && [ $rc -eq 0 ]; } \
     || { [ "$want" = deny ] && [ $rc -ne 0 ] && grep -qiE 'permission denied|read-only transaction|must be owner' <<<"$out"; }; then
    pass=$((pass + 1)); printf '  PASS  %-5s %s\n' "$want" "$4"
  else
    fail=$((fail + 1)); printf '  FAIL  %-5s %s\n        → %s\n' "$want" "$4" "$(echo "$out" | head -2 | tr '\n' ' ')"
  fi
}

echo "Read-only login ($RO) on $DB"
R=("$RO" "$PARTNER_RO_PASSWORD")
check allow "${R[@]}" "count students"                      'SELECT count(*) FROM public."Student"'
check allow "${R[@]}" "read student names and school"       'SELECT "firstName", "lastName", "schoolId" FROM public."Student" LIMIT 1'
check allow "${R[@]}" "read exam marks"                     'SELECT count(*) FROM public."ExamMark"'
check allow "${R[@]}" "read attendance"                     'SELECT count(*) FROM public."ScheduleAttendance"'
check deny  "${R[@]}" "read student password hash"          'SELECT "passwordHash" FROM public."Student" LIMIT 1'
check deny  "${R[@]}" "read student initial password hash"  'SELECT "initialPasswordHash" FROM public."Student" LIMIT 1'
check deny  "${R[@]}" "SELECT * from Student"               'SELECT * FROM public."Student" LIMIT 1'
check deny  "${R[@]}" "read Employee (HR data)"             'SELECT count(*) FROM public."Employee"'
check deny  "${R[@]}" "read salary slips"                   'SELECT count(*) FROM public."SalarySlip"'
check deny  "${R[@]}" "read student instalments"            'SELECT count(*) FROM public."StudentInstalment"'
check deny  "${R[@]}" "update a school (default read-only)" 'UPDATE public."School" SET name = name WHERE false'
check deny  "${R[@]}" "update a school (forcing read-write)" 'BEGIN; SET TRANSACTION READ WRITE; UPDATE public."School" SET name = name WHERE false; ROLLBACK'
check deny  "${R[@]}" "delete a student"                    'BEGIN; SET TRANSACTION READ WRITE; DELETE FROM public."Student" WHERE false; ROLLBACK'
check deny  "${R[@]}" "create a table in CADB"              'BEGIN; SET TRANSACTION READ WRITE; CREATE TABLE public.partner_probe (x int); ROLLBACK'
check deny  "${R[@]}" "read partner tables"                 'SELECT count(*) FROM partner."Board"'
check allow "${R[@]}" "statement timeout is 30s"            "DO \$\$ BEGIN IF current_setting('statement_timeout') <> '30s' THEN RAISE EXCEPTION 'timeout is %', current_setting('statement_timeout'); END IF; END \$\$"

echo "Read-write login ($RW) on $DB"
W=("$RW" "$PARTNER_RW_PASSWORD")
check allow "${W[@]}" "read boards"                         'SELECT count(*) FROM partner."Board"'
check allow "${W[@]}" "insert a partner row (rolled back)"  "BEGIN; INSERT INTO partner.\"Board\" (id, code, name, \"updatedAt\") VALUES ('verify-probe', 'VERIFY-PROBE', 'probe', now()); ROLLBACK"
check deny  "${W[@]}" "read CADB students"                  'SELECT count(*) FROM public."Student"'
check deny  "${W[@]}" "update CADB students"                'BEGIN; UPDATE public."Student" SET "firstName" = "firstName" WHERE false; ROLLBACK'
check deny  "${W[@]}" "create a table in CADB"              'BEGIN; CREATE TABLE public.partner_probe (x int); ROLLBACK'
check deny  "${W[@]}" "create a table in partner schema"    'BEGIN; CREATE TABLE partner.partner_probe (x int); ROLLBACK'
check deny  "${W[@]}" "drop a partner table"                'BEGIN; DROP TABLE partner."Board"; ROLLBACK'
check deny  "${W[@]}" "edit migration history"              'BEGIN; DELETE FROM partner."_prisma_migrations" WHERE false; ROLLBACK'

echo
echo "$pass passed, $fail failed"
[ "$fail" -eq 0 ]
