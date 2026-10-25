# Development roadmap

1. Phase 0: foundation and connectivity (this repository state).
2. Phase 1 recommendation: specify trust boundaries, identity model, authenticated TLS, account lifecycle, and the message/envelope data model; then implement authentication and device enrollment.
3. Phase 2: conversation/message persistence and authenticated WebSocket delivery.
4. Phase 3: durable offline queue and deterministic synchronization.
5. Phase 4: reviewed end-to-end encryption and encrypted attachments.
6. Phase 5: protected backups, operational hardening, packaging, and deployment.

Each security phase should include abuse cases, migrations, tests, and a recovery/revocation story before implementation.
