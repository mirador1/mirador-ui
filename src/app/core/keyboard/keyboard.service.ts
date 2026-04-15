/**
 * KeyboardService — Global keyboard shortcut handler.
 *
 * Provides Vim-style two-key navigation sequences (e.g., G then D for Dashboard)
 * and single-key actions (D for dark mode, R for refresh, ? for help).
 *
 * Key features:
 * - Shortcuts are disabled when focus is in input/textarea/select elements
 * - G key starts a 500ms window for the second key (navigation)
 * - Ctrl+K / Cmd+K opens the global search overlay (works even in inputs)
 * - R dispatches a custom `app:refresh` event that feature pages can listen to
 * - Escape closes any open modal or search overlay
 */
import { Injectable, inject, signal, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { ThemeService } from '../theme/theme.service';

/**
 * Metadata for a single keyboard shortcut, used to render the help overlay.
 */
export interface Shortcut {
  /** Key or key sequence label shown in the help modal (e.g., `"G then D"`, `"Ctrl+K"`). */
  key: string;
  /** Human-readable description of what the shortcut does. */
  description: string;
  /** Grouping label used to section the help overlay (e.g., `"Navigation"`, `"Actions"`). */
  category: string;
}

@Injectable({ providedIn: 'root' })
export class KeyboardService implements OnDestroy {
  private readonly router = inject(Router);
  private readonly theme = inject(ThemeService);

  /**
   * Signal: true when the keyboard shortcut help modal should be visible.
   * Toggled by pressing `?` or dismissed by `Escape`.
   */
  readonly showHelp = signal(false);

  /**
   * Signal: true when the global search overlay should be visible.
   * Toggled by `Ctrl+K` / `Cmd+K` or dismissed by `Escape`.
   */
  readonly showSearch = signal(false);

  /**
   * Bound event handler stored as a property so it can be removed in `ngOnDestroy`.
   * Using an arrow function ensures `this` refers to the service instance.
   */
  private readonly handler = (e: KeyboardEvent) => this.onKeyDown(e);

  /** Complete list of registered shortcuts, displayed in the help overlay. */
  readonly shortcuts: Shortcut[] = [
    { key: 'Ctrl+K', description: 'Open global search', category: 'Navigation' },
    { key: '?', description: 'Show keyboard shortcuts', category: 'Navigation' },
    { key: 'Escape', description: 'Close modal / search', category: 'Navigation' },
    { key: 'G then D', description: 'Go to Dashboard', category: 'Navigation' },
    { key: 'G then C', description: 'Go to Customers', category: 'Navigation' },
    { key: 'G then T', description: 'Go to Diagnostic', category: 'Navigation' },
    { key: 'G then S', description: 'Go to Settings', category: 'Navigation' },
    { key: 'G then A', description: 'Go to Activity', category: 'Navigation' },
    { key: 'R', description: 'Refresh current page', category: 'Actions' },
    { key: 'D', description: 'Toggle dark/light mode', category: 'Actions' },
  ];

  /** Whether the G key was pressed, waiting for the second key within 500ms. */
  private _gPending = false;

  /** Timer handle for the 500ms G-key sequence window. Cleared when the second key arrives. */
  private _gTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Register globally on `document` so shortcuts work regardless of focus position.
    document.addEventListener('keydown', this.handler);
  }

  /**
   * Remove the global keydown listener when the service is destroyed.
   * In practice this only fires if the service is provided at a non-root scope,
   * but the cleanup is included for correctness.
   */
  ngOnDestroy(): void {
    document.removeEventListener('keydown', this.handler);
  }

  private onKeyDown(e: KeyboardEvent): void {
    const target = e.target as HTMLElement;
    const isInput =
      target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';

    // Ctrl+K always works
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      this.showSearch.update((v) => !v);
      return;
    }

    // Escape closes modals
    if (e.key === 'Escape') {
      this.showHelp.set(false);
      this.showSearch.set(false);
      this._gPending = false;
      return;
    }

    // Skip if typing in an input
    if (isInput) return;

    // ? shows help
    if (e.key === '?') {
      e.preventDefault();
      this.showHelp.update((v) => !v);
      return;
    }

    // G + key navigation
    if (this._gPending) {
      this._gPending = false;
      if (this._gTimer) clearTimeout(this._gTimer);
      e.preventDefault();
      switch (e.key.toLowerCase()) {
        case 'd':
          this.router.navigateByUrl('/');
          break;
        case 'c':
          this.router.navigateByUrl('/customers');
          break;
        case 't':
          this.router.navigateByUrl('/diagnostic');
          break;
        case 's':
          this.router.navigateByUrl('/settings');
          break;
        case 'a':
          this.router.navigateByUrl('/activity');
          break;
      }
      return;
    }

    if (e.key === 'g') {
      this._gPending = true;
      this._gTimer = setTimeout(() => {
        this._gPending = false;
      }, 500);
      return;
    }

    // Single key shortcuts
    if (e.key === 'd') {
      e.preventDefault();
      this.theme.toggle();
      return;
    }

    if (e.key === 'r') {
      e.preventDefault();
      // Dispatch custom event that pages can listen to
      window.dispatchEvent(new CustomEvent('app:refresh'));
      return;
    }
  }
}
