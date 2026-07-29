# Correcting Swifty-Proteins — jury guide

Two things to start: the **backend** (Docker) and the **app** (on a phone).

```bash
make doctor   # checks this machine: Docker running? Node 20+?
make up       # backend API + database, in containers. Verifies /health before returning.

cd frontend
npm ci
npx expo start   # scan the QR code with Expo Go on the phone
```

The app uses the backend **only for login**. Molecule data is fetched live from the
RCSB Protein Data Bank, so browsing ligands needs internet but does not depend on
the backend. Ligands you have already opened are cached and work offline.

---

## Requirements

| Requirement | Why |
|---|---|
| **Docker + Docker Compose v2** | Runs the backend API and its database. |
| **Node 20+** | Runs `npx expo start`, which serves the app to the phone. |
| **An Android phone with [Expo Go](https://expo.dev/go)** | The app is a phone app; it cannot run inside Docker. |
| **Same network** | The phone loads the app from this machine and calls the backend on it. |
| **Internet access** | Molecule data comes from RCSB, live. |

`make doctor` checks these and prints install links for your OS.

---

## Step by step

1. **Check the machine**
   ```bash
   make doctor
   ```

2. **Start the backend**
   ```bash
   make up          # API on http://localhost:3000, database alongside
   make logs        # (optional) watch the logs
   ```
   `make up` generates a random `JWT_SECRET` into `.env` on first run, then polls
   `/health` and fails loudly if the backend did not actually come up.

3. **Run the app**
   ```bash
   cd frontend && npm ci && npx expo start
   ```
   Scan the QR with Expo Go.

4. **Point the app at this machine.** In the app: **Settings → Backend URL**. Use
   this machine's LAN IP, e.g. `http://192.168.1.20:3000` — on a phone,
   `localhost` means *the phone*, so it will never reach the backend. The setting
   persists.

5. **When finished**
   ```bash
   make down
   ```

---

## What to try

| Ligand | Why it's interesting |
|---|---|
| `ATP` | 47 atoms, 49 bonds — the general case. |
| `ZN` / `CU` | Single-atom ligands. Their mmCIF omits `loop_`, which the parser handles. |
| `OXY` | Two atoms, one bond — the bond category is un-looped. |
| `B12` | 180 atoms including cobalt — exercises the full CPK colour table. |

Also worth exercising: tap an atom (same-element atoms highlight), the four view
modes, **Measure** (2 atoms = distance, 3 = angle), **Share**, rotating the device,
and re-opening a viewed ligand in airplane mode.

---

## Available make targets

```
make help      # list all targets
make doctor    # check dependencies
make up        # start backend + database (detached), then verify /health
make down      # stop everything
make logs      # tail logs
make clean     # remove containers and volumes
```

---

## Building a standalone APK (optional)

There is **no pre-built APK in this repo**, and no `make apk`. This is an Expo
managed app: it has no `android/` directory, so an APK requires generating one
first. Two supported routes, both needing network:

```bash
cd frontend

# Local: generates android/, then builds a debug-signed APK
npx expo prebuild --platform android
cd android && ./gradlew assembleDebug
# -> android/app/build/outputs/apk/debug/app-debug.apk

# Or hosted, no local Android toolchain (needs an Expo account):
npx eas build --platform android --profile preview
```

Neither is needed to evaluate the project — `npx expo start` with Expo Go is the
path we test and the one above.

---

## Notes on reproducibility

The backend stack is containerised, so it comes up the same way regardless of what
is installed on the host, and both base images publish arm64 and amd64 — no
`--platform` is hard-pinned, so Apple Silicon and x86 both work.

Images are pinned to **exact patch versions** (`postgres:16.14-alpine`,
`node:20.20.2-bookworm-slim`), not floating tags like `16-alpine`, which resolve to
different images over time. Dependencies install from committed lockfiles with
`npm ci`, never `npm install`.

The honest limit: a Dockerfile is a recipe, not a snapshot. `apt-get` and `npm`
still reach live repositories at build time, and registries can drop images. Exact
tags narrow the drift; they do not eliminate it. Digest pinning (`@sha256:...`)
would go further, at the cost of readability.
