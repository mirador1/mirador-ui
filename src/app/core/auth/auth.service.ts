/**
 * AuthService — Manages JWT authentication state (access + refresh tokens).
 *
 * Stores both tokens in reactive signals and localStorage for persistence.
 * The `isAuthenticated` computed signal drives UI visibility (nav guards, login redirect).
 * Access token is attached to HTTP requests by the `authInterceptor`.
 * Refresh token is used to obtain a new access token when the current one expires.
 *
 * This service is part of an Angular 21 zoneless app — all state is signal-based;
 * there is no Zone.js change detection triggering.
 */
import { Injectable, signal, computed } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AuthService {
  /** Mutable signal holding the current JWT access token, or null when logged out. */
  private readonly _accessToken = signal<string | null>(localStorage.getItem('jwt'));

  /** Mutable signal holding the refresh token used to silently renew access tokens. */
  private readonly _refreshToken = signal<string | null>(localStorage.getItem('refreshToken'));

  /** Read-only projection of the access token — consumed by `authInterceptor`. */
  readonly token = this._accessToken.asReadonly();

  /** Read-only projection of the refresh token — consumed by `authInterceptor` on 401. */
  readonly refreshToken = this._refreshToken.asReadonly();

  /**
   * Computed boolean: true when an access token is present (not null/empty).
   * Used by the AppShell to show/hide auth-gated navigation items.
   */
  readonly isAuthenticated = computed(() => !!this._accessToken());

  /**
   * Computed boolean: decodes the JWT payload (base64) and checks for admin role.
   *
   * <p>Supports THREE claim formats depending on the token issuer:
   *
   * <ul>
   *   <li><b>Built-in JWT</b> (admin/admin via POST /auth/login): single-valued
   *       `role` string claim. Accepts both `ROLE_ADMIN` (Spring prefix style)
   *       and `ADMIN` (plain, legacy).</li>
   *   <li><b>Auth0 JWT</b>: namespaced custom claim
   *       `https://mirador-api/roles` (array of strings). Injected by the
   *       "Inject mirador roles" Auth0 Action in the Post-Login flow —
   *       see {@code docs/api/auth0-action-roles.js} in mirador-service.
   *       Namespaced because OIDC reserves top-level claim names.</li>
   *   <li><b>Keycloak JWT</b>: roles are nested under `realm_access.roles`
   *       (array). Same format Spring's JwtAuthenticationFilter reads on
   *       the backend.</li>
   * </ul>
   *
   * <p>Returns false on any parsing error (invalid base64, malformed JSON,
   * missing payload segment) to fail safely — a broken token should lock
   * admin UI, not silently grant access.
   */
  readonly isAdmin = computed(() => {
    const token = this._accessToken();
    if (!token) return false;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));

      // Built-in + Keycloak realm_access.roles + Auth0 namespaced roles —
      // collect every role strings from all known shapes into one flat list.
      const roles: string[] = [];
      if (typeof payload['role'] === 'string') {
        roles.push(payload['role']);
      }
      const realmAccess = payload['realm_access'] as { roles?: unknown } | undefined;
      if (realmAccess && Array.isArray(realmAccess.roles)) {
        roles.push(...realmAccess.roles.filter((r): r is string => typeof r === 'string'));
      }
      const auth0Roles = payload['https://mirador-api/roles'];
      if (Array.isArray(auth0Roles)) {
        roles.push(...auth0Roles.filter((r): r is string => typeof r === 'string'));
      }

      return roles.includes('ROLE_ADMIN') || roles.includes('ADMIN');
    } catch {
      return false;
    }
  });

  /**
   * Store both tokens after a successful login or silent refresh.
   * Persists to localStorage so the session survives a page reload.
   *
   * @param accessToken  Short-lived JWT for API authorization.
   * @param refreshToken Long-lived token used to obtain new access tokens on expiry.
   */
  setTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem('jwt', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    this._accessToken.set(accessToken);
    this._refreshToken.set(refreshToken);
  }

  /**
   * Store only the access token (no refresh token).
   * @deprecated Use setTokens() instead — kept for backward compatibility with older API responses.
   * @param token JWT access token.
   */
  setToken(token: string): void {
    localStorage.setItem('jwt', token);
    this._accessToken.set(token);
  }

  /**
   * Clear both tokens from memory and localStorage, effectively ending the session.
   * Called by the AppShell logout button and by `authInterceptor` after a failed refresh.
   */
  logout(): void {
    localStorage.removeItem('jwt');
    localStorage.removeItem('refreshToken');
    this._accessToken.set(null);
    this._refreshToken.set(null);
  }
}
