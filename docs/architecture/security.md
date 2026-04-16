# Security

Authentication modes, role-based access control, and the deliberately vulnerable demo endpoints used for security education.

## Authentication Modes

A single `JwtAuthenticationFilter` handles all three modes. The active mode is determined at startup by environment variables — no code path changes required.

| Mode | Activation | Token format | Details |
| --- | --- | --- | --- |
| **Simple JWT** | Default (no env var) | HS256 | `POST /auth/login` issues token signed with a configurable secret and expiry. Validated by `JwtTokenProvider`. |
| **Keycloak OAuth2** | `KEYCLOAK_URL` env var set | RS256 | Same filter validates RS256 tokens and extracts roles from `realm_access.roles` claim. |
| **API Key** | Always active in parallel | `X-API-Key` header | `ApiKeyAuthenticationFilter` validates the header value against configured keys before the JWT filter runs. |

## Role-Based Access Control

- **ROLE_USER** — Read-only access: GET endpoints on customer and diagnostic resources.
- **ROLE_ADMIN** — Write access: POST / PUT / DELETE on `/customers` and all `/actuator/**` endpoints.

## Security Demo Endpoints

Public endpoints at `/demo/security/**` deliberately showcase common vulnerabilities side-by-side with their secure counterparts for educational purposes.

- **SQL Injection** — Parameterized query (safe) vs. string-concatenated query (vulnerable)
- **XSS Reflection** — HTML-escaped output (safe) vs. raw unescaped output (vulnerable)
- **CORS Policy** — Demonstrates allowed vs. blocked cross-origin request enforcement
- **IDOR** — Object-level authorization bypass — accessing another user's resource
- **Security Headers** — CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy inspection

---
[← Back to architecture index](README.md)
