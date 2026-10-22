# FaceAttend - Local Setup

Face-recognition attendance with liveness detection and a walk-up kiosk.
Runs on your machine: **Python FastAPI backend + Vite frontend**, with
**Supabase** (cloud) for the database and authentication. Recognition uses
full-accuracy **InsightFace (buffalo_l)**.

The Supabase keys and local URLs are already in `.env` and `backend/.env`,
so there is nothing to configure - install and run.

---

## Requirements (install once)

| Tool | Version | Why |
|---|---|---|
| Python | **3.11** | 3.13 has no prebuilt wheels; numpy/insightface fail to build |
| Node | **20 LTS** | newer Node breaks the bundler on Windows |
| C++ Build Tools | latest | InsightFace compiles a native module. Install "Desktop development with C++" from https://visualstudio.microsoft.com/visual-cpp-build-tools/ then reboot |

Check them:

```powershell
py -3.11 --version    # 3.11.x
node -v               # v20.x
```

---

## 1. Database (one time, Supabase -> SQL Editor)

Run **one** file: `supabase/migrations/00_faceattend_full_setup.sql`

It creates or upgrades everything (tables, security rules, sign-up trigger, people fields).
It is safe to run again at any time and never deletes data.
The older files in `supabase/migrations/Old` are for reference only - do not run them.

Then in Supabase -> Authentication -> URL Configuration:
- Site URL: `http://localhost:5173`
- Redirect URLs: add `http://localhost:5173/**` (needed for password reset)

---

## 2. Start it

Double-click **`start.bat`** in the project root.

It checks your Python and Node versions, then opens two windows: the backend
on port 8000 and the frontend on port 5173. The first run creates the Python
virtual environment, installs packages and downloads the InsightFace model,
so it takes several minutes. Later runs start in seconds.

When it is ready your browser opens at the admin login.

To stop everything, close the two windows or run **`stop.bat`**.

### Starting it by hand

Backend:

```powershell
cd backend
py -3.11 -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements-insightface.txt
.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000 --env-file .env
```

Frontend (second window, project root):

```powershell
npm install
npm run dev
```

Check the backend at http://localhost:8000/api/health - it should report
`{"status":"ok","face_model":"insightface"}`.

---

## 3. First launch

| URL | Page |
|---|---|
| http://localhost:5173/ | Kiosk - walk up and it scans automatically |
| http://localhost:5173/#/login | Admin - Sign In / Register Org / Join Org |

1. Open the admin page and choose **Register Org**. You become the organization's admin.
2. **People** - add an employee.
3. **Face Enrollment** - select the employee, record consent, capture their face.
4. **Settings -> Kiosk -> Generate Key** - copy the key.
5. Open the kiosk at `/`, paste the key once to pair the device.
6. Look at the camera. It detects your face, asks for one liveness action
   (blink or a small head turn), identifies you and records the attendance.
7. **Dashboard** and **Reports** show the results.

Colleagues can use **Join Org** with your company domain; you approve them
under **Access & Team**.

---

## How a scan works

```
face detected -> held steady 600ms -> one liveness challenge
-> frames captured -> InsightFace identifies the person -> attendance saved
-> result shown for 3s -> waits for the person to step away
```

Only one scan runs at a time, and the face detector loads once when the page
opens rather than on every scan, which is what keeps it responsive.

---

## Tuning

Everything below lives in `backend/.env`. Restart is automatic (`--reload`).

| Setting | Default | Raise it to... | Lower it to... |
|---|---|---|---|
| `FACE_MATCH_THRESHOLD` | 0.68 | be stricter about who matches | accept more borderline matches |
| `LIVENESS_THRESHOLD` | 0.6 | demand clearer blinks/turns | stop rejecting genuine attempts |
| `MIN_FACE_CONFIDENCE` | 0.6 | require a clearer face | accept dimmer lighting |
| `SECONDARY_FACE_RATIO` | 0.6 | ignore more background faces | be stricter about extra people |
| `INSIGHTFACE_DET_SIZE` | 640 | detect smaller/further faces | run faster on a slow machine |

When liveness fails, the message includes the score it achieved, for example
`score 0.52, needs 0.60`. Set `LIVENESS_THRESHOLD` just below the scores you
see from genuine attempts.

---

## If something goes wrong

| Symptom | Cause | Fix |
|---|---|---|
| numpy or insightface fails to build | Python 3.13 | use Python 3.11 |
| "Microsoft Visual C++ 14.0 required" | no C++ compiler | install C++ Build Tools, reboot |
| `npm install` fails with `EFTYPE` | Node too new | use Node 20 LTS, delete `node_modules`, retry |
| "script is not digitally signed" | Windows blocked the file | use `start.bat`, which does not execute script files directly |
| `ModuleNotFoundError: app` | wrong folder | run uvicorn from inside `backend\` |
| health says `face_model: unavailable` | insightface not installed | re-run the pip install inside the venv |
| "Could not extract facial features" | face too small, dark or angled | move closer, improve lighting, face the camera |
| camera is black | permission | allow camera access for `localhost` |

---

## Notes

- Faces are stored as encrypted mathematical embeddings under a recorded
  consent entry, never as photographs.
- Embeddings are tied to the engine that created them. A face enrolled with
  InsightFace locally will not match a deployment running the fallback engine,
  so enrol and verify in the same environment.
- Liveness sessions are kept in `backend/.liveness_sessions.json` so that a
  backend auto-reload does not invalidate a scan already in progress. The file
  is git-ignored.
- InsightFace's pretrained models are licensed for non-commercial use.
