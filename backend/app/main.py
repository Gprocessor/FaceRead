"""
FastAPI application entry point.
Configures CORS, includes all route modules, and starts the server.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import ALLOWED_ORIGINS, PORT
from app.routes import (
    health_routes,
    auth_routes,
    employee_routes,
    face_routes,
    liveness_routes,
    attendance_routes,
)

app = FastAPI(
    title="FaceAttend API",
    description="Face Recognition Attendance System with Liveness Detection",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_routes.router)
app.include_router(auth_routes.router)
app.include_router(employee_routes.router)
app.include_router(face_routes.router)
app.include_router(liveness_routes.router)
app.include_router(attendance_routes.router)


@app.get("/")
async def root():
    return {"name": "FaceAttend API", "status": "running", "docs": "/docs"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=PORT, reload=True)
