FROM python:3.11-slim
RUN apt-get update && apt-get install -y libglib2.0-0 libsm6 libxrender1 libxext6 libgl1 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ARG USE_FULL=1
COPY requirements-lite.txt requirements.txt
COPY requirements-full.txt requirements-full.txt
RUN if [ "$USE_FULL" = "1" ]; then \
      apt-get update && apt-get install -y build-essential cmake libopenblas-dev liblapack-dev \
      && pip install --no-cache-dir -r requirements-full.txt && rm -rf /var/lib/apt/lists/*; \
    else pip install --no-cache-dir -r requirements.txt; fi
COPY . .
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
