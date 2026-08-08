import json, logging, os, numpy as np, cv2
from app.config import FACE_MATCH_THRESHOLD

log = logging.getLogger("faceattend.embeddings")

# Only ever true if the real face_recognition (dlib-based) library imports successfully.
try:
    import face_recognition  # noqa: F401
    FACE_RECOGNITION_AVAILABLE = True
except ImportError:
    FACE_RECOGNITION_AVAILABLE = False

# The histogram fallback is NOT real face recognition (it compares color/lighting,
# not facial geometry) and is trivially spoofed. It must never be used silently -
# it is only reachable if an operator explicitly opts in, understanding the risk.
ALLOW_WEAK_FACE_MATCH = os.environ.get("ALLOW_WEAK_FACE_MATCH", "false").strip().lower() in ("1", "true", "yes")

if not FACE_RECOGNITION_AVAILABLE and not ALLOW_WEAK_FACE_MATCH:
    log.warning(
        "face_recognition library is not installed (requirements-lite deploy?). "
        "Face enrollment/verification will be refused until the full model is "
        "installed (see requirements-full.txt / Dockerfile USE_FULL=1), or "
        "ALLOW_WEAK_FACE_MATCH=true is set to explicitly accept degraded, "
        "easily-spoofed color-histogram matching (not recommended)."
    )


class EmbeddingUnavailableError(RuntimeError):
    """Raised when no trustworthy face-embedding method is available."""


def extract_embedding(face_image):
    if FACE_RECOGNITION_AVAILABLE:
        import face_recognition
        rgb = cv2.cvtColor(face_image, cv2.COLOR_BGR2RGB)
        enc = face_recognition.face_encodings(rgb)
        if enc:
            return enc[0].tolist(), "face_recognition"
        # face_recognition is installed but couldn't find encodable landmarks -
        # do not silently degrade to the weak fallback for this real attempt.
        raise EmbeddingUnavailableError("Could not extract facial landmarks from the image")
    if ALLOW_WEAK_FACE_MATCH:
        return _histogram(face_image), "color_histogram_fallback"
    raise EmbeddingUnavailableError(
        "Face recognition model is not installed on this server. "
        "Deploy with the full requirements (face_recognition) to enable enrollment/verification."
    )


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
