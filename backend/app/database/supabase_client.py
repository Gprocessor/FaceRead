"""
Supabase client — uses the service role key to bypass RLS for server-side
operations (writing attendance logs, reading face profiles, audit trails).
The service role key NEVER leaves this backend.
"""
from supabase import create_client, Client

from app.config import SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

_client: Client | None = None


def get_supabase() -> Client:
    """Return the singleton Supabase client (service role)."""
    global _client
    if _client is None:
        if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
            raise RuntimeError(
                "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars"
            )
        _client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    return _client
