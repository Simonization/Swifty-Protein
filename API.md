# Swifty-Proteins — API contract (v1)

> **Architecture:** the backend is **auth-only**. Ligand data is **not** served
> here — the React Native app fetches `.cif` files directly from RCSB
> (`https://files.rcsb.org/ligands/view/{ligand}.cif`) and parses them in-app, so
> "Network Programming" and "File Parsing" stay where the subject wants them (in
> the mobile app). See *App-side molecular data* at the bottom.

The contract between **Rodolfo's React Native app** and **Simon's backend**.

- **Base URL:** `http://<host>:3000/api/v1` — set in-app under **Settings → Backend URL**.
- **Transport:** plain **HTTP**, deliberately. This backend is a LAN demo started
  by `make up`; terminating TLS would mean shipping a certificate the evaluator's
  device has no reason to trust. The bearer token therefore crosses the local
  network in the clear. Anything deployed beyond a demo must be HTTPS.
- **Rate limiting:** `/auth/register` and `/auth/login` allow 10 requests per
  minute per IP; everything else, 100. Over the limit is a `429 rate_limited`.
- **Format:** JSON in, JSON out (`Content-Type: application/json`).
- **Auth:** `Authorization: Bearer <jwt>` on protected routes.
- **Token lifetime:** issued tokens carry an `exp` claim, 7 days by default
  (`JWT_TTL` overrides). An expired token is a `401`; the user logs in again.
- **Versioning:** path-prefixed (`/api/v1`) so v2 can coexist later.

---

## Types

```jsonc
User { "id": "uuid", "username": "rodolfo", "createdAt": "2026-06-24T10:00:00.000Z" }
```

## Error shape

Every non-2xx response uses one shape:

```jsonc
{ "error": { "code": "invalid_credentials", "message": "Wrong username or password" } }
```

| Status | When |
|--------|------|
| `400 validation_error` | Body failed schema validation, malformed JSON, or an unsupported `Content-Type` |
| `401 unauthorized` / `invalid_credentials` | Missing/invalid token, or bad login |
| `404 not_found` | Unknown route |
| `409 username_taken` | Registering an existing username |
| `429 rate_limited` | Too many requests — see *Rate limiting* above |
| `500 internal_error` | Unexpected server error |

---

## Endpoints

### Health
`GET /health` — liveness probe (used by Docker). → `200 { "status": "ok" }`

### Auth

#### `POST /api/v1/auth/register`
Create an account. **Public.**
```jsonc
// request
{ "username": "rodolfo", "password": "at-least-8-chars" }
// 201
{ "token": "<jwt>", "user": User }
```
`409` if the username already exists.

#### `POST /api/v1/auth/login`
```jsonc
// request
{ "username": "rodolfo", "password": "..." }
// 200
{ "token": "<jwt>", "user": User }
```
`401 invalid_credentials` on a wrong username/password.

#### `GET /api/v1/auth/me`
Validate the current token / fetch the user. **Protected.** → `200 { "user": User }`

`401 unauthorized` if the token is missing, invalid, expired — or valid but its
user no longer exists (a dead session, not a success with an empty user).

> The app does not currently call this: the backend is auth-only and ligand data
> comes straight from RCSB, so nothing after login needs the token. It stays part
> of the contract (and is tested) for any client that wants to validate a session.

---

## App-side molecular data (no backend involved)

The app owns the ligand pipeline. `lib/` holds no React Native imports, so it stays
testable as plain TypeScript; the cache and network are composed on top in `data/`.

| Concern | Where | Tested |
|---------|-------|--------|
| Molecular types (`Atom`, `Bond`, `Ligand`, `Element`) | `frontend/src/types.ts` | — |
| CIF parser (`parseLigandCif`) | `frontend/src/lib/cif.ts` | `__tests__/cif.test.ts` |
| RCSB fetch + typed errors (`fetchLigandCif`) | `frontend/src/lib/rcsb.ts` | `__tests__/rcsb.test.ts` |
| Load policy: cache → network → parse (`loadLigand`) | `frontend/src/data/ligands.ts` | `__tests__/ligands.test.ts` |
| Offline CIF cache | `frontend/src/data/ligandCache.ts` | `__tests__/ligandCache.test.ts` |
| CPK colors + vdW radii (`elementFor`) | `frontend/src/data/elements.ts` | `__tests__/elements.test.ts` |
| Instancing / half-bond math, camera framing | `frontend/src/lib/moleculeGeometry.ts` | `__tests__/moleculeGeometry.test.ts`, `__tests__/framing.test.ts` |
| Re-lock policy (VI.2 security rule) | `frontend/src/auth/lockPolicy.ts` | `__tests__/lockPolicy.test.ts` |

Notes for the frontend:
- **Token storage:** the JWT lives in secure storage (Keychain / Android Keystore).
  Re-auth on foreground is a local biometric unlock; it does not hit the server, so
  a viewed ligand still opens offline.
- **Ligand view:** `loadLigand(id)` returns a parsed `Ligand` (`atoms[]` + `bonds[]`),
  serving a cached copy when there is one, or throws an `RcsbError` whose `.kind`
  (`not_found`/`offline`/`server`/`timeout`/`parse`/`too_large`) already carries the
  user-facing message.
- **Rendering:** color atoms via `elementFor(atom.element).cpkHex`; size spheres by
  `.radius`; draw bonds as sticks, using `bond.order` (and `bond.aromatic`).
