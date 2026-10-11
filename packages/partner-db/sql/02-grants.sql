-- Grant the partner logins exactly what they need in ONE database.
--
-- Run as the database owner (locally your user; on the server cadbuser),
-- after `prisma migrate deploy` has created the partner tables. Idempotent —
-- re-run after every partner migration and whenever this file changes.
--
--   psql -d <db> -v env=local -v expected_db=<db> -f sql/02-grants.sql
--
-- partner_ro_<env>: SELECT on the CADB academic tables listed below, nothing
--                   else. New CADB tables or columns are NOT granted
--                   automatically; add them here deliberately.
-- partner_rw_<env>: read/write rows in the partner schema, nothing in CADB.

\set ON_ERROR_STOP on

SELECT current_database() = :'expected_db' AS db_ok \gset
\if :db_ok
\else
  DO $$ BEGIN RAISE EXCEPTION 'connected to the wrong database (expected_db does not match)'; END $$;
\endif

SELECT :'env' IN ('local', 'staging', 'prod') AS env_ok \gset
\if :env_ok
\else
  DO $$ BEGIN RAISE EXCEPTION 'env must be local, staging or prod'; END $$;
\endif

\set ro_role partner_ro_ :env
\set rw_role partner_rw_ :env

BEGIN;

GRANT CONNECT ON DATABASE :"expected_db" TO :"ro_role", :"rw_role";

-- ── CADB data, read-only ────────────────────────────────────────────────────
GRANT USAGE ON SCHEMA public TO :"ro_role";

GRANT SELECT ON
  public."School",
  public."Grade",
  public."AcademicYear",
  public."TargetExam",
  public."Course",
  public."Location",
  public."Centre",
  public."Subject",
  public."Batch",
  public."BatchSubject",
  public."StudentBatch",
  public."Exam",
  public."ExamSubject",
  public."ExamBatch",
  public."ExamResult",
  public."ExamMark",
  public."Schedule",
  public."ScheduleBatch",
  public."ScheduleAttendance",
  public."Assignment",
  public."AssignmentBatch",
  public."AssignmentSubmission"
TO :"ro_role";

-- Student: explicit column list. Login credentials (passwordHash,
-- initialPasswordHash, mustChangePassword) are deliberately absent. Which of
-- these a partner user actually sees is decided by their data groups.
GRANT SELECT (
  "id", "studentCode", "firstName", "middleName", "lastName", "rollNumber",
  "admissionNumber", "admissionDate", "academicYear", "status", "isArchived",
  "schoolId", "gradeId", "courseId", "createdAt", "updatedAt",
  -- PERSONAL
  "gender", "dateOfBirth", "photoUrl", "nationality",
  -- PARENT_CONTACT
  "email", "phone", "address",
  "parentName", "parentPhone", "parentEmail", "parentRelation", "parentOccupation", "parentAddress",
  "motherName", "motherPhone", "motherEmail", "motherOccupation",
  "communicationContact", "communicationContactName", "communicationContactPhone",
  -- FEES
  "totalFee", "paidFee", "discountAmount", "discountType", "refundAmount",
  "paymentMode", "paymentDate", "paymentNote", "receiptNumber"
) ON public."Student" TO :"ro_role";

-- ── Partner schema, read/write rows only ────────────────────────────────────
REVOKE ALL ON SCHEMA partner FROM PUBLIC;
GRANT USAGE ON SCHEMA partner TO :"rw_role";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA partner TO :"rw_role";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA partner TO :"rw_role";
-- Migration history is the migrator's business.
REVOKE INSERT, UPDATE, DELETE ON partner."_prisma_migrations" FROM :"rw_role";

-- Tables created by future partner migrations (run as this same owner).
ALTER DEFAULT PRIVILEGES IN SCHEMA partner GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO :"rw_role";
ALTER DEFAULT PRIVILEGES IN SCHEMA partner GRANT USAGE, SELECT ON SEQUENCES TO :"rw_role";

COMMIT;

\echo Grants applied in :expected_db for :ro_role and :rw_role
