#!/usr/bin/env bash
# Rebuild and restart after new code lands (via `npm run deploy` from the PC, or git pull).
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
npm ci
npm run build
sudo systemctl restart wall-calendar
echo "Deployed $(git log -1 --format='%h %s')"
