import json, numpy as np
from app.config import FACE_MATCH_THRESHOLD
from app.face.engine import get_engine
from app.face.engines.base import EmbeddingUnavailableError  # noqa: F401
def extract_embedding(face_image):
    eng = get_engine(); return eng.extract(face_image), eng.name
def compare_embeddings(a, b):
    va = np.array(a, dtype=np.float32); vb = np.array(b, dtype=np.float32)
    if va.shape != vb.shape: return 0.0
    na, nb = np.linalg.norm(va), np.linalg.norm(vb)
    if na == 0 or nb == 0: return 0.0
    return max(0.0, min(1.0, (float(np.dot(va, vb)/(na*nb))+1.0)/2.0))
def is_match(a, b, threshold=None):
    if threshold is None: threshold = FACE_MATCH_THRESHOLD
    s = compare_embeddings(a, b); return s >= threshold, s
def serialize_embedding(e): return json.dumps(e)
def deserialize_embedding(s): return json.loads(s)
