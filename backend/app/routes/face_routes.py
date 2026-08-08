import json
from fastapi import APIRouter, Request, UploadFile, File, Form, HTTPException
from app.auth.jwt_validator import get_user_profile
from app.auth.permissions import check_permission
from app.database.supabase_client import get_supabase
from app.face.detector import decode_image, detect_faces, validate_single_face, extract_face_region
from app.face.embeddings import extract_embedding, serialize_embedding, EmbeddingUnavailableError
from app.face.matcher import verify_against_profile
from app.config import MAX_ALLOWED_FACES, MIN_FACE_CONFIDENCE, FACE_MATCH_THRESHOLD
from app.utils.audit import log_audit
from app.utils.security import rate_limiter
router = APIRouter()
def _get_employee_or_404(sb, employee_id: str) -> dict:
    r = sb.table("employees").select("id, organization_id, user_id").eq("id", employee_id).maybe_single().execute()
    if not r.data: raise HTTPException(status_code=404, detail="Employee not found")
    return r.data
def _assert_same_org(profile: dict, employee: dict) -> None:
    if profile["role"] == "super_admin": return
    if not profile.get("organization_id") or profile["organization_id"] != employee.get("organization_id"):
        raise HTTPException(status_code=403, detail="Employee does not belong to your organization")
def _assert_staff_or_self(profile: dict, employee: dict) -> None:
    if profile["role"] in ("super_admin", "org_admin", "hr_officer", "supervisor"): return
    if employee.get("user_id") and employee["user_id"] == profile["user_id"]: return
    raise HTTPException(status_code=403, detail="Not authorized to verify this employee")
@router.post("/api/face/enroll")
async def enroll_face(request: Request, employee_id: str = Form(...), consent_id: str = Form(...), image: UploadFile = File(...), device_info: str = Form("{}")):
    profile = get_user_profile(request)
    check_permission(profile, "super_admin", "org_admin", "hr_officer")
    if not rate_limiter.check(f"enroll:{profile['user_id']}"):
        raise HTTPException(status_code=429, detail="Too many requests. Please wait.")
    sb = get_supabase()
    employee = _get_employee_or_404(sb, employee_id)
    _assert_same_org(profile, employee)
    img = decode_image(await image.read())
    if img is None: raise HTTPException(status_code=400, detail="Invalid image data")
    faces = detect_faces(img)
    v = validate_single_face(faces, MAX_ALLOWED_FACES, MIN_FACE_CONFIDENCE)
    if not v["ok"]:
        return {"success": False, "employee_id": employee_id, "enrollment_status": "failed", "message": v["error"], "face_detected": len(faces) > 0, "face_count": len(faces)}
    try:
        emb, model_name = extract_embedding(extract_face_region(img, v["face"]["box"]))
    except EmbeddingUnavailableError as e:
        raise HTTPException(status_code=503, detail=str(e))
    sb.table("face_profiles").update({"is_active": False}).eq("employee_id", employee_id).execute()
    result = sb.table("face_profiles").insert({"organization_id": employee["organization_id"], "employee_id": employee_id, "face_embedding": serialize_embedding(emb), "embedding_model": model_name, "embedding_dim": len(emb), "enrollment_status": "completed", "consent_id": consent_id, "enrollment_date": "now()", "is_active": True, "created_by": profile["user_id"]}).execute()
    fpid = result.data[0]["id"] if result.data else None
    sb.table("face_enrollment_sessions").insert({"organization_id": employee["organization_id"], "employee_id": employee_id, "face_profile_id": fpid, "status": "completed", "frames_captured": 1, "liveness_passed": False, "device_info": json.loads(device_info) if device_info else {}, "completed_at": "now()", "created_by": profile["user_id"]}).execute()
    log_audit(employee["organization_id"], profile["user_id"], profile["role"], "face_enrolled", "employee", employee_id, {"face_profile_id": fpid, "model": model_name})
    return {"success": True, "employee_id": employee_id, "face_profile_id": fpid, "enrollment_status": "completed", "message": "Face enrolled successfully", "face_detected": True, "face_count": 1}
@router.post("/api/face/verify")
async def verify_face(request: Request, employee_id: str = Form(...), image: UploadFile = File(...), device_info: str = Form("{}")):
    profile = get_user_profile(request)
    if not rate_limiter.check(f"verify:{profile['user_id']}"):
        raise HTTPException(status_code=429, detail="Too many requests. Please wait.")
    sb = get_supabase()
    employee = _get_employee_or_404(sb, employee_id)
    _assert_same_org(profile, employee)
    _assert_staff_or_self(profile, employee)
    img = decode_image(await image.read())
    if img is None: raise HTTPException(status_code=400, detail="Invalid image data")
    faces = detect_faces(img)
    v = validate_single_face(faces, MAX_ALLOWED_FACES, MIN_FACE_CONFIDENCE)
    if not v["ok"]:
        return {"success": False, "employee_id": employee_id, "face_match_score": 0.0, "verified": False, "threshold": FACE_MATCH_THRESHOLD, "message": v["error"], "face_detected": len(faces) > 0, "face_count": len(faces)}
    try:
        emb, _model_name = extract_embedding(extract_face_region(img, v["face"]["box"]))
    except EmbeddingUnavailableError as e:
        raise HTTPException(status_code=503, detail=str(e))
    r = verify_against_profile(emb, employee_id)
    return {"success": r["verified"], "employee_id": employee_id, "face_match_score": r["score"], "verified": r["verified"], "threshold": r["threshold"], "message": "Face verified" if r["verified"] else r["error"], "face_detected": True, "face_count": 1}
