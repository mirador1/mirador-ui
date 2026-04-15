/**
 * ThemeService — Dark/light mode toggle.
 *
 * Sets the `data-theme` attribute on `<html>` which activates CSS custom
 * properties defined in `styles.scss`. Theme preference is persisted in
 * localStorage. Uses an Angular `effect()` to react to signal changes
 * and update both the DOM and storage atomically.
 *
 * Part of an Angular 21 zoneless app — the `effect()` runs synchronously
 * on signal change without Zone.js scheduling.
 */
import { Injectable, signal, effect } from '@angular/core';

/** The two supported color scheme values — maps directly to `data-theme` HTML attribute. */
export type Theme = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  /**
   * Writable signal holding the active theme.
   * Initialized from localStorage so the user's choice persists across sessions.
   * Defaults to `'light'` when no preference is stored.
   */
  private readonly _theme = signal<Theme>((localStorage.getItem('theme') as Theme) || 'light');

  /**
   * Read-only projection of the active theme.
   * Consumed by the AppShell to render the correct toggle icon.
   */
  readonly theme = this._theme.asReadonly();

  constructor() {
    // The effect fires whenever `_theme` changes and keeps localStorage + DOM in sync.
    // Using effect() rather than a manual setter ensures the DOM is always updated,
    // even if the signal is changed from multiple code paths.
    effect(() => {
      const t = this._theme();
      localStorage.setItem('theme', t);
      document.documentElement.setAttribute('data-theme', t);
    });
    // Apply on init — the effect alone does not run before the first render frame,
    // so we apply the theme attribute eagerly to avoid a flash of unstyled content.
    document.documentElement.setAttribute('data-theme', this._theme());
  }

  /**
   * Toggle between light and dark mode.
   * The `effect()` in the constructor immediately syncs DOM and localStorage.
   */
  toggle(): void {
    this._theme.update((t) => (t === 'light' ? 'dark' : 'light'));
  }
}
