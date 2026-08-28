# Swifty Proteins

`Swifty Proteins` is a mobile app that shows a molecule in interactive 3D. You log
in with your fingerprint or face, pick a ligand from a list of 1,243, and the app
draws it on screen — atoms as coloured spheres, bonds as sticks — which you can
rotate, zoom, tap, measure and share.

Think of it as a molecule viewer that fits in a pocket. The chemical data comes
from the Protein Data Bank, a public scientific archive; the app downloads one
text file per molecule and turns it into something you can hold and turn around.

Built for 42 Belgium by **Rodolfo** (rperez-t) and **Simon**, in React Native /
Expo, with a small Fastify backend for accounts.

## What the app does

```text
you tap "ATP"
      |
      v
  the app  ---- https ---->  files.rcsb.org/ligands/view/ATP.cif
      |                                  |
      |  <----------- the .cif text -----+
      v
  our own parser  ->  47 atoms, 49 bonds, elements, coordinates
      |
      v
  three.js on the GPU  ->  spheres and sticks you can rotate
      |
      +--> saved on the phone, so ATP opens again with no network
```

The molecule itself never passes through our backend. The app fetches it, parses
it and draws it — those three things are what the project is being graded on, so
they live in the app where they can be shown.

## A few basic words

- **Ligand:** a small molecule that binds to a protein. `ATP`, `ZN` and `B12` are
  ligands; each has a short identifier.
- **`.cif` / mmCIF:** the text format the Protein Data Bank publishes. It lists
  each atom, its element and its x/y/z position, then which atoms are bonded.
- **CPK colouring:** the standard convention for colouring atoms — oxygen red,
  nitrogen blue, carbon grey, and so on. A chemist recognises a molecule partly
  by its colours, so getting them right matters.
- **RCSB:** the organisation that runs the Protein Data Bank, at `rcsb.org`.
- **Ball-and-stick:** atoms drawn as balls, bonds as sticks between them. The app
  also offers space-filling, wireframe and stick.

## How it works

The app owns the whole molecular pipeline. The backend does one job: accounts.

- **The app** (`frontend/`) fetches the `.cif` over HTTPS, parses it with a parser
  we wrote (`src/lib/cif.ts` — no CIF library), converts it to geometry
  (`src/lib/moleculeGeometry.ts`) and renders it with three.js through `expo-gl`.
  Biometric login, the re-lock rule, caching and sharing are all app-side.
- **The backend** (`backend/`) is a Fastify API with Postgres: register, login,
  and validate a token. Passwords are hashed with Argon2id on the server and are
  never stored anywhere, on the device or off it — only the resulting hash is.

We originally built the ligand fetching and parsing as backend endpoints, and
then deleted them. The subject lists *Network Programming* and *File Parsing* as
mobile learning objectives, and an app that asks a server to do both has nothing
to demonstrate at defence — plus a laptop backend that drops off the Wi-Fi during
an evaluation would take the whole demo with it. `backend/test/auth.test.js`
asserts those retired routes now return 404, so they cannot quietly come back.

### The auth API

Base URL `http://<host>:3000/api/v1`, set in the app under **Settings → Backend
URL**. JSON in, JSON out; `Authorization: Bearer <jwt>` on protected routes.

| Endpoint | Does | Answers |
|---|---|---|
| `GET /health` | Liveness probe, used by Docker | `200 {"status":"ok"}` |
| `POST /api/v1/auth/register` | Create an account (8-char minimum) | `201 {token, user}`, `409` if taken |
| `POST /api/v1/auth/login` | Sign in | `200 {token, user}`, `401 invalid_credentials` |
| `GET /api/v1/auth/me` | Validate a token | `200 {user}`, `401` if missing/invalid/expired |

Errors are always `{ error: { code, message } }`. Tokens carry a 7-day `exp`.
`/auth/register` and `/auth/login` allow 10 requests per minute per IP.

**Transport is plain HTTP, deliberately.** This backend is a LAN demo started by
`make up`; serving TLS would mean shipping a certificate the evaluator's phone has
no reason to trust. The token crosses the local network in the clear. Anything
deployed past a demo must be HTTPS — that is a scope decision, not an oversight.

That decision has a consequence on Android worth knowing about: since API 28,
release builds block cleartext HTTP outright, and Expo only enables it in the
*debug* manifest. So a release APK silently could not reach any `http://` backend
— the browser and Expo Go both kept working, which is exactly what made it hard
to see. `expo-build-properties` now sets `usesCleartextTraffic` for the release
build too (`frontend/app.json`). An HTTPS backend would not need it.

## Who did what

| Person | Scope |
|---|---|
| **Rodolfo** | The React Native app: navigation, login and biometric screens, ligand list and search, the 3D molecule viewer, sharing, UI polish, the Android build path |
| **Simon** | The auth API (JWT, Argon2id, Postgres), Docker and reproducibility, and the shared TypeScript modules — `frontend/src/lib` (`cif`, `rcsb`, `moleculeGeometry`) and `frontend/src/{data,types}` |

Per subject Ch. III, either of us can explain any part of it at defence, whoever
wrote it. The split above is who did the work, not who understands it.

## What you need

| Requirement | Why |
|---|---|
| **An Android or iOS phone** | It is a phone app; it cannot run inside Docker. iOS builds additionally need a Mac with Xcode — see *Getting the app onto a phone* below. |
| **Docker + Compose v2** | Runs the backend API and its database. |
| **Same network** | The phone calls the backend on this machine. |
| **Internet access** | Molecule data comes from RCSB, live. |
| **Node 20+** | Only if you run the app from source instead of installing an APK. |

`make doctor` checks all of it on this machine and prints install links for your
OS. It also reports whether an APK build is possible here and whether a phone is
currently visible.

## Running it

```bash
make doctor    # check this machine
make up        # backend API + database in Docker; verifies /health before returning
```

`make up` generates a random `JWT_SECRET` into `.env` on first run, then polls
`/health` and fails loudly if the backend did not actually come up.

Just want to try the app? `cd backend && npm ci && npm start` runs the same API
with accounts in memory — no Docker, no Postgres. Accounts vanish when you stop
it, which is fine for a test drive.

Then get the app onto a phone, either way:

```bash
make run                          # auto-detects a connected Android or iOS device and installs onto it
cd frontend && npx expo start     # or run from source, scan the QR with Expo Go
```

When you are done: `make down`.

> **Expo Go cannot show you the app icon or the native launch screen.** Both are
> applied when the native Android project is generated, so under Expo Go you see
> *Expo's* icon and *Expo's* splash, not ours. Everything else behaves identically.
> **Please evaluate the icon and launch screen against an APK.** The assets are in
> `frontend/assets/`, generated by `frontend/scripts/gen-icons.py`.

> **Expo Go must be recent enough.** This app targets Expo SDK 57, and Expo Go
> runs only the SDK it ships with — a phone carrying an older Expo Go (SDK 54,
> say) will refuse the project outright, with nothing you can do from this end.
> If that happens, install the APK instead; it needs no Expo Go at all.

**No phone, or the wrong Expo Go?** `cd frontend && npx expo start` then press `w`
opens it in a browser, and the 3D viewer really does run there — `expo-gl` becomes
a WebGL canvas. Login, search, all four view modes, tap-an-atom, measure and
labels all work. What the browser cannot do is biometrics, sharing, and saving to
a photo library; the session is also memory-only, so a reload signs you out.

### Getting the app onto a phone

`make run` detects what's plugged in and builds the right thing — Android
anywhere, iOS only from a Mac (Apple requires Xcode to build for a real
device; there is no way around that). It is `make apk` and `make ios` chosen
automatically; run either directly if you already know which you want, or
`make devices` to see what's detected without building anything.

| This machine | Device connected | Result |
|---|---|---|
| macOS | iPhone/iPad | iOS build (`make ios`) |
| macOS | Android | Android build (`make apk`) |
| Linux / Windows | Android | Android build (`make apk`) |
| Linux / Windows | iPhone/iPad | Not supported — no way to build for iOS without a Mac |

If both an Android and an iOS device are attached at once, `make run` asks —
pick with `TARGET=android` or `TARGET=ios`.

#### Android

`make apk` checks the toolchain before it builds anything, so a missing JDK is one
line rather than a Gradle stack trace. It needs **JDK 17+** and an **Android SDK**;
it writes `dist/app-release.apk`, then installs it if `adb` sees exactly one phone
with **Developer options → USB debugging** enabled.

```bash
make apk       # build, then install if a phone is plugged in
make install   # install an APK built earlier
```

No JDK or SDK on this machine? Build it in the cloud instead — no local Android
toolchain at all, just a free Expo account:

```bash
cd frontend && npx eas-cli build --platform android --profile preview
```

If no phone is detected, copy `dist/app-release.apk` across by any means — USB,
Drive, email — open it on the phone and allow "install from unknown sources". On
WSL2 a USB phone is invisible to Linux unless forwarded with `usbipd-win`, so
copying by hand is usually the shorter path there.

Both routes produce a **debug-signed** APK: Expo's Android template signs the
`release` build type with the debug keystore, and there is no release keystore in
this repository. It installs and runs; it is simply not store-signed, which
nothing here needs.

#### iOS (macOS only)

`make ios` needs **Xcode** (not just the Command Line Tools) and **CocoaPods**;
`make doctor` checks both. It finds the one connected iPhone/iPad via Xcode's own
device list and runs `expo run:ios`, which generates the native `ios/` project,
installs pods, builds, and installs — the same thing a developer would do by hand,
just preflighted so a missing dependency is a one-line message.

```bash
make ios
```

A free Apple ID is enough to install on your own device from Xcode — it just
re-signs roughly every 7 days. If `expo run:ios` fails on signing, open the
`.xcworkspace` under `frontend/ios` in Xcode once, and set your Apple ID as the
team under the app target's *Signing & Capabilities*, then re-run `make ios`.

Building in Expo's cloud instead is possible (`cd frontend && npx eas-cli build
--platform ios --profile preview`), but — unlike Android — installing that build
on a real device needs a **paid Apple Developer Program membership** to register
the device; there is no free-account cloud path for iOS the way there is for
Android. A Mac with Xcode and a free Apple ID is the more accessible route.

You shouldn't need to do anything for this: `make apk` and `make ios` both run
`scripts/ensure-env.sh` first, which detects this machine's current LAN IP and
writes it into `frontend/.env` as `EXPO_PUBLIC_API_URL` — so a build made on
this machine already points at it, for a phone tethered to the same network.
If the network changes (different Wi-Fi, a new DHCP lease) between builds, the
next `make apk` / `make ios` / `make up` picks up the new IP automatically.

If you ever do need to point an already-installed app somewhere else — a
different laptop, a different network — the login screen still has the manual
override: tap **"Can't connect? Set the server address"**, and enter the LAN
IP, e.g. `http://192.168.1.20:3000`. On a phone, `localhost` means *the phone*,
so the built-in default will never reach the backend on its own. The same
screen is under **Settings** once you are logged in.

## What to try

*Atom and bond counts verified against `files.rcsb.org` on 4 Aug 2026.*

| Ligand | Why it is interesting |
|---|---|
| `ATP` | 47 atoms, 49 bonds — the general case. |
| `ZN` / `CU` | Single-atom ligands, no bonds. Their mmCIF omits `loop_`, which the parser handles; wireframe and stick modes say so rather than showing an empty box. |
| `OXY` | Two atoms, one bond — the bond category is un-looped. |
| `B12` | 180 atoms, 190 bonds, including cobalt — exercises the full CPK table. |

Also worth doing:

- **Tap an atom** — every atom of the same element lights up.
- **Switch the four view modes** — no re-fetch. Pinch to zoom; the **+ / − /
  recentre** buttons are at the top right.
- **Measure** — two atoms for a distance, three for an angle. **Labels** puts
  element symbols on the atoms.
- **Share**, and **Save to Photos** — then check the image in the gallery. Coming
  back from the share sheet must leave you *on the molecule*, not on the login screen.
- **Rotate the device** — the controls reflow and the molecule stays framed.
- **Airplane mode** — a ligand you already opened still opens; a new one explains
  why it cannot.
- **Press Home and reopen the app** — the login view is back, every time. That is
  the subject's security requirement.
- **The intro tour** — shown on first run; replay it from **Settings → Show the
  intro again**.

## Where each requirement lives

For checking the app against the subject without reading everything:

| Requirement | Code | Test |
|---|---|---|
| Fetch `.cif` from RCSB, typed errors | `frontend/src/lib/rcsb.ts` | `__tests__/rcsb.test.ts` |
| Our own CIF parser | `frontend/src/lib/cif.ts` | `__tests__/cif.test.ts` |
| Cache → network → parse | `frontend/src/data/ligands.ts` | `__tests__/ligands.test.ts` |
| Offline cache | `frontend/src/data/ligandCache.ts` | `__tests__/ligandCache.test.ts` |
| CPK colours + van der Waals radii (118 elements) | `frontend/src/data/elements.ts` | `__tests__/elements.test.ts` |
| Instancing, half-bond math, camera framing | `frontend/src/lib/moleculeGeometry.ts` | `__tests__/moleculeGeometry.test.ts`, `framing.test.ts` |
| Re-lock on every launch (the security rule) | `frontend/src/auth/lockPolicy.ts` | `__tests__/lockPolicy.test.ts` |
| Size limits on input (5 MB, 2,000 atoms) | `frontend/src/lib/rcsb.ts`, `lib/moleculeGeometry.ts` | `__tests__/ingestLimits.test.ts` |
| Visualization models | `frontend/src/data/viewModes.ts` | `__tests__/viewModes.test.ts` |
| Password hashing (Argon2id) | `backend/src/lib/password.js` | `backend/test/security.test.js` |
| Auth routes, rate limiting, JWT expiry | `backend/src/routes/auth.js` | `backend/test/auth.test.js` |
| The 3D viewer itself | `frontend/src/components/MoleculeViewer.tsx` | not unit-tested — see *Known limits* |

## Security

- Passwords are hashed with **Argon2id** at pinned cost parameters, server-side.
  The app never stores a password.
- The JWT lives in `expo-secure-store` (Keychain / Keystore), not in plain storage.
- Tokens expire (7 days by default). A token whose user no longer exists is a
  `401`, not a success with an empty user.
- `/auth/register` and `/auth/login` are rate-limited to 10 requests per minute
  per IP, because unlimited login attempts are a named grading pitfall.
- **Re-lock:** the app returns to the login view whenever it comes back from the
  background — not from `inactive`, which iOS also raises for the share sheet and
  Control Centre. Getting that distinction wrong ejected the user mid-share.
- Plain HTTP on the LAN, deliberately — see *The auth API* above.

## Testing

```bash
make test     # both suites, no Docker needed
```

**130 tests**: 104 in the app across 14 suites (`jest-expo`), 26 in the backend
across 3 test files (`node:test`). `npx tsc --noEmit` in `frontend/` is clean.

The parser tests run against real fixture files (`__tests__/fixtures/`) — `CU.cif`,
`OXY.cif` and `ATP.cif` — rather than hand-written CIF snippets, so they cover the
un-looped single-row categories that broke 23 of the 24 single-atom ion ligands.

## How AI was used

Subject Ch. III asks for this explicitly: *"Be transparent about how AI was used in
your projects, and clearly identify what was generated by AI tools."*

**Where it was used.** Boilerplate and scaffolding — screen skeletons, StyleSheet
blocks, Fastify route shells, test file structure — reviewed line by line and
edited. Unit tests, substantially AI-assisted then corrected. Whole-repository
audits against the subject, which is how most of the defects in the git history
were found: the pixel/dp bug in the viewer's hit testing, the check-then-insert
race in `createUser`, the portrait camera framing. Documentation, drafted with AI
and re-verified against the source.

**Two AI-written tests that were wrong**, because they are the kind of thing worth
looking for:

- One asserted that `additionalProperties: false` returns `400`. It does not —
  Fastify's Ajv strips unknown properties instead. Replaced with a test that pins
  the behaviour actually protecting us: a client cannot choose its own user id.
- One asserted that a token signed with a different secret is rejected, but built
  the "different" instance with the *same* secret, so it could not fail. Replaced
  with a hand-forged HMAC and an `alg: none` token.

**Where it was not used.** The architecture — moving the ligand pipeline into the
app and leaving the backend auth-only was our decision, and it cost us a working
backend API we had already built. The renderer's design — grouping `InstancedMesh`
per element and per bond colour, rather than one mesh with a per-instance colour
attribute, so same-element highlighting stays a single material write instead of a
custom shader. And anything we could not check: the instancing rewrite and the
half-bond geometry were traced by hand against the pre-rewrite formulas, and the
maths that makes them correct was moved into `moleculeGeometry.ts` specifically so
it could be unit-tested rather than argued from a diff.

## Known limits

Stated plainly, because they are what we would ask about:

- **Nothing here is verified on real hardware.** The GL renderer, hit testing,
  gestures, sharing and the accessibility labels are reasoned from source and from
  the pinned three.js / expo-gl versions, not observed on a device. A `__DEV__`
  overlay reports FPS and draw calls so the first device session can confirm the
  instancing actually took effect rather than assume it.
- **CIF parsing is synchronous** on the JS thread, with no worker and no progress
  bar. Responses over 5 MB are refused, and molecules over 2,000 atoms are refused
  with a message rather than attempted.
- The parser handles the CIF subset this project needs; it does not implement
  every multiline construct in the format.
- The app is forced dark, so there is no light-mode adaptation to demonstrate.

## Layout

```
frontend/    the Expo app — screens, 3D viewer, CIF parser, element data, tests
backend/     Fastify auth API — JWT, Argon2id, Postgres, tests
scripts/     doctor / ensure-env / smoke / apk / ios / run, called by the Makefile
protein.md   the subject
```

`make help` lists every command.
