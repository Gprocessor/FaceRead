import numpy as np, cv2
from app.face.engines.base import BaseFaceEngine
class FallbackEngine(BaseFaceEngine):
    name = "fallback"
    def available(self): return True
    def extract(self, img):
        r = cv2.resize(img, (128,128)); hsv = cv2.cvtColor(r, cv2.COLOR_BGR2HSV)
        h = cv2.calcHist([hsv],[0],None,[32],[0,180]).flatten(); s = cv2.calcHist([hsv],[1],None,[32],[0,256]).flatten(); v = cv2.calcHist([hsv],[2],None,[32],[0,256]).flatten()
        e = np.concatenate([h,s,v]); e = e/(np.linalg.norm(e)+1e-8); return e.astype(np.float32).tolist()
