/**
 * Application-level Angular providers.
 *
 * - Zoneless change detection: no Zone.js — change detection is driven by signals.
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

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
  ],
};
