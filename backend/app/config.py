import os
from typing import List
def _env(k, d=""): return os.environ.get(k, d)
def _flt(k, d):
    try: return float(os.environ.get(k, str(d)))
    except (ValueError, TypeError): return d
def _int(k, d):
    try: return int(os.environ.get(k, str(d)))
    except (ValueError, TypeError): return d
def _origins() -> List[str]:
    return [o.strip() for o in _env("ALLOWED_ORIGINS", "http://localhost:5173").split(",") if o.strip()]
SUPABASE_URL = _env("SUPABASE_URL")
SUPABASE_ANON_KEY = _env("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_ROLE_KEY = _env("SUPABASE_SERVICE_ROLE_KEY")
FACE_MATCH_THRESHOLD = _flt("FACE_MATCH_THRESHOLD", 0.6)
MIN_FACE_CONFIDENCE = _flt("MIN_FACE_CONFIDENCE", 0.7)
MAX_ALLOWED_FACES = _int("MAX_ALLOWED_FACES", 1)
LIVENESS_THRESHOLD = _flt("LIVENESS_THRESHOLD", 0.7)
LIVENESS_FRAME_COUNT = _int("LIVENESS_FRAME_COUNT", 5)
ALLOWED_ORIGINS = _origins()
PORT = _int("PORT", 8000)
EMBEDDING_MODEL = "face_recognition"
