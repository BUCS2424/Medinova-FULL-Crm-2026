# ─────────────────────────────────────────────────────────────────────────────
# MediNova Medical Supplies — Dockerfile
#
# STRATEGY:
#   1. Frontend is PRE-BUILT and committed as frontend/build/ — no Node stage.
#   2. All Python packages have manylinux wheels — no build-essential needed.
#   3. Playwright Chromium is NOT installed — template cloning is optional
#      and the 148 X11 system packages it needs add 600MB + 2 min to the build.
#      Every other feature works without it.
# ─────────────────────────────────────────────────────────────────────────────

FROM python:3.11-slim

# Minimal system deps: curl only (needed for health checks / some pip packages)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies (all packages have pre-built wheels — fast)
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY backend/ ./backend/

# Copy pre-built React app (committed to git — no Node build needed)
COPY frontend/build ./frontend/build

# ── Runtime config ──────────────────────────────────────────────────────────
WORKDIR /app/backend

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8001

EXPOSE 8001

CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT} --workers ${UVICORN_WORKERS:-2}"]
