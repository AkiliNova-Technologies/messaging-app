# Phase 1B messaging

Phase 1B adds persistent direct text messaging over the existing authenticated HTTPS listener. PostgreSQL is authoritative; WebSocket events are notifications and clients recover from REST history after reconnecting.

## HTTP and WebSocket contract

- `GET /api/v1/users/directory?search=&page=0&size=25`
- `GET /api/v1/conversations?size=50`
- `POST /api/v1/conversations` with `{ "participantId": "uuid" }`
- `GET /api/v1/conversations/{id}`
- `GET /api/v1/conversations/{id}/messages?before={serverSequence}&size=50`
- `POST /api/v1/conversations/{id}/messages` with `clientRequestId`, `payloadType: "TEXT"`, and `text`
- `GET /api/v1/ws`, upgraded to WebSocket with the bearer token in the native opening handshake

The desktop Rust process reads the token from the OS credential store. React receives API responses and versioned events, never the token. Non-loopback connections remain HTTPS/WSS-only and use normal operating-system certificate and hostname verification.

Conversation pairs are canonicalized and protected by a unique database constraint. A conversation row lock assigns increasing sequences. Message idempotency is unique by `(sender_id, client_request_id)` and a PostgreSQL transaction advisory lock makes simultaneous retries deterministic. Reusing an ID with different content or a different conversation returns `409 IDEMPOTENCY_CONFLICT`.

Messages are plaintext application payloads protected in transit by TLS. Future end-to-end encryption belongs at the Rust boundary: encrypt before submitting the payload and decrypt after retrieval/event receipt. The database `payload_type` and opaque payload boundary can be extended for a ciphertext envelope; no custom or placeholder cryptography is present now.

Disabling an account revokes its sessions and closes its active WebSocket connections after that administration transaction commits. Logout also stops the native connection. Reconnect uses bounded exponential backoff (2–32 seconds) and REST reconciliation.

## Local verification

Run `./mvnw test` under `server`, `npm run build` under `desktop`, and `cargo test` under `desktop/src-tauri`. Integration verification requires PostgreSQL so Flyway can apply `V2__create_conversations_and_messages.sql`.
