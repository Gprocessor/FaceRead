"""Image utilities."""
import cv2
import numpy as np


def decode_image_bytes(image_bytes: bytes) -> np.ndarray | None:
    arr = np.frombuffer(image_bytes, np.uint8)
    return cv2.imdecode(arr, cv2.IMREAD_COLOR)


def resize_image(image: np.ndarray, max_width: int = 640) -> np.ndarray:
    h, w = image.shape[:2]
    if w <= max_width:
        return image
    ratio = max_width / w
    return cv2.resize(image, (max_width, int(h * ratio)))
