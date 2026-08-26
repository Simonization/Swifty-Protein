# Swifty-Proteins frontend

React Native (Expo) app: auth flow (Login/Register + biometric unlock + foreground
re-lock) against the [API contract](../README.md#the-auth-api), ligand list + search, and the 3D
molecule viewer — plus the shared molecular core (CIF parser, RCSB fetch, CPK
element data) the viewer consumes.

## Run locally

```bash
npm ci
npx expo start              # scan the QR with Expo Go, or press i/a for a simulator
```

The backend must be running for register/login: from the repo root, `make up`.

Point the app at it from **Settings → Backend URL** (use the machine's LAN IP — on a
phone, `localhost` is the phone). `.env` is optional and only sets the *default*:
`cp .env.example .env`.

- `npm run ios` / `npm run android` — launch directly in a simulator/emulator.
- `npm run web` — quickest look at the app without a phone. The 3D viewer *does*
  render there: `expo-gl` has a web implementation, so `GLView` becomes a WebGL
  canvas and the molecule draws. What is missing is what the browser has no
  hardware for — biometric unlock, saving to a photo library (the button is
  hidden), and sharing. The session is kept in memory only, so reloading the tab
  signs you out; see `src/auth/storage.web.ts` for why that is deliberate.
- `npm test` — unit tests under `jest-expo`. `npx tsc --noEmit` type-checks.

## Building an APK

**From the repo root, `make apk` is the supported entry point.** It checks the
toolchain first (Node 20+, JDK 17+, an Android SDK) so a missing JDK is one line
rather than a Gradle stack trace, builds, copies the result to
`dist/app-release.apk`, and — if a phone is plugged in with USB debugging on —
installs it over `adb`. `make install` does just that last step on an APK you
already built. `make doctor` reports the same toolchain and whether a phone is
visible, without building anything.

Underneath, two routes, complements rather than alternatives — use whichever
your machine supports.

- **`npm run apk`** — the raw local build `make apk` wraps: `expo prebuild` and
  then Gradle, writing `android/app/build/outputs/apk/release/app-release.apk`.
  Needs a local Android SDK, a JDK, and `ANDROID_HOME` (or `ANDROID_SDK_ROOT`).
  The generated `android/` directory is intentionally ignored by Git.
- **`npx eas-cli build -p android --profile preview`** — cloud build, configured in
  `eas.json`. Needs an Expo account and network, but **no local Android
  toolchain**, which is what makes it usable from a machine (or a WSL2 shell)
  with no SDK installed. Produces a download link for the same kind of APK.

> **On "release":** Expo's Android template signs the `release` build type with
> the *debug* keystore. The output is installable and is what the jury runs, but
> it is not signed with a production release key — there is no release keystore
> in this repository, deliberately, and there is no store distribution to need
> one. Say so if you are asked; it is a scope decision, not an oversight.

Build outputs are never committed. The subject asks for the Git repository
(Ch. VIII), so the installable APK is published as a GitHub Release asset and
`.gitignore` keeps `*.apk` out of the tree.

## Layout

```
App.tsx                 providers (SafeArea, Settings, Auth) + root navigator
src/
  theme/theme.ts         colors, spacing, typography — the dark "biotech lab" theme
  api/                   client.ts (fetch wrapper, runtime base URL), auth.ts (register/login)
  auth/                  AuthContext (status machine), storage.ts (SecureStore),
                         biometrics.ts, credentials.ts (validation mirroring the backend),
                         lockPolicy.ts (when the app re-locks — unit-tested)
  settings/              SettingsContext + persisted settings (server URL, viewer defaults)
  navigation/            RootNavigator + route param types
  hooks/                 useOrientation (portrait/landscape adaptation)
  screens/               Splash, Onboarding, Login (incl. locked/biometric-unlock),
                         Register, LigandList, LigandView, Settings
  components/            MoleculeViewer (Three.js/expo-gl), SelectionTooltip, Screen,
                         ErrorBoundary, Button, TextField, SearchBar, LoadingOverlay,
                         ErrorBanner, Logo, MoleculeBackdrop
  lib/                   shared core, no RN deps: cif.ts (parser), rcsb.ts (fetch),
                         moleculeGeometry.ts (instancing/half-bond math, camera framing)
  data/                  elements.ts (CPK), ligandIds.ts (generated), ligands.ts
                         (cache+fetch+parse), ligandCache.ts (offline), favorites.ts,
                         viewModes.ts
  types.ts               Atom / Bond / Ligand / Element
__tests__/               14 suites: cif, rcsb, ligands, ligandCache, client, elements,
                         moleculeGeometry, framing, lockPolicy, credentials, favorites,
                         settings, viewModes, ingestLimits (+ CIF fixtures)
scripts/                 gen-ligand-ids.js (ligands.txt -> ligandIds.ts),
                         gen-icons.py (the icon set -> assets/)
```

`lib/` is deliberately free of React Native imports so it stays testable as plain
TypeScript; `data/ligands.ts` is where the cache and the network are composed.

## Auth flow notes

- The JWT is kept in `expo-secure-store` (Keychain/Keystore) — never in plain text, never in JS state alone.
- **Security requirement:** the Login View is always shown on cold start and whenever
  the app returns from the background, even with a valid stored session — see the
  `status` state machine in `AuthContext.tsx` (`bootstrapping` → `locked`/`signedOut` →
  `unlocked`, and back to `locked` on backgrounding). Re-lock fires on `background`
  only, never `inactive` — the latter is what iOS raises for the share sheet and
  notification banners, which must not eject the user mid-action. Android reports a
  real `background` for the share chooser (it is a separate activity), so the share
  call is wrapped in `runWithoutRelock`. The decision itself lives in
  `auth/lockPolicy.ts` and is unit-tested — pressing Home still re-locks.
- Biometrics gate *local* access to the already-stored session; it never re-hits the
  server. Falling back to the password field re-validates against the backend (a
  password is never cached). If the device has no biometric hardware/enrollment, the
  biometric option is hidden and password is the only path — per the subject.

## Icon and launch screen (VI.1)

The launcher icon, the three Android adaptive layers (foreground, background,
monochrome), the two iOS 18 appearance variants, the favicon and the native splash
mark all carry the same identity. They are **generated**, not hand-drawn: run
`python3 scripts/gen-icons.py` (needs `pillow` + `numpy`, takes ~3 min), which
renders every asset in `assets/` from the single `RING` definition at the top of
that script. Regenerate rather than editing the PNGs, or they drift apart.

The mark is a tilted six-membered ring in CPK colours — the same convention the
viewer renders with — lit from behind in the app's cyan, over the app's own navy.
Three things drove that shape:

- **It survives 48px.** `favicon.png` is a downscale of the 1024px icon, and a
  closed loop keeps its silhouette where radiating bonds turn to mush.
- **It is near-square** (foreground bbox 552×578), so it fills Android's circular
  adaptive mask instead of leaving margins down both sides.
- **The hole is the signature** — the lit centre is what makes the icon findable
  in a grid of other apps.

Rendering is a small orthographic ray-tracer: spheres and bond cylinders are
intersected per pixel into a z-buffer, shaded with diffuse + specular + a cyan
fresnel rim and a cheap analytic ambient occlusion, then supersampled 3× down.

Because the palette comes from `src/theme/theme.ts`, the native launch screen hands
over to the in-app animated splash without a visible change of identity. The launch
screen itself is `expo-splash-screen` (mark + `backgroundColor`, configured in
`app.json`), followed by `screens/SplashScreen.tsx` while the secure session is
initialized.
