"""Attendance business logic."""
from datetime import datetime, date
from app.database.supabase_client import get_supabase
from app.config import FACE_MATCH_THRESHOLD, LIVENESS_THRESHOLD


def get_org_settings(organization_id: str) -> dict:
    sb = get_supabase()
    result = sb.table("app_settings").select("*").eq("organization_id", organization_id).maybe_single().execute()
    return result.data or {
        "late_threshold_minutes": 15, "work_start_time": "09:00", "work_end_time": "17:00",
        "require_liveness": True, "allow_multiple_check_in": False, "duplicate_check_window_minutes": 60,
        "face_match_threshold": FACE_MATCH_THRESHOLD, "liveness_threshold": LIVENESS_THRESHOLD,
    }


def check_duplicate(organization_id, employee_id, check_type, target_date=None):
    sb = get_supabase()
    target = target_date or date.today()
    result = (sb.table("attendance_logs").select("*")
              .eq("organization_id", organization_id).eq("employee_id", employee_id)
              .eq("attendance_date", target.isoformat()).eq("check_type", check_type)
              .order("created_at", desc=True).limit(1).execute())
    return result.data[0] if result.data else None


def determine_status(check_type, check_time, settings):
    if check_type == "check_out":
        return "checked_out"
    ws = settings.get("work_start_time", "09:00")
    late = settings.get("late_threshold_minutes", 15)
    sh, sm = map(int, ws.split(":"))
    deadline = check_time.replace(hour=sh, minute=sm, second=0, microsecond=0).replace(tzinfo=None)
    naive = check_time.replace(tzinfo=None) if check_time.tzinfo else check_time
    return "late" if (naive - deadline).total_seconds() / 60 > late else "present"


def create_attendance_session(organization_id, employee_id, attendance_date, status, check_in_time=None, check_out_time=None):
    sb = get_supabase()
    existing = (sb.table("attendance_sessions").select("*")
                .eq("employee_id", employee_id).eq("attendance_date", attendance_date.isoformat())
                .maybe_single().execute())
    data = {"organization_id": organization_id, "employee_id": employee_id,
            "attendance_date": attendance_date.isoformat(), "status": status}
    if check_in_time:
        data["check_in_time"] = check_in_time.isoformat()
    if check_out_time:
        data["check_out_time"] = check_out_time.isoformat()
    if existing.data:
        sid = existing.data["id"]
        upd = {k: v for k, v in data.items() if k not in ("organization_id", "employee_id")}
        sb.table("attendance_sessions").update(upd).eq("id", sid).execute()
        return sid
    res = sb.table("attendance_sessions").insert(data).execute()
    return res.data[0]["id"] if res.data else ""
