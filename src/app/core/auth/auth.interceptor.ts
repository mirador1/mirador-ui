/**
 * JWT Auth Interceptor (functional style).
 *
 * Attaches `Authorization: Bearer <accessToken>` to every outgoing backend request,
 * except for routes that don't need authentication (/auth/*, /proxy/*).
 *
 * On 401 responses, attempts a silent token refresh using the refresh token.
 * If refresh succeeds, retries the original request with the new access token.
 * If refresh fails, logs out the user and redirects to /login.
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
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
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
        return handleRefresh(authReq, next, auth, api, router);
      }
      return throwError(() => error);
    }),
  );
};

/**
 * Handle a 401 response by attempting a silent token refresh.
 *
 * If no refresh is already in progress, calls `POST /auth/refresh`, stores the
 * new tokens, and retries the original request. If a refresh is already in
 * progress, waits for `refreshTokenSubject` to emit the new token and then
 * replays the original request.
 *
 * Returns `EMPTY` (silently dropping the observable) when the refresh fails —
 * the router redirect to /login handles the user flow without propagating errors.
 *
 * @param req    The original request that received a 401.
 * @param next   The next handler in the interceptor chain.
 * @param auth   AuthService for token storage and logout.
 * @param api    ApiService for the refresh token HTTP call.
 * @param router Angular Router used to redirect to /login on refresh failure.
 * @returns Observable that either replays the original request or completes silently.
 */
function handleRefresh(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  auth: AuthService,
  api: ApiService,
  router: Router,
): Observable<any> {
  if (!isRefreshing) {
    isRefreshing = true;
    refreshTokenSubject.next(null);

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

  // Another request hit 401 while refresh is in progress — wait for it to complete
  return refreshTokenSubject.pipe(
    filter((token) => token !== null),
    take(1),
    switchMap((token) => next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }))),
  );
}
