"""Face embedding extraction/comparison with a histogram fallback."""
import json
import numpy as np
import cv2
from app.config import FACE_MATCH_THRESHOLD


def extract_embedding(face_image: np.ndarray) -> list[float]:
    try:
        import face_recognition
        rgb = cv2.cvtColor(face_image, cv2.COLOR_BGR2RGB)
        encodings = face_recognition.face_encodings(rgb)
        if encodings:
            return encodings[0].tolist()
    except ImportError:
        pass
    return _histogram_embedding(face_image)


def _histogram_embedding(face: np.ndarray) -> list[float]:
    face_resized = cv2.resize(face, (128, 128))
    hsv = cv2.cvtColor(face_resized, cv2.COLOR_BGR2HSV)
    hist_h = cv2.calcHist([hsv], [0], None, [32], [0, 180]).flatten()
    hist_s = cv2.calcHist([hsv], [1], None, [32], [0, 256]).flatten()
    hist_v = cv2.calcHist([hsv], [2], None, [32], [0, 256]).flatten()
    emb = np.concatenate([hist_h, hist_s, hist_v])
    emb = emb / (np.linalg.norm(emb) + 1e-8)
    return emb.tolist()


def compare_embeddings(a: list[float], b: list[float]) -> float:
    va = np.array(a, dtype=np.float32)
    vb = np.array(b, dtype=np.float32)
    if va.shape != vb.shape:
        return 0.0
    na, nb = np.linalg.norm(va), np.linalg.norm(vb)
    if na == 0 or nb == 0:
        return 0.0
    cosine = float(np.dot(va, vb) / (na * nb))
    return max(0.0, min(1.0, (cosine + 1) / 2))


def is_match(a: list[float], b: list[float], threshold: float = None) -> tuple[bool, float]:
    if threshold is None:
        threshold = FACE_MATCH_THRESHOLD
    score = compare_embeddings(a, b)
    return score >= threshold, score


def serialize_embedding(embedding: list[float]) -> str:
    return json.dumps(embedding)


def deserialize_embedding(stored: str) -> list[float]:
    return json.loads(stored)
