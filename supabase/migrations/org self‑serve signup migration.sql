/*
  # Per-organization self-serve signup (replaces shared default-org behavior)

  Every new auth user now gets their OWN organization, fully provisioned with
  everything needed to run the app:
    - organizations           (the tenant)
    - app_settings            (default attendance rules / thresholds)
    - departments             (a starter "General" department)
    - profiles                (the signer becomes that org's org_admin)

  The organization name comes from raw_user_meta_data->>'organization_name'
  (sent by the sign-up form). If it's missing we derive a personal org name so
  the account is still fully functional.

  This REPLACES public.handle_new_user() from 20260803160000. Existing users
  are left untouched.
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_name  text;
  v_full_name text;
  v_slug      text;
  v_org_id    uuid;
BEGIN
  v_org_name  := NULLIF(btrim(NEW.raw_user_meta_data->>'organization_name'), '');
  v_full_name := COALESCE(NULLIF(btrim(NEW.raw_user_meta_data->>'full_name'), ''),
                          split_part(NEW.email, '@', 1));

  -- Derive a personal org name if none was supplied.
  IF v_org_name IS NULL THEN
    v_org_name := v_full_name || '''s Organization';
  END IF;

  -- Build a URL-safe unique slug: "acme-factory-1a2b3c4d".
  v_slug := lower(regexp_replace(v_org_name, '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := btrim(v_slug, '-');
  IF v_slug = '' THEN v_slug := 'org'; END IF;
  v_slug := v_slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

  -- 1) The organization (tenant).
  INSERT INTO public.organizations (name, slug)
  VALUES (v_org_name, v_slug)
  RETURNING id INTO v_org_id;

  -- 2) Default attendance settings for that org.
  INSERT INTO public.app_settings (organization_id)
  VALUES (v_org_id)
  ON CONFLICT (organization_id) DO NOTHING;

  -- 3) A starter department so People can be assigned immediately.
  INSERT INTO public.departments (organization_id, name)
  VALUES (v_org_id, 'General')
  ON CONFLICT (organization_id, name) DO NOTHING;

  -- 4) The signer becomes this organization's admin.
  INSERT INTO public.profiles (user_id, organization_id, role, full_name, email, status)
  VALUES (NEW.id, v_org_id, 'org_admin', v_full_name, NEW.email, 'active')
  ON CONFLICT (user_id) DO UPDATE
    SET organization_id = EXCLUDED.organization_id,
        role            = 'org_admin',
        full_name       = EXCLUDED.full_name,
        status          = 'active';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

/*
  Optional cleanup for any EXISTING accounts still lacking an org (e.g. created
  before this migration). Gives each one a personal org so nothing is stranded.
*/
DO $$
DECLARE
  r RECORD;
  v_org_id uuid;
  v_slug text;
BEGIN
  FOR r IN
    SELECT p.id AS profile_id, p.user_id, p.full_name, p.email
    FROM public.profiles p
    WHERE p.organization_id IS NULL
  LOOP
    v_slug := 'org-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
    INSERT INTO public.organizations (name, slug)
    VALUES (COALESCE(NULLIF(btrim(r.full_name), ''), split_part(r.email, '@', 1)) || '''s Organization', v_slug)
    RETURNING id INTO v_org_id;

    INSERT INTO public.app_settings (organization_id) VALUES (v_org_id)
    ON CONFLICT (organization_id) DO NOTHING;
    INSERT INTO public.departments (organization_id, name) VALUES (v_org_id, 'General')
    ON CONFLICT (organization_id, name) DO NOTHING;

    UPDATE public.profiles
    SET organization_id = v_org_id, role = 'org_admin', status = 'active'
    WHERE id = r.profile_id;
  END LOOP;
END $$;
