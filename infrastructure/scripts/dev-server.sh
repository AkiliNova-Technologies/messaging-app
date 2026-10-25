#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../../server"
exec ./mvnw spring-boot:run
