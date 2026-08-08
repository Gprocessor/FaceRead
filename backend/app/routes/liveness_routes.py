import time, uuid, json
from fastapi import APIRouter, Request, UploadFile, File, Form, HTTPException
from app.auth.jwt_validator import get_user_profile
from app.face.liveness import get_random_challenge, analyze_frames
from app.database.supabase_client import get_supabase
from app.utils.security import rate_limiter
router = APIRouter()

_liveness_sessions: dict[str, dict] = {}
SESSION_TTL_SECONDS = 5 * 60


def consume_liveness_session(session_id: str, user_id: str) -> dict | None:
    """Validate and single-use-consume a liveness session for the given caller.

    Returns the session dict (with 'passed' and 'liveness_score') if it exists,
    belongs to this user, passed, hasn't already been used, and hasn't expired.
    Returns None otherwise. Always removes the session so it can't be replayed.
    """
    session = _liveness_sessions.pop(session_id, None)
    if not session:
        return None
    if session["user_id"] != user_id:
        return None
    if time.time() - session["created_at"] > SESSION_TTL_SECONDS:
        return None
    if session.get("used"):
        return None
    if not session.get("passed"):
        return None
    return session


@router.post("/api/liveness/challenge")
async def get_challenge(request: Request):
    profile = get_user_profile(request)
    if not rate_limiter.check(f"liveness_challenge:{profile['user_id']}"):
        raise HTTPException(status_code=429, detail="Too many requests. Please wait.")
    ch = get_random_challenge(); sid = str(uuid.uuid4())
    _liveness_sessions[sid] = {"user_id": profile["user_id"], "challenge_type": ch["challenge_type"], "passed": False, "liveness_score": 0.0, "used": False, "created_at": time.time()}
    return {"challenge_type": ch["challenge_type"], "instruction": ch["instruction"], "session_id": sid}

@router.post("/api/liveness/check")
async def check_liveness(request: Request, session_id: str = Form(...), challenge_type: str = Form(...), frames: list[UploadFile] = File(...), device_info: str = Form("")):
    profile = get_user_profile(request)
    if not rate_limiter.check(f"liveness_check:{profile['user_id']}"):
        raise HTTPException(status_code=429, detail="Too many requests. Please wait.")
    session = _liveness_sessions.get(session_id)
    if not session or session["user_id"] != profile["user_id"]:
        raise HTTPException(status_code=400, detail="Invalid or expired liveness session")
    if time.time() - session["created_at"] > SESSION_TTL_SECONDS:
        _liveness_sessions.pop(session_id, None)
        raise HTTPException(status_code=400, detail="Liveness session expired, please try again")
    # Score against the challenge that was actually issued, not whatever the
    # client claims - otherwise a client could self-report an easier challenge.
    effective_challenge_type = session["challenge_type"]
    fb = []
    for f in frames:
        d = await f.read()
        if d: fb.append(d)
    result = analyze_frames(fb, effective_challenge_type)
    session["passed"] = result["passed"]
    session["liveness_score"] = result["liveness_score"]
    session["used"] = False  # not consumed until an attendance check-in/out actually uses it
    try:
        sb = get_supabase()
        emp = sb.table("employees").select("id").eq("user_id", profile["user_id"]).maybe_single().execute()
        org_id = profile.get("organization_id")
        if emp.data and org_id:
            sb.table("liveness_checks").insert({"organization_id": org_id, "employee_id": emp.data["id"], "challenge_type": effective_challenge_type, "liveness_score": result["liveness_score"], "passed": result["passed"], "failure_reason": result["failure_reason"], "frame_count": result["frame_count"], "processing_time_ms": result["processing_time_ms"], "device_info": json.loads(device_info) if device_info else {}}).execute()
    except Exception: pass
    return {"passed": result["passed"], "challenge_type": effective_challenge_type, "liveness_score": result["liveness_score"], "failure_reason": result["failure_reason"], "frame_count": result["frame_count"], "processing_time_ms": result["processing_time_ms"], "session_id": session_id}
