from fastapi import APIRouter
from app.models.schemas import HealthResponse
from app.config import EMBEDDING_MODEL

router = APIRouter()


@router.get("/api/health", response_model=HealthResponse)
async def health():
    return HealthResponse(status="ok", version="1.0.0", face_model=EMBEDDING_MODEL)
