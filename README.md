# Swifty-Protein

A cross-platform mobile app (**React Native**) for the 42 school *Swifty-Proteins* project.
It lets a user authenticate, browse a list of ligands, and render the selected
molecule in interactive 3D (atoms as spheres, bonds as sticks), with per-atom
info, rotation, multiple render modes, and sharing.

> Stack: **React Native**. (Not Swift / Kotlin — single shared codebase for iOS & Android.)

## Architecture

The app owns the ligand pipeline; the backend is **auth-only**. This keeps the
subject's mobile learning objectives — Network Programming and File Parsing — in
the app, and means the core feature (viewing molecules) works even if the backend
is unreachable.

- **RN app** → fetches `.cif` directly from RCSB (`/ligands/view/{id}.cif`), parses
  in-app (`frontend/src/lib/`), renders 3D, handles biometric login + foreground re-lock.
- **Backend (Fastify)** → accounts only: register / login / me, JWT, Argon2id, Postgres.
- See [`API.md`](API.md) for the contract and the rationale in
  [the architecture plan](.claude/plans/now-one-overview-agent-functional-cat.md).

**Ownership:** Simon authors and defends the *shared core* (CIF parser, RCSB fetch,
types, element data — they run in the app but are Simon's modules). Rodolfo authors
the app UI, the 3D viewer, and the auth/biometric flow, and consumes the shared core
through its typed API. Per `protein.md` Ch. III, each of us must still be able to
explain any part at defense.

## Team & responsibilities

| Person | Role | Scope |
|--------|------|-------|
| **Rodolfo** | Frontend (app craft) | RN app: navigation, auth/biometric screens, foreground re-lock, ligand list + search, **3D molecule viewer**, sharing, UI polish — consumes the shared core below |
| **Simon** | Backend + shared core | Auth API (JWT, Argon2id, Postgres), Docker/reproducibility, and the shared TS modules in `frontend/src/lib` (`cif`, `rcsb`) & `frontend/src/{data,types}` |

## Deadlines

- **Mon 24 August** — final checkpoint: everything reviewed and confirmed correct *before* submission.
- **Mon 31 August** — project handed in + all **3 peer corrections** completed with our 42 peers.

A **call every Monday** kicks off each week.

## ⚠️ Planning constraint

Both of us are off during the weeks of **3 August** and **10 August**, so the app
must be **feature-complete by Sunday 2 August** (end of the 27 July week).
Weeks after that are reserved for solo polish, integration, and the final checkpoint.

Off-weeks:
- **Rodolfo off:** week of 13 Jul, 3 Aug, 10 Aug
- **Simon off:** week of 27 Jul, 3 Aug, 10 Aug, 17 Aug

## Week-by-week plan

Each week begins with the Monday call.

### Week 1 — Mon 22 Jun  · _both_
- **Call:** agree on stack, repo structure, API contract, scope.
- **Rodolfo:** scaffold the RN app, set up navigation and screen skeletons.
- **Simon:** scaffold the backend service, choose framework, set up DB + auth endpoint skeletons.

### Week 2 — Mon 29 Jun  · _both_
- **Rodolfo:** Login screen UI + biometric (Face/Touch ID) auth flow.
- **Simon:** Auth API (register / login, tokens or sessions), user storage.

### Week 3 — Mon 6 Jul  · _both_
- **Rodolfo:** Ligand list screen with search; wire login screen to the backend.
- **Simon:** Ligand data endpoint — fetch ligand files (RCSB), parse, cache, serve to the app.

### Week 4 — Mon 13 Jul  · _Simon only (Rodolfo off)_
- **Simon:** Harden the ligand API, caching layer, error handling, tests; document the API for Rodolfo.

### Week 5 — Mon 20 Jul  · _both_
- **Rodolfo:** 3D molecule rendering — atoms as spheres, bonds as sticks (the core feature).
- **Simon:** Atom-metadata endpoint, finalize the API, deploy the backend to a host.

### Week 6 — Mon 27 Jul  · _Rodolfo only (Simon off)_  🎯 feature-complete target
- **Rodolfo:** Finish the 3D viewer — rotation, tap an atom for info, render modes, share a screenshot. Consume the deployed backend.
- **Target:** app feature-complete by **Sun 2 Aug**.

### Week 7 — Mon 3 Aug  · _both off_
- No work (holidays).

### Week 8 — Mon 10 Aug  · _both off_
- No work (holidays).

### Week 9 — Mon 17 Aug  · _Rodolfo only (Simon off)_
- **Rodolfo:** Bug fixing, UI polish, edge cases, prepare the demo.

### Week 10 — Mon 24 Aug  · _both_  ✅ FINAL CHECKPOINT
- **Both:** full integration test, fix remaining bugs, verify every defense requirement, prep for peer evaluations. Confirm everything is correct before submission.

### Week 11 — Mon 31 Aug  · _both_  🏁 DEADLINE
- **Both:** submit the project and complete all **3 peer corrections** with our 42 peers.
