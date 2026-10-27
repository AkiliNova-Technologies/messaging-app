# Phase 2A: encrypted cache and backend startup

> Deployment update: `docs/docker-deployment.md` supersedes the systemd startup design below for new server installations. The systemd files remain only for rollback until an approved Docker cutover. Current desktop builds do not invoke systemd or Docker; container availability is managed by Docker's boot-time restart policy.

## Security boundary

The React renderer has no SQL interface and never receives a database key. Rust exposes only typed conversation/message cache commands. Each normalized `(scheme, host, port, authenticated user ID)` pair has a different 256-bit random key in the OS keyring and a different database filename. SQLCipher is compiled into the application; startup checks `cipher_version` and fails closed if encryption or the key is unavailable. There is no plaintext SQLite fallback.

Only server-confirmed conversations and messages are persisted. A successful authoritative conversation listing removes cached conversations no longer visible to the user. Network failure does not perform that removal. Optimistic and failed sends remain memory-only. Server IDs, server sequence numbers, and client request IDs provide deterministic deduplication after reconnect.

Offline restart is allowed only when the same OS account can unlock the keyring and the last successful server authorization is no more than 24 hours old. It is read-only: sending, directory lookup, administration, and password changes remain unavailable. This is a bounded local authorization policy, not proof that the server still authorizes the account. The residual risk is up to 24 hours of cached access after remote disablement; shorten `OFFLINE_AUTHORIZATION_SECONDS` for stricter deployments. Explicit logout closes the cache. Disk/OS-account compromise remains outside the protection provided by an unlocked user keyring.

## Deployment modes

`CLIENT_DESKTOP` is the safe default. The desktop performs a bounded health check but never starts a local server. Set `SECURELAN_DEPLOYMENT_MODE=SERVER_DESKTOP` in the desktop user's operator-managed login environment only on the designated server laptop. In this mode Rust can execute exactly:

```text
/usr/bin/systemctl start securelan-server.service
```

No service name, executable, argument, or shell text comes from the renderer. Readiness is checked over the configured HTTPS origin for at most 10 seconds. The system service is independent of the desktop lifecycle, so closing the UI does not stop it.

## Server-laptop installation

Package the executable Spring Boot JAR and install it from the repository root:

```bash
cd server
./mvnw package
cd ..
sudo infrastructure/systemd/install-securelan-service.sh \
  "$PWD/server/target/messenger-0.0.1-SNAPSHOT.jar"
sudoedit /etc/securelan/server.env
sudo usermod -aG securelan-operators "$USER"
sudo systemctl enable securelan-server.service
```

Use the TLS/database values documented in `docs/lan-tls-deployment.md`. Add `SECURELAN_DEPLOYMENT_MODE=SERVER_DESKTOP` to `/etc/environment`, then log out and back in so the desktop inherits it. The polkit rule permits members of `securelan-operators` only to start this one unit. It does not permit stopping, restarting, editing, or managing other services.

For an ordinary client laptop, do not install the unit or polkit rule and do not set the mode variable.

The initial Ubuntu deployment uses the operating system's Java 21 runtime. For a future self-contained distribution, build and test a pinned vendor JRE or `jlink` runtime in CI, package it beside the JAR, and change only the fixed `ExecStart` Java path. Record the JDK vendor/version and verify the resulting runtime against the executable JAR before rollout.

## Operational checks

```bash
systemctl status securelan-server.service
journalctl -u securelan-server.service
curl --cacert ca.crt.pem https://securelan.office.example:8080/api/v1/health
```

Failure codes shown by the application distinguish an unavailable remote server, service-manager failure, failed unit startup, readiness timeout, missing cache key, expired offline authorization, and cache corruption. Never work around a TLS or cache-key failure by disabling validation or replacing the encrypted database with plaintext storage.
