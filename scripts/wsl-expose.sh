#!/usr/bin/env bash
#
# wsl-expose.sh — make a WSL2-hosted backend and Metro reachable from a phone.
#
# WSL2 sits behind NAT by default: the distro gets its own address (172.x) and
# Windows does not forward anything to it. A phone on the same wi-fi can reach
# Windows and cannot reach WSL, so `npm start` and `npx expo start` both look
# dead from the device even though they are running fine.
#
# This prints the exact commands that fix it. It does not run them by default —
# they need an elevated (Administrator) shell on the Windows side, which this
# script cannot grant itself from inside WSL. Pass --apply to have it ask
# Windows for elevation (a UAC prompt appears) and run them for you.
#
#   bash scripts/wsl-expose.sh            show what to run
#   bash scripts/wsl-expose.sh --apply    run it (UAC prompt)
#   bash scripts/wsl-expose.sh --remove   tear the forwarding down again
#
# Nothing here is needed on a plain Linux or macOS laptop.

set -uo pipefail

BACKEND_PORT=3000
METRO_PORT=8081

if [ -t 1 ]; then
  GREEN=$'\033[0;32m'; YELLOW=$'\033[0;33m'; BOLD=$'\033[1m'; NC=$'\033[0m'
else
  GREEN=""; YELLOW=""; BOLD=""; NC=""
fi

die() { printf "%s\n" "$1" >&2; exit 1; }

grep -qi microsoft /proc/version 2>/dev/null \
  || die "Not running under WSL — this script is not needed here."

PS="/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe"
[ -x "$PS" ] || die "powershell.exe not found at $PS"

MODE="show"
case "${1:-}" in
  --apply)  MODE="apply" ;;
  --remove) MODE="remove" ;;
  "")       ;;
  *)        die "Unknown option: $1 (expected --apply or --remove)" ;;
esac

# --- addresses --------------------------------------------------------------
WSL_IP="$(hostname -I | awk '{print $1}')"
# The adapter that actually carries the default route, rather than the first one
# ipconfig happens to print — on a laptop with Tailscale, Hyper-V and a vEthernet
# switch, "the first one" is usually wrong.
WIN_IP="$("$PS" -NoProfile -Command \
  "(Get-NetIPConfiguration | Where-Object {\$_.IPv4DefaultGateway -ne \$null -and \$_.NetAdapter.Status -eq 'Up'} | Select-Object -First 1).IPv4Address.IPAddress" \
  2>/dev/null | tr -d '\r' | tail -1)"

[ -n "$WSL_IP" ] || die "Could not determine the WSL IP."
[ -n "$WIN_IP" ] || die "Could not determine the Windows LAN IP."

printf "${BOLD}WSL:${NC}     %s   (where node runs — unreachable from your phone)\n" "$WSL_IP"
printf "${BOLD}Windows:${NC} %s   (what the phone can actually reach)\n\n" "$WIN_IP"

# --- the commands -----------------------------------------------------------
# `listenaddress=0.0.0.0` so the proxy answers on the wi-fi adapter, not only on
# loopback. The firewall rule is separate: forwarding a port does not open it.
add_cmds="netsh interface portproxy add v4tov4 listenport=$BACKEND_PORT listenaddress=0.0.0.0 connectport=$BACKEND_PORT connectaddress=$WSL_IP; \
netsh interface portproxy add v4tov4 listenport=$METRO_PORT listenaddress=0.0.0.0 connectport=$METRO_PORT connectaddress=$WSL_IP; \
New-NetFirewallRule -DisplayName 'Swifty Proteins (WSL)' -Direction Inbound -Action Allow -Protocol TCP -LocalPort $BACKEND_PORT,$METRO_PORT -ErrorAction SilentlyContinue"

remove_cmds="netsh interface portproxy delete v4tov4 listenport=$BACKEND_PORT listenaddress=0.0.0.0; \
netsh interface portproxy delete v4tov4 listenport=$METRO_PORT listenaddress=0.0.0.0; \
Remove-NetFirewallRule -DisplayName 'Swifty Proteins (WSL)' -ErrorAction SilentlyContinue"

run_elevated() {
  # The payload is embedded in a single-quoted PowerShell string, and it contains
  # single quotes of its own (the firewall rule's name). PowerShell escapes those
  # by doubling them; without this the string terminates early and the elevated
  # shell receives a fragment.
  local payload="${1//\'/\'\'}"
  printf "${YELLOW}Asking Windows for elevation — accept the UAC prompt.${NC}\n"
  "$PS" -NoProfile -Command "Start-Process powershell -Verb RunAs -Wait -ArgumentList '-NoProfile','-Command','$payload'" \
    && printf "${GREEN}Done.${NC}\n" \
    || die "Elevation failed or was declined. Run the commands by hand instead."
}

case "$MODE" in
  apply)
    run_elevated "$add_cmds"
    printf "\nPhone now reaches the backend at ${BOLD}http://%s:%s${NC}\n" "$WIN_IP" "$BACKEND_PORT"
    printf "Set that in the app: login screen → \"Can't connect? Set the server address\".\n"
    ;;
  remove)
    run_elevated "$remove_cmds"
    ;;
  show)
    printf "${BOLD}Run this in an Administrator PowerShell on Windows:${NC}\n\n"
    printf "  %s\n\n" "${add_cmds//; /$'\n  '}"
    printf "Then, in the app: login screen → \"Can't connect? Set the server address\"\n"
    printf "  → ${BOLD}http://%s:%s${NC}\n\n" "$WIN_IP" "$BACKEND_PORT"
    printf "To undo it later:  bash scripts/wsl-expose.sh --remove\n"
    printf "To do it from here: bash scripts/wsl-expose.sh --apply\n\n"
    printf "${BOLD}Two alternatives that need no port forwarding:${NC}\n"
    printf "  • Mirrored networking — put 'networkingMode=mirrored' under [wsl2] in\n"
    printf "    %%USERPROFILE%%\\\\.wslconfig, then 'wsl --shutdown'. WSL then shares the\n"
    printf "    Windows network stack, and %s reaches both ports directly.\n" "$WIN_IP"
    printf "  • 'npx expo start --tunnel' routes Metro through a public relay, which\n"
    printf "    gets the JS bundle to the phone — but the backend still needs one of\n"
    printf "    the routes above, since the app calls it directly.\n"
    ;;
esac
