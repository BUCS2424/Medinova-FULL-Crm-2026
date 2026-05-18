# ─────────────────────────────────────────────────────────────────────────────
# MediNova Medical Supplies — Dockerfile
#
# STRATEGY: The React frontend is pre-built and committed to git as
# frontend/build/. Docker just copies those static files — no Node.js stage,
# no npm install, no webpack run. This eliminates the 20+ minute build that
# was timing out on Hyperlift's Kaniko builder.
#
# TO UPDATE THE FRONTEND: run `npm run build` inside frontend/ locally (or let
# Emergent build it), commit frontend/build/, then push and redeploy.
# ─────────────────────────────────────────────────────────────────────────────

FROM python:3.11-slim

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

# Copy pre-built React app (committed to git — no Node build needed)
COPY frontend/build ./frontend/build

# ── Runtime config ──────────────────────────────────────────────────────────
WORKDIR /app/backend

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8001

EXPOSE 8001

CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT} --workers ${UVICORN_WORKERS:-2}"]
