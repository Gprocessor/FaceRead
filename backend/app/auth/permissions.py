from fastapi import HTTPException
def check_permission(profile, *roles):
    if profile["role"] not in roles: raise HTTPException(status_code=403, detail=f"Requires one of: {', '.join(roles)}")
    return profile
def is_admin(p): return p["role"] in ("super_admin","org_admin")
def is_hr_or_above(p): return p["role"] in ("super_admin","org_admin","hr_officer")
