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

let isRefreshing = false;
const refreshTokenSubject = new BehaviorSubject<string | null>(null);

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
