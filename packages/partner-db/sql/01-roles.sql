-- Create or update the two partner database logins. Roles are cluster-wide in
-- Postgres, so each environment gets its own pair: partner_ro_<env> and
-- partner_rw_<env>.
--
-- Run as a role with CREATEROLE (locally your superuser; on the server
-- `sudo -u postgres psql`). Idempotent — safe to re-run, and re-running resets
-- the passwords to whatever the environment variables hold.
--
--   PARTNER_RO_PASSWORD=… PARTNER_RW_PASSWORD=… \
--   psql -d <db> -v env=local -f sql/01-roles.sql
--
-- Passwords come from the environment (\getenv), never the command line.

\set ON_ERROR_STOP on

SELECT :'env' IN ('local', 'staging', 'prod') AS env_ok \gset
\if :env_ok
\else
  DO $$ BEGIN RAISE EXCEPTION 'env must be local, staging or prod'; END $$;
\endif

\set ro_role partner_ro_ :env
\set rw_role partner_rw_ :env
\getenv ro_password PARTNER_RO_PASSWORD
\getenv rw_password PARTNER_RW_PASSWORD

SELECT length(coalesce(:'ro_password', '')) >= 24 AND length(coalesce(:'rw_password', '')) >= 24 AS pw_ok \gset
\if :pw_ok
\else
  DO $$ BEGIN RAISE EXCEPTION 'PARTNER_RO_PASSWORD and PARTNER_RW_PASSWORD must be set (24+ characters)'; END $$;
\endif

SELECT format('CREATE ROLE %I LOGIN', r) FROM unnest(ARRAY[:'ro_role', :'rw_role']) AS r
 WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) \gexec

-- No inherited privileges, no admin powers, a small connection budget.
SELECT format('ALTER ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 10 PASSWORD %L', :'ro_role', :'ro_password') \gexec
SELECT format('ALTER ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 10 PASSWORD %L', :'rw_role', :'rw_password') \gexec

-- The read-only login opens every transaction read-only, and no partner query
-- may run long enough to slow down the live CADB database.
ALTER ROLE :"ro_role" SET default_transaction_read_only = on;
ALTER ROLE :"ro_role" SET statement_timeout = '30s';
ALTER ROLE :"ro_role" SET idle_in_transaction_session_timeout = '60s';
ALTER ROLE :"rw_role" SET statement_timeout = '30s';
ALTER ROLE :"rw_role" SET idle_in_transaction_session_timeout = '60s';

\echo Roles ready: :ro_role :rw_role
