"""
Face detection using OpenCV + MediaPipe.
Detects faces in an image, validates count, and returns bounding boxes.
"""
import cv2
import numpy as np


def decode_image(image_bytes: bytes) -> np.ndarray | None:
    """Decode raw image bytes into an OpenCV BGR numpy array."""
    arr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    return img


def detect_faces(image: np.ndarray) -> list[dict]:
    """
    Detect faces in an image using OpenCV's Haar cascade (fast, dependency-free).
    Returns a list of dicts with: box (x, y, w, h), confidence.
    For production, replace with MediaPipe FaceDetection or MTCNN.
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    faces = cascade.detectMultiScale(
        gray,
        scaleFactor=1.1,
        minNeighbors=5,
        minSize=(60, 60),
    )
    results = []
    for (x, y, w, h) in faces:
        results.append({"box": (int(x), int(y), int(w), int(h)), "confidence": 0.9})
    return results


def extract_face_region(image: np.ndarray, box: tuple[int, int, int, int]) -> np.ndarray:
    """Crop the face region from the image."""
    x, y, w, h = box
    return image[y : y + h, x : x + w]


def validate_single_face(
    faces: list[dict], max_allowed: int = 1, min_confidence: float = 0.7
) -> dict:
    """
    Validate that exactly one face is present and meets confidence threshold.
    Returns a dict with: ok (bool), face (dict|None), error (str|None).
    """
    if len(faces) == 0:
        return {"ok": False, "face": None, "error": "No face detected in the image"}
    if len(faces) > max_allowed:
        return {
            "ok": False,
            "face": None,
            "error": f"Multiple faces detected ({len(faces)}). Only one person allowed.",
        }
    face = faces[0]
    if face["confidence"] < min_confidence:
        return {
            "ok": False,
            "face": None,
            "error": f"Face confidence too low ({face['confidence']:.2f})",
        }
    return {"ok": True, "face": face, "error": None}
