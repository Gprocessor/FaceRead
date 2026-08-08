#!/usr/bin/env bash
# Run the backend locally without Docker.
set -e
cd "$(dirname "$0")"
python -m venv .venv 2>/dev/null || true
# shellcheck disable=SC1091
source .venv/bin/activate
ENGINE="${FACE_ENGINE:-insightface}"
echo "Installing deps for FACE_ENGINE=$ENGINE ..."
if [ "$ENGINE" = "dlib" ]; then pip install -q -r requirements-dlib.txt;
elif [ "$ENGINE" = "fallback" ]; then pip install -q -r requirements-base.txt;
else pip install -q -r requirements-insightface.txt; fi
[ -f .env ] || cp .env.example .env
echo "Starting API on http://localhost:8000 (docs at /docs)"
uvicorn app.main:app --reload --port 8000 --env-file .env
