-- ============================================================================
-- FaceAttend v1.4 - COMPLETE DATABASE SETUP (single idempotent migration)
--
-- Replaces every earlier migration:
--   20260803155254_create_core_schema.sql
--   20260803155331_create_rls_policies.sql
--   20260808120000_kiosk_api_key.sql
--   20260812120000_domains_and_join_requests.sql
--   02_onboarding_register_or_join.sql
--   20260815120000_tune_face_thresholds.sql
--   20260820120000_dynamic_people_fields.sql
--
-- Safe to run on an EMPTY project or on an EXISTING one, any number of times.
-- It never deletes data. (The cleanup scripts 00_/01_ are intentionally NOT here.)
--
-- Run: Supabase -> SQL Editor -> New query -> paste all -> Run.
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. ENUM TYPES
-- ----------------------------------------------------------------------------
DO $$ BEGIN CREATE TYPE user_role AS ENUM ('super_admin','org_admin','hr_officer','supervisor','employee'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE attendance_status AS ENUM ('present','late','absent','checked_out','failed_verification','rejected_liveness'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE check_type AS ENUM ('check_in','check_out'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE verification_status AS ENUM ('pending','verified','failed','rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE enrollment_status AS ENUM ('pending','in_progress','completed','failed','revoked'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE liveness_challenge AS ENUM ('BLINK','TURN_HEAD_LEFT','TURN_HEAD_RIGHT','LOOK_STRAIGHT','SMILE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE consent_status AS ENUM ('granted','revoked','pending'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE join_request_status AS ENUM ('pending','approved','rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- 2. updated_at HELPER
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 3. TABLES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  domain text,
  org_type text NOT NULL DEFAULT 'company',
  status text NOT NULL DEFAULT 'active',
  plan text NOT NULL DEFAULT 'free',
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  kiosk_api_key text UNIQUE,
  kiosk_key_rotated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Columns added by later versions (for databases created earlier)
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS domain text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS org_type text NOT NULL DEFAULT 'company';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS kiosk_api_key text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS kiosk_key_rotated_at timestamptz;

CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name user_role NOT NULL UNIQUE,
  description text,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

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
-- Not every organisation collects email (e.g. young pupils)
ALTER TABLE employees ALTER COLUMN email DROP NOT NULL;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

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

CREATE TABLE IF NOT EXISTS face_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  face_embedding text NOT NULL,
  embedding_model text NOT NULL DEFAULT 'insightface',
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

CREATE TABLE IF NOT EXISTS face_enrollment_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  face_profile_id uuid REFERENCES face_profiles(id) ON DELETE SET NULL,
  status enrollment_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS attendance_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  attendance_date date NOT NULL,
  status attendance_status NOT NULL DEFAULT 'absent',
  check_in_time timestamptz,
  check_out_time timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

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

CREATE TABLE IF NOT EXISTS liveness_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE,
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
  face_match_threshold double precision NOT NULL DEFAULT 0.68,
  liveness_threshold double precision NOT NULL DEFAULT 0.6,
  max_allowed_faces integer NOT NULL DEFAULT 1,
  min_face_confidence double precision NOT NULL DEFAULT 0.5,
  geofencing_enabled boolean NOT NULL DEFAULT false,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,   -- holds people_schema
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  requested_domain text,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  requested_new_org_name text,
  status join_request_status NOT NULL DEFAULT 'pending',
  decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 4. INDEXES
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_org ON profiles(organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_departments_org_name ON departments(organization_id, name);
CREATE INDEX IF NOT EXISTS idx_employees_org ON employees(organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_org_code ON employees(organization_id, employee_code);
CREATE INDEX IF NOT EXISTS idx_employees_metadata ON employees USING gin (metadata);
CREATE INDEX IF NOT EXISTS idx_face_active ON face_profiles(organization_id, is_active) WHERE is_active = true;
CREATE UNIQUE INDEX IF NOT EXISTS idx_att_sessions_emp_date ON attendance_sessions(employee_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_att_sessions_org_date ON attendance_sessions(organization_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_att_logs_date ON attendance_logs(attendance_date);
CREATE INDEX IF NOT EXISTS idx_att_logs_org_date ON attendance_logs(organization_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_org_kiosk ON organizations(kiosk_api_key);
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_kiosk_unique ON organizations(kiosk_api_key) WHERE kiosk_api_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_domain ON organizations(lower(domain)) WHERE domain IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jr_org ON join_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_jr_user ON join_requests(user_id);

-- ----------------------------------------------------------------------------
-- 5. updated_at TRIGGERS
-- ----------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['organizations','roles','profiles','departments','employees','consent_records',
                           'face_profiles','face_enrollment_sessions','attendance_sessions','attendance_logs','app_settings']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated ON %I;', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s_updated BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();', t, t);
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 6. SEED ROLES
-- ----------------------------------------------------------------------------
INSERT INTO roles (name, description) VALUES
  ('super_admin','Full system'),
  ('org_admin','Org management'),
  ('hr_officer','Employees + attendance'),
  ('supervisor','View dept'),
  ('employee','Self only')
ON CONFLICT (name) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 7. FACE / LIVENESS DEFAULTS (v1.4 detector scoring)
-- ----------------------------------------------------------------------------
ALTER TABLE app_settings ALTER COLUMN min_face_confidence SET DEFAULT 0.5;
ALTER TABLE app_settings ALTER COLUMN liveness_threshold  SET DEFAULT 0.6;
UPDATE app_settings SET min_face_confidence = 0.5 WHERE min_face_confidence > 0.5;
UPDATE app_settings SET liveness_threshold  = 0.6 WHERE liveness_threshold  > 0.6;

-- Every organisation needs a settings row and a default department
INSERT INTO app_settings (organization_id)
  SELECT o.id FROM organizations o
  ON CONFLICT (organization_id) DO NOTHING;
INSERT INTO departments (organization_id, name)
  SELECT o.id, 'General' FROM organizations o
  ON CONFLICT (organization_id, name) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 8. RLS HELPER FUNCTIONS
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_org_id() RETURNS uuid AS $$
  SELECT organization_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.current_user_role() RETURNS user_role AS $$
  SELECT role FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.current_user_employee_id() RETURNS uuid AS $$
  SELECT id FROM public.employees WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_hr_or_above() RETURNS boolean AS $$
  SELECT public.current_user_role() IN ('super_admin','org_admin','hr_officer');
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- ----------------------------------------------------------------------------
-- 9. ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------
ALTER TABLE organizations            ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments              ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees                ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_records          ENABLE ROW LEVEL SECURITY;
ALTER TABLE face_profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE face_enrollment_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_sessions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_logs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE liveness_checks          ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs               ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings             ENABLE ROW LEVEL SECURITY;
ALTER TABLE join_requests            ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_sel" ON organizations;
CREATE POLICY "org_sel" ON organizations FOR SELECT TO authenticated
  USING (current_user_role()='super_admin' OR id=current_user_org_id());
DROP POLICY IF EXISTS "org_mng" ON organizations;
CREATE POLICY "org_mng" ON organizations FOR ALL TO authenticated
  USING (current_user_role()='super_admin' OR (id=current_user_org_id() AND current_user_role()='org_admin'))
  WITH CHECK (current_user_role()='super_admin' OR (id=current_user_org_id() AND current_user_role()='org_admin'));

DROP POLICY IF EXISTS "roles_sel" ON roles;
CREATE POLICY "roles_sel" ON roles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "prof_sel" ON profiles;
CREATE POLICY "prof_sel" ON profiles FOR SELECT TO authenticated
  USING (user_id=auth.uid() OR current_user_role()='super_admin' OR (organization_id=current_user_org_id() AND is_hr_or_above()));
DROP POLICY IF EXISTS "prof_ins" ON profiles;
CREATE POLICY "prof_ins" ON profiles FOR INSERT TO authenticated
  WITH CHECK (user_id=auth.uid() OR (organization_id=current_user_org_id() AND is_hr_or_above()) OR current_user_role()='super_admin');
DROP POLICY IF EXISTS "prof_upd" ON profiles;
CREATE POLICY "prof_upd" ON profiles FOR UPDATE TO authenticated
  USING (user_id=auth.uid() OR current_user_role()='super_admin' OR (organization_id=current_user_org_id() AND is_hr_or_above()))
  WITH CHECK (user_id=auth.uid() OR current_user_role()='super_admin' OR (organization_id=current_user_org_id() AND is_hr_or_above()));

DROP POLICY IF EXISTS "dept_sel" ON departments;
CREATE POLICY "dept_sel" ON departments FOR SELECT TO authenticated
  USING (current_user_role()='super_admin' OR organization_id=current_user_org_id());
DROP POLICY IF EXISTS "dept_mng" ON departments;
CREATE POLICY "dept_mng" ON departments FOR ALL TO authenticated
  USING (current_user_role()='super_admin' OR (organization_id=current_user_org_id() AND is_hr_or_above()))
  WITH CHECK (current_user_role()='super_admin' OR (organization_id=current_user_org_id() AND is_hr_or_above()));

DROP POLICY IF EXISTS "emp_sel" ON employees;
CREATE POLICY "emp_sel" ON employees FOR SELECT TO authenticated
  USING (current_user_role()='super_admin' OR organization_id=current_user_org_id());
DROP POLICY IF EXISTS "emp_mng" ON employees;
CREATE POLICY "emp_mng" ON employees FOR ALL TO authenticated
  USING (current_user_role()='super_admin' OR (organization_id=current_user_org_id() AND is_hr_or_above()))
  WITH CHECK (current_user_role()='super_admin' OR (organization_id=current_user_org_id() AND is_hr_or_above()));

DROP POLICY IF EXISTS "consent_mng" ON consent_records;
CREATE POLICY "consent_mng" ON consent_records FOR ALL TO authenticated
  USING (current_user_role()='super_admin' OR (organization_id=current_user_org_id() AND is_hr_or_above()))
  WITH CHECK (current_user_role()='super_admin' OR (organization_id=current_user_org_id() AND is_hr_or_above()));

DROP POLICY IF EXISTS "face_admin" ON face_profiles;
CREATE POLICY "face_admin" ON face_profiles FOR ALL TO authenticated
  USING (current_user_role()='super_admin' OR (organization_id=current_user_org_id() AND is_hr_or_above()))
  WITH CHECK (current_user_role()='super_admin' OR (organization_id=current_user_org_id() AND is_hr_or_above()));

DROP POLICY IF EXISTS "fes_admin" ON face_enrollment_sessions;
CREATE POLICY "fes_admin" ON face_enrollment_sessions FOR ALL TO authenticated
  USING (current_user_role()='super_admin' OR (organization_id=current_user_org_id() AND is_hr_or_above()))
  WITH CHECK (current_user_role()='super_admin' OR (organization_id=current_user_org_id() AND is_hr_or_above()));

DROP POLICY IF EXISTS "att_sel" ON attendance_sessions;
CREATE POLICY "att_sel" ON attendance_sessions FOR SELECT TO authenticated
  USING (current_user_role()='super_admin' OR (organization_id=current_user_org_id() AND is_hr_or_above()) OR employee_id=current_user_employee_id());
DROP POLICY IF EXISTS "att_mng" ON attendance_sessions;
CREATE POLICY "att_mng" ON attendance_sessions FOR ALL TO authenticated
  USING (current_user_role()='super_admin' OR (organization_id=current_user_org_id() AND is_hr_or_above()))
  WITH CHECK (current_user_role()='super_admin' OR (organization_id=current_user_org_id() AND is_hr_or_above()));

DROP POLICY IF EXISTS "log_sel" ON attendance_logs;
CREATE POLICY "log_sel" ON attendance_logs FOR SELECT TO authenticated
  USING (current_user_role()='super_admin' OR (organization_id=current_user_org_id() AND is_hr_or_above()) OR employee_id=current_user_employee_id());
DROP POLICY IF EXISTS "log_mng" ON attendance_logs;
CREATE POLICY "log_mng" ON attendance_logs FOR ALL TO authenticated
  USING (current_user_role()='super_admin' OR (organization_id=current_user_org_id() AND is_hr_or_above()))
  WITH CHECK (current_user_role()='super_admin' OR (organization_id=current_user_org_id() AND is_hr_or_above()));

DROP POLICY IF EXISTS "live_sel" ON liveness_checks;
CREATE POLICY "live_sel" ON liveness_checks FOR SELECT TO authenticated
  USING (current_user_role()='super_admin' OR (organization_id=current_user_org_id() AND is_hr_or_above()));

DROP POLICY IF EXISTS "audit_sel" ON audit_logs;
CREATE POLICY "audit_sel" ON audit_logs FOR SELECT TO authenticated
  USING (current_user_role()='super_admin' OR (organization_id=current_user_org_id() AND is_hr_or_above()));

DROP POLICY IF EXISTS "set_sel" ON app_settings;
CREATE POLICY "set_sel" ON app_settings FOR SELECT TO authenticated
  USING (current_user_role()='super_admin' OR organization_id=current_user_org_id());
DROP POLICY IF EXISTS "set_mng" ON app_settings;
CREATE POLICY "set_mng" ON app_settings FOR ALL TO authenticated
  USING (current_user_role()='super_admin' OR (organization_id=current_user_org_id() AND current_user_role()='org_admin'))
  WITH CHECK (current_user_role()='super_admin' OR (organization_id=current_user_org_id() AND current_user_role()='org_admin'));

DROP POLICY IF EXISTS "jr_sel" ON join_requests;
CREATE POLICY "jr_sel" ON join_requests FOR SELECT TO authenticated
  USING (user_id=auth.uid() OR (organization_id=current_user_org_id() AND current_user_role() IN ('super_admin','org_admin','hr_officer')));

-- Kiosk key must never reach the browser (backend reads it with the service role)
REVOKE SELECT (kiosk_api_key, kiosk_key_rotated_at) ON organizations FROM authenticated;
REVOKE SELECT (kiosk_api_key, kiosk_key_rotated_at) ON organizations FROM anon;

-- ----------------------------------------------------------------------------
-- 10. SIGN-UP TRIGGER: register a new org (with type) OR request to join
-- ----------------------------------------------------------------------------
-- Remove the very first auto-profile trigger from older versions
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_join_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_new_org text; v_domain text; v_full text; v_type text; v_slug text; v_org uuid;
BEGIN
  v_new_org := nullif(btrim(new.raw_user_meta_data->>'new_org_name'), '');
  v_domain  := lower(nullif(btrim(new.raw_user_meta_data->>'requested_domain'), ''));
  v_full    := nullif(btrim(new.raw_user_meta_data->>'full_name'), '');
  v_type    := lower(coalesce(nullif(btrim(new.raw_user_meta_data->>'org_type'), ''), 'company'));

  -- (a) Register a brand-new organisation: this user becomes its admin
  IF v_new_org IS NOT NULL THEN
    v_slug := lower(regexp_replace(v_new_org, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(md5(random()::text), 1, 6);
    BEGIN
      INSERT INTO public.organizations (name, slug, domain, org_type)
        VALUES (v_new_org, v_slug, v_domain, v_type) RETURNING id INTO v_org;
    EXCEPTION WHEN unique_violation THEN
      -- domain already taken: create the org without a domain
      INSERT INTO public.organizations (name, slug, domain, org_type)
        VALUES (v_new_org, v_slug || substr(md5(random()::text), 1, 4), NULL, v_type) RETURNING id INTO v_org;
    END;
    INSERT INTO public.app_settings (organization_id) VALUES (v_org) ON CONFLICT (organization_id) DO NOTHING;
    INSERT INTO public.departments (organization_id, name) VALUES (v_org, 'General') ON CONFLICT (organization_id, name) DO NOTHING;
    INSERT INTO public.profiles (user_id, organization_id, role, full_name, email, status)
      VALUES (new.id, v_org, 'org_admin', coalesce(v_full, split_part(new.email, '@', 1)), new.email, 'active')
      ON CONFLICT (user_id) DO UPDATE
        SET organization_id = excluded.organization_id, role = 'org_admin', status = 'active';
    RETURN new;
  END IF;

  -- (b) Join an existing organisation by domain: pending request for an admin
  IF v_domain IS NOT NULL THEN
    SELECT id INTO v_org FROM public.organizations WHERE lower(domain) = v_domain LIMIT 1;
  END IF;
  INSERT INTO public.join_requests (user_id, email, full_name, requested_domain, organization_id, status)
    VALUES (new.id, new.email, v_full, v_domain, v_org, 'pending');
  RETURN new;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_join_request ON auth.users;
CREATE TRIGGER on_auth_user_join_request
  AFTER INSERT ON auth.users FOR EACH ROW
  EXECUTE FUNCTION public.handle_join_request();

COMMIT;

-- ============================================================================
-- CHECK (optional, run separately). Expect 14 tables and org_type per org:
--   select count(*) from information_schema.tables
--   where table_schema='public' and table_name in ('organizations','roles','profiles',
--     'departments','employees','consent_records','face_profiles','face_enrollment_sessions',
--     'attendance_sessions','attendance_logs','liveness_checks','audit_logs','app_settings','join_requests');
--   select name, org_type from organizations;
-- ============================================================================
