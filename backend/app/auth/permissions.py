"""Role-based permission checks for API endpoints."""
from fastapi import HTTPException, status


def check_permission(profile: dict, *allowed_roles: str) -> dict:
    if profile["role"] not in allowed_roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail=f"Requires one of: {', '.join(allowed_roles)}")
    return profile


def is_admin(profile: dict) -> bool:
    return profile["role"] in ("super_admin", "org_admin")


def is_hr_or_above(profile: dict) -> bool:
    return profile["role"] in ("super_admin", "org_admin", "hr_officer")
