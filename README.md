# SecureLAN Messenger

SecureLAN Messenger is a cross-platform, offline-first desktop messenger for small organizations on a local network. Phase 1B adds persistent real-time one-to-one text messaging; end-to-end encryption is not implemented.

## Stack and layout

- `desktop/`: Tauri 2, Rust, React 19, TypeScript, Vite, Tailwind CSS, Zustand, Zod, and a minimal shadcn-style UI.
- `server/`: Java 21, Spring Boot 4.1, Spring Security, JPA, Flyway, PostgreSQL, WebSocket support, and Actuator.
- `infrastructure/`: database setup, development scripts, and an uninstalled systemd template.
- `docs/`: architecture, security boundaries, schemas, API contracts, and roadmap.

## Prerequisites

- Node.js 24+ and npm 12+
- Java 21 (Maven is downloaded by the included wrapper)
- Rust 1.90+ and Cargo
- PostgreSQL 17+ server/client
- Tauri Linux libraries: GTK 3, WebKitGTK 4.1, JavaScriptCoreGTK 4.1, libsoup 3, librsvg 2, plus standard build tools

On Ubuntu, consult the current Tauri prerequisite list for your Ubuntu release before installing missing packages. Do not reinstall packages already present.

## Install

```bash
cp .env.example .env
cd desktop
npm install
```

Export values from `.env` in the shell that starts the backend; Spring does not implicitly load dotenv files.

## PostgreSQL development setup

Keep PostgreSQL listening on localhost. As a PostgreSQL administrator, choose a strong local password and run:

```sql
CREATE ROLE securelan LOGIN PASSWORD 'replace-this-local-password';
```

Then execute `infrastructure/database/create-development-database.sql` once. If the role or database already exists, inspect it rather than rerunning the statements. Set `DATABASE_PASSWORD` in an untracked `.env` or export it in your shell. Verify with:

```bash
pg_isready -h 127.0.0.1 -p 5432 -d securelan_dev
```

## Run and validate

Start the backend after exporting configuration:

```bash
set -a; source .env; set +a
cd server && ./mvnw spring-boot:run
```

In a second terminal, launch the desktop window:

```bash
cd desktop && npm run tauri dev
```

Enter `127.0.0.1` and `8080`, then select **Test and save connection**. Direct checks:

```bash
curl http://127.0.0.1:8080/api/v1/health
curl http://127.0.0.1:8080/actuator/health/readiness
```

## First administrator

Run once in an interactive terminal; credentials are prompted and never placed in arguments:

```bash
cd server
./mvnw spring-boot:run -Dspring-boot.run.arguments=--securelan.bootstrap-admin=true
```

Stop after success and restart normally. Bootstrap refuses to run when an administrator exists or when no secure console password prompt is available.

## Secure LAN transport

Remote authentication is blocked over HTTP. Obtain a server certificate from a private organizational CA, install that CA in every client OS trust store, package the server key/certificate as PKCS#12, and set `SERVER_SSL_ENABLED=true`, `SERVER_SSL_KEY_STORE`, and `SERVER_SSL_KEY_STORE_PASSWORD`. Select HTTPS in the desktop and use the certificate hostname. Certificate validation is never disabled.

Loopback HTTP remains available for single-machine development only. LAN authentication is not deployment-ready until this CA provisioning has been completed and verified.

The repeatable Ubuntu CA, certificate, client trust, renewal, and second-laptop procedure is in [docs/lan-tls-deployment.md](docs/lan-tls-deployment.md). Provisioning helpers are under `infrastructure/tls/`; they refuse to overwrite existing CA or certificate directories.

The Phase 1B API, ordering, idempotency, reconnect, and future-encryption boundaries are documented in [docs/phase-1b-messaging.md](docs/phase-1b-messaging.md).

Encrypted local caching, bounded offline access, and the operator-installed server-desktop startup model are documented in [docs/phase-2a-persistence-and-startup.md](docs/phase-2a-persistence-and-startup.md).

Quality/build commands:

```bash
cd desktop
npm run lint
npm run typecheck
npm run build
npm run tauri build

cd ../server
./mvnw test
./mvnw package
```

## Controlled LAN testing

Set `SERVER_HOST=0.0.0.0` only with TLS enabled and allow the actual desktop origins in `CORS_ALLOWED_ORIGINS`. Startup rejects every non-loopback plaintext binding. Find the server's real LAN address with `ip -brief address`; clients must use the DNS name or IP contained in the certificate, never `0.0.0.0`. Limit port 8080 in the host firewall to the trusted subnet. Leave PostgreSQL bound to loopback.

The Rust connection diagnostic verifies the normal TLS chain, validity period, and exact hostname/IP identity through the operating-system trust roots.

## systemd template

`infrastructure/systemd/securelan-server.service` expects a dedicated `securelan` user, a packaged JAR at `/opt/securelan/securelan-server.jar`, writable `/var/lib/securelan`, and a root-owned environment file at `/etc/securelan/server.env`. The repository provides an explicit root-run installer, but neither the build nor the desktop silently installs or enables the service. Review and approve the Phase 2A procedure first.

## Troubleshooting

- Database refused: start PostgreSQL and check `pg_isready`, credentials, and the database name.
- Desktop reports a network error: confirm the server is running, the port/firewall is open, and the desktop origin is explicitly allowed by CORS.
- Port 5173/8080 in use: stop the conflicting process or change both configuration and connection settings.
- Tauri build error: compare installed native libraries with the current Tauri Linux prerequisites.
- Readiness is DOWN while `/api/v1/health` is UP: the process is reachable but PostgreSQL is unavailable or Flyway validation failed.
