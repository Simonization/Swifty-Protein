# Merge rperez's app, fix what breaks the grade, cut the bloat

## Context

Rodolfo (`Rodolfo9898`) built the entire React Native app — auth flow, ligand list, and a 543-line Three.js `MoleculeViewer` — directly on top of my shared core, pushing straight to `main`. **`origin/main` is 4 commits ahead of `simon-backend` with zero divergence**, so the "merge" is a fast-forward, not a conflict resolution. The actual work is everything after it.

The grade is governed by two lines in `protein.md`:

> **WARNING:** Any application that crashes, freezes, or displays errors during evaluation will receive a failing grade, **regardless of implemented features.** (Ch. V)

> The bonus part will only be evaluated if the mandatory part is PERFECT... your bonuses will be **TOTALLY IGNORED.** (Ch. VII)

Rodolfo has already built **all of VII.1** (4 view modes) and **all five of VII.3** (highlighting, bond info, measurement, labels, center-on-atom). That is a lot of bonus surface. **It is currently worth zero points**, because five defects break the mandatory part — and two of them are in *my* module, not his. This plan fixes the mandatory part first (which alone unlocks the bonus work already written), makes the docs honest, strips the bloat, then builds the three bonuses the docs already promise.

I verified every finding below against live RCSB data and the real source. Two claims from my first-pass review turned out to be **wrong** and are deliberately excluded: CIF `;` text blocks (zero occurrences across 10 sampled ligands — not a real-world case) and `expo-splash-screen` (configured-but-unimported is harmless; the JS splash covers it).

---

## Tier 0 — Breaks the mandatory part (bonuses score 0 until these are fixed)

| # | Defect | Evidence | Owner |
|---|--------|----------|-------|
| 1 | **Single-row mmCIF categories drop atoms/bonds** | `23 of 24` sampled ion ligands fail to open | **mine** |
| 2 | **`sizeRef` mixes px and dp** | tap-an-atom misses on every real device | Rodolfo |
| 3 | **Re-lock fires on `inactive`** | share sheet kicks user to Login mid-share | Rodolfo |
| 4 | **Element table has 16 entries** | `B12`'s cobalt renders hot pink | **mine** |
| 5 | **`make up` crash-loops** | the one command JURY.md gives the evaluator | **mine** |

### 1. CIF parser drops single-row categories — `frontend/src/lib/cif.ts`

mmCIF omits `loop_` for any category with exactly one row. `parseLigandCif:108` only reads atoms from `loops`, so the block lands in `singles` and is lost. Two distinct failures, both verified against live RCSB:

- **1-atom ligands** (`CU`, `ZN`, `FE`, `MG`, `CA`, `NA`, `K`, `MN`, `CO`, `NI`, `CD`, `HG`, `PT`, `AU`, `LI`, `CS`, `RB`, `BA`, `SR`, `PB`, `CL`, `BR`, `IOD` — **23 of 24 sampled**): atom category un-looped → `atoms: []` → `rcsb.ts:54` throws `parse` → the app shows *"Failed to parse ligand data. The file may be corrupted."* for a **perfectly valid ligand**. `ZN` and `FE` are two-letter, famous, and trivially searchable — a corrector hits this in the first minute.
- **2-atom ligands** (`OXY`, `CMO`, `NO`): atom category *is* looped but the **bond** category is not → `bonds: []` → renders as two disconnected spheres **with no stick**. Silently wrong, no error — worse than the alert above.

**Fix** — symmetric, and general rather than a special case. Add to `cif.ts`:

```ts
// mmCIF omits `loop_` for single-row categories (e.g. the 1-atom CU ligand),
// so the category arrives as singles. Present it as a one-row loop.
function loopFromSingles(singles: Record<string, string>, prefix: string): Loop | undefined {
  const headers = Object.keys(singles).filter((k) => k.startsWith(prefix));
  if (headers.length === 0) return undefined;
  return { headers, rows: [headers.map((h) => singles[h])] };
}
```

Then apply to **both** categories, reusing the existing `findLoop`:

```ts
const atomLoop = findLoop(loops, '_chem_comp_atom.') ?? loopFromSingles(singles, '_chem_comp_atom.');
const bondLoop = findLoop(loops, '_chem_comp_bond.') ?? loopFromSingles(singles, '_chem_comp_bond.');
```

Everything downstream (`colIndex`'s `.`-suffix match, coordinate fallback, `idByName`) works unchanged. The viewer already survives a 1-atom/0-bond molecule: `baseDistance = max(maxDist * 2.6, 4)` floors at 4, so there is no divide-by-zero.

### 2. `sizeRef` written in two coordinate systems — `frontend/src/components/MoleculeViewer.tsx`

`onContextCreate:327-329` stores **physical pixels** (`gl.drawingBufferWidth`); `onLayout:502-504` stores **layout dp**. Both consumers need dp — `handleSingleTap:237-238` divides gesture dp coords by it, and label projection `:467,473-474` multiplies to produce dp `left`/`top`.

A GL surface cannot exist before layout, so **`onContextCreate` fires last and wins** → `sizeRef` holds px. Consequences on any real device (`pixelRatio` 2–3):
- **Tap-an-atom is broken** — NDC compressed ~2-3×, so only taps near the top-left register, and they hit the wrong atom. This is **mandatory VI.4**, and it also silently breaks Rodolfo's VII.3 highlighting/measurement.
- **Atom labels fly off-screen** (VII.3).
- **Rotating the device breaks rendering** — on re-layout the renderer *exists*, so `setSize(dp)` at `:510` now runs and shrinks the viewport. `app.json` sets `orientation: "default"` and Ch. V requires orientation support, so a corrector will rotate.

**Fix** — make `onLayout` the single writer of `sizeRef` (always dp) and derive the ratio from the two values we already have, rather than trusting `PixelRatio.get()` to agree with the GL buffer:

```ts
const pixelRatio = gl.drawingBufferWidth / layoutRef.current.width;
```

Construct the `Renderer` with dp + that `pixelRatio`, and keep `setSize` in dp so the layout path and the create path finally agree. Verify by tapping a corner atom on a real device.

### 3. Foreground re-lock fires on `inactive`, not `background` — `frontend/src/auth/AuthContext.tsx:61`

`if (next !== 'active' && wasUnlocked.current)` re-locks on **`inactive`**, which iOS fires for the share sheet, Control Center, notification banners, and incoming calls. `Sharing.shareAsync` (`LigandViewScreen.tsx:56`) presents a system sheet → the user is thrown to the Login screen mid-share. That breaks **mandatory VI.4 Share**, and a notification banner during the demo would do the same.

**Fix**: re-lock on `next === 'background'` only. This is *also* what the subject actually asks for (VI.2: "brought back from the background", "reopened after pressing the Home button") — both are `background`. Narrowing the check fixes the bug and tightens rubric compliance simultaneously. Update the stale comment at `:5`, which already says "returning from background".

### 4. Element table covers 16 elements — `frontend/src/data/elements.ts`

VI.4 mandates CPK colours and says *"Other elements: use standard CPK colors."* The table has `H C N O F NA MG P S CL K CA FE ZN BR I`; everything else falls to a hot-pink `FF1493`. Verified against live data: **`B12` (in the list, 180 atoms) contains cobalt → hot pink**. `CU` is itself a ligand entry → the whole molecule is one hot-pink ball. Also missing: Mn, Se, B, Ni, Mo, As, Hg, Pt, Au, Ag, Cd, Pb, Li, Cs, Rb, Ba, Sr, Al, Si, V, Cr, W.

**Fix**: replace with the full Jmol/CPK table (118 elements, symbol + hex + van der Waals radius). Pure data, no logic change. Keep the `X` fallback for genuinely unknown symbols. *(Aside: the note I originally left in this file explaining how to add a second palette was deleted in `f40e421` without the work being done — see VII.1 note in Tier 3.)*

### 5. `make up` crash-loops — `docker-compose.yml` + `backend/src/config.js`

`backend/Dockerfile:9` sets `ENV NODE_ENV=production`. The compose `backend` service sets only `DATABASE_URL` and `PORT` — **no `JWT_SECRET`**. So `config.js:9` → `isProd: true`, `:7` → falls back to `DEV_SECRET`, `:13-15` → **throws at module load**. `restart: unless-stopped` turns that into a crash loop and the healthcheck never goes green. **`make up` is the single command `JURY.md:12` tells the evaluator to run.**

**Fix**: generate/inject `JWT_SECRET` in compose (`${JWT_SECRET:?set JWT_SECRET}` with a root `.env`, or a documented default for local dev). Keep the production guard — it did its job. Add a `make up` smoke check so this can never regress silently.

---

## Tier 1 — Docs that lie (Ch. III credibility risk)

A corrector who reads `JURY.md` and tries these gets three strikes before they open the app. Per the chosen "aggressive cleanup" path:

- **`JURY.md`** — advertises **offline caching** (`:28`) and an **in-app settings screen** (`:50-51`) that do not exist; claims images are **"pinned to specific patch releases"** (`:134-137`) when all three are floating tags — ten lines after warning that mutable tags drift; presents `make apk` as working when it cannot (below). Roughly two-thirds of the file is a reproducibility thesis about an APK that doesn't exist. **Slim to a short, accurate runbook.** Tier 3 makes the caching + settings claims true; delete the rest.
- **`project-management.md`** — **delete.** Entirely pre-decision: proposes SceneKit/ViroCore, "pick platform (Swift/Kotlin/Flutter)", and defines the handoff contract *in Swift* (`struct Atom { let position: SIMD3<Float> }`). The real contract is `frontend/src/types.ts`, and the shapes materially differ (`Bond` uses atom **ids**, not array indices). Superseded by `fieldtrip.md` + `API.md`.
- **`fieldtrip.md`** — mark as a **historical ADR** with a dated header. It's a point-in-time record whose plan sections are now executed, but nothing says so, and it still asserts "Frontend is unstarted" (`:49-50`) and references files that never existed (`src/lib/errors.js`, `src/cache/*`, `src/three/*`).
- **`README.md`** — broken link to `.claude/plans/...` (untracked, `:21`); the week plan still assigns me the **retired** ligand + element endpoints (`:68`, `:75`) that `backend/test/auth.test.js:71-76` asserts now 404.
- **`frontend/README.md`** — describes a `HomeScreen` that doesn't exist (`:31`, `:54`) and the viewer as future work; omits `MoleculeViewer`/`SearchBar`/`LoadingOverlay`.
- **`backend/package.json:6`** — still describes the service as "auth, ligand data, element reference".
- **`API.md`** — the most accurate doc. Only fix: `:76-77` claims the shared modules "are unit-tested" but only `cif.ts` has tests; and document token expiry once Tier 2 adds it.

---

## Tier 2 — Simplify / cut the AI bloat

**Yes, there's bloat** — and it clusters in exactly the places nobody had to defend out loud:

- **`ligands.txt` exists three times.** Root `ligands.txt` and `frontend/assets/ligands.txt` are byte-identical (verified, same md5); `frontend/src/data/ligandIds.ts` is a generated third copy. **The root copy is read by nothing.** Delete it; keep `assets/ligands.txt` as the subject-provided source and the generated `.ts` as the runtime artifact.
- **`frontend/Dockerfile` — delete (or fix honestly).** 67 lines provisioning a full pinned Android SDK + JDK to run `cd android && ./gradlew assembleRelease` — for an **Expo managed app with no `android/` directory** and no `expo prebuild` step anywhere. It cannot work, and `make apk` + a third of `JURY.md` depend on it. Recommend replacing with EAS build or documented `expo prebuild`, and cutting the compose `apk-builder` profile if we drop it.
- **No `.dockerignore`.** Both Dockerfiles `COPY . .` after `npm ci`, so a host `node_modules` overwrites the clean install — for the backend that means **host-built `argon2` native bindings landing in a Linux image**.
- **Dead code**: `api/auth.ts:28` `me()` (implemented, typed, tested — and called by nothing); `elements.ts:30,34` `allElements`/`getElement`; `types.ts:28` `LigandSummary`; unused `theme` exports; deps `expo-asset` + `expo-file-system` (0 real imports); the redundant `0.0001` wireframe scale at `MoleculeViewer.tsx:72` (the mesh is already `visible = false`); dead "not scaffolded yet" branches in both Dockerfiles.
- **`MoleculeViewer` perf**: `setLabelPositions` fires ~15×/sec from the RAF loop (`:466-479`), and each re-render rebuilds every `Gesture` object and re-runs a `useImperativeHandle` that **has no dependency array** (`:151`). Labels-on turns a static screen into a continuous React render loop. Also `:400-401` does `ligand.atoms.find()` **inside** the bond loop — O(atoms×bonds) — two lines after a `positions` Map keyed by `atom.id` already exists.
- **Duplicated logic**: `clearMeasurement` is called from both `MoleculeViewer.tsx:148` (correctly, on `measureMode` change) and `LigandViewScreen.tsx:66` — the latter **from inside a `setState` updater**, which React may invoke twice under StrictMode. Drop the screen-side call. `MIN_USERNAME`/`MIN_PASSWORD` are duplicated across `LoginScreen.tsx:16-17` and `RegisterScreen.tsx:16-18`.
- **Backend**: JWTs have **no `exp` claim** — tokens are valid forever (`routes/auth.js:16-17` signs with no options). Add a TTL and document it in `API.md`. Also `/me` returns `200 {"user": null}` for a valid token whose user is gone (`routes/auth.js:51-52`) — should be 401.
- **`client.ts:67`** — unguarded `JSON.parse` throws a raw `SyntaxError` past the `ApiError` model on any non-JSON body (proxy error page, 502).

---

## Tier 3 — The wow factor: make the promised bonuses real

Chosen direction. Each item is a real Ch. VII bonus **and** retires a false claim in `JURY.md`.

1. **Settings screen (VII.2)** — also solves a genuine blocker: `EXPO_PUBLIC_API_URL` is **inlined at build time** and defaults to `http://localhost:3000`, so the shipped APK points at *the phone itself* and login can never reach the evaluator's laptop. A runtime-overridable server URL (persisted, defaulting to the build-time value) makes the APK actually usable, satisfies VII.2, and makes `JURY.md:50-51` true. Add default view mode + label toggle while we're there.
2. **Offline CIF caching (VII.4)** — cache raw `.cif` text to `expo-file-system` keyed by ligand id; `fetchLigand` checks cache first. `expo-file-system` is *already a dependency* and `rcsb.ts:9-11` already documents this as "a thin wrapper to be added". Makes `JURY.md:28` true and gives a killer demo: **airplane mode → previously viewed ligand still opens.**
3. **Custom share message (VII.5)** — `LigandViewScreen.tsx:56` already passes a `dialogTitle`. Include name, formula, and atom count (e.g. *"ATP — C10 H16 N5 O13 P3 · 47 atoms"*). Cheap, visible polish.

---

## Sequencing

1. **Merge** — `git checkout main && git merge --ff-only origin/main`, then branch `simon-review` off it. (`simon-backend` is fully contained in `origin/main`; it can be deleted afterward.)
2. **Tier 0**, one commit per defect — each is independently defensible at the peer review.
3. **Tier 2** code cleanups, **Tier 1** docs.
4. **Tier 3** bonuses.
5. Open a PR so Rodolfo reviews the changes to his viewer and screens.

## Verification

Run these against the real thing — not just the type-checker.

- **Parser (Tier 0.1)** — add fixtures from the live files I already pulled: `CU.cif` (1 atom, un-looped atoms) and `OXY.cif` (2 atoms, un-looped **bonds**). Assert `CU` → 1 atom / 0 bonds and `OXY` → 2 atoms / **1 bond**. Add the **ATP → 47 atoms / 49 bonds** regression that `cif.ts:9-11` and `fieldtrip.md:114` have claimed all along but never actually tested (I confirmed both numbers against live RCSB this session).
- **`npm test` in `frontend/` may not run at all** — there is **no `babel.config.js`**, and `jest-expo` transforms via `babel-jest`, which resolves Babel config from the project. Check this first; if it fails, add `babel.config.js` with `babel-preset-expo`. The 4 existing CIF tests are the only tests in the repo.
- **Device, not simulator** (Ch. V requires it, and defects 2–3 only reproduce there): tap a **corner** atom → correct atom highlights; **rotate the device** → render stays correct; **tap Share** → the sheet opens and you are *not* thrown to Login.
- **The corrector's path**: search `ZN` → opens (single hot-pink-free sphere); `B12` → cobalt renders correct-coloured across 180 atoms; `OXY` → two balls **with a stick**; `ATP` → 47 atoms.
- **`make up`** → backend healthy, `curl localhost:3000/health` → `{"status":"ok"}`, then register + login end-to-end from the app.
- **Airplane mode** (Tier 3.2) → previously-viewed ligand still opens.

## Ownership note

Two of the five mandatory-breaking defects (the parser, the element table) are in **my** modules, and `make up` is my infra. Per `protein.md` Ch. III we each have to defend any part of this — the CIF single-row-category bug is a genuinely good defense story: *mmCIF omits `loop_` for single-row categories, we found it against live `CU`/`OXY` data, and the fix is four lines that generalise rather than special-case.* Worth rehearsing rather than glossing.
