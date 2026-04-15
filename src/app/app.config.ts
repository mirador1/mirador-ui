/**
 * Application-level Angular providers.
 *
 * - Zoneless change detection: no Zone.js — change detection is driven by signals.
 *   All components must use `signal()`, `computed()`, and `effect()` for reactivity.
 * - Router: lazy-loaded feature routes defined in `app.routes.ts`.
 * - HttpClient: configured with the JWT auth interceptor that attaches
 *   Bearer tokens to outgoing requests (except login/proxy routes).
 */
import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';

/**
 * Root `ApplicationConfig` passed to `bootstrapApplication()` in `main.ts`.
 *
 * Providers configured here are available to every component and service in the app.
 * Do not add feature-specific providers here — keep them in their respective lazy chunks.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    /** Registers global browser error handlers (unhandled rejections, uncaught errors). */
    provideBrowserGlobalErrorListeners(),
    /** Enables Angular 21 zoneless change detection — no Zone.js, signals drive updates. */
    provideZonelessChangeDetection(),
    /** Configure the router with lazy-loaded feature routes. */
    provideRouter(routes),
    /** HttpClient with the JWT auth interceptor for automatic Bearer token attachment. */
    provideHttpClient(withInterceptors([authInterceptor])),
  ],
};
