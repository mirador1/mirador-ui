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
  loading = signal(false);

  submit(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.login(this.username, this.password).subscribe({
      next: ({ accessToken, refreshToken }) => {
        this.auth.setTokens(accessToken, refreshToken);
        this.router.navigateByUrl('/');
      },
      error: () => {
        this.error.set(
          'Login failed — check credentials or backend availability (localhost:8080).',
        );
        this.loading.set(false);
      },
    });
  }
}
