import numpy as np, cv2
from app.face.engines.base import BaseFaceEngine, EmbeddingUnavailableError
class FaceRecognitionEngine(BaseFaceEngine):
    name = "face_recognition"
    def available(self):
        try: import face_recognition; return True
        except Exception: return False
    def extract(self, img):
        import face_recognition
        enc = face_recognition.face_encodings(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
        if not enc: raise EmbeddingUnavailableError("Could not extract facial landmarks (face_recognition)")
        return np.asarray(enc[0], dtype=np.float32).tolist()
