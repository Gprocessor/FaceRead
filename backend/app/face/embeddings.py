"""Embedding extraction/compare built on the selected face engine."""
import json, numpy as np
from app.config import FACE_MATCH_THRESHOLD
from app.face.engine import get_engine, engine_name
from app.face.engines.base import EmbeddingUnavailableError  # noqa: F401 re-export

def extract_embedding(face_image):
    """Return (embedding_list, model_name). Raises EmbeddingUnavailableError."""
    eng = get_engine()
    emb = eng.extract(face_image)
    return emb, f"{eng.name}"

def compare_embeddings(a, b) -> float:
    va = np.array(a, dtype=np.float32); vb = np.array(b, dtype=np.float32)
    if va.shape != vb.shape: return 0.0
    na, nb = np.linalg.norm(va), np.linalg.norm(vb)
    if na == 0 or nb == 0: return 0.0
    cosine = float(np.dot(va, vb) / (na * nb))
    return max(0.0, min(1.0, (cosine + 1.0) / 2.0))

def is_match(a, b, threshold=None):
    if threshold is None: threshold = FACE_MATCH_THRESHOLD
    score = compare_embeddings(a, b)
    return score >= threshold, score

def serialize_embedding(e): return json.dumps(e)
def deserialize_embedding(s): return json.loads(s)
