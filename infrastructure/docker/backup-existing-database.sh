#!/usr/bin/env bash
set -euo pipefail
umask 077

if [[ $# -ne 1 || ! -f $1 ]]; then
  echo "Usage: $0 /absolute/path/to/source-database.env" >&2
  exit 1
fi
case $1 in /*) ;; *) echo "The source environment path must be absolute." >&2; exit 1 ;; esac

set -a
# shellcheck disable=SC1090
source "$1"
set +a
: "${PGHOST:?set PGHOST}"
: "${PGPORT:=5432}"
: "${PGDATABASE:?set PGDATABASE}"
: "${PGUSER:?set PGUSER}"
: "${PGPASSWORD:?set PGPASSWORD}"

backup_directory=${SECURELAN_BACKUP_DIRECTORY:-"$(pwd)/backups"}
mkdir -p "$backup_directory"
stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup="$backup_directory/securelan-$stamp.dump"

pg_dump --format=custom --no-owner --no-privileges --file="$backup"
pg_restore --list "$backup" >/dev/null
sha256sum "$backup" >"$backup.sha256"
echo "Verified logical backup: $backup"
echo "Keep this backup and the original database until cutover acceptance."
