from fastapi import APIRouter

from app.face.engine import engine_name, engine_available
from app.models.schemas import HealthResponse

router = APIRouter()


@router.get("/api/health", response_model=HealthResponse)
async def health():
    return HealthResponse(status="ok", version="1.4.1",
                          face_model=engine_name() if engine_available() else "unavailable")
