from fastapi import APIRouter
from app.models.schemas import HealthResponse
from app.face.engine import engine_name, engine_available
router = APIRouter()
@router.get("/api/health", response_model=HealthResponse)
async def health(): return HealthResponse(status="ok", version="1.2.0", face_model=engine_name() if engine_available() else "unavailable")
