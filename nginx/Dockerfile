# ─── Stage 1: Build React/Vite frontend ───────────────────────────────────────
FROM node:20-alpine AS frontend-build

WORKDIR /app/frontend

# Copy dependency manifests first (layer cache)
COPY frontend/package*.json ./

RUN npm ci

# Copy the full frontend source
COPY frontend/ ./

# Build — output goes to /app/frontend/dist
RUN npm run build

# ─── Stage 2: Nginx serving static files ──────────────────────────────────────
FROM nginx:1.27-alpine

# Remove default config
RUN rm /etc/nginx/conf.d/default.conf

# Copy our Nginx config
COPY nginx/nginx.conf /etc/nginx/nginx.conf

# Copy built assets from Stage 1
COPY --from=frontend-build /app/frontend/dist /usr/share/nginx/html

# Certs will be bind-mounted at runtime (nginx/certs/ → /etc/nginx/certs/)
# so we just create the directory
RUN mkdir -p /etc/nginx/certs

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
