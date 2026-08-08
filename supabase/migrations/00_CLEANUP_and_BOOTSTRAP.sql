/* Run PART A once to wipe old data. Then create your admin user in
   Auth → Users, edit PART B values and run it to make the first org+admin. */

-- ===== PART A: cleanup (irreversible; keeps auth.users + roles) =====
-- TRUNCATE TABLE join_requests, liveness_checks, attendance_logs, attendance_sessions,
--   face_enrollment_sessions, face_profiles, consent_records, employees, departments,
--   audit_logs, app_settings, profiles, organizations RESTART IDENTITY CASCADE;

-- ===== PART B: bootstrap your first organization + admin =====
-- DO $$
-- DECLARE v_email text := 'you@company.com'; v_org text := 'My Organization'; v_domain text := 'company.com'; v_uid uuid; v_id uuid;
-- BEGIN
--   SELECT id INTO v_uid FROM auth.users WHERE email = v_email;
--   IF v_uid IS NULL THEN RAISE EXCEPTION 'No auth user %', v_email; END IF;
--   INSERT INTO organizations (name, slug, domain) VALUES (v_org, lower(regexp_replace(v_org,'[^a-zA-Z0-9]+','-','g'))||'-'||substr(md5(random()::text),1,6), v_domain) RETURNING id INTO v_id;
--   INSERT INTO app_settings (organization_id) VALUES (v_id) ON CONFLICT DO NOTHING;
--   INSERT INTO departments (organization_id, name) VALUES (v_id, 'General') ON CONFLICT DO NOTHING;
--   INSERT INTO profiles (user_id, organization_id, role, full_name, email, status)
--   VALUES (v_uid, v_id, 'org_admin', split_part(v_email,'@',1), v_email, 'active')
--   ON CONFLICT (user_id) DO UPDATE SET organization_id=v_id, role='org_admin', status='active';
--   DELETE FROM join_requests WHERE user_id = v_uid;
-- END $$;
