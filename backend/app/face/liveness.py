"""
Liveness detection using OpenCV heuristics.

For the MVP, uses challenge-based liveness:
- BLINK: detect eye state changes across frames (eye cascade)
- TURN_HEAD_LEFT / TURN_HEAD_RIGHT: detect horizontal face-center movement
- LOOK_STRAIGHT: verify a face is centered and forward-facing
- SMILE: detect a smile via the smile cascade (optional)

MVP limitations:
- Blink detection alone is not enough for production
- Video replay attacks are possible
- Printed photo attacks may bypass weak systems
- Advanced anti-spoofing models should be added before commercial launch
"""
import time
import random
import cv2
import numpy as np

from app.config import LIVENESS_THRESHOLD
from app.face.detector import decode_image, detect_faces

CHALLENGES = ["BLINK", "TURN_HEAD_LEFT", "TURN_HEAD_RIGHT", "LOOK_STRAIGHT"]

CHALLENGE_INSTRUCTIONS = {
    "BLINK": "Blink your eyes naturally 2-3 times",
    "TURN_HEAD_LEFT": "Slowly turn your head to the left, then back to center",
    "TURN_HEAD_RIGHT": "Slowly turn your head to the right, then back to center",
    "LOOK_STRAIGHT": "Look straight ahead at the camera and hold still",
    "SMILE": "Give the camera a natural smile",
}


def get_random_challenge() -> dict:
    """Return a random challenge type and instruction."""
    challenge = random.choice(CHALLENGES)
    return {
        "challenge_type": challenge,
        "instruction": CHALLENGE_INSTRUCTIONS[challenge],
    }


def _eye_cascade():
    return cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_eye.xml")


def _smile_cascade():
    return cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_smile.xml")


def _face_centers(frames_bgr: list[np.ndarray]) -> list[tuple[float, float]]:
    """Return normalized (cx, cy) face centers across frames where a face is found."""
    centers: list[tuple[float, float]] = []
    for img in frames_bgr:
        faces = detect_faces(img)
        if not faces:
            continue
        x, y, w, h = faces[0]["box"]
        H, W = img.shape[:2]
        centers.append(((x + w / 2) / W, (y + h / 2) / H))
    return centers


def _eye_open_ratio(frames_bgr: list[np.ndarray]) -> list[int]:
    """Count detected eyes per frame (proxy for blink: open eyes -> closed -> open)."""
    eye = _eye_cascade()
    counts: list[int] = []
    for img in frames_bgr:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        faces = detect_faces(img)
        if not faces:
            counts.append(0)
            continue
        x, y, w, h = faces[0]["box"]
        roi = gray[y : y + h, x : x + w]
        eyes = eye.detectMultiScale(roi, scaleFactor=1.1, minNeighbors=6, minSize=(15, 15))
        counts.append(len(eyes))
    return counts


def _score_blink(frames_bgr: list[np.ndarray]) -> float:
    counts = _eye_open_ratio(frames_bgr)
    if not counts:
        return 0.0
    has_open = any(c >= 2 for c in counts)
    has_fewer = any(c < 2 for c in counts)
    variance = float(np.var(counts)) if len(counts) > 1 else 0.0
    score = 0.0
    if has_open:
        score += 0.5
    if has_open and has_fewer:
        score += 0.3
    score += min(0.2, variance / 4.0)
    return max(0.0, min(1.0, score))


def _score_turn(frames_bgr: list[np.ndarray], direction: str) -> float:
    centers = _face_centers(frames_bgr)
    if len(centers) < 2:
        return 0.0
    xs = [c[0] for c in centers]
    spread = max(xs) - min(xs)
    # Any meaningful horizontal movement counts; direction is a soft signal.
    score = min(1.0, spread * 4.0)
    return max(0.0, min(1.0, score))


def _score_look_straight(frames_bgr: list[np.ndarray]) -> float:
    centers = _face_centers(frames_bgr)
    if not centers:
        return 0.0
    cx = float(np.mean([c[0] for c in centers]))
    cy = float(np.mean([c[1] for c in centers]))
    # Closer to center (0.5, 0.5) => higher score.
    dist = ((cx - 0.5) ** 2 + (cy - 0.5) ** 2) ** 0.5
    return max(0.0, min(1.0, 1.0 - dist * 2.0))


def _score_smile(frames_bgr: list[np.ndarray]) -> float:
    smile = _smile_cascade()
    hits = 0
    seen = 0
    for img in frames_bgr:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        faces = detect_faces(img)
        if not faces:
            continue
        seen += 1
        x, y, w, h = faces[0]["box"]
        roi = gray[y + h // 2 : y + h, x : x + w]
        smiles = smile.detectMultiScale(roi, scaleFactor=1.7, minNeighbors=20, minSize=(25, 25))
        if len(smiles) > 0:
            hits += 1
    if seen == 0:
        return 0.0
    return max(0.0, min(1.0, hits / seen))


def analyze_frames(frames: list[bytes], challenge_type: str) -> dict:
    """
    Analyze a sequence of frames for the given liveness challenge.
    Returns: {passed, liveness_score, failure_reason, frame_count, processing_time_ms}
    """
    start = time.time()

    decoded: list[np.ndarray] = []
    for raw in frames:
        img = decode_image(raw)
        if img is not None:
            decoded.append(img)

    frame_count = len(decoded)
    if frame_count == 0:
        return {
            "passed": False,
            "liveness_score": 0.0,
            "failure_reason": "No valid frames received",
            "frame_count": 0,
            "processing_time_ms": int((time.time() - start) * 1000),
        }

    faces_seen = sum(1 for img in decoded if detect_faces(img))
    if faces_seen == 0:
        return {
            "passed": False,
            "liveness_score": 0.0,
            "failure_reason": "No face detected across submitted frames",
            "frame_count": frame_count,
            "processing_time_ms": int((time.time() - start) * 1000),
        }

    if challenge_type == "BLINK":
        score = _score_blink(decoded)
    elif challenge_type == "TURN_HEAD_LEFT":
        score = _score_turn(decoded, "left")
    elif challenge_type == "TURN_HEAD_RIGHT":
        score = _score_turn(decoded, "right")
    elif challenge_type == "LOOK_STRAIGHT":
        score = _score_look_straight(decoded)
    elif challenge_type == "SMILE":
        score = _score_smile(decoded)
    else:
        score = _score_look_straight(decoded)

    passed = score >= LIVENESS_THRESHOLD
    return {
        "passed": passed,
        "liveness_score": round(float(score), 4),
        "failure_reason": None if passed else "Liveness challenge not satisfied",
        "frame_count": frame_count,
        "processing_time_ms": int((time.time() - start) * 1000),
    }
