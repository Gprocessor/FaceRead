"""OpenCV color-histogram engine — no ML deps. WEAK: testing/demo only."""
import numpy as np, cv2
from app.face.engines.base import BaseFaceEngine

class FallbackEngine(BaseFaceEngine):
    name = "fallback"
    def available(self) -> bool:
        return True  # opencv + numpy are always present
    def extract(self, face_image_bgr):
        r = cv2.resize(face_image_bgr, (128, 128))
        hsv = cv2.cvtColor(r, cv2.COLOR_BGR2HSV)
        h = cv2.calcHist([hsv], [0], None, [32], [0, 180]).flatten()
        s = cv2.calcHist([hsv], [1], None, [32], [0, 256]).flatten()
        v = cv2.calcHist([hsv], [2], None, [32], [0, 256]).flatten()
        e = np.concatenate([h, s, v]); e = e / (np.linalg.norm(e) + 1e-8)
        return e.astype(np.float32).tolist()
