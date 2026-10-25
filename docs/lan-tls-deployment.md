# Secure LAN TLS deployment

This procedure uses an offline private CA and requires no internet or cloud service. Run CA signing commands on a protected administrative machine, not on the application server. Never copy `ca.key.pem` to the server or a desktop client.

## 1. Server and PostgreSQL

Use a dedicated Ubuntu account for the service. PostgreSQL should listen on loopback and allow only the SecureLAN role. Give the server a stable DHCP reservation and, when available, a stable local DNS record such as `securelan.office.example`. `.local` depends on mDNS and is not reliable on every network.

Find the intended server address:

```bash
ip -brief address
getent hosts securelan.office.example
```

Choose every identity clients will actually enter. DNS names require DNS SANs and numeric addresses require IP SANs. Changing an IP later requires a newly signed certificate unless clients use an unchanged DNS SAN.

## 2. Create the offline CA once

On the offline administrative machine:

```bash
infrastructure/tls/create-ca.sh /secure/offline/securelan-ca
```

OpenSSL interactively requests encryption for the 4096-bit CA key. The script refuses an existing directory. Back up the encrypted key offline with restricted physical and filesystem access. Distribute only `ca.crt.pem`.

## 3. Issue the server certificate

Create a new versioned output directory. The optional final argument adds an IP SAN:

```bash
infrastructure/tls/issue-server-certificate.sh \
  /secure/offline/securelan-ca \
  /secure/staging/server-2026-10 \
  securelan.office.example \
  192.168.1.100
```

The certificate uses RSA-3072, SHA-384, server-authentication EKU, critical key usage, and explicit SANs. OpenSSL prompts for the encrypted CA key and a new PKCS#12 export password; passwords are never arguments or source files.

Verify before deployment:

```bash
infrastructure/tls/verify-server-certificate.sh \
  /secure/offline/securelan-ca/ca.crt.pem \
  /secure/staging/server-2026-10/server.crt.pem \
  securelan.office.example \
  192.168.1.100

openssl pkcs12 -in /secure/staging/server-2026-10/server.p12 -noout -info
```

Copy only `server.p12` to the server over trusted removable media or an authenticated administrative channel. Do not copy the CA private key or loose server key. On the server:

```bash
sudo install -d -o root -g securelan -m 0750 /etc/securelan/tls
sudo install -o root -g securelan -m 0640 server.p12 /etc/securelan/tls/server.p12
sudo install -d -o root -g securelan -m 0750 /etc/securelan
sudoedit /etc/securelan/server.env
```

Example `/etc/securelan/server.env` (supply real secrets manually):

```text
SERVER_HOST=0.0.0.0
SERVER_PORT=8080
SERVER_SSL_ENABLED=true
SERVER_SSL_KEY_STORE=/etc/securelan/tls/server.p12
SERVER_SSL_KEY_STORE_PASSWORD=replace-interactively
DATABASE_URL=jdbc:postgresql://127.0.0.1:5432/securelan_dev
DATABASE_USER=securelan
DATABASE_PASSWORD=replace-interactively
```

Protect it with `sudo chown root:securelan /etc/securelan/server.env && sudo chmod 0640 /etc/securelan/server.env`. Start the packaged service with `sudo systemctl daemon-reload && sudo systemctl enable --now securelan-server`. Review with `sudo journalctl -u securelan-server` without logging environment values.

The server refuses to start if TLS is disabled while binding to a LAN or wildcard address. It exposes no second plaintext listener. TLS 1.2 and 1.3 are enabled.

## 4. Explicitly trust the CA on each Ubuntu client

Inspect the fingerprint received through a separate trusted channel:

```bash
openssl x509 -in ca.crt.pem -noout -subject -issuer -fingerprint -sha256
```

After an authorized operator verifies it, install it explicitly:

```bash
sudo install -m 0644 ca.crt.pem /usr/local/share/ca-certificates/securelan-org-ca.crt
sudo update-ca-certificates
```

Restart SecureLAN Messenger after changing trust. The application never downloads or trusts a CA automatically and has no trust-on-first-use or certificate-bypass option.

## 5. Connect another laptop

In Server settings choose HTTPS, enter `securelan.office.example` (or exactly `192.168.1.100` when that IP is a SAN), and port `8080`. The native Rust client uses Ubuntu trust roots and validates the certificate chain, validity dates, EKU, and exact DNS/IP SAN. A successful diagnostic confirms server TLS identity; sign-in then confirms an authenticated connection.

Test fully offline by disconnecting the internet uplink while leaving both laptops on the same LAN. Confirm DNS still resolves locally, or use the certified IP SAN. Test health without credentials:

```bash
curl --cacert ca.crt.pem https://securelan.office.example:8080/api/v1/health
openssl s_client -connect securelan.office.example:8080 -servername securelan.office.example -verify_return_error </dev/null
```

## 6. Renewal

Inspect dates regularly:

```bash
openssl x509 -in server.crt.pem -noout -dates
openssl x509 -in server.crt.pem -checkend 2592000 -noout
```

Before expiry, issue into a new directory; existing material is never overwritten:

```bash
infrastructure/tls/renew-server-certificate.sh \
  /secure/offline/securelan-ca \
  /secure/staging/server-2027-10 \
  securelan.office.example \
  192.168.1.100
```

Verify it, atomically replace the server keystore through the administrator workflow, update its password if changed, and restart the service. The CA need not be reinstalled while the same unexpired CA signs the replacement.

## Troubleshooting

- **Certificate not trusted:** install and verify the correct organizational CA, then restart the desktop app.
- **Address does not match:** use a DNS/IP SAN present in the certificate or issue a replacement; never bypass verification.
- **Expired certificate:** renew and restart the server. Do not change client clocks to evade validation.
- **DNS failure:** verify `getent hosts NAME`; use a certified fixed IP when local DNS is unavailable.
- **Connection refused:** check the service, port, host firewall, and selected interface.
- **Invalid keystore:** verify PKCS#12 with OpenSSL, permissions, absolute path, and password. Spring fails closed.
- **Server changed:** the desktop scopes tokens to scheme, host, and port. Sign in separately; the previous token is never sent to the new origin.
