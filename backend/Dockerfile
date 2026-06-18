# ─── Nuruya CRM — Backend (Node/Express) ──────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Install production dependencies first (better layer caching).
COPY package*.json ./
RUN npm ci --omit=dev

# App source.
COPY . .

ENV NODE_ENV=production
EXPOSE 4000

# Apply DB schema (idempotent) then start the API.
CMD ["sh", "-c", "npm run migrate && node src/server.js"]
