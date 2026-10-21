-- FaceAttend v1.4 - dynamic people fields. Safe to run more than once.
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS org_type text NOT NULL DEFAULT 'company';
ALTER TABLE employees ALTER COLUMN email DROP NOT NULL;
CREATE INDEX IF NOT EXISTS idx_employees_metadata ON employees USING gin (metadata);

CREATE OR REPLACE FUNCTION public.handle_join_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_new_org text; v_domain text; v_full text; v_type text; v_slug text; v_org uuid;
BEGIN
  v_new_org := nullif(btrim(new.raw_user_meta_data->>'new_org_name'), '');
  v_domain  := lower(nullif(btrim(new.raw_user_meta_data->>'requested_domain'), ''));
  v_full    := nullif(btrim(new.raw_user_meta_data->>'full_name'), '');
  v_type    := lower(coalesce(nullif(btrim(new.raw_user_meta_data->>'org_type'), ''), 'company'));

  IF v_new_org IS NOT NULL THEN
    v_slug := lower(regexp_replace(v_new_org, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(md5(random()::text), 1, 6);
    BEGIN
      INSERT INTO public.organizations (name, slug, domain, org_type)
        VALUES (v_new_org, v_slug, v_domain, v_type) RETURNING id INTO v_org;
    EXCEPTION WHEN unique_violation THEN
      INSERT INTO public.organizations (name, slug, domain, org_type)
        VALUES (v_new_org, v_slug || substr(md5(random()::text), 1, 4), NULL, v_type) RETURNING id INTO v_org;
    END;
    INSERT INTO public.app_settings (organization_id) VALUES (v_org) ON CONFLICT (organization_id) DO NOTHING;
    INSERT INTO public.departments (organization_id, name) VALUES (v_org, 'General') ON CONFLICT (organization_id, name) DO NOTHING;
    INSERT INTO public.profiles (user_id, organization_id, role, full_name, email, status)
      VALUES (new.id, v_org, 'org_admin', coalesce(v_full, split_part(new.email, '@', 1)), new.email, 'active')
      ON CONFLICT (user_id) DO UPDATE SET organization_id = excluded.organization_id, role = 'org_admin', status = 'active';
    RETURN new;
  END IF;

  IF v_domain IS NOT NULL THEN
    SELECT id INTO v_org FROM public.organizations WHERE lower(domain) = v_domain LIMIT 1;
  END IF;
  INSERT INTO public.join_requests (user_id, email, full_name, requested_domain, organization_id, status)
    VALUES (new.id, new.email, v_full, v_domain, v_org, 'pending');
  RETURN new;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_join_request ON auth.users;
CREATE TRIGGER on_auth_user_join_request AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_join_request();
