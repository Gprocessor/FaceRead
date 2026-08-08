import re
from collections import defaultdict
from time import time
class RateLimiter:
    def __init__(self,m=30,w=60): self.m=m; self.w=w; self._r=defaultdict(list)
    def check(self,key):
        n=time(); r=self._r[key]; r[:]=[t for t in r if n-t<self.w]
        if len(r)>=self.m: return False
        r.append(n); return True
rate_limiter=RateLimiter()
def sanitize_string(v,ml=255):
    if not v: return ""
    return re.sub(r"[<>\"'{}\\]","",v.strip()[:ml])
def validate_employee_code(c): return bool(re.match(r"^[A-Z0-9-]{3,20}$",c,re.IGNORECASE))
