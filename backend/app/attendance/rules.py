"""
Attendance rules — configurable rules for attendance validation.
"""
from datetime import datetime, date


def is_within_work_hours(settings: dict, check_time: datetime | None = None) -> bool:
    """Check if the given time is within configured work hours."""
    check = check_time or datetime.now()
    work_start = settings.get("work_start_time", "09:00")
    work_end = settings.get("work_end_time", "17:00")

    start_h, start_m = map(int, work_start.split(":"))
    end_h, end_m = map(int, work_end.split(":"))

    current_minutes = check.hour * 60 + check.minute
    start_minutes = start_h * 60 + start_m
    end_minutes = end_h * 60 + end_m

    return start_minutes <= current_minutes <= end_minutes


def calculate_late_minutes(settings: dict, check_in_time: datetime) -> int:
    """Calculate how many minutes late the check-in is."""
    work_start = settings.get("work_start_time", "09:00")
    late_threshold = settings.get("late_threshold_minutes", 15)

    start_h, start_m = map(int, work_start.split(":"))
    deadline = check_in_time.replace(hour=start_h, minute=start_m, second=0, microsecond=0)
    if check_in_time.tzinfo:
        deadline = deadline.replace(tzinfo=check_in_time.tzinfo)

    diff = (check_in_time - deadline).total_seconds() / 60
    return max(0, int(diff - late_threshold))


def should_reject_duplicate(settings: dict, check_type: str) -> bool:
    """Whether to reject duplicate check-ins based on org settings."""
    if check_type == "check_in":
        return not settings.get("allow_multiple_check_in", False)
    return True
