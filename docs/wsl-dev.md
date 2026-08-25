# Running this on a phone from WSL2

Development note for Simon's machine. **None of this applies on a plain Linux or
macOS laptop**, and none of it is a defect in the project — it is how WSL2's
default networking works. Nothing here is needed for correction; it is here so
the next "why can't my phone see it" costs five minutes instead of an evening.

## The problem

WSL2 runs behind NAT. The distro has its own address on a virtual switch, and
Windows forwards nothing to it:

```text
     phone  ──wifi──►  Windows  192.168.178.176   ✓ reachable
                          │
                          ✗ nothing forwarded
                          ▼
                       WSL2     172.19.239.58     ← node listens here
```

So `npm start` (backend, :3000) and `npx expo start` (Metro, :8081) both run
fine, are reachable at `localhost` from inside WSL, and are invisible to the
phone. Expo's QR code makes it worse by advertising the 172.x address, which the
phone cannot route to — it just hangs on "Downloading JavaScript bundle".

Symptoms that look like other bugs:

- the QR scans, then Expo Go stalls forever;
- the app loads but every login says it cannot reach the server;
- `curl localhost:3000/health` works, so the backend "obviously" isn't the problem.

## Three ways out

### 1. Mirrored networking — best if it is available

Windows 11 22H2+ with WSL 2.0+. Put this in `%USERPROFILE%\.wslconfig`:

```ini
[wsl2]
networkingMode=mirrored
```

Then `wsl --shutdown` and reopen the terminal. WSL now shares the Windows
network stack: `localhost` means the same thing on both sides, and the phone
reaches `192.168.178.176:3000` and `:8081` with nothing else to configure.

This machine currently has only `[experimental] dnsTunneling=true` in
`.wslconfig`, so it is *not* mirrored — that is why the phone cannot connect.

### 2. Port forwarding — works on any WSL2

```bash
bash scripts/wsl-expose.sh            # prints the commands, changes nothing
bash scripts/wsl-expose.sh --apply    # runs them (UAC prompt)
bash scripts/wsl-expose.sh --remove   # undo
```

It forwards :3000 and :8081 from the Windows LAN address to the WSL address and
opens the firewall for both. Two caveats: the WSL IP **changes on every reboot**,
so re-run it after restarting; and it needs Administrator, which is why the
default mode only prints.

### 3. Tunnel — when the network itself is hostile

```bash
cd frontend && npx expo start --tunnel
```

Routes Metro through a public relay, so it works even on a network that isolates
clients from each other (some campus wi-fi does — worth knowing on evaluation
day). It only solves the JS bundle: the app still calls the backend directly, so
the backend needs route 1 or 2, or a tunnel of its own.

## Once the phone can reach it

On the login screen, tap **"Can't connect? Set the server address"** and enter
`http://192.168.178.176:3000` — the Windows LAN IP, not the WSL one, and not
`localhost`, which on a phone means the phone.

## Building the APK

Not possible from this WSL install as it stands: no JDK, no Android SDK, and
`make apk` says so before it tries. USB devices are also invisible to WSL without
`usbipd-win`, so `adb` finds nothing even with a phone plugged in. Either install
the toolchain on the Windows side, or use the cloud build:

```bash
cd frontend && npx eas build --platform android --profile preview
```
