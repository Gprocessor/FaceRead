"""
Liveness detection routes — challenge generation and frame analysis.
"""
import uuid
import json
from fastapi import APIRouter, Request, UploadFile, File, Form, HTTPException
from app.auth.jwt_validator import get_user_profile
from app.face.liveness import get_random_challenge, analyze_frames
from app.database.supabase_client import get_supabase
from app.utils.audit import log_audit
from app.utils.security import rate_limiter

router = APIRouter()

# In-memory session store (MVP). For production, use database or Redis.
_liveness_sessions: dict[str, dict] = {}


@router.post("/api/liveness/challenge")
async def get_challenge(request: Request):
    """Generate a random liveness challenge for the current session."""
    profile = get_user_profile(request)

    challenge = get_random_challenge()
    session_id = str(uuid.uuid4())

    _liveness_sessions[session_id] = {
        "challenge_type": challenge["challenge_type"],
        "user_id": profile["user_id"],
        "organization_id": profile["organization_id"],
    }

    return {
        "challenge_type": challenge["challenge_type"],
        "instruction": challenge["instruction"],
        "session_id": session_id,
    }


@router.post("/api/liveness/check")
async def check_liveness(
    request: Request,
    session_id: str = Form(...),
    challenge_type: str = Form(...),
    frames: list[UploadFile] = File(...),
    device_info: str = Form("{}"),
):
    """
    Analyze submitted frames for liveness verification.
    """
    profile = get_user_profile(request)

    if not rate_limiter.check(f"liveness:{profile['user_id']}"):
        raise HTTPException(status_code=429, detail="Too many requests. Please wait.")

    session = _liveness_sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=400, detail="Invalid or expired liveness session")

    if session["challenge_type"] != challenge_type:
        raise HTTPException(status_code=400, detail="Challenge type mismatch")

    frame_bytes_list = [await f.read() for f in frames]
    result = analyze_frames(frame_bytes_list, challenge_type)

    # Store liveness check result
    sb = get_supabase()
    sb.table("liveness_checks").insert({
        "organization_id": profile["organization_id"],
        "employee_id": None,  # will be linked during attendance
        "challenge_type": challenge_type,
        "liveness_score": result["liveness_score"],
        "passed": result["passed"],
        "failure_reason": result["failure_reason"],
        "frame_count": result["frame_count"],
        "processing_time_ms": result["processing_time_ms"],
        "device_info": json.loads(device_info) if device_info else {},
    }).execute()

    # Clean up session
    del _liveness_sessions[session_id]

    log_audit(
        organization_id=profile["organization_id"],
        actor_user_id=profile["user_id"],
        actor_role=profile["role"],
        action="liveness_check",
        entity_type="liveness",
        details={
            "challenge_type": challenge_type,
            "passed": result["passed"],
            "score": result["liveness_score"],
        },
    )

    return {
        "passed": result["passed"],
        "challenge_type": challenge_type,
        "liveness_score": result["liveness_score"],
        "failure_reason": result["failure_reason"],
        "frame_count": result["frame_count"],
        "processing_time_ms": result["processing_time_ms"],
        "session_id": session_id,
    }
