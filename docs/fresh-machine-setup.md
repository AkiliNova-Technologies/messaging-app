# Fresh-machine setup (Docker / Ubuntu)

This guide is only for a **new, empty** SecureLAN server. For any existing instance, follow [the migration and backup runbook](docker-deployment.md). Do not delete an existing PostgreSQL volume.

## Server computer

Install Docker Engine, the Docker Compose v2 plugin, Python 3, OpenSSL and Git. Reserve a private LAN IPv4 address on your router; restrict inbound TCP 8080 to the trusted LAN and never expose PostgreSQL or forward 8080 to the internet.

From the repository root, run:

```bash
bash infrastructure/docker/setup-new-server.sh
docker compose --env-file .env up -d --build
docker compose --env-file .env ps
docker compose --env-file .env logs --tail=100 securelan-server
```

The script prompts for the server's LAN IP and a CA key passphrase, creates an IP/DNS SAN certificate, generates strong database and TLS keystore passwords, stores the secrets only in the ignored root `.env` with mode 0600, and sets file access for container UID 10001. It refuses to overwrite an existing `.env` or CA. The CA **private key** must be moved to offline storage; only `ca.crt.pem` is distributed to clients.

## First administrator

The database must be healthy. Temporarily stop the regular app server, then run the one-time interactive bootstrap:

```bash
docker compose --env-file .env stop securelan-server
docker compose --env-file .env up -d securelan-db
docker compose --env-file .env run --rm -it --no-deps --entrypoint java securelan-server \
  -jar /app/securelan-server.jar --securelan.bootstrap-admin=true
# After seeing "Administrator created", press Ctrl+C to end the one-off process.
docker compose --env-file .env up -d securelan-server
```

Passwords are prompted interactively rather than passed as command arguments. Bootstrap refuses to run a second time once an administrator exists.

## Second computer

Install the **public** CA certificate from the server's `~/.local/share/securelan/tls/ca.crt.pem` into the client OS trust store. On Ubuntu, copy it to `/usr/local/share/ca-certificates/securelan-org-ca.crt` and run `sudo update-ca-certificates`. Connect through HTTPS to the precise LAN IP included in the certificate SAN using port 8080; never choose plaintext HTTP for remote clients. Confirm access:

```bash
curl --fail --cacert /path/to/ca.crt.pem https://SERVER_LAN_IP:8080/api/v1/health
```

Sign in with different accounts on two desktops and verify conversation history, real-time text exchange, attachments, and message persistence after a container restart. Attachments are currently limited to 8 MiB and require an active server connection; attachment **content** is not cached for offline access. TLS is enabled, but this is not end-to-end encryption.

To inspect problems: `docker compose --env-file .env ps` and `docker compose --env-file .env logs --tail=200 securelan-server`. Never run `docker compose down --volumes` on an instance holding messages.
