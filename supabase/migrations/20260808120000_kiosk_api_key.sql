-- Per-organization kiosk API key so the attendance kiosk can mark attendance without a user login.
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS kiosk_api_key text UNIQUE;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS kiosk_key_rotated_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_organizations_kiosk_api_key ON organizations(kiosk_api_key);
-- The kiosk key is a bearer secret; never let a plain member read it. Only the
-- backend (service role, which bypasses column grants) can read it.
REVOKE SELECT (kiosk_api_key, kiosk_key_rotated_at) ON organizations FROM authenticated;
REVOKE SELECT (kiosk_api_key, kiosk_key_rotated_at) ON organizations FROM anon;
