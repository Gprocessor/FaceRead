# FaceAttend — Face Recognition Attendance System

A production-grade face recognition attendance system with liveness detection, built as a multi-tenant SaaS MVP.

## System Architecture

```
┌─────────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│  React Frontend      │     │  Python FastAPI       │     │  Supabase           │
│  (GitHub Pages)      │     │  Backend (Render/VPS) │     │  (Cloud)            │
│                      │     │                      │     │                     │
│  - Supabase Auth     │────▶│  - JWT validation     │────▶│  - PostgreSQL       │
│  - Camera capture    │     │  - Face detection     │     │  - Auth             │
│  - Liveness challenge│     │  - Embedding extract  │     │  - Storage          │
│  - Dashboard UI      │     │  - Liveness detection │     │  - RLS policies     │
│  - Reports/Export    │◀────│  - Attendance logic   │◀────│                     │
│                      │     │  - Audit logging      │     │                     │
└─────────────────────┘     └──────────────────────┘     └─────────────────────┘
```

**Key principle**: The frontend talks directly to Supabase for auth and simple CRUD (protected by RLS). All biometric processing happens in Python — the frontend never sees embeddings, and the service role key never reaches the browser.

## Data Flow

1. User signs in via Supabase Auth → gets JWT session token
2. Frontend sends JWT in `Authorization: Bearer` header to FastAPI
3. FastAPI validates JWT against Supabase JWT secret, extracts `user_id` and role
4. FastAPI processes face frames (detection → embedding → match → liveness)
5. FastAPI writes attendance/audit records to Supabase using the service role key
6. Frontend reads attendance data directly from Supabase (RLS-enforced) or via FastAPI

## Project Structure

```
.
├── src/                          # React frontend
│   ├── components/               # Shared UI components
│   ├── pages/                    # Route pages
│   ├── services/                 # API & Supabase clients
│   ├── hooks/                    # Custom React hooks
│   └── utils/                    # Utilities
├── backend/                      # Python FastAPI backend
│   ├── app/
│   │   ├── main.py              # FastAPI app entry
│   │   ├── config.py            # Environment configuration
│   │   ├── database/            # Supabase client
│   │   ├── auth/                # JWT validation & permissions
│   │   ├── face/                # Face recognition & liveness
│   │   ├── attendance/          # Attendance business logic
│   │   ├── routes/              # API route handlers
│   │   ├── models/              # Pydantic schemas
│   │   └── utils/               # Image, audit, security utils
│   ├── requirements.txt
│   ├── Dockerfile
│   └── README.md
├── .github/workflows/           # GitHub Actions deployment
└── .env.example                  # Frontend env vars
```

## Quick Start

### 1. Database Setup
The Supabase migrations are already applied. The schema includes 13 tables:
`organizations`, `profiles`, `roles`, `departments`, `employees`, `face_profiles`,
`face_enrollment_sessions`, `consent_records`, `attendance_sessions`, `attendance_logs`,
`liveness_checks`, `audit_logs`, `app_settings`.

### 2. Backend
```bash
cd backend
cp .env.example .env  # Fill in credentials
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 3. Frontend
```bash
cp .env.example .env  # Fill in Supabase URL, anon key, API URL
npm install
npm run dev
```

## Environment Variables

### Frontend (safe for browser)
| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key (public, RLS-protected) |
| `VITE_API_BASE_URL` | Python backend URL |

### Backend (server-only, NEVER expose)
| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (bypasses RLS) |
| `JWT_SECRET` | Supabase JWT secret for token validation |
| `FACE_MATCH_THRESHOLD` | Face match confidence threshold (default: 0.6) |
| `LIVENESS_THRESHOLD` | Liveness score threshold (default: 0.7) |
| `ALLOWED_ORIGINS` | CORS allowed origins |

## Security Checklist

- [x] RLS enabled on all 13 tables
- [x] Organization isolation via `organization_id` on all tenant tables
- [x] Face profiles admin-only (employees never read embeddings)
- [x] Audit logs admin-only
- [x] Employees see only their own attendance
- [x] Service role key used only in Python backend
- [x] JWT validation on every API endpoint
- [x] Biometric consent tracking before enrollment
- [x] Rate limiting on sensitive endpoints
- [x] Input sanitization on user-provided strings
- [ ] Advanced anti-spoofing model (MVP uses heuristics)
- [ ] GPS geofencing (schema ready, not enforced)
- [ ] Device binding (future)

## Role-Based Access Control

| Role | Access |
|------|--------|
| `super_admin` | All organizations, all data |
| `org_admin` | Own organization, full management |
| `hr_officer` | Own organization, employees + attendance |
| `supervisor` | Own department, view attendance |
| `employee` | Own records only |

## Liveness Detection

Challenge-based liveness with 5 challenge types:
- **BLINK** — blink detection
- **TURN_HEAD_LEFT** — head turn left
- **TURN_HEAD_RIGHT** — head turn right
- **LOOK_STRAIGHT** — forward-facing check
- **SMILE** — smile detection (optional)

### MVP Limitations
- Blink detection alone is not enough for production
- Video replay attacks are possible
- Printed photo attacks may bypass weak systems
- Advanced anti-spoofing models should be added before commercial launch

## Commercial Upgrade Roadmap

1. Advanced anti-spoofing model (MiniFASNet / Silent-Face-Anti-Spoofing)
2. Device binding
3. GPS geofencing
4. Offline attendance sync
5. Mobile app (React Native)
6. Payroll integration
7. Shift management
8. Multi-branch support
9. Subscription billing (Stripe)
10. Admin analytics dashboard
11. Alert system (anomaly detection)
12. API access for organizations

## License
MIT
