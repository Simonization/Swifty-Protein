# Swifty-Proteins backend

Fastify API for the Swifty-Proteins app. Implements the [API contract](../API.md).

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
curl -X POST localhost:3000/api/v1/auth/register \
  -H 'content-type: application/json' \
  -d '{"username":"rodolfo","password":"supersecret"}'
# copy the token from the response:
curl localhost:3000/api/v1/ligands -H 'authorization: Bearer <token>'
curl localhost:3000/api/v1/ligands/ATP -H 'authorization: Bearer <token>'
curl localhost:3000/api/v1/elements/O
```

## Layout

```
src/
  index.js            boot + listen + graceful shutdown
  app.js              Fastify instance: plugins, error shape, route registration
  config.js           env config
  routes/             health · auth · ligands · elements
  services/           userStore · ligands · cifParser · elements
  lib/                password (Argon2id) · errors (client-facing http errors)
test/                 node:test suite + CIF fixtures
```

## Implementation status / TODO

- ✅ Auth (register / login / me), JWT, Argon2id hashing
- ✅ Element reference data (CPK colors, vdW radii)
- ✅ Ligand detail — fetch CIF from RCSB, parse atoms/bonds, cache (with tests)
- ✅ Ligand list with search (from a curated code list for now)
- ⬜ **Week 2:** replace in-memory `userStore` with Postgres (`DATABASE_URL` ready)
- ⬜ Load the real ligand code list from `ligands.txt`
- ⬜ Persist the ligand cache (disk/Postgres) so it survives restarts
