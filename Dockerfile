# ============================================================
# Espaço Terapêutico — Single Container Deploy
# ============================================================

# ── Stage 1: Build frontend ─────────────────────────────────
FROM node:20-alpine AS frontend
WORKDIR /build
COPY frontend/package.json ./
RUN npm install --no-audit --no-fund --legacy-peer-deps
COPY frontend/ .
RUN npm run build

# ── Stage 2: Build backend ──────────────────────────────────
FROM node:20-alpine AS backend
WORKDIR /build
COPY backend/package.json ./
RUN npm install --no-audit --no-fund
COPY backend/ .
RUN npx tsup src/index.ts --format esm --out-dir dist 2>&1

# ── Stage 3: Production ─────────────────────────────────────
FROM node:20-alpine

# Build tools needed for better-sqlite3 native compilation
RUN apk add --no-cache python3 make g++ wget

WORKDIR /app

# Install production deps
COPY backend/package.json ./
RUN npm install --no-audit --no-fund --omit=dev && npm cache clean --force

# Remove build tools to save space
RUN apk del python3 make g++

# Copy compiled backend
COPY --from=backend /build/dist ./dist

# Copy source files needed at runtime (migrations, db schema)
COPY backend/src/db/ ./src/db/
COPY backend/drizzle.config.ts ./

# Copy frontend build
COPY --from=frontend /build/dist ./public

# Persistent data directory
RUN mkdir -p /app/data /app/data/backups
VOLUME ["/app/data"]

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

# Run migrations then start server
CMD ["sh", "-c", "npx tsx src/db/migrate.ts 2>/dev/null; node dist/index.js"]
