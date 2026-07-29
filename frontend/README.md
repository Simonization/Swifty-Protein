# Swifty-Proteins frontend

React Native (Expo) app: auth flow (Login/Register + biometric unlock + foreground
re-lock) against the [API contract](../API.md), ligand list + search, and the 3D
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
- `npm run web` — quickest look at theme/layout (no camera/biometrics/GL there).
- `npm test` — unit tests under `jest-expo`: CIF parser, ligand load policy, API URL.

## Layout

```
App.tsx                 providers (SafeArea, Settings, Auth) + root navigator
src/
  theme/theme.ts         colors, spacing, typography — the dark "biotech lab" theme
  api/                   client.ts (fetch wrapper, runtime base URL), auth.ts (register/login)
  auth/                  AuthContext (status machine), storage.ts (SecureStore),
                         biometrics.ts, credentials.ts (validation mirroring the backend)
  settings/              SettingsContext + persisted settings (server URL, viewer defaults)
  navigation/            RootNavigator + route param types
  screens/               Splash, Login (incl. locked/biometric-unlock), Register,
                         LigandList, LigandView, Settings
  components/            MoleculeViewer (Three.js/expo-gl), SelectionTooltip, Screen,
                         Button, TextField, SearchBar, LoadingOverlay, ErrorBanner,
                         Logo, MoleculeBackdrop
  lib/                   shared core, no RN deps: cif.ts (parser), rcsb.ts (fetch)
  data/                  elements.ts (CPK), ligandIds.ts (generated), ligands.ts
                         (cache+fetch+parse), ligandCache.ts (offline), favorites.ts,
                         viewModes.ts
  types.ts               Atom / Bond / Ligand / Element
__tests__/               parser, ligand load policy, API base URL (+ CIF fixtures)
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
  notification banners, which must not eject the user mid-action.
- Biometrics gate *local* access to the already-stored session; it never re-hits the
  server. Falling back to the password field re-validates against the backend (a
  password is never cached). If the device has no biometric hardware/enrollment, the
  biometric option is hidden and password is the only path — per the subject.

## Icon and launch screen (VI.1)

The launcher icon, the three Android adaptive layers (foreground, background,
monochrome), the favicon and the native splash mark all carry the same molecular
Swifty Protein identity. They are **generated**, not hand-drawn: run
`python3 scripts/gen-icons.py` (needs `pillow` + `numpy`), which renders every asset
in `assets/` from the single molecule definition at the top of that script.
Regenerate rather than editing the PNGs, or they drift apart.

The mark is a shaded ball-and-stick molecule in CPK colours over the app's own
palette, so the native launch screen hands over to the in-app animated splash
without a visible change of identity. The launch screen itself is
`expo-splash-screen` (mark + `backgroundColor`, configured in `app.json`), followed
by `screens/SplashScreen.tsx` while the secure session is initialized.
