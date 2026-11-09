#!/usr/bin/env bash
# New, empty deployments only; never run to migrate an existing database.
set -euo pipefail
umask 077
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
for cmd in docker openssl python3; do
  command -v "$cmd" >/dev/null || { echo "Missing prerequisite: $cmd" >&2; exit 1; }
done
docker compose version >/dev/null
if [[ -e .env ]]; then echo 'Refusing to overwrite existing .env. Follow docs/docker-deployment.md instead.' >&2; exit 1; fi
read -r -p 'Server LAN IPv4 address: ' LAN_IP
python3 - "$LAN_IP" <<'PY'
import ipaddress,sys
try:
    ip=ipaddress.ip_address(sys.argv[1])
    if ip.version != 4 or not ip.is_private or ip.is_loopback: raise ValueError()
except ValueError:
    sys.exit('Use a private non-loopback IPv4 address.')
PY
read -r -p 'Certificate DNS name [securelan.internal]: ' DNS_NAME
DNS_NAME="${DNS_NAME:-securelan.internal}"
if [[ ! "$DNS_NAME" =~ ^[A-Za-z0-9][A-Za-z0-9.-]*$ ]]; then echo "Invalid DNS name" >&2; exit 1; fi
TLS_DIR="${SECURELAN_SETUP_TLS_DIR:-$HOME/.local/share/securelan/tls}"
CA_DIR="${TLS_DIR}.ca"
if [[ -e "$TLS_DIR" || -e "$CA_DIR" ]]; then echo "Certificate folder already exists; refusing overwrite." >&2; exit 1; fi
mkdir -p "$(dirname "$TLS_DIR")"
DB_PASSWORD="$(openssl rand -hex 32)"
P12_PASSWORD="$(openssl rand -hex 32)"
echo 'Create and remember a passphrase for the encrypted CA key:'
bash "$ROOT/infrastructure/tls/create-ca.sh" "$CA_DIR"
export SECURELAN_P12_PASSWORD="$P12_PASSWORD"
bash "$ROOT/infrastructure/tls/issue-server-certificate.sh" "$CA_DIR" "$TLS_DIR" "$DNS_NAME" "$LAN_IP"
unset SECURELAN_P12_PASSWORD
# Server container runs with uid 10001, and needs read access to the keystore.
if [[ "$(id -u)" == 0 ]]; then chown 10001:10001 "$TLS_DIR/server.p12"
else sudo chown 10001:10001 "$TLS_DIR/server.p12"; fi
chmod 400 "$TLS_DIR/server.p12" 2>/dev/null || sudo chmod 400 "$TLS_DIR/server.p12"
chmod 644 "$TLS_DIR/ca.crt.pem"
cat > .env <<EOF
POSTGRES_DB=securelan
POSTGRES_USER=securelan
POSTGRES_PASSWORD=$DB_PASSWORD
SERVER_SSL_KEY_STORE_PASSWORD=$P12_PASSWORD
SECURELAN_TLS_KEYSTORE=$TLS_DIR/server.p12
SECURELAN_CA_CERT=$TLS_DIR/ca.crt.pem
SECURELAN_TLS_HOSTNAME=$DNS_NAME
SECURELAN_HTTPS_BIND_ADDRESS=0.0.0.0
SECURELAN_HTTPS_PORT=8080
CORS_ALLOWED_ORIGINS=http://tauri.localhost,tauri://localhost
SESSION_LIFETIME=7d
EOF
chmod 600 .env
docker compose --env-file .env config --quiet
printf '\nConfiguration ready. Start with: docker compose --env-file .env up -d --build\n'
printf 'Verify: docker compose --env-file .env ps\n'
printf 'Certificate CA path: %s/ca.crt.pem\n' "$TLS_DIR"
printf 'Move the CA signing key from %s into offline storage. Never copy it to client computers.\n' "$CA_DIR"
printf 'See docs/fresh-machine-setup.md for first administrator and client setup.\n'
