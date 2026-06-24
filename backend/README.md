# Swifty-Proteins backend

**Auth-only** Fastify API for the Swifty-Proteins app. Implements the
[API contract](../API.md). The ligand pipeline (RCSB fetch + CIF parsing) lives in
the app, not here — see `frontend/src/lib/`.

## Run locally (without Docker)

```bash
npm install
npm run dev        # http://localhost:3000 (auto-reload, in-memory accounts)
```

Accounts are in-memory unless `DATABASE_URL` is set. For Postgres-backed accounts,
run the stack with Docker from the repo root: `make up` (compose provides the DB).

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
  index.js            boot + listen + graceful shutdown (closes the pool)
  app.js              Fastify instance: plugins, error shape, store init, routes
  config.js           env config
  db/pool.js          lazy Postgres connection pool
  routes/             health · auth
  services/           userStore (selector) · userStore.memory · userStore.pg
  lib/                password (Argon2id) · errors (client-facing http errors)
migrations/           SQL migrations (run on boot on the Postgres path)
test/                 node:test auth suite (Fastify inject)
```

## Implementation status / TODO

- ✅ Auth (register / login / me), JWT, Argon2id hashing
- ✅ Auth test suite (`npm test`)
- ✅ Postgres-backed accounts (plain `pg` + SQL migrations); in-memory fallback for
  local dev/tests, Postgres when `DATABASE_URL` is set
