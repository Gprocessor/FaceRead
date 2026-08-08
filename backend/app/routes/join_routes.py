from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from app.auth.jwt_validator import validate_jwt, get_user_profile
from app.auth.permissions import check_permission
from app.database.supabase_client import get_supabase
from app.utils.audit import log_audit
router = APIRouter()
ASSIGNABLE=("employee","supervisor","hr_officer","org_admin")
class ApproveBody(BaseModel): role: str = "employee"
class RoleBody(BaseModel): role: str
@router.get("/api/me/join-status")
async def join_status(request: Request):
    uid=validate_jwt(request)["sub"]; sb=get_supabase()
    prof=sb.table("profiles").select("organization_id, role").eq("user_id",uid).maybe_single().execute()
    if prof.data and prof.data.get("organization_id"): return {"state":"member","role":prof.data["role"]}
    jr=sb.table("join_requests").select("status, organization_id").eq("user_id",uid).order("created_at",desc=True).limit(1).execute()
    if jr.data: return {"state":jr.data[0]["status"],"matched_org":bool(jr.data[0]["organization_id"])}
    return {"state":"none"}
def _admin(request):
    p=get_user_profile(request); check_permission(p,"super_admin","org_admin","hr_officer")
    if not p.get("organization_id"): raise HTTPException(status_code=400, detail="No organization")
    return p
@router.get("/api/admin/join-requests")
async def list_requests(request: Request):
    p=_admin(request); sb=get_supabase(); q=sb.table("join_requests").select("*").eq("status","pending")
    if p["role"]!="super_admin": q=q.eq("organization_id",p["organization_id"])
    return q.order("created_at",desc=True).execute().data or []
@router.post("/api/admin/join-requests/{rid}/approve")
async def approve(rid: str, body: ApproveBody, request: Request):
    p=_admin(request); role=body.role if body.role in ASSIGNABLE else "employee"
    if role=="org_admin": check_permission(p,"super_admin","org_admin")
    sb=get_supabase(); jr=sb.table("join_requests").select("*").eq("id",rid).maybe_single().execute()
    if not jr.data or jr.data["status"]!="pending": raise HTTPException(status_code=404, detail="Request not found or handled")
    org=jr.data["organization_id"] or p["organization_id"]
    if p["role"]!="super_admin" and org!=p["organization_id"]: raise HTTPException(status_code=403, detail="Not your organization")
    sb.table("profiles").upsert({"user_id":jr.data["user_id"],"organization_id":org,"role":role,"full_name":jr.data.get("full_name"),"email":jr.data.get("email"),"status":"active"},on_conflict="user_id").execute()
    sb.table("join_requests").update({"status":"approved","organization_id":org,"decided_by":p["user_id"],"decided_at":"now()"}).eq("id",rid).execute()
    log_audit(org,p["user_id"],p["role"],"join_request_approved","join_request",rid,{"role":role}); return {"success":True}
@router.post("/api/admin/join-requests/{rid}/reject")
async def reject(rid: str, request: Request):
    p=_admin(request); sb=get_supabase(); jr=sb.table("join_requests").select("*").eq("id",rid).maybe_single().execute()
    if not jr.data: raise HTTPException(status_code=404, detail="Request not found")
    sb.table("join_requests").update({"status":"rejected","decided_by":p["user_id"],"decided_at":"now()"}).eq("id",rid).execute()
    log_audit(p["organization_id"],p["user_id"],p["role"],"join_request_rejected","join_request",rid); return {"success":True}
@router.get("/api/admin/members")
async def members(request: Request):
    p=_admin(request); sb=get_supabase(); q=sb.table("profiles").select("id, user_id, full_name, email, role, status")
    if p["role"]!="super_admin": q=q.eq("organization_id",p["organization_id"])
    return q.order("full_name").execute().data or []
@router.post("/api/admin/members/{pid}/role")
async def set_role(pid: str, body: RoleBody, request: Request):
    p=get_user_profile(request); check_permission(p,"super_admin","org_admin")
    if body.role not in ASSIGNABLE: raise HTTPException(status_code=400, detail="Invalid role")
    sb=get_supabase(); t=sb.table("profiles").select("organization_id").eq("id",pid).maybe_single().execute()
    if not t.data: raise HTTPException(status_code=404, detail="Member not found")
    if p["role"]!="super_admin" and t.data["organization_id"]!=p["organization_id"]: raise HTTPException(status_code=403, detail="Not your organization")
    sb.table("profiles").update({"role":body.role}).eq("id",pid).execute()
    log_audit(p["organization_id"],p["user_id"],p["role"],"member_role_changed","profile",pid,{"role":body.role}); return {"success":True}
