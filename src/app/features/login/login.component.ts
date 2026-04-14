/**
 * LoginComponent — JWT authentication form.
 *
 * Submits username/password to /auth/login, stores the returned JWT token
 * in AuthService (signal + localStorage), and redirects to the dashboard.
 * Default credentials: admin / admin.
 */
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
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
  private readonly router = inject(Router);

  username = 'admin';
  password = 'admin';
  error = signal('');
  errorType = signal<'credentials' | 'blocked' | 'backend' | ''>('');
  loading = signal(false);

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
