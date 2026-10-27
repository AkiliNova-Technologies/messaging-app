# SecureLAN Docker deployment and migration

This deployment replaces the Spring Boot and PostgreSQL system services with Docker Compose on the designated server computer. Tauri remains a native desktop application. The existing systemd assets are retained only as a rollback path until container acceptance; do not run the old backend and the container backend against the same writable database.

## Security and layout

- `securelan-db` uses PostgreSQL 17 and a named `securelan_pgdata` volume. It has no host port and joins only the internal `database` network.
- `securelan-server` joins the database and LAN-facing networks and publishes only container port 8080.
- The backend runs as UID/GID 10001 with a read-only root filesystem, all capabilities dropped, `no-new-privileges`, bounded processes/memory/CPU, and a no-execute temporary filesystem.
- The existing PKCS#12 keystore and public organizational CA certificate are bind-mounted read-only. Neither is copied into the image. The CA private key must remain offline.
- HTTPS health checks validate the certificate chain and exact `SECURELAN_TLS_HOSTNAME`. There is no plaintext or certificate-bypass health endpoint.
- Secrets live in the operator-owned `infrastructure/docker/.env` with mode `0600`. Compose interpolation injects them at runtime; they are not image layers or desktop configuration.

Docker daemon membership is effectively root-equivalent. Do not add ordinary desktop users to the `docker` group. An authorized operator manages Compose. Containers start at boot through Docker's `restart: unless-stopped`; closing Tauri does not affect them.

## Prepare configuration

From the repository root:

```bash
cp infrastructure/docker/.env.example infrastructure/docker/.env
chmod 0600 infrastructure/docker/.env
sudoedit infrastructure/docker/.env
docker compose --env-file infrastructure/docker/.env config --quiet
```

Use an absolute keystore path, an absolute path to the public CA certificate, and a health-check hostname that exactly matches a DNS SAN in the certificate. The container process (UID 10001) must be able to read both mounted files. Do not put the CA signing key in either path.

## Build and lifecycle commands

```bash
# Build without starting anything
docker compose --env-file infrastructure/docker/.env build securelan-server

# Start the database alone for a restore
docker compose --env-file infrastructure/docker/.env up -d securelan-db

# Start the accepted deployment
docker compose --env-file infrastructure/docker/.env up -d

# State and health
docker compose --env-file infrastructure/docker/.env ps
docker inspect --format '{{.State.Health.Status}}' securelan-securelan-server-1

# Logs (environment secrets are not printed by the application)
docker compose --env-file infrastructure/docker/.env logs --tail=200 securelan-server

# Restart only the backend
docker compose --env-file infrastructure/docker/.env restart securelan-server

# Stop containers without deleting the database volume
docker compose --env-file infrastructure/docker/.env stop

# Update after reviewing source changes
docker compose --env-file infrastructure/docker/.env build securelan-server
docker compose --env-file infrastructure/docker/.env up -d --no-deps securelan-server
```

Never use `docker compose down --volumes` for this deployment. A normal `down` retains the named volume, but `stop` is preferred during initial acceptance.

## Safe migration of the existing PostgreSQL database

Migration is an explicit maintenance operation. Do not execute it while either backend can write to the source or target. The commands below are a runbook, not part of `docker compose up`.

### 1. Inspect and record the source

Create an operator-only file outside the repository, such as `/root/securelan-source.env`:

```text
PGHOST=127.0.0.1
PGPORT=5432
PGDATABASE=securelan_dev
PGUSER=securelan
PGPASSWORD=replace-with-current-password
SECURELAN_BACKUP_DIRECTORY=/secure/backups/securelan
```

Set mode `0600`. While the existing backend is still available, record baseline Flyway rows and counts without printing message contents:

```bash
set -a; source /root/securelan-source.env; set +a
psql -X -v ON_ERROR_STOP=1 -f infrastructure/docker/verify-database.sql
```

### 2. Schedule and enforce a write outage

Obtain explicit cutover approval. Stop the existing backend only—not PostgreSQL—and verify no old backend process remains. Do not start the container backend yet. This is the only way to make the logical backup a consistent cutover point.

### 3. Back up and verify readability

```bash
infrastructure/docker/backup-existing-database.sh /root/securelan-source.env
sha256sum --check /secure/backups/securelan/securelan-YYYYMMDDTHHMMSSZ.dump.sha256
pg_restore --list /secure/backups/securelan/securelan-YYYYMMDDTHHMMSSZ.dump >/dev/null
```

The backup helper uses PostgreSQL's custom format, restrictive file permissions, `--no-owner`, and `--no-privileges`. Preserve the original database and backup after acceptance.

### 4. Restore only into an empty container database

The restore helper refuses to proceed if the backend container is running or if the target contains application tables:

```bash
infrastructure/docker/restore-database.sh \
  "$PWD/infrastructure/docker/.env" \
  /secure/backups/securelan/securelan-YYYYMMDDTHHMMSSZ.dump
```

It never drops or cleans objects. A failed partial restore requires operator investigation; do not automatically delete the volume or rerun against a non-empty target.

### 5. Verify before starting the backend

```bash
docker compose --env-file infrastructure/docker/.env exec -T securelan-db \
  sh -ceu 'psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  < infrastructure/docker/verify-database.sql
```

Compare every relation count and Flyway history row with the source baseline. Then start the backend and confirm that Flyway validates rather than recreates schema:

```bash
docker compose --env-file infrastructure/docker/.env up -d securelan-server
docker compose --env-file infrastructure/docker/.env ps
docker compose --env-file infrastructure/docker/.env logs --tail=200 securelan-server
curl --fail --cacert /path/to/ca.crt.pem \
  https://securelan.office.example:8080/api/v1/health
```

Sign in with existing accounts, compare conversation/message history, send an isolated test message, verify WebSocket delivery from a second authorized client, restart `securelan-server`, and verify the message remains. Restart the database container and verify the named volume retains all counts. Do not test by changing or deleting production messages.

After acceptance, disable the old systemd backend so it cannot contend for port 8080. Keep its files and the original PostgreSQL data intact until the rollback window closes. Removing either requires separate approval.

## LAN and TLS preparation

Give the server a DHCP reservation and preferably a stable local DNS name. Every hostname or IP entered by clients must be present in the certificate SAN list. Docker does not provide LAN DNS for desktop clients.

Allow inbound TCP 8080 only from the trusted LAN subnet. Do not expose 5432. Each Ubuntu client must explicitly trust the public organizational CA as documented in `docs/lan-tls-deployment.md`. Validate from a client with:

```bash
getent hosts securelan.office.example
curl --fail --cacert ca.crt.pem https://securelan.office.example:8080/api/v1/health
openssl s_client -connect securelan.office.example:8080 \
  -servername securelan.office.example -verify_return_error </dev/null
```

Internet access is needed only to pull/build images unless images are transferred from an approved registry or offline archive. Runtime messaging, PostgreSQL, HTTPS/WSS, SQLCipher caching, and reconciliation remain LAN-local.

## Desktop behavior

`CLIENT_DESKTOP` remains the default. `SERVER_DESKTOP` is informational and performs the same certificate-validated readiness check, but no Tauri command launches Java, systemd, Compose, or arbitrary processes. If containers are unavailable, the normal encrypted offline-cache policy applies. Docker's boot restart policy is responsible for automatic server availability.

The server origin, certificate trust, authentication, WebSocket connection, cache identity, and offline authorization logic are unchanged.
