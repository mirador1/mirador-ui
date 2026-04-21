/**
 * JWT Auth Interceptor (functional style).
 *
 * Attaches `Authorization: Bearer <accessToken>` to every outgoing backend request,
 * except for routes that don't need authentication (/auth/*, /proxy/*).
 *
 * On 401 responses (and ONLY on 401 — 403 propagates to the caller unchanged):
 *   - If Auth0 is authenticated (SPA login flow), fetch a fresh access token via
 *     `getAccessTokenSilently()` and replay the original request with the
 *     {@link RETRY_HEADER} set to `1` so subsequent 401s on the same retry don't
 *     re-enter this code path (prevents infinite loops).
 *   - Otherwise, attempt a silent refresh via `POST /auth/refresh` using the
 *     refresh token issued by the built-in `/auth/login` endpoint.
 *   - If both paths fail (or the retried request STILL returns 401), log the
 *     user out and redirect to /login.
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
import { BehaviorSubject, EMPTY, Observable, of, throwError } from 'rxjs';
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
 * Custom request header used to mark a retry so a second 401 doesn't
 * re-enter the refresh flow (would cause an infinite loop if the backend
 * stubbornly rejects every version of the token).
 */
const RETRY_HEADER = 'X-Auth0-Retry';

/**
 * Angular HTTP interceptor that handles JWT token attachment and silent refresh.
 *
 * Intercepts every outgoing `HttpClient` request. For backend requests, it:
 * 1. Attaches the current `Authorization: Bearer` header (unless the route is excluded).
 * 2. On 401 from a request that hasn't been retried yet, triggers a silent
 *    refresh via `handleRefresh()`.
 * 3. On 401 from a retried request, gives up and propagates the error (and
 *    triggers logout via the `handleRefresh` fallback path).
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
  const alreadyRetried = req.headers.has(RETRY_HEADER);

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
        !skipAuth &&
        !alreadyRetried
      ) {
        return handleRefresh(authReq, next, auth, api, router, auth0);
      }
      // 403, network error, or a 401 on an already-retried request — propagate
      // to the component's own error handling instead of triggering refresh.
      return throwError(() => error);
    }),
  );
};

/**
 * Handle a 401 response with Auth0-first, built-in-refresh-second strategy.
 *
 * <h3>Why Auth0 first?</h3>
 * On a fresh Auth0 callback, `Auth0BridgeService` subscribes to
 * `isAuthenticated$` and calls `getAccessTokenSilently()` asynchronously
 * (~200-500 ms round-trip to Auth0's `/oauth/token`). During that window,
 * the dashboard's early API calls fire without a token and receive 401.
 * Without this Auth0-aware branch, the interceptor would see no refresh
 * token in `AuthService`, call `logout()`, and redirect to /login —
 * producing the "flash-then-redirect-to-login" symptom.
 *
 * <h3>Flow</h3>
 * 1. Wait for the Auth0 SDK to finish initialising (`isLoading$` = false).
 * 2. Check `isAuthenticated$`:
 *    - If true, call `getAccessTokenSilently()` to fetch a fresh access
 *      token. On success, replay the original request with the token AND
 *      the {@link RETRY_HEADER} set so an eventual second 401 on the retry
 *      doesn't re-enter this code path.
 *    - If the silent-refresh itself fails (Auth0 session expired / network
 *      error / etc.), fall back to the built-in refresh flow.
 * 3. If Auth0 is not authenticated at all, fall back to the built-in
 *    refresh flow (works for admin/admin + Keycloak logins).
 * 4. The retry's response propagates unchanged to the caller — if it
 *    returns 200 all is well; if it returns 401 again, the outer
 *    interceptor sees {@link RETRY_HEADER} and propagates instead of
 *    re-entering this function; if it returns 403 (RBAC denied), the
 *    caller's own `catchError` handles it (typically: graceful
 *    degradation, not logout).
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
      switchMap((token) =>
        next(
          req.clone({
            setHeaders: { Authorization: `Bearer ${token}`, [RETRY_HEADER]: '1' },
          }),
        ),
      ),
    );
  }

  isRefreshing = true;
  refreshTokenSubject.next(null);

  // Wait for the Auth0 SDK to settle before deciding which refresh path to take.
  return auth0.isLoading$.pipe(
    filter((loading) => !loading),
    take(1),
    switchMap(() => auth0.isAuthenticated$.pipe(take(1))),
    switchMap((isAuth0) => {
      if (isAuth0) {
        // Wrap getAccessTokenSilently in its OWN catchError — we only want
        // to fall back if the silent-refresh itself fails. Errors on the
        // eventual retry request propagate up unchanged (see below).
        return auth0.getAccessTokenSilently().pipe(
          catchError((err) => {
            // eslint-disable-next-line no-console
            console.warn(
              '[authInterceptor] Auth0 silent-refresh failed — falling back to built-in',
              err?.error || err?.message || err,
            );
            return of<string | null>(null);
          }),
          switchMap((freshToken) => {
            if (!freshToken) {
              return fallbackBuiltinRefresh(req, next, auth, api, router);
            }
            auth.setToken(freshToken);
            refreshTokenSubject.next(freshToken);
            isRefreshing = false;
            // Retry with the fresh token + retry header. Any error on THIS
            // call propagates to the outer interceptor's catchError, which
            // will see the retry header and forward the error to the
            // component (NOT re-enter this refresh flow).
            return next(
              req.clone({
                setHeaders: {
                  Authorization: `Bearer ${freshToken}`,
                  [RETRY_HEADER]: '1',
                },
              }),
            );
          }),
        );
      }
      // Not authenticated via Auth0 — use the built-in refresh flow.
      return fallbackBuiltinRefresh(req, next, auth, api, router);
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
      return next(
        req.clone({
          setHeaders: {
            Authorization: `Bearer ${accessToken}`,
            [RETRY_HEADER]: '1',
          },
        }),
      );
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
