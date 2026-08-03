/*
  # Auto-Profile Trigger + First-Org Bootstrap  (FIXES BUG #1)

  Bug #1: "Create account creates a Supabase auth user but no profile."
  This migration adds a trigger so that EVERY new auth.users row automatically
  gets a matching public.profiles row. It also bootstraps a default
  organization + app_settings, links the very first signup as org_admin, and
  gives every profile without an org a membership to that default org.
*/

-- 1. Trigger function: create a profile whenever an auth user is created.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  default_org uuid;
  existing_users int;
  assigned_role user_role;
BEGIN
  -- Ensure a default organization exists.
  SELECT id INTO default_org FROM public.organizations WHERE slug = 'default-org' LIMIT 1;
  IF default_org IS NULL THEN
    INSERT INTO public.organizations (name, slug) VALUES ('Default Organization', 'default-org')
    RETURNING id INTO default_org;
  END IF;

  -- Ensure app_settings exist for the default org.
  INSERT INTO public.app_settings (organization_id) VALUES (default_org)
  ON CONFLICT (organization_id) DO NOTHING;

  -- First-ever user becomes org_admin; everyone else is an employee.
  SELECT count(*) INTO existing_users FROM public.profiles;
  IF existing_users = 0 THEN
    assigned_role := 'org_admin';
  ELSE
    assigned_role := 'employee';
  END IF;

  INSERT INTO public.profiles (user_id, organization_id, role, full_name, email, status)
  VALUES (
    NEW.id,
    default_org,
    assigned_role,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    'active'
  )
  ON CONFLICT (user_id) DO UPDATE
    SET email = EXCLUDED.email,
        organization_id = COALESCE(public.profiles.organization_id, EXCLUDED.organization_id),
        status = 'active';

  RETURN NEW;
END;
$$;

-- 2. Attach the trigger to auth.users.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Backfill: create profiles for any EXISTING auth users that lack one,
--    and link any org-less profiles to the default organization.
DO $$
DECLARE
  default_org uuid;
BEGIN
  SELECT id INTO default_org FROM public.organizations WHERE slug = 'default-org' LIMIT 1;
  IF default_org IS NULL THEN
    INSERT INTO public.organizations (name, slug) VALUES ('Default Organization', 'default-org')
    RETURNING id INTO default_org;
  END IF;

  INSERT INTO public.app_settings (organization_id) VALUES (default_org)
  ON CONFLICT (organization_id) DO NOTHING;

  -- Create missing profiles for existing users.
  INSERT INTO public.profiles (user_id, organization_id, role, full_name, email, status)
  SELECT u.id, default_org, 'employee',
         COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
         u.email, 'active'
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.user_id = u.id
  WHERE p.user_id IS NULL
  ON CONFLICT (user_id) DO NOTHING;

  -- Link any org-less profiles to the default org.
  UPDATE public.profiles SET organization_id = default_org WHERE organization_id IS NULL;

  -- Promote the earliest-created profile to org_admin if none exists.
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE role IN ('org_admin','super_admin')) THEN
    UPDATE public.profiles
    SET role = 'org_admin'
    WHERE id = (SELECT id FROM public.profiles ORDER BY created_at ASC LIMIT 1);
  END IF;
END $$;
