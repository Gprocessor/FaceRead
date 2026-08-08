"""InsightFace engine (onnxruntime, CPU) — accurate, non-commercial models."""
import logging, threading
import numpy as np
from app.face.engines.base import BaseFaceEngine, EmbeddingUnavailableError
log = logging.getLogger("faceattend.engine.insightface")

class InsightFaceEngine(BaseFaceEngine):
    name = "insightface"
    def __init__(self, model_pack: str = "buffalo_l"):
        self.model_pack = model_pack
        self._app = None
        self._lock = threading.Lock()
    def available(self) -> bool:
        try:
            import insightface  # noqa: F401
            return True
        except Exception:
            return False
    def _load(self):
        if self._app is None:
            with self._lock:
                if self._app is None:
                    from insightface.app import FaceAnalysis
                    log.info("Loading InsightFace pack: %s", self.model_pack)
                    app = FaceAnalysis(name=self.model_pack, providers=["CPUExecutionProvider"])
                    app.prepare(ctx_id=-1, det_size=(640, 640))
                    self._app = app
                    log.info("InsightFace ready.")
        return self._app
    def extract(self, face_image_bgr):
        app = self._load()
        faces = app.get(face_image_bgr)
        if not faces:
            raise EmbeddingUnavailableError("Could not extract facial features (InsightFace)")
        def area(f):
            x1, y1, x2, y2 = f.bbox
            return (x2 - x1) * (y2 - y1)
        face = max(faces, key=area)
        emb = getattr(face, "normed_embedding", None)
        if emb is None:
            emb = face.embedding
            emb = emb / (np.linalg.norm(emb) + 1e-8)
        return np.asarray(emb, dtype=np.float32).tolist()
