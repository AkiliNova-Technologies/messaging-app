#!/usr/bin/env bash
set -euo pipefail
umask 077
fixture_dir=$(mktemp -d)
trap 'rm -rf "$fixture_dir"' EXIT
openssl req -x509 -newkey rsa:2048 -nodes -sha256 -days 2 -subj '/CN=Test CA' -keyout "$fixture_dir/ca.key" -out "$fixture_dir/ca.crt" >/dev/null 2>&1
openssl req -newkey rsa:2048 -nodes -subj '/CN=securelan.test' -keyout "$fixture_dir/server.key" -out "$fixture_dir/server.csr" >/dev/null 2>&1
printf '%s\n' 'subjectAltName=DNS:securelan.test,IP:192.0.2.10' 'extendedKeyUsage=serverAuth' > "$fixture_dir/ext"
openssl x509 -req -in "$fixture_dir/server.csr" -CA "$fixture_dir/ca.crt" -CAkey "$fixture_dir/ca.key" -CAcreateserial -days 2 -sha256 -extfile "$fixture_dir/ext" -out "$fixture_dir/server.crt" >/dev/null 2>&1
openssl verify -CAfile "$fixture_dir/ca.crt" -verify_hostname securelan.test "$fixture_dir/server.crt"
openssl verify -CAfile "$fixture_dir/ca.crt" -verify_ip 192.0.2.10 "$fixture_dir/server.crt"
if openssl verify -CAfile "$fixture_dir/ca.crt" -verify_hostname wrong.test "$fixture_dir/server.crt" >/dev/null 2>&1; then echo 'hostname mismatch unexpectedly passed' >&2; exit 1; fi
if openssl verify -CAfile /etc/ssl/certs/ca-certificates.crt "$fixture_dir/server.crt" >/dev/null 2>&1; then echo 'untrusted certificate unexpectedly passed' >&2; exit 1; fi
future_epoch=$(( $(date +%s) + 259200 ))
if openssl verify -attime "$future_epoch" -CAfile "$fixture_dir/ca.crt" "$fixture_dir/server.crt" >/dev/null 2>&1; then echo 'expired certificate unexpectedly passed' >&2; exit 1; fi
openssl pkcs12 -export -passout pass:test-only -name securelan-server -inkey "$fixture_dir/server.key" -in "$fixture_dir/server.crt" -certfile "$fixture_dir/ca.crt" -out "$fixture_dir/server.p12"
openssl pkcs12 -in "$fixture_dir/server.p12" -passin pass:test-only -noout -info 2>&1 | grep -q 'MAC:'
echo 'TLS smoke checks passed'
