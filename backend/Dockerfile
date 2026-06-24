# =============================================================================
# Swifty-Proteins — Backend API (Simon)
#
# Placeholder Node image. Swap the runtime if a non-Node framework is chosen in
# Week 1 — only this file + the compose 'backend' service need to change.
# =============================================================================
FROM node:20-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app

# Dependency layer (cached unless package*.json changes)
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else echo ">> no package-lock yet — scaffold the backend first"; fi

COPY . .

EXPOSE 3000
# Adjust to the real entrypoint once the backend is scaffolded.
CMD ["node", "src/index.js"]
