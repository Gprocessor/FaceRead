import logging
import os
import threading

import cv2
import numpy as np

from app.face.engines.base import BaseFaceEngine, EmbeddingUnavailableError

log = logging.getLogger("faceattend.engine.insightface")


class InsightFaceEngine(BaseFaceEngine):
    name = "insightface"

    def __init__(self, model_pack="buffalo_l"):
        self.model_pack = model_pack
        self._app = None
        self._lock = threading.Lock()
        try:
            self._det = int(os.environ.get("INSIGHTFACE_DET_SIZE", "640"))
        except (TypeError, ValueError):
            self._det = 640

    def available(self):
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
                    log.info("Loading InsightFace pack=%s det_size=%d", self.model_pack, self._det)
                    app = FaceAnalysis(name=self.model_pack, providers=["CPUExecutionProvider"])
                    app.prepare(ctx_id=-1, det_size=(self._det, self._det))
                    self._app = app
        return self._app

    def _detect(self, img):
        faces = self._load().get(img)
        if not faces:
            return None
        return max(faces, key=lambda x: (x.bbox[2] - x.bbox[0]) * (x.bbox[3] - x.bbox[1]))

    def extract(self, img):
        """
        The caller may pass a TIGHT face crop (from the OpenCV pre-detector).
        InsightFace's SCRFD detector often cannot find a face in a tight crop,
        so if the first pass finds nothing we upscale small crops, add a
        replicated border for margin, and retry.
        """
        if img is None or img.size == 0:
            raise EmbeddingUnavailableError("Empty image")

        face = self._detect(img)

        if face is None:
            work = img
            h, w = work.shape[:2]
            longest = max(h, w)
            if longest < 320:
                scale = 320.0 / float(longest)
                work = cv2.resize(work, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
                h, w = work.shape[:2]
            pad = int(0.4 * max(h, w))
            work = cv2.copyMakeBorder(work, pad, pad, pad, pad, cv2.BORDER_REPLICATE)
            face = self._detect(work)

        if face is None:
            raise EmbeddingUnavailableError(
                "Could not extract facial features. Move closer, face the camera, "
                "and ensure good lighting."
            )

        emb = getattr(face, "normed_embedding", None)
        if emb is None:
            emb = face.embedding
            emb = emb / (np.linalg.norm(emb) + 1e-8)
        return np.asarray(emb, dtype=np.float32).tolist()
