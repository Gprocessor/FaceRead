FROM python:3.11-slim
ARG FACE_ENGINE=insightface
# Default to the LIGHTWEIGHT model so the image baked for Render (free tier,
# 512 MB) fits in memory. Local dev doesn't use this Dockerfile — it runs
# system Python via run_local.sh and reads INSIGHTFACE_MODEL from backend/.env
# (set to buffalo_l locally for full accuracy).
ARG INSIGHTFACE_MODEL=buffalo_s
ENV FACE_ENGINE=${FACE_ENGINE}
ENV INSIGHTFACE_MODEL=${INSIGHTFACE_MODEL}
RUN apt-get update && apt-get install -y libglib2.0-0 libsm6 libxrender1 libxext6 libgl1 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements-base.txt requirements-insightface.txt requirements-dlib.txt ./
RUN if [ "$FACE_ENGINE" = "dlib" ]; then \
      apt-get update && apt-get install -y build-essential cmake libopenblas-dev liblapack-dev \
      && pip install --no-cache-dir -r requirements-dlib.txt && rm -rf /var/lib/apt/lists/*; \
    elif [ "$FACE_ENGINE" = "fallback" ]; then pip install --no-cache-dir -r requirements-base.txt; \
    else apt-get update && apt-get install -y build-essential && pip install --no-cache-dir -r requirements-insightface.txt && rm -rf /var/lib/apt/lists/*; fi
RUN if [ "$FACE_ENGINE" = "insightface" ]; then python -c "from insightface.app import FaceAnalysis; a=FaceAnalysis(name='${INSIGHTFACE_MODEL}', providers=['CPUExecutionProvider']); a.prepare(ctx_id=-1, det_size=(640,640)); print('model ready')"; fi
COPY . .
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
