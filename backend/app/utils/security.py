"""Security utilities — rate limiting and sanitization."""
import re
from collections import defaultdict
from time import time


class RateLimiter:
    def __init__(self, max_requests: int = 30, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window = window_seconds
        self._requests: dict[str, list[float]] = defaultdict(list)

    def check(self, key: str) -> bool:
        now = time()
        reqs = self._requests[key]
        reqs[:] = [t for t in reqs if now - t < self.window]
        if len(reqs) >= self.max_requests:
            return False
        reqs.append(now)
        return True


rate_limiter = RateLimiter()


def sanitize_string(value: str, max_length: int = 255) -> str:
    if not value:
        return ""
    value = value.strip()[:max_length]
    return re.sub(r"[<>\"'{}\\]", "", value)


def validate_employee_code(code: str) -> bool:
    return bool(re.match(r"^[A-Z0-9-]{3,20}$", code, re.IGNORECASE))
