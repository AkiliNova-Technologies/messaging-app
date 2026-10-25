# Security design

## Implemented through Phase 1A

- Spring Security remains enabled; only the public health/probe endpoints are anonymous.
- CORS uses an explicit configurable origin list rather than a wildcard.
- Credentials are externalized and detailed Actuator health output is hidden.
- Tauri has a restrictive CSP, no shell permission, and only core/default plus SQL permissions.
- The server defaults to loopback binding; PostgreSQL is not exposed by this project.
- The systemd template runs as a non-root account with basic sandboxing.
- Passwords use BCrypt cost 12. Sessions use 256-bit opaque random credentials and persist only SHA-256 hashes.
- Expiry, revocation, active status, and roles are enforced server-side on every authenticated request.
- Tokens are stored in the OS credential store (Linux Secret Service); React never receives them and authenticated HTTP is Rust-mediated.
- Offline logout removes active access and queues a revocation-only keyring credential for the next connection.
- Non-loopback authentication requires HTTPS with normal certificate and hostname validation against native trust roots.
- Server startup rejects TLS-disabled non-loopback and wildcard bindings. TLS listeners permit TLS 1.2 and TLS 1.3 only.
- Desktop credentials are keyed by a hash of the normalized server origin; changing hostname, IP, scheme, or port cannot send a token to the new identity.

## Planned

- Account/device authentication, authorization, rotation, and revocation.
- Audited end-to-end message and attachment encryption with authenticated metadata.
- Protected key storage, encrypted local data, encrypted backups, and secure restore.

## Known limitations

Connection preferences are non-sensitive and stored in WebView local storage. SQLite remains unencrypted and must not store messages, credentials, or keys. Linux requires a functioning Secret Service provider. The repository provides operator-invoked OpenSSL tooling but never creates keys automatically or changes a client trust store. Previous server-scoped credentials remain in the OS keyring when switching servers, but are inaccessible to and never transmitted to the new origin.
