# FaceAttend — Face Recognition Attendance System

Production-grade face recognition attendance system with liveness detection, built as a multi-tenant SaaS MVP.

```
React Frontend (GitHub Pages) → Python FastAPI (Render) → Supabase (Auth + Postgres + RLS)
```

## What was fixed in this build

| # | Bug | Fix |
|---|-----|-----|
| 1 | Sign-up created a Supabase auth user but **no profile** | New DB trigger `on_auth_user_created` auto-creates a profile + default org + settings (`supabase/migrations/20260803160000_auto_profile_and_bootstrap.sql`). The backend also self-heals via `_ensure_profile`. |
| 2 | Camera started but **video was blank** / couldn't capture | Rewrote `useCamera` + `CameraCapture` so the `<video>` element is **always mounted** and the stream is attached via `useEffect` (previously the element was gated behind `ready`, so `srcObject` was set on nothing). |
| 3 | Employees / Settings showed **"Failed to fetch" / "No settings"** | Same root cause as #1 (no org). The bootstrap migration links every profile to a default org and seeds `app_settings`. Settings page now falls back to defaults. |

## Setup

### 1. Database (Supabase → SQL Editor, run in order)
1. `supabase/migrations/20260803155254_create_core_schema.sql`
2. `supabase/migrations/20260803155331_create_rls_policies.sql`
3. `supabase/migrations/20260803160000_auto_profile_and_bootstrap.sql`  ← **fixes the profile bug**

### 2. Frontend (GitHub Pages)
- `vite.config.ts` has `base: '/FaceRead/'`, app uses `HashRouter`.
- Add repo **secrets**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL`.
- Settings → Pages → Source = **GitHub Actions**. Push to `main` to deploy.

### 3. Backend (Render)
- Root Directory = `backend`, Dockerfile Path = `Dockerfile`.
- Env vars: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ALLOWED_ORIGINS=https://gprocessor.github.io`.

## Roles
| Role | Access |
|---|---|
| super_admin | All organizations |
| org_admin | Own organization, full management |
| hr_officer | Own org, employees + attendance |
| supervisor | Own department, view attendance |
| employee | Own records only |

## License
MIT
