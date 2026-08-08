import time, uuid, json
from fastapi import APIRouter, Request, UploadFile, File, Form, HTTPException
from app.auth.jwt_validator import get_user_profile
from app.auth.kiosk import get_kiosk_organization_id
from app.face.liveness import get_random_challenge, analyze_frames
from app.database.supabase_client import get_supabase
from app.utils.security import rate_limiter
router = APIRouter()
_sessions: dict[str, dict] = {}
TTL=5*60
def _new(owner_type, owner_id, ct):
    sid=str(uuid.uuid4()); _sessions[sid]={"owner_type":owner_type,"owner_id":owner_id,"challenge_type":ct,"passed":False,"liveness_score":0.0,"used":False,"created_at":time.time()}; return sid
def consume_liveness_session(sid, owner_type, owner_id):
    s=_sessions.get(sid)
    if not s or s["owner_type"]!=owner_type or s["owner_id"]!=owner_id or s.get("used") or not s.get("passed"): return None
    if time.time()-s["created_at"]>TTL: _sessions.pop(sid,None); return None
    s["used"]=True; return s
async def _run(sid, frames, di, org_for_log, emp_for_log):
    s=_sessions.get(sid)
    if not s: raise HTTPException(status_code=400, detail="Invalid or expired liveness session")
    if time.time()-s["created_at"]>TTL: _sessions.pop(sid,None); raise HTTPException(status_code=400, detail="Liveness session expired")
    ct=s["challenge_type"]; fb=[]
    for f in frames:
        d=await f.read()
        if d: fb.append(d)
    res=analyze_frames(fb,ct); s["passed"]=res["passed"]; s["liveness_score"]=res["liveness_score"]
    try:
        if org_for_log: get_supabase().table("liveness_checks").insert({"organization_id":org_for_log,"employee_id":emp_for_log,"challenge_type":ct,"liveness_score":res["liveness_score"],"passed":res["passed"],"failure_reason":res["failure_reason"],"frame_count":res["frame_count"],"processing_time_ms":res["processing_time_ms"],"device_info":json.loads(di) if di else {}}).execute()
    except Exception: pass
    return {**res, "challenge_type":ct, "session_id":sid}
@router.post("/api/liveness/challenge")
async def challenge(request: Request):
    p=get_user_profile(request)
    if not rate_limiter.check(f"lc:{p['user_id']}"): raise HTTPException(status_code=429, detail="Too many requests")
    ch=get_random_challenge(); return {**ch, "session_id":_new("user",p["user_id"],ch["challenge_type"])}
@router.post("/api/liveness/check")
async def check(request: Request, session_id: str = Form(...), challenge_type: str = Form(...), frames: list[UploadFile] = File(...), device_info: str = Form("")):
    p=get_user_profile(request); s=_sessions.get(session_id)
    if not s or s["owner_type"]!="user" or s["owner_id"]!=p["user_id"]: raise HTTPException(status_code=400, detail="Invalid session")
    sb=get_supabase(); emp=sb.table("employees").select("id").eq("user_id",p["user_id"]).maybe_single().execute()
    return await _run(session_id, frames, device_info, p.get("organization_id") if emp.data else None, emp.data["id"] if emp.data else None)
@router.post("/api/kiosk/liveness/challenge")
async def kiosk_challenge(request: Request):
    org=get_kiosk_organization_id(request); ip=request.client.host if request.client else "?"
    if not rate_limiter.check(f"klc:{org}:{ip}"): raise HTTPException(status_code=429, detail="Too many requests")
    ch=get_random_challenge(); return {**ch, "session_id":_new("kiosk",org,ch["challenge_type"])}
@router.post("/api/kiosk/liveness/check")
async def kiosk_check(request: Request, session_id: str = Form(...), challenge_type: str = Form(...), frames: list[UploadFile] = File(...), device_info: str = Form("")):
    org=get_kiosk_organization_id(request); s=_sessions.get(session_id)
    if not s or s["owner_type"]!="kiosk" or s["owner_id"]!=org: raise HTTPException(status_code=400, detail="Invalid session")
    return await _run(session_id, frames, device_info, None, None)
