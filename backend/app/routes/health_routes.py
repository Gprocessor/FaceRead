from fastapi import APIRouter
from app.models.schemas import HealthResponse
from app.face.engine import engine_name, engine_available
router = APIRouter()
@router.get("/api/health", response_model=HealthResponse)
async def health():
    model = engine_name() if engine_available() else "unavailable"
    return HealthResponse(status="ok", version="1.0.0", face_model=model)
