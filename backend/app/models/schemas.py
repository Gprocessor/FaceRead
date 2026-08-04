from pydantic import BaseModel, Field
from typing import Optional
class HealthResponse(BaseModel):
    status: str; version: str; face_model: str
class CreateEmployeeRequest(BaseModel):
    employee_code: str = Field(..., min_length=3, max_length=20)
    full_name: str = Field(..., min_length=2)
    email: str
    phone: Optional[str] = None
    position: Optional[str] = None
    department_id: Optional[str] = None
    hire_date: Optional[str] = None
