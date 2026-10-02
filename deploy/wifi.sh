#!/usr/bin/env bash
# Join home Wi-Fi and stop boot from waiting on an unplugged Ethernet cable.
# Usage: sudo ./deploy/wifi.sh "<SSID>"   (prompts for the password)
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Run with sudo: sudo $0 \"<SSID>\"" >&2
  exit 1
fi
SSID="${1:?usage: sudo $0 \"<SSID>\"}"

WIFI_IF=""
ETH_IFS=()
for dev in /sys/class/net/*; do
  name="$(basename "$dev")"
  [[ "$name" == lo || ! -e "$dev/device" ]] && continue
  if [[ -d "$dev/wireless" ]]; then
    WIFI_IF="${WIFI_IF:-$name}"
  else
    ETH_IFS+=("$name")
  fi
done

if [[ -z "$WIFI_IF" ]]; then
  echo "No Wi-Fi adapter found. Check 'ip link' and 'sudo dmesg | grep -i firmware'." >&2
  exit 1
fi

read -rsp "Password for \"$SSID\": " PASS
echo

{
  echo "network:"
  echo "  version: 2"
  if ((${#ETH_IFS[@]})); then
    echo "  ethernets:"
    for e in "${ETH_IFS[@]}"; do
      echo "    $e:"
      echo "      dhcp4: true"
      echo "      optional: true"
    done
  fi
  echo "  wifis:"
  echo "    $WIFI_IF:"
  echo "      dhcp4: true"
  echo "      access-points:"
  echo "        \"$SSID\":"
  echo "          password: \"$PASS\""
} >/etc/netplan/60-wall.yaml
chmod 600 /etc/netplan/60-wall.yaml

netplan generate
netplan apply
echo "Waiting for $WIFI_IF to get an address..."
for i in $(seq 1 30); do
  addr="$(ip -4 -o addr show "$WIFI_IF" | awk '{print $4}')"
  [[ -n "$addr" ]] && { echo "$WIFI_IF is up: $addr"; exit 0; }
  sleep 1
done
echo "No address yet on $WIFI_IF. Check: journalctl -u systemd-networkd -n 50" >&2
exit 1
