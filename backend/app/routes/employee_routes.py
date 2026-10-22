from fastapi import APIRouter, Request, HTTPException

from app.auth.jwt_validator import get_user_profile
from app.auth.permissions import check_permission
from app.database.supabase_client import get_supabase
from app.models.schemas import CreateEmployeeRequest, UpdateEmployeeRequest
from app.people.schema import get_org_schema, validate_metadata, column_values, COLUMN_KEYS
from app.utils.audit import log_audit
from app.utils.security import sanitize_string, validate_employee_code

router = APIRouter()
MANAGE = ("super_admin", "org_admin", "hr_officer")
VALID_STATUS = ("active", "inactive")


def _duplicate(err):
    msg = str(err)
    return "23505" in msg or "duplicate key" in msg.lower()


def _check_department(sb, org_id, dept_id):
    if not dept_id:
        return None
    r = sb.table("departments").select("id").eq("id", dept_id).eq("organization_id", org_id).maybe_single().execute()
    if not (getattr(r, "data", None) if r is not None else None):
        raise HTTPException(status_code=400, detail="Department not found in your organization")
    return dept_id


def _row(e):
    meta = dict(e.get("metadata") if isinstance(e.get("metadata"), dict) else {})
    for k in COLUMN_KEYS:
        if meta.get(k) in (None, "") and e.get(k) not in (None, ""):
            meta[k] = str(e[k])
    return {"id": e["id"], "employee_code": e["employee_code"], "full_name": e["full_name"],
            "email": e.get("email"), "department_id": e.get("department_id"),
            "department": (e.get("departments") or {}).get("name") if e.get("departments") else None,
            "status": e["status"], "metadata": meta, "face_enrolled": False}


@router.get("/api/admin/employees")
async def list_employees(request: Request):
    p = get_user_profile(request)
    check_permission(p, *MANAGE, "supervisor")
    sb = get_supabase()
    q = sb.table("employees").select("id, employee_code, full_name, email, phone, position, hire_date, status, department_id, metadata, departments(name)")
    if p["role"] != "super_admin":
        q = q.eq("organization_id", p["organization_id"])
    emps = [_row(e) for e in (q.order("full_name").execute().data or [])]
    fpq = sb.table("face_profiles").select("employee_id").eq("is_active", True)
    if p["role"] != "super_admin":
        fpq = fpq.eq("organization_id", p["organization_id"])
    enrolled = {row["employee_id"] for row in (fpq.execute().data or [])}
    for emp in emps:
        emp["face_enrolled"] = emp["id"] in enrolled
    return emps


@router.post("/api/admin/employees")
async def create_employee(request: Request, body: CreateEmployeeRequest):
    p = get_user_profile(request)
    check_permission(p, *MANAGE)
    org = p.get("organization_id")
    if not org:
        raise HTTPException(status_code=400, detail="No organization assigned")
    schema = get_org_schema(org)
    code = body.employee_code.strip()
    if not validate_employee_code(code):
        raise HTTPException(status_code=400, detail=f"Invalid {schema['labels']['id_label']}. Use letters, numbers, / - _ . and spaces (max 40).")
    submitted = dict(body.metadata or {})
    for k in ("email", "phone", "position", "hire_date"):
        v = getattr(body, k)
        if v not in (None, "") and k not in submitted:
            submitted[k] = v
    sb = get_supabase()
    meta = validate_metadata(schema["fields"], submitted)
    data = {"organization_id": org, "employee_code": code, "full_name": sanitize_string(body.full_name, 120),
            "department_id": _check_department(sb, org, body.department_id), "metadata": meta,
            "created_by": p["user_id"], **column_values(schema["fields"], meta)}
    try:
        r = sb.table("employees").insert(data).execute()
    except Exception as err:
        if _duplicate(err):
            raise HTTPException(status_code=409, detail=f"{schema['labels']['id_label']} '{code}' is already in use")
        raise
    if not r.data:
        raise HTTPException(status_code=500, detail="Failed to create record")
    eid = r.data[0]["id"]
    log_audit(org, p["user_id"], p["role"], "employee_created", "employee", eid, {"employee_code": code})
    return {"success": True, "employee_id": eid, "message": f"{schema['labels']['person_singular']} created"}


@router.put("/api/admin/employees/{employee_id}")
async def update_employee(employee_id: str, request: Request, body: UpdateEmployeeRequest):
    p = get_user_profile(request)
    check_permission(p, *MANAGE)
    sb = get_supabase()
    cur = sb.table("employees").select("id, organization_id, metadata").eq("id", employee_id).maybe_single().execute()
    row = getattr(cur, "data", None) if cur is not None else None
    if not row:
        raise HTTPException(status_code=404, detail="Record not found")
    org = row["organization_id"]
    if p["role"] != "super_admin" and org != p.get("organization_id"):
        raise HTTPException(status_code=403, detail="Not your organization")
    schema = get_org_schema(org)
    upd = {}
    if body.employee_code is not None:
        code = body.employee_code.strip()
        if not validate_employee_code(code):
            raise HTTPException(status_code=400, detail=f"Invalid {schema['labels']['id_label']}")
        upd["employee_code"] = code
    if body.full_name is not None:
        upd["full_name"] = sanitize_string(body.full_name, 120)
    if "department_id" in body.model_fields_set:
        upd["department_id"] = _check_department(sb, org, body.department_id)
    if body.status is not None:
        if body.status not in VALID_STATUS:
            raise HTTPException(status_code=400, detail="Status must be active or inactive")
        upd["status"] = body.status
    if body.metadata is not None:
        existing = row.get("metadata") if isinstance(row.get("metadata"), dict) else {}
        meta = validate_metadata(schema["fields"], body.metadata, existing)
        upd["metadata"] = meta
        upd.update(column_values(schema["fields"], meta))
    if not upd:
        return {"success": True, "employee_id": employee_id, "message": "Nothing to update"}
    try:
        sb.table("employees").update(upd).eq("id", employee_id).execute()
    except Exception as err:
        if _duplicate(err):
            raise HTTPException(status_code=409, detail=f"{schema['labels']['id_label']} is already in use")
        raise
    log_audit(org, p["user_id"], p["role"], "employee_updated", "employee", employee_id, {"fields": sorted(upd.keys())})
    return {"success": True, "employee_id": employee_id, "message": "Saved"}
