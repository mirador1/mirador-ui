import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ThemeService } from '../../core/theme/theme.service';
import { EnvService } from '../../core/env/env.service';
import { ToastService } from '../../core/toast/toast.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss'
})
export class AppShellComponent {
  readonly auth = inject(AuthService);
  readonly theme = inject(ThemeService);
  readonly env = inject(EnvService);
  readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  envDropdownOpen = false;

  logout(): void {
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }

  toggleEnvDropdown(): void {
    this.envDropdownOpen = !this.envDropdownOpen;
  }

  selectEnv(env: { name: string; baseUrl: string }): void {
    this.env.select(env);
    this.envDropdownOpen = false;
    this.toast.show(`Switched to ${env.name} (${env.baseUrl})`, 'info');
  }
}
