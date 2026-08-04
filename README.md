# FaceAttend — Face Recognition Attendance System

Production-grade face recognition attendance with liveness detection, multi-tenant SaaS MVP.

```
React (GitHub Pages) → Python FastAPI (Render) → Supabase (Auth + Postgres + RLS)
```

## All bugs fixed in this build

| # | Bug | Fix |
|---|-----|-----|
| 1 | Blank page on GitHub Pages | `HashRouter` + `base: '/FaceRead/'` in `vite.config.ts` |
| 2 | Assets 404 | Correct `base` path |
| 3 | Workflow never built the site | `deploy.yml` now runs `npm ci && npm run build` and uploads `dist` |
| 4 | `Invalid token` (new Supabase keys) | Backend validates via Supabase `/auth/v1/user` (algorithm-agnostic) |
| 5 | Sign-up created no profile | DB trigger `on_auth_user_created` + backend `_ensure_profile` auto-create profile/org/settings |
| 6 | Docker build failed (`libgl1-mesa-glx`) | Switched to `libgl1` |
| 7 | `render.yaml` double-path | Added `dockerContext: ./backend` |
| 8 | **Camera blank / no capture** | `useCamera` + `CameraCapture` rewritten: `<video>` always mounted, stream attached via `useEffect` |
| 9 | Employees/Settings "Failed to fetch" | Bootstrap migration links every profile to a default org + seeds `app_settings`; Settings falls back to defaults |

## Setup

### 1. Database — run in Supabase SQL Editor, in order:
1. `supabase/migrations/20260803155254_create_core_schema.sql`
2. `supabase/migrations/20260803155331_create_rls_policies.sql`
3. `supabase/migrations/20260803160000_auto_profile_and_bootstrap.sql`  ← **profile fix**

### 2. Frontend (GitHub Pages)
- Add repo secrets: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL`
- Settings → Pages → Source = **GitHub Actions**; push to `main`

### 3. Backend (Render)
- Root Directory = `backend`, Dockerfile Path = `Dockerfile`
- Env: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ALLOWED_ORIGINS=https://gprocessor.github.io`

## Roles
super_admin · org_admin · hr_officer · supervisor · employee

## License
MIT
