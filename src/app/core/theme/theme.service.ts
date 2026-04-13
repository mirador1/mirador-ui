import { Injectable, signal, effect } from '@angular/core';

export type Theme = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly _theme = signal<Theme>(
    (localStorage.getItem('theme') as Theme) || 'light'
  );

  readonly theme = this._theme.asReadonly();

  constructor() {
    effect(() => {
      const t = this._theme();
      localStorage.setItem('theme', t);
      document.documentElement.setAttribute('data-theme', t);
    });
    // Apply on init
    document.documentElement.setAttribute('data-theme', this._theme());
  }

  toggle(): void {
    this._theme.update(t => (t === 'light' ? 'dark' : 'light'));
  }
}
