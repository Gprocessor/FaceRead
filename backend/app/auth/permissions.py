"""
Role-based permission checks for API endpoints.
"""
from fastapi import HTTPException, status
from app.auth.jwt_validator import get_user_profile


def require_roles(*roles: str):
    """
    FastAPI dependency that checks the authenticated user has one of the
    specified roles. Usage:

        @router.get("/admin/employees", dependencies=[Depends(require_roles("org_admin", "super_admin"))])
    """
    def checker():
        profile = get_user_profile(__import__("fastapi").Request.__init__.__self__)  # placeholder
        if profile["role"] not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires one of: {', '.join(roles)}",
            )
        return profile
    return checker


def check_permission(profile: dict, *allowed_roles: str) -> dict:
    """Check that the profile has one of the allowed roles. Returns the profile."""
    if profile["role"] not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Requires one of: {', '.join(allowed_roles)}",
        )
    return profile


def is_admin(profile: dict) -> bool:
    return profile["role"] in ("super_admin", "org_admin")


def is_hr_or_above(profile: dict) -> bool:
    return profile["role"] in ("super_admin", "org_admin", "hr_officer")
