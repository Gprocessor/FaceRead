"""
Pydantic schemas for API request/response validation.
Note: file upload endpoints accept multipart form data, so those schemas
are handled via direct parameter extraction in the route handlers.
These schemas cover JSON request bodies and all response models.
"""
from pydantic import BaseModel, Field
from typing import Optional


class HealthResponse(BaseModel):
    status: str
    version: str
    face_model: str


class LivenessChallengeRequest(BaseModel):
    pass


class CreateEmployeeRequest(BaseModel):
    employee_code: str = Field(..., min_length=3, max_length=20)
    full_name: str = Field(..., min_length=2)
    email: str
    phone: Optional[str] = None
    position: Optional[str] = None
    department_id: Optional[str] = None
    hire_date: Optional[str] = None


class EnrollmentResult(BaseModel):
    success: bool
    employee_id: str
    face_profile_id: Optional[str] = None
    enrollment_status: str
    message: str
    face_detected: bool
    face_count: int


class VerificationResult(BaseModel):
    success: bool
    employee_id: str
    face_match_score: float
    verified: bool
    threshold: float
    message: str
    face_detected: bool
    face_count: int


class LivenessChallengeResponse(BaseModel):
    challenge_type: str
    instruction: str
    session_id: str


class LivenessResult(BaseModel):
    passed: bool
    challenge_type: str
    liveness_score: float
    failure_reason: Optional[str] = None
    frame_count: int
    processing_time_ms: int
    session_id: str


class CheckInOutResponse(BaseModel):
    success: bool
    employee_id: str
    attendance_log_id: str
    attendance_session_id: str
    check_type: str
    status: str
    verification_status: str
    face_match_score: float
    liveness_score: float
    message: str
    duplicate: bool
