"""Common interface every face engine implements."""
from __future__ import annotations
import numpy as np


class EmbeddingUnavailableError(RuntimeError):
    """Raised when an embedding could not be produced from an image."""


class BaseFaceEngine:
    name: str = "base"

    def available(self) -> bool:
        """True if this engine's dependencies are importable."""
        raise NotImplementedError

    def extract(self, face_image_bgr: "np.ndarray") -> list[float]:
        """Return a numeric embedding for the given BGR image/crop."""
        raise NotImplementedError
