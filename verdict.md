# Verdict

A requirement-by-requirement self-audit against `protein.md` (the subject), done by
reading the source, not by trusting `README.md`. Findings are evidence-backed with
`file:line`. This is a snapshot as of 2026-08-27 — re-run it if the code moves.

Legend: **PASS** — meets the requirement. **PARTIAL** — works but has a gap worth
knowing before defence. **FAIL** — does not meet the requirement.

---

## Mandatory part

### VI.1 — Icon and Launch Screen

| # | Requirement | Verdict | Evidence |
|---|---|---|---|
| 1 | Themed icon, sized for all resolutions | PASS | `frontend/app.json:7-35` — iOS light/dark/tinted + Android adaptive (foreground/background/monochrome) + web favicon, all present under `frontend/assets/`. Atom motif also used live in-app (`SplashScreen.tsx:30`). Not visually inspected pixel-by-pixel. |
| 2 | Splash visible 1-2s, branded, not a "stuck loading" image | PASS | `RootNavigator.tsx:27,36-41` enforces `MIN_SPLASH_MS = 1600`; `SplashScreen.tsx:8-37` is an animated logo/wordmark/tagline screen, not a static frame. |

### VI.2 — Login View

| # | Requirement | Verdict | Evidence |
|---|---|---|---|
| 3 | Auth system stores/manages accounts | PASS | Custom Fastify backend, `backend/src/services/userStore.js`. |
| 4 | Username (unique) + password with minimum strength | PASS | Server: 3-32 char username, 8-128 char password, atomic uniqueness (`auth.js:6-13`, `userStore.js:25-30,60-67`, `409` on conflict). Client mirrors bounds (`credentials.ts:7-27`). |
| 5 | Biometric login | PASS | `biometrics.ts:55-69` wraps `LocalAuthentication.authenticateAsync`; `AuthContext.tsx:151-161` re-gates without a network round trip. |
| 6 | Biometric failure shows a clear popup | PASS | `LoginScreen.tsx:42-47` + `ERROR_MESSAGES` map (`biometrics.ts:36-45`). |
| 7 | No biometric hardware → password login shown, biometric hidden | PASS | `showPasswordFallback` defaults to `!biometrics.available`; biometric UI conditionally rendered (`LoginScreen.tsx:25,33,87,127`). |
| 8 | **Security requirement**: login view always shown on launch/background/Home/reopen, even if previously authenticated | **PARTIAL** | `lockPolicy.ts:29-36` correctly relocks only on `next === 'background'` (not `'inactive'`, which the share sheet and Control Centre also raise — this exact distinction is called out in `README.md` as a fixed past bug) and is well unit-tested for the ordinary transitions. **But**: `AuthContext.tsx:100-111,151-161` opens an "excursion" window around the biometric prompt itself (`excursion.current = true`, cleared on next `'active'` or a 1s fallback timeout) so the OS's own biometric activity doesn't trigger a relock. If the user presses Home during that ~1s window — plausible, not contrived — `shouldRelock` sees `excursion.current === true` and skips the lock. No test exercises the *timing* of this window, only the boolean flag. This is the one place the mandatory-part "always relock" guarantee could be beaten by a specific, realistic sequence of taps. |
| 9 | Passwords never stored in plain text | PASS | Server: Argon2id, pinned params (`password.js:10-19`), timing-safe login via decoy hash (`password.js:33-40`). Client: `credentials.ts` validates length only, never persists; `storage.ts` stores only `token`+`user` JSON via SecureStore (`storage.ts:10-13`); `storage.web.ts:16-18` is a documented no-op. |
| 10 | Clear labels, keyboard types, helpful errors | PASS | `LoginScreen.tsx` — labeled fields, `autoCapitalize`/`autoCorrect` set, errors via `ErrorBanner`/`Alert` with specific text. |

**General-instructions security checks that land on this screen:**

| # | Requirement | Verdict | Evidence |
|---|---|---|---|
| 11 | Never store sensitive data in plain text | PASS | SecureStore (Keychain/Keystore) on native; web fallback is memory-only and documented as such, not a silent downgrade to plain storage. |
| 12 | Validate all data received from the network | **PARTIAL** | `api/client.ts:87-104` validates HTTP status and JSON-parseability and maps error codes, but does **not** validate the *shape* of a successful `200` body — no runtime check that `token`/`user` are actually present. A malformed 200 (backend bug, or a compromised/misconfigured `Settings → Backend URL`) would flow straight through as if it were a valid `AuthResponse` and could throw later, e.g. on `user.username` in `LoginScreen.tsx:91`. Low risk against your own backend, but literally what "validate all data received" asks for. |
| 13 | Biometric failures handled securely, no bypass | PASS | `disableDeviceFallback: true` (`biometrics.ts:60`) keeps failure inside app messaging rather than falling to OS PIN; only `result.success` calls `unlock()` (`AuthContext.tsx:157-159`). |
| 14 | Rate limiting on register/login | PASS | Global 100/min + route-level 10/min on register and login (`backend/src/app.js:29-40`, `auth.js:15-21,30,51`). |

### VI.3 — Protein List View

| # | Requirement | Verdict | Evidence |
|---|---|---|---|
| 1 | All ligands from `ligands.txt` displayed | PASS | `assets/ligands.txt` = 1,243 lines; `scripts/gen-ligand-ids.js` generates `src/data/ligandIds.ts` straight from it (checked provenance comment + line count); `LigandListScreen.tsx` consumes that array directly — no separate hardcoded list. |
| 2 | Scrollable/virtualized list | PASS | `FlatList` with `keyExtractor`, `getItemLayout`, `initialNumToRender={24}`, `windowSize={10}`, `removeClippedSubviews` (`LigandListScreen.tsx:194-216`) — not a `ScrollView`+`map`. |
| 3 | Real-time, case-insensitive search | PASS | Plain controlled `TextInput`, no submit button (`SearchBar.tsx:16-18`); filtered via `useMemo` on every keystroke, both sides lower-cased (`LigandListScreen.tsx:81-91`). |
| 4 | Select → loading → fetch → parse → navigate | PASS | `handleSelect` (`LigandListScreen.tsx:105-132`) → `loadLigand` (`ligands.ts:12-29`, cache-first) → `fetchLigandCif` (`rcsb.ts:46-66`) → `parseLigandCif` (`cif.ts:114`) → `navigation.navigate('LigandView', …)`. |
| 5 | Distinct alerts for offline/404/parse/timeout | PASS | 6 typed `RcsbErrorKind`s with distinct messages (`rcsb.ts:14-25`), mapped to native `Alert.alert` per kind, not just logged (`LigandListScreen.tsx:23-32,113-126`). |
| 6 | Loading indicator never sticks | PASS | `try/catch` clears `pendingId` on both success and failure paths (`LigandListScreen.tsx:105-132`); no path leaves it set. |
| 7 | Handles large datasets without lag | PASS | Fixed-height rows + `getItemLayout` + `React.memo`'d row + memoized callbacks, avoiding re-render on every keystroke (`LigandListScreen.tsx:40-46,93-147,226`). |
| 8 | Async network ops don't block the UI thread | **PARTIAL** | Network fetch is async by construction (`fetch`), but CIF **parsing** (`cif.ts:114-180`) is fully synchronous on the JS thread with no worker/`InteractionManager` offload for the parse itself. Fine for typical ligands (a few hundred KB, ≤2,000 atoms), but it is not actually dispatched off-thread the way the requirement implies — a documented, accepted limitation rather than a hidden one. |
| 9 | Malformed/oversized CIF handled without crashing | PASS | 5 MB response cap (`rcsb.ts:64`) before parsing; non-finite/missing coordinates coerced to `0` instead of propagating `NaN` (`cif.ts:144-148`); separate 2,000-atom render-time cap (`moleculeGeometry.ts:18,38`); a zero-atom CIF throws a typed error rather than crashing (`ligands.test.ts:68-74`). |

### VI.4 — Protein View

| # | Requirement | Verdict | Evidence |
|---|---|---|---|
| 1 | Allowed rendering approach (no full game engine) | PASS | `<GLView>` (`expo-gl`) mounted as an ordinary RN view; `THREE.Scene`/renderer built in `onContextCreate` and driven by its own RAF loop, fully disposed on unmount (`MoleculeViewer.tsx:3-6,356-361,592-621,772-846,890-897`). This is a rendering library embedded in a view, not a standalone engine runtime. |
| 2 | CPK coloring | PASS | `elements.ts:20,25-27,34-35` — H white, C gray, N blue, O red, P orange, S yellow, applied per atom/bond group in the viewer. |
| 3 | Ball-and-stick, bonds thinner than atoms | PASS | Atom radius scaled from element VdW radius; fixed thin bond radius (`moleculeGeometry.ts:46-59`). |
| 4 | Tap atom → tooltip with element symbol, dismiss on tap-elsewhere | PASS | Real `THREE.Raycaster` hit-testing against `InstancedMesh` (not a bounding box); dp/px coordinate handling documented and consistent (`MoleculeViewer.tsx:147-150,485-519,592-606,859-874`) — the historical px/dp bug mentioned in `README.md` looks genuinely fixed, though not confirmed on a real device. |
| 5 | Rotate (drag), zoom (pinch), pan (two-finger, optional) | PASS | `react-native-gesture-handler` composition with `Gesture.Race(pinch, panTwoFinger)` to prevent the two gestures fighting, and `onFinalize` instead of `onEnd` to avoid a stale zoom baseline (`MoleculeViewer.tsx:538-589`) — reads as debugged, not a stub. |
| 6 | Share button → screenshot → native share sheet | PASS | `GLView.takeSnapshotAsync` → `Sharing.shareAsync` (`MoleculeViewer.tsx:326-336`, `LigandViewScreen.tsx:61-92`); separate Save-to-Photos path correctly split for web (`photoLibrary.ts` / `.web.ts`). |
| 7 | Camera frames whole molecule, multi-light, not flat | PASS | Framing math unit-tested including a regression for a prior clipping bug and NaN/zero-size edge cases (`moleculeGeometry.ts:81-97`, `framing.test.ts:39-60`); ambient + two directional lights (`MoleculeViewer.tsx:619-625`). |
| 8 | Smooth performance, no lag/stutter | PASS (unverified on hardware) | One `InstancedMesh` per element/bond-color rather than per-atom draw calls; tiered LOD by atom count; hard caps at 2,000 atoms / 4,000 bonds rejected before mount; no per-frame allocation in the render loop (shared scratch vectors/matrices). A `__DEV__`-only FPS/draw-call overlay exists for on-device confirmation, but — per `README.md`'s own "Known limits" — **nothing here has actually been observed running on a physical phone**. This is the single biggest open risk against the subject's explicit warning that simulators/emulators can hide real performance problems. |

**Mandatory-part bottom line:** every checkbox in VI.1–VI.4 is at least functionally
present and none crash by inspection. Two real, non-cosmetic gaps keep it from being
call-it-perfect: the **relock excursion race** (VI.2 #8) and **no on-device
verification** (VI.4 #8) — the latter is explicitly named in Chapter V as a common
pitfall ("Failing to test on real devices") and needs to happen before this can be
claimed as done, regardless of what the code review says.

---

## General instructions (Chapter V)

| # | Requirement | Verdict | Evidence |
|---|---|---|---|
| 1 | Responsive to screen size / orientation / density | **PARTIAL** | `useOrientation.ts` is a real `useWindowDimensions` hook, and `LigandViewScreen.tsx` genuinely branches layout on it (side-by-side controls in landscape, hidden footer cards). `LigandListScreen.tsx`, however, never imports it — rows are a single fixed `ROW_HEIGHT = 64` regardless of tablet width or orientation. One of the two main screens adapts; the list screen does not. |
| 2 | Offline access to previously loaded ligands | PASS | Cache-first `loadLigand` (`ligands.ts:12-29`) backed by `ligandCache.ts` with path-injection guards; tested for empty/round-trip/malformed-code cases. |
| 3 | Accessibility (labels, contrast) | PASS | Real, not token: ~56 accessibility props across screens, paired roles/labels/hints/state, decorative elements correctly hidden from the tree, documented AA contrast check in `theme.ts:16-19`. A few components (`MoleculeBackdrop`, `Screen`, `RegisterScreen`, `SplashScreen`) have none — acceptable for decorative surfaces, not independently verified for the rest. |
| 4 | No memory leaks from 3D objects (named pitfall) | PASS | `MoleculeViewer.tsx:823-846` disposes every geometry, material (including per-instance clones vs. shared cache, not double-freed), and the renderer itself on unmount; RAF loop cancelled. |
| 5 | Well-organized, conventional code | PASS (impression only) | Clean `screens/components/data/lib/hooks/auth/settings/theme/navigation/api` separation; `lib`/`data` deliberately framework-free for testability. |

---

## Bonus inventory (Chapter VII)

Per the subject: **bonuses are only evaluated if the mandatory part is perfect, and
otherwise totally ignored.** Given the two mandatory gaps above (on-device
verification and the relock race), don't lead with this section at defence — but
here's the honest state of it.

### VII.1 — Multiple visualization models
Space-filling, wireframe, stick, ball-and-stick, switchable without reload. **IMPLEMENTED** — `viewModes.ts`, `MoleculeViewer.tsx:252-299` rewrites instance matrices in place.

### VII.2 — Advanced UI
- Custom list cells — **IMPLEMENTED** (`LigandRow`, name/formula/offline badge/favorite star).
- Smooth animations — **PARTIAL**: only the center-on-atom lerp and pressed-state opacity; no broader transition system.
- Dark mode — **NOT IMPLEMENTED as a mode**: `theme.ts` is one hardcoded dark palette with no light variant or toggle. The subject asks for a *complete dark mode theme*, which implies there's a light mode to complement — this app is just permanently dark. `README.md` says as much itself. Don't claim this bonus.
- Onboarding — **IMPLEMENTED** (3-card tour, persisted, replayable from Settings).
- Settings screen — **IMPLEMENTED** (backend URL, default view mode, default labels).

### VII.3 — Enhanced molecular interactions
Atom highlighting, bond-tap info, distance/angle measurement, atom-label toggle, double-tap center-on-atom — **all IMPLEMENTED** (`MoleculeViewer.tsx`, various line ranges; each has a UI entry point in `LigandViewScreen.tsx`).

### VII.4 — Performance and caching
- Local caching — **IMPLEMENTED**.
- Lazy loading — **PARTIAL**: the list is virtualized (`FlatList` windowing), but all 1,243 IDs are in memory upfront; that's rendering-lazy, not data-lazy.
- Background parsing — **NOT IMPLEMENTED**: parsing is synchronous on the JS thread, no worker, no progress indicator during parse — matches the mandatory-part gap above.
- Memory/LOD — **IMPLEMENTED** (tiered segment counts by atom count, full dispose on unmount).
- 60 FPS guarantee — **PARTIAL**: a dev-only overlay measures it; nothing guarantees or has confirmed it on hardware.

### VII.5 — Extended sharing and export
- Custom share message — **IMPLEMENTED**.
- Multiple export formats — **NOT IMPLEMENTED** (PNG only).
- Video recording — **NOT IMPLEMENTED**.
- Favorites system — **IMPLEMENTED**.
- Comparison view — **NOT IMPLEMENTED**.

---

## What to actually fix before calling the mandatory part perfect

In order of how likely each is to bite at defence:

1. **Test on a real Android phone.** Nothing in this codebase has been run on
   hardware. This is the exact, explicitly-named pitfall in Chapter VIII.2. Do this
   first — it's also the only way to find out if any of the "PASS (unverified)"
   items above are actually wrong once real touch input and GPU timing are in play.
2. **The relock excursion race** (`AuthContext.tsx:100-111`, `lockPolicy.ts:29-36`).
   Try backgrounding the app (press Home) at the exact moment the biometric sheet is
   up, a few times in a row, on a real device. If the login view doesn't reappear,
   this is the mandatory security requirement failing under a realistic sequence.
3. **Response shape validation** (`api/client.ts:87-104`). Add a minimal runtime
   check that a `200` auth response actually contains `token` and `user` before
   trusting it — cheap, and closes the literal "validate all data received" ask.
4. Optional polish, not blocking: give `LigandListScreen` the same orientation/width
   awareness `LigandViewScreen` already has.

Everything else checked out against the source, not just the README.
