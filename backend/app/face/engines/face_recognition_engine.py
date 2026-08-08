"""face_recognition (dlib) engine — accurate, permissive license, needs compilation."""
import numpy as np, cv2
from app.face.engines.base import BaseFaceEngine, EmbeddingUnavailableError

class FaceRecognitionEngine(BaseFaceEngine):
    name = "face_recognition"
    def available(self) -> bool:
        try:
            import face_recognition  # noqa: F401
            return True
        except Exception:
            return False
    def extract(self, face_image_bgr):
        import face_recognition
        rgb = cv2.cvtColor(face_image_bgr, cv2.COLOR_BGR2RGB)
        enc = face_recognition.face_encodings(rgb)
        if not enc:
            raise EmbeddingUnavailableError("Could not extract facial landmarks (face_recognition)")
        return np.asarray(enc[0], dtype=np.float32).tolist()
