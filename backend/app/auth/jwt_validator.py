import json, urllib.request, urllib.error
from fastapi import HTTPException, status, Request
from app.config import SUPABASE_URL, SUPABASE_ANON_KEY
def _extract(request):
    a=request.headers.get("Authorization","")
    if not a.startswith("Bearer "): raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    return a[7:]
def _validate(token):
    if not SUPABASE_URL or not SUPABASE_ANON_KEY: raise HTTPException(status_code=500, detail="Supabase not configured")
    req=urllib.request.Request(f"{SUPABASE_URL}/auth/v1/user"); req.add_header("Authorization",f"Bearer {token}"); req.add_header("apikey",SUPABASE_ANON_KEY)
    try:
        with urllib.request.urlopen(req, timeout=10) as r: return json.loads(r.read().decode())
    except urllib.error.HTTPError: raise HTTPException(status_code=401, detail="Invalid or expired token")
    except Exception: raise HTTPException(status_code=401, detail="Could not validate token")
def validate_jwt(request):
    u=_validate(_extract(request)); uid=u.get("id")
    if not uid: raise HTTPException(status_code=401, detail="Token missing user ID")
    m=u.get("user_metadata") or {}
    return {"sub":uid,"email":u.get("email",""),"full_name":m.get("full_name"),"role":u.get("role","authenticated")}
def get_user_id(request): return validate_jwt(request)["sub"]
def get_user_profile(request):
    p=validate_jwt(request); uid=p["sub"]
    from app.database.supabase_client import get_supabase
    sb=get_supabase(); res=sb.table("profiles").select("*").eq("user_id",uid).maybe_single().execute()
    profile=res.data
    if not profile: raise HTTPException(status_code=403, detail="No organization membership yet. Ask an admin to approve your access request.")
    if profile.get("status") not in (None,"active"): raise HTTPException(status_code=403, detail="Account is not active")
    return {"user_id":uid,"email":p.get("email",profile.get("email","")),"role":profile.get("role","employee"),"organization_id":profile.get("organization_id"),"full_name":profile.get("full_name")}
