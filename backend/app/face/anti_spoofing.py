"""
Anti-spoofing module — placeholder for advanced anti-spoofing models.

MVP note: The current liveness detection uses challenge-based heuristics.
For production, integrate a trained anti-spoofing model (e.g., MiniFASNet,
Silent-Face-Anti-Spoofing, or a commercial SDK) to detect:
- Printed photo attacks
- Screen/replay attacks
- 3D mask attacks

This module provides the interface for future integration.
"""
import numpy as np
import cv2


def detect_spoof(image: np.ndarray) -> dict:
    """
    Basic anti-spoofing heuristic using image quality analysis.
    Returns: {is_live, confidence, method}

    Heuristic: real camera captures have moderate high-frequency detail
    (texture). Printed photos / low-quality screen replays tend to be
    either very flat (low Laplacian variance) or show moiré patterns.
    This is a weak proxy — replace with a trained model for production.
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    # Sharpness / texture via Laplacian variance
    lap_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())

    # Normalize into a rough 0..1 confidence band.
    # Very low variance (flat print) -> low confidence of being live.
    if lap_var < 15:
        confidence = 0.2
    elif lap_var < 50:
        confidence = 0.5
    elif lap_var < 500:
        confidence = 0.85
    else:
        # Extremely high can indicate noise / screen artifacts
        confidence = 0.6

    return {
        "is_live": confidence >= 0.5,
        "confidence": round(confidence, 3),
        "method": "laplacian_variance_heuristic",
    }
