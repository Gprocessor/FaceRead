"""
JWT validation — verifies Supabase-issued JWTs to authenticate API requests.
Extracts user_id, email, and role from the token claims.
"""
import jwt
from fastapi import HTTPException, status, Request

from app.config import JWT_SECRET


def _extract_token(request: Request) -> str:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header",
        )
    return auth[7:]


def validate_jwt(request: Request) -> dict:
    """
    Validate the Supabase JWT from the Authorization header.
    Returns the decoded payload containing user_id, email, role, etc.
    Raises 401 if the token is missing, expired, or invalid.
    """
    token = _extract_token(request)
    try:
        payload = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired",
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )


def get_user_id(request: Request) -> str:
    """Extract the user_id (sub) from a validated JWT."""
    payload = validate_jwt(request)
    uid = payload.get("sub")
    if not uid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing user ID",
        )
    return uid


def get_user_profile(request: Request) -> dict:
    """
    Validate the JWT and fetch the user's profile from Supabase.
    Returns a dict with: user_id, email, role, organization_id, full_name.
    """
    payload = validate_jwt(request)
    uid = payload.get("sub")
    if not uid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing user ID",
        )

    from app.database.supabase_client import get_supabase

    sb = get_supabase()
    result = sb.table("profiles").select("*").eq("user_id", uid).single().execute()
    profile = result.data
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Profile not found. Contact your administrator.",
        )
    if profile.get("status") != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is not active",
        )
    return {
        "user_id": uid,
        "email": payload.get("email", profile.get("email", "")),
        "role": profile.get("role", "employee"),
        "organization_id": profile.get("organization_id"),
        "full_name": profile.get("full_name"),
    }
