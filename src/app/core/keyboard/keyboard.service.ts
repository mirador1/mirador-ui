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

export interface Shortcut {
  key: string;
  description: string;
  category: string;
}

@Injectable({ providedIn: 'root' })
export class KeyboardService implements OnDestroy {
  private readonly router = inject(Router);
  private readonly theme = inject(ThemeService);

  readonly showHelp = signal(false);
  readonly showSearch = signal(false);

  private readonly handler = (e: KeyboardEvent) => this.onKeyDown(e);

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

  /** Whether the G key was pressed, waiting for the second key within 500ms */
  private _gPending = false;
  private _gTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    document.addEventListener('keydown', this.handler);
  }

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
