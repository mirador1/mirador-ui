/**
 * LoginComponent — authentication entry point.
 *
 * Offers two login paths:
 * 1. Auth0 Universal Login (production) — redirects to Auth0, returns with JWT access token
 *    which Auth0BridgeService syncs into AuthService automatically.
 * 2. Local JWT form (development) — calls POST /auth/login on the Spring Boot backend.
 *    Default credentials: admin / admin.
 */
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService as Auth0Service } from '@auth0/auth0-angular';
import { ApiService } from '../../core/api/api.service';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly auth0 = inject(Auth0Service);
  private readonly router = inject(Router);

  /** Pre-filled username — default `admin` matches the Spring Boot in-memory user. */
  username = 'admin';

  /** Pre-filled password — default `admin` matches the Spring Boot in-memory user. */
  password = 'admin';

  /**
   * Signal holding the current error message string.
   * Cleared on each new submission attempt and set on failure.
   */
  error = signal('');

  /**
   * Signal holding the error category used to apply different CSS styles:
   * - `'credentials'` — wrong username/password (red, shows remaining attempts)
   * - `'blocked'` — too many failed attempts, account locked (red, shows unlock time)
   * - `'backend'` — backend unreachable or unexpected HTTP error (orange)
   * - `''` — no error
   */
  errorType = signal<'credentials' | 'blocked' | 'backend' | ''>('');

  /** Signal: true while the login HTTP request is in flight. Disables the submit button. */
  loading = signal(false);

  /**
   * Redirect to Auth0 Universal Login.
   * After authentication, Auth0 returns to window.location.origin with a code.
   * Auth0BridgeService picks up isAuthenticated$ and syncs the token into AuthService.
   */
  loginWithAuth0(): void {
    this.auth0.loginWithRedirect();
  }

  /**
   * Submit the login form.
   * Calls `POST /auth/login`, stores tokens in `AuthService`, and navigates to the dashboard.
   * On failure, classifies the error type for distinct user-facing messages:
   * - 401 — wrong credentials with optional remaining-attempts hint
   * - 429 — rate-limited with minutes-until-unlock from the response body
   * - 0 / network error — backend unreachable
   * - other — unexpected server error
   */
  submit(): void {
    this.loading.set(true);
    this.error.set('');
    this.errorType.set('');
    this.api.login(this.username, this.password).subscribe({
      next: ({ accessToken, refreshToken }) => {
        this.auth.setTokens(accessToken, refreshToken);
        this.router.navigateByUrl('/');
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        if (!err.status || err.status === 0) {
          // Network error — backend unreachable
          this.errorType.set('backend');
          this.error.set('Backend unreachable — is the Spring Boot app running on localhost:8080?');
        } else if (err.status === 429) {
          this.errorType.set('blocked');
          const minutes = err.error?.retryAfterMinutes ?? 15;
          this.error.set(
            `Too many failed attempts — account locked for ${minutes} min. Try again later.`,
          );
        } else if (err.status === 401) {
          this.errorType.set('credentials');
          const remaining = err.error?.remainingAttempts;
          this.error.set(
            remaining != null
              ? `Wrong credentials — ${remaining} attempt${remaining !== 1 ? 's' : ''} left before lockout.`
              : 'Wrong username or password.',
          );
        } else {
          this.errorType.set('backend');
          this.error.set(`Unexpected error (HTTP ${err.status}) — check backend logs.`);
        }
      },
    });
  }
}
