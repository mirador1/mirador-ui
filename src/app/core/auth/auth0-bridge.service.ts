/**
 * Auth0BridgeService — bridges the Auth0 SDK to the existing signal-based AuthService.
 *
 * The existing AuthService (JWT signals + localStorage) drives the authInterceptor
 * and all UI visibility checks. This bridge subscribes to Auth0's authentication state
 * and syncs the access token into AuthService so the rest of the app is unchanged.
 *
 * Why a bridge instead of replacing AuthService?
 * Direct replacement would require touching every component that injects AuthService.
 * The bridge keeps the existing contract intact and makes Auth0 an internal detail.
 *
 * Auth0 SDK handles: PKCE flow, silent token renewal, logout redirects.
 * AuthService signals handle: synchronous auth checks, Bearer header attachment.
 *
 * Must be instantiated early — inject it in the App root component constructor.
 */
import { Injectable, inject } from '@angular/core';
import { AuthService as Auth0Service } from '@auth0/auth0-angular';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter, switchMap } from 'rxjs/operators';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class Auth0BridgeService {
  private readonly auth0 = inject(Auth0Service);
  private readonly auth = inject(AuthService);

  constructor() {
    // When Auth0 reports authenticated, get the JWT access token and feed it into
    // AuthService so the existing authInterceptor attaches it to API requests.
    // getAccessTokenSilently() returns a signed JWT when the 'https://mirador-api'
    // audience is configured in Auth0 (Applications → APIs).
    this.auth0.isAuthenticated$
      .pipe(
        takeUntilDestroyed(),
        filter(Boolean),
        switchMap(() => this.auth0.getAccessTokenSilently()),
      )
      .subscribe((token) => {
        this.auth.setToken(token);
      });

    // When Auth0 reports unauthenticated (after logout or session expiry), clear
    // local token state. Guard against the initial loading phase where isLoading$ is
    // still true — we only act once Auth0 has resolved its session check.
    this.auth0.isAuthenticated$
      .pipe(
        takeUntilDestroyed(),
        filter((isAuth) => !isAuth),
      )
      .subscribe(() => {
        if (this.auth.isAuthenticated()) {
          this.auth.logout();
        }
      });
  }
}
