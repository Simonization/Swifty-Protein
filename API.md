# Swifty-Proteins — API contract (v1)

> **Architecture:** the backend is **auth-only**. Ligand data is **not** served
> here — the React Native app fetches `.cif` files directly from RCSB
> (`https://files.rcsb.org/ligands/view/{ligand}.cif`) and parses them in-app, so
> "Network Programming" and "File Parsing" stay where the subject wants them (in
> the mobile app). See *App-side molecular data* at the bottom.

The contract between **Rodolfo's React Native app** and **Simon's backend**.

- **Base URL:** `http://<host>:3000/api/v1`
- **Format:** JSON in, JSON out (`Content-Type: application/json`).
- **Auth:** `Authorization: Bearer <jwt>` on protected routes.
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
| `400 validation_error` | Body failed schema validation |
| `401 unauthorized` / `invalid_credentials` | Missing/invalid token, or bad login |
| `404 not_found` | Unknown route |
| `409 username_taken` | Registering an existing username |
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
Validate the current token / fetch the user. **Protected.** Handy for the
"re-authenticate on foreground" flow. → `200 { "user": User }`

---

## App-side molecular data (no backend involved)

The app owns the ligand pipeline. The shared, framework-agnostic modules live in
the frontend and are unit-tested:

| Concern | Where |
|---------|-------|
| Molecular types (`Atom`, `Bond`, `Ligand`, `Element`) | `frontend/src/types.ts` |
| CIF parser (`parseLigandCif`) | `frontend/src/lib/cif.ts` |
| RCSB fetch + typed errors (`fetchLigand`) | `frontend/src/lib/rcsb.ts` |
| CPK colors + vdW radii (`getElement`, `elementFor`) | `frontend/src/data/elements.ts` |
| Parser tests | `frontend/__tests__/cif.test.ts` |

Notes for the frontend (Rodolfo):
- **Token storage:** keep the JWT in secure storage (Keychain / Android Keystore).
  Re-auth on foreground = biometric unlock + optionally `GET /auth/me`.
- **Ligand view:** `fetchLigand(id)` returns a parsed `Ligand` (`atoms[]` + `bonds[]`)
  or throws an `RcsbError` whose `.kind` (`not_found`/`offline`/`timeout`/`parse`)
  already carries the subject's user-facing message.
- **Rendering:** color atoms via `elementFor(atom.element).cpkHex`; size spheres by
  `.radius`; draw bonds as sticks, using `bond.order` (and `bond.aromatic`).
