#!/usr/bin/env bash
set -euo pipefail
if [[ $# -lt 3 || $# -gt 4 ]]; then echo "Usage: $0 <ca.crt.pem> <server.crt.pem> <dns-name> [ip-address]" >&2; exit 64; fi
ca_cert=$1; server_cert=$2; dns_name=$3; ip_address=${4:-}
openssl verify -CAfile "$ca_cert" -purpose sslserver -verify_hostname "$dns_name" "$server_cert"
[[ -z "$ip_address" ]] || openssl verify -CAfile "$ca_cert" -purpose sslserver -verify_ip "$ip_address" "$server_cert"
openssl x509 -in "$server_cert" -noout -subject -issuer -serial -dates -ext subjectAltName -ext extendedKeyUsage
if ! openssl x509 -in "$server_cert" -checkend 2592000 -noout; then echo "WARNING: certificate expires within 30 days" >&2; exit 2; fi
