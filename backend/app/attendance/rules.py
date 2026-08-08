def should_reject_duplicate(settings, check_type):
    if check_type=="check_in": return not settings.get("allow_multiple_check_in",False)
    return True
