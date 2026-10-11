-- REVERSE SCRIPT: remove Phase 2's database footprint from ONE database.
--
-- Drops the partner schema (every partner table and its data) and the two
-- partner logins. CADB's own tables in "public" are not touched; the only
-- thing removed there is the partner logins' SELECT grants.
--
-- Take a backup first. Run as a superuser connected to the target database:
--
--   psql -d <db> -v env=local -v expected_db=<db> -v confirm=REMOVE-PARTNER -f sql/99-remove-partner.sql

\set ON_ERROR_STOP on

SELECT current_database() = :'expected_db' AND :'confirm' = 'REMOVE-PARTNER' AS ok \gset
\if :ok
\else
  DO $$ BEGIN RAISE EXCEPTION 'refusing: expected_db must match and confirm must be REMOVE-PARTNER'; END $$;
\endif

\set ro_role partner_ro_ :env
\set rw_role partner_rw_ :env

DROP SCHEMA IF EXISTS partner CASCADE;

-- Revokes the roles' grants in this database, then drops the roles. If a role
-- still holds grants in another database, DROP ROLE fails and says which.
SELECT format('DROP OWNED BY %I', r) FROM unnest(ARRAY[:'ro_role', :'rw_role']) AS r
 WHERE EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) \gexec
DROP ROLE IF EXISTS :"ro_role";
DROP ROLE IF EXISTS :"rw_role";

\echo Partner schema and logins removed from :expected_db
