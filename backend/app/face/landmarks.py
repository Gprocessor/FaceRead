import logging

import numpy as np

from app.face.engine import get_engine

log = logging.getLogger("faceattend.landmarks")


def landmarks_available() -> bool:
    try:
        return getattr(get_engine(), "name", "") == "insightface"
    except Exception:
        return False


def get_face_points(img):
    """
    Return the 5 InsightFace keypoints for the largest face, or None.

    Only the documented 5-point `kps` layout is used
    (left eye, right eye, nose, left mouth corner, right mouth corner).
    The 106-point model is deliberately not indexed here because its point
    ordering is not part of a stable public contract.
    """
    if img is None or getattr(img, "size", 0) == 0:
        return None
    try:
        eng = get_engine()
        if getattr(eng, "name", "") != "insightface":
            return None

        loader = getattr(eng, "_load", None)
        if loader is None:
            return None
        faces = loader().get(img)
        if not faces:
            return None

        face = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
        kps = getattr(face, "kps", None)
        if kps is None or len(kps) < 5:
            return None

        k = np.asarray(kps, dtype=float)
        x1, y1, x2, y2 = (float(v) for v in face.bbox)
        return {
            "left_eye": k[0],
            "right_eye": k[1],
            "nose": k[2],
            "mouth_left": k[3],
            "mouth_right": k[4],
            "bbox": (int(x1), int(y1), int(max(1, x2 - x1)), int(max(1, y2 - y1))),
            "det_score": float(getattr(face, "det_score", 0.0) or 0.0),
        }
    except Exception as exc:
        log.debug("landmark extraction failed: %s", exc)
        return None
