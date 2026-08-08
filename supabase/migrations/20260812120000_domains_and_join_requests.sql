/* Domain-based onboarding: no auto org/profile on sign-up. Admin approves. */
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS domain text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_domain ON organizations(lower(domain)) WHERE domain IS NOT NULL;
DO $$ BEGIN CREATE TYPE join_request_status AS ENUM ('pending','approved','rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TABLE IF NOT EXISTS join_requests (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, email text, full_name text, requested_domain text, organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE, requested_new_org_name text, status join_request_status NOT NULL DEFAULT 'pending', decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL, decided_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE join_requests ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_jr_org ON join_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_jr_user ON join_requests(user_id);
DROP POLICY IF EXISTS "jr_sel" ON join_requests;
CREATE POLICY "jr_sel" ON join_requests FOR SELECT TO authenticated USING (user_id=auth.uid() OR (organization_id=current_user_org_id() AND current_user_role() IN ('super_admin','org_admin','hr_officer')));
CREATE OR REPLACE FUNCTION public.handle_join_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_domain text; v_org uuid; v_new text;
BEGIN
  v_domain := lower(NULLIF(btrim(NEW.raw_user_meta_data->>'requested_domain'),''));
  v_new := NULLIF(btrim(NEW.raw_user_meta_data->>'new_org_name'),'');
  IF v_domain IS NOT NULL THEN SELECT id INTO v_org FROM public.organizations WHERE lower(domain)=v_domain LIMIT 1; END IF;
  INSERT INTO public.join_requests (user_id, email, full_name, requested_domain, organization_id, requested_new_org_name, status)
  VALUES (NEW.id, NEW.email, NULLIF(btrim(NEW.raw_user_meta_data->>'full_name'),''), v_domain, v_org, v_new, 'pending');
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS on_auth_user_join_request ON auth.users;
CREATE TRIGGER on_auth_user_join_request AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_join_request();
