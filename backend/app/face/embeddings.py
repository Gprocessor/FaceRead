import json, logging, os, numpy as np, cv2
from app.config import FACE_MATCH_THRESHOLD
log = logging.getLogger("faceattend.embeddings")
try:
    import face_recognition  # noqa: F401
    FACE_RECOGNITION_AVAILABLE = True
except ImportError:
    FACE_RECOGNITION_AVAILABLE = False
ALLOW_WEAK_FACE_MATCH = os.environ.get("ALLOW_WEAK_FACE_MATCH", "false").strip().lower() in ("1", "true", "yes")
if not FACE_RECOGNITION_AVAILABLE and not ALLOW_WEAK_FACE_MATCH:
    log.warning("face_recognition not installed. Enrollment/verification refused until full model is installed or ALLOW_WEAK_FACE_MATCH=true.")
class EmbeddingUnavailableError(RuntimeError):
    """Raised when no trustworthy face-embedding method is available."""
def extract_embedding(face_image):
    if FACE_RECOGNITION_AVAILABLE:
        import face_recognition
        rgb = cv2.cvtColor(face_image, cv2.COLOR_BGR2RGB)
        enc = face_recognition.face_encodings(rgb)
        if enc:
            return enc[0].tolist(), "face_recognition"
        raise EmbeddingUnavailableError("Could not extract facial landmarks from the image")
    if ALLOW_WEAK_FACE_MATCH:
        return _histogram(face_image), "color_histogram_fallback"
    raise EmbeddingUnavailableError("Face recognition model is not installed on this server.")
def _histogram(face_image):
    r = cv2.resize(face_image, (128, 128)); hsv = cv2.cvtColor(r, cv2.COLOR_BGR2HSV)
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
