#!/usr/bin/env bash
# Nightly SQLite backup (run by wall-backup.timer). Keeps the newest 14.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
mkdir -p data/backups
sqlite3 data/wall.db ".backup data/backups/wall-$(date +%F).db"
ls -1t data/backups/wall-*.db | tail -n +15 | xargs -r rm --
