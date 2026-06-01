# ─── Backend Dockerfile ───────────────────────────────────────────────────────
# Node 20 LTS Alpine — PM2 cluster mode
FROM node:20-alpine

# Install system dependencies (for bcrypt native bindings, etc.)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy dependency manifests first (layer cache)
COPY package*.json ./

# Install production deps only, then install PM2 globally
RUN npm ci --omit=dev && npm install -g pm2

# Copy application source
COPY . .

# Create uploads directory (will be over-mounted by a volume in compose)
RUN mkdir -p uploads logs

EXPOSE 5001

# pm2-runtime keeps the process in the foreground (Docker-friendly)
CMD ["pm2-runtime", "ecosystem.config.js"]
