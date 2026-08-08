"""
Face engine selector.

Choose the backend with the FACE_ENGINE env var:
  - "insightface"       accurate, non-commercial models, no dlib compile (default)
  - "face_recognition"  accurate, permissive license, needs cmake/dlib
  - "fallback"          opencv histogram, no ML deps — WEAK, testing only
  - "auto"              try insightface -> face_recognition -> fallback

If the chosen engine's deps aren't installed, we fall back gracefully (unless
STRICT_FACE_ENGINE=true, in which case we raise so misconfig is obvious).
"""
import logging, os
from app.face.engines.base import EmbeddingUnavailableError  # re-export
from app.face.engines.insightface_engine import InsightFaceEngine
from app.face.engines.face_recognition_engine import FaceRecognitionEngine
from app.face.engines.fallback_engine import FallbackEngine

log = logging.getLogger("faceattend.engine")
_engine = None

def _build(name: str):
    if name == "insightface":
        return InsightFaceEngine(model_pack=os.environ.get("INSIGHTFACE_MODEL", "buffalo_l"))
    if name == "face_recognition":
        return FaceRecognitionEngine()
    if name == "fallback":
        return FallbackEngine()
    return None

def _select():
    requested = os.environ.get("FACE_ENGINE", "insightface").strip().lower()
    strict = os.environ.get("STRICT_FACE_ENGINE", "false").strip().lower() in ("1", "true", "yes")
    order = ["insightface", "face_recognition", "fallback"] if requested == "auto" else [requested]
    # If not strict, allow falling through to the remaining engines.
    if not strict and requested != "auto":
        order = [requested] + [e for e in ["insightface", "face_recognition", "fallback"] if e != requested]
    for name in order:
        eng = _build(name)
        if eng is None:
            log.warning("Unknown FACE_ENGINE '%s'", name); continue
        if eng.available():
            if name != requested and requested != "auto":
                log.warning("Requested engine '%s' unavailable; using '%s' instead.", requested, name)
            log.info("Face engine selected: %s", name)
            return eng
        if strict and (name == requested):
            raise RuntimeError(f"FACE_ENGINE='{requested}' but its dependencies are not installed (STRICT_FACE_ENGINE=true).")
    # Last resort
    log.warning("No preferred engine available; using fallback (WEAK).")
    return FallbackEngine()

def get_engine():
    global _engine
    if _engine is None:
        _engine = _select()
    return _engine

def engine_name() -> str:
    return get_engine().name

def engine_available() -> bool:
    try:
        return get_engine().available()
    except Exception:
        return False
