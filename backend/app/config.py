"""
Application configuration — reads from environment variables.
All sensitive values (service role key, JWT secret) stay server-side only.
"""
import os
from typing import List


def _get_env(key: str, default: str = "") -> str:
    return os.environ.get(key, default)


def _get_float(key: str, default: float) -> float:
    try:
        return float(os.environ.get(key, str(default)))
    except (ValueError, TypeError):
        return default


def _get_int(key: str, default: int) -> int:
    try:
        return int(os.environ.get(key, str(default)))
    except (ValueError, TypeError):
        return default


def _get_origins() -> List[str]:
    raw = _get_env("ALLOWED_ORIGINS", "http://localhost:5173")
    return [o.strip() for o in raw.split(",") if o.strip()]


SUPABASE_URL = _get_env("SUPABASE_URL")
SUPABASE_ANON_KEY = _get_env("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_ROLE_KEY = _get_env("SUPABASE_SERVICE_ROLE_KEY")
JWT_SECRET = _get_env("JWT_SECRET")

FACE_MATCH_THRESHOLD = _get_float("FACE_MATCH_THRESHOLD", 0.6)
MIN_FACE_CONFIDENCE = _get_float("MIN_FACE_CONFIDENCE", 0.7)
MAX_ALLOWED_FACES = _get_int("MAX_ALLOWED_FACES", 1)

LIVENESS_THRESHOLD = _get_float("LIVENESS_THRESHOLD", 0.7)
LIVENESS_FRAME_COUNT = _get_int("LIVENESS_FRAME_COUNT", 5)

ALLOWED_ORIGINS = _get_origins()
PORT = _get_int("PORT", 8000)

EMBEDDING_MODEL = "face_recognition"
