from fastapi import APIRouter, Request, HTTPException
from app.auth.jwt_validator import get_user_profile
from app.auth.permissions import check_permission
from app.database.supabase_client import get_supabase
from app.models.schemas import CreateEmployeeRequest
from app.utils.audit import log_audit
from app.utils.security import sanitize_string, validate_employee_code
router = APIRouter()
@router.get("/api/admin/employees")
async def list_employees(request: Request):
    p=get_user_profile(request); check_permission(p,"super_admin","org_admin","hr_officer","supervisor")
    sb=get_supabase(); q=sb.table("employees").select("id, employee_code, full_name, email, status, departments(name)")
    if p["role"]!="super_admin": q=q.eq("organization_id",p["organization_id"])
    res=q.order("full_name").execute(); emps=[]
    for e in res.data or []: emps.append({"id":e["id"],"employee_code":e["employee_code"],"full_name":e["full_name"],"email":e.get("email"),"department":e.get("departments",{}).get("name") if e.get("departments") else None,"status":e["status"],"face_enrolled":False})
    fpq=sb.table("face_profiles").select("employee_id").eq("is_active",True)
    if p["role"]!="super_admin": fpq=fpq.eq("organization_id",p["organization_id"])
    enrolled={row["employee_id"] for row in (fpq.execute().data or [])}
    for emp in emps: emp["face_enrolled"]=emp["id"] in enrolled
    return emps
@router.post("/api/admin/employees")
async def create_employee(request: Request, body: CreateEmployeeRequest):
    p=get_user_profile(request); check_permission(p,"super_admin","org_admin","hr_officer")
    if not p.get("organization_id"): raise HTTPException(status_code=400, detail="No organization assigned")
    if not validate_employee_code(body.employee_code): raise HTTPException(status_code=400, detail="Invalid employee code format")
    sb=get_supabase(); data={"organization_id":p["organization_id"],"employee_code":body.employee_code,"full_name":sanitize_string(body.full_name),"email":sanitize_string(body.email),"phone":sanitize_string(body.phone or ""),"position":sanitize_string(body.position or ""),"department_id":body.department_id or None,"hire_date":body.hire_date or None,"created_by":p["user_id"]}
    r=sb.table("employees").insert(data).execute()
    if not r.data: raise HTTPException(status_code=500, detail="Failed to create employee")
    log_audit(p["organization_id"],p["user_id"],p["role"],"employee_created","employee",r.data[0]["id"],{"employee_code":body.employee_code})
    return {"success":True,"employee_id":r.data[0]["id"],"message":"Employee created successfully"}
