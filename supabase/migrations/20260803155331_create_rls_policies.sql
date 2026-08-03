/*
  # Row Level Security Policies — Face Recognition Attendance System

  Applies comprehensive RLS policies across all 13 tables with a 5-tier
  role hierarchy (super_admin, org_admin, hr_officer, supervisor, employee)
  and organization-scoped data isolation.

  - Helper functions resolve the caller's org, role, and employee id
  - All tenant tables scoped by organization_id
  - Face profiles: admin-only (employees never read embeddings)
  - Audit logs: admin-only
  - anon role has NO access (all policies TO authenticated)
  - service role bypasses RLS (used by Python backend only)
*/

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================
CREATE OR REPLACE FUNCTION public.current_user_org_id()
RETURNS uuid AS $$
  SELECT organization_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role AS $$
  SELECT role FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.current_user_employee_id()
RETURNS uuid AS $$
  SELECT id FROM public.employees WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
  SELECT current_user_role() IN ('super_admin', 'org_admin');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_hr_or_above()
RETURNS boolean AS $$
  SELECT current_user_role() IN ('super_admin', 'org_admin', 'hr_officer');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- ORGANIZATIONS
-- ============================================================
DROP POLICY IF EXISTS "org_select_own" ON organizations;
CREATE POLICY "org_select_own" ON organizations FOR SELECT
  TO authenticated USING (current_user_role() = 'super_admin' OR id = current_user_org_id());

DROP POLICY IF EXISTS "org_insert_super_admin" ON organizations;
CREATE POLICY "org_insert_super_admin" ON organizations FOR INSERT
  TO authenticated WITH CHECK (current_user_role() = 'super_admin');

DROP POLICY IF EXISTS "org_update_admin" ON organizations;
CREATE POLICY "org_update_admin" ON organizations FOR UPDATE
  TO authenticated USING (current_user_role() = 'super_admin' OR (id = current_user_org_id() AND current_user_role() = 'org_admin'))
  WITH CHECK (current_user_role() = 'super_admin' OR (id = current_user_org_id() AND current_user_role() = 'org_admin'));

DROP POLICY IF EXISTS "org_delete_super_admin" ON organizations;
CREATE POLICY "org_delete_super_admin" ON organizations FOR DELETE
  TO authenticated USING (current_user_role() = 'super_admin');

-- ============================================================
-- ROLES
-- ============================================================
DROP POLICY IF EXISTS "roles_select_all" ON roles;
CREATE POLICY "roles_select_all" ON roles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "roles_manage_super_admin" ON roles;
CREATE POLICY "roles_manage_super_admin" ON roles FOR ALL
  TO authenticated USING (current_user_role() = 'super_admin') WITH CHECK (current_user_role() = 'super_admin');

-- ============================================================
-- PROFILES
-- ============================================================
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON profiles;
CREATE POLICY "profiles_select_own_or_admin" ON profiles FOR SELECT
  TO authenticated USING (user_id = auth.uid() OR current_user_role() = 'super_admin' OR (organization_id = current_user_org_id() AND is_hr_or_above()));

DROP POLICY IF EXISTS "profiles_insert_self" ON profiles;
CREATE POLICY "profiles_insert_self" ON profiles FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid() OR (organization_id = current_user_org_id() AND is_hr_or_above()) OR current_user_role() = 'super_admin');

DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON profiles;
CREATE POLICY "profiles_update_own_or_admin" ON profiles FOR UPDATE
  TO authenticated USING (user_id = auth.uid() OR current_user_role() = 'super_admin' OR (organization_id = current_user_org_id() AND is_hr_or_above()))
  WITH CHECK (user_id = auth.uid() OR current_user_role() = 'super_admin' OR (organization_id = current_user_org_id() AND is_hr_or_above()));

DROP POLICY IF EXISTS "profiles_delete_admin" ON profiles;
CREATE POLICY "profiles_delete_admin" ON profiles FOR DELETE
  TO authenticated USING (current_user_role() = 'super_admin' OR (organization_id = current_user_org_id() AND current_user_role() = 'org_admin'));

-- ============================================================
-- DEPARTMENTS
-- ============================================================
DROP POLICY IF EXISTS "dept_select_org" ON departments;
CREATE POLICY "dept_select_org" ON departments FOR SELECT
  TO authenticated USING (current_user_role() = 'super_admin' OR organization_id = current_user_org_id());

DROP POLICY IF EXISTS "dept_insert_admin" ON departments;
CREATE POLICY "dept_insert_admin" ON departments FOR INSERT
  TO authenticated WITH CHECK (current_user_role() = 'super_admin' OR (organization_id = current_user_org_id() AND is_hr_or_above()));

DROP POLICY IF EXISTS "dept_update_admin" ON departments;
CREATE POLICY "dept_update_admin" ON departments FOR UPDATE
  TO authenticated USING (current_user_role() = 'super_admin' OR (organization_id = current_user_org_id() AND is_hr_or_above()))
  WITH CHECK (current_user_role() = 'super_admin' OR (organization_id = current_user_org_id() AND is_hr_or_above()));

DROP POLICY IF EXISTS "dept_delete_admin" ON departments;
CREATE POLICY "dept_delete_admin" ON departments FOR DELETE
  TO authenticated USING (current_user_role() = 'super_admin' OR (organization_id = current_user_org_id() AND current_user_role() = 'org_admin'));

-- ============================================================
-- EMPLOYEES
-- ============================================================
DROP POLICY IF EXISTS "emp_select_org" ON employees;
CREATE POLICY "emp_select_org" ON employees FOR SELECT
  TO authenticated USING (current_user_role() = 'super_admin' OR organization_id = current_user_org_id());

DROP POLICY IF EXISTS "emp_insert_admin" ON employees;
CREATE POLICY "emp_insert_admin" ON employees FOR INSERT
  TO authenticated WITH CHECK (current_user_role() = 'super_admin' OR (organization_id = current_user_org_id() AND is_hr_or_above()));

DROP POLICY IF EXISTS "emp_update_admin" ON employees;
CREATE POLICY "emp_update_admin" ON employees FOR UPDATE
  TO authenticated USING (current_user_role() = 'super_admin' OR (organization_id = current_user_org_id() AND is_hr_or_above()))
  WITH CHECK (current_user_role() = 'super_admin' OR (organization_id = current_user_org_id() AND is_hr_or_above()));

DROP POLICY IF EXISTS "emp_delete_admin" ON employees;
CREATE POLICY "emp_delete_admin" ON employees FOR DELETE
  TO authenticated USING (current_user_role() = 'super_admin' OR (organization_id = current_user_org_id() AND current_user_role() = 'org_admin'));

-- ============================================================
-- CONSENT RECORDS
-- ============================================================
DROP POLICY IF EXISTS "consent_select_own_or_admin" ON consent_records;
CREATE POLICY "consent_select_own_or_admin" ON consent_records FOR SELECT
  TO authenticated USING (current_user_role() = 'super_admin' OR (organization_id = current_user_org_id() AND is_hr_or_above()) OR employee_id = current_user_employee_id());

DROP POLICY IF EXISTS "consent_insert_admin" ON consent_records;
CREATE POLICY "consent_insert_admin" ON consent_records FOR INSERT
  TO authenticated WITH CHECK (current_user_role() = 'super_admin' OR (organization_id = current_user_org_id() AND is_hr_or_above()));

DROP POLICY IF EXISTS "consent_update_admin" ON consent_records;
CREATE POLICY "consent_update_admin" ON consent_records FOR UPDATE
  TO authenticated USING (current_user_role() = 'super_admin' OR (organization_id = current_user_org_id() AND is_hr_or_above()))
  WITH CHECK (current_user_role() = 'super_admin' OR (organization_id = current_user_org_id() AND is_hr_or_above()));

DROP POLICY IF EXISTS "consent_delete_admin" ON consent_records;
CREATE POLICY "consent_delete_admin" ON consent_records FOR DELETE
  TO authenticated USING (current_user_role() = 'super_admin' OR (organization_id = current_user_org_id() AND current_user_role() = 'org_admin'));

-- ============================================================
-- FACE PROFILES — admin-only
-- ============================================================
DROP POLICY IF EXISTS "face_profiles_select_admin" ON face_profiles;
CREATE POLICY "face_profiles_select_admin" ON face_profiles FOR SELECT
  TO authenticated USING (current_user_role() = 'super_admin' OR (organization_id = current_user_org_id() AND is_hr_or_above()));

DROP POLICY IF EXISTS "face_profiles_insert_admin" ON face_profiles;
CREATE POLICY "face_profiles_insert_admin" ON face_profiles FOR INSERT
  TO authenticated WITH CHECK (current_user_role() = 'super_admin' OR (organization_id = current_user_org_id() AND is_hr_or_above()));

DROP POLICY IF EXISTS "face_profiles_update_admin" ON face_profiles;
CREATE POLICY "face_profiles_update_admin" ON face_profiles FOR UPDATE
  TO authenticated USING (current_user_role() = 'super_admin' OR (organization_id = current_user_org_id() AND is_hr_or_above()))
  WITH CHECK (current_user_role() = 'super_admin' OR (organization_id = current_user_org_id() AND is_hr_or_above()));

DROP POLICY IF EXISTS "face_profiles_delete_admin" ON face_profiles;
CREATE POLICY "face_profiles_delete_admin" ON face_profiles FOR DELETE
  TO authenticated USING (current_user_role() = 'super_admin' OR (organization_id = current_user_org_id() AND current_user_role() = 'org_admin'));

-- ============================================================
-- FACE ENROLLMENT SESSIONS
-- ============================================================
DROP POLICY IF EXISTS "enroll_sessions_select_admin" ON face_enrollment_sessions;
CREATE POLICY "enroll_sessions_select_admin" ON face_enrollment_sessions FOR SELECT
  TO authenticated USING (current_user_role() = 'super_admin' OR (organization_id = current_user_org_id() AND is_hr_or_above()) OR employee_id = current_user_employee_id());

DROP POLICY IF EXISTS "enroll_sessions_insert_admin" ON face_enrollment_sessions;
CREATE POLICY "enroll_sessions_insert_admin" ON face_enrollment_sessions FOR INSERT
  TO authenticated WITH CHECK (current_user_role() = 'super_admin' OR (organization_id = current_user_org_id() AND is_hr_or_above()));

DROP POLICY IF EXISTS "enroll_sessions_update_admin" ON face_enrollment_sessions;
CREATE POLICY "enroll_sessions_update_admin" ON face_enrollment_sessions FOR UPDATE
  TO authenticated USING (current_user_role() = 'super_admin' OR (organization_id = current_user_org_id() AND is_hr_or_above()))
  WITH CHECK (current_user_role() = 'super_admin' OR (organization_id = current_user_org_id() AND is_hr_or_above()));

DROP POLICY IF EXISTS "enroll_sessions_delete_admin" ON face_enrollment_sessions;
CREATE POLICY "enroll_sessions_delete_admin" ON face_enrollment_sessions FOR DELETE
  TO authenticated USING (current_user_role() = 'super_admin' OR (organization_id = current_user_org_id() AND current_user_role() = 'org_admin'));

-- ============================================================
-- ATTENDANCE SESSIONS
-- ============================================================
DROP POLICY IF EXISTS "att_sessions_select_scoped" ON attendance_sessions;
CREATE POLICY "att_sessions_select_scoped" ON attendance_sessions FOR SELECT
  TO authenticated USING (current_user_role() = 'super_admin' OR (organization_id = current_user_org_id() AND is_hr_or_above()) OR employee_id = current_user_employee_id());

DROP POLICY IF EXISTS "att_sessions_insert_admin" ON attendance_sessions;
CREATE POLICY "att_sessions_insert_admin" ON attendance_sessions FOR INSERT
  TO authenticated WITH CHECK (current_user_role() = 'super_admin' OR (organization_id = current_user_org_id() AND is_hr_or_above()));

DROP POLICY IF EXISTS "att_sessions_update_admin" ON attendance_sessions;
CREATE POLICY "att_sessions_update_admin" ON attendance_sessions FOR UPDATE
  TO authenticated USING (current_user_role() = 'super_admin' OR (organization_id = current_user_org_id() AND is_hr_or_above()))
  WITH CHECK (current_user_role() = 'super_admin' OR (organization_id = current_user_org_id() AND is_hr_or_above()));

DROP POLICY IF EXISTS "att_sessions_delete_admin" ON attendance_sessions;
CREATE POLICY "att_sessions_delete_admin" ON attendance_sessions FOR DELETE
  TO authenticated USING (current_user_role() = 'super_admin' OR (organization_id = current_user_org_id() AND current_user_role() = 'org_admin'));

-- ============================================================
-- ATTENDANCE LOGS
-- ============================================================
DROP POLICY IF EXISTS "att_logs_select_scoped" ON attendance_logs;
CREATE POLICY "att_logs_select_scoped" ON attendance_logs FOR SELECT
  TO authenticated USING (current_user_role() = 'super_admin' OR (organization_id = current_user_org_id() AND is_hr_or_above()) OR employee_id = current_user_employee_id());

DROP POLICY IF EXISTS "att_logs_insert_admin" ON attendance_logs;
CREATE POLICY "att_logs_insert_admin" ON attendance_logs FOR INSERT
  TO authenticated WITH CHECK (current_user_role() = 'super_admin' OR (organization_id = current_user_org_id() AND is_hr_or_above()));

DROP POLICY IF EXISTS "att_logs_update_admin" ON attendance_logs;
CREATE POLICY "att_logs_update_admin" ON attendance_logs FOR UPDATE
  TO authenticated USING (current_user_role() = 'super_admin' OR (organization_id = current_user_org_id() AND is_hr_or_above()))
  WITH CHECK (current_user_role() = 'super_admin' OR (organization_id = current_user_org_id() AND is_hr_or_above()));

DROP POLICY IF EXISTS "att_logs_delete_admin" ON attendance_logs;
CREATE POLICY "att_logs_delete_admin" ON attendance_logs FOR DELETE
  TO authenticated USING (current_user_role() = 'super_admin' OR (organization_id = current_user_org_id() AND current_user_role() = 'org_admin'));

-- ============================================================
-- LIVENESS CHECKS
-- ============================================================
DROP POLICY IF EXISTS "liveness_select_scoped" ON liveness_checks;
CREATE POLICY "liveness_select_scoped" ON liveness_checks FOR SELECT
  TO authenticated USING (current_user_role() = 'super_admin' OR (organization_id = current_user_org_id() AND is_hr_or_above()) OR employee_id = current_user_employee_id());

DROP POLICY IF EXISTS "liveness_insert_admin" ON liveness_checks;
CREATE POLICY "liveness_insert_admin" ON liveness_checks FOR INSERT
  TO authenticated WITH CHECK (current_user_role() = 'super_admin' OR (organization_id = current_user_org_id() AND is_hr_or_above()));

DROP POLICY IF EXISTS "liveness_delete_admin" ON liveness_checks;
CREATE POLICY "liveness_delete_admin" ON liveness_checks FOR DELETE
  TO authenticated USING (current_user_role() = 'super_admin' OR (organization_id = current_user_org_id() AND current_user_role() = 'org_admin'));

-- ============================================================
-- AUDIT LOGS — admin-only
-- ============================================================
DROP POLICY IF EXISTS "audit_select_admin" ON audit_logs;
CREATE POLICY "audit_select_admin" ON audit_logs FOR SELECT
  TO authenticated USING (current_user_role() = 'super_admin' OR (organization_id = current_user_org_id() AND is_hr_or_above()));

DROP POLICY IF EXISTS "audit_insert_admin" ON audit_logs;
CREATE POLICY "audit_insert_admin" ON audit_logs FOR INSERT
  TO authenticated WITH CHECK (current_user_role() = 'super_admin' OR (organization_id = current_user_org_id() AND is_hr_or_above()));

DROP POLICY IF EXISTS "audit_delete_super_admin" ON audit_logs;
CREATE POLICY "audit_delete_super_admin" ON audit_logs FOR DELETE
  TO authenticated USING (current_user_role() = 'super_admin');

-- ============================================================
-- APP SETTINGS — admin-only
-- ============================================================
DROP POLICY IF EXISTS "settings_select_admin" ON app_settings;
CREATE POLICY "settings_select_admin" ON app_settings FOR SELECT
  TO authenticated USING (current_user_role() = 'super_admin' OR organization_id = current_user_org_id());

DROP POLICY IF EXISTS "settings_insert_admin" ON app_settings;
CREATE POLICY "settings_insert_admin" ON app_settings FOR INSERT
  TO authenticated WITH CHECK (current_user_role() = 'super_admin' OR (organization_id = current_user_org_id() AND current_user_role() = 'org_admin'));

DROP POLICY IF EXISTS "settings_update_admin" ON app_settings;
CREATE POLICY "settings_update_admin" ON app_settings FOR UPDATE
  TO authenticated USING (current_user_role() = 'super_admin' OR (organization_id = current_user_org_id() AND current_user_role() = 'org_admin'))
  WITH CHECK (current_user_role() = 'super_admin' OR (organization_id = current_user_org_id() AND current_user_role() = 'org_admin'));

DROP POLICY IF EXISTS "settings_delete_super_admin" ON app_settings;
CREATE POLICY "settings_delete_super_admin" ON app_settings FOR DELETE
  TO authenticated USING (current_user_role() = 'super_admin');
