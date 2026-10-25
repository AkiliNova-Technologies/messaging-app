#!/usr/bin/env bash
set -euo pipefail
if [[ $# -lt 3 || $# -gt 4 ]]; then echo "Usage: $0 <offline-ca-directory> <new-versioned-output-directory> <dns-name> [ip-address]" >&2; exit 64; fi
script_dir=$(cd "$(dirname "$0")" && pwd)
exec "$script_dir/issue-server-certificate.sh" "$@"
