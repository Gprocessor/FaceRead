import re
from collections import defaultdict
from time import time
class RateLimiter:
    def __init__(self, max_requests=30, window_seconds=60):
        self.max_requests = max_requests; self.window = window_seconds; self._requests = defaultdict(list)
    def check(self, key):
        now = time(); reqs = self._requests[key]
        reqs[:] = [t for t in reqs if now - t < self.window]
        if len(reqs) >= self.max_requests: return False
        reqs.append(now); return True
rate_limiter = RateLimiter()
def sanitize_string(value, max_length=255):
    if not value: return ""
    return re.sub(r"[<>\"'{}\\]", "", value.strip()[:max_length])
def validate_employee_code(code): return bool(re.match(r"^[A-Z0-9-]{3,20}$", code, re.IGNORECASE))
