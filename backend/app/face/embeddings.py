import json
import numpy as np
import cv2
from app.config import FACE_MATCH_THRESHOLD
def extract_embedding(face_image):
    try:
        import face_recognition
        rgb = cv2.cvtColor(face_image, cv2.COLOR_BGR2RGB)
        enc = face_recognition.face_encodings(rgb)
        if enc:
            return enc[0].tolist()
    except ImportError:
        pass
    return _histogram(face_image)
def _histogram(face):
    r = cv2.resize(face, (128, 128))
    hsv = cv2.cvtColor(r, cv2.COLOR_BGR2HSV)
    h = cv2.calcHist([hsv], [0], None, [32], [0, 180]).flatten()
    s = cv2.calcHist([hsv], [1], None, [32], [0, 256]).flatten()
    v = cv2.calcHist([hsv], [2], None, [32], [0, 256]).flatten()
    e = np.concatenate([h, s, v]); e = e / (np.linalg.norm(e) + 1e-8)
    return e.tolist()
def compare_embeddings(a, b):
    va = np.array(a, dtype=np.float32); vb = np.array(b, dtype=np.float32)
    if va.shape != vb.shape: return 0.0
    na, nb = np.linalg.norm(va), np.linalg.norm(vb)
    if na == 0 or nb == 0: return 0.0
    return max(0.0, min(1.0, (float(np.dot(va, vb) / (na * nb)) + 1) / 2))
def is_match(a, b, threshold=None):
    if threshold is None: threshold = FACE_MATCH_THRESHOLD
    score = compare_embeddings(a, b)
    return score >= threshold, score
def serialize_embedding(e): return json.dumps(e)
def deserialize_embedding(s): return json.loads(s)
