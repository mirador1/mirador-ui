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
  ErrorHandler,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
// `@auth0/auth0-angular` pinned to 2.x. No 3.x line published on npm as of
// 2026-04-19 — Renovate will flag when one appears. Revisit then (breaking
// changes around provideAuth0 signature are expected but unknown).
import { provideAuth0 } from '@auth0/auth0-angular';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { AppErrorHandler } from './core/telemetry/app-error-handler';

/**
 * Auth0 tenant configuration — swap these 2 values when creating a fresh
 * tenant (e.g. if the current one has an unrecoverable dashboard error).
 *
 * Concrete steps to get new values: {@code docs/how-to/auth0-tenant-setup.md}.
 * Both values are PUBLIC — safe to commit (the Auth0 SDK transmits them on
 * every /authorize request; anyone inspecting network traffic sees them).
 *
 * The third value, {@code AUTH0_AUDIENCE}, is the identifier of the API
 * registered in Auth0 Dashboard → Applications → APIs. This ONE stays
 * stable across tenants (it's our own API name, not something Auth0
 * assigns). Changing it would also require updating
 * {@code AUTH0_AUDIENCE} in the backend env + the Spring Security JWT
 * validator (see {@code KeycloakConfig.auth0Audience}).
 */
const AUTH0_DOMAIN = 'dev-ksxj46zlkhk2gcvo.us.auth0.com';
const AUTH0_CLIENT_ID = 'DZKCwZ9dqAk3dOtVdDfc2rLJOenxidX6';
const AUTH0_AUDIENCE = 'https://mirador-api';

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
    /**
     * Custom ErrorHandler (ADR-0009) — routes uncaught exceptions through
     * TelemetryService + a rate-limited toast + the Activity timeline so
     * users see failures instead of silent DevTools errors.
     */
    { provide: ErrorHandler, useClass: AppErrorHandler },
    /** Enables Angular 21 zoneless change detection — no Zone.js, signals drive updates. */
    provideZonelessChangeDetection(),
    /** Configure the router with lazy-loaded feature routes. */
    provideRouter(routes),
    /** HttpClient with the JWT auth interceptor for automatic Bearer token attachment. */
    provideHttpClient(withInterceptors([authInterceptor])),
    /**
     * Auth0 OIDC provider (replaces local Keycloak in production).
     * Tenant values live as constants at the top of this file — swap them
     * when creating a fresh tenant. See `docs/how-to/auth0-tenant-setup.md`
     * for the concrete dashboard steps.
     *
     * Auth0BridgeService (core/auth/auth0-bridge.service.ts) syncs the
     * access token into the signal-based AuthService so the authInterceptor
     * and all components stay unchanged.
     *
     * The audience requires an Auth0 API registered under the same tenant
     * with the matching identifier — without it, Auth0 returns opaque
     * tokens the backend cannot validate.
     */
    provideAuth0({
      domain: AUTH0_DOMAIN,
      clientId: AUTH0_CLIENT_ID,
      authorizationParams: {
        redirect_uri: window.location.origin,
        audience: AUTH0_AUDIENCE,
      },
    }),
  ],
};
