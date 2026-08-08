import secrets
from fastapi import APIRouter, Request, HTTPException
from app.auth.jwt_validator import get_user_profile
from app.auth.permissions import check_permission
from app.database.supabase_client import get_supabase
from app.utils.audit import log_audit
router = APIRouter()
@router.get("/api/admin/kiosk-key")
async def get_kiosk_key_status(request: Request):
    profile = get_user_profile(request)
    check_permission(profile, "super_admin", "org_admin")
    if not profile.get("organization_id"):
        raise HTTPException(status_code=400, detail="Your account has no organization assigned")
    sb = get_supabase()
    r = sb.table("organizations").select("kiosk_api_key, kiosk_key_rotated_at").eq("id", profile["organization_id"]).maybe_single().execute()
    d = r.data or {}
    return {"configured": bool(d.get("kiosk_api_key")), "rotated_at": d.get("kiosk_key_rotated_at")}
@router.post("/api/admin/kiosk-key/rotate")
async def rotate_kiosk_key(request: Request):
    profile = get_user_profile(request)
    check_permission(profile, "super_admin", "org_admin")
    if not profile.get("organization_id"):
        raise HTTPException(status_code=400, detail="Your account has no organization assigned")
    sb = get_supabase()
    new_key = secrets.token_urlsafe(32)
    sb.table("organizations").update({"kiosk_api_key": new_key, "kiosk_key_rotated_at": "now()"}).eq("id", profile["organization_id"]).execute()
    log_audit(profile["organization_id"], profile["user_id"], profile["role"], "kiosk_key_rotated")
    return {"kiosk_api_key": new_key}
