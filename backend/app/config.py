import os
import logging

log = logging.getLogger("faceattend.config")


def _env(k, d=""):
    return os.environ.get(k, d)


def _flt(k, d):
    r = os.environ.get(k)
    try:
        return float(r) if r is not None else d
    except (TypeError, ValueError):
        return d


def _int(k, d):
    r = os.environ.get(k)
    try:
        return int(r) if r is not None else d
    except (TypeError, ValueError):
        return d


def _origins():
    return [o.strip() for o in _env("ALLOWED_ORIGINS", "http://localhost:5173").split(",") if o.strip()]


SUPABASE_URL = _env("SUPABASE_URL")
SUPABASE_ANON_KEY = _env("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_ROLE_KEY = _env("SUPABASE_SERVICE_ROLE_KEY")

FACE_MATCH_THRESHOLD = _flt("FACE_MATCH_THRESHOLD", 0.68)
MIN_FACE_CONFIDENCE = _flt("MIN_FACE_CONFIDENCE", 0.6)
MAX_ALLOWED_FACES = _int("MAX_ALLOWED_FACES", 1)

# A second face only counts as "another person" when it is roughly as large as
# the person at the camera. Smaller faces in the background are ignored instead
# of failing the whole scan.
SECONDARY_FACE_RATIO = _flt("SECONDARY_FACE_RATIO", 0.6)

LIVENESS_THRESHOLD = _flt("LIVENESS_THRESHOLD", 0.6)
LIVENESS_SESSION_TTL = _int("LIVENESS_SESSION_TTL", 300)
LIVENESS_SESSION_FILE = _env(
    "LIVENESS_SESSION_FILE",
    os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
        ".liveness_sessions.json",
    ),
)

ALLOWED_ORIGINS = _origins()
PORT = _int("PORT", 8000)

FACE_ENGINE = _env("FACE_ENGINE", "insightface")
INSIGHTFACE_MODEL = _env("INSIGHTFACE_MODEL", "buffalo_l")
