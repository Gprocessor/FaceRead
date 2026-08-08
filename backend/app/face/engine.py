import logging, os
from app.face.engines.base import EmbeddingUnavailableError  # noqa: F401
from app.face.engines.insightface_engine import InsightFaceEngine
from app.face.engines.face_recognition_engine import FaceRecognitionEngine
from app.face.engines.fallback_engine import FallbackEngine
log = logging.getLogger("faceattend.engine")
_engine = None
def _build(name):
    if name == "insightface": return InsightFaceEngine(model_pack=os.environ.get("INSIGHTFACE_MODEL","buffalo_l"))
    if name == "face_recognition": return FaceRecognitionEngine()
    if name == "fallback": return FallbackEngine()
    return None
def _select():
    req = os.environ.get("FACE_ENGINE","insightface").strip().lower()
    strict = os.environ.get("STRICT_FACE_ENGINE","false").strip().lower() in ("1","true","yes")
    order = ["insightface","face_recognition","fallback"] if req == "auto" else ([req] + [e for e in ["insightface","face_recognition","fallback"] if e != req] if not strict else [req])
    for name in order:
        eng = _build(name)
        if eng and eng.available(): log.info("Face engine: %s", name); return eng
        if strict and name == req: raise RuntimeError(f"FACE_ENGINE='{req}' deps not installed")
    return FallbackEngine()
def get_engine():
    global _engine
    if _engine is None: _engine = _select()
    return _engine
def engine_name(): return get_engine().name
def engine_available():
    try: return get_engine().available()
    except Exception: return False
