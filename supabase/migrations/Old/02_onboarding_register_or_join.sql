-- ============================================================================
-- First-launch onboarding.
--   * Register a NEW organization  -> metadata.new_org_name set:
--       creates the org (+ settings + "General" dept) and makes this user its
--       org_admin immediately (active, no approval needed).
--   * Join an EXISTING organization -> metadata.requested_domain set:
--       files a PENDING join_request for an admin to approve.
-- Replaces handle_join_request from the earlier migration.
-- ============================================================================
create or replace function public.handle_join_request()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_new_org text;
  v_domain  text;
  v_full    text;
  v_slug    text;
  v_org     uuid;
begin
  v_new_org := nullif(btrim(new.raw_user_meta_data->>'new_org_name'), '');
  v_domain  := lower(nullif(btrim(new.raw_user_meta_data->>'requested_domain'), ''));
  v_full    := nullif(btrim(new.raw_user_meta_data->>'full_name'), '');

  -- (a) REGISTER a brand-new organization -> this user becomes its admin.
  if v_new_org is not null then
    v_slug := lower(regexp_replace(v_new_org, '[^a-zA-Z0-9]+', '-', 'g'))
              || '-' || substr(md5(random()::text), 1, 6);
    begin
      insert into public.organizations (name, slug, domain)
        values (v_new_org, v_slug, v_domain)
        returning id into v_org;
    exception when unique_violation then
      insert into public.organizations (name, slug, domain)
        values (v_new_org, v_slug || substr(md5(random()::text), 1, 4), null)
        returning id into v_org;
    end;

    insert into public.app_settings (organization_id) values (v_org)
      on conflict (organization_id) do nothing;
    insert into public.departments (organization_id, name) values (v_org, 'General')
      on conflict (organization_id, name) do nothing;
    insert into public.profiles (user_id, organization_id, role, full_name, email, status)
      values (new.id, v_org, 'org_admin',
              coalesce(v_full, split_part(new.email, '@', 1)), new.email, 'active')
      on conflict (user_id) do update
        set organization_id = excluded.organization_id, role = 'org_admin', status = 'active';
    return new;
  end if;

  -- (b) JOIN an existing organization by domain -> pending request for approval.
  if v_domain is not null then
    select id into v_org from public.organizations where lower(domain) = v_domain limit 1;
  end if;

  insert into public.join_requests (user_id, email, full_name, requested_domain, organization_id, status)
    values (new.id, new.email, v_full, v_domain, v_org, 'pending');
  return new;
end; $$;

drop trigger if exists on_auth_user_join_request on auth.users;
create trigger on_auth_user_join_request
  after insert on auth.users for each row
  execute function public.handle_join_request();
