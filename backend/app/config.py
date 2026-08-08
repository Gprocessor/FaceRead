import os, logging
from typing import List
log = logging.getLogger("faceattend.config")
def _env(k,d=""): return os.environ.get(k,d)
def _flt(k,d):
    r=os.environ.get(k)
    try: return float(r) if r is not None else d
    except: return d
def _int(k,d):
    r=os.environ.get(k)
    try: return int(r) if r is not None else d
    except: return d
def _origins(): return [o.strip() for o in _env("ALLOWED_ORIGINS","http://localhost:5173").split(",") if o.strip()]
SUPABASE_URL=_env("SUPABASE_URL"); SUPABASE_ANON_KEY=_env("SUPABASE_ANON_KEY"); SUPABASE_SERVICE_ROLE_KEY=_env("SUPABASE_SERVICE_ROLE_KEY")
FACE_MATCH_THRESHOLD=_flt("FACE_MATCH_THRESHOLD",0.68); MIN_FACE_CONFIDENCE=_flt("MIN_FACE_CONFIDENCE",0.7); MAX_ALLOWED_FACES=_int("MAX_ALLOWED_FACES",1)
LIVENESS_THRESHOLD=_flt("LIVENESS_THRESHOLD",0.7); ALLOWED_ORIGINS=_origins(); PORT=_int("PORT",8000)
FACE_ENGINE=_env("FACE_ENGINE","insightface"); INSIGHTFACE_MODEL=_env("INSIGHTFACE_MODEL","buffalo_l")
