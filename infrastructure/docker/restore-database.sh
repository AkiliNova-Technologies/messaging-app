#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 || ! -f $1 || ! -f $2 ]]; then
  echo "Usage: $0 /absolute/path/to/docker.env /absolute/path/to/securelan.dump" >&2
  exit 1
fi
case $1:$2 in /*:/*) ;; *) echo "Both paths must be absolute." >&2; exit 1 ;; esac

repository=$(cd "$(dirname "$0")/../.." && pwd)
compose=(docker compose --project-directory "$repository" --env-file "$1" -f "$repository/compose.yaml")

if [[ -n $("${compose[@]}" ps --status running --quiet securelan-server) ]]; then
  echo "Refusing restore while securelan-server is running." >&2
  exit 1
fi
"${compose[@]}" up -d securelan-db
"${compose[@]}" exec -T securelan-db sh -ceu '
  until pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" -h 127.0.0.1; do sleep 1; done
  count=$(psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT count(*) FROM pg_tables WHERE schemaname NOT IN ('"'"'pg_catalog'"'"','"'"'information_schema'"'"')")
  test "$count" = 0 || { echo "Refusing to restore into a non-empty database." >&2; exit 1; }
'
"${compose[@]}" exec -T securelan-db sh -ceu '
  exec pg_restore --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --no-owner --no-privileges --exit-on-error
' <"$2"
echo "Restore completed. Run the documented count and Flyway verification before starting the backend."
