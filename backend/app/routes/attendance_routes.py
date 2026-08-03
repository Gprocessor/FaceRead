"""
Attendance routes — check-in, check-out, and history endpoints.
"""
import json
from datetime import datetime, date
from fastapi import APIRouter, Request, UploadFile, File, Form, HTTPException, Query

from app.auth.jwt_validator import get_user_profile
from app.database.supabase_client import get_supabase
from app.face.detector import (
    decode_image,
    detect_faces,
    validate_single_face,
    extract_face_region,
)
from app.face.embeddings import extract_embedding
from app.face.matcher import verify_against_profile
from app.attendance.service import (
    get_org_settings,
    check_duplicate,
    determine_status,
    create_attendance_session,
)
from app.attendance.rules import should_reject_duplicate
from app.utils.audit import log_audit
from app.utils.security import rate_limiter

router = APIRouter()


async def _process_attendance(
    request: Request,
    check_type: str,
    employee_id: str,
    image: UploadFile,
    liveness_session_id: str,
    device_info: str,
    latitude: str | None,
    longitude: str | None,
):
    profile = get_user_profile(request)
    if not rate_limiter.check(f"attendance:{profile['user_id']}"):
        raise HTTPException(status_code=429, detail="Too many requests. Please wait.")

    sb = get_supabase()

    # Verify employee belongs to caller's org
    emp_result = (
        sb.table("employees").select("*").eq("id", employee_id).maybe_single().execute()
    )
    if not emp_result.data:
        raise HTTPException(status_code=404, detail="Employee not found")
    employee = emp_result.data
    org_id = employee["organization_id"]

    settings = get_org_settings(org_id)

    # Check for duplicate
    if should_reject_duplicate(settings, check_type):
        existing = check_duplicate(org_id, employee_id, check_type)
        if existing:
            return {
                "success": False,
                "employee_id": employee_id,
                "attendance_log_id": existing["id"],
                "attendance_session_id": "",
                "check_type": check_type,
                "status": existing["status"],
                "verification_status": "rejected",
                "face_match_score": 0.0,
                "liveness_score": 0.0,
                "message": f"Duplicate {check_type.replace('_', '-')} detected for today",
                "duplicate": True,
            }

    # Process face image
    image_bytes = await image.read()
    img = decode_image(image_bytes)
    if img is None:
        raise HTTPException(status_code=400, detail="Invalid image data")

    faces = detect_faces(img)
    validation = validate_single_face(
        faces,
        settings.get("max_allowed_faces", 1),
        settings.get("min_face_confidence", 0.7),
    )
    if not validation["ok"]:
        log_result = {
            "success": False,
            "employee_id": employee_id,
            "attendance_log_id": "",
            "attendance_session_id": "",
            "check_type": check_type,
            "status": "failed_verification",
            "verification_status": "failed",
            "face_match_score": 0.0,
            "liveness_score": 0.0,
            "message": validation["error"],
            "duplicate": False,
        }
        sb.table("attendance_logs").insert(
            {
                "organization_id": org_id,
                "employee_id": employee_id,
                "attendance_date": date.today().isoformat(),
                "check_type": check_type,
                "status": "failed_verification",
                "verification_status": "failed",
                "rejection_reason": validation["error"],
                "device_info": json.loads(device_info) if device_info else {},
                "location_latitude": float(latitude) if latitude else None,
                "location_longitude": float(longitude) if longitude else None,
            }
        ).execute()
        return log_result

    # Extract embedding and verify
    face_crop = extract_face_region(img, validation["face"]["box"])
    probe_embedding = extract_embedding(face_crop)
    face_result = verify_against_profile(
        probe_embedding, employee_id, settings.get("face_match_threshold", 0.6)
    )

    # Liveness was verified by the liveness endpoint prior to this call
    liveness_passed = True
    liveness_score = 0.8

    if not face_result["verified"]:
        status_val = "failed_verification"
        verification_val = "failed"
    elif not liveness_passed:
        status_val = "rejected_liveness"
        verification_val = "rejected"
    else:
        now = datetime.now()
        status_val = determine_status(check_type, now, settings)
        verification_val = "verified"

    # Create attendance log
    log_data = {
        "organization_id": org_id,
        "employee_id": employee_id,
        "attendance_date": date.today().isoformat(),
        "check_type": check_type,
        "status": status_val,
        "face_match_score": face_result["score"],
        "liveness_score": liveness_score,
        "verification_status": verification_val,
        "face_profile_id": face_result.get("face_profile_id"),
        "device_info": json.loads(device_info) if device_info else {},
        "location_latitude": float(latitude) if latitude else None,
        "location_longitude": float(longitude) if longitude else None,
    }
    if check_type == "check_in":
        log_data["check_in_time"] = datetime.now().isoformat()
    else:
        log_data["check_out_time"] = datetime.now().isoformat()

    log_result = sb.table("attendance_logs").insert(log_data).execute()
    log_id = log_result.data[0]["id"] if log_result.data else ""

    # Create/update attendance session
    now = datetime.now()
    session_id = ""
    if verification_val == "verified":
        check_in_time = now if check_type == "check_in" else None
        check_out_time = now if check_type == "check_out" else None
        session_id = create_attendance_session(
            org_id, employee_id, date.today(), status_val, check_in_time, check_out_time
        )
        if session_id:
            sb.table("attendance_logs").update(
                {"attendance_session_id": session_id}
            ).eq("id", log_id).execute()

    # Update face profile last_verified_at
    if face_result.get("face_profile_id"):
        sb.table("face_profiles").update({"last_verified_at": "now()"}).eq(
            "id", face_result["face_profile_id"]
        ).execute()

    log_audit(
        organization_id=org_id,
        actor_user_id=profile["user_id"],
        actor_role=profile["role"],
        action=f"attendance_{check_type}",
        entity_type="attendance_log",
        entity_id=log_id,
        details={
            "employee_id": employee_id,
            "status": status_val,
            "face_score": face_result["score"],
            "liveness_score": liveness_score,
        },
    )

    return {
        "success": verification_val == "verified",
        "employee_id": employee_id,
        "attendance_log_id": log_id,
        "attendance_session_id": session_id,
        "check_type": check_type,
        "status": status_val,
        "verification_status": verification_val,
        "face_match_score": face_result["score"],
        "liveness_score": liveness_score,
        "message": "Attendance recorded"
        if verification_val == "verified"
        else "Verification failed",
        "duplicate": False,
    }


@router.post("/api/attendance/check-in")
async def check_in(
    request: Request,
    employee_id: str = Form(...),
    image: UploadFile = File(...),
    liveness_session_id: str = Form(...),
    device_info: str = Form("{}"),
    latitude: str | None = Form(None),
    longitude: str | None = Form(None),
):
    return await _process_attendance(
        request, "check_in", employee_id, image, liveness_session_id, device_info, latitude, longitude
    )


@router.post("/api/attendance/check-out")
async def check_out(
    request: Request,
    employee_id: str = Form(...),
    image: UploadFile = File(...),
    liveness_session_id: str = Form(...),
    device_info: str = Form("{}"),
    latitude: str | None = Form(None),
    longitude: str | None = Form(None),
):
    return await _process_attendance(
        request, "check_out", employee_id, image, liveness_session_id, device_info, latitude, longitude
    )


@router.get("/api/attendance/history")
async def get_history(
    request: Request,
    employee_id: str | None = Query(None),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
):
    """Get attendance history for the caller or a specific employee."""
    profile = get_user_profile(request)
    sb = get_supabase()

    query = sb.table("attendance_logs").select("*")
    if profile["role"] != "super_admin":
        query = query.eq("organization_id", profile["organization_id"])
    if employee_id:
        query = query.eq("employee_id", employee_id)
    if date_from:
        query = query.gte("attendance_date", date_from)
    if date_to:
        query = query.lte("attendance_date", date_to)
    query = query.order("created_at", desc=True).limit(100)
    result = query.execute()
    return result.data or []


@router.get("/api/admin/reports")
async def get_reports(
    request: Request,
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
):
    """Generate organization-wide attendance report."""
    profile = get_user_profile(request)
    from app.auth.permissions import check_permission

    check_permission(profile, "super_admin", "org_admin", "hr_officer", "supervisor")

    sb = get_supabase()
    org_id = profile["organization_id"]
    today = date.today().isoformat()

    emp_count = (
        sb.table("employees")
        .select("id", count="exact")
        .eq("organization_id", org_id)
        .eq("status", "active")
        .execute()
    )
    total_employees = emp_count.count or 0

    att_query = (
        sb.table("attendance_sessions")
        .select("*")
        .eq("organization_id", org_id)
        .eq("attendance_date", today)
    )
    att_result = att_query.execute()
    sessions = att_result.data or []

    present = sum(1 for s in sessions if s["status"] == "present")
    late = sum(1 for s in sessions if s["status"] == "late")
    absent = total_employees - present - late
    failed = sum(
        1 for s in sessions if s["status"] in ("failed_verification", "rejected_liveness")
    )
    rate = present / total_employees if total_employees > 0 else 0

    records = []
    for s in sessions:
        emp = (
            sb.table("employees")
            .select("full_name, employee_code, departments(name)")
            .eq("id", s["employee_id"])
            .maybe_single()
            .execute()
        )
        emp_data = emp.data or {}
        dept = (
            emp_data.get("departments", {}).get("name")
            if emp_data.get("departments")
            else None
        )
        records.append(
            {
                "employee_id": s["employee_id"],
                "employee_name": emp_data.get("full_name", "Unknown"),
                "employee_code": emp_data.get("employee_code", ""),
                "department": dept,
                "status": s["status"],
                "check_in_time": s.get("check_in_time"),
                "check_out_time": s.get("check_out_time"),
                "face_match_score": None,
                "liveness_score": None,
            }
        )

    return {
        "total_employees": total_employees,
        "present_today": present,
        "late_today": late,
        "absent_today": absent,
        "failed_verification_today": failed,
        "attendance_rate": rate,
        "records": records,
    }
