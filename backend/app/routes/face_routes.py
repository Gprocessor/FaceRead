"""
Face routes — enrollment and verification endpoints.
"""
import json
from fastapi import APIRouter, Request, UploadFile, File, Form, HTTPException, status
from app.auth.jwt_validator import get_user_profile
from app.auth.permissions import check_permission
from app.database.supabase_client import get_supabase
from app.face.detector import decode_image, detect_faces, validate_single_face, extract_face_region
from app.face.embeddings import extract_embedding, serialize_embedding
from app.face.matcher import verify_against_profile
from app.config import EMBEDDING_MODEL, MAX_ALLOWED_FACES, MIN_FACE_CONFIDENCE, FACE_MATCH_THRESHOLD
from app.utils.audit import log_audit
from app.utils.security import rate_limiter

router = APIRouter()


@router.post("/api/face/enroll")
async def enroll_face(
    request: Request,
    employee_id: str = Form(...),
    consent_id: str = Form(...),
    image: UploadFile = File(...),
    device_info: str = Form("{}"),
):
    """
    Enroll a face for an employee.
    Receives an image, detects the face, extracts embedding, stores it.
    """
    profile = get_user_profile(request)
    check_permission(profile, "super_admin", "org_admin", "hr_officer")

    if not rate_limiter.check(f"enroll:{profile['user_id']}"):
        raise HTTPException(status_code=429, detail="Too many requests. Please wait.")

    image_bytes = await image.read()
    img = decode_image(image_bytes)
    if img is None:
        raise HTTPException(status_code=400, detail="Invalid image data")

    faces = detect_faces(img)
    validation = validate_single_face(faces, MAX_ALLOWED_FACES, MIN_FACE_CONFIDENCE)

    if not validation["ok"]:
        return {
            "success": False,
            "employee_id": employee_id,
            "enrollment_status": "failed",
            "message": validation["error"],
            "face_detected": len(faces) > 0,
            "face_count": len(faces),
        }

    face_crop = extract_face_region(img, validation["face"]["box"])
    embedding = extract_embedding(face_crop)
    embedding_str = serialize_embedding(embedding)

    sb = get_supabase()

    # Deactivate previous profiles
    sb.table("face_profiles").update({"is_active": False}).eq("employee_id", employee_id).execute()

    # Insert new profile
    result = sb.table("face_profiles").insert({
        "organization_id": profile["organization_id"],
        "employee_id": employee_id,
        "face_embedding": embedding_str,
        "embedding_model": EMBEDDING_MODEL,
        "embedding_dim": len(embedding),
        "enrollment_status": "completed",
        "consent_id": consent_id,
        "enrollment_date": "now()",
        "is_active": True,
        "created_by": profile["user_id"],
    }).execute()

    face_profile_id = result.data[0]["id"] if result.data else None

    # Create enrollment session record
    sb.table("face_enrollment_sessions").insert({
        "organization_id": profile["organization_id"],
        "employee_id": employee_id,
        "face_profile_id": face_profile_id,
        "status": "completed",
        "frames_captured": 1,
        "liveness_passed": False,
        "device_info": json.loads(device_info) if device_info else {},
        "completed_at": "now()",
        "created_by": profile["user_id"],
    }).execute()

    log_audit(
        organization_id=profile["organization_id"],
        actor_user_id=profile["user_id"],
        actor_role=profile["role"],
        action="face_enrolled",
        entity_type="employee",
        entity_id=employee_id,
        details={"face_profile_id": face_profile_id, "model": EMBEDDING_MODEL},
    )

    return {
        "success": True,
        "employee_id": employee_id,
        "face_profile_id": face_profile_id,
        "enrollment_status": "completed",
        "message": "Face enrolled successfully",
        "face_detected": True,
        "face_count": 1,
    }


@router.post("/api/face/verify")
async def verify_face(
    request: Request,
    employee_id: str = Form(...),
    image: UploadFile = File(...),
    device_info: str = Form("{}"),
):
    """
    Verify a face against the stored employee embedding.
    Returns match score and verification result.
    """
    profile = get_user_profile(request)

    if not rate_limiter.check(f"verify:{profile['user_id']}"):
        raise HTTPException(status_code=429, detail="Too many requests. Please wait.")

    image_bytes = await image.read()
    img = decode_image(image_bytes)
    if img is None:
        raise HTTPException(status_code=400, detail="Invalid image data")

    faces = detect_faces(img)
    validation = validate_single_face(faces, MAX_ALLOWED_FACES, MIN_FACE_CONFIDENCE)

    if not validation["ok"]:
        return {
            "success": False,
            "employee_id": employee_id,
            "face_match_score": 0.0,
            "verified": False,
            "threshold": FACE_MATCH_THRESHOLD,
            "message": validation["error"],
            "face_detected": len(faces) > 0,
            "face_count": len(faces),
        }

    face_crop = extract_face_region(img, validation["face"]["box"])
    probe_embedding = extract_embedding(face_crop)

    result = verify_against_profile(probe_embedding, employee_id)

    return {
        "success": result["verified"],
        "employee_id": employee_id,
        "face_match_score": result["score"],
        "verified": result["verified"],
        "threshold": result["threshold"],
        "message": "Face verified" if result["verified"] else result["error"],
        "face_detected": True,
        "face_count": 1,
    }
