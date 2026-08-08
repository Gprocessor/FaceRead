import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import ALLOWED_ORIGINS, PORT
from app.routes import health_routes, auth_routes, employee_routes, face_routes, liveness_routes, attendance_routes, org_routes
logging.basicConfig(level=logging.INFO)
app = FastAPI(title="FaceAttend API", description="Face Recognition Attendance System with Liveness Detection", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=ALLOWED_ORIGINS, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
for r in (health_routes, auth_routes, employee_routes, face_routes, liveness_routes, attendance_routes, org_routes):
    app.include_router(r.router)
@app.get("/")
async def root(): return {"name": "FaceAttend API", "status": "running", "docs": "/docs"}
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=PORT, reload=False)
