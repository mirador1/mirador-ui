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
import { provideAuth0 } from '@auth0/auth0-angular';

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
    /**
     * Auth0 OIDC provider (replaces local Keycloak in production).
     * Domain and clientId are public values — safe to embed in the bundle.
     * The Auth0BridgeService (core/auth/auth0-bridge.service.ts) syncs the
     * access token into the existing signal-based AuthService so the
     * authInterceptor and all components remain unchanged.
     *
     * audience: 'https://mirador-api' requires an Auth0 API to be registered
     * at https://manage.auth0.com → Applications → APIs with identifier
     * 'https://mirador-api'. Without it, Auth0 returns opaque tokens.
     */
    provideAuth0({
      domain: 'dev-ksxj46zlkhk2gcvo.us.auth0.com',
      clientId: 'DZKCwZ9dqAk3dOtVdDfc2rLJOenxidX6',
      authorizationParams: {
        redirect_uri: window.location.origin,
        audience: 'https://mirador-api',
      },
    }),
  ],
};
