# FaceAttend — Backend (FastAPI)
```
cd backend
cp .env.example .env
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
- Token validation via Supabase /auth/v1/user (works with sb_publishable_... keys).
- Auto-creates a profile if missing (_ensure_profile).
- Default Docker build uses full requirements (dlib face_recognition). Set USE_FULL=0 for the lite build.
- Kiosk endpoints authenticate with a per-org X-Kiosk-Key and identify people 1:N by face.
