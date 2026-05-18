# ─────────────────────────────────────────────────────────────────────────────
# MediNova Medical Supplies — Multi-stage Dockerfile
# Builds React frontend, then packages everything into a single FastAPI image.
#
# NOTES (learned from failed builds):
#   - frontend/yarn.lock is NOT committed to git — do NOT COPY it or use
#     --frozen-lockfile. Use plain `yarn install` with a network timeout.
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Build React frontend ─────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder

WORKDIR /frontend

# Increase Node heap to avoid OOM during yarn install + craco build on low-RAM hosts
ENV NODE_OPTIONS=--max-old-space-size=4096

# Copy only package.json — yarn.lock is not tracked in git
COPY frontend/package.json ./
RUN yarn install --network-timeout 300000

# Copy full source and build
COPY frontend/ ./
RUN yarn build

# ── Stage 2: Python backend + static frontend ─────────────────────────────────
FROM python:3.11-slim AS final

# System deps needed by Playwright Chromium + lxml
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

# Copy built React app
COPY --from=frontend-builder /frontend/build ./frontend/build

# ── Runtime config ─────────────────────────────────────────────────────────────
WORKDIR /app/backend

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8001

EXPOSE 8001

CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT} --workers ${UVICORN_WORKERS:-2}"]
