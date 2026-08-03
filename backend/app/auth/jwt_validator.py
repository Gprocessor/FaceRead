"""
JWT validation — verifies Supabase-issued tokens by asking Supabase to
validate them (algorithm-agnostic: works with the new ES256/JWKS keys and
the legacy HS256 secret). Avoids brittle local jwt.decode with a shared secret.
"""
import json
import urllib.request
import urllib.error
from fastapi import HTTPException, status, Request

from app.config import SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY


def _extract_token(request: Request) -> str:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header",
        )
    return auth[7:]


def _validate_with_supabase(token: str) -> dict:
    """
    Call Supabase's /auth/v1/user endpoint to validate the token.
    Returns the Supabase user object if valid, raises 401 otherwise.
    """
    if not SUPABASE_URL:
        raise HTTPException(status_code=500, detail="SUPABASE_URL not configured")

    apikey = SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY
    url = f"{SUPABASE_URL}/auth/v1/user"
    req = urllib.request.Request(url)
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("apikey", apikey)

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data
    except urllib.error.HTTPError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate token",
        )


def validate_jwt(request: Request) -> dict:
    """Validate the token and return a payload-like dict (sub, email, role)."""
    token = _extract_token(request)
    user = _validate_with_supabase(token)
    uid = user.get("id")
    if not uid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing user ID",
        )
    return {
        "sub": uid,
        "email": user.get("email", ""),
        "role": user.get("role", "authenticated"),
    }


def get_user_id(request: Request) -> str:
    """Extract the user_id (sub) from a validated token."""
    return validate_jwt(request)["sub"]


def get_user_profile(request: Request) -> dict:
    """
    Validate the token and fetch the user's profile from Supabase.
    Returns a dict with: user_id, email, role, organization_id, full_name.
    """
    payload = validate_jwt(request)
    uid = payload["sub"]

    from app.database.supabase_client import get_supabase

    sb = get_supabase()
    result = sb.table("profiles").select("*").eq("user_id", uid).maybe_single().execute()
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