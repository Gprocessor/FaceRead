import numpy as np, cv2
def detect_spoof(image):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    lap = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    conf = 0.2 if lap < 15 else 0.5 if lap < 50 else 0.85 if lap < 500 else 0.6
    return {"is_live": conf >= 0.5, "confidence": round(conf, 3), "method": "laplacian_variance_heuristic"}
