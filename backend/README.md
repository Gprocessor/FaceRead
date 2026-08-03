# FaceAttend — Backend (Python FastAPI)

Face recognition attendance system with liveness detection.

## Architecture

React Frontend (GitHub Pages) → Python FastAPI Backend (Render/Railway/VPS) → Supabase (Auth + PostgreSQL + Storage)

- **Backend**: Python FastAPI — face recognition, liveness detection, attendance logic
- **Database**: Supabase PostgreSQL with Row Level Security
- **Auth**: Supabase Auth (email/password) with JWT validation in FastAPI

## Quick Start

### 1. Database Setup
Run the SQL migrations in the Supabase SQL Editor:
- `create_core_schema` — creates all 13 tables
- `create_rls_policies` — creates RLS policies for all roles

### 2. Backend Setup
```bash
cd backend
cp .env.example .env   # Fill in your Supabase credentials
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## API Endpoints

| Method | Path | Description | Auth |
|---|---|---|---|
| GET | /api/health | Health check | None |
| GET | /api/auth/me | Current user profile | All |
| POST | /api/face/enroll | Enroll a face | Admin/HR |
| POST | /api/face/verify | Verify a face | All |
| POST | /api/liveness/challenge | Get liveness challenge | All |
| POST | /api/liveness/check | Submit liveness frames | All |
| POST | /api/attendance/check-in | Check in | All |
| POST | /api/attendance/check-out | Check out | All |
| GET | /api/attendance/history | Attendance history | All |
| GET | /api/admin/reports | Org-wide reports | Admin/HR/Supervisor |
| GET | /api/admin/employees | List employees | Admin/HR |
| POST | /api/admin/employees | Create employee | Admin/HR |

## Deployment (Render)

Two equivalent setups — apply the `backend` folder **once**, not twice:

**Option A (recommended):** In Render → Settings, set **Root Directory = `backend`**,
**Dockerfile Path = `Dockerfile`**, and keep the Dockerfile's bare `COPY` paths.

**Option B:** Leave Root Directory empty and use `dockerContext: ./backend` +
`dockerfilePath: ./backend/Dockerfile` in `render.yaml`.

Set all environment variables from `.env.example`. The default build uses
`requirements.txt` (lite — no dlib). To enable full `face_recognition` accuracy,
build with `--build-arg USE_FULL=1`.

## Liveness Detection — MVP Limitations
- Challenge-based heuristics (blink, head turn, look straight, smile)
- Not sufficient for production; add MiniFASNet / Silent-Face-Anti-Spoofing before launch
- Video replay and printed-photo attacks may bypass weak heuristics

## License
MIT
