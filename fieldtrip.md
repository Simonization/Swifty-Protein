# Field Trip Report & Architecture Decision

## The headline tension

- The adversarial audit (Agent 1) says: our backend relocates two mandatory mobile
  learning objectives — "Network Programming" and "File Parsing" (protein.md:112-113) — off
  the app and into Node. The subject says the app fetches from RCSB and "you must implement
  your own parser" (protein.md:134-136, 218-219). So during an in-person 42 peer defense,
  Rodolfo's app looks thin and can't demonstrate the parsing skill being graded.
  Recommendation: pull fetch+parse into the app.
- All three external scouts independently say the opposite-sounding thing: every old repo
  (llescure, aerragha, lpieri) is a standalone app with no backend, and their in-app
  fetch+parse is a mess — fetching inside the render loop, 1243 requests on launch,
  force-unwrap crashes, zero caching. So they confirm our backend looks more robust.

These aren't actually in conflict once you separate two axes:
- **Robustness** → the scouts are right that naive in-app fetch+parse is fragile.
- **Subject intent & defense** → Agent 1 is right that the skill must live in the app.

The resolution: a well-written in-app fetch+parse (proper async, typed errors, caching)
gets you both. The old repos were fragile because they cut corners, not because in-app
parsing is wrong. And a backend creates a real 42-defense liability the scouts flagged: if
it's not reachable during in-person eval, the core feature dies — and protein.md:167 says
any error during eval = automatic fail.

## What everyone agreed on (independent of the architecture call)

Confirmed we're right about: hashed passwords (llescure stored plaintext — a violation),
differentiated error messages (all three failed this), lazy on-select fetching (lpieri
eager-loaded 1243 ligands at launch 💀), bond-order extraction (SDF/PDB repos threw it
away — our CIF parser keeps it).

Concrete techniques worth borrowing:
- Foreground re-lock (reset to Login on AppState background) — all three implement it; our
  subject requires it (protein.md:196-202) and we don't acknowledge it anywhere yet.
- Three.js via expo-gl (aerragha) — the proven RN 3D path, incl. a vendored
  OrbitControls+PanResponder gesture bridge. This answers your very first question about RN
  3D libs: for native RN it's expo-gl+Three / react-three-fiber (Mol*/NGL are web-only, need
  a WebView).
- Data-driven CPK palettes as JSON (aerragha's dual Rasmol/Jmol), per-endpoint
  half-cylinder bonds (llescure), quaternion bond-orientation math (aerragha/lpieri),
  SCNView.snapshot-style capture for share, and auto-fit camera to bounding sphere instead
  of rescaling atom coords (aerragha's normalization trap).

## Confirmed defects in our own work

- URL bug: we use `/ligands/download/` but the subject specifies `/ligands/view/`
  (ligands.js:13 vs protein.md:135,218). Both work, but match the subject.
- Frontend is unstarted (only frontend/Dockerfile) — which is good news: an architecture
  course-correction is essentially free right now.

## Architecture decision

**Decision locked: fetch + parse move into the RN app; backend slims to auth-only.**

That resolves the audit's critical finding while preserving everything portable.

---

## Plan: Swifty-Proteins — Architecture course-correction

### Context

A four-agent "field trip" (1 adversarial audit of our repo + 3 scouts of older 42
submissions: llescure, aerragha, lpieri) surfaced one decisive problem and a pile
of borrowable lessons.

The problem: our current design puts the RCSB fetch and the CIF parsing in a
Node/Fastify backend. But the subject (protein.md) frames both as mobile
learning objectives — "Network Programming" and "File Parsing" (:112-113),
"you must implement your own parser" (:136), and the app fetches
`https://files.rcsb.org/ligands/view/{ligand}.cif` (:135, :218). Relocating
these to a server makes the RN app thin, undercuts the graded skill at in-person
peer defense, and creates a hard failure mode: if the backend is unreachable
during eval, the core feature dies — and protein.md:167 makes any error during
evaluation an automatic fail.

The decision (team, via the subject's Chapter III rule that architecture is the
team's call):
1. Move RCSB fetch + CIF parsing into the RN app.
2. Slim the backend to auth only (the one backend role the subject authorizes,
   VI.2 :186) — keeps the Argon2/JWT/Postgres/Docker reproducibility story for
   the RNCP context without infringing mobile objectives.

The frontend is unstarted (only frontend/Dockerfile exists), so this pivot is
nearly free now. The backend parser is pure logic and ports directly — no work is
thrown away, just relocated.

### Approach

#### 1. Slim the backend to auth-only (Simon)

- Retire from backend (after porting — see §2): `src/routes/ligands.js`,
  `src/routes/elements.js`, `src/services/ligands.js`, `src/services/cifParser.js`,
  `src/services/elements.js`, `test/cifParser.test.js`, `test/ligands.test.js`.
- Keep: `src/routes/auth.js`, `src/routes/health.js`, `src/services/userStore.js`,
  `src/lib/password.js` (Argon2id), `src/lib/errors.js`.
- Edit `src/app.js` to stop registering the ligand/element routes; drop
  `upstreamTimeoutMs` from `src/config.js`.
- Wire Postgres for accounts (now the backend's only job, so persistence matters):
  replace the in-memory userStore with a pg-backed store + a users migration.
  *(DB-access choice — plain pg vs Prisma — still open; defaulting to plain pg + SQL
  migration unless the team says otherwise.)*
- Update `API.md` to an auth-only contract; move the Atom/Bond/Ligand/Element
  type defs into an app-side data-model module (§2). Update `README.md`,
  `backend/README.md`, and `JURY.md` so the architecture description matches
  (backend = auth; ligand viewing = app ↔ RCSB direct).

#### 2. Port the good work into the app as shared TypeScript (Simon can own these)

- `backend/src/services/cifParser.js` → `frontend/src/lib/cif.ts` — same proven
  algorithm (loop parse, ideal-coord preference w/ model fallback, atom-name→id,
  bond-order map). Add aromatic-bond capture (scouts: needed for bonus VII.3).
  Verified against live ATP (47 atoms / 49 bonds) — keep that as a sanity check.
- `backend/src/services/elements.js` → `frontend/src/data/elements.ts` — bundle
  in-app (no network for colors). Structure for dual Rasmol/Jmol palettes
  (borrowed from aerragha `src/consts/CPK_Colors.json`) to make bonus VII.1 cheap.
- `backend/test/cifParser.test.js` (+ `test/fixtures/FOR.cif`) →
  `frontend/__tests__/cif.test.ts` (Jest).

#### 3. App networking, caching, list (subject V, VI.3)

- `frontend/src/api/rcsb.ts`: fetch the correct URL `.../ligands/view/{id}.cif`,
  async + AbortController timeout, mapped to typed errors →
  differentiated user messages (404 / offline / parse / timeout) per :221-225
  (all three scouted repos failed this — it's a differentiator).
- Local cache of parsed ligands (expo-file-system/AsyncStorage) → offline for
  previously loaded ligands (:164, VII.4).
- Bundle `ligands.txt` as an asset; client-side case-insensitive search
  (:209-215) — fixes the case-sensitive bug seen in llescure.

#### 4. App screens (subject VI.1–VI.4)

- **VI.1** molecular app icon + 1–2s splash.
- **VI.2** Login: account create (username + password rules) → backend auth; store
  JWT in expo-secure-store (Keychain/KeyStore). Biometric via
  expo-local-authentication with an always-available username/password fallback
  (don't hide it like llescure) + clear failure alerts. Foreground re-lock:
  global AppState listener resets to Login on background/inactive — satisfies the
  "login on every foreground" rule (:196-202); borrowed from lpieri SceneDelegate
  / aerragha AppState (do it at the navigator level, with cleanup).
- **VI.3** List: FlatList, real-time search, tap → loading indicator → fetch+parse
  → navigate; lazy/on-select fetch (NOT eager — lpieri loaded 1243 at launch).
- **VI.4** 3D view: Three.js via expo-gl (proven RN path; Mol*/NGL are web-only).
  - Ball-and-stick: spheres sized by vdW radius + cylinders; bond order →
    double/triple; per-endpoint half-cylinder coloring (llescure).
  - Bond geometry: quaternion/euler alignment (aerragha/lpieri createLink).
  - Auto-fit camera to bounding sphere — do NOT normalize atom coords
    (aerragha's normalization falsifies geometry).
  - Multi-light setup (avoid flat look; :271-275).
  - Gestures (rotate/zoom/pan): port aerragha's OrbitControls + PanResponder bridge
    (`src/components/OrbitControls.js`).
  - Atom tap → raycast → tooltip (element + name/coords), dismiss on tap-elsewhere.
  - Share: capture GL view (react-native-view-shot/expo-sharing).

### Critical files

- **Backend edit/retire:** `backend/src/app.js`, `backend/src/config.js`, the
  ligand/element routes+services+tests listed in §1; `API.md`, `README.md`,
  `backend/README.md`, `JURY.md`, possibly `docker-compose.yml`.
- **App create** (Expo + TS in `frontend/`): `src/lib/cif.ts`, `src/data/elements.ts`,
  `src/api/{rcsb,auth}.ts`, `src/cache/*`, `src/navigation/*`,
  `src/screens/{Login,LigandList,LigandView}.tsx`, `src/three/*` (renderer +
  OrbitControls bridge), `assets/ligands.txt`, app icon/splash,
  `__tests__/cif.test.ts`.

### Reuse (don't rewrite)

- Port — not rewrite — `cifParser.js` and `elements.js`; reuse `test/fixtures/FOR.cif`.
- Keep backend auth as-is (`auth.js`, `userStore.js`, `password.js`, `errors.js`).
- Borrowed scout patterns (cite in code comments): foreground re-lock, OrbitControls
  bridge, half-cylinder bonds, quaternion bond math, dual-palette CPK JSON,
  camera auto-fit (the anti-pattern to avoid).

### Verification

- **Backend:** `cd backend && npm test` (auth); `make up`; curl register/login/me +
  /health; confirm accounts persist across restart once Postgres is wired.
- **App:** jest (cif parser vs FOR.cif fixture + optional live-ATP check); then
  on a real device (subject requires) walk the full flow — biometric login +
  password fallback, foreground re-lock, case-insensitive search, load ATP/HEM, 3D
  rotate/zoom/tap/share, and the error cases (airplane mode → offline msg; bad id →
  404 msg; reopen a cached ligand offline). No crash/freeze anywhere (:167).

### Notes / open items

- Team/role: the CIF parser moves to the app but stays Simon's logic — he can own the
  shared `cif.ts` module; good topic for the Monday call.
- DB-access choice for the auth backend (plain pg + SQL vs Prisma) still to confirm.
- Keep mmCIF (our parser works, it's the subject default); `_ideal.sdf` is a simpler
  fallback the subject permits (:138) if mmCIF edge cases bite.
