# FaceAttend — Face Recognition Attendance System

Consent-first face-recognition attendance with **liveness detection**, a walk-up
**kiosk** as the default screen, **self-serve organization signup**, and a
**switchable face engine**. Frontend: React + Vite + Tailwind (group-presence
design). Backend: Python FastAPI. Data/Auth: Supabase (Postgres + RLS).

```
React (GitHub Pages / local) → Python FastAPI (Render / local) → Supabase
```

## ✨ Switchable face engine
Set `FACE_ENGINE` (backend env). No code changes needed:

| FACE_ENGINE | Accuracy | Build cost | License | Notes |
|---|---|---|---|---|
| `insightface` *(default)* | ★★★★ | light (onnxruntime) | models **non-commercial** | great for a school project |
| `face_recognition` | ★★★★ | heavy (dlib/cmake, >8 GB) | permissive | needs a bigger build box |
| `fallback` | ★ (weak) | none | n/a | opencv histogram; demo only |
| `auto` | — | — | — | tries insightface → dlib → fallback |

Tune **Settings → Face Match Threshold**: insightface ≈ 0.66–0.72, dlib ≈ 0.60.
Health check `/api/health` reports the active engine.

## Run it LOCALLY (full stack)

### 0. Prereqs
- A Supabase project (free). Run the 4 files in `supabase/migrations/` in the SQL Editor.
- Node 20+, Python 3.11+ (and optionally Docker).

### 1. Backend
```bash
cd backend
cp .env.example .env        # fill SUPABASE_URL / keys; set FACE_ENGINE
./run_local.sh              # creates venv, installs the engine's deps, starts :8000
```
Or with Docker (one command):
```bash
FACE_ENGINE=insightface docker compose up --build   # from repo root
```

### 2. Frontend
```bash
cp .env.example .env        # set VITE_API_BASE_URL=http://localhost:8000, VITE_BASE=/
./scripts/dev-frontend.sh   # http://localhost:5173  (kiosk at /, admin at /#/login)
```

## Deploy to production
- **Supabase:** run the 4 migrations.
- **Frontend (GitHub Pages):** repo secrets `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
  `VITE_API_BASE_URL`; Pages source = GitHub Actions; push to `main`.
- **Backend (Render):** Root Directory = `backend`; set `SUPABASE_*`,
  `FACE_ENGINE=insightface`, `ALLOWED_ORIGINS`. The Docker build pre-downloads the model.

## First run
1. Home screen is the **Kiosk**. Click **Admin** (top-right) → **Register Organization**.
2. Sign in → **People** (add employees) → **Face Enrollment** (consent, then capture).
3. **Settings → Kiosk → Generate Kiosk Key**. On the entrance device open `/` and paste it once.
4. Employees mark attendance by face at `/` — no login.

## Roles
super_admin · org_admin · hr_officer · supervisor · employee

## License
Code MIT. InsightFace pretrained models are for **non-commercial** use.
