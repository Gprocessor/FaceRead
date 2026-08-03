"""Face matcher — compares a probe embedding against stored profiles."""
from app.database.supabase_client import get_supabase
from app.face.embeddings import deserialize_embedding, is_match
from app.config import FACE_MATCH_THRESHOLD


def get_employee_face_profile(employee_id: str) -> dict | None:
    sb = get_supabase()
    result = (
        sb.table("face_profiles").select("*")
        .eq("employee_id", employee_id).eq("is_active", True)
        .eq("enrollment_status", "completed")
        .order("created_at", desc=True).limit(1).execute()
    )
    return result.data[0] if result.data else None


def verify_against_profile(probe_embedding: list[float], employee_id: str, threshold: float = None) -> dict:
    profile = get_employee_face_profile(employee_id)
    if not profile:
        return {"verified": False, "score": 0.0, "threshold": threshold or FACE_MATCH_THRESHOLD,
                "face_profile_id": None, "error": "No active face profile found for this employee"}
    stored = deserialize_embedding(profile["face_embedding"])
    matched, score = is_match(probe_embedding, stored, threshold)
    return {"verified": matched, "score": score, "threshold": threshold or FACE_MATCH_THRESHOLD,
            "face_profile_id": profile["id"], "error": None if matched else "Face does not match stored profile"}
