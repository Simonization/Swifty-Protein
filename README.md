# Swifty-Protein

A cross-platform mobile app (**React Native / Expo**) for the 42 school
*Swifty-Proteins* project. Log in with biometrics, search 1,243 ligands from the
RCSB Protein Data Bank, and explore the selected molecule in interactive 3D —
CPK-coloured ball-and-stick, tap an atom for its element, rotate, zoom, measure,
and share.

> Stack: **React Native** (Expo SDK 57), **three.js** via `expo-gl`, **Fastify** +
> **Postgres** for accounts. One shared codebase for iOS and Android.

## Run it

The jury guide is [`JURY.md`](JURY.md) — start there. The short version:

```bash
make doctor   # checks this machine has what it needs
make up       # backend API + database in Docker, verified healthy before it returns
make test     # both test suites, no Docker required
```

Then install the APK on an Android device (see [`JURY.md`](JURY.md)), or run
`cd frontend && npx expo start` and open it with Expo Go.

> **Note on Expo Go:** the app icon and the native launch screen are applied at
> build time, so under Expo Go you see *Expo's* icon and splash, not ours. Use the
> APK to evaluate them.

## Architecture

The app owns the ligand pipeline; the backend is **auth-only**. That keeps the
subject's mobile learning objectives — Network Programming and File Parsing — in
the app itself rather than hidden behind an API.

- **RN app** → fetches `.cif` directly from RCSB (`/ligands/view/{id}.cif`), parses
  it in-app (`frontend/src/lib/cif.ts`), renders 3D with instanced meshes, handles
  biometric login and the foreground re-lock.
- **Backend (Fastify)** → accounts only: register / login / me, JWT with an expiry,
  Argon2id at pinned cost parameters, rate-limited credential endpoints, Postgres.
- Ligands you have already opened are **cached on the device** and open again with
  no connection at all. Signing in still needs the backend — the subject requires
  the login view on every launch, so there is no offline path past it.

See [`API.md`](API.md) for the contract, [`AI_USAGE.md`](AI_USAGE.md) for how AI was
used (subject Ch. III), and [`fieldtrip.md`](fieldtrip.md) for how the architecture
got here.

## Layout

```
frontend/   the Expo app — screens, 3D viewer, CIF parser, element data, tests
backend/    Fastify auth API — JWT, Argon2id, Postgres, tests
scripts/    doctor / ensure-env / smoke, called by the Makefile
```

## Team & ownership

| Person | Scope |
|--------|-------|
| **Rodolfo** | RN app craft: navigation, auth/biometric screens, ligand list + search, the 3D molecule viewer, sharing, UI polish, the Android build path |
| **Simon** | Auth API (JWT, Argon2id, Postgres), Docker/reproducibility, and the shared TS modules — `frontend/src/lib` (`cif`, `rcsb`, `moleculeGeometry`) and `frontend/src/{data,types}` |

Per `protein.md` Ch. III, each of us can explain any part of it at defense,
whoever wrote it.

## Schedule

*Record of how the work was planned; kept for the defense conversation.*

Weekly Monday calls from **22 June**. The ligand pipeline was originally scoped as
a backend API (weeks 3–5) and moved into the app instead — those endpoints were
retired, and `backend/test/auth.test.js` asserts they now 404. The work itself
still exists, as `frontend/src/lib/` and `frontend/src/data/`.

| Week | Focus |
|---|---|
| 22 Jun | Stack, repo structure, API contract, scope |
| 29 Jun | Login screen + biometric flow; auth API and user storage |
| 6–20 Jul | Ligand list and search; CIF pipeline; 3D rendering |
| 27 Jul | 3D viewer complete — rotation, atom info, render modes, sharing |
| 3–10 Aug | Both off |
| 17 Aug | Bug fixing, polish, edge cases, demo prep |
| **24 Aug** | **Final checkpoint** — full integration pass, every defense requirement verified |
| **31 Aug** | **Hand-in** + all 3 peer corrections |
