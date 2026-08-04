from datetime import datetime
def is_within_work_hours(settings, check_time=None):
    check = check_time or datetime.now()
    sh, sm = map(int, settings.get("work_start_time", "09:00").split(":"))
    eh, em = map(int, settings.get("work_end_time", "17:00").split(":"))
    cur = check.hour*60 + check.minute
    return sh*60+sm <= cur <= eh*60+em
def calculate_late_minutes(settings, check_in_time):
    sh, sm = map(int, settings.get("work_start_time", "09:00").split(":"))
    late = settings.get("late_threshold_minutes", 15)
    dl = check_in_time.replace(hour=sh, minute=sm, second=0, microsecond=0)
    if check_in_time.tzinfo: dl = dl.replace(tzinfo=check_in_time.tzinfo)
    return max(0, int((check_in_time - dl).total_seconds()/60 - late))
def should_reject_duplicate(settings, check_type):
    if check_type == "check_in": return not settings.get("allow_multiple_check_in", False)
    return True
