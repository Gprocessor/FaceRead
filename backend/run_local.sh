#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
python -m venv .venv 2>/dev/null || true
source .venv/bin/activate
ENGINE="${FACE_ENGINE:-insightface}"
if [ "$ENGINE" = "dlib" ]; then pip install -q -r requirements-dlib.txt; elif [ "$ENGINE" = "fallback" ]; then pip install -q -r requirements-base.txt; else pip install -q -r requirements-insightface.txt; fi
[ -f .env ] || cp .env.example .env
uvicorn app.main:app --reload --port 8000 --env-file .env
