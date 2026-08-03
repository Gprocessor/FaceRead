# FaceAttend — Face Recognition Attendance System

A production-grade face recognition attendance system with liveness detection, built as a multi-tenant SaaS MVP.

## Architecture

```
React Frontend (GitHub Pages)  →  Python FastAPI Backend (Render/Railway/VPS)  →  Supabase (Auth + PostgreSQL + Storage)
```

- **Frontend**: React + Vite + Tailwind CSS — handles UI, camera, and auth
- **Backend**: Python FastAPI — handles face recognition, liveness detection, and attendance logic
- **Database**: Supabase PostgreSQL with Row Level Security
- **Auth**: Supabase Auth (email/password) with JWT validation in FastAPI

## Quick Start

### Prerequisites
- Node.js 18+
- Python 3.11+
- A Supabase project

### 1. Database Setup
Run the SQL migrations in the Supabase SQL Editor:
1. `create_core_schema` — creates all 13 tables
2. `create_rls_policies` — creates RLS policies for all roles

### 2. Backend Setup
```bash
cd backend
cp .env.example .env  # Fill in your Supabase credentials
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 3. Frontend Setup
```bash
cp .env.example .env  # Fill in Supabase URL, anon key, and API base URL
npm install
npm run dev
```

## API Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/health` | Health check | None |
| GET | `/api/auth/me` | Current user profile | All |
| POST | `/api/face/enroll` | Enroll a face | Admin/HR |
| POST | `/api/face/verify` | Verify a face | All |
| POST | `/api/liveness/challenge` | Get liveness challenge | All |
| POST | `/api/liveness/check` | Submit liveness frames | All |
| POST | `/api/attendance/check-in` | Check in | All |
| POST | `/api/attendance/check-out` | Check out | All |
| GET | `/api/attendance/history` | Attendance history | All |
| GET | `/api/admin/reports` | Org-wide reports | Admin/HR/Supervisor |
| GET | `/api/admin/employees` | List employees | Admin/HR |
| POST | `/api/admin/employees` | Create employee | Admin/HR |

## Security

### Why the Supabase anon key is safe in the frontend
The anon key is designed to be public. It only grants access to data permitted by RLS policies. With properly configured RLS, an attacker with the anon key cannot read other users' data, modify face profiles, or access audit logs.

### Why the service role key must never be in the frontend
The service role key bypasses RLS entirely. If exposed, an attacker can read all data, including face embeddings. It must only exist in the Python backend's environment variables.

### Biometric Privacy
- Face embeddings are stored as mathematical vectors, not photographs
- Embeddings are only readable by admin-level roles (RLS enforced)
- Consent is required before enrollment and is tracked in `consent_records`
- Employees can revoke consent, which deactivates their face profile

## Deployment

### Frontend (GitHub Pages)
1. Set `base` in `vite.config.ts` to your repo name
2. Add Supabase env vars as GitHub Actions secrets
3. Deploy via the included GitHub Actions workflow

### Backend (Render/Railway)
1. Push the `backend/` directory to your hosting platform
2. Set all environment variables from `.env.example`
3. Deploy using the included Dockerfile

## Liveness Detection — MVP Limitations
- Blink detection alone is not sufficient for production
- Video replay attacks are possible
- Printed photo attacks may bypass weak heuristic systems
- Advanced anti-spoofing models (MiniFASNet, Silent-Face-Anti-Spoofing) should be integrated before commercial launch

## License
MIT
