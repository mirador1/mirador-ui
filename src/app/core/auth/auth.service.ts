/**
 * AuthService — Manages JWT authentication state (access + refresh tokens).
 *
 * Stores both tokens in reactive signals and localStorage for persistence.
 * The `isAuthenticated` computed signal drives UI visibility (nav guards, login redirect).
 * Access token is attached to HTTP requests by the `authInterceptor`.
 * Refresh token is used to obtain a new access token when the current one expires.
 */
import { Injectable, signal, computed } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _accessToken = signal<string | null>(localStorage.getItem('jwt'));
  private readonly _refreshToken = signal<string | null>(localStorage.getItem('refreshToken'));

  readonly token = this._accessToken.asReadonly();
  readonly refreshToken = this._refreshToken.asReadonly();
  readonly isAuthenticated = computed(() => !!this._accessToken());

  readonly isAdmin = computed(() => {
    const token = this._accessToken();
    if (!token) return false;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const role = (payload['role'] as string) ?? '';
      return role === 'ROLE_ADMIN' || role === 'ADMIN';
    } catch {
      return false;
    }
  });

  setTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem('jwt', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    this._accessToken.set(accessToken);
    this._refreshToken.set(refreshToken);
  }

  /** @deprecated Use setTokens() instead — kept for backward compatibility */
  setToken(token: string): void {
    localStorage.setItem('jwt', token);
    this._accessToken.set(token);
  }

  logout(): void {
    localStorage.removeItem('jwt');
    localStorage.removeItem('refreshToken');
    this._accessToken.set(null);
    this._refreshToken.set(null);
  }
}
