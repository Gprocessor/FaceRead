from __future__ import annotations
import numpy as np
class EmbeddingUnavailableError(RuntimeError): pass
class BaseFaceEngine:
    name = "base"
    def available(self) -> bool: raise NotImplementedError
    def extract(self, face_image_bgr: "np.ndarray") -> list[float]: raise NotImplementedError
