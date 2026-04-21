/**
 * JWT Auth Interceptor (functional style).
 *
 * Attaches `Authorization: Bearer <accessToken>` to every outgoing backend request,
 * except for routes that don't need authentication (/auth/*, /proxy/*).
 *
 * On 401 responses:
 *   - If Auth0 is authenticated (SPA login flow), fetch a fresh access token via
 *     `getAccessTokenSilently()` and replay the original request. This covers the
 *     race condition where the dashboard fires API calls BEFORE
 *     `Auth0BridgeService` has populated `AuthService` on a fresh callback.
 *   - Otherwise, attempt a silent refresh via `POST /auth/refresh` using the
 *     refresh token issued by the built-in `/auth/login` endpoint.
 *   - If both paths fail, log out the user and redirect to /login.
 *
 * Concurrent requests that hit 401 while a refresh is in progress are queued
 * and replayed once the refresh completes (avoids multiple refresh calls).
 *
 * Registered as a functional interceptor in `app.config.ts` via
 * `provideHttpClient(withInterceptors([authInterceptor]))`.
 */
import {
  HttpInterceptorFn,
  HttpRequest,
  HttpHandlerFn,
  HttpErrorResponse,
  HttpEvent,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService as Auth0Service } from '@auth0/auth0-angular';
import { BehaviorSubject, EMPTY, Observable, throwError } from 'rxjs';
import { catchError, filter, switchMap, take } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { ApiService } from '../api/api.service';
import { EnvService } from '../env/env.service';

/**
 * Module-level flag: true while a token refresh request is in flight.
 * Prevents multiple simultaneous refresh calls when several requests 401 at once.
 */
let isRefreshing = false;

/**
 * Subject that emits the new access token once a refresh completes.
 * Concurrent requests that hit 401 during a refresh wait on this subject
 * and replay with the new token once it emits.
 */
const refreshTokenSubject = new BehaviorSubject<string | null>(null);

/**
 * Angular HTTP interceptor that handles JWT token attachment and silent refresh.
 *
 * Intercepts every outgoing `HttpClient` request. For backend requests, it:
 * 1. Attaches the current `Authorization: Bearer` header (unless the route is excluded).
 * 2. On 401, triggers a silent refresh via `handleRefresh()`.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const env = inject(EnvService);
  const api = inject(ApiService);
  const router = inject(Router);
  const auth0 = inject(Auth0Service);
  const token = auth.token();

  // Only attach JWT to requests targeting the backend API (relative URLs or matching base URL).
  // External services (Zipkin on :9411, Loki on :3100, Docker API on :2375) don't need auth.
  const isBackendRequest = req.url.startsWith('/') || req.url.startsWith(env.baseUrl());
  const skipAuth =
    req.url.includes('/auth/login') ||
    req.url.includes('/auth/refresh') ||
    req.url.startsWith('/proxy/');

  const authReq =
    token && isBackendRequest && !skipAuth
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;

  return next(authReq).pipe(
    catchError((error) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        isBackendRequest &&
        !skipAuth
      ) {
        return handleRefresh(authReq, next, auth, api, router, auth0);
      }
      return throwError(() => error);
    }),
  );
};

/**
 * Handle a 401 response with Auth0-first, built-in-refresh-second strategy.
 *
 * <h3>Why Auth0 first?</h3>
 * On a fresh Auth0 callback, `Auth0BridgeService` subscribes to `isAuthenticated$`
 * and calls `getAccessTokenSilently()` asynchronously (~200-500 ms round-trip to
 * Auth0's `/oauth/token`). During that window, the dashboard's early API calls
 * fire without a token and receive 401. Without this Auth0-aware branch, the
 * interceptor would see no refresh token in `AuthService`, call `logout()`, and
 * redirect to /login — producing the "flash-then-redirect-to-login" symptom.
 *
 * <h3>Flow</h3>
 * 1. Wait for Auth0 SDK to finish initialising (`isLoading$ = false`).
 * 2. If Auth0 reports `isAuthenticated = true`, fetch a fresh access token via
 *    `getAccessTokenSilently()` and replay the original request with it.
 * 3. If Auth0 is not authenticated, fall back to the existing built-in refresh
 *    flow (works for `admin/admin` + Keycloak logins).
 * 4. If both paths fail, redirect to /login (same as before).
 *
 * Concurrent 401s share the `isRefreshing` flag + `refreshTokenSubject` — only
 * one refresh round-trip per 401 burst.
 */
function handleRefresh(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  auth: AuthService,
  api: ApiService,
  router: Router,
  auth0: Auth0Service,
): Observable<HttpEvent<unknown>> {
  if (isRefreshing) {
    // Another request is already refreshing — wait for the new token.
    return refreshTokenSubject.pipe(
      filter((token) => token !== null),
      take(1),
      switchMap((token) => next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }))),
    );
  }

  isRefreshing = true;
  refreshTokenSubject.next(null);

  // Wait for the Auth0 SDK to settle before deciding which refresh path to take.
  // `isLoading$` emits `true` while the SDK is processing a `?code` callback or
  // a silent-auth iframe; taking the first `false` ensures we don't race it.
  return auth0.isLoading$.pipe(
    filter((loading) => !loading),
    take(1),
    switchMap(() => auth0.isAuthenticated$.pipe(take(1))),
    switchMap((isAuth0) => {
      if (isAuth0) {
        return auth0.getAccessTokenSilently().pipe(
          switchMap((freshToken) => {
            auth.setToken(freshToken);
            refreshTokenSubject.next(freshToken);
            isRefreshing = false;
            return next(req.clone({ setHeaders: { Authorization: `Bearer ${freshToken}` } }));
          }),
          catchError(() => {
            // Auth0 silent-refresh failed (session expired, network error). Fall
            // through to the built-in refresh flow — if that also fails, we log
            // the user out.
            return fallbackBuiltinRefresh(req, next, auth, api, router);
          }),
        );
      }
      // Not authenticated via Auth0 — use the built-in refresh flow.
      return fallbackBuiltinRefresh(req, next, auth, api, router);
    }),
    catchError(() => {
      // Safety net: any unexpected error resets the refresh flag + logs out.
      isRefreshing = false;
      auth.logout();
      router.navigateByUrl('/login');
      return EMPTY;
    }),
  );
}

/**
 * Built-in refresh flow — calls `POST /auth/refresh` with the refresh token
 * stored by {@link AuthService} (issued at `/auth/login` time). Used for the
 * `admin/admin` + Keycloak paths that existed before the Auth0 integration.
 */
function fallbackBuiltinRefresh(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  auth: AuthService,
  api: ApiService,
  router: Router,
): Observable<HttpEvent<unknown>> {
  const currentRefreshToken = auth.refreshToken();
  if (!currentRefreshToken) {
    isRefreshing = false;
    auth.logout();
    router.navigateByUrl('/login');
    // Return EMPTY so the component doesn't receive a spurious error —
    // the /login redirect handles the user flow.
    return EMPTY;
  }

  return api.refreshToken(currentRefreshToken).pipe(
    switchMap(({ accessToken, refreshToken }) => {
      isRefreshing = false;
      auth.setTokens(accessToken, refreshToken);
      refreshTokenSubject.next(accessToken);
      return next(req.clone({ setHeaders: { Authorization: `Bearer ${accessToken}` } }));
    }),
    catchError(() => {
      isRefreshing = false;
      auth.logout();
      router.navigateByUrl('/login');
      // Return EMPTY so components don't display a stale error on logout redirect.
      return EMPTY;
    }),
  );
}
