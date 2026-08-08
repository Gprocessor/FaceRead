# FaceAttend — Face Recognition Attendance System

A production-grade, consent-first face recognition attendance platform with liveness
detection and a walk-up **kiosk** as the default screen. **UI/UX** uses the
"group-presence" design language (Space Grotesk + DM Sans, oklch industrial-trust
palette, surface-panel cards, graphite sidebar). **Backend** is Python FastAPI;
**data/auth** is Supabase (Postgres + RLS).

```
React (GitHub Pages) → Python FastAPI (Render) → Supabase (Auth + Postgres + RLS)
```

## Highlights
- 🏢 **Self-serve org signup** — each registration creates its OWN organization,
  app_settings, a default "General" department, and makes the signer org_admin.
- 🖥️ **Kiosk is the home screen** (`/`) — employees mark attendance by face, no login.
  An **Admin** icon (top-right) opens the login.
- 🧠 **1:N identify** at the kiosk (who you are is decided by your face), **1:1 verify**
  in the logged-in flow.
- 🔐 **Kiosk key** — admin generates it in Settings → Kiosk; paste once per device.
- 🛡️ **Consent-first biometrics**, single-use liveness sessions, RLS everywhere.

## Setup

### 1. Database — run migrations in Supabase SQL Editor, in order:
1. `supabase/migrations/20260803155254_create_core_schema.sql`
2. `supabase/migrations/20260803155331_create_rls_policies.sql`
3. `supabase/migrations/20260808120000_kiosk_api_key.sql`
4. `supabase/migrations/20260810120000_org_self_serve_signup.sql`  ← per-org signup

### 2. Frontend (GitHub Pages)
- Repo secrets: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL`
- Settings → Pages → Source = **GitHub Actions**; push to `main`.

### 3. Backend (Render)
- Root Directory = `backend`, Dockerfile Path = `Dockerfile`.
- Env: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ALLOWED_ORIGINS`.
- Docker builds the **full** face model by default (dlib). Set `USE_FULL=0` for lite.

## Getting started as a new customer
1. Open the app → **Admin** (top-right) → **Register Organization** (name + your details).
2. Sign in → **People**: add employees. **Face Enrollment**: enroll each face (consent first).
3. **Settings → Kiosk**: Generate Kiosk Key. On the entrance device, open `/` and paste the key once.
4. Employees now walk up to `/` and check in/out by face.

## Roles
super_admin · org_admin · hr_officer · supervisor · employee

## License
MIT
