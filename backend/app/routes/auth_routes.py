from fastapi import APIRouter, Request
from app.auth.jwt_validator import get_user_profile
router = APIRouter()
@router.get("/api/auth/me")
async def get_me(request: Request):
    p = get_user_profile(request)
    return {"user_id": p["user_id"], "email": p["email"], "role": p["role"], "organization_id": p["organization_id"], "full_name": p["full_name"]}
