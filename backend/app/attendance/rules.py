"""Configurable attendance rules."""
from datetime import datetime


def is_within_work_hours(settings: dict, check_time: datetime | None = None) -> bool:
    check = check_time or datetime.now()
    ws = settings.get("work_start_time", "09:00")
    we = settings.get("work_end_time", "17:00")
    sh, sm = map(int, ws.split(":"))
    eh, em = map(int, we.split(":"))
    cur = check.hour * 60 + check.minute
    return sh * 60 + sm <= cur <= eh * 60 + em


def calculate_late_minutes(settings: dict, check_in_time: datetime) -> int:
    ws = settings.get("work_start_time", "09:00")
    late = settings.get("late_threshold_minutes", 15)
    sh, sm = map(int, ws.split(":"))
    deadline = check_in_time.replace(hour=sh, minute=sm, second=0, microsecond=0)
    if check_in_time.tzinfo:
        deadline = deadline.replace(tzinfo=check_in_time.tzinfo)
    diff = (check_in_time - deadline).total_seconds() / 60
    return max(0, int(diff - late))


def should_reject_duplicate(settings: dict, check_type: str) -> bool:
    if check_type == "check_in":
        return not settings.get("allow_multiple_check_in", False)
    return True
