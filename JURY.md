# Correcting Swifty-Proteins — jury guide

This project is packaged so it can be evaluated **on any computer, with Docker as
the only required tool**, for years after submission.

---

## TL;DR

```bash
make doctor   # checks your machine — mainly: is Docker installed and running?
make up       # starts the backend API + database in containers
```

Then install **`dist/app-release.apk`** on an Android phone (or emulator) and
launch it. The app uses the backend **only for login** (accounts); molecule data
is fetched live from the RCSB Protein Data Bank, so viewing ligands needs internet
access but does not depend on the backend.

---

## Requirements

| Requirement | Notes |
|---|---|
| **Docker + Docker Compose v2** | The only requirement to *run* the backend. |
| **Android device or emulator** | The app is a phone app; it cannot run inside Docker. |
| **Internet access** | The app fetches molecule data live from RCSB (previously viewed ligands are cached for offline). |

`make doctor` verifies both and prints install links for your OS if anything is
missing.

---

## Step by step

1. **Check your machine**
   ```bash
   make doctor
   ```

2. **Start the backend**
   ```bash
   make up          # backend API on http://localhost:3000, database alongside it
   make logs        # (optional) watch the logs
   ```

3. **Install the app** — copy `dist/app-release.apk` to an Android device and
   install it, or drag it onto a running emulator. The app connects to
   `http://<your-machine-ip>:3000` (see in-app settings if you need to change
   the address).

4. **When finished**
   ```bash
   make down        # stop and remove containers
   ```

---

## Rebuilding the APK from source (optional)

You do **not** need to do this. The APK in `dist/` is the deliverable and it is
already built. But if you want to verify it yourself, the entire Android toolchain
(JDK, Node, Android SDK) is containerised, so you still only need Docker:

```bash
make apk          # builds dist/app-release.apk inside the Android build image
```

---

## APK provenance

| Field | Value |
|---|---|
| File | `dist/app-release.apk` |
| SHA-256 | *(add before submission: `sha256sum dist/app-release.apk`)* |
| Built from | *(add before submission: commit hash + `make apk`)* |
| Min Android | *(add before submission: from build.gradle)* |

The binary was committed to the repo rather than hosted externally so that it is
present immediately on clone, with no dependency on network access or a third-party
hosting service.

---

## Available make targets

```
make help      # list all targets
make doctor    # check dependencies
make up        # start backend + database (detached)
make down      # stop everything
make logs      # tail logs
make apk       # build the APK from source inside Docker
make clean     # remove containers, volumes, and built APK
```

---

## Why it's built this way

This section explains the design decisions. It is not required reading to evaluate
the project, but it answers the natural question: *why all this Docker ceremony?*

### Two distinct risks for long-horizon evaluation

Two different problems threaten a project handed in today but evaluated much later,
and they need different solutions.

**Portability (the unknown machine)** — The evaluator's host OS, installed
toolchain, and library versions are unknown. The classic failure mode is "works on
my machine." Containerisation eliminates it: the evaluator clones, runs one command,
and an identical stack comes up regardless of what is installed on the host.

The real gotcha inside this category is **CPU architecture**. If the campus cluster
runs Apple Silicon (arm64) and images were built or pinned only for amd64, they run
under emulation (slow, sometimes broken) or fail outright, and vice versa. All base
images used here publish both architectures through official registries; no
`--platform` is hard-pinned.

**Reproducibility (the two-year gap)** — A Dockerfile is a *recipe*, not a
*snapshot*. If an evaluator runs `make up` two years from now and Docker has to
rebuild, it re-runs that recipe and can produce a different result:

- Mutable tags drift. `postgres:latest` or `node:20` will resolve to different
  images at a later date.
- `apt-get install` / `npm install` at build time hit live repositories that move,
  update, or drop packages.
- Base images can be removed from registries entirely.

**How this project addresses both:**

- Base image versions are **pinned to specific patch releases**
  (`postgres:16-alpine`, `node:20-bookworm-slim`) rather than floating tags.
- Application dependencies are installed via a committed **lockfile**
  (`package-lock.json`), and `npm ci` (not `npm install`) is used to enforce it.
- The pre-built APK is **committed to the repo** (see below), so the Android
  toolchain only needs to reproduce if explicitly requested.

### Why the APK is in `dist/` and not a GitHub Releases attachment

Three options were considered:

| Option | Assessment |
|---|---|
| **GitHub Releases attachment** | Reintroduces a network dependency. A Releases attachment is not part of the clone. The evaluator needs working network access to github.com, the release must still exist and be public, and they have to navigate off the README to find it. This contradicts the goal of zero external dependencies. |
| **Git LFS** | Appears to be the best of both worlds but is a trap: a machine without `git-lfs` installed gets a pointer text file instead of the APK, and the LFS smudge step requires network access to the LFS server. A worse failure mode than either alternative. |
| **Commit into `dist/`** (chosen) | Present immediately on clone, offline, zero navigation, no external service required. The cost is binary bloat in git history, but committed **once** at final submission it is a bounded, one-time cost (~10–60 MB) — not a recurring problem. |

The APK is committed once, near submission. It is not updated on every build
iteration; only the final release build goes into the repo.

### Why the APK is universal (not split by ABI)

React Native produces a universal APK by default. This means it runs on arm64
(most modern Android phones) and x86_64 (most emulators) from a single file.
The evaluator does not need to know which architecture their device or emulator is;
there is no "wrong APK" to download.

### Submission checklist (for the team, before handing in)

- [ ] Pin every base image to an exact patch version (already done for `db` and
      `backend`; verify `frontend/Dockerfile` before submission).
- [ ] Update the APK provenance table above with the SHA-256 checksum, the commit
      hash, and the `minSdkVersion`.
- [ ] Confirm `dist/app-release.apk` is committed and not in `.gitignore`.
- [ ] Verify `make up` works on a clean clone on a machine that has not seen this
      project before (or at minimum on a different architecture from the dev
      machine).
- [ ] Confirm port 3000 is not conflicting with another service on a typical
      campus machine; if it is, expose a non-standard port and document it.
