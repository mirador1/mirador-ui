import { Component } from '@angular/core';
import { AppShellComponent } from './shared/layout/app-shell.component';

/**
 * Root component — the single entry point bootstrapped by `main.ts`.
 *
 * Renders the `AppShellComponent` which provides the application layout:
 * topbar, sidebar navigation, global search overlay, toast container,
 * and the `<router-outlet>` where lazy-loaded feature pages are rendered.
 *
 * This component has no logic of its own — all state lives in the shell
 * and the core services. It exists solely as the Angular bootstrap target.
 */
@Component({
  selector: 'app-root',
  imports: [AppShellComponent],
  template: '<app-shell />',
})
export class App {}
