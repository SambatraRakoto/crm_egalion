# ─── Nuruya CRM — Frontend (Vite build → Nginx static) ────────────────────────

# Stage 1 — build the static bundle.
FROM node:20-alpine AS build
WORKDIR /app

# Vite bakes env vars at BUILD time → pass them as build args.
# VITE_API_URL="/" → the app calls the API on the SAME ORIGIN (relative path),
# so Nginx proxies /api regardless of the public domain. Domain-independent.
ARG VITE_API_URL=/
ARG VITE_API_PREFIX=/api/v1
ARG VITE_USE_MOCK=false
ARG VITE_USD_TO_GHS=15.4
ENV VITE_API_URL=$VITE_API_URL \
    VITE_API_PREFIX=$VITE_API_PREFIX \
    VITE_USE_MOCK=$VITE_USE_MOCK \
    VITE_USD_TO_GHS=$VITE_USD_TO_GHS

COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2 — serve with Nginx (also reverse-proxies /api to the backend).
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
