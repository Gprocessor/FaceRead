/*
# Face Recognition Attendance System — Core Schema

## Summary
Creates the complete multi-tenant database schema for a face-recognition attendance
system with liveness detection. Supports organizations, roles, departments,
employees, face profiles, consent tracking, attendance sessions, liveness checks,
audit logs, and app settings.

## New Tables (13)
1. `organizations` — top-level tenant entities (SaaS multi-tenant root)
2. `profiles` — user profile linked to auth.users, with role + org assignment
3. `roles` — role catalog (super_admin, org_admin, hr_officer, supervisor, employee)
4. `departments` — departments within an organization
5. `employees` — people tracked for attendance (can be linked to a user profile)
6. `face_profiles` — biometric face embeddings per employee (NEVER public)
7. `face_enrollment_sessions` — audit of each enrollment attempt
8. `consent_records` — biometric consent tracking (GDPR/biometric privacy)
9. `attendance_sessions` — daily attendance grouping per employee
10. `attendance_logs` — individual check-in/check-out events with verification
11. `liveness_checks` — liveness challenge results per attendance attempt
12. `audit_logs` — system-wide audit trail
13. `app_settings` — organization-level configuration (late threshold, etc.)

## Security
- RLS enabled on ALL tables
- Organization isolation via `organization_id` on all tenant-scoped tables
- Face profiles locked to service role + admin-only access
- Audit logs admin-only
- Employees see only their own attendance
- Detailed policies applied in a follow-up migration

## Notes
- All IDs are UUIDs
- `created_at` / `updated_at` on all tables
- `created_by` on tables where audit of creator matters
- Indexes on all foreign keys and frequently queried columns
- `updated_at` triggers added for automatic timestamp maintenance
*/

-- ============================================================
-- ENUM TYPES
-- ============================================================

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('super_admin', 'org_admin', 'hr_officer', 'supervisor', 'employee');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE attendance_status AS ENUM ('present', 'late', 'absent', 'checked_out', 'failed_verification', 'rejected_liveness');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE check_type AS ENUM ('check_in', 'check_out');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE verification_status AS ENUM ('pending', 'verified', 'failed', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE enrollment_status AS ENUM ('pending', 'in_progress', 'completed', 'failed', 'revoked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE liveness_challenge AS ENUM ('BLINK', 'TURN_HEAD_LEFT', 'TURN_HEAD_RIGHT', 'LOOK_STRAIGHT', 'SMILE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE consent_status AS ENUM ('granted', 'revoked', 'pending');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- UPDATED_AT TRIGGER FUNCTION (reusable)
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 1. ORGANIZATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  domain text,
  status text NOT NULL DEFAULT 'active',
  plan text NOT NULL DEFAULT 'free',
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. ROLES (catalog)
-- ============================================================

CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name user_role NOT NULL UNIQUE,
  description text,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. PROFILES (auth.users link)
-- ============================================================

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  role_id uuid REFERENCES roles(id) ON DELETE SET NULL,
  role user_role NOT NULL DEFAULT 'employee',
  full_name text,
  email text,
  avatar_url text,
  phone text,
  status text NOT NULL DEFAULT 'active',
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- ============================================================
-- 4. DEPARTMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  description text,
  head_employee_id uuid,
  status text NOT NULL DEFAULT 'active',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_departments_organization_id ON departments(organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_departments_org_name ON departments(organization_id, name);

-- ============================================================
-- 5. EMPLOYEES
-- ============================================================

CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  employee_code text NOT NULL,
  full_name text NOT NULL,
  email text,
  phone text,
  position text,
  status text NOT NULL DEFAULT 'active',
  hire_date date,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_employees_organization_id ON employees(organization_id);
CREATE INDEX IF NOT EXISTS idx_employees_department_id ON employees(department_id);
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON employees(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_org_code ON employees(organization_id, employee_code);

-- ============================================================
-- 6. CONSENT RECORDS (biometric privacy)
-- ============================================================

CREATE TABLE IF NOT EXISTS consent_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  consent_type text NOT NULL DEFAULT 'biometric_face',
  status consent_status NOT NULL DEFAULT 'pending',
  granted_at timestamptz,
  revoked_at timestamptz,
  ip_address text,
  device_info jsonb NOT NULL DEFAULT '{}'::jsonb,
  consent_text text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE consent_records ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_consent_employee_id_emp_id ON consent_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_consent_org_id ON consent_records(organization_id);

-- ============================================================
-- 7. FACE PROFILES (biometric — NEVER public)
-- ============================================================

-- face_embedding stored as text (JSON-serialized float array) for portability
CREATE TABLE IF NOT EXISTS face_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  face_embedding text NOT NULL,
  embedding_model text NOT NULL DEFAULT 'face_recognition',
  embedding_dim integer,
  enrollment_status enrollment_status NOT NULL DEFAULT 'pending',
  consent_id uuid REFERENCES consent_records(id) ON DELETE SET NULL,
  enrollment_date timestamptz,
  last_verified_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE face_profiles ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_face_profiles_emp_id ON face_profiles(employee_id);
CREATE INDEX IF NOT EXISTS idx_face_profiles_org_id ON face_profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_face_profiles_active ON face_profiles(organization_id, is_active) WHERE is_active = true;

-- ============================================================
-- 8. FACE ENROLLMENT SESSIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS face_enrollment_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  face_profile_id uuid REFERENCES face_profiles(id) ON DELETE SET NULL,
  status enrollment_status NOT NULL DEFAULT 'pending',
  attempt_count integer NOT NULL DEFAULT 0,
  frames_captured integer NOT NULL DEFAULT 0,
  liveness_passed boolean NOT NULL DEFAULT false,
  device_info jsonb NOT NULL DEFAULT '{}'::jsonb,
  failure_reason text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE face_enrollment_sessions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_enroll_sessions_emp_id ON face_enrollment_sessions(employee_id);
CREATE INDEX IF NOT EXISTS idx_enroll_sessions_org_id ON face_enrollment_sessions(organization_id);

-- ============================================================
-- 9. ATTENDANCE SESSIONS (daily grouping)
-- ============================================================

CREATE TABLE IF NOT EXISTS attendance_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  attendance_date date NOT NULL,
  status attendance_status NOT NULL DEFAULT 'absent',
  check_in_time timestamptz,
  check_out_time timestamptz,
  work_duration_minutes integer,
  is_late boolean NOT NULL DEFAULT false,
  late_minutes integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE attendance_sessions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_emp_id ON attendance_sessions(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_org_id ON attendance_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_date ON attendance_sessions(attendance_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_sessions_emp_date ON attendance_sessions(employee_id, attendance_date);

-- ============================================================
-- 10. ATTENDANCE LOGS (individual events)
-- ============================================================

CREATE TABLE IF NOT EXISTS attendance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  attendance_session_id uuid REFERENCES attendance_sessions(id) ON DELETE SET NULL,
  attendance_date date NOT NULL,
  check_type check_type NOT NULL,
  check_in_time timestamptz,
  check_out_time timestamptz,
  status attendance_status NOT NULL DEFAULT 'present',
  face_match_score double precision,
  liveness_score double precision,
  verification_status verification_status NOT NULL DEFAULT 'pending',
  face_profile_id uuid REFERENCES face_profiles(id) ON DELETE SET NULL,
  device_info jsonb NOT NULL DEFAULT '{}'::jsonb,
  location_latitude double precision,
  location_longitude double precision,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_attendance_logs_emp_id ON attendance_logs(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_org_id ON attendance_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_date ON attendance_logs(attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_session_id ON attendance_logs(attendance_session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_check_type ON attendance_logs(check_type);

-- ============================================================
-- 11. LIVENESS CHECKS
-- ============================================================

CREATE TABLE IF NOT EXISTS liveness_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  attendance_log_id uuid REFERENCES attendance_logs(id) ON DELETE SET NULL,
  challenge_type liveness_challenge NOT NULL,
  liveness_score double precision NOT NULL DEFAULT 0,
  passed boolean NOT NULL DEFAULT false,
  failure_reason text,
  frame_count integer NOT NULL DEFAULT 0,
  processing_time_ms integer,
  device_info jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE liveness_checks ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_liveness_emp_id ON liveness_checks(employee_id);
CREATE INDEX IF NOT EXISTS idx_liveness_org_id ON liveness_checks(organization_id);
CREATE INDEX IF NOT EXISTS idx_liveness_attendance_log_id ON liveness_checks(attendance_log_id);

-- ============================================================
-- 12. AUDIT LOGS
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role user_role,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_id ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_user_id ON audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- ============================================================
-- 13. APP SETTINGS (org-level configuration)
-- ============================================================

CREATE TABLE IF NOT EXISTS app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  late_threshold_minutes integer NOT NULL DEFAULT 15,
  work_start_time time NOT NULL DEFAULT '09:00',
  work_end_time time NOT NULL DEFAULT '17:00',
  require_liveness boolean NOT NULL DEFAULT true,
  require_check_out boolean NOT NULL DEFAULT false,
  allow_multiple_check_in boolean NOT NULL DEFAULT false,
  duplicate_check_window_minutes integer NOT NULL DEFAULT 60,
  face_match_threshold double precision NOT NULL DEFAULT 0.6,
  liveness_threshold double precision NOT NULL DEFAULT 0.7,
  max_allowed_faces integer NOT NULL DEFAULT 1,
  min_face_confidence double precision NOT NULL DEFAULT 0.7,
  geofencing_enabled boolean NOT NULL DEFAULT false,
  geofence_lat double precision,
  geofence_lng double precision,
  geofence_radius_m integer,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_app_settings_org_id ON app_settings(organization_id);

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'organizations','roles','profiles','departments','employees',
    'consent_records','face_profiles','face_enrollment_sessions',
    'attendance_sessions','attendance_logs','liveness_checks','app_settings'
  ])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated ON %I;', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s_updated BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();', t, t);
  END LOOP;
END $$;

-- ============================================================
-- SEED DEFAULT ROLES
-- ============================================================

INSERT INTO roles (name, description, permissions) VALUES
  ('super_admin', 'Full system access across all organizations', '{"all": true}'::jsonb),
  ('org_admin', 'Full management access within their organization', '{"org_manage": true}'::jsonb),
  ('hr_officer', 'Manage employees and view attendance within their organization', '{"hr_manage": true}'::jsonb),
  ('supervisor', 'View attendance for their department', '{"dept_view": true}'::jsonb),
  ('employee', 'View own attendance and profile only', '{"self_view": true}'::jsonb)
ON CONFLICT (name) DO NOTHING;
