/* Auto-Profile Trigger + Bootstrap (fixes: sign-up creates no profile). */
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE default_org uuid; existing_users int; assigned_role user_role;
BEGIN
  SELECT id INTO default_org FROM public.organizations WHERE slug = 'default-org' LIMIT 1;
  IF default_org IS NULL THEN INSERT INTO public.organizations (name, slug) VALUES ('Default Organization', 'default-org') RETURNING id INTO default_org; END IF;
  INSERT INTO public.app_settings (organization_id) VALUES (default_org) ON CONFLICT (organization_id) DO NOTHING;
  SELECT count(*) INTO existing_users FROM public.profiles;
  IF existing_users = 0 THEN assigned_role := 'org_admin'; ELSE assigned_role := 'employee'; END IF;
  INSERT INTO public.profiles (user_id, organization_id, role, full_name, email, status)
  VALUES (NEW.id, default_org, assigned_role, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)), NEW.email, 'active')
  ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email, organization_id = COALESCE(public.profiles.organization_id, EXCLUDED.organization_id), status = 'active';
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
DO $$
DECLARE default_org uuid;
BEGIN
  SELECT id INTO default_org FROM public.organizations WHERE slug = 'default-org' LIMIT 1;
  IF default_org IS NULL THEN INSERT INTO public.organizations (name, slug) VALUES ('Default Organization', 'default-org') RETURNING id INTO default_org; END IF;
  INSERT INTO public.app_settings (organization_id) VALUES (default_org) ON CONFLICT (organization_id) DO NOTHING;
  INSERT INTO public.profiles (user_id, organization_id, role, full_name, email, status)
  SELECT u.id, default_org, 'employee', COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)), u.email, 'active'
  FROM auth.users u LEFT JOIN public.profiles p ON p.user_id = u.id WHERE p.user_id IS NULL
  ON CONFLICT (user_id) DO NOTHING;
  UPDATE public.profiles SET organization_id = default_org WHERE organization_id IS NULL;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE role IN ('org_admin','super_admin')) THEN
    UPDATE public.profiles SET role = 'org_admin' WHERE id = (SELECT id FROM public.profiles ORDER BY created_at ASC LIMIT 1);
  END IF;
END $$;
