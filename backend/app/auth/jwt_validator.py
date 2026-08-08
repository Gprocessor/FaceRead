"""Token validation via Supabase /auth/v1/user + auto-profile creation."""
import json, urllib.request, urllib.error
from fastapi import HTTPException, status, Request
from app.config import SUPABASE_URL, SUPABASE_ANON_KEY

def _extract_token(request: Request) -> str:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing or invalid Authorization header")
    return auth[7:]

def _validate_with_supabase(token: str) -> dict:
    if not SUPABASE_URL: raise HTTPException(status_code=500, detail="SUPABASE_URL not configured")
    if not SUPABASE_ANON_KEY: raise HTTPException(status_code=500, detail="SUPABASE_ANON_KEY not configured")
    apikey = SUPABASE_ANON_KEY
    req = urllib.request.Request(f"{SUPABASE_URL}/auth/v1/user")
    req.add_header("Authorization", f"Bearer {token}"); req.add_header("apikey", apikey)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate token")

def validate_jwt(request: Request) -> dict:
    user = _validate_with_supabase(_extract_token(request))
    uid = user.get("id")
    if not uid: raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token missing user ID")
    meta = user.get("user_metadata") or {}
    return {"sub": uid, "email": user.get("email", ""), "full_name": meta.get("full_name"), "role": user.get("role", "authenticated")}

def get_user_id(request: Request) -> str: return validate_jwt(request)["sub"]

def _ensure_profile(uid: str, email: str, full_name: str | None) -> dict:
    from app.database.supabase_client import get_supabase
    sb = get_supabase()
    res = sb.table("profiles").select("*").eq("user_id", uid).maybe_single().execute()
    if res.data: return res.data
    ins = sb.table("profiles").insert({"user_id": uid, "email": email, "full_name": full_name or (email.split("@")[0] if email else "New User"), "role": "employee", "status": "active"}).execute()
    return ins.data[0] if ins.data else {"user_id": uid, "email": email, "full_name": full_name, "role": "employee", "organization_id": None, "status": "active"}

def get_user_profile(request: Request) -> dict:
    payload = validate_jwt(request); uid = payload["sub"]
    profile = _ensure_profile(uid, payload.get("email", ""), payload.get("full_name"))
    if profile.get("status") not in (None, "active"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is not active")
    return {"user_id": uid, "email": payload.get("email", profile.get("email", "")), "role": profile.get("role", "employee"), "organization_id": profile.get("organization_id"), "full_name": profile.get("full_name")}
