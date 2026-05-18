# ─────────────────────────────────────────────────────────────────────────────
# MediNova Medical Supplies — Multi-stage Dockerfile
# Builds React frontend, then packages everything into a single FastAPI image.
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Build React frontend ─────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder

WORKDIR /frontend

# Install dependencies (yarn.lock for deterministic installs)
COPY frontend/package.json frontend/yarn.lock ./
RUN yarn install --frozen-lockfile

# Copy source and build
COPY frontend/ ./
RUN yarn build

# ── Stage 2: Python backend + static frontend ─────────────────────────────────
FROM python:3.11-slim AS final

# System deps needed by Playwright Chromium + lxml + Pillow
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    libglib2.0-0 \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    libxml2-dev \
    libxslt1-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright Chromium for template cloning
RUN playwright install chromium --with-deps || true

# Copy backend source
COPY backend/ ./backend/

# Copy built React app into backend's static directory so FastAPI can serve it
COPY --from=frontend-builder /frontend/build ./frontend/build

# Copy location generator data files
COPY backend/data/ ./backend/data/

# ── Runtime config ─────────────────────────────────────────────────────────────
WORKDIR /app/backend

# All secrets/config come from environment variables at runtime — no .env baked in
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8001

EXPOSE 8001

# Serve with uvicorn (use --workers 2 for low-memory hosts; scale up via env)
CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT} --workers ${UVICORN_WORKERS:-2}"]
