# Phase 1A API contracts

All endpoints except health and login require `Authorization: Bearer <opaque-token>`. Errors contain `timestamp`, `status`, `code`, `message`, and `path`.

## Authentication and profiles

- `POST /api/v1/auth/login` — login; the only response that returns a newly created raw token.
- `GET /api/v1/auth/me` — validate the session and return its user.
- `POST /api/v1/auth/logout` and `/logout-all` — revoke one or all owned sessions.
- `POST /api/v1/auth/change-password` — verify the current password, change it, and revoke other sessions.
- `GET/PATCH /api/v1/users/me` — read/update the permitted display name.

## Administration

ADMIN only: `GET/POST /api/v1/admin/users`, `PATCH /api/v1/admin/users/{id}/status`, and `POST /api/v1/admin/users/{id}/reset-password`. Created/reset passwords force a password change and are never returned.

## Health

`GET /api/v1/health`, `/actuator/health/liveness`, and `/actuator/health/readiness` are public probes. No messaging API exists in Phase 1A.
