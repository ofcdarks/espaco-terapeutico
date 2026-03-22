# ============================================================
# Espaço Terapêutico v2 — Single Container Deploy
# Frontend (React) + Backend (Fastify + SQLite)
#
# Easypanel: apontar para este Dockerfile na raiz do repo
# Volume: /app/data (persiste o SQLite entre deploys)
# Porta: 3000
# ============================================================

# ── Stage 1: Build frontend ─────────────────────────────────
FROM node:20-alpine AS frontend

WORKDIR /build
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci --no-audit --no-fund 2>/dev/null || npm install --no-audit --no-fund
COPY frontend/ .
RUN npm run build

# ── Stage 2: Build backend ──────────────────────────────────
FROM node:20-alpine AS backend

WORKDIR /build
COPY backend/package.json backend/package-lock.json* ./
RUN npm ci --no-audit --no-fund 2>/dev/null || npm install --no-audit --no-fund
COPY backend/ .
RUN npx tsup src/index.ts --format esm --out-dir dist

# ── Stage 3: Production ─────────────────────────────────────
FROM node:20-alpine

RUN apk add --no-cache python3 make g++ wget

WORKDIR /app

# Install production deps (includes better-sqlite3 native build)
COPY backend/package.json ./
RUN npm ci --no-audit --no-fund --omit=dev && npm cache clean --force

# Remove build tools
RUN apk del python3 make g++

# Copy compiled backend
COPY --from=backend /build/dist ./dist

# Copy drizzle migrations + migrate script
COPY backend/drizzle ./drizzle
COPY backend/src/db/ ./src/db/

# Copy frontend build
COPY --from=frontend /build/dist ./public

# Persistent data directory
RUN mkdir -p /app/data /app/data/backups
VOLUME ["/app/data"]

# Environment defaults
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    DATABASE_URL=/app/data/espaco.db \
    BACKUP_DIR=/app/data/backups \
    STATIC_DIR=/app/public \
    LOG_LEVEL=info

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["sh", "-c", "npx tsx src/db/migrate.ts && node dist/index.js"]
