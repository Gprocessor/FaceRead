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
    profile = get_user_profile(request)
    check_permission(profile, "super_admin", "org_admin", "hr_officer", "supervisor")
    sb = get_supabase()
    q = sb.table("employees").select("id, employee_code, full_name, email, status, departments(name)")
    if profile["role"] != "super_admin":
        q = q.eq("organization_id", profile["organization_id"])
    result = q.order("full_name").execute()
    employees = []
    for e in result.data or []:
        employees.append({"id": e["id"], "employee_code": e["employee_code"], "full_name": e["full_name"], "email": e.get("email"), "department": e.get("departments", {}).get("name") if e.get("departments") else None, "status": e["status"], "face_enrolled": False})
    # Single query for face-enrollment status (no head=True — unsupported by deployed postgrest-py).
    fp_query = sb.table("face_profiles").select("employee_id").eq("is_active", True)
    if profile["role"] != "super_admin":
        fp_query = fp_query.eq("organization_id", profile["organization_id"])
    fp_result = fp_query.execute()
    enrolled_ids = {row["employee_id"] for row in (fp_result.data or [])}
    for emp in employees:
        emp["face_enrolled"] = emp["id"] in enrolled_ids
    return employees
@router.post("/api/admin/employees")
async def create_employee(request: Request, body: CreateEmployeeRequest):
    profile = get_user_profile(request)
    check_permission(profile, "super_admin", "org_admin", "hr_officer")
    if not profile.get("organization_id"):
        raise HTTPException(status_code=400, detail="Your account has no organization assigned. Run the bootstrap SQL.")
    if not validate_employee_code(body.employee_code):
        raise HTTPException(status_code=400, detail="Invalid employee code format")
    sb = get_supabase()
    data = {"organization_id": profile["organization_id"], "employee_code": body.employee_code, "full_name": sanitize_string(body.full_name), "email": sanitize_string(body.email), "phone": sanitize_string(body.phone or ""), "position": sanitize_string(body.position or ""), "department_id": body.department_id or None, "hire_date": body.hire_date or None, "created_by": profile["user_id"]}
    result = sb.table("employees").insert(data).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create employee")
    emp_id = result.data[0]["id"]
    log_audit(profile["organization_id"], profile["user_id"], profile["role"], "employee_created", "employee", emp_id, {"employee_code": body.employee_code, "full_name": body.full_name})
    return {"success": True, "employee_id": emp_id, "message": "Employee created successfully"}
