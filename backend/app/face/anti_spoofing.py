"""Anti-spoofing placeholder (Laplacian-variance heuristic)."""
import numpy as np
import cv2


def detect_spoof(image: np.ndarray) -> dict:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    lap_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    if lap_var < 15:
        confidence = 0.2
    elif lap_var < 50:
        confidence = 0.5
    elif lap_var < 500:
        confidence = 0.85
    else:
        confidence = 0.6
    return {"is_live": confidence >= 0.5, "confidence": round(confidence, 3), "method": "laplacian_variance_heuristic"}
