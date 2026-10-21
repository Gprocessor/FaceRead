import math

import cv2
import numpy as np

from app.config import SECONDARY_FACE_RATIO

_cascade = None


def _get_cascade():
    """Load the Haar cascade once. It used to be re-read from disk on every
    single detect_faces() call, which was a measurable per-frame cost."""
    global _cascade
    if _cascade is None:
        _cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    return _cascade


def decode_image(b):
    return cv2.imdecode(np.frombuffer(b, np.uint8), cv2.IMREAD_COLOR)


def _confidence(weight):
    """
    Map an OpenCV Haar 'levelWeight' to a 0..1 confidence.

    detect_faces() previously returned a hardcoded 0.9 for every face, which
    meant MIN_FACE_CONFIDENCE had no effect at all. levelWeights are unbounded
    and roughly log-odds-like, so a logistic squash gives a usable score:
    weight 0.5 -> 0.68, 1.0 -> 0.82, 2.0 -> 0.95.
    """
    try:
        w = float(weight)
    except (TypeError, ValueError):
        return 0.9
    if not math.isfinite(w):
        return 0.9
    return max(0.0, min(1.0, 1.0 / (1.0 + math.exp(-1.5 * w))))


def detect_faces(image):
    if image is None or getattr(image, "size", 0) == 0:
        return []
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    cascade = _get_cascade()

    try:
        rects, _levels, weights = cascade.detectMultiScale3(
            gray, scaleFactor=1.1, minNeighbors=5, minSize=(60, 60), outputRejectLevels=True
        )
        out = []
        for i, (x, y, w, h) in enumerate(rects):
            weight = weights[i] if weights is not None and i < len(weights) else None
            out.append({
                "box": (int(x), int(y), int(w), int(h)),
                "confidence": _confidence(weight) if weight is not None else 0.9,
            })
        return out
    except Exception:
        # OpenCV build without detectMultiScale3: keep working, no scoring.
        rects = cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(60, 60))
        return [{"box": (int(x), int(y), int(w), int(h)), "confidence": 0.9} for (x, y, w, h) in rects]


def extract_face_region(image, box):
    x, y, w, h = box
    pad = int(0.15 * max(w, h))
    y0 = max(0, y - pad)
    x0 = max(0, x - pad)
    return image[y0:y + h + pad, x0:x + w + pad]


def _area(face):
    _x, _y, w, h = face["box"]
    return max(0, int(w)) * max(0, int(h))


def validate_single_face(faces, max_allowed=1, min_confidence=0.6):
    """
    Pick the person actually standing at the camera.

    The old behaviour rejected the frame whenever more than one face was found,
    so anyone walking past in the background broke the scan. Now the largest
    face wins, and only a comparably sized second face (someone genuinely
    sharing the frame) is treated as an error.
    """
    if not faces:
        return {"ok": False, "face": None, "error": "No face detected in the image"}

    ordered = sorted(faces, key=_area, reverse=True)
    primary = ordered[0]
    primary_area = _area(primary)

    if primary_area <= 0:
        return {"ok": False, "face": None, "error": "No usable face detected"}

    significant = [f for f in ordered if _area(f) >= SECONDARY_FACE_RATIO * primary_area]
    limit = max(1, int(max_allowed or 1))
    if len(significant) > limit:
        return {
            "ok": False,
            "face": None,
            "error": f"Multiple faces detected ({len(significant)}). Only one person may scan at a time.",
        }

    if primary["confidence"] < min_confidence:
        return {
            "ok": False,
            "face": None,
            "error": "Face not clear enough - move closer to the camera and improve the lighting",
        }

    return {"ok": True, "face": primary, "error": None}
