#!/usr/bin/env bash
#
# lan-ip.sh — best-guess LAN IPv4 address for this machine, printed to stdout.
#
# Used by ensure-env.sh to fill frontend/.env's EXPO_PUBLIC_API_URL: a phone
# on the same network reaches the backend here, never at "localhost" (which
# on the phone means the phone itself).
#
# Asks the routing table which interface would carry traffic to the internet,
# rather than scanning every interface — that's what reliably picks the real
# Wi-Fi/Ethernet interface over a VPN tunnel or a Docker bridge, both of which
# also have a real IPv4 address but aren't reachable from a phone on the LAN.
# No packet actually has to leave the machine for this to work (route lookups
# just consult the local routing table), so it works offline too, as long as
# a default route exists at all.
#
# Prints one IPv4 address and exits 0, or prints nothing and exits 1 if none
# was found.

set -uo pipefail

detect_macos() {
  local iface
  iface="$(route -n get 1.1.1.1 2>/dev/null | awk '/interface:/{print $2}')"
  [ -n "$iface" ] || return 1
  ipconfig getifaddr "$iface" 2>/dev/null
}

detect_linux() {
  local ip
  ip="$(ip route get 1.1.1.1 2>/dev/null | awk '{for (i=1;i<=NF;i++) if ($i=="src") {print $(i+1); exit}}')"
  if [ -n "$ip" ]; then
    printf '%s' "$ip"
    return 0
  fi
  # Fallback for minimal images without `ip route get` output in that shape.
  hostname -I 2>/dev/null | awk '{print $1}'
}

result=""
case "$(uname -s)" in
  Darwin*) result="$(detect_macos)" ;;
  Linux*)  result="$(detect_linux)" ;;
  *)       result="" ;;
esac

[ -n "$result" ] || exit 1
printf '%s' "$result"
