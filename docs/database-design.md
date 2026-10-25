# Database design

The central PostgreSQL database is `securelan_dev` in development. Flyway owns schema evolution and Hibernate runs in `validate` mode; `ddl-auto=update` is prohibited. Phase 0 intentionally defines no application tables because there are no business entities yet. Flyway creates only its own schema history metadata when the server first starts.

The desktop SQLite database is `securelan.db`, resolved relative to Tauri's application data directory. Migration 1 creates only `app_metadata`. Future message, sync, and key schemas must follow the approved offline synchronization and encryption designs.
