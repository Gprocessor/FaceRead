from app.database.supabase_client import get_supabase
from app.face.embeddings import deserialize_embedding, is_match, compare_embeddings
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

# Minimum score gap required between the best and second-best candidate in a
# 1:N identification before we trust the top match. Without this, two
# similar-looking enrolled faces could be confused for each other.
IDENTIFY_MIN_MARGIN = 0.05

def identify_employee(probe, organization_id, threshold=None):
    """1:N face search across an organization's enrolled employees.

    Used by the kiosk flow, where there is no logged-in user to verify
    against - the face itself has to say who this is.
    """
    threshold = threshold if threshold is not None else FACE_MATCH_THRESHOLD
    sb = get_supabase()
    r = sb.table("face_profiles").select("id, employee_id, face_embedding").eq("organization_id", organization_id).eq("is_active", True).eq("enrollment_status", "completed").execute()
    profiles = r.data or []
    if not profiles:
        return {"identified": False, "employee_id": None, "face_profile_id": None, "score": 0.0, "threshold": threshold, "error": "No enrolled employees for this organization"}
    scored = []
    for p in profiles:
        try:
            score = compare_embeddings(probe, deserialize_embedding(p["face_embedding"]))
        except Exception:
            continue
        scored.append((score, p))
    if not scored:
        return {"identified": False, "employee_id": None, "face_profile_id": None, "score": 0.0, "threshold": threshold, "error": "No enrolled employees for this organization"}
    scored.sort(key=lambda t: t[0], reverse=True)
    best_score, best_profile = scored[0]
    if best_score < threshold:
        return {"identified": False, "employee_id": None, "face_profile_id": None, "score": best_score, "threshold": threshold, "error": "Face not recognized"}
    if len(scored) > 1:
        second_score = scored[1][0]
        if (best_score - second_score) < IDENTIFY_MIN_MARGIN:
            return {"identified": False, "employee_id": None, "face_profile_id": None, "score": best_score, "threshold": threshold, "error": "Face matched more than one enrolled employee too closely - please try again or use manual check-in"}
    return {"identified": True, "employee_id": best_profile["employee_id"], "face_profile_id": best_profile["id"], "score": best_score, "threshold": threshold, "error": None}
