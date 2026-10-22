import json
from datetime import datetime, date

from fastapi import APIRouter, Request, UploadFile, File, Form, HTTPException, Query

from app.attendance.rules import should_reject_duplicate
from app.attendance.service import get_org_settings, check_duplicate, determine_status, create_attendance_session
from app.auth.jwt_validator import get_user_profile
from app.auth.kiosk import get_kiosk_organization_id
from app.auth.permissions import check_permission
from app.database.supabase_client import get_supabase
from app.face.detector import decode_image, detect_faces, validate_single_face, extract_face_region
from app.face.embeddings import extract_embedding, EmbeddingUnavailableError
from app.face.matcher import identify_employee
from app.people.schema import get_org_schema
from app.routes.liveness_routes import consume_liveness_session
from app.utils.audit import log_audit
from app.utils.security import rate_limiter

router = APIRouter()
STAFF = ("super_admin", "org_admin", "hr_officer", "supervisor")
MAX_REPORT_DAYS = 366


def _data(resp):
    return (getattr(resp, "data", None) if resp is not None else None) or {}


def _liveness_required(settings):
    v = settings.get("require_liveness", True)
    if isinstance(v, str):
        return v.strip().lower() not in ("false", "0", "no", "off")
    return bool(v)


def _id_label(org):
    try:
        return get_org_schema(org)["labels"]["id_label"]
    except Exception:
        return "ID"


@router.post("/api/kiosk/config")
async def kiosk_config(request: Request):
    """Read by the kiosk before every scan so admin setting changes apply immediately."""
    org = get_kiosk_organization_id(request)
    settings = get_org_settings(org)
    return {"require_liveness": _liveness_required(settings), "id_label": _id_label(org)}


async def _finalize(sb, org, emp_id, ct, fr, ls, di, lat, lon, settings, actor, arole):
    status_val, ver = (("failed_verification", "failed") if not fr["verified"]
                       else (determine_status(ct, datetime.now(), settings), "verified"))
    log = {"organization_id": org, "employee_id": emp_id, "attendance_date": date.today().isoformat(),
           "check_type": ct, "status": status_val, "face_match_score": fr["score"], "liveness_score": ls,
           "verification_status": ver, "face_profile_id": fr.get("face_profile_id"),
           "device_info": json.loads(di) if di else {},
           "location_latitude": float(lat) if lat else None, "location_longitude": float(lon) if lon else None}
    log["check_in_time" if ct == "check_in" else "check_out_time"] = datetime.now().isoformat()
    lr = sb.table("attendance_logs").insert(log).execute()
    lid = lr.data[0]["id"] if lr.data else ""
    sid = ""
    if ver == "verified":
        now = datetime.now()
        sid = create_attendance_session(org, emp_id, date.today(), status_val,
                                        now if ct == "check_in" else None, now if ct == "check_out" else None)
        if sid:
            sb.table("attendance_logs").update({"attendance_session_id": sid}).eq("id", lid).execute()
    if fr.get("face_profile_id"):
        sb.table("face_profiles").update({"last_verified_at": "now()"}).eq("id", fr["face_profile_id"]).execute()
    log_audit(org, actor, arole, f"attendance_{ct}", "attendance_log", lid, {"employee_id": emp_id, "status": status_val})
    return {"success": ver == "verified", "employee_id": emp_id, "attendance_log_id": lid, "attendance_session_id": sid,
            "check_type": ct, "status": status_val, "verification_status": ver, "face_match_score": fr["score"],
            "liveness_score": ls, "message": "Attendance recorded" if ver == "verified" else "Verification failed",
            "duplicate": False}


async def _kiosk(request, ct, image, di, lat, lon, lsid):
    org = get_kiosk_organization_id(request)
    ip = request.client.host if request.client else "?"
    if not rate_limiter.check(f"ka:{org}:{ip}"):
        raise HTTPException(status_code=429, detail="Too many requests")
    sb = get_supabase()
    settings = get_org_settings(org)
    ls = None
    if _liveness_required(settings):
        ls_s = consume_liveness_session(lsid, "kiosk", org) if lsid else None
        if not ls_s:
            raise HTTPException(status_code=400, detail="Liveness verification required: complete the liveness challenge first")
        ls = ls_s["liveness_score"]
    img = decode_image(await image.read())
    if img is None:
        raise HTTPException(status_code=400, detail="Invalid image data")
    faces = detect_faces(img)
    v = validate_single_face(faces, settings.get("max_allowed_faces", 1), settings.get("min_face_confidence", 0.5))
    fail = {"success": False, "employee_id": None, "attendance_log_id": "", "attendance_session_id": "",
            "check_type": ct, "status": "failed_verification", "verification_status": "failed",
            "liveness_score": ls, "duplicate": False}
    if not v["ok"]:
        return {**fail, "face_match_score": 0.0, "message": v["error"]}
    try:
        emb, _ = extract_embedding(extract_face_region(img, v["face"]["box"]))
    except EmbeddingUnavailableError as e:
        raise HTTPException(status_code=503, detail=str(e))
    ident = identify_employee(emb, org, settings.get("face_match_threshold", 0.68))
    if not ident["identified"]:
        log_audit(org, None, "kiosk_device", "kiosk_identification_failed", None, None,
                  {"score": ident["score"], "reason": ident["error"]})
        return {**fail, "face_match_score": ident["score"], "message": ident["error"]}
    eid = ident["employee_id"]
    id_label = _id_label(org)
    if should_reject_duplicate(settings, ct):
        ex = check_duplicate(org, eid, ct)
        if ex:
            e0 = _data(sb.table("employees").select("full_name, employee_code").eq("id", eid).maybe_single().execute())
            return {"success": False, "employee_id": eid, "attendance_log_id": ex["id"], "attendance_session_id": "",
                    "check_type": ct, "status": ex["status"], "verification_status": "rejected",
                    "face_match_score": ident["score"], "liveness_score": ls,
                    "message": f"Duplicate {ct.replace('_', '-')} detected for today", "duplicate": True,
                    "employee_name": e0.get("full_name"), "employee_code": e0.get("employee_code"), "id_label": id_label}
    fr = {"verified": True, "score": ident["score"], "threshold": ident["threshold"],
          "face_profile_id": ident["face_profile_id"], "error": None}
    res = await _finalize(sb, org, eid, ct, fr, ls, di, lat, lon, settings, None, "kiosk_device")
    e = _data(sb.table("employees").select("full_name, employee_code").eq("id", eid).maybe_single().execute())
    res.update({"employee_name": e.get("full_name"), "employee_code": e.get("employee_code"), "id_label": id_label})
    return res


@router.post("/api/kiosk/check-in")
async def kci(request: Request, image: UploadFile = File(...), liveness_session_id: str = Form(""),
              device_info: str = Form("{}"), latitude: str | None = Form(None), longitude: str | None = Form(None)):
    return await _kiosk(request, "check_in", image, device_info, latitude, longitude, liveness_session_id)


@router.post("/api/kiosk/check-out")
async def kco(request: Request, image: UploadFile = File(...), liveness_session_id: str = Form(""),
              device_info: str = Form("{}"), latitude: str | None = Form(None), longitude: str | None = Form(None)):
    return await _kiosk(request, "check_out", image, device_info, latitude, longitude, liveness_session_id)


def _parse_date(value, label):
    if not value:
        return None
    try:
        return date.fromisoformat(value[:10])
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid {label}: {value}. Use YYYY-MM-DD.")


@router.get("/api/admin/reports")
async def reports(request: Request, date_from: str | None = Query(None), date_to: str | None = Query(None)):
    p = get_user_profile(request)
    check_permission(p, *STAFF)
    sb = get_supabase()
    org = p["organization_id"]

    d_from, d_to, today = _parse_date(date_from, "date_from"), _parse_date(date_to, "date_to"), date.today()
    if d_from is None and d_to is None:
        d_from = d_to = today
    elif d_from is None:
        d_from = d_to
    elif d_to is None:
        d_to = today
    if d_from > d_to:
        d_from, d_to = d_to, d_from
    days = (d_to - d_from).days + 1
    if days > MAX_REPORT_DAYS:
        raise HTTPException(status_code=400, detail=f"Date range is too long. Maximum is {MAX_REPORT_DAYS} days.")

    schema = get_org_schema(org)
    report_fields = [{"key": f["key"], "label": f["label"], "type": f["type"]}
                     for f in schema["fields"] if f.get("include_in_report")]

    total = (sb.table("employees").select("id", count="exact").eq("organization_id", org).eq("status", "active").execute()).count or 0
    sessions = (sb.table("attendance_sessions").select("*").eq("organization_id", org)
                .gte("attendance_date", d_from.isoformat()).lte("attendance_date", d_to.isoformat())
                .order("attendance_date", desc=True).limit(10000).execute().data or [])
    logs = (sb.table("attendance_logs").select("employee_id, attendance_date, face_match_score, liveness_score, created_at")
            .eq("organization_id", org).eq("verification_status", "verified")
            .gte("attendance_date", d_from.isoformat()).lte("attendance_date", d_to.isoformat())
            .order("created_at", desc=True).limit(20000).execute().data or [])
    score_map = {}
    for lg in logs:
        key = (lg.get("employee_id"), str(lg.get("attendance_date"))[:10])
        if key[0] and key not in score_map:
            score_map[key] = {"face_match_score": lg.get("face_match_score"), "liveness_score": lg.get("liveness_score")}

    emp_ids = list({s["employee_id"] for s in sessions if s.get("employee_id")})
    emp_map = {}
    if emp_ids:
        emps = sb.table("employees").select("id, full_name, employee_code, metadata, departments(name)").in_("id", emp_ids).execute().data or []
        emp_map = {e["id"]: e for e in emps}

    late = sum(1 for s in sessions if s["status"] == "late")
    checked_out = sum(1 for s in sessions if s["status"] == "checked_out")
    present = sum(1 for s in sessions if s["status"] == "present")
    failed = sum(1 for s in sessions if s["status"] in ("failed_verification", "rejected_liveness"))
    attended = present + late + checked_out
    expected = total * days

    records = []
    for s in sessions:
        d = emp_map.get(s["employee_id"], {})
        meta = d.get("metadata") if isinstance(d.get("metadata"), dict) else {}
        att_date = str(s.get("attendance_date"))[:10]
        sc = score_map.get((s["employee_id"], att_date), {})
        records.append({
            "employee_id": s["employee_id"], "employee_name": d.get("full_name", "Unknown"),
            "employee_code": d.get("employee_code", ""),
            "department": (d.get("departments") or {}).get("name") if d.get("departments") else None,
            "attendance_date": att_date, "status": s["status"],
            "check_in_time": s.get("check_in_time"), "check_out_time": s.get("check_out_time"),
            "face_match_score": sc.get("face_match_score"), "liveness_score": sc.get("liveness_score"),
            "details": {f["key"]: meta.get(f["key"]) for f in report_fields},
        })
    records.sort(key=lambda r: (r["attendance_date"], r["check_in_time"] or ""), reverse=True)

    return {"date_from": d_from.isoformat(), "date_to": d_to.isoformat(), "days": days,
            "labels": schema["labels"], "report_fields": report_fields,
            "total_employees": total, "present_today": attended, "attended_today": attended,
            "late_today": late, "checked_out": checked_out, "absent_today": max(0, expected - attended),
            "failed_verification_today": failed,
            "attendance_rate": attended / expected if expected > 0 else 0, "records": records}
