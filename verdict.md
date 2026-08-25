# Swifty Protein — repository verdict

Original audit: 2026-07-25 (rperez-t), against `main` at `71b8790`.
Revised: 2026-07-29, after `simon-review` was merged at `aa76f32`.
Re-revised: 2026-08-03 (Simon), after `fa98272` (parser/fetch input guards)
and `918f98c` (instanced molecule viewer).
Scope: the repository as committed, assessed against the supplied Swifty Protein v6.0 subject.

> **Why this file changed, twice now.** The first revision closed nine findings the
> original audit couldn't see because `simon-review` was still unmerged. This second
> pass closes two more that were explicitly logged as open in that revision — the
> parser/fetch input guards and the instanced-rendering rewrite, both called out by
> name in the "Remaining work" list below. Same convention as last time: every row
> that changed points at the commit that changed it, findings that survived are kept
> unsoftened, and nothing here is claimed as device-verified unless it was.

## Final verdict

| Part | Original (2026-07-25) | Now |
|---|---|---|
| Mandatory | **FAIL — not submission-ready** | **PASS in source — one delivery blocker left** |
| Bonus | **NOT ELIGIBLE** | **ELIGIBLE once the APK ships** |

Two of the three original blockers are gone:

1. ~~`make up` starts the backend with `NODE_ENV=production`, but Compose provides no
   `JWT_SECRET`.~~ **Fixed** (`1881553`). `scripts/ensure-env.sh` generates a random
   secret into `.env` before Compose starts, and `docker-compose.yml:36` fails loudly
   with `${JWT_SECRET:?…}` rather than crash-looping. The production guard in
   `config.js` was kept — it did its job.
2. `dist/app-release.apk` is still not present. **This blocker stands, and is the
   only one left.** The Dockerfile that pretended to build it was deleted (`6bdf722`)
   rather than repaired, because it ran `./gradlew assembleRelease` against a
   `frontend/android` directory that never existed. See the handoff section below.
3. ~~No real-device or release-build evidence.~~ **Still true**, and still the reason
   nothing below is certified as "flawless." But it is now a testing gap rather than
   a delivery blocker: the app can be run from `npx expo start` against a working
   backend, which it could not before.

## Mandatory assessment

### General requirements

| Requirement | Status | Evidence and assessment |
|---|---|---|
| Mobile platform and modern stack | **Partial** | React Native/Expo is an authorized multiplatform choice. `expo@57.0.2`, React Native 0.86 and React 19.2.3 match the Expo SDK 57 compatibility table. The incompatible build image (Node 20, Android SDK 34) that this row originally flagged no longer exists; whatever replaces it must target Node 22.13+ and compile/target SDK 36. |
| RCSB `.cif` retrieval | **Present** | `frontend/src/lib/rcsb.ts` uses the required `https://files.rcsb.org/ligands/view/{ligand}.cif` endpoint. |
| Own CIF parser | **Present** | `frontend/src/lib/cif.ts` parses `_chem_comp_atom` and `_chem_comp_bond`, metadata, coordinates, orders and aromatic flags. It now also reads **single-row categories**, which mmCIF writes without `loop_` (`c0bf98b`) — the original audit did not catch that this was broken, and it took out 23 of 24 single-atom ion ligands. A non-finite coordinate token (`NaN`/`Infinity`) now falls back to 0 rather than reaching `THREE.Vector3` unvalidated (`fa98272`). Still a pragmatic subset: it does not support every CIF multiline construct. |
| Responsive UI | **Present in source** | Flex layouts, `SafeAreaView`, `FlatList`, scrolling login/register views, unrestricted orientation, tablet support. Runtime behavior still not verified. |
| Asynchronous network and responsive UI | **Partial** | `fetch`, `AbortController` and loading UI. `fetchLigandCif` now rejects responses over 5MB as a new `too_large` error kind (`fa98272`), and the renderer refuses ligands over 2000 atoms / 4000 bonds instead of attempting them (`918f98c`) — both graceful, user-facing failures rather than silent hangs. CIF parsing itself is still synchronous on the JS thread with no worker and no progress indication. |
| Graceful errors | **Present** | Ligand 404, timeout, offline and empty-parse cases all have user-facing alerts. Non-JSON response bodies are now classified as `ApiError` rather than escaping as a raw `SyntaxError` (`cce954a`). Large-file/memory handling is still absent. |
| Secure account storage | **Present** | Argon2id in `backend/src/lib/password.js`; JWT/user state in `expo-secure-store`; passwords never stored by the app. Tokens now carry an expiry (`5db5b2c`) — `app.js:21` signs with `expiresIn: config.jwtTtl`, default `7d` — and `/me` returns 401, not `200 {"user": null}`, when a valid token outlives its user. The documented device API is still plain HTTP. |
| Accessibility | **Present** | Was **Weak/partial**: the frontend had no `accessibilityLabel` or `accessibilityRole` anywhere. Every control now carries one, labelled centrally in `Button`, `TextField` and `SearchBar`. Stateful toggles report `accessibilityState.selected`; the selection tooltip, error banner and loading overlay are live regions; the GL surface describes the molecule and its gestures. Not yet verified with TalkBack/VoiceOver on hardware. |
| Real-device testing | **Not evidenced** | Still no APK, device-test report, or profiling output. **Unchanged and still the weakest row.** |

### VI.1 Application Icon and Launch Screen — **PASS IN SOURCE**

The icon set was drawn twice, independently, and the merge resolved it into one mark
that takes from both. Rather than picking a winner:

- **Kept from rperez-t's set** (`71b8790`): CPK colouring, so the icon uses the same
  convention the viewer renders with, and the cyan glow that gives it a signature.
- **Kept from simon-review's set** (`d32e82c`): generation from
  `frontend/scripts/gen-icons.py`, so every asset derives from one definition and
  cannot drift; and a near-square mark that fills Android's adaptive mask.
- **New**: the mark is now a tilted six-membered ring, chosen because a closed loop
  keeps its silhouette at the 48px favicon size where radiating bonds mush, and
  because the lit hole is what makes the icon findable on a home screen. The
  foreground layer measures 552×578 (aspect 0.96) and fits the 66/108 safe zone —
  the original hand-drawn foreground was 333×583 (aspect 0.57) and left large
  margins under a circular mask.
- Rendering is an orthographic ray-tracer with z-buffered spheres and bond cylinders,
  diffuse + specular + cyan fresnel rim, analytic ambient occlusion, supersampled 3×.
- **Added**: iOS 18 appearance variants (`ios.icon` → `light`/`dark`/`tinted` in
  `app.json`), which neither original set had.
- `frontend/src/screens/SplashScreen.tsx` still provides the animated in-app splash,
  and `RootNavigator.tsx` keeps it visible for at least 1.2 seconds.

The generated native splash still needs confirmation in a release build on a device.

### VI.2 Login View — **PASS IN SOURCE**

Was *implemented in source, end-to-end fail*. Both deployment defects are fixed:

- `make up` no longer crash-loops — see blocker 1 above.
- The app is no longer nailed to a build-time `http://localhost:3000`. `SettingsScreen.tsx`
  plus `settings/SettingsContext.tsx` give a runtime-overridable server URL (`2cf0d65`),
  which is what makes an installed APK able to reach the evaluator's machine at all.
  `JURY.md`'s claim that this screen exists is now true.

Everything the original audit listed as implemented still is: registration, unique
usernames, 8-character minimum, Argon2id, `expo-local-authentication` capability and
enrollment checks, biometric failure alerts with password fallback, hidden biometric
option when unavailable, secure JWT storage, cold-start lock.

One correctness fix the original audit did not catch: re-lock fired on `inactive`,
not `background` (`bee280d`). iOS raises `inactive` for the share sheet, Control
Centre and notification banners — so sharing a ligand ejected the user to the Login
screen mid-action. That broke mandatory VI.4 Share as well as VI.2.

### VI.3 Protein List View — **STRONG STATIC IMPLEMENTATION; NOT RUNTIME-VERIFIED**

Unchanged from the original audit, which was accurate: 1,243 identifiers, `FlatList`
virtualization, case-insensitive per-keystroke search, blocking loading overlay,
full error taxonomy, no concurrent selections.

Two things improved since:

- Rows now show a cached ligand's name and formula, and an "Offline" badge — the only
  visible sign that the cache exists (`5e59983`).
- The test suite grew from 4 CIF tests to **21 tests across 3 suites** (`cif`,
  `client`, `ligands`), with `CU.cif` / `OXY.cif` / `ATP.cif` fixtures covering the
  single-row parse cases and the ATP 47-atom/49-bond regression.

Remaining concerns: parsing is still synchronous on the JS thread with no progress
indication, and there is still no run on real hardware. The response-size and
atom-count limits that were missing here are fixed (`fa98272`, `918f98c` — see VII.4).

> Note on the original audit's method: it reported "attempted the frontend test suite,
> but this host's Snap-installed Node/npm refuses to execute." The suite does run —
> `npm ci && npx jest` passes (37/37 as of `918f98c`, up from 21/21 at the last
> revision), and `npx tsc --noEmit` is clean. That was an environment problem, not a
> repository problem, and it is worth separating the two.

### VI.4 Protein View — **SUBSTANTIAL IMPLEMENTATION; STILL NOT PROVEN FLAWLESS**

Everything the original audit credited is still there. Three of its unresolved risks
are now resolved:

- ~~`sizeRef` correctness.~~ The original audit did not flag this, but the viewer was
  storing physical pixels from `onContextCreate` and layout dp from `onLayout`, and
  the GL path won. On any device with `pixelRatio` 2–3 that compressed NDC by 2–3×,
  so **tap-an-atom hit the wrong atom or nothing at all**, atom labels flew off
  screen, and rotating the device shrank the viewport. Fixed in `d67d9ea`: `onLayout`
  is the single writer, always dp, and the pixel ratio is derived from
  `gl.drawingBufferWidth / layout width` rather than trusting `PixelRatio.get()`.
- ~~CPK colours cover 16 elements.~~ Now the full 118-element Jmol table with van der
  Waals radii (`15b3025`). B12's cobalt and the CU/ZN/FE ion ligands rendered hot
  pink before.
- ~~Snapshot declares PNG but Expo GL defaults to JPEG.~~ Fixed (`89f35b9`):
  `takeSnapshotAsync` now passes `format: 'png'`.

**Was** the largest piece of unaddressed technical risk in the repository: every atom
and half-bond was its own `THREE.Mesh` with a cloned material, so draw calls and CPU
overhead scaled linearly with molecule size — no instancing, no LOD, no molecule-size
cap, no FPS measurement.

`918f98c` rewrites the renderer around one `THREE.InstancedMesh` per distinct element
(atoms) and per distinct CPK colour (bond halves) instead — grouping this way, rather
than one mesh with a per-instance colour attribute, means each group needs only one
plain material, so same-element highlighting stays a single material tweak instead of
a shader. Picking now resolves `raycaster`'s `instanceId` back to atom/bond data
through a flat index array built alongside the instances; measurement highlighting
(per-atom, not per-element) uses a pool of 3 overlay spheres instead, since
`InstancedMesh` has no per-instance emissive without a shader. Geometry now steps down
through 3 LOD tiers by atom count (unchanged at the sizes this app actually ships —
B12's 180 atoms renders at the original fixed segment counts), and ligands over 2000
atoms / 4000 bonds are refused with a user-facing alert rather than attempted. A
`__DEV__`-only overlay reports FPS and draw-call count, which is the number that will
actually show whether this helped (roughly one draw call per element/bond-colour
group instead of one per atom/bond — for a typical ligand, low double digits instead
of several hundred).

The index-mapping and per-bond geometry math that make the above correct live in the
new `frontend/src/lib/moleculeGeometry.ts`, framework-free so they're unit-tested
directly (12 tests) rather than only arguable by reading the code.

**Still open, and the honest gap in this section:**

- No release/device proof of the GL renderer, hit testing, gestures or sharing —
  unchanged, and now the *only* gap in this section. Nobody in the loop that wrote
  `918f98c` had access to a device or a GPU; every claim above is reasoned from source
  and the three.js/expo-three/expo-gl versions in `package.json`, not observed on
  screen. The draw-call overlay exists specifically so the first device session can
  confirm instancing actually took effect rather than assuming it from the diff.
- Label projection was made cheaper (`dc426cd` stopped the RAF loop rebuilding the
  gesture tree on every label update), but it still projects every atom.

## Bonus assessment

Now eligible, once the APK ships. Three sections change.

### VII.1 Multiple Visualization Models — **IMPLEMENTED**

Unchanged: ball-and-stick, space-filling, wireframe and stick, switching without
re-fetching. Now also selectable as a persisted default from Settings.

### VII.2 Advanced User Interface — **MOSTLY IMPLEMENTED**

Was **Partial**. The missing Settings screen now exists (`2cf0d65`) — server URL,
default visualization model, default label toggle. Custom ligand rows, animated
splash and the coherent dark design were already credited.

Still missing: an onboarding flow, and colour preferences. The app is still forced
dark (`userInterfaceStyle: "dark"`), which is a deliberate choice rather than an
omission, but it does mean there is no light/dark adaptation to demonstrate.

### VII.3 Enhanced Molecular Interactions — **IMPLEMENTED**

Unchanged in scope: same-element highlighting, bond type/aromaticity/length,
two-atom distance and three-atom angle, toggleable labels, double-tap centring.

Worth noting that these were **silently broken on every real device** until
`d67d9ea` — they all depend on the same tap-to-atom projection as mandatory VI.4.
The original audit's "require device validation" caveat was well placed.

The three selection modes were also collapsed into one `Selection` type rendered by
`SelectionTooltip` (`223cbf8`), since atom, bond and measurement can never be on
screen together.

### VII.4 Performance and Caching — **PARTIAL** (was FAIL / MINIMAL)

**Caching now exists.** `frontend/src/data/ligandCache.ts` writes raw `.cif` text to
`expo-file-system` keyed by ligand id, and `data/ligands.ts` composes cache-then-network
(`9ea9311`). `rcsb.ts` no longer says "to be added", and `JURY.md`'s offline claim is
now true. The demo is airplane mode → a previously viewed ligand still opens.

**Performance has moved, but is still not proven.** `918f98c` adds LOD, mesh
instancing, a molecule-size cap and FPS/draw-call instrumentation — four of the
original audit's six gaps here, and the same commit as the VI.4 rewrite above (they're
one change). What's still genuinely absent: no background parser and no parsing
progress indication (CIF parsing is still synchronous on the JS thread). And the
instancing win is, again, unverified on a device or a real GPU. Grading this as
anything better than partial would still be dishonest — the difference from the last
revision is *why* it's partial: not "nothing was attempted," but "attempted, argued
correct from source, not yet observed."

### VII.5 Extended Sharing and Export — **PARTIAL** (was NOT IMPLEMENTED)

- **Custom share message** — implemented (`9ea9311`). `describeLigand` in
  `LigandViewScreen.tsx:25` builds name, formula and atom count into the share dialog.
- **Favorites system** — implemented (`5e59983`), with a filter chip in the list.
- **PNG/JPEG selection** — the share is now correctly PNG, but the format is not
  user-selectable.
- Still absent: 3D export, video recording, side-by-side comparison.

## Validation performed (2026-07-29 revision)

- Merged `origin/simon-review` into `main`; resolved 7 conflicts, all in the icon set.
- `npm ci`, then `npx tsc --noEmit` → clean, and `npx jest` → **21 passed, 3 suites**.
- Regenerated all eight icon assets from `scripts/gen-icons.py` and checked the two
  things that actually break: the 48px favicon silhouette, and the adaptive foreground
  bbox against the 66/108 safe zone under circle, squircle and rounded-square masks.
- Confirmed `docker-compose.yml` now passes `JWT_SECRET`, and that `scripts/ensure-env.sh`
  generates one.
- Confirmed the element table carries all 118 elements.
- Deleted the stale `simon-backend` branch (its only unique commit duplicated a plan
  doc already on `simon-review`).
- **Not done:** no Docker build or run, no release build, and nothing on real
  hardware. Code-presence findings are reliable; runtime behaviour is still
  explicitly not certified.

## Validation performed (2026-08-03 revision)

- `npm ci`, then `npx tsc --noEmit` → clean, and `npx jest` → **37 passed, 5 suites**
  (up from 21/3 — two new suites, `rcsb.test.ts` and `moleculeGeometry.test.ts`, plus
  new cases in `cif.test.ts`).
- Read the full `MoleculeViewer.tsx` diff by hand against three specific failure
  modes: stale `InstancedMesh` bounding spheres after a mode-switch matrix rewrite,
  atom-group-clone vs. bond-group-shared material identity (a highlight-bleed bug no
  test can catch), and `instanceId → atom/bond index` mapping correctness. Traced the
  wireframe segment math and the half-bond offset math against the pre-rewrite
  formulas by hand rather than trusting the diff on sight.
- **Not done, same as last time and for the same reason:** no Docker build or run, no
  release build, nothing on real hardware or a real GPU. This revision is entirely a
  source-level review — see the VI.4/VII.4 sections above for what that does and
  doesn't establish.

## Remaining work

Ordered by what blocks the grade.

1. **Ship the APK.** The only remaining hard blocker — scoped below.
2. **Test on real hardware.** Tap a corner atom, rotate the device, open the share
   sheet, run TalkBack/VoiceOver over the new labels, and check the FPS/draw-call
   overlay to confirm item 3 below actually reduced draw calls on a real GPU. Defects
   like the px/dp bug only reproduce on a device.
3. ~~**Profile and bound the viewer.**~~ **Done in source** (`918f98c`): instancing,
   LOD, a molecule-size cap and FPS/draw-call instrumentation. What's left is
   observation, not construction — folded into item 2 rather than tracked separately.
4. ~~**Guard the parser's inputs.**~~ **Done** (`fa98272`): a non-finite coordinate
   falls back to 0 instead of reaching the renderer, and `fetchLigandCif` rejects
   responses over 5MB.
5. **Use HTTPS** for any deployed backend.

## Handoff: the Android build path (rperez-t)

Taking this on. Starting from nothing, not from a broken file — `frontend/Dockerfile`
was deleted in `6bdf722` because it provisioned a full pinned Android SDK in order to
run `cd android && ./gradlew assembleRelease` against a `frontend/android` directory
that no `expo prebuild` step ever created. It could not have worked, and `make apk`
plus roughly a third of the old `JURY.md` depended on it.

What the path needs:

- **Toolchain**: Node 22.13+, Android compile/target SDK 36. The deleted image pinned
  Node 20 and SDK 34, which the original audit correctly flagged as incompatible with
  Expo SDK 57.
- **Native project**: either EAS Build, or `expo prebuild` generating `frontend/android`
  locally. Decide which, because it changes whether `android/` is committed.
- **Signing**: package ID and a release keystore, kept out of the repository.
- **Output**: a committed `dist/app-release.apk` (the `dist/` directory was removed by
  the merge and needs restoring), and `make apk` restored in the `Makefile`. Note that
  `.gitignore` carries a blanket `*.apk`; an `!dist/app-release.apk` exception has been
  added, or the deliverable would have been silently un-committable.
- **Then**: install the APK on a physical device and walk the corrector's path below.
  That single run closes remaining item 2 as well.

**The corrector's path** — worth running end to end once the APK exists:
search `ZN` → opens as one correctly-coloured sphere (this failed outright before
`c0bf98b`); `B12` → cobalt renders right across 180 atoms; `OXY` → two balls **with a
stick**; `ATP` → 47 atoms; airplane mode → a ligand you already opened still opens.
