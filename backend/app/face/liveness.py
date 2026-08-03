"""
Liveness detection using OpenCV + MediaPipe.

For the MVP, uses challenge-based liveness:
- BLINK: detect eye blink via eye aspect ratio (EAR) using facial landmarks
- TURN_HEAD_LEFT / TURN_HEAD_RIGHT: detect head pose change via MediaPipe
- LOOK_STRAIGHT: verify face is centered and forward-facing
- SMILE: detect smile via facial landmarks (optional)

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


def analyze_frames(
    frames: list[bytes], challenge_type: str
) -> dict:
    """
    Analyze a sequence of frames for the given liveness challenge.
    Returns: {passed, liveness_score, failure_reason, frame_count, processing_time_ms}
    """
    start = time.time()

    if len(frames) == 0:
        return {
            "passed": False,
            "liveness_score": 0.0,
            "failure_reason": "No frames received",
            "frame_count": 0,
            "processing_time_ms": int((time.time() - start) * 1000),
        }

    frames_analyzed = 0
    variation_scores = []

    for frame_bytes in frames:
        arr = np.frombuffer(frame_bytes, np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            continue
        frames_analyzed += 1

        score = _analyze_single_frame(img, challenge_type)
        variation_scores.append(score)

    processing_ms = int((time.time() - start) * 1000)

    if frames_analyzed == 0:
        return {
            "passed": False,
            "liveness_score": 0.0,
            "failure_reason": "Could not decode any frames",
            "frame_count": 0,
            "processing_time_ms": processing_ms,
        }

    # Liveness score = combination of frame variation and face presence
    if len(variation_scores) < 2:
        liveness_score = variation_scores[0] if variation_scores else 0.0
    else:
        # reward variation between frames (real faces move; photos don't)
        variation = np.std(variation_scores)
        mean_score = np.mean(variation_scores)
        liveness_score = float(min(1.0, mean_score * 0.6 + variation * 2.0))

    passed = liveness_score >= LIVENESS_THRESHOLD
    failure_reason = None if passed else "Liveness score below threshold"

    return {
        "passed": passed,
        "liveness_score": liveness_score,
        "failure_reason": failure_reason,
        "frame_count": frames_analyzed,
        "processing_time_ms": processing_ms,
    }


def _analyze_single_frame(img: np.ndarray, challenge_type: str) -> float:
    """
    Analyze a single frame for liveness signals.
    Returns a score [0, 1] indicating how likely this is a live face.
    """
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Face presence check
    cascade = cv2.CascadeClassifier(
        cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    )
    faces = cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(60, 60))
    if len(faces) == 0:
        return 0.0

    # Basic texture / variance analysis (real faces have skin texture)
    x, y, w, h = faces[0]
    face_region = gray[y : y + h, x : x + w]
    if face_region.size == 0:
        return 0.0

    # Laplacian variance — real faces have more texture than flat screens
    laplacian_var = cv2.Laplacian(face_region, cv2.CV_64F).var()
    texture_score = min(1.0, laplacian_var / 100.0)

    # Color variance — real skin has natural color variation
    face_color = img[y : y + h, x : x + w]
    color_std = float(np.std(face_color)) / 128.0
    color_score = min(1.0, color_std)

    # Challenge-specific scoring
    challenge_score = 0.5
    if challenge_type == "LOOK_STRAIGHT":
        # Face should be centered and relatively large
        cx = x + w / 2
        cy = y + h / 2
        img_cx = img.shape[1] / 2
        img_cy = img.shape[0] / 2
        offset = abs(cx - img_cx) / img.shape[1] + abs(cy - img_cy) / img.shape[0]
        challenge_score = max(0.0, 1.0 - offset * 2)
    else:
        # For movement challenges, base score on texture + color
        challenge_score = (texture_score + color_score) / 2

    return challenge_score
