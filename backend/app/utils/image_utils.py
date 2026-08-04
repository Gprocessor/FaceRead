import cv2, numpy as np
def decode_image_bytes(image_bytes): return cv2.imdecode(np.frombuffer(image_bytes, np.uint8), cv2.IMREAD_COLOR)
def resize_image(image, max_width=640):
    h, w = image.shape[:2]
    if w <= max_width: return image
    return cv2.resize(image, (max_width, int(h * (max_width / w))))
