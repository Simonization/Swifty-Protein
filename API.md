# Swifty-Proteins — API contract (v1)

The contract between **Rodolfo's React Native app** and **Simon's backend**.
Lock the shapes here on Day 1 so both sides build in parallel. The backend
enforces these shapes at runtime via JSON Schema, so the doc and the server
can't silently drift.

- **Base URL:** `http://<host>:3000/api/v1`
- **Format:** JSON in, JSON out (`Content-Type: application/json`).
- **Auth:** `Authorization: Bearer <jwt>` on protected routes.
- **Versioning:** path-prefixed (`/api/v1`) so v2 can coexist later.

---

## Core types

```jsonc
// One atom in a molecule.
Atom {
  "id":      1,         // integer, 1-based serial — bonds reference this
  "element": "C",       // chemical symbol: "C", "N", "O", "H", ...
  "name":    "C1",      // atom label from the source file
  "x":       0.0,       // Ångström
  "y":       0.0,
  "z":       0.0
}

// A bond between two atoms (by their id).
Bond {
  "a":     1,           // atom id
  "b":     2,           // atom id
  "order": 2            // 1 single · 2 double · 3 triple
}

// A fully-parsed ligand — the object Rodolfo renders.
Ligand {
  "id":      "ATP",
  "name":    "Adenosine triphosphate",   // optional
  "formula": "C10 H16 N5 O13 P3",        // optional
  "atoms":   [ Atom, ... ],
  "bonds":   [ Bond, ... ]
}

// List item (lightweight — no atoms/bonds).
LigandSummary { "id": "ATP", "name": "Adenosine triphosphate" }  // name optional

// Per-element reference data for CPK coloring + atom info tooltips.
Element {
  "symbol": "O",
  "name":   "Oxygen",
  "number": 8,            // atomic number
  "cpkHex": "FF0D0D",     // CPK/Jmol color, no leading '#'
  "radius": 1.52          // van der Waals radius (Å), for sphere scaling — optional
}

User { "id": "uuid", "username": "rodolfo", "createdAt": "2026-06-24T10:00:00.000Z" }
```

## Error shape

Every non-2xx response uses one shape:

```jsonc
{ "error": { "code": "invalid_credentials", "message": "Wrong username or password" } }
```

| Status | When |
|--------|------|
| `400 validation_error` | Body/query/params failed schema validation |
| `401 unauthorized` / `invalid_credentials` | Missing/invalid token, or bad login |
| `404 not_found` | Unknown route or ligand id |
| `409 username_taken` | Registering an existing username |
| `502 upstream_error` / `504 upstream_timeout` | RCSB fetch failed (ligand detail) |
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

### Ligands

#### `GET /api/v1/ligands?search=<q>`
List ligand codes, optionally filtered (case-insensitive substring on the code).
**Protected.**
```jsonc
// 200
{ "ligands": [ LigandSummary, ... ], "count": 42 }
```

#### `GET /api/v1/ligands/:id`
Fetch + parse a single ligand (backend pulls the CIF from RCSB, parses, caches).
**Protected.** → `200 Ligand`. `404` if the code is unknown, `502/504` if RCSB
is unreachable.

### Elements (reference data — for CPK colors & atom info)

#### `GET /api/v1/elements`
All known elements. **Public.** → `200 { "elements": [ Element, ... ] }`

#### `GET /api/v1/elements/:symbol`
One element by symbol (e.g. `/elements/O`). **Public.** → `200 Element`, `404` if unknown.

---

## Notes for the frontend (Rodolfo)

- **Token storage:** keep the JWT in secure storage (Keychain / Android Keystore).
  Re-auth on foreground = biometric unlock + optionally `GET /auth/me` to confirm
  the token is still valid.
- **Rendering:** `GET /ligands/:id` gives everything you need — `atoms[]` (spheres,
  colored via `cpkHex` from `/elements`) and `bonds[]` (sticks; double/triple via `order`).
- **Atom tap info:** combine the tapped `Atom` with its `Element` (name, number, color).
- **The skeleton already returns a valid sample `Ligand`** for any id, so you can
  build the 3D viewer before the real RCSB/CIF pipeline is wired up.
