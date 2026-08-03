"""Liveness detection routes."""
import uuid
import json
from fastapi import APIRouter, Request, UploadFile, File, Form, HTTPException
from app.auth.jwt_validator import get_user_profile
from app.face.liveness import get_random_challenge, analyze_frames
from app.database.supabase_client import get_supabase
from app.utils.security import rate_limiter

router = APIRouter()

# In-memory session store (MVP). For production use a DB or Redis.
_liveness_sessions: dict[str, dict] = {}


@router.post("/api/liveness/challenge")
async def get_challenge(request: Request):
    profile = get_user_profile(request)
    if not rate_limiter.check(f"liveness_challenge:{profile['user_id']}"):
        raise HTTPException(status_code=429, detail="Too many requests. Please wait.")
    challenge = get_random_challenge()
    session_id = str(uuid.uuid4())
    _liveness_sessions[session_id] = {"user_id": profile["user_id"], "challenge_type": challenge["challenge_type"], "passed": False}
    return {"challenge_type": challenge["challenge_type"], "instruction": challenge["instruction"], "session_id": session_id}


@router.post("/api/liveness/check")
async def check_liveness(request: Request, session_id: str = Form(...), challenge_type: str = Form(...),
                         frames: list[UploadFile] = File(...), device_info: str = Form("")):
    profile = get_user_profile(request)
    if not rate_limiter.check(f"liveness_check:{profile['user_id']}"):
        raise HTTPException(status_code=429, detail="Too many requests. Please wait.")
    session = _liveness_sessions.get(session_id)
    if not session or session["user_id"] != profile["user_id"]:
        raise HTTPException(status_code=400, detail="Invalid or expired liveness session")

    frame_bytes = []
    for f in frames:
        data = await f.read()
        if data:
            frame_bytes.append(data)

    result = analyze_frames(frame_bytes, challenge_type)
    session["passed"] = result["passed"]
    session["challenge_type"] = challenge_type

    # Best-effort persistence for audit
    try:
        sb = get_supabase()
        emp = sb.table("employees").select("id").eq("user_id", profile["user_id"]).maybe_single().execute()
        org_id = profile.get("organization_id")
        if emp.data and org_id:
            sb.table("liveness_checks").insert({
                "organization_id": org_id, "employee_id": emp.data["id"], "challenge_type": challenge_type,
                "liveness_score": result["liveness_score"], "passed": result["passed"],
                "failure_reason": result["failure_reason"], "frame_count": result["frame_count"],
                "processing_time_ms": result["processing_time_ms"],
                "device_info": json.loads(device_info) if device_info else {},
            }).execute()
    except Exception:
        pass

    return {"passed": result["passed"], "challenge_type": challenge_type,
            "liveness_score": result["liveness_score"], "failure_reason": result["failure_reason"],
            "frame_count": result["frame_count"], "processing_time_ms": result["processing_time_ms"],
            "session_id": session_id}
