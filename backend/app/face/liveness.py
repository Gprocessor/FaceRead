import time, random, cv2, numpy as np
from app.config import LIVENESS_THRESHOLD
from app.face.detector import decode_image, detect_faces
CHALLENGES=["BLINK","TURN_HEAD_LEFT","TURN_HEAD_RIGHT","LOOK_STRAIGHT"]
CI={"BLINK":"Blink your eyes naturally 2-3 times","TURN_HEAD_LEFT":"Slowly turn your head to the left, then back to center","TURN_HEAD_RIGHT":"Slowly turn your head to the right, then back to center","LOOK_STRAIGHT":"Look straight ahead and hold still","SMILE":"Give the camera a natural smile"}
def get_random_challenge(): c=random.choice(CHALLENGES); return {"challenge_type":c,"instruction":CI[c]}
def _centers(frames):
    out=[]
    for img in frames:
        f=detect_faces(img)
        if not f: continue
        x,y,w,h=f[0]["box"]; H,W=img.shape[:2]; out.append(((x+w/2)/W,(y+h/2)/H))
    return out
def _eye_counts(frames):
    eye=cv2.CascadeClassifier(cv2.data.haarcascades+"haarcascade_eye.xml"); out=[]
    for img in frames:
        g=cv2.cvtColor(img,cv2.COLOR_BGR2GRAY); f=detect_faces(img)
        if not f: out.append(0); continue
        x,y,w,h=f[0]["box"]; out.append(len(eye.detectMultiScale(g[y:y+h,x:x+w],scaleFactor=1.1,minNeighbors=6,minSize=(15,15))))
    return out
def _blink(fr):
    c=_eye_counts(fr)
    if not c: return 0.0
    ho=any(x>=2 for x in c); hf=any(x<2 for x in c); var=float(np.var(c)) if len(c)>1 else 0.0; s=0.0
    if ho: s+=0.5
    if ho and hf: s+=0.3
    s+=min(0.2,var/4.0); return max(0.0,min(1.0,s))
def _turn(fr):
    c=_centers(fr)
    if len(c)<2: return 0.0
    xs=[p[0] for p in c]; return max(0.0,min(1.0,(max(xs)-min(xs))*4.0))
def _look(fr):
    c=_centers(fr)
    if not c: return 0.0
    cx=float(np.mean([p[0] for p in c])); cy=float(np.mean([p[1] for p in c])); return max(0.0,min(1.0,1.0-(((cx-0.5)**2+(cy-0.5)**2)**0.5)*2.0))
def analyze_frames(frames, ct):
    start=time.time(); dec=[img for raw in frames if (img:=decode_image(raw)) is not None]; n=len(dec)
    if n==0: return {"passed":False,"liveness_score":0.0,"failure_reason":"No valid frames received","frame_count":0,"processing_time_ms":int((time.time()-start)*1000)}
    if sum(1 for img in dec if detect_faces(img))==0: return {"passed":False,"liveness_score":0.0,"failure_reason":"No face detected","frame_count":n,"processing_time_ms":int((time.time()-start)*1000)}
    s=_blink(dec) if ct=="BLINK" else _turn(dec) if ct in ("TURN_HEAD_LEFT","TURN_HEAD_RIGHT") else _look(dec)
    p=s>=LIVENESS_THRESHOLD
    return {"passed":p,"liveness_score":round(float(s),4),"failure_reason":None if p else "Liveness challenge not satisfied","frame_count":n,"processing_time_ms":int((time.time()-start)*1000)}
