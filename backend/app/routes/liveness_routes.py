import time, uuid, json
from fastapi import APIRouter, Request, UploadFile, File, Form, HTTPException
from app.auth.jwt_validator import get_user_profile
from app.auth.kiosk import get_kiosk_organization_id
from app.face.liveness import get_random_challenge, analyze_frames
from app.database.supabase_client import get_supabase
from app.utils.security import rate_limiter
router = APIRouter()
_liveness_sessions: dict[str, dict] = {}
SESSION_TTL_SECONDS = 5 * 60
def _new_session(owner_type, owner_id, challenge_type):
    sid = str(uuid.uuid4())
    _liveness_sessions[sid] = {"owner_type": owner_type, "owner_id": owner_id, "challenge_type": challenge_type, "passed": False, "liveness_score": 0.0, "used": False, "created_at": time.time()}
    return sid
def consume_liveness_session(session_id, owner_type, owner_id):
    s = _liveness_sessions.get(session_id)
    if not s: return None
    if s["owner_type"] != owner_type or s["owner_id"] != owner_id: return None
    if s.get("used") or not s.get("passed"): return None
    if time.time() - s["created_at"] > SESSION_TTL_SECONDS:
        _liveness_sessions.pop(session_id, None); return None
    s["used"] = True
    return s
async def _run_check(session_id, frames, device_info, org_id_for_log, employee_id_for_log):
    session = _liveness_sessions.get(session_id)
    if not session: raise HTTPException(status_code=400, detail="Invalid or expired liveness session")
    if time.time() - session["created_at"] > SESSION_TTL_SECONDS:
        _liveness_sessions.pop(session_id, None); raise HTTPException(status_code=400, detail="Liveness session expired, please try again")
    ct = session["challenge_type"]
    fb = []
    for f in frames:
        d = await f.read()
        if d: fb.append(d)
    result = analyze_frames(fb, ct)
    session["passed"] = result["passed"]; session["liveness_score"] = result["liveness_score"]
    try:
        if org_id_for_log:
            get_supabase().table("liveness_checks").insert({"organization_id": org_id_for_log, "employee_id": employee_id_for_log, "challenge_type": ct, "liveness_score": result["liveness_score"], "passed": result["passed"], "failure_reason": result["failure_reason"], "frame_count": result["frame_count"], "processing_time_ms": result["processing_time_ms"], "device_info": json.loads(device_info) if device_info else {}}).execute()
    except Exception: pass
    return {"passed": result["passed"], "challenge_type": ct, "liveness_score": result["liveness_score"], "failure_reason": result["failure_reason"], "frame_count": result["frame_count"], "processing_time_ms": result["processing_time_ms"], "session_id": session_id}
@router.post("/api/liveness/challenge")
async def get_challenge(request: Request):
    profile = get_user_profile(request)
    if not rate_limiter.check(f"liveness_challenge:{profile['user_id']}"):
        raise HTTPException(status_code=429, detail="Too many requests. Please wait.")
    ch = get_random_challenge(); sid = _new_session("user", profile["user_id"], ch["challenge_type"])
    return {"challenge_type": ch["challenge_type"], "instruction": ch["instruction"], "session_id": sid}
@router.post("/api/liveness/check")
async def check_liveness(request: Request, session_id: str = Form(...), challenge_type: str = Form(...), frames: list[UploadFile] = File(...), device_info: str = Form("")):
    profile = get_user_profile(request)
    if not rate_limiter.check(f"liveness_check:{profile['user_id']}"):
        raise HTTPException(status_code=429, detail="Too many requests. Please wait.")
    session = _liveness_sessions.get(session_id)
    if not session or session["owner_type"] != "user" or session["owner_id"] != profile["user_id"]:
        raise HTTPException(status_code=400, detail="Invalid or expired liveness session")
    sb = get_supabase()
    emp = sb.table("employees").select("id").eq("user_id", profile["user_id"]).maybe_single().execute()
    org_id = profile.get("organization_id")
    return await _run_check(session_id, frames, device_info, org_id if emp.data else None, emp.data["id"] if emp.data else None)
@router.post("/api/kiosk/liveness/challenge")
async def kiosk_get_challenge(request: Request):
    org_id = get_kiosk_organization_id(request)
    ip = request.client.host if request.client else "unknown"
    if not rate_limiter.check(f"kiosk_liveness_challenge:{org_id}:{ip}"):
        raise HTTPException(status_code=429, detail="Too many requests. Please wait.")
    ch = get_random_challenge(); sid = _new_session("kiosk", org_id, ch["challenge_type"])
    return {"challenge_type": ch["challenge_type"], "instruction": ch["instruction"], "session_id": sid}
@router.post("/api/kiosk/liveness/check")
async def kiosk_check_liveness(request: Request, session_id: str = Form(...), challenge_type: str = Form(...), frames: list[UploadFile] = File(...), device_info: str = Form("")):
    org_id = get_kiosk_organization_id(request)
    ip = request.client.host if request.client else "unknown"
    if not rate_limiter.check(f"kiosk_liveness_check:{org_id}:{ip}"):
        raise HTTPException(status_code=429, detail="Too many requests. Please wait.")
    session = _liveness_sessions.get(session_id)
    if not session or session["owner_type"] != "kiosk" or session["owner_id"] != org_id:
        raise HTTPException(status_code=400, detail="Invalid or expired liveness session")
    return await _run_check(session_id, frames, device_info, None, None)
