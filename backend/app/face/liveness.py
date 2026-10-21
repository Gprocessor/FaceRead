import logging
import random
import time

import cv2
import numpy as np

from app.config import LIVENESS_THRESHOLD
from app.face.detector import decode_image, detect_faces
from app.face.landmarks import get_face_points

log = logging.getLogger("faceattend.liveness")

CHALLENGES = ["BLINK", "TURN_HEAD_LEFT", "TURN_HEAD_RIGHT", "LOOK_STRAIGHT"]
CI = {
    "BLINK": "Blink your eyes",
    "TURN_HEAD_LEFT": "Turn your head left, then back to the centre",
    "TURN_HEAD_RIGHT": "Turn your head right, then back to the centre",
    "LOOK_STRAIGHT": "Look straight at the camera and hold still",
    "SMILE": "Give the camera a natural smile",
}

# An open eye shows dark pupil against bright sclera (wide intensity spread);
# a closed lid is even skin tone.
OPEN_SPREAD_REF = 0.45
# Openness drop that counts as a full blink.
BLINK_DIP_REF = 0.18
# Change in nose-to-eye-centre offset (as a fraction of eye distance) that counts
# as a full turn. A "slight" turn is roughly 0.15-0.25.
TURN_YAW_REF = 0.22
# Face-centre drift across the frame (fraction of width) that counts as a full turn
# when landmarks are unavailable.
TURN_DRIFT_REF = 0.10


def get_random_challenge():
    c = random.choice(CHALLENGES)
    return {"challenge_type": c, "instruction": CI[c]}


def _clamp(v):
    return max(0.0, min(1.0, float(v)))


def _eye_openness(gray, eye_xy, interocular):
    half_w = max(4, int(0.22 * interocular))
    half_h = max(3, int(0.14 * interocular))
    cx, cy = int(round(float(eye_xy[0]))), int(round(float(eye_xy[1])))
    h, w = gray.shape[:2]
    x0, x1 = max(0, cx - half_w), min(w, cx + half_w)
    y0, y1 = max(0, cy - half_h), min(h, cy + half_h)
    if x1 - x0 < 4 or y1 - y0 < 3:
        return None
    patch = gray[y0:y1, x0:x1]
    if patch.size == 0:
        return None
    spread = float(np.percentile(patch, 90) - np.percentile(patch, 10)) / 255.0
    return _clamp(spread / OPEN_SPREAD_REF)


def _frame_features(img):
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape[:2]
    pts = get_face_points(img)
    if pts is not None:
        left_eye, right_eye, nose = pts["left_eye"], pts["right_eye"], pts["nose"]
        bx, by, bw, bh = pts["bbox"]
    else:
        faces = detect_faces(img)
        if not faces:
            return None
        bx, by, bw, bh = max(faces, key=lambda f: f["box"][2] * f["box"][3])["box"]
        left_eye = np.array([bx + 0.30 * bw, by + 0.38 * bh])
        right_eye = np.array([bx + 0.70 * bw, by + 0.38 * bh])
        nose = np.array([bx + 0.50 * bw, by + 0.55 * bh])

    interocular = float(np.linalg.norm(np.asarray(right_eye, float) - np.asarray(left_eye, float)))
    if interocular <= 1.0:
        interocular = max(4.0, 0.4 * float(bw))

    vals = [v for v in (_eye_openness(gray, left_eye, interocular),
                        _eye_openness(gray, right_eye, interocular)) if v is not None]
    yaw = None
    if pts is not None:
        yaw = (float(nose[0]) - (float(left_eye[0]) + float(right_eye[0])) / 2.0) / interocular

    return {
        "openness": float(np.mean(vals)) if vals else None,
        "yaw": yaw,
        "cx": (float(bx) + float(bw) / 2.0) / max(1.0, float(w)),
        "cy": (float(by) + float(bh) / 2.0) / max(1.0, float(h)),
    }


def _score_blink(feats):
    vals = [f["openness"] for f in feats if f["openness"] is not None]
    if len(vals) < 3:
        return 0.0
    score = (max(vals) - min(vals)) / BLINK_DIP_REF
    if max(vals) < 0.25:
        score *= 0.6
    return _clamp(score)


def _score_turn(feats):
    """
    Uses whichever signal moved most: head rotation from landmarks, or the face
    centre drifting across the frame. Direction is not enforced because the
    preview is mirrored and people often turn the 'wrong' way; any real turn
    proves a live, moving head.
    """
    yaw_score = 0.0
    yaws = [f["yaw"] for f in feats if f["yaw"] is not None]
    if len(yaws) >= 3:
        yaw_score = (max(yaws) - min(yaws)) / TURN_YAW_REF
    xs = [f["cx"] for f in feats]
    drift_score = 0.0 if len(xs) < 2 else (max(xs) - min(xs)) / TURN_DRIFT_REF
    return _clamp(max(yaw_score, drift_score))


def _score_straight(feats):
    cx = float(np.mean([f["cx"] for f in feats]))
    cy = float(np.mean([f["cy"] for f in feats]))
    # Anywhere in the middle 60% of the frame counts as centred.
    off = max(0.0, abs(cx - 0.5) - 0.2) + max(0.0, abs(cy - 0.5) - 0.2)
    centered = _clamp(1.0 - off * 3.0)
    yaws = [f["yaw"] for f in feats if f["yaw"] is not None]
    if yaws:
        facing = _clamp(1.0 - max(0.0, abs(float(np.mean(yaws))) - 0.08) / 0.3)
        return _clamp(0.5 * facing + 0.5 * centered)
    return centered


def analyze_frames(frames, ct):
    start = time.time()
    decoded = [img for raw in frames if (img := decode_image(raw)) is not None]
    n = len(decoded)

    def done(passed, score, reason):
        return {"passed": passed, "liveness_score": round(float(score), 4), "failure_reason": reason,
                "frame_count": n, "processing_time_ms": int((time.time() - start) * 1000)}

    if n == 0:
        return done(False, 0.0, "No valid frames received")
    feats = [f for f in (_frame_features(img) for img in decoded) if f is not None]
    if len(feats) < max(2, n // 2):
        return done(False, 0.0, "Face not visible in enough frames - stay in front of the camera")

    if ct == "BLINK":
        score = _score_blink(feats)
        hint = "blink more clearly"
    elif ct in ("TURN_HEAD_LEFT", "TURN_HEAD_RIGHT"):
        score = _score_turn(feats)
        hint = "turn your head a little further"
    else:
        score = _score_straight(feats)
        hint = "look straight at the camera"

    passed = score >= LIVENESS_THRESHOLD
    log.info("liveness %s frames=%d usable=%d score=%.3f passed=%s", ct, n, len(feats), score, passed)
    reason = None if passed else f"Liveness not confirmed - {hint} (score {score:.2f}, needs {LIVENESS_THRESHOLD:.2f})"
    return done(passed, score, reason)
