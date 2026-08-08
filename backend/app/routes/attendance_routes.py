import json
from datetime import datetime, date
from fastapi import APIRouter, Request, UploadFile, File, Form, HTTPException, Query
from app.auth.jwt_validator import get_user_profile
from app.auth.permissions import check_permission
from app.auth.kiosk import get_kiosk_organization_id
from app.database.supabase_client import get_supabase
from app.face.detector import decode_image, detect_faces, validate_single_face, extract_face_region
from app.face.embeddings import extract_embedding, EmbeddingUnavailableError
from app.face.matcher import identify_employee
from app.attendance.service import get_org_settings, check_duplicate, determine_status, create_attendance_session
from app.attendance.rules import should_reject_duplicate
from app.utils.audit import log_audit
from app.utils.security import rate_limiter
from app.routes.liveness_routes import consume_liveness_session
router = APIRouter()
STAFF=("super_admin","org_admin","hr_officer","supervisor")
async def _finalize(sb, org, emp_id, ct, fr, ls, di, lat, lon, settings, actor, arole):
    status_val, ver = ("failed_verification","failed") if not fr["verified"] else (determine_status(ct, datetime.now(), settings),"verified")
    log={"organization_id":org,"employee_id":emp_id,"attendance_date":date.today().isoformat(),"check_type":ct,"status":status_val,"face_match_score":fr["score"],"liveness_score":ls,"verification_status":ver,"face_profile_id":fr.get("face_profile_id"),"device_info":json.loads(di) if di else {},"location_latitude":float(lat) if lat else None,"location_longitude":float(lon) if lon else None}
    log["check_in_time" if ct=="check_in" else "check_out_time"]=datetime.now().isoformat()
    lr=sb.table("attendance_logs").insert(log).execute(); lid=lr.data[0]["id"] if lr.data else ""
    sid=""
    if ver=="verified":
        now=datetime.now(); sid=create_attendance_session(org, emp_id, date.today(), status_val, now if ct=="check_in" else None, now if ct=="check_out" else None)
        if sid: sb.table("attendance_logs").update({"attendance_session_id":sid}).eq("id",lid).execute()
    if fr.get("face_profile_id"): sb.table("face_profiles").update({"last_verified_at":"now()"}).eq("id",fr["face_profile_id"]).execute()
    log_audit(org, actor, arole, f"attendance_{ct}", "attendance_log", lid, {"employee_id":emp_id,"status":status_val})
    return {"success":ver=="verified","employee_id":emp_id,"attendance_log_id":lid,"attendance_session_id":sid,"check_type":ct,"status":status_val,"verification_status":ver,"face_match_score":fr["score"],"liveness_score":ls,"message":"Attendance recorded" if ver=="verified" else "Verification failed","duplicate":False}
async def _kiosk(request, ct, image, di, lat, lon, lsid):
    org=get_kiosk_organization_id(request); ip=request.client.host if request.client else "?"
    if not rate_limiter.check(f"ka:{org}:{ip}"): raise HTTPException(status_code=429, detail="Too many requests")
    sb=get_supabase(); settings=get_org_settings(org)
    if settings.get("require_liveness",True):
        ls_s=consume_liveness_session(lsid,"kiosk",org)
        if not ls_s: raise HTTPException(status_code=400, detail="Liveness verification required: complete the liveness challenge first")
        ls=ls_s["liveness_score"]
    else: ls=0.0
    img=decode_image(await image.read())
    if img is None: raise HTTPException(status_code=400, detail="Invalid image data")
    faces=detect_faces(img); v=validate_single_face(faces, settings.get("max_allowed_faces",1), settings.get("min_face_confidence",0.7))
    if not v["ok"]: return {"success":False,"employee_id":None,"attendance_log_id":"","attendance_session_id":"","check_type":ct,"status":"failed_verification","verification_status":"failed","face_match_score":0.0,"liveness_score":ls,"message":v["error"],"duplicate":False}
    try: emb,_=extract_embedding(extract_face_region(img,v["face"]["box"]))
    except EmbeddingUnavailableError as e: raise HTTPException(status_code=503, detail=str(e))
    ident=identify_employee(emb, org, settings.get("face_match_threshold",0.68))
    if not ident["identified"]:
        log_audit(org,None,"kiosk_device","kiosk_identification_failed",None,None,{"score":ident["score"],"reason":ident["error"]})
        return {"success":False,"employee_id":None,"attendance_log_id":"","attendance_session_id":"","check_type":ct,"status":"failed_verification","verification_status":"failed","face_match_score":ident["score"],"liveness_score":ls,"message":ident["error"],"duplicate":False}
    eid=ident["employee_id"]
    if should_reject_duplicate(settings,ct):
        ex=check_duplicate(org,eid,ct)
        if ex:
            e0=sb.table("employees").select("full_name, employee_code").eq("id",eid).maybe_single().execute()
            return {"success":False,"employee_id":eid,"attendance_log_id":ex["id"],"attendance_session_id":"","check_type":ct,"status":ex["status"],"verification_status":"rejected","face_match_score":ident["score"],"liveness_score":ls,"message":f"Duplicate {ct.replace('_','-')} detected for today","duplicate":True,"employee_name":(e0.data or {}).get("full_name"),"employee_code":(e0.data or {}).get("employee_code")}
    fr={"verified":True,"score":ident["score"],"threshold":ident["threshold"],"face_profile_id":ident["face_profile_id"],"error":None}
    res=await _finalize(sb, org, eid, ct, fr, ls, di, lat, lon, settings, None, "kiosk_device")
    e=sb.table("employees").select("full_name, employee_code").eq("id",eid).maybe_single().execute()
    res["employee_name"]=(e.data or {}).get("full_name"); res["employee_code"]=(e.data or {}).get("employee_code"); return res
@router.post("/api/kiosk/check-in")
async def kci(request: Request, image: UploadFile = File(...), liveness_session_id: str = Form(...), device_info: str = Form("{}"), latitude: str|None=Form(None), longitude: str|None=Form(None)):
    return await _kiosk(request,"check_in",image,device_info,latitude,longitude,liveness_session_id)
@router.post("/api/kiosk/check-out")
async def kco(request: Request, image: UploadFile = File(...), liveness_session_id: str = Form(...), device_info: str = Form("{}"), latitude: str|None=Form(None), longitude: str|None=Form(None)):
    return await _kiosk(request,"check_out",image,device_info,latitude,longitude,liveness_session_id)
@router.get("/api/admin/reports")
async def reports(request: Request, date_from: str|None=Query(None), date_to: str|None=Query(None)):
    p=get_user_profile(request); check_permission(p,"super_admin","org_admin","hr_officer","supervisor")
    sb=get_supabase(); org=p["organization_id"]; today=date.today().isoformat()
    total=(sb.table("employees").select("id",count="exact").eq("organization_id",org).eq("status","active").execute()).count or 0
    sessions=sb.table("attendance_sessions").select("*").eq("organization_id",org).eq("attendance_date",today).execute().data or []
    present=sum(1 for s in sessions if s["status"]=="present"); late=sum(1 for s in sessions if s["status"]=="late"); failed=sum(1 for s in sessions if s["status"] in ("failed_verification","rejected_liveness"))
    records=[]
    for s in sessions:
        e=sb.table("employees").select("full_name, employee_code, departments(name)").eq("id",s["employee_id"]).maybe_single().execute(); d=e.data or {}
        records.append({"employee_id":s["employee_id"],"employee_name":d.get("full_name","Unknown"),"employee_code":d.get("employee_code",""),"department":(d.get("departments",{}) or {}).get("name") if d.get("departments") else None,"status":s["status"],"check_in_time":s.get("check_in_time"),"check_out_time":s.get("check_out_time"),"face_match_score":None,"liveness_score":None})
    return {"total_employees":total,"present_today":present,"late_today":late,"absent_today":total-present-late,"failed_verification_today":failed,"attendance_rate":present/total if total>0 else 0,"records":records}
