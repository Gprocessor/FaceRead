/*
  # RLS Policies — 5-tier role hierarchy, org-scoped isolation.
  anon has NO access; service role bypasses RLS (Python backend only).
*/

CREATE OR REPLACE FUNCTION public.current_user_org_id() RETURNS uuid AS $$
  SELECT organization_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.current_user_role() RETURNS user_role AS $$
  SELECT role FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.current_user_employee_id() RETURNS uuid AS $$
  SELECT id FROM public.employees WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_hr_or_above() RETURNS boolean AS $$
  SELECT current_user_role() IN ('super_admin','org_admin','hr_officer');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ORGANIZATIONS
DROP POLICY IF EXISTS "org_select_own" ON organizations;
CREATE POLICY "org_select_own" ON organizations FOR SELECT TO authenticated
  USING (current_user_role() = 'super_admin' OR id = current_user_org_id());
DROP POLICY IF EXISTS "org_manage" ON organizations;
CREATE POLICY "org_manage" ON organizations FOR ALL TO authenticated
  USING (current_user_role() = 'super_admin' OR (id = current_user_org_id() AND current_user_role() = 'org_admin'))
  WITH CHECK (current_user_role() = 'super_admin' OR (id = current_user_org_id() AND current_user_role() = 'org_admin'));

-- ROLES
DROP POLICY IF EXISTS "roles_select_all" ON roles;
CREATE POLICY "roles_select_all" ON roles FOR SELECT TO authenticated USING (true);

-- PROFILES
DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR current_user_role() = 'super_admin' OR (organization_id = current_user_org_id() AND is_hr_or_above()));
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
CREATE POLICY "profiles_insert" ON profiles FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR (organization_id = current_user_org_id() AND is_hr_or_above()) OR current_user_role() = 'super_admin');
DROP POLICY IF EXISTS "profiles_update" ON profiles;
CREATE POLICY "profiles_update" ON profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR current_user_role() = 'super_admin' OR (organization_id = current_user_org_id() AND is_hr_or_above()))
  WITH CHECK (user_id = auth.uid() OR current_user_role() = 'super_admin' OR (organization_id = current_user_org_id() AND is_hr_or_above()));

-- DEPARTMENTS
DROP POLICY IF EXISTS "dept_select" ON departments;
CREATE POLICY "dept_select" ON departments FOR SELECT TO authenticated
  USING (current_user_role() = 'super_admin' OR organization_id = current_user_org_id());
DROP POLICY IF EXISTS "dept_manage" ON departments;
CREATE POLICY "dept_manage" ON departments FOR ALL TO authenticated
  USING (current_user_role() = 'super_admin' OR (organization_id = current_user_org_id() AND is_hr_or_above()))
  WITH CHECK (current_user_role() = 'super_admin' OR (organization_id = current_user_org_id() AND is_hr_or_above()));

-- EMPLOYEES
DROP POLICY IF EXISTS "emp_select" ON employees;
CREATE POLICY "emp_select" ON employees FOR SELECT TO authenticated
  USING (current_user_role() = 'super_admin' OR organization_id = current_user_org_id());
DROP POLICY IF EXISTS "emp_manage" ON employees;
CREATE POLICY "emp_manage" ON employees FOR ALL TO authenticated
  USING (current_user_role() = 'super_admin' OR (organization_id = current_user_org_id() AND is_hr_or_above()))
  WITH CHECK (current_user_role() = 'super_admin' OR (organization_id = current_user_org_id() AND is_hr_or_above()));

-- CONSENT
DROP POLICY IF EXISTS "consent_select" ON consent_records;
CREATE POLICY "consent_select" ON consent_records FOR SELECT TO authenticated
  USING (current_user_role() = 'super_admin' OR (organization_id = current_user_org_id() AND is_hr_or_above()) OR employee_id = current_user_employee_id());
DROP POLICY IF EXISTS "consent_manage" ON consent_records;
CREATE POLICY "consent_manage" ON consent_records FOR ALL TO authenticated
  USING (current_user_role() = 'super_admin' OR (organization_id = current_user_org_id() AND is_hr_or_above()))
  WITH CHECK (current_user_role() = 'super_admin' OR (organization_id = current_user_org_id() AND is_hr_or_above()));

-- FACE PROFILES (admin-only)
DROP POLICY IF EXISTS "face_admin" ON face_profiles;
CREATE POLICY "face_admin" ON face_profiles FOR ALL TO authenticated
  USING (current_user_role() = 'super_admin' OR (organization_id = current_user_org_id() AND is_hr_or_above()))
  WITH CHECK (current_user_role() = 'super_admin' OR (organization_id = current_user_org_id() AND is_hr_or_above()));

-- ENROLLMENT SESSIONS
DROP POLICY IF EXISTS "enroll_admin" ON face_enrollment_sessions;
CREATE POLICY "enroll_admin" ON face_enrollment_sessions FOR ALL TO authenticated
  USING (current_user_role() = 'super_admin' OR (organization_id = current_user_org_id() AND is_hr_or_above()))
  WITH CHECK (current_user_role() = 'super_admin' OR (organization_id = current_user_org_id() AND is_hr_or_above()));

-- ATTENDANCE SESSIONS
DROP POLICY IF EXISTS "att_sessions_select" ON attendance_sessions;
CREATE POLICY "att_sessions_select" ON attendance_sessions FOR SELECT TO authenticated
  USING (current_user_role() = 'super_admin' OR (organization_id = current_user_org_id() AND is_hr_or_above()) OR employee_id = current_user_employee_id());
DROP POLICY IF EXISTS "att_sessions_manage" ON attendance_sessions;
CREATE POLICY "att_sessions_manage" ON attendance_sessions FOR ALL TO authenticated
  USING (current_user_role() = 'super_admin' OR (organization_id = current_user_org_id() AND is_hr_or_above()))
  WITH CHECK (current_user_role() = 'super_admin' OR (organization_id = current_user_org_id() AND is_hr_or_above()));

-- ATTENDANCE LOGS
DROP POLICY IF EXISTS "att_logs_select" ON attendance_logs;
CREATE POLICY "att_logs_select" ON attendance_logs FOR SELECT TO authenticated
  USING (current_user_role() = 'super_admin' OR (organization_id = current_user_org_id() AND is_hr_or_above()) OR employee_id = current_user_employee_id());
DROP POLICY IF EXISTS "att_logs_manage" ON attendance_logs;
CREATE POLICY "att_logs_manage" ON attendance_logs FOR ALL TO authenticated
  USING (current_user_role() = 'super_admin' OR (organization_id = current_user_org_id() AND is_hr_or_above()))
  WITH CHECK (current_user_role() = 'super_admin' OR (organization_id = current_user_org_id() AND is_hr_or_above()));

-- LIVENESS
DROP POLICY IF EXISTS "liveness_select" ON liveness_checks;
CREATE POLICY "liveness_select" ON liveness_checks FOR SELECT TO authenticated
  USING (current_user_role() = 'super_admin' OR (organization_id = current_user_org_id() AND is_hr_or_above()) OR employee_id = current_user_employee_id());
DROP POLICY IF EXISTS "liveness_manage" ON liveness_checks;
CREATE POLICY "liveness_manage" ON liveness_checks FOR ALL TO authenticated
  USING (current_user_role() = 'super_admin' OR (organization_id = current_user_org_id() AND is_hr_or_above()))
  WITH CHECK (current_user_role() = 'super_admin' OR (organization_id = current_user_org_id() AND is_hr_or_above()));

-- AUDIT LOGS (admin-only)
DROP POLICY IF EXISTS "audit_select" ON audit_logs;
CREATE POLICY "audit_select" ON audit_logs FOR SELECT TO authenticated
  USING (current_user_role() = 'super_admin' OR (organization_id = current_user_org_id() AND is_hr_or_above()));
DROP POLICY IF EXISTS "audit_insert" ON audit_logs;
CREATE POLICY "audit_insert" ON audit_logs FOR INSERT TO authenticated
  WITH CHECK (current_user_role() = 'super_admin' OR (organization_id = current_user_org_id() AND is_hr_or_above()));

-- APP SETTINGS
DROP POLICY IF EXISTS "settings_select" ON app_settings;
CREATE POLICY "settings_select" ON app_settings FOR SELECT TO authenticated
  USING (current_user_role() = 'super_admin' OR organization_id = current_user_org_id());
DROP POLICY IF EXISTS "settings_manage" ON app_settings;
CREATE POLICY "settings_manage" ON app_settings FOR ALL TO authenticated
  USING (current_user_role() = 'super_admin' OR (organization_id = current_user_org_id() AND current_user_role() = 'org_admin'))
  WITH CHECK (current_user_role() = 'super_admin' OR (organization_id = current_user_org_id() AND current_user_role() = 'org_admin'));
