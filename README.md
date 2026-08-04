# FaceAttend — Face Recognition Attendance System

A production-grade, consent-first face recognition attendance platform with liveness
detection. **UI/UX** adopts the "group-presence" design language (Space Grotesk + DM Sans,
an oklch industrial-trust palette, `surface-panel` cards, graphite sidebar). **Logic** is
our own React + Vite (HashRouter) front end talking to a **Python FastAPI** backend and
**Supabase** (Auth + Postgres + RLS).

```
React (GitHub Pages) → Python FastAPI (Render) → Supabase (Auth + Postgres + RLS)
```

## What changed in this build
- 🎨 **New design system** ported from group-presence: fonts, oklch tokens, `surface-panel`,
  `grid-blueprint`, `scan-glow`, `StatCard`, `Badge`, `Table`, graphite `AppShell` sidebar,
  light/dark ready (defaults to dark).
- ➕ **New feature: Departments** page (CRUD) wired to the existing `departments` table.
- ➕ **Dashboard trend chart** (dependency-free `MiniBars`) + StatCards.
- ✅ **All original logic preserved**: HashRouter, Python face recognition, liveness
  challenge flow, camera capture, Supabase services, auto-profile trigger, RLS.

## Setup
### 1. Database — run in Supabase SQL Editor, in order:
1. `supabase/migrations/20260803155254_create_core_schema.sql`
2. `supabase/migrations/20260803155331_create_rls_policies.sql`
3. `supabase/migrations/20260803160000_auto_profile_and_bootstrap.sql`  ← profile fix + backfill

### 2. Frontend (GitHub Pages)
- Add repo secrets: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL`
- Settings → Pages → Source = **GitHub Actions**; push to `main`

### 3. Backend (Render)
- Root Directory = `backend`, Dockerfile Path = `Dockerfile`
- Env: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ALLOWED_ORIGINS=https://gprocessor.github.io`

## Design tokens (edit in `src/index.css`)
`--primary` (signal teal), `--sidebar` (graphite), `--warning` (amber), `--success` (green).
Semantic Tailwind classes (`bg-primary`, `text-muted-foreground`, `border-border`, `surface-panel`,
`text-display`, `tnum`) map to these — change once, restyle everywhere.

## Roles
super_admin · org_admin · hr_officer · supervisor · employee

## License
MIT
