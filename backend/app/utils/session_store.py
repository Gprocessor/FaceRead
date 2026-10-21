import json
import os
import tempfile
import threading
import time
import uuid


class SessionStore:
    """
    Small file-backed key/value store with TTL.

    Liveness sessions used to live in a module-level dict. Running uvicorn with
    --reload restarts the worker whenever a .py file is saved, which wiped every
    in-flight session and produced "Invalid or expired liveness session" in the
    middle of a scan. Persisting to disk makes a session survive a reload.

    The file is written atomically (temp file + os.replace) and is a dotfile, so
    uvicorn's reloader (which watches *.py) will not react to it.
    """

    def __init__(self, path: str, ttl_seconds: int = 300):
        self._path = path
        self._ttl = max(30, int(ttl_seconds))
        self._lock = threading.Lock()

    # ---------- internals ----------
    def _read(self) -> dict:
        try:
            with open(self._path, "r", encoding="utf-8") as fh:
                data = json.load(fh)
            return data if isinstance(data, dict) else {}
        except FileNotFoundError:
            return {}
        except (json.JSONDecodeError, OSError, ValueError):
            return {}

    def _write(self, data: dict) -> None:
        folder = os.path.dirname(self._path) or "."
        try:
            os.makedirs(folder, exist_ok=True)
            fd, tmp = tempfile.mkstemp(dir=folder, prefix=".sess", suffix=".tmp")
            try:
                with os.fdopen(fd, "w", encoding="utf-8") as fh:
                    json.dump(data, fh)
                os.replace(tmp, self._path)
            except Exception:
                try:
                    os.unlink(tmp)
                except OSError:
                    pass
                raise
        except OSError:
            # A read-only filesystem must not break attendance; sessions then
            # simply behave as before (in-memory for this process only).
            pass

    def _purge(self, data: dict) -> dict:
        now = time.time()
        return {
            k: v for k, v in data.items()
            if isinstance(v, dict) and now - float(v.get("created_at", 0) or 0) <= self._ttl
        }

    # ---------- public API ----------
    def create(self, payload: dict) -> str:
        sid = str(uuid.uuid4())
        with self._lock:
            data = self._purge(self._read())
            record = dict(payload)
            record["created_at"] = time.time()
            record["used"] = False
            record["passed"] = bool(record.get("passed", False))
            record["liveness_score"] = float(record.get("liveness_score", 0.0))
            data[sid] = record
            self._write(data)
        return sid

    def get(self, sid: str):
        if not sid:
            return None
        with self._lock:
            return self._purge(self._read()).get(sid)

    def update(self, sid: str, **fields):
        if not sid:
            return None
        with self._lock:
            data = self._purge(self._read())
            record = data.get(sid)
            if not record:
                return None
            record.update(fields)
            data[sid] = record
            self._write(data)
            return record

    def consume(self, sid: str, owner_type: str, owner_id: str):
        """Single-use redemption: returns the session only once, and only if it passed."""
        if not sid:
            return None
        with self._lock:
            data = self._purge(self._read())
            record = data.get(sid)
            if not record:
                return None
            if record.get("owner_type") != owner_type or record.get("owner_id") != owner_id:
                return None
            if record.get("used") or not record.get("passed"):
                return None
            record["used"] = True
            data[sid] = record
            self._write(data)
            return record
