#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../../desktop"
exec npm run tauri dev
