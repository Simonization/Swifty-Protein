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
  components/            MoleculeViewer (Three.js/expo-gl), Screen, Button, TextField,
                         SearchBar, LoadingOverlay, ErrorBanner, Logo, MoleculeBackdrop
  lib/                   shared core, no RN deps: cif.ts (parser), rcsb.ts (fetch)
  data/                  elements.ts (CPK), ligandIds.ts (generated), ligands.ts
                         (cache+fetch+parse), ligandCache.ts (offline)
  types.ts               Atom / Bond / Ligand / Element
__tests__/               parser, ligand load policy, API base URL (+ CIF fixtures)
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

## Known follow-ups

- App icon + native launch screen are still Expo's placeholder assets (`assets/`) —
  VI.1 wants a themed icon/splash image; this only wires the splash *background
  color* and the in-app animated splash.
