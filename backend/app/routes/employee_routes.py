"""
Employee management routes — admin endpoints for CRUD operations.
"""
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
    """List all employees in the caller's organization."""
    profile = get_user_profile(request)
    check_permission(profile, "super_admin", "org_admin", "hr_officer", "supervisor")

    sb = get_supabase()
    query = sb.table("employees").select(
        "id, employee_code, full_name, email, status, departments(name)"
    )
    if profile["role"] != "super_admin":
        query = query.eq("organization_id", profile["organization_id"])
    result = query.order("full_name").execute()

    employees = []
    for e in result.data or []:
        employees.append(
            {
                "id": e["id"],
                "employee_code": e["employee_code"],
                "full_name": e["full_name"],
                "email": e.get("email"),
                "department": e.get("departments", {}).get("name")
                if e.get("departments")
                else None,
                "status": e["status"],
                "face_enrolled": False,
            }
        )

    # Check face enrollment status
    for emp in employees:
        count_result = (
            sb.table("face_profiles")
            .select("id", count="exact", head=True)
            .eq("employee_id", emp["id"])
            .eq("is_active", True)
            .execute()
        )
        emp["face_enrolled"] = (count_result.count or 0) > 0

    return employees


@router.post("/api/admin/employees")
async def create_employee(request: Request, body: CreateEmployeeRequest):
    """Create a new employee record."""
    profile = get_user_profile(request)
    check_permission(profile, "super_admin", "org_admin", "hr_officer")

    if not validate_employee_code(body.employee_code):
        raise HTTPException(status_code=400, detail="Invalid employee code format")

    sb = get_supabase()
    employee_data = {
        "organization_id": profile["organization_id"],
        "employee_code": body.employee_code,
        "full_name": sanitize_string(body.full_name),
        "email": sanitize_string(body.email),
        "phone": sanitize_string(body.phone or ""),
        "position": sanitize_string(body.position or ""),
        "department_id": body.department_id or None,
        "hire_date": body.hire_date or None,
        "created_by": profile["user_id"],
    }
    result = sb.table("employees").insert(employee_data).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create employee")

    emp_id = result.data[0]["id"]
    log_audit(
        organization_id=profile["organization_id"],
        actor_user_id=profile["user_id"],
        actor_role=profile["role"],
        action="employee_created",
        entity_type="employee",
        entity_id=emp_id,
        details={"employee_code": body.employee_code, "full_name": body.full_name},
    )

    return {"success": True, "employee_id": emp_id, "message": "Employee created successfully"}
