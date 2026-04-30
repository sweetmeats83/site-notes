# Stage 1: Build frontend
FROM node:20-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Compile backend native deps (better-sqlite3 needs build tools)
FROM node:20-slim AS backend-build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
        python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY backend/package*.json ./
RUN npm install --omit=dev

# Stage 3: Lean runtime image — no build tools, no dev deps
FROM node:20-slim
WORKDIR /app

# Apply any pending OS security patches
RUN apt-get update && apt-get upgrade -y && rm -rf /var/lib/apt/lists/*

# Copy compiled node_modules (includes the .node binary for better-sqlite3)
COPY --from=backend-build /app/node_modules ./node_modules
COPY backend/ ./

# Copy built frontend
COPY --from=frontend-build /app/frontend/dist ./public

RUN mkdir -p /data/uploads

EXPOSE 3000
ENV NODE_ENV=production
ENV DATA_DIR=/data

CMD ["node", "src/index.js"]
