# FaceAttend Backend (FastAPI)

## Switchable engine
`FACE_ENGINE` = `insightface` | `face_recognition` | `fallback` | `auto`.
`INSIGHTFACE_MODEL` = `buffalo_l` (accurate) | `buffalo_s` (lighter).

## Local (no Docker)
```bash
cp .env.example .env
./run_local.sh
```

## Local (Docker)
```bash
FACE_ENGINE=insightface docker build -t faceattend-api .
docker run --env-file .env -p 8000:8000 faceattend-api
```

## Requirements files
- requirements-base.txt — shared deps (no face engine)
- requirements-insightface.txt — base + onnxruntime + insightface (default)
- requirements-dlib.txt — base + face_recognition
- requirements.txt — copy of the insightface set (Render default)
