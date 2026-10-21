-- ============================================================================
-- WIPE EVERYTHING (data + login accounts). IRREVERSIBLE.
-- Run in Supabase -> SQL Editor. After this, the first person to register
-- creates the first organization (see 02_onboarding_register_or_join.sql).
-- ============================================================================
truncate table
  join_requests, liveness_checks, attendance_logs, attendance_sessions,
  face_enrollment_sessions, face_profiles, consent_records, employees,
  departments, audit_logs, app_settings, profiles, organizations
  restart identity cascade;

-- Remove all auth users so nobody is left over.
delete from auth.users;
