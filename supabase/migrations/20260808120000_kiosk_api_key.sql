-- Adds a per-organization kiosk API key so the attendance kiosk screen can
-- mark attendance without any user login. The key is a shared secret an
-- admin generates once in Settings and enters on the kiosk device.
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS kiosk_api_key text UNIQUE;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS kiosk_key_rotated_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_organizations_kiosk_api_key ON organizations(kiosk_api_key);

-- The existing "org_select" RLS policy lets any authenticated member of an
-- organization SELECT that organization's row. That's fine for name/slug,
-- but the kiosk key is a bearer secret that lets a device mark attendance
-- for the whole org - it must never be readable by a plain employee's own
-- session. Revoking column-level SELECT for the anon/authenticated roles
-- means only the backend (service role, which bypasses table grants) can
-- ever read it; row-level policies alone can't express this per-column.
REVOKE SELECT (kiosk_api_key, kiosk_key_rotated_at) ON organizations FROM authenticated;
REVOKE SELECT (kiosk_api_key, kiosk_key_rotated_at) ON organizations FROM anon;
