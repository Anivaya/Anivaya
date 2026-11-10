#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
# Schedule on the server only after the first restore drill succeeds.
exec 9>/tmp/anivaya-backup.lock
flock -n 9 || exit 1
snapshot="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
docker compose stop api
trap 'docker compose start api' EXIT HUP INT TERM
docker compose run --rm --no-deps api node scripts/backup.ts create /data "/backups/$snapshot" --offline
printf 'Verified backup: %s\n' "$snapshot"
