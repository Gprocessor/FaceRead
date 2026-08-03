"""
Attendance service — business logic for check-in/check-out, duplicate
prevention, status determination, and attendance session management.
"""
from datetime import datetime, date
from app.database.supabase_client import get_supabase
from app.config import FACE_MATCH_THRESHOLD, LIVENESS_THRESHOLD


def get_org_settings(organization_id: str) -> dict:
    """Fetch organization-level attendance settings."""
    sb = get_supabase()
    result = (
        sb.table("app_settings")
        .select("*")
        .eq("organization_id", organization_id)
        .maybeSingle()
        .execute()
    )
    return result.data or {
        "late_threshold_minutes": 15,
        "work_start_time": "09:00",
        "work_end_time": "17:00",
        "require_liveness": True,
        "allow_multiple_check_in": False,
        "duplicate_check_window_minutes": 60,
        "face_match_threshold": FACE_MATCH_THRESHOLD,
        "liveness_threshold": LIVENESS_THRESHOLD,
    }


def check_duplicate(organization_id: str, employee_id: str, check_type: str, target_date: date | None = None) -> dict | None:
    """
    Check if an attendance log already exists for this employee today.
    Returns the existing log if duplicate found, None otherwise.
    """
    sb = get_supabase()
    target = target_date or date.today()
    result = (
        sb.table("attendance_logs")
        .select("*")
        .eq("organization_id", organization_id)
        .eq("employee_id", employee_id)
        .eq("attendance_date", target.isoformat())
        .eq("check_type", check_type)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


def determine_status(check_type: str, check_time: datetime, settings: dict) -> str:
    """Determine attendance status (present/late) based on check-in time."""
    if check_type == "check_out":
        return "checked_out"

    work_start = settings.get("work_start_time", "09:00")
    late_minutes = settings.get("late_threshold_minutes", 15)

    start_h, start_m = map(int, work_start.split(":"))
    deadline = check_time.replace(hour=start_h, minute=start_m, second=0, microsecond=0)
    deadline = deadline.replace(tzinfo=None)
    check_naive = check_time.replace(tzinfo=None) if check_time.tzinfo else check_time

    diff_minutes = (check_naive - deadline).total_seconds() / 60
    if diff_minutes > late_minutes:
        return "late"
    return "present"


def create_attendance_session(
    organization_id: str,
    employee_id: str,
    attendance_date: date,
    status: str,
    check_in_time: datetime | None = None,
    check_out_time: datetime | None = None,
) -> str:
    """Create or update an attendance session for the day. Returns session ID."""
    sb = get_supabase()

    existing = (
        sb.table("attendance_sessions")
        .select("*")
        .eq("employee_id", employee_id)
        .eq("attendance_date", attendance_date.isoformat())
        .maybeSingle()
        .execute()
    )

    session_data = {
        "organization_id": organization_id,
        "employee_id": employee_id,
        "attendance_date": attendance_date.isoformat(),
        "status": status,
    }
    if check_in_time:
        session_data["check_in_time"] = check_in_time.isoformat()
    if check_out_time:
        session_data["check_out_time"] = check_out_time.isoformat()

    if existing.data:
        session_id = existing.data["id"]
        update_data = {k: v for k, v in session_data.items() if k != "organization_id" and k != "employee_id"}
        sb.table("attendance_sessions").update(update_data).eq("id", session_id).execute()
        return session_id
    else:
        result = sb.table("attendance_sessions").insert(session_data).execute()
        return result.data[0]["id"] if result.data else ""
