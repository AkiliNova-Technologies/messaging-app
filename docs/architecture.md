# Architecture

SecureLAN Messenger uses an offline-first client/server architecture. The Tauri desktop application owns the user experience, non-sensitive connection preferences, and eventually an encrypted local working set. The Spring Boot server coordinates organization accounts, conversations, message delivery, synchronization, and shared persistence. PostgreSQL is reachable only by the server.

Phase 0 uses REST for a health probe. Later phases will use authenticated REST for request/response operations and WebSocket connections for live events. A client will write outgoing operations locally, send them when connected, and reconcile server-assigned ordering and acknowledgements after reconnection. Conflict and retention rules must be specified before synchronization is implemented.

SQLite is created in Tauri's application data area through the official SQL plugin. It currently contains only an `app_metadata` table; no message or key schema exists. SQLite does not provide encryption automatically.

End-to-end encryption is a planned boundary between sending and receiving desktop clients. The server should eventually store ciphertext and limited routing metadata. Transport authentication, device identity, key lifecycle, recovery, metadata leakage, attachments, and backup encryption require a separately reviewed protocol before implementation.
