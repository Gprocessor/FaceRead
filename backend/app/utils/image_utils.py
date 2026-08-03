"""
Image utility functions for decoding, resizing, and preprocessing.
"""
import cv2
import numpy as np


def decode_image_bytes(image_bytes: bytes) -> np.ndarray | None:
    """Decode raw image bytes into an OpenCV BGR array."""
    arr = np.frombuffer(image_bytes, np.uint8)
    return cv2.imdecode(arr, cv2.IMREAD_COLOR)


def resize_image(image: np.ndarray, max_width: int = 640) -> np.ndarray:
    """Resize image to a max width while maintaining aspect ratio."""
    h, w = image.shape[:2]
    if w <= max_width:
        return image
    ratio = max_width / w
    new_h = int(h * ratio)
    return cv2.resize(image, (max_width, new_h))


def normalize_face_image(face: np.ndarray, size: int = 128) -> np.ndarray:
    """Normalize a face crop for embedding extraction."""
    face = cv2.resize(face, (size, size))
    face = cv2.equalizeHist(cv2.cvtColor(face, cv2.COLOR_BGR2GRAY))
    return cv2.cvtColor(face, cv2.COLOR_GRAY2BGR)


def encode_image_to_bytes(image: np.ndarray, fmt: str = ".jpg") -> bytes:
    """Encode an OpenCV image to bytes."""
    success, buffer = cv2.imencode(fmt, image)
    if not success:
        return b""
    return buffer.tobytes()
