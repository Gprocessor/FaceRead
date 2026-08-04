from app.database.supabase_client import get_supabase
from app.face.embeddings import deserialize_embedding, is_match
from app.config import FACE_MATCH_THRESHOLD
def get_employee_face_profile(employee_id):
    sb = get_supabase()
    r = sb.table("face_profiles").select("*").eq("employee_id", employee_id).eq("is_active", True).eq("enrollment_status", "completed").order("created_at", desc=True).limit(1).execute()
    return r.data[0] if r.data else None
def verify_against_profile(probe, employee_id, threshold=None):
    p = get_employee_face_profile(employee_id)
    if not p:
        return {"verified": False, "score": 0.0, "threshold": threshold or FACE_MATCH_THRESHOLD, "face_profile_id": None, "error": "No active face profile found for this employee"}
    matched, score = is_match(probe, deserialize_embedding(p["face_embedding"]), threshold)
    return {"verified": matched, "score": score, "threshold": threshold or FACE_MATCH_THRESHOLD, "face_profile_id": p["id"], "error": None if matched else "Face does not match stored profile"}
