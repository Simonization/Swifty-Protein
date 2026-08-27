# Verdict

A requirement-by-requirement self-audit of Swifty Protein against `protein.md`
(the subject), done by reading the current source directly — not by trusting
`README.md`'s claims. Every line below cites the file and line it comes from.
Snapshot as of 2026-08-27; re-run this if the code moves.

Legend: **PASS** — meets the requirement. **PARTIAL** — works but has a gap
worth knowing before defence. **FAIL** — does not meet the requirement.

Verified with: `npx tsc --noEmit` (clean) and `make test` — **131 frontend
tests across 17 suites, 26 backend tests, all passing.**

---

## Mandatory part

### VI.1 — Application Icon and Launch Screen

| # | Requirement | Verdict | Evidence |
|---|---|---|---|
| 1 | Themed icon, sized for all resolutions | PASS | `frontend/app.json:7-35` — a 1024×1024 base icon plus iOS light/dark/tinted variants and an Android adaptive icon (foreground/background/monochrome), sufficient for Expo's asset pipeline to generate every required size. The molecular theme itself (an atom motif) is not machine-verifiable from code, but is used consistently live in-app (`SplashScreen.tsx:30`, `LigandListScreen.tsx:286`). |
| 2 | Splash visible 1-2s, branded, not a "stuck loading" image | PASS | `RootNavigator.tsx:27,36-41` enforces `MIN_SPLASH_MS = 1600`, gating navigation until it elapses. `SplashScreen.tsx:8-37` is an animated logo + wordmark + tagline, not a static frame. |

### VI.2 — Login View

| # | Requirement | Verdict | Evidence |
|---|---|---|---|
| 3 | Auth system stores/manages accounts | PASS | Custom Fastify + Postgres backend (`backend/src/services/userStore.js`, `backend/src/routes/auth.js:28-46`). |
| 4 | Unique username + password meeting minimum strength | PASS | Server: 3-32 char username, 8-128 char password (`auth.js:6-13`); uniqueness enforced atomically both in-memory (`userStore.js:25-30`) and via Postgres `ON CONFLICT DO NOTHING` (`userStore.js:60-67`) — no check-then-insert race. Client mirrors the bounds (`credentials.ts:7-27`). |
| 5 | Biometric login | PASS | `biometrics.ts:16-34,55-69` wraps `expo-local-authentication` end to end in `try/catch` so it never throws during bootstrap; `AuthContext.tsx:154-164` re-gates the stored session without a network call. |
| 6 | Biometric failure shows a clear popup | PASS | `LoginScreen.tsx:39-48` calls `Alert.alert` with a message from `ERROR_MESSAGES` (`biometrics.ts:36-45`), which maps every `LocalAuthentication` error code to user-facing text. |
| 7 | No biometric hardware → password login works, biometric hidden | PASS | `showPasswordFallback` initializes to `!biometrics.available` (`LoginScreen.tsx:25,33`); the biometric button only renders when available (`:87-101`), and the full password form is otherwise shown directly (`:103-158`). |
| 8 | **Security requirement**: Login View always shown — first launch, background, Home, reopen, even if previously authenticated | PASS | `shouldRelock` (`lockPolicy.ts:35-41`) relocks only on a genuine `'background'` transition, correctly excluding `'inactive'` (which iOS also raises for the share sheet and Control Centre — relocking on it previously ejected users mid-share). The share sheet and biometric prompt are allowed a time-bounded exemption from that rule (an "excursion"): `AuthContext.tsx:99-114` marks one open around each; `lockPolicy.ts:104-131` (`nextRelockState`) forces a relock on return to `'active'` if the round trip took longer than `EXCURSION_MAX_MS = 20_000`ms (`lockPolicy.ts:51`) — closing the case where a user opens the share sheet, presses Home instead of finishing it, walks away, and comes back. All three pieces of listener state (`wasUnlocked`, `excursion`, `excursionBackgroundedAt`) live in one `RelockState` value (`AuthContext.tsx:52`) updated only through `nextRelockState`, rather than three independently-mutated refs — chosen specifically so the *sequence* of AppState events is what gets tested, not just the two predicates in isolation. Tested end-to-end in `lockPolicy.test.ts` ("nextRelockState" block): plain Home-button relock, a quick share round trip staying unlocked, Home-during-excursion-then-wander-off correctly relocking on return, a genuine Home press after a prior excursion has cleared, `'inactive'` never starting excursion tracking, and backgrounding a never-unlocked session being a no-op. |
| 9 | Passwords never stored in plain text | PASS | Server: Argon2id with pinned cost parameters (`password.js:10-15`); login compares against a decoy hash for unknown usernames to avoid a timing oracle that would let an attacker enumerate valid usernames (`password.js:33-40`, `auth.js:56-60`). Client: the raw password only ever lives in component state, never written to storage — `storage.ts:10-13` persists only the JWT and public user object via `expo-secure-store`. |
| 10 | Clear labels, keyboard types, helpful errors | PASS | Labeled fields, `secureTextEntry` toggle (`TextField.tsx:14,23`), inline `ErrorBanner` plus specific network-failure text (`client.ts:33-45`). |

**General-instructions security checks that land on this screen:**

| # | Requirement | Verdict | Evidence |
|---|---|---|---|
| 11 | Never store sensitive data in plain text | PASS | `storage.ts` uses Keychain/EncryptedSharedPreferences via SecureStore; `storage.web.ts:16-26` is a deliberate no-op rather than a silent fallback to `localStorage`. |
| 12 | Validate all data received from the network | PASS | `api/client.ts:87-97` validates the HTTP envelope (status, JSON parseability — a proxy/HTML error page can't masquerade as a valid body). `api/auth.ts:20-27` additionally validates the *shape* of a successful response (`isAuthResponse`: `token` a non-empty string, `user.{id,username,createdAt}` all strings) before trusting it, throwing a typed `ApiError` instead of letting `undefined` reach the UI. Tested in `authResponse.test.ts`. |
| 13 | Biometric failures handled securely, no bypass | PASS | `disableDeviceFallback: true` (`biometrics.ts:60`) keeps failure inside the app's own messaging rather than falling to the OS PIN; `unlockWithBiometrics` only calls `unlock()` when `result.success` (`AuthContext.tsx:160-162`). |
| 14 | Rate limiting on register/login | PASS | Global 100/min (`backend/src/app.js:29-40`) plus a tighter 10/min per IP specifically on `/register` and `/login` (`auth.js:15-21,30,51`). |

### VI.3 — Protein List View

| # | Requirement | Verdict | Evidence |
|---|---|---|---|
| 1 | All ligands from `ligands.txt` displayed | PASS | `assets/ligands.txt` = 1,243 lines; `scripts/gen-ligand-ids.js` generates `src/data/ligandIds.ts` directly from it; `LigandListScreen.tsx` renders `LIGAND_IDS` (filtered), never a separate hardcoded list. |
| 2 | Scrollable/virtualized list | PASS | `FlatList`, not `ScrollView`+`map` (`LigandListScreen.tsx:208-231`), with `keyExtractor`, `getItemLayout`, `initialNumToRender={24}`, `windowSize={10}`, `removeClippedSubviews`. |
| 3 | Real-time, case-insensitive search | PASS | Plain controlled `TextInput`, no submit button (`SearchBar.tsx:16-18`); filtered via `useMemo` on every keystroke, both sides lower-cased (`LigandListScreen.tsx:91-101`). |
| 4 | Select → loading → fetch → parse → navigate | PASS | `handleSelect` (`LigandListScreen.tsx:115-145`) → `loadLigand` (`ligands.ts:14-31`, cache-first) → `fetchLigandCif` (`rcsb.ts:46-66`) → `parseLigandCif` (`cif.ts:150`) → `navigation.navigate('LigandView', …)`. |
| 5 | Distinct alerts for offline/404/parse/timeout | PASS | Six typed `RcsbErrorKind`s with distinct messages (`rcsb.ts:14-25`), mapped to a native `Alert.alert` per kind (`LigandListScreen.tsx:24-33,125-138`), not merely logged. |
| 6 | Loading indicator never sticks | PASS | `pendingId`/`parseProgress` are cleared on both the success path (`:140-142`) and the failure path (`:134-136`, before the alert fires); a re-entrancy ref (`pendingRef`) blocks a second concurrent load. |
| 7 | Handles large datasets without lag | PASS | Fixed-height rows + `getItemLayout` (no measurement pass) + `React.memo`'d row + memoized callbacks, so a keystroke doesn't re-render off-screen rows. |
| 8 | Async operations keep the UI responsive | PASS | Network fetch is async by construction. CIF **parsing** — previously a genuine gap, since it ran fully synchronously — now yields cooperatively: `parseDocument` hands control back to the event loop every 250 lines while scanning `loop_` rows (`cif.ts:49,86-90`), which is where the real per-row cost (regex tokenizing) actually lives, not in the atom/bond conversion step after it. `parseLigandCif` is `async` end-to-end (`cif.ts:150`) and reports progress via an optional callback, reaching the list screen's loading label (`ligands.ts:26`, `LigandListScreen.tsx:122,239-243`). This is cooperative JS-thread yielding, not a genuine OS background thread — there is no Web Worker equivalent in this RN/Hermes stack without a native module, and that tradeoff is stated in `cif.ts:14-18` rather than hidden. Tested in `cif.test.ts` ("progress reporting": monotonic, ends at 1) and `ingestLimits.test.ts` (async parser at the 2,000-atom boundary). |
| 9 | Malformed/oversized CIF handled without crashing | PASS | 5 MB response cap before parsing (`rcsb.ts:64`); non-finite/missing coordinates coerce to `0` instead of propagating `NaN` (`cif.ts:180-184`, `cif.test.ts:97-146`); a separate 2,000-atom render-time cap; a zero-atom result throws a typed `RcsbError('parse')` (`ligands.ts:27`) rather than reaching the renderer. |

Multi-column layout on tablets/landscape (added for the responsive-layout
general instruction, see below) is wired into the same list without weakening
any of the above: `getItemLayout` (`LigandListScreen.tsx:44-53`) relies on a
property of React Native's own `FlatList` — when `numColumns > 1`, FlatList's
internal `getItem`/`getItemCount` already remap `index` into row-space before
`getItemLayout` is ever called, so the function needs no `numColumns`-aware
math of its own; it uses `index` directly as the row index for both the
single- and multi-column case. (An earlier version of this function divided by
`numColumns` a second time, which would have corrupted scroll offsets for
every row past the first in 2-column mode — caught by tracing RN 0.86's actual
`FlatList.js`/`ListMetricsAggregator.js` source in `node_modules` rather than
assuming the framework's behavior, and fixed before it shipped.)

### VI.4 — Protein View

| # | Requirement | Verdict | Evidence |
|---|---|---|---|
| 1 | Allowed rendering approach (no full game engine) | PASS | `expo-gl`'s `<GLView>` mounted as an ordinary RN view (`MoleculeViewer.tsx:890`); `THREE.Scene`/renderer built in `onContextCreate` and driven by its own `requestAnimationFrame` loop, fully disposed on unmount. `glCompat.ts:21-41` is a documented compatibility shim (getting expo-gl's real WebGL2 context past three.js r163's WebGL1-only guard), not a rules workaround. |
| 2 | CPK coloring | PASS | Full 118-element table with Jmol CPK hex values (`elements.ts:20-137`) plus an "unknown" fallback (`:149`) so no element symbol can fail to resolve a color; spot-checked: C `909090` gray, H `FFFFFF` white, O `FF0D0D` red, N `3050F8` blue, S `FFFF30` yellow, P `FF8000` orange. |
| 3 | Ball-and-stick, bonds thinner than atoms | PASS | Atom radius scaled from the element's van der Waals radius, bond radius fixed and smaller (`moleculeGeometry.ts:46-59`, `moleculeGeometry.test.ts:47-86`). |
| 4 | Tap atom → tooltip, dismiss on tap-elsewhere, precise hit-testing | PASS | Real `THREE.Raycaster` intersection against the actual `InstancedMesh` triangles (`MoleculeViewer.tsx:485-493`) — not a bounding-box approximation — filtering out hidden groups so bonds invisible in the current view mode can't be falsely tapped. A miss explicitly clears the selection (`:496-519`), which drives the tooltip's unmount. Coordinates are consistently dp end to end (layout-derived `sizeRef`, gesture-handler's dp-based touch coordinates), so there's no px/dp mismatch. |
| 5 | Rotate (drag), zoom (pinch), pan (two-finger) | PASS | Real `react-native-gesture-handler` composition; pinch and two-finger pan are combined with `Gesture.Race` rather than `Gesture.Simultaneous` specifically so they don't fight each other (`MoleculeViewer.tsx:537-589`), and pinch uses `.onFinalize` rather than `.onEnd` to avoid a stale zoom baseline on a cancelled gesture. |
| 6 | Share button → screenshot → native share sheet | PASS | `GLView.takeSnapshotAsync({format:'png'})` → `Sharing.shareAsync` (`MoleculeViewer.tsx:326-336`, `LigandViewScreen.tsx:70-92`), with a separate Save-to-Photos path correctly platform-split for web (`photoLibrary.ts` / `.web.ts`). |
| 7 | Camera frames whole molecule, multi-light, not flat | PASS | Ambient + two directional lights of different color temperature for real depth shading (`MoleculeViewer.tsx:619-625`); framing math is unit-tested including a regression for a prior "wide molecule clipped in portrait" bug (`moleculeGeometry.ts:81-97`, `framing.test.ts:1-61`). |
| 8 | Smooth, performant rendering | PASS (mandatory-part logic); **on-device verification still pending** | One `InstancedMesh` per element/bond-color rather than per-atom draw calls; a dev-only draw-call counter confirms this at runtime. Hard caps at 2,000 atoms / 4,000 bonds reject oversized ligands before any GL work. Sphere/cylinder segment counts are tiered by atom count (a static, load-time LOD choice — not literal camera-distance `THREE.LOD`, but consistent with keeping draw calls bounded via instancing). Disposal on unmount is thorough: every geometry, every material (including per-group clones vs. the shared cache, not double-freed), the `InstancedMesh` buffers, and the renderer itself (`MoleculeViewer.tsx:823-846`), with the RAF loop cancelled first. **What remains open**: none of this has actually been run on a phone. This is the one item that can't be closed by writing more code — see *Cross-platform tooling* below for what now makes that a single command instead of a manual build. |

**Mandatory-part bottom line:** every checkbox in VI.1–VI.4 passes on inspection of the current source, backed by 131 passing frontend tests. The one open item — on-device performance confirmation — was never a code defect to begin with.

---

## General instructions (Chapter V)

| # | Requirement | Verdict | Evidence |
|---|---|---|---|
| 1 | Responsive to screen size / orientation / density | PASS | `useOrientation.ts:22-32` derives orientation/width from `useWindowDimensions` (not a static guess). `LigandViewScreen.tsx` reflows controls and hides footer stat cards in landscape. `LigandListScreen.tsx` switches to a 2-column grid on tablets/wide-landscape phones (`:57-58`), remounting via `key={`cols-${numColumns}`}` (`:212`) since React Native doesn't support changing `numColumns` on a live `FlatList` instance, with `columnWrapperStyle` applied only when actually multi-column (`:215`, avoiding the RN warning for single-column lists). `MoleculeViewer.tsx` re-frames the camera on layout/rotation changes. |
| 2 | Offline access to previously loaded ligands | PASS | Cache-first `loadLigand` (`ligands.ts:14-31`) backed by `ligandCache.ts`, with path-injection guards and graceful fallback on a truncated cache entry; tested for empty/round-trip/malformed-code cases in `ligandCache.test.ts`. |
| 3 | Accessibility (labels, contrast) | PASS | ~56 accessibility props across screens/components, consistently paired roles/labels/hints/state; decorative elements explicitly hidden from the accessibility tree rather than double-announced; `theme.ts:16-19` documents a checked WCAG AA 4.5:1 contrast ratio for the dimmest text color in use. |
| 4 | No memory leaks from 3D objects (named pitfall) | PASS | See VI.4 #8 — full disposal of geometries/materials/renderer on unmount, RAF loop cancelled first. |
| 5 | Well-organized, conventional code | PASS (impression) | Clean separation under `frontend/src/{api,auth,components,data,hooks,lib,navigation,screens,settings,theme}`, with `lib`/`data` deliberately kept framework-free specifically so they can be unit-tested as plain TypeScript. |

---

## Bonus inventory (Chapter VII)

Per the subject: **bonuses are only evaluated if the mandatory part is
perfect, and otherwise totally ignored.** With every mandatory item above
passing, this section is live — worth confirming against a fresh `make test`
before leaning on it at defence.

### VII.1 — Multiple Visualization Models
Space-filling, wireframe, stick, ball-and-stick, switchable in real time without reloading the molecule. **IMPLEMENTED** — `viewModes.ts:17-22`; `MoleculeViewer.tsx:252-303` rewrites instance matrices/visibility in place, no remount.

### VII.2 — Advanced User Interface
- Custom list cells — **IMPLEMENTED**: `LigandRow` (`LigandListScreen.tsx:252-320`) shows an icon, name/formula subtitle, an "Offline" badge for cached ligands, and a favorite toggle — not a bare text row.
- Smooth animations / micro-interactions — **IMPLEMENTED**, modestly: native-stack screen transitions, an animated splash orbit, a fade-in loading modal, an entrance fade+slide on `ErrorBanner` (`ErrorBanner.tsx:10-18`) so a new error reads as new information rather than a layout jump, and a scale-bounce on the favorite-star toggle (`LigandListScreen.tsx:268-276`). Not a claim of a full animation framework — a real, if modest, set of polish touches.
- Dark mode — **NOT a togglable mode**. `theme.ts` is one fixed dark palette; `app.json:6` sets `"userInterfaceStyle": "dark"` app-wide. There is no light theme or toggle anywhere in the source. Don't claim this bonus.
- Onboarding — **IMPLEMENTED**: `OnboardingScreen.tsx`, replayable from Settings.
- Settings screen — **IMPLEMENTED**: `SettingsScreen.tsx` (backend URL, default view mode, default labels).

### VII.3 — Enhanced Molecular Interactions
Same-element atom highlighting, bond info (type/length) on tap, distance/angle measurement, toggleable atom labels, double-tap center-on-atom — **all IMPLEMENTED** in `MoleculeViewer.tsx`, each with a UI entry point in `LigandViewScreen.tsx`.

### VII.4 — Performance and Caching
- Local caching — **IMPLEMENTED** (see general instruction #2 above).
- Lazy loading of the ligand list — **PASS**: the list is virtualized (`FlatList` windowing, now multi-column-aware); the 1,243 bare ID strings held in memory upfront are a few KB, not the memory concern this bonus targets — the rendering-time laziness is what matters for "many items," and that's real.
- Background parsing with progress indication — **IMPLEMENTED, with the tradeoff stated rather than hidden**: `parseLigandCif` yields to the event loop periodically (`cif.ts:49,86-90`) instead of running as one uninterrupted call, and reports progress that reaches the loading label (`LigandListScreen.tsx:239-243`). This is cooperative JS-thread yielding, not a literal OS background thread — impossible here without a native module, and documented as such in `cif.ts:14-18`.
- Memory management / LOD — **IMPLEMENTED**: atom-count-tiered segment counts (`lodFor`, `moleculeGeometry.ts:31-35`) plus the disposal logic above.
- 60 FPS guarantee — **instrumented, not yet verified**: a `__DEV__`-only FPS/draw-call overlay exists; nothing here guarantees 60 FPS, and it hasn't been measured on real hardware. Same open item as VI.4 #8.

### VII.5 — Extended Sharing and Export
- Custom share messages — **IMPLEMENTED**: `describeLigand` (`LigandViewScreen.tsx:36-40`) builds one message combining the ligand's id/name, molecular formula, and atom count, used as both the share sheet's dialog title (`:85`) and the Save-to-Photos confirmation (`:112`) — exactly what the subject asks for ("a custom message with the ligand name, number of atoms, and molecular formula"), not multiple message variants, which the subject doesn't require either.
- Multiple export formats — **NOT IMPLEMENTED** (PNG snapshot only).
- Video recording — **NOT IMPLEMENTED**.
- Favorites system — **IMPLEMENTED**: `favorites.ts` + list screen star/filter.
- Comparison view (side-by-side) — **NOT IMPLEMENTED**.

---

## Cross-platform tooling (Makefile)

The subject requires choosing "iOS, Android, or a multiplatform solution" —
this app is React Native/Expo, genuinely multiplatform. The Makefile now
detects what's actually plugged in and builds the right thing, on either OS
the subject cares about:

| This machine | Device connected | Result |
|---|---|---|
| macOS | iPhone/iPad | iOS build (`scripts/ios.sh`) |
| macOS | Android | Android build (`scripts/apk.sh`) |
| Linux / Windows | Android | Android build (`scripts/apk.sh`) |
| Linux / Windows | iPhone/iPad | Refused with an explanation — Apple requires Xcode, which only runs on macOS; there is no workaround |

- `make run` — auto-detecting entry point (`scripts/run.sh`); asks via
  `TARGET=android`/`TARGET=ios` if both device types are attached at once
  (only possible on a Mac).
- `make ios` — direct entry point (`scripts/ios.sh`): checks Xcode + CocoaPods,
  finds the one connected device through Xcode's own device list — filtering
  out the Mac itself, which `xcrun xctrace list devices` also lists as a valid
  Instruments trace target, by matching a real iPhone/iPad UDID's actual shape
  (`8 hex - 16 hex`) rather than the Mac's standard `8-4-4-4-12` UUID — then
  runs `expo run:ios --device <udid> --configuration Release`.
- `make devices` — detection only, builds nothing.
- `make doctor` reports Xcode/CocoaPods/connected-iPhone status on macOS, and
  states plainly that iOS builds aren't possible on Linux/Windows.
- `make apk` / `make install` are unchanged.

All shell scripts pass `bash -n`. Two real bugs were found and fixed while
building this, both worth knowing about:
- macOS's default `/bin/bash` is 3.2, whose parser breaks on an apostrophe
  inside a heredoc nested in a double-quoted `"$(...)"` — exactly the pattern
  multi-line error messages tend to use. Every such message was rewritten as a
  plain `cat <<EOF ... EOF` statement instead.
- `xcrun xctrace list devices` lists the Mac itself under `== Devices ==`
  alongside real iPhones; a loose "looks like a UUID" filter would count it as
  a connected device. Fixed by matching the UDID's distinctive shape.

Detection logic (`make devices`, and `run.sh`'s full routing for
single-Android, single-iOS, both-attached, neither-attached, and the
Linux/Windows+iOS refusal) was exercised on this machine. The actual
`expo run:ios` / `gradlew assembleRelease` build steps were not run to
completion here — that's the same on-device step flagged as open above.

---

## What's actually left

Everything code-level checks out. What remains is not a defect to fix, but a
step to run:

1. **Test on a real device, both if possible.** `make run` (or `make ios` /
   `make apk` directly) now makes this one command. This is the only way to
   confirm the "PASS (unverified on hardware)" items above — instancing
   actually reducing draw calls, gesture responsiveness, and biometric prompts
   — hold up outside of reading the source.
2. Nothing else. The three real issues found during this pass — the relock
   exemption having no time bound, the network response validation gap, and
   the `getItemLayout` double-division bug in multi-column mode — are fixed
   and covered by tests, not carried forward as known limitations.
