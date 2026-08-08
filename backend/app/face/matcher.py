from app.database.supabase_client import get_supabase
from app.face.embeddings import deserialize_embedding, is_match, compare_embeddings
from app.config import FACE_MATCH_THRESHOLD
def get_employee_face_profile(employee_id):
    sb=get_supabase(); r=sb.table("face_profiles").select("*").eq("employee_id",employee_id).eq("is_active",True).eq("enrollment_status","completed").order("created_at",desc=True).limit(1).execute(); return r.data[0] if r.data else None
def verify_against_profile(probe, employee_id, threshold=None):
    p=get_employee_face_profile(employee_id)
    if not p: return {"verified":False,"score":0.0,"threshold":threshold or FACE_MATCH_THRESHOLD,"face_profile_id":None,"error":"No active face profile"}
    m,s=is_match(probe, deserialize_embedding(p["face_embedding"]), threshold)
    return {"verified":m,"score":s,"threshold":threshold or FACE_MATCH_THRESHOLD,"face_profile_id":p["id"],"error":None if m else "Face does not match stored profile"}
IDENTIFY_MIN_MARGIN=0.05
def identify_employee(probe, org_id, threshold=None):
    if threshold is None: threshold=FACE_MATCH_THRESHOLD
    sb=get_supabase(); rows=(sb.table("face_profiles").select("id, employee_id, face_embedding").eq("organization_id",org_id).eq("is_active",True).eq("enrollment_status","completed").execute()).data or []
    if not rows: return {"identified":False,"employee_id":None,"face_profile_id":None,"score":0.0,"threshold":threshold,"error":"No enrolled faces"}
    scored=[]
    for row in rows:
        try: emb=deserialize_embedding(row["face_embedding"])
        except Exception: continue
        scored.append((compare_embeddings(probe,emb),row))
    if not scored: return {"identified":False,"employee_id":None,"face_profile_id":None,"score":0.0,"threshold":threshold,"error":"No comparable profiles"}
    scored.sort(key=lambda x:x[0],reverse=True); best,row=scored[0]; second=scored[1][0] if len(scored)>1 else 0.0
    if best<threshold: return {"identified":False,"employee_id":None,"face_profile_id":None,"score":best,"threshold":threshold,"error":"Face not recognised"}
    if (best-second)<IDENTIFY_MIN_MARGIN and len(scored)>1: return {"identified":False,"employee_id":None,"face_profile_id":None,"score":best,"threshold":threshold,"error":"Ambiguous match — try again"}
    return {"identified":True,"employee_id":row["employee_id"],"face_profile_id":row["id"],"score":best,"threshold":threshold,"error":None}
