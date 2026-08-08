import json
from fastapi import APIRouter, Request, UploadFile, File, Form, HTTPException
from app.auth.jwt_validator import get_user_profile
from app.auth.permissions import check_permission
from app.database.supabase_client import get_supabase
from app.face.detector import decode_image, detect_faces, validate_single_face, extract_face_region
from app.face.embeddings import extract_embedding, serialize_embedding, EmbeddingUnavailableError
from app.config import MAX_ALLOWED_FACES, MIN_FACE_CONFIDENCE
from app.utils.audit import log_audit
from app.utils.security import rate_limiter
router = APIRouter()
@router.post("/api/face/enroll")
async def enroll(request: Request, employee_id: str = Form(...), consent_id: str = Form(...), image: UploadFile = File(...), device_info: str = Form("{}")):
    p=get_user_profile(request); check_permission(p,"super_admin","org_admin","hr_officer")
    if not rate_limiter.check(f"enroll:{p['user_id']}"): raise HTTPException(status_code=429, detail="Too many requests")
    sb=get_supabase(); emp=sb.table("employees").select("id, organization_id").eq("id",employee_id).maybe_single().execute()
    if not emp.data: raise HTTPException(status_code=404, detail="Employee not found")
    if p["role"]!="super_admin" and p.get("organization_id")!=emp.data["organization_id"]: raise HTTPException(status_code=403, detail="Employee not in your org")
    img=decode_image(await image.read())
    if img is None: raise HTTPException(status_code=400, detail="Invalid image data")
    faces=detect_faces(img); v=validate_single_face(faces,MAX_ALLOWED_FACES,MIN_FACE_CONFIDENCE)
    if not v["ok"]: return {"success":False,"employee_id":employee_id,"enrollment_status":"failed","message":v["error"],"face_detected":len(faces)>0,"face_count":len(faces)}
    try: emb,model=extract_embedding(extract_face_region(img,v["face"]["box"]))
    except EmbeddingUnavailableError as e: raise HTTPException(status_code=503, detail=str(e))
    org=emp.data["organization_id"]; sb.table("face_profiles").update({"is_active":False}).eq("employee_id",employee_id).execute()
    r=sb.table("face_profiles").insert({"organization_id":org,"employee_id":employee_id,"face_embedding":serialize_embedding(emb),"embedding_model":model,"embedding_dim":len(emb),"enrollment_status":"completed","consent_id":consent_id,"enrollment_date":"now()","is_active":True,"created_by":p["user_id"]}).execute()
    fpid=r.data[0]["id"] if r.data else None
    log_audit(org,p["user_id"],p["role"],"face_enrolled","employee",employee_id,{"model":model})
    return {"success":True,"employee_id":employee_id,"face_profile_id":fpid,"enrollment_status":"completed","message":"Face enrolled successfully","face_detected":True,"face_count":1}
