# FaceAttend — Backend (FastAPI)

```bash
cd backend
cp .env.example .env
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

- Token validation via Supabase `/auth/v1/user` (works with `sb_publishable_...` keys).
- Auto-creates a profile if missing (`_ensure_profile`).
- Default build uses lite requirements (histogram fallback, no dlib). Use `--build-arg USE_FULL=1` for full accuracy.
