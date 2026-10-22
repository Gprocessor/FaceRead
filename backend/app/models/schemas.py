from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str
    version: str
    face_model: str


class CreateEmployeeRequest(BaseModel):
    employee_code: str = Field(..., min_length=1, max_length=40)
    full_name: str = Field(..., min_length=2, max_length=120)
    department_id: Optional[str] = None
    metadata: Dict[str, Any] = {}
    email: Optional[str] = None
    phone: Optional[str] = None
    position: Optional[str] = None
    hire_date: Optional[str] = None


class UpdateEmployeeRequest(BaseModel):
    employee_code: Optional[str] = Field(None, min_length=1, max_length=40)
    full_name: Optional[str] = Field(None, min_length=2, max_length=120)
    department_id: Optional[str] = None
    status: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
