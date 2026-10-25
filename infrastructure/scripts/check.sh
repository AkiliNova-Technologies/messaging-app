#!/usr/bin/env bash
set -euo pipefail
repo_dir="$(cd "$(dirname "$0")/../.." && pwd)"
npm --prefix "$repo_dir/desktop" run lint
npm --prefix "$repo_dir/desktop" run typecheck
npm --prefix "$repo_dir/desktop" run build
"$repo_dir/server/mvnw" -f "$repo_dir/server/pom.xml" test
