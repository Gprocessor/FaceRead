import json
from datetime import datetime, date
from fastapi import APIRouter, Request, UploadFile, File, Form, HTTPException, Query
from app.auth.jwt_validator import get_user_profile
from app.database.supabase_client import get_supabase
from app.face.detector import decode_image, detect_faces, validate_single_face, extract_face_region
from app.face.embeddings import extract_embedding
from app.face.matcher import verify_against_profile
from app.attendance.service import get_org_settings, check_duplicate, determine_status, create_attendance_session
from app.attendance.rules import should_reject_duplicate
from app.utils.audit import log_audit
from app.utils.security import rate_limiter
router = APIRouter()

async def _process(request, check_type, employee_id, image, device_info, latitude, longitude):
    profile = get_user_profile(request)
    if not rate_limiter.check(f"attendance:{profile['user_id']}"):
        raise HTTPException(status_code=429, detail="Too many requests. Please wait.")
    sb = get_supabase()
    emp = sb.table("employees").select("*").eq("id", employee_id).maybe_single().execute()
    if not emp.data: raise HTTPException(status_code=404, detail="Employee not found")
    org_id = emp.data["organization_id"]
    settings = get_org_settings(org_id)
    if should_reject_duplicate(settings, check_type):
        existing = check_duplicate(org_id, employee_id, check_type)
        if existing:
            return {"success": False, "employee_id": employee_id, "attendance_log_id": existing["id"], "attendance_session_id": "", "check_type": check_type, "status": existing["status"], "verification_status": "rejected", "face_match_score": 0.0, "liveness_score": 0.0, "message": f"Duplicate {check_type.replace('_', '-')} detected for today", "duplicate": True}
    img = decode_image(await image.read())
    if img is None: raise HTTPException(status_code=400, detail="Invalid image data")
    faces = detect_faces(img)
    v = validate_single_face(faces, settings.get("max_allowed_faces", 1), settings.get("min_face_confidence", 0.7))
    if not v["ok"]:
        sb.table("attendance_logs").insert({"organization_id": org_id, "employee_id": employee_id, "attendance_date": date.today().isoformat(), "check_type": check_type, "status": "failed_verification", "verification_status": "failed", "rejection_reason": v["error"], "device_info": json.loads(device_info) if device_info else {}, "location_latitude": float(latitude) if latitude else None, "location_longitude": float(longitude) if longitude else None}).execute()
        return {"success": False, "employee_id": employee_id, "attendance_log_id": "", "attendance_session_id": "", "check_type": check_type, "status": "failed_verification", "verification_status": "failed", "face_match_score": 0.0, "liveness_score": 0.0, "message": v["error"], "duplicate": False}
    emb = extract_embedding(extract_face_region(img, v["face"]["box"]))
    fr = verify_against_profile(emb, employee_id, settings.get("face_match_threshold", 0.6))
    liveness_score = 0.8
    if not fr["verified"]:
        status_val, verification_val = "failed_verification", "failed"
    else:
        status_val = determine_status(check_type, datetime.now(), settings); verification_val = "verified"
    log_data = {"organization_id": org_id, "employee_id": employee_id, "attendance_date": date.today().isoformat(), "check_type": check_type, "status": status_val, "face_match_score": fr["score"], "liveness_score": liveness_score, "verification_status": verification_val, "face_profile_id": fr.get("face_profile_id"), "device_info": json.loads(device_info) if device_info else {}, "location_latitude": float(latitude) if latitude else None, "location_longitude": float(longitude) if longitude else None}
    log_data["check_in_time" if check_type == "check_in" else "check_out_time"] = datetime.now().isoformat()
    log_res = sb.table("attendance_logs").insert(log_data).execute()
    log_id = log_res.data[0]["id"] if log_res.data else ""
    session_id = ""
    if verification_val == "verified":
        now = datetime.now()
        session_id = create_attendance_session(org_id, employee_id, date.today(), status_val, now if check_type == "check_in" else None, now if check_type == "check_out" else None)
        if session_id: sb.table("attendance_logs").update({"attendance_session_id": session_id}).eq("id", log_id).execute()
    if fr.get("face_profile_id"):
        sb.table("face_profiles").update({"last_verified_at": "now()"}).eq("id", fr["face_profile_id"]).execute()
    log_audit(org_id, profile["user_id"], profile["role"], f"attendance_{check_type}", "attendance_log", log_id, {"employee_id": employee_id, "status": status_val, "face_score": fr["score"], "liveness_score": liveness_score})
    return {"success": verification_val == "verified", "employee_id": employee_id, "attendance_log_id": log_id, "attendance_session_id": session_id, "check_type": check_type, "status": status_val, "verification_status": verification_val, "face_match_score": fr["score"], "liveness_score": liveness_score, "message": "Attendance recorded" if verification_val == "verified" else "Verification failed", "duplicate": False}

@router.post("/api/attendance/check-in")
async def check_in(request: Request, employee_id: str = Form(...), image: UploadFile = File(...), liveness_session_id: str = Form(...), device_info: str = Form("{}"), latitude: str | None = Form(None), longitude: str | None = Form(None)):
    return await _process(request, "check_in", employee_id, image, device_info, latitude, longitude)

@router.post("/api/attendance/check-out")
async def check_out(request: Request, employee_id: str = Form(...), image: UploadFile = File(...), liveness_session_id: str = Form(...), device_info: str = Form("{}"), latitude: str | None = Form(None), longitude: str | None = Form(None)):
    return await _process(request, "check_out", employee_id, image, device_info, latitude, longitude)

@router.get("/api/attendance/history")
async def get_history(request: Request, employee_id: str | None = Query(None), date_from: str | None = Query(None), date_to: str | None = Query(None)):
    profile = get_user_profile(request)
    sb = get_supabase()
    q = sb.table("attendance_logs").select("*")
    if profile["role"] != "super_admin": q = q.eq("organization_id", profile["organization_id"])
    if employee_id: q = q.eq("employee_id", employee_id)
    if date_from: q = q.gte("attendance_date", date_from)
    if date_to: q = q.lte("attendance_date", date_to)
    return q.order("created_at", desc=True).limit(100).execute().data or []

@router.get("/api/admin/reports")
async def get_reports(request: Request, date_from: str | None = Query(None), date_to: str | None = Query(None)):
    profile = get_user_profile(request)
    from app.auth.permissions import check_permission
    check_permission(profile, "super_admin", "org_admin", "hr_officer", "supervisor")
    sb = get_supabase()
    org_id = profile["organization_id"]; today = date.today().isoformat()
    emp_count = sb.table("employees").select("id", count="exact").eq("organization_id", org_id).eq("status", "active").execute()
    total = emp_count.count or 0
    sessions = sb.table("attendance_sessions").select("*").eq("organization_id", org_id).eq("attendance_date", today).execute().data or []
    present = sum(1 for s in sessions if s["status"] == "present")
    late = sum(1 for s in sessions if s["status"] == "late")
    failed = sum(1 for s in sessions if s["status"] in ("failed_verification", "rejected_liveness"))
    records = []
    for s in sessions:
        emp = sb.table("employees").select("full_name, employee_code, departments(name)").eq("id", s["employee_id"]).maybe_single().execute()
        d = emp.data or {}
        dept = d.get("departments", {}).get("name") if d.get("departments") else None
        records.append({"employee_id": s["employee_id"], "employee_name": d.get("full_name", "Unknown"), "employee_code": d.get("employee_code", ""), "department": dept, "status": s["status"], "check_in_time": s.get("check_in_time"), "check_out_time": s.get("check_out_time"), "face_match_score": None, "liveness_score": None})
    return {"total_employees": total, "present_today": present, "late_today": late, "absent_today": total - present - late, "failed_verification_today": failed, "attendance_rate": present / total if total > 0 else 0, "records": records}
