"""
Auth routes — token validation and user info endpoints.
"""
from fastapi import APIRouter, Request

from app.auth.jwt_validator import get_user_profile

router = APIRouter()


@router.get("/api/auth/me")
async def get_me(request: Request):
    """Return the authenticated user's profile."""
    profile = get_user_profile(request)
    return {
        "user_id": profile["user_id"],
        "email": profile["email"],
        "role": profile["role"],
        "organization_id": profile["organization_id"],
        "full_name": profile["full_name"],
    }
