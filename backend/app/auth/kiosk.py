from fastapi import HTTPException, Request

from app.database.supabase_client import get_supabase


def get_kiosk_organization_id(request: Request) -> str:
    key = request.headers.get("X-Kiosk-Key", "").strip()
    if not key:
        raise HTTPException(status_code=401, detail="Missing X-Kiosk-Key header")
    sb = get_supabase()
    r = sb.table("organizations").select("id, status").eq("kiosk_api_key", key).maybe_single().execute()
    data = getattr(r, "data", None)
    if not data:
        raise HTTPException(status_code=401, detail="Invalid kiosk key")
    if data.get("status") != "active":
        raise HTTPException(status_code=403, detail="Organization is not active")
    return data["id"]
