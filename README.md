# FaceAttend — Face Recognition Attendance

Consent-first face-recognition attendance with **liveness detection**, a walk-up
**kiosk** that **auto-scans when it sees a face** (cross-browser box via WASM),
**domain-based join-request onboarding**, a **redesigned supervisor dashboard/
reports**, and a **switchable Python face engine**. Database/Auth: **Supabase**.
Backend: **Python FastAPI**.

## What's new in this build
- 🧠 **WASM face box in every browser** — MediaPipe Tasks Vision (Chrome/Safari/Firefox).
- 🤖 **Auto-scan kiosk** — waits for a face, no button. Camera reliably turns off on leave.
- 🎨 **Redesigned Dashboard & Reports** — hero KPIs, area chart, donut, progress rings,
  department readiness bars, filters + status chips. Built to impress supervisors.
- 🏢 **Onboarding via company domain** → admin **approves** requests & assigns roles
  (incl. adding other admins). No auto user/org creation.
- 🙅 Removed employee self check-in pages (attendance is kiosk-only).
- 🔌 **Switchable engine** (`FACE_ENGINE`): insightface | face_recognition | fallback.

## Database — run in Supabase SQL Editor, in order
1. `supabase/migrations/20260803155254_create_core_schema.sql`
2. `supabase/migrations/20260803155331_create_rls_policies.sql`
3. `supabase/migrations/20260808120000_kiosk_api_key.sql`
4. `supabase/migrations/20260812120000_domains_and_join_requests.sql`
5. `supabase/migrations/00_CLEANUP_and_BOOTSTRAP.sql` — **PART A** to wipe old data,
   then create your admin user in **Auth → Users** and run **PART B** (edit values).

## Local dev — Supabase for DB, Python for backend
Because Supabase provides Auth (not just Postgres), point the app at your Supabase
project (cloud is simplest). Then run the Python API with your system Python:
```bash
# Backend
cd backend && cp .env.example .env   # set SUPABASE_URL/keys, FACE_ENGINE=insightface
./run_local.sh                         # http://localhost:8000
# Frontend
cp .env.example .env                   # VITE_API_BASE_URL=http://localhost:8000, VITE_BASE=/
./scripts/dev-frontend.sh              # http://localhost:5173
```
> Want Postgres + Auth on your own machine too? Use the Supabase CLI
> (`supabase start`) which runs both locally in Docker, then use its printed
> URL/keys in the two `.env` files. The app code is identical.

## Deploy
- **Frontend (GitHub Pages):** secrets `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
  `VITE_API_BASE_URL`; Pages source = GitHub Actions; push to main.
- **Backend (Render):** Root Directory = `backend`; set `SUPABASE_*`,
  `FACE_ENGINE=insightface`, `ALLOWED_ORIGINS`.

## Onboarding flow
1. Create org #1 + admin via bootstrap SQL (PART B).
2. New person → **Request Access** with company **domain** + name.
3. Trigger files a **pending join request** (no org/profile yet).
4. Admin → **Access & Team** → pick role → **Approve**. Set role = org admin to add admins.

## Face engine (non-commercial InsightFace models — fine for a school project)
`FACE_ENGINE=insightface` (default, accurate, free-tier safe). Tune Settings →
Face Match Threshold ≈ 0.68–0.72 for InsightFace.

## License
Code MIT. InsightFace pretrained models are for non-commercial use.
