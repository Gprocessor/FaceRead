import time, random, cv2, numpy as np
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
def get_random_challenge():
    c = random.choice(CHALLENGES); return {"challenge_type": c, "instruction": CHALLENGE_INSTRUCTIONS[c]}
def _eye_cascade(): return cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_eye.xml")
def _smile_cascade(): return cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_smile.xml")
def _centers(frames):
    out = []
    for img in frames:
        f = detect_faces(img)
        if not f: continue
        x, y, w, h = f[0]["box"]; H, W = img.shape[:2]
        out.append(((x + w/2)/W, (y + h/2)/H))
    return out
def _eye_counts(frames):
    eye = _eye_cascade(); out = []
    for img in frames:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY); f = detect_faces(img)
        if not f: out.append(0); continue
        x, y, w, h = f[0]["box"]; roi = gray[y:y+h, x:x+w]
        out.append(len(eye.detectMultiScale(roi, scaleFactor=1.1, minNeighbors=6, minSize=(15, 15))))
    return out
def _score_blink(frames):
    c = _eye_counts(frames)
    if not c: return 0.0
    ho = any(x >= 2 for x in c); hf = any(x < 2 for x in c)
    var = float(np.var(c)) if len(c) > 1 else 0.0
    s = 0.0
    if ho: s += 0.5
    if ho and hf: s += 0.3
    s += min(0.2, var / 4.0)
    return max(0.0, min(1.0, s))
def _score_turn(frames):
    c = _centers(frames)
    if len(c) < 2: return 0.0
    xs = [p[0] for p in c]
    return max(0.0, min(1.0, (max(xs) - min(xs)) * 4.0))
def _score_look(frames):
    c = _centers(frames)
    if not c: return 0.0
    cx = float(np.mean([p[0] for p in c])); cy = float(np.mean([p[1] for p in c]))
    return max(0.0, min(1.0, 1.0 - (((cx - 0.5)**2 + (cy - 0.5)**2)**0.5) * 2.0))
def _score_smile(frames):
    sm = _smile_cascade(); hits = seen = 0
    for img in frames:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY); f = detect_faces(img)
        if not f: continue
        seen += 1; x, y, w, h = f[0]["box"]; roi = gray[y+h//2:y+h, x:x+w]
        if len(sm.detectMultiScale(roi, scaleFactor=1.7, minNeighbors=20, minSize=(25, 25))) > 0: hits += 1
    return 0.0 if seen == 0 else max(0.0, min(1.0, hits / seen))
def analyze_frames(frames, challenge_type):
    start = time.time()
    dec = [img for raw in frames if (img := decode_image(raw)) is not None]
    n = len(dec)
    if n == 0:
        return {"passed": False, "liveness_score": 0.0, "failure_reason": "No valid frames received", "frame_count": 0, "processing_time_ms": int((time.time()-start)*1000)}
    if sum(1 for img in dec if detect_faces(img)) == 0:
        return {"passed": False, "liveness_score": 0.0, "failure_reason": "No face detected across submitted frames", "frame_count": n, "processing_time_ms": int((time.time()-start)*1000)}
    if challenge_type == "BLINK": s = _score_blink(dec)
    elif challenge_type in ("TURN_HEAD_LEFT", "TURN_HEAD_RIGHT"): s = _score_turn(dec)
    elif challenge_type == "LOOK_STRAIGHT": s = _score_look(dec)
    elif challenge_type == "SMILE": s = _score_smile(dec)
    else: s = _score_look(dec)
    passed = s >= LIVENESS_THRESHOLD
    return {"passed": passed, "liveness_score": round(float(s), 4), "failure_reason": None if passed else "Liveness challenge not satisfied", "frame_count": n, "processing_time_ms": int((time.time()-start)*1000)}
