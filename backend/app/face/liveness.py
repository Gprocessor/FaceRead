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
    "BLINK": "Blink once, naturally",
    "TURN_HEAD_LEFT": "Slowly turn your head to the left, then back to centre",
    "TURN_HEAD_RIGHT": "Slowly turn your head to the right, then back to centre",
    "LOOK_STRAIGHT": "Look straight ahead and hold still",
    "SMILE": "Give the camera a natural smile",
}

# An open eye shows a dark pupil next to bright sclera, so the intensity spread
# inside the eye patch is wide. A closed eye is mostly even skin tone.
OPEN_SPREAD_REF = 0.45   # spread that counts as "fully open"
BLINK_DIP_REF = 0.22     # drop in openness that counts as a full blink
TURN_YAW_REF = 0.32      # nose offset (in eye-widths) that counts as a full turn
TURN_DRIFT_REF = 0.14    # fallback: face-box drift across the frame


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
    p10, p90 = np.percentile(patch, 10), np.percentile(patch, 90)
    spread = float(p90 - p10) / 255.0
    return _clamp(spread / OPEN_SPREAD_REF)


def _frame_features(img):
    """Per-frame eye openness, yaw proxy and face position. One detection pass."""
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
        # Geometric estimate when only a face box is available.
        left_eye = np.array([bx + 0.30 * bw, by + 0.38 * bh])
        right_eye = np.array([bx + 0.70 * bw, by + 0.38 * bh])
        nose = np.array([bx + 0.50 * bw, by + 0.55 * bh])

    interocular = float(np.linalg.norm(
        np.asarray(right_eye, dtype=float) - np.asarray(left_eye, dtype=float)))
    if interocular <= 1.0:
        interocular = max(4.0, 0.4 * float(bw))

    openness_vals = [v for v in (_eye_openness(gray, left_eye, interocular),
                                 _eye_openness(gray, right_eye, interocular)) if v is not None]
    openness = float(np.mean(openness_vals)) if openness_vals else None

    yaw = None
    if pts is not None:
        eye_mid_x = (float(left_eye[0]) + float(right_eye[0])) / 2.0
        yaw = (float(nose[0]) - eye_mid_x) / interocular

    return {
        "openness": openness,
        "yaw": yaw,
        "cx": (float(bx) + float(bw) / 2.0) / max(1.0, float(w)),
        "cy": (float(by) + float(bh) / 2.0) / max(1.0, float(h)),
    }


def _score_blink(feats):
    vals = [f["openness"] for f in feats if f["openness"] is not None]
    if len(vals) < 3:
        return 0.0
    dip = max(vals) - min(vals)
    score = dip / BLINK_DIP_REF
    if max(vals) < 0.25:
        # Eyes were never clearly open, so the dip is not trustworthy.
        score *= 0.6
    return _clamp(score)


def _score_turn(feats):
    yaws = [f["yaw"] for f in feats if f["yaw"] is not None]
    if len(yaws) >= 3:
        return _clamp((max(yaws) - min(yaws)) / TURN_YAW_REF)
    xs = [f["cx"] for f in feats]
    if len(xs) < 2:
        return 0.0
    return _clamp((max(xs) - min(xs)) / TURN_DRIFT_REF)


def _score_straight(feats):
    cx = float(np.mean([f["cx"] for f in feats]))
    cy = float(np.mean([f["cy"] for f in feats]))
    centered = _clamp(1.0 - (abs(cx - 0.5) * 2.0 + abs(cy - 0.5) * 2.0))
    yaws = [f["yaw"] for f in feats if f["yaw"] is not None]
    if yaws:
        straight = _clamp(1.0 - abs(float(np.mean(yaws))) / TURN_YAW_REF)
        return _clamp(0.5 * straight + 0.5 * centered)
    return centered


def analyze_frames(frames, ct):
    start = time.time()
    decoded = [img for raw in frames if (img := decode_image(raw)) is not None]
    n = len(decoded)

    def _done(passed, score, reason):
        return {
            "passed": passed,
            "liveness_score": round(float(score), 4),
            "failure_reason": reason,
            "frame_count": n,
            "processing_time_ms": int((time.time() - start) * 1000),
        }

    if n == 0:
        return _done(False, 0.0, "No valid frames received")

    feats = [f for f in (_frame_features(img) for img in decoded) if f is not None]
    if not feats:
        return _done(False, 0.0, "No face detected during the liveness check")

    if ct == "BLINK":
        score = _score_blink(feats)
    elif ct in ("TURN_HEAD_LEFT", "TURN_HEAD_RIGHT"):
        score = _score_turn(feats)
    else:
        score = _score_straight(feats)

    passed = score >= LIVENESS_THRESHOLD
    log.info("liveness challenge=%s frames=%d usable=%d score=%.3f passed=%s",
             ct, n, len(feats), score, passed)

    reason = None
    if not passed:
        # The score is included so the threshold can be tuned from real data.
        reason = f"Liveness challenge not satisfied (score {score:.2f}, needs {LIVENESS_THRESHOLD:.2f})"
    return _done(passed, score, reason)
