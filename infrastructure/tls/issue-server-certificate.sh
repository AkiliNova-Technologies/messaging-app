#!/usr/bin/env bash
set -euo pipefail
umask 077

if [[ $# -lt 3 || $# -gt 4 ]]; then echo "Usage: $0 <ca-directory> <new-output-directory> <dns-name> [ip-address]" >&2; exit 64; fi
ca_dir=$1; output_dir=$2; dns_name=$3; ip_address=${4:-}
[[ -f "$ca_dir/ca.key.pem" && -f "$ca_dir/ca.crt.pem" ]] || { echo "CA key/certificate not found" >&2; exit 1; }
if [[ -e "$output_dir" ]]; then echo "Refusing to overwrite existing certificate directory: $output_dir" >&2; exit 1; fi
mkdir -m 700 "$output_dir"
config_file=$(mktemp)
trap 'rm -f "$config_file"' EXIT
san="DNS:$dns_name"
[[ -z "$ip_address" ]] || san="$san,IP:$ip_address"
printf '%s\n' '[req]' 'distinguished_name=dn' 'prompt=no' '[dn]' "CN=$dns_name" '[server_ext]' \
  'basicConstraints=critical,CA:FALSE' 'keyUsage=critical,digitalSignature,keyEncipherment' \
  'extendedKeyUsage=serverAuth' "subjectAltName=$san" 'subjectKeyIdentifier=hash' 'authorityKeyIdentifier=keyid,issuer' > "$config_file"
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out "$output_dir/server.key.pem"
openssl req -new -sha384 -key "$output_dir/server.key.pem" -out "$output_dir/server.csr.pem" -config "$config_file"
openssl x509 -req -sha384 -days 397 -in "$output_dir/server.csr.pem" -CA "$ca_dir/ca.crt.pem" \
  -CAkey "$ca_dir/ca.key.pem" -CAcreateserial -out "$output_dir/server.crt.pem" -extfile "$config_file" -extensions server_ext
cat "$ca_dir/ca.crt.pem" > "$output_dir/ca.crt.pem"
openssl pkcs12 -export -name securelan-server -inkey "$output_dir/server.key.pem" -in "$output_dir/server.crt.pem" \
  -certfile "$ca_dir/ca.crt.pem" -out "$output_dir/server.p12"
chmod 600 "$output_dir/server.key.pem" "$output_dir/server.csr.pem" "$output_dir/server.crt.pem" "$output_dir/server.p12" "$output_dir/ca.crt.pem"
echo "Certificate issued for SANs: $san"
