"""
Face embedding extraction and comparison.

Uses the `face_recognition` library if available. Falls back to a
histogram-based feature extractor (OpenCV only) for environments where
dlib compilation is not feasible. The fallback is less accurate but
keeps the MVP functional.
"""
import json
import numpy as np
import cv2

from app.config import EMBEDDING_MODEL, FACE_MATCH_THRESHOLD
from app.face.detector import extract_face_region


def extract_embedding(face_image: np.ndarray) -> list[float]:
    """
    Extract a face embedding (numeric vector) from a cropped face image.
    Tries face_recognition first, falls back to OpenCV histogram features.
    """
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
    """
    Fallback embedding: normalized color histogram features.
    Less discriminative than deep embeddings but works without dlib.
    """
    face_resized = cv2.resize(face, (128, 128))
    hsv = cv2.cvtColor(face_resized, cv2.COLOR_BGR2HSV)
    hist_h = cv2.calcHist([hsv], [0], None, [32], [0, 180]).flatten()
    hist_s = cv2.calcHist([hsv], [1], None, [32], [0, 256]).flatten()
    hist_v = cv2.calcHist([hsv], [2], None, [32], [0, 256]).flatten()
    embedding = np.concatenate([hist_h, hist_s, hist_v])
    embedding = embedding / (np.linalg.norm(embedding) + 1e-8)
    return embedding.tolist()


def compare_embeddings(
    embedding_a: list[float], embedding_b: list[float]
) -> float:
    """
    Compare two embeddings and return a confidence score [0, 1].
    1.0 = identical match, 0.0 = no match.
    Uses cosine similarity.
    """
    a = np.array(embedding_a, dtype=np.float32)
    b = np.array(embedding_b, dtype=np.float32)
    if a.shape != b.shape:
        return 0.0
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    cosine = float(np.dot(a, b) / (norm_a * norm_b))
    return max(0.0, min(1.0, (cosine + 1) / 2))


def is_match(
    embedding_a: list[float], embedding_b: list[float], threshold: float = None
) -> tuple[bool, float]:
    """
    Check if two embeddings match. Returns (matched, score).
    """
    if threshold is None:
        threshold = FACE_MATCH_THRESHOLD
    score = compare_embeddings(embedding_a, embedding_b)
    return score >= threshold, score


def serialize_embedding(embedding: list[float]) -> str:
    """Serialize embedding for database storage."""
    return json.dumps(embedding)


def deserialize_embedding(stored: str) -> list[float]:
    """Deserialize embedding from database storage."""
    return json.loads(stored)
