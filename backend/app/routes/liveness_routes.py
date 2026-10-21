import json

from fastapi import APIRouter, Request, UploadFile, File, Form, HTTPException

from app.auth.jwt_validator import get_user_profile
from app.auth.kiosk import get_kiosk_organization_id
from app.config import LIVENESS_SESSION_FILE, LIVENESS_SESSION_TTL
from app.database.supabase_client import get_supabase
from app.face.liveness import get_random_challenge, analyze_frames
from app.utils.security import rate_limiter
from app.utils.session_store import SessionStore

router = APIRouter()

# File-backed so a uvicorn --reload restart no longer invalidates a scan that is
# already in progress.
_store = SessionStore(LIVENESS_SESSION_FILE, LIVENESS_SESSION_TTL)


def consume_liveness_session(sid, owner_type, owner_id):
    return _store.consume(sid, owner_type, owner_id)


async def _run(sid, frames, di, org_for_log, emp_for_log):
    session = _store.get(sid)
    if not session:
        raise HTTPException(status_code=400, detail="Invalid or expired liveness session")

    ct = session["challenge_type"]
    buffers = []
    for f in frames:
        data = await f.read()
        if data:
            buffers.append(data)

    res = analyze_frames(buffers, ct)
    _store.update(sid, passed=res["passed"], liveness_score=res["liveness_score"])

    try:
        if org_for_log:
            get_supabase().table("liveness_checks").insert({
                "organization_id": org_for_log,
                "employee_id": emp_for_log,
                "challenge_type": ct,
                "liveness_score": res["liveness_score"],
                "passed": res["passed"],
                "failure_reason": res["failure_reason"],
                "frame_count": res["frame_count"],
                "processing_time_ms": res["processing_time_ms"],
                "device_info": json.loads(di) if di else {},
            }).execute()
    except Exception:
        pass

    return {**res, "challenge_type": ct, "session_id": sid}


@router.post("/api/liveness/challenge")
async def challenge(request: Request):
    p = get_user_profile(request)
    if not rate_limiter.check(f"lc:{p['user_id']}"):
        raise HTTPException(status_code=429, detail="Too many requests")
    ch = get_random_challenge()
    sid = _store.create({"owner_type": "user", "owner_id": p["user_id"], "challenge_type": ch["challenge_type"]})
    return {**ch, "session_id": sid}


@router.post("/api/liveness/check")
async def check(request: Request, session_id: str = Form(...), challenge_type: str = Form(...),
                frames: list[UploadFile] = File(...), device_info: str = Form("")):
    p = get_user_profile(request)
    s = _store.get(session_id)
    if not s or s.get("owner_type") != "user" or s.get("owner_id") != p["user_id"]:
        raise HTTPException(status_code=400, detail="Invalid session")
    sb = get_supabase()
    emp = sb.table("employees").select("id").eq("user_id", p["user_id"]).maybe_single().execute()
    emp_row = getattr(emp, "data", None)
    return await _run(session_id, frames, device_info,
                      p.get("organization_id") if emp_row else None,
                      emp_row["id"] if emp_row else None)


@router.post("/api/kiosk/liveness/challenge")
async def kiosk_challenge(request: Request):
    org = get_kiosk_organization_id(request)
    ip = request.client.host if request.client else "?"
    if not rate_limiter.check(f"klc:{org}:{ip}"):
        raise HTTPException(status_code=429, detail="Too many requests")
    ch = get_random_challenge()
    sid = _store.create({"owner_type": "kiosk", "owner_id": org, "challenge_type": ch["challenge_type"]})
    return {**ch, "session_id": sid}


@router.post("/api/kiosk/liveness/check")
async def kiosk_check(request: Request, session_id: str = Form(...), challenge_type: str = Form(...),
                      frames: list[UploadFile] = File(...), device_info: str = Form("")):
    org = get_kiosk_organization_id(request)
    s = _store.get(session_id)
    if not s or s.get("owner_type") != "kiosk" or s.get("owner_id") != org:
        raise HTTPException(status_code=400, detail="Invalid session")
    return await _run(session_id, frames, device_info, None, None)
