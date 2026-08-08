ALTER TABLE organizations ADD COLUMN IF NOT EXISTS kiosk_api_key text UNIQUE;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS kiosk_key_rotated_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_org_kiosk ON organizations(kiosk_api_key);
REVOKE SELECT (kiosk_api_key, kiosk_key_rotated_at) ON organizations FROM authenticated;
REVOKE SELECT (kiosk_api_key, kiosk_key_rotated_at) ON organizations FROM anon;
