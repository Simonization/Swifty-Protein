# Swifty-Proteins backend

**Auth-only** Fastify API for the Swifty-Proteins app. Implements the
[API contract](../API.md). The ligand pipeline (RCSB fetch + CIF parsing) lives in
the app, not here — see `frontend/src/lib/`.

## Run locally (without Docker)

```bash
cp .env.example .env
npm install
npm run dev        # http://localhost:3000  (auto-reload)
```

Or via Docker from the repo root: `make up`.

## Quick smoke test

```bash
curl localhost:3000/health
TOKEN=$(curl -s -X POST localhost:3000/api/v1/auth/register \
  -H 'content-type: application/json' \
  -d '{"username":"rodolfo","password":"supersecret"}' | jq -r .token)
curl localhost:3000/api/v1/auth/me -H "authorization: Bearer $TOKEN"
```

## Layout

```
src/
  index.js            boot + listen + graceful shutdown
  app.js              Fastify instance: plugins, error shape, route registration
  config.js           env config
  routes/             health · auth
  services/           userStore
  lib/                password (Argon2id) · errors (client-facing http errors)
test/                 node:test auth suite (Fastify inject)
```

## Implementation status / TODO

- ✅ Auth (register / login / me), JWT, Argon2id hashing
- ✅ Auth test suite (`npm test`)
- ⬜ Replace in-memory `userStore` with Postgres (`DATABASE_URL` ready); accounts
  must persist now that auth is the backend's only job
- ⬜ Choose DB access (plain `pg` + SQL migrations vs Prisma) — see the plan
