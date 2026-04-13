import { Component, inject, signal, HostListener } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';
import { ThemeService } from '../../core/theme/theme.service';
import { EnvService } from '../../core/env/env.service';
import { ToastService } from '../../core/toast/toast.service';
import { KeyboardService } from '../../core/keyboard/keyboard.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, FormsModule],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
})
export class AppShellComponent {
  readonly auth = inject(AuthService);
  readonly theme = inject(ThemeService);
  readonly env = inject(EnvService);
  readonly toast = inject(ToastService);
  readonly keyboard = inject(KeyboardService);
  private readonly router = inject(Router);

  mobileMenuOpen = signal(false);

  // Global search
  searchQuery = '';
  readonly searchItems = [
    { label: 'Dashboard', path: '/', keywords: 'dashboard home health metrics' },
    { label: 'Customers', path: '/customers', keywords: 'customers list create manage' },
    { label: 'Diagnostic', path: '/diagnostic', keywords: 'diagnostic test scenarios' },
    {
      label: 'Observability',
      path: '/observability',
      keywords: 'observability traces logs latency zipkin loki tempo flame',
    },
    {
      label: 'Visualizations',
      path: '/visualizations',
      keywords: 'visualizations golden signals gauges topology waterfall sankey kafka lag',
    },
    {
      label: 'API Builder',
      path: '/request-builder',
      keywords: 'api request builder postman http',
    },
    {
      label: 'Chaos & Traffic',
      path: '/chaos',
      keywords: 'chaos traffic faker generate stress load',
    },
    { label: 'Settings', path: '/settings', keywords: 'settings config actuator loggers sql' },
    { label: 'Activity', path: '/activity', keywords: 'activity timeline events log' },
  ];

  get filteredSearchItems() {
    if (!this.searchQuery) return this.searchItems;
    const q = this.searchQuery.toLowerCase();
    return this.searchItems.filter(
      (i) => i.label.toLowerCase().includes(q) || i.keywords.includes(q),
    );
  }

  navigateFromSearch(path: string): void {
    this.router.navigateByUrl(path);
    this.keyboard.showSearch.set(false);
    this.searchQuery = '';
  }

  logout(): void {
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }



  toggleMobileMenu(): void {
    this.mobileMenuOpen.update((v) => !v);
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }
}
