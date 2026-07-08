# Swifty-Proteins frontend

React Native (Expo) app. Implements the auth flow (Login/Register + biometric
unlock + foreground re-lock) against the [API contract](../API.md), plus the
shared molecular data core (CIF parser, RCSB fetch, CPK element data) that the
3D viewer will consume next.

## Run locally

```bash
npm install
cp .env.example .env        # point EXPO_PUBLIC_API_URL at the backend (see comments in the file)
npm start                   # opens Expo Dev Tools — scan the QR code, or press i/a for a simulator
```

The backend must be running for register/login to succeed: from the repo root, `make up`.

- `npm run ios` / `npm run android` — launch directly in a simulator/emulator.
- `npm run web` — fastest way to preview the theme/layout in a browser (no camera/biometrics there).
- `npm test` — runs the shared-core unit tests (CIF parser) under `jest-expo`.

## Layout

```
App.tsx                 providers (SafeArea, Auth) + root navigator
src/
  theme/theme.ts         colors, spacing, typography — the dark "biotech lab" theme
  api/                   client.ts (fetch wrapper + error shape), auth.ts (register/login/me)
  auth/                  AuthContext (status machine), storage.ts (SecureStore), biometrics.ts
  navigation/            RootNavigator + route param types
  screens/               Splash, Login (incl. locked/biometric-unlock mode), Register, Home (placeholder)
  components/            Screen, Button, TextField, ErrorBanner, Logo, MoleculeBackdrop
  lib/, data/, types.ts  shared molecular core (CIF parser, RCSB fetch, CPK data) — see API.md
__tests__/               CIF parser tests
```

## Auth flow notes

- The JWT is kept in `expo-secure-store` (Keychain/Keystore) — never in plain text, never in JS state alone.
- **Security requirement:** the Login View is always shown on cold start and whenever
  the app returns from the background, even with a valid stored session — see the
  `status` state machine in `AuthContext.tsx` (`bootstrapping` → `locked`/`signedOut` →
  `unlocked`, and back to `locked` on every backgrounding).
- Biometrics gate *local* access to the already-stored session; it never re-hits the
  server. Falling back to the password field re-validates against the backend (a
  password is never cached). If the device has no biometric hardware/enrollment, the
  biometric option is hidden and password is the only path — per the subject.

## Known follow-ups (not in this pass)

- App icon + native launch screen are still Expo's placeholder assets (`assets/`) —
  VI.1 wants a themed icon/splash image, this pass only wired the splash *background
  color* and the in-app animated splash.
- `HomeScreen` is a stub landing screen; the ligand list + 3D viewer replace it next.
