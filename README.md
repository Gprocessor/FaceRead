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
└─────────────────────┘     └──────────────────────┘     └─────────────────────┘
```

**Key principle**: The frontend talks directly to Supabase for auth and simple CRUD (protected by RLS). All biometric processing happens in Python — the frontend never sees embeddings, and the service role key never reaches the browser.

## Quick Start

### 1. Database
Run the two SQL migrations in `supabase/migrations/` in the Supabase SQL Editor.

### 2. Backend
```bash
cd backend
cp .env.example .env
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 3. Frontend
```bash
cp .env.example .env
npm install
npm run dev
```

## Deployment

### Frontend (GitHub Pages)
- `vite.config.ts` has `base: '/FaceRead/'` (must match repo name).
- App uses `HashRouter` so deep links work on Pages without 404s.
- Add repo secrets: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL`.
- Set Pages source to **GitHub Actions**. The workflow builds and deploys on push to `main`.

### Backend (Render)
- Root Directory = `backend`, Dockerfile Path = `Dockerfile`.
- Set env vars from `backend/.env.example`.

## Roles
| Role | Access |
|---|---|
| super_admin | All organizations, all data |
| org_admin | Own organization, full management |
| hr_officer | Own organization, employees + attendance |
| supervisor | Own department, view attendance |
| employee | Own records only |

## License
MIT
