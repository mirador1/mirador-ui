# Setting up a fresh Auth0 tenant for Mirador

> **When to follow this** — the existing tenant has an unrecoverable dashboard
> issue (persistent "Oops! something went wrong"), you're onboarding a new
> developer with their own Auth0 free-tier account, or you want to isolate
> a demo environment from production-ish config.

The UI holds **2 tenant-specific values** (domain + clientId) in
[`src/app/app.config.ts`](../../src/app/app.config.ts) at the top as named
constants. The backend reads 3 env vars (`AUTH0_DOMAIN`, `AUTH0_ISSUER_URI`,
`AUTH0_AUDIENCE`). That's the whole surface you need to change.

## 1. Create the Auth0 tenant

1. Sign in at <https://manage.auth0.com> (free tier covers 7 500 MAU).
2. Top-left tenant dropdown → **Create Tenant**.
3. Pick a region close to your user base (US / EU / AU). Region is
   baked into the tenant domain — `dev-xxxxxxxx.us.auth0.com` vs
   `dev-xxxxxxxx.eu.auth0.com`.
4. Environment: **Development**. You'll recreate later for prod if needed.

## 2. Create the Application (Single Page Application)

1. Left nav → **Applications** → **Applications** → **+ Create Application**.
2. Name: `Mirador UI` (any name).
3. Type: **Single Page Web Applications** — REQUIRED. The Auth0 Angular SDK
   uses PKCE *(Proof Key for Code Exchange — the auth flow where the browser
   proves it's the same client that started the flow without needing a
   client secret)*. Any other type (Regular Web / Native / M2M) rejects
   PKCE requests with "Oops".
4. **Create** — lands on the Settings tab.

## 3. Fill the Application URIs

In **Settings** tab, scroll to **Application URIs** section. Add:

| Field | Value | Why |
|---|---|---|
| Allowed Callback URLs | `http://localhost:4200` | Auth0 compares string-for-string against `redirect_uri` sent by the SDK. No trailing slash. |
| Allowed Logout URLs | `http://localhost:4200` | Used by `authService.logout({ returnTo })`. |
| Allowed Web Origins | `http://localhost:4200` | CORS allowlist for the silent token renewal iframe. |

Multiple entries in the same field use commas (no newlines):
`http://localhost:4200, https://mirador.example.com` for local + prod.

Scroll to the very bottom → **Save Changes**. The rest of the Settings
page can stay on defaults.

## 4. Create the API

Auth0 Access Tokens default to **opaque** — a string that only Auth0's
userinfo endpoint can decode. We need a **JWT** the backend can validate
locally. That requires an API registration.

1. Left nav → **Applications** → **APIs** → **+ Create API**.
2. Name: `Mirador API`.
3. Identifier: **`https://mirador-api`** — this is the EXACT string the
   Mirador code expects (`AUTH0_AUDIENCE` constant + backend env var).
   Don't change it unless you also change both sides.
4. JSON Web Token (JWT) Profile: **Auth0**.
5. JWT Signing Algorithm: **RS256** (public-key crypto — the backend
   fetches the public key from `/.well-known/jwks.json`).
6. **Create** — lands on the API's Settings page.

## 5. Authorize the Application on the API

Without this, even the correct `redirect_uri` + correct API fails with
`access_denied` after login.

1. Still on the API page → **Machine to Machine Applications** tab.
2. Find your `Mirador UI` application in the list → toggle it **Authorized**.
3. No scopes needed (blank is fine — the UI doesn't request extra scopes).
4. **Update** (blue button bottom-right of the expanded row).

## 6. Note the values you'll need

From the **Application Settings** tab (section "Basic Information"):

- **Domain** → copy the string like `dev-abc123xyz.us.auth0.com` (no
  `https://`, no trailing slash).
- **Client ID** → copy the 32-char string.

The API identifier you already know: `https://mirador-api`.

## 7. Wire the UI

[`src/app/app.config.ts`](../../src/app/app.config.ts) — replace the two
constants at the top of the file:

```typescript
const AUTH0_DOMAIN = 'dev-abc123xyz.us.auth0.com';     // ← your new domain
const AUTH0_CLIENT_ID = 'NEW_32_CHAR_CLIENT_ID_HERE';   // ← your new clientId
const AUTH0_AUDIENCE = 'https://mirador-api';           // stays unchanged
```

Rebuild: `npm start` (dev) or `npm run build -- --configuration production`
(prod). Reload the browser.

## 8. Wire the backend (mirador-service)

[`docker-compose.yml`](https://gitlab.com/mirador1/mirador-service/-/blob/main/docker-compose.yml)
— set three environment variables on the `mirador` service:

```yaml
environment:
  AUTH0_DOMAIN: dev-abc123xyz.us.auth0.com
  AUTH0_ISSUER_URI: https://dev-abc123xyz.us.auth0.com/   # TRAILING SLASH required
  AUTH0_AUDIENCE: https://mirador-api
```

The trailing slash on the issuer URI is mandatory — Auth0 puts that slash
in the JWT `iss` claim, and Spring Security does a string-compare. One-off
typo = every token rejected.

Restart the backend (`docker compose up -d mirador` or `mvn spring-boot:run`
with the vars exported).

## 9. Test the round-trip

1. Open <http://localhost:4200/login>.
2. Click **Continue with Auth0**.
3. You should land on the Auth0 Universal Login (the tenant's branded
   login form) — NOT "Oops! something went wrong".
4. Sign up or sign in with an Auth0 user (create one via the dashboard
   → User Management → Users → + Create User if the tenant is empty).
5. Auth0 redirects back to `http://localhost:4200` with a `code=...` query
   param, the SDK exchanges it for a JWT, `Auth0BridgeService` copies the
   token into `AuthService`, dashboard loads.

## Troubleshooting

**"Oops! something went wrong" at Auth0 right after clicking the button**

- Check: exact URL in the browser address bar. If it's at
  `https://dev-xxx.us.auth0.com/authorize?...`, click View Source or
  inspect the `<meta name="error">` tag — Auth0 often embeds the real
  error there even when the visible page says "Oops".
- Most common cause: `redirect_uri` in the URL doesn't match the allowlist.
  Step 3 above, exactly as written.
- Second cause: Application type is not "Single Page Web Application".
  Check the icon next to the app name in the dashboard — there's a little
  SPA emblem on SPAs. If you see a server emblem instead, delete and
  recreate.

**Login works but backend says 401**

- Backend logs → look for "Invalid token" / "audience mismatch" / "iss
  mismatch".
- Verify `AUTH0_ISSUER_URI` has the trailing slash.
- Verify `AUTH0_AUDIENCE` matches the API identifier exactly.

**401 from `/actuator/prometheus`, `/customers`, etc. after a green
Auth0 sign-in**

- The token is valid but has no role claim. By default the Auth0 SDK
  only requests `openid profile email` — which Mirador's
  `JwtAuthenticationFilter` treats as ROLE_USER. If you need ROLE_ADMIN
  (for chaos endpoints, etc.), add a **Rules** or **Actions** step in
  Auth0 that injects the `https://mirador/roles` claim. Example script
  is in <https://gitlab.com/mirador1/mirador-service/-/blob/main/docs/api/auth0-action-roles.js>.

## Related

- [`src/app/app.config.ts`](../../src/app/app.config.ts) — UI Auth0 setup.
- [`src/app/core/auth/auth0-bridge.service.ts`](../../src/app/core/auth/auth0-bridge.service.ts)
  — bridges Auth0 tokens into AuthService.
- mirador-service [`src/main/java/com/mirador/auth/KeycloakConfig.java`](https://gitlab.com/mirador1/mirador-service/-/blob/main/src/main/java/com/mirador/auth/KeycloakConfig.java)
  — backend JWT validator.
- mirador-service [ADR-0018 — JWT strategy](https://gitlab.com/mirador1/mirador-service/-/blob/main/docs/adr/0018-jwt-strategy-hmac-refresh-rotation.md).
