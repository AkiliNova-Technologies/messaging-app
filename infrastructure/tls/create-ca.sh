#!/usr/bin/env bash
set -euo pipefail
umask 077

if [[ $# -ne 1 ]]; then echo "Usage: $0 <new-ca-directory>" >&2; exit 64; fi
ca_dir=$1
if [[ -e "$ca_dir" ]]; then echo "Refusing to overwrite existing CA directory: $ca_dir" >&2; exit 1; fi
mkdir -m 700 "$ca_dir"
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:4096 -aes-256-cbc -out "$ca_dir/ca.key.pem"
openssl req -x509 -new -sha384 -days 3650 -key "$ca_dir/ca.key.pem" -out "$ca_dir/ca.crt.pem" \
  -subj "/O=SecureLAN Organization/CN=SecureLAN Offline Root CA" \
  -addext "basicConstraints=critical,CA:TRUE,pathlen:0" \
  -addext "keyUsage=critical,keyCertSign,cRLSign" \
  -addext "subjectKeyIdentifier=hash"
chmod 600 "$ca_dir/ca.key.pem" "$ca_dir/ca.crt.pem"
echo "Offline CA created. Move ca.key.pem to offline storage; distribute only ca.crt.pem."
