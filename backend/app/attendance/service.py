from datetime import date

from app.config import FACE_MATCH_THRESHOLD, LIVENESS_THRESHOLD
from app.database.supabase_client import get_supabase


def _parse_hhmm(value, default="09:00"):
    """Parse a time string that may be 'HH:MM' or 'HH:MM:SS' (Postgres time)."""
    s = str(value or default)
    parts = s.split(":")
    try:
        h = int(parts[0])
        m = int(parts[1]) if len(parts) > 1 else 0
    except (ValueError, IndexError):
        h, m = 9, 0
    return h, m


def _first_row(resp):
    """Safely read a Supabase response that may be None (e.g. a 406)."""
    if resp is None:
        return None
    data = getattr(resp, "data", None)
    if not data:
        return None
    if isinstance(data, list):
        return data[0] if data else None
    return data


def get_org_settings(org_id):
    sb = get_supabase()
    r = sb.table("app_settings").select("*").eq("organization_id", org_id).maybe_single().execute()
    return _first_row(r) or {
        "late_threshold_minutes": 15, "work_start_time": "09:00", "work_end_time": "17:00",
        "require_liveness": True, "allow_multiple_check_in": False,
        "face_match_threshold": FACE_MATCH_THRESHOLD, "liveness_threshold": LIVENESS_THRESHOLD,
    }


def check_duplicate(org_id, employee_id, check_type, target_date=None):
    sb = get_supabase()
    t = target_date or date.today()
    r = (sb.table("attendance_logs").select("*")
         .eq("organization_id", org_id).eq("employee_id", employee_id)
         .eq("attendance_date", t.isoformat()).eq("check_type", check_type)
         .order("created_at", desc=True).limit(1).execute())
    return _first_row(r)


def determine_status(check_type, check_time, settings):
    if check_type == "check_out":
        return "checked_out"
    sh, sm = _parse_hhmm(settings.get("work_start_time", "09:00"))
    late = settings.get("late_threshold_minutes", 15)
    dl = check_time.replace(hour=sh, minute=sm, second=0, microsecond=0).replace(tzinfo=None)
    naive = check_time.replace(tzinfo=None) if check_time.tzinfo else check_time
    return "late" if (naive - dl).total_seconds() / 60 > late else "present"


def create_attendance_session(org_id, employee_id, attendance_date, status, cin=None, cout=None):
    sb = get_supabase()
    # limit(1) rather than maybe_single(): a 406/duplicate must never return
    # None and crash with "'NoneType' object has no attribute 'data'".
    existing = _first_row(
        sb.table("attendance_sessions").select("*")
        .eq("employee_id", employee_id)
        .eq("attendance_date", attendance_date.isoformat())
        .order("created_at", desc=True).limit(1).execute()
    )
    data = {
        "organization_id": org_id, "employee_id": employee_id,
        "attendance_date": attendance_date.isoformat(), "status": status,
    }
    if cin:
        data["check_in_time"] = cin.isoformat()
    if cout:
        data["check_out_time"] = cout.isoformat()

    if existing:
        sid = existing["id"]
        upd = {k: v for k, v in data.items() if k not in ("organization_id", "employee_id")}
        sb.table("attendance_sessions").update(upd).eq("id", sid).execute()
        return sid

    r = sb.table("attendance_sessions").insert(data).execute()
    row = _first_row(r)
    return row["id"] if row else ""
