from typing import Any, Optional

from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel

from app.auth.jwt_validator import get_user_profile
from app.auth.permissions import check_permission
from app.people.presets import list_presets
from app.people.schema import get_org_schema, save_org_schema
from app.utils.audit import log_audit

router = APIRouter()


class SchemaBody(BaseModel):
    org_type: Optional[str] = None
    labels: dict[str, Any] = {}
    fields: list[dict[str, Any]] = []


@router.get("/api/people/presets")
async def presets():
    return list_presets()


@router.get("/api/org/people-schema")
async def read_schema(request: Request):
    p = get_user_profile(request)
    if not p.get("organization_id"):
        raise HTTPException(status_code=400, detail="No organization")
    return get_org_schema(p["organization_id"])


@router.put("/api/org/people-schema")
async def write_schema(body: SchemaBody, request: Request):
    p = get_user_profile(request)
    check_permission(p, "super_admin", "org_admin")
    if not p.get("organization_id"):
        raise HTTPException(status_code=400, detail="No organization")
    saved = save_org_schema(p["organization_id"], (body.org_type or "").lower(), body.labels, body.fields)
    log_audit(p["organization_id"], p["user_id"], p["role"], "people_schema_updated", "organization",
              p["organization_id"], {"org_type": saved["org_type"], "field_count": len(saved["fields"])})
    return saved
