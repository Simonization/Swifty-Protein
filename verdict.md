# Swifty Protein — repository verdict

Audit date: 2026-07-25  
Scope: the repository as committed, assessed against the supplied Swifty Protein v6.0 subject.

## Final verdict

| Part | Verdict |
|---|---|
| Mandatory | **FAIL — not submission-ready** |
| Bonus | **NOT ELIGIBLE** because the subject evaluates bonuses only when the mandatory part is perfect |

There is a considerable amount of relevant implementation, especially in the ligand
list, authentication design, CIF pipeline, and 3D viewer. However, the committed
project cannot currently be delivered through its documented path:

1. `make up` starts the backend with `NODE_ENV=production`, but Compose provides no
   `JWT_SECRET`. `backend/src/config.js` deliberately throws in exactly that case,
   so registration and login cannot work through the documented jury setup.
2. `dist/app-release.apk` is not present. The APK builder ends with
   `cd android && ./gradlew assembleRelease`, but `frontend/android` does not exist
   and the image never runs `expo prebuild`.
3. No real-device or release-build evidence is included, so crash-free operation,
   gesture behavior, biometric behavior, sharing, and performance cannot be accepted
   as “flawless.”

Either delivery blocker prevents a perfect mandatory evaluation.

## Mandatory assessment

### General requirements

| Requirement | Status | Evidence and assessment |
|---|---|---|
| Mobile platform and modern stack | **Partial** | React Native/Expo is an authorized multiplatform choice. `expo@57.0.2`, React Native 0.86, and React 19.2.3 match the current Expo SDK 57 compatibility table. The provided build image is not compatible with that setup: it uses Node 20 and Android platform/build-tools 34, while Expo SDK 57 documents Node 22.13+ and Android compile/target SDK 36. |
| RCSB `.cif` retrieval | **Present** | `frontend/src/lib/rcsb.ts` uses the required `https://files.rcsb.org/ligands/view/{ligand}.cif` endpoint. |
| Own CIF parser | **Present, limited** | `frontend/src/lib/cif.ts` parses `_chem_comp_atom` and `_chem_comp_bond`, metadata, coordinates, orders, and aromatic flags. It is a pragmatic subset rather than a full CIF parser. It does not validate non-finite coordinates or support all CIF multiline/wrapped constructs. |
| Responsive UI | **Present in source** | Flex layouts, `SafeAreaView`, `FlatList`, scrolling login/register views, and unrestricted orientation are used. Tablet support is enabled. Runtime behavior was not verified. |
| Asynchronous network and responsive UI | **Partial** | Network requests use `fetch`, `AbortController`, and loading UI. CIF parsing is synchronous on the React Native JavaScript thread, with no worker/background parser or size guard for large files. |
| Graceful errors | **Mostly present** | Ligand 404, timeout, offline, and empty-parse cases have user-facing alerts. All non-404 HTTP failures are classified as “offline,” and malformed successful JSON from the auth backend can escape as a generic error. Large-file/memory handling is absent. |
| Secure account storage | **Present in design** | Passwords are hashed with Argon2id in `backend/src/lib/password.js`; JWT/user state uses `expo-secure-store`. Passwords are not stored by the app. The documented backend deployment is nevertheless broken by the missing production JWT secret, and the documented device API uses plain HTTP. |
| Accessibility | **Weak/partial** | Contrast and readable labels are considered, but icon-only controls and custom pressables generally have no explicit accessibility labels, roles, or hints. |
| Real-device testing | **Not evidenced** | There is no APK, device-test report, profiling output, or reproducible release run in the repository. |

Current Expo compatibility reference:
[Expo SDK reference](https://docs.expo.dev/versions/latest/).

### VI.1 Application Icon and Launch Screen — **PASS IN SOURCE**

- `frontend/assets/icon.png` now contains a custom molecular/scientific app icon,
  with a clear ball-and-stick protein-chain mark and CPK-inspired atom colors.
- Android has matching adaptive foreground, monochrome, and navy background assets.
- `frontend/assets/splash-icon.png` contains a transparent version of the same
  molecular mark rather than Expo template artwork.
- `frontend/app.json` configures the final icon and splash paths, and
  `frontend/src/navigation/RootNavigator.tsx` keeps an in-app splash visible for
  at least 1.2 seconds.
- `frontend/src/screens/SplashScreen.tsx` provides an animated, thematic in-app
  splash.

The repository now satisfies the icon and launch-screen implementation requirements.
The generated native splash still needs confirmation in the final release build on
a physical device.

### VI.2 Login View — **IMPLEMENTED IN SOURCE, END-TO-END FAIL**

Implemented:

- Account registration and password login.
- Unique username constraint in PostgreSQL.
- Eight-character minimum password and Argon2id storage.
- Face/fingerprint capability and enrollment checks through
  `expo-local-authentication`.
- Clear biometric failure alerts and password fallback.
- Hidden biometric option when unavailable.
- Secure JWT/profile storage through `expo-secure-store`.
- Cold-start lock and foreground/background re-lock through the `AppState` state
  machine in `frontend/src/auth/AuthContext.tsx`.

Blocking deployment defects:

- `backend/Dockerfile` sets `NODE_ENV=production`.
- `docker-compose.yml` does not pass `JWT_SECRET`.
- `backend/src/config.js` throws when production uses the default secret.
- Therefore the backend service used for both account creation and password login
  exits during startup.
- The app defaults to `http://localhost:3000`. That points to the phone itself on a
  physical device. `JURY.md` claims an in-app setting exists to change the address,
  but there is no Settings screen or runtime API URL control.

The authentication architecture is sensible, but the committed evaluation path
does not provide a working login system.

### VI.3 Protein List View — **STRONG STATIC IMPLEMENTATION; NOT RUNTIME-VERIFIED**

Implemented:

- The source `ligands.txt`, app asset copy, and generated `LIGAND_IDS` were compared:
  all contain the same **1,243 identifiers in the same order**.
- `FlatList` supplies a scrollable, virtualized list.
- Search updates on every keystroke, is case-insensitive, and searches identifiers.
- Selection shows a blocking loading overlay for the complete fetch/parse flow.
- RCSB fetch, CIF parse, navigation, timeout, 404, offline, and parse alerts exist.
- Concurrent selections are prevented while a ligand is loading.

Remaining concerns:

- Parser execution is synchronous on the JavaScript thread.
- There is no response-size or atom-count limit for memory protection.
- Only the small `FOR.cif` parser fixture is tested; fetch/error/list integration is
  not covered.
- No executable test or real-device run could be completed during this audit.

### VI.4 Protein View — **SUBSTANTIAL STATIC IMPLEMENTATION; NOT PROVEN FLAWLESS**

Implemented in `frontend/src/components/MoleculeViewer.tsx` and
`frontend/src/screens/LigandViewScreen.tsx`:

- Three.js rendering through Expo GL, without a prohibited full game engine.
- CPK/Jmol colors and element radii.
- Ball-and-stick spheres and thinner bond cylinders.
- Atom selection overlay with element, name, and coordinates.
- Selection dismissal when empty space or another object is tapped.
- One-finger rotation, pinch zoom, and two-finger pan.
- Native sharing flow using a captured GL snapshot.
- Automatic centering/initial camera distance.
- Ambient, key, and fill lighting.
- Resource disposal on component unmount.

Unresolved evaluation risks:

- There is no release/device proof of the GL renderer, hit testing, gestures, or
  sharing.
- Snapshot capture does not request a format, so Expo GL defaults to JPEG, while
  the share call declares `image/png`.
- Every atom and half-bond is an individual mesh/draw object. There is no instancing,
  LOD, adaptive quality, molecule-size cap, or FPS measurement, so smooth behavior
  for complex ligands and the requested 60 FPS target are not established.
- Labels trigger React state updates every fourth render frame and project every atom,
  which can be expensive for large structures.

## Bonus assessment

These items would be ignored by the evaluator until the mandatory blockers above
are fixed.

### VII.1 Multiple Visualization Models — **IMPLEMENTED**

All requested modes are present and switch without re-fetching the ligand:

- Ball-and-stick
- Space-filling using element radii
- Wireframe
- Stick

### VII.2 Advanced User Interface — **PARTIAL**

Present:

- Custom ligand rows with icons and styled cards.
- Animated in-app splash and normal native navigation transitions.
- A coherent app-wide dark visual design.

Missing:

- Onboarding flow.
- Settings screen.
- User-selectable default visualization model or color preferences.
- Evidence of a complete light/dark appearance adaptation; the app is forced dark.

### VII.3 Enhanced Molecular Interactions — **MOSTLY IMPLEMENTED**

Present:

- Same-element highlighting after atom selection.
- Bond selection with type, aromatic state, and length.
- Two-atom distance and three-atom angle measurement.
- Toggleable atom labels.
- Double-tap camera centering animation.

These are meaningful bonus implementations, but their correctness and usability
still require device validation.

### VII.4 Performance and Caching — **FAIL / MINIMAL**

Present:

- `FlatList` virtualization and render-window configuration.
- Some Three.js resource cleanup.

Missing:

- No local `.cif` cache or offline fallback. `frontend/src/lib/rcsb.ts` explicitly
  says this is “to be added.”
- No background parser.
- No parsing progress.
- No LOD, mesh instancing, or large-molecule strategy.
- No FPS instrumentation or 60 FPS guarantee.

`JURY.md` incorrectly claims previously viewed ligands are cached offline.

### VII.5 Extended Sharing and Export — **NOT IMPLEMENTED**

Only the mandatory single-image share flow exists. There is no:

- Custom share message containing ligand name, atom count, and formula.
- PNG/JPEG selection or 3D export.
- Video recording.
- Favorites system.
- Side-by-side comparison.

## Validation performed

- Inspected all application, backend, configuration, test, and delivery files.
- Confirmed all three ligand lists match exactly at 1,243 entries.
- Confirmed `docker compose config` parses successfully and contains no
  `JWT_SECRET` for the backend.
- Confirmed only `dist/.gitkeep` is committed; no APK is present.
- Confirmed no generated `frontend/android` or `frontend/ios` project exists.
- Inspected the icon and splash bitmap assets.
- Attempted the frontend test suite, but this host's Snap-installed Node/npm refuses
  to execute because `snapd.apparmor` is unavailable; dependencies are not installed.
- Docker configuration could be inspected, but access to the Docker daemon was not
  available, so images/containers were not built or run.

Accordingly, code-presence findings are reliable, while runtime behavior is explicitly
not certified by this verdict.

## Required fixes before evaluation

1. Supply `JWT_SECRET` securely to the production backend and prove `make up`,
   registration, login, and restart persistence work.
2. Repair the Android build path: use the SDK 57 Node/Android requirements, generate
   or commit the native Android project, configure package ID/signing, and produce
   `dist/app-release.apk`.
3. Configure a physical-device-reachable API endpoint at build time, or implement the
   Settings screen claimed by `JURY.md`; use HTTPS for a deployed backend.
4. Explicitly capture PNG when sharing PNG, or pass the correct JPEG MIME type.
5. Run frontend/backend tests, add integration tests for network errors and auth
   re-locking, and test the final release on real Android/iOS hardware.
6. Profile representative small and large ligands, then add instancing/limits or other
   safeguards needed to keep interaction responsive.
7. If pursuing the caching bonus, implement actual file caching and offline fallback
   before advertising it in jury documentation.
