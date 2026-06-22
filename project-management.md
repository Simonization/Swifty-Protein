# Swifty Protein — Project Management

## Programming Concepts We'll Learn

1. **3D Graphics Rendering** — SceneKit (iOS), filament/ViroCore (Android), or a cross-platform 3D lib. Scene graphs, cameras, lighting, materials.
2. **Biometric Authentication** — Face ID / Touch ID / BiometricPrompt. Secure fallback to username/password.
3. **Secure Storage & Cryptography** — Keychain/KeyStore, password hashing (bcrypt/Argon2), no plain-text secrets.
4. **Network Programming (async)** — Fetching .cif files from RCSB over HTTP, background threads, error handling, loading states.
5. **File Parsing** — Parsing the CIF (Chemical Information File) text format to extract atomic coordinates & bonds.
6. **Data Structures for Molecular Models** — Representing atoms, bonds, 3D coordinates, and their relationships.
7. **Mobile UI/UX** — Responsive layouts, search/filter, list views, gesture controls (pinch, rotate, pan).
8. **Social/Share APIs** — Screenshot capture + native share sheet integration.
9. **App Lifecycle & Security** — Re-authenticating on every foreground event, memory management (ARC / lifecycle).
10. **Biochemistry basics** — CPK coloring, ball-and-stick models, atomic elements, ligand structures.

---

## Time Estimate (2 experienced devs + Claude Code)

| Phase | Tasks | Est. Time |
|-------|-------|-----------|
| **0. Setup** | Repo, project scaffold, pick platform (Swift/Kotlin/Flutter), CI | 0.5 day |
| **1. Auth + Login** | Account creation, secure storage, biometric auth, re-auth on foreground | 1.5 days |
| **2. Protein List** | Parse `ligands.txt`, scrollable list, real-time search/filter | 1 day |
| **3. Networking + CIF Parser** | Fetch from RCSB, parse .cif format, extract atoms/bonds/coordinates, error handling | 2 days |
| **4. 3D Protein View** | Scene setup, CPK coloring, ball-and-stick rendering, gestures (rotate/zoom/pan), atom tap info | 3 days |
| **5. Share + Polish** | Screenshot capture, share sheet, app icon, launch screen | 1 day |
| **6. Testing & Edge Cases** | Real device testing, error scenarios, memory leaks, 60 FPS validation | 1.5 days |
| **7. Bonus (optional)** | Visualization modes, caching, favorites, advanced interactions | 2–3 days |
| | **Total mandatory** | **~10 days** |
| | **Total with bonuses** | **~13 days** |

> Assumes ~5-6h/day of focused work per person. Claude Code handles boilerplate, parsing, and 3D math.

---

## Work Split

### Person A — "Backend & Data"

- CIF file parser (hardest algorithmic piece)
- Networking layer (async fetch, error handling, loading states)
- Data models (atoms, bonds, coordinates, molecular structure)
- Secure storage + password hashing
- `ligands.txt` parsing + search/filter logic
- Caching (bonus)

### Person B — "Frontend & 3D"

- 3D scene setup (SceneKit/filament/etc.)
- Ball-and-stick rendering with CPK colors
- Gesture controls (rotate, zoom, pan)
- Atom tap → info tooltip
- Login UI + biometric auth integration
- App icon, launch screen, share functionality
- UI polish, animations, dark mode (bonus)

### Handoff Contract

Define the data interface on **Day 1** so both can work in parallel:

```swift
struct Atom {
    let element: String       // "C", "H", "O", etc.
    let position: SIMD3<Float> // x, y, z coordinates
    let name: String
}

struct Bond {
    let atomA: Int  // index into atoms array
    let atomB: Int
    let order: Int  // 1 = single, 2 = double, 3 = triple
}

struct Ligand {
    let id: String
    let atoms: [Atom]
    let bonds: [Bond]
}
```

Person A delivers a populated `Ligand` — Person B renders it. No waiting on each other after day 1.
