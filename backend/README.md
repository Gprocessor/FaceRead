# FaceAttend — Backend (Python FastAPI)

## Run locally
```bash
cd backend
cp .env.example .env   # fill in Supabase credentials
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## Key behaviour
- **Token validation** calls Supabase `/auth/v1/user` (works with new `sb_publishable_...` keys and legacy secrets).
- **Auto-profile**: `get_user_profile` creates a minimal profile if one is missing, so no request dead-ends on "Profile not found".
- Default build uses `requirements.txt` (lite, no dlib — histogram fallback). For full accuracy build with `--build-arg USE_FULL=1`.

## Endpoints
`/api/health`, `/api/auth/me`, `/api/face/enroll`, `/api/face/verify`,
`/api/liveness/challenge`, `/api/liveness/check`,
`/api/attendance/check-in`, `/api/attendance/check-out`, `/api/attendance/history`,
`/api/admin/reports`, `/api/admin/employees`.
