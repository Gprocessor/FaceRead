import logging, threading
import numpy as np
from app.face.engines.base import BaseFaceEngine, EmbeddingUnavailableError
log = logging.getLogger("faceattend.engine.insightface")
class InsightFaceEngine(BaseFaceEngine):
    name = "insightface"
    def __init__(self, model_pack="buffalo_l"): self.model_pack = model_pack; self._app = None; self._lock = threading.Lock()
    def available(self):
        try: import insightface; return True
        except Exception: return False
    def _load(self):
        if self._app is None:
            with self._lock:
                if self._app is None:
                    from insightface.app import FaceAnalysis
                    app = FaceAnalysis(name=self.model_pack, providers=["CPUExecutionProvider"]); app.prepare(ctx_id=-1, det_size=(320,320)); self._app = app
        return self._app
    def extract(self, img):
        faces = self._load().get(img)
        if not faces: raise EmbeddingUnavailableError("Could not extract facial features (InsightFace)")
        f = max(faces, key=lambda x: (x.bbox[2]-x.bbox[0])*(x.bbox[3]-x.bbox[1]))
        emb = getattr(f, "normed_embedding", None)
        if emb is None: emb = f.embedding; emb = emb/(np.linalg.norm(emb)+1e-8)
        return np.asarray(emb, dtype=np.float32).tolist()
