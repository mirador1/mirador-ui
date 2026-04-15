import { Component, inject } from '@angular/core';
import { AppShellComponent } from './shared/layout/app-shell.component';
import { Auth0BridgeService } from './core/auth/auth0-bridge.service';

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
export class App {
  // Injecting Auth0BridgeService here ensures it is instantiated at bootstrap time,
  // before any route or component renders, so Auth0 session state is resolved early.
  protected readonly _auth0Bridge = inject(Auth0BridgeService);
}
