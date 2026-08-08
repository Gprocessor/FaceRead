"""Kiosk device auth: a shared per-organization secret instead of a user login.

The attendance kiosk screen has no logged-in user - a physical device sits at
the entrance and anyone can walk up to it. Instead of a Supabase user JWT, the
device presents a per-organization API key (generated once by an admin in
Settings) via the X-Kiosk-Key header. This scopes the device to exactly one
organization without requiring anyone to sign in to mark attendance.
"""
from fastapi import HTTPException, Request, status
from app.database.supabase_client import get_supabase


def get_kiosk_organization_id(request: Request) -> str:
    key = request.headers.get("X-Kiosk-Key", "").strip()
    if not key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing X-Kiosk-Key header")
    sb = get_supabase()
    r = sb.table("organizations").select("id, status").eq("kiosk_api_key", key).maybe_single().execute()
    if not r.data:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid kiosk key")
    if r.data.get("status") != "active":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization is not active")
    return r.data["id"]
