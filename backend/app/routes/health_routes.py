from fastapi import APIRouter
from app.models.schemas import HealthResponse
from app.face.embeddings import FACE_RECOGNITION_AVAILABLE, ALLOW_WEAK_FACE_MATCH
router = APIRouter()
@router.get("/api/health", response_model=HealthResponse)
async def health():
    if FACE_RECOGNITION_AVAILABLE: model = "face_recognition"
    elif ALLOW_WEAK_FACE_MATCH: model = "color_histogram_fallback (degraded, not recommended)"
    else: model = "unavailable"
    return HealthResponse(status="ok", version="1.0.0", face_model=model)
