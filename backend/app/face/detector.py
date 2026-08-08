import cv2, numpy as np
def decode_image(b): return cv2.imdecode(np.frombuffer(b, np.uint8), cv2.IMREAD_COLOR)
def detect_faces(image):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    faces = cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(60,60))
    return [{"box": (int(x),int(y),int(w),int(h)), "confidence": 0.9} for (x,y,w,h) in faces]
def extract_face_region(image, box):
    x,y,w,h = box; pad = int(0.15*max(w,h)); y0=max(0,y-pad); x0=max(0,x-pad); return image[y0:y+h+pad, x0:x+w+pad]
def validate_single_face(faces, max_allowed=1, min_confidence=0.7):
    if len(faces)==0: return {"ok":False,"face":None,"error":"No face detected in the image"}
    if len(faces)>max_allowed: return {"ok":False,"face":None,"error":f"Multiple faces detected ({len(faces)})."}
    f=faces[0]
    if f["confidence"]<min_confidence: return {"ok":False,"face":None,"error":"Face confidence too low"}
    return {"ok":True,"face":f,"error":None}
