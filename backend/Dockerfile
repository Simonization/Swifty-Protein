# =============================================================================
# Swifty-Proteins — Backend API (Fastify)
#
# Runs the auth API. Ligand fetch/parse lives in the RN app, not here.
# =============================================================================
FROM node:20-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app

# Dependency layer (cached unless package*.json changes). NODE_ENV=production
# above already implies --omit=dev, but it is spelled out so the intent survives
# a change to that line.
COPY package*.json ./
RUN npm ci --omit=dev

# .dockerignore keeps the host node_modules from landing on top of that install.
COPY . .

EXPOSE 3000
CMD ["node", "src/index.js"]
