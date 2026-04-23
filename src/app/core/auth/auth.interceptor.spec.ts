/**
 * Unit tests for authInterceptor — JWT attach + 401 silent-refresh flow.
 *
 * Pinned contracts (regression-prone, security-critical):
 *   - Authorization header attached only when token + backend request + non-skip path
 *   - /auth/login, /auth/refresh, /proxy/* never get the header (would leak token)
 *   - 403 propagates unchanged (RBAC denied → caller's catchError)
 *   - 401 on a retried request propagates (no infinite refresh loop)
 *   - 401 on Auth0-authenticated session triggers getAccessTokenSilently
 *   - 401 on built-in (admin/admin) session triggers POST /auth/refresh
 *   - Refresh failure → logout() + navigate /login + EMPTY (no spurious error)
 *
 * NOT covered here (effect/concurrency-heavy, would need RxJS marbles):
 *   - Concurrent 401s queueing on refreshTokenSubject
 *   - Auth0 isLoading$ → isAuthenticated$ chain timing
 */
import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpErrorResponse, withInterceptors } from '@angular/common/http';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthService as Auth0Service } from '@auth0/auth0-angular';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';
import { ApiService } from '../api/api.service';

// eslint-disable-next-line max-lines-per-function
describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let auth: AuthService;
  let router: Router;

  // Auth0 stub: not authenticated by default. Tests that need the
  // Auth0 path override these BehaviorSubjects.
  const isAuthenticated$ = new BehaviorSubject<boolean>(false);
  const isLoading$ = new BehaviorSubject<boolean>(false);
  const auth0Stub: Partial<Auth0Service> = {
    isAuthenticated$: isAuthenticated$.asObservable(),
    isLoading$: isLoading$.asObservable(),
    getAccessTokenSilently: vi.fn(() =>
      of('auth0-fresh-token'),
    ) as unknown as Auth0Service['getAccessTokenSilently'],
  };

  beforeEach(() => {
    isAuthenticated$.next(false);
    isLoading$.next(false);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: Auth0Service, useValue: auth0Stub },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    router = TestBed.inject(Router);

    // Reset auth state between tests (signals carry between tests
    // because AuthService is a root singleton).
    auth.logout();
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('Authorization header attachment', () => {
    it('attaches Bearer token to backend GET when token is set', () => {
      auth.setToken('jwt-abc');
      http.get('/api/customers').subscribe();

      const req = httpMock.expectOne('/api/customers');
      expect(req.request.headers.get('Authorization')).toBe('Bearer jwt-abc');
      req.flush({});
    });

    it('does NOT attach token when AuthService.token() is null (not logged in)', () => {
      // Pinned: an unauthenticated user must not send a stale "Bearer null"
      // header — the backend would reject it with 401, triggering refresh
      // for an empty session and producing a redirect loop.
      http.get('/api/public').subscribe();

      const req = httpMock.expectOne('/api/public');
      expect(req.request.headers.has('Authorization')).toBe(false);
      req.flush({});
    });

    it('does NOT attach token to /auth/login (would leak the previous token)', () => {
      // Pinned: even when a token is held (e.g. user re-logs in mid-session),
      // /auth/login must use ONLY the credentials in the body, never the
      // current Bearer — a stale token would flag the login as a session
      // takeover attempt by some IDP rules.
      auth.setToken('jwt-stale');
      http.post('/auth/login', { username: 'a', password: 'b' }).subscribe();

      const req = httpMock.expectOne('/auth/login');
      expect(req.request.headers.has('Authorization')).toBe(false);
      req.flush({});
    });

    it('does NOT attach token to /auth/refresh (uses refresh token in body)', () => {
      auth.setToken('jwt-stale');
      http.post('/auth/refresh', { refreshToken: 'r' }).subscribe();

      const req = httpMock.expectOne('/auth/refresh');
      expect(req.request.headers.has('Authorization')).toBe(false);
      req.flush({});
    });

    it('does NOT attach token to /proxy/* (Loki, Docker — not our auth realm)', () => {
      // Pinned: /proxy/loki and /proxy/docker bridge to services that
      // either have their own auth (Loki Basic) or none (Docker socket
      // unauth on local). Sending OUR JWT to them would leak it to a
      // service that can't validate it but might log the header.
      auth.setToken('jwt-abc');
      http.get('/proxy/loki/api/v1/labels').subscribe();

      const req = httpMock.expectOne('/proxy/loki/api/v1/labels');
      expect(req.request.headers.has('Authorization')).toBe(false);
      req.flush({});
    });
  });

  describe('error propagation', () => {
    it('403 propagates unchanged (RBAC denied → caller handles)', () => {
      // Pinned: 403 means the JWT IS valid but the user lacks the role.
      // Refreshing the token won't help — the new one will be the same
      // user with the same roles. Propagate so the caller can show a
      // "forbidden" UI instead of a redirect-loop.
      auth.setToken('jwt-abc');
      let captured: HttpErrorResponse | null = null;

      http.get('/api/admin').subscribe({
        next: () => undefined,
        error: (e: HttpErrorResponse) => (captured = e),
      });

      const req = httpMock.expectOne('/api/admin');
      req.flush({ message: 'forbidden' }, { status: 403, statusText: 'Forbidden' });

      expect(captured).not.toBeNull();
      expect(captured!.status).toBe(403);
    });

    it('401 on a request marked X-Auth0-Retry propagates (no infinite loop)', () => {
      // Pinned: the retry header is set when handleRefresh successfully
      // got a fresh token and replays the call. If THAT call also 401s
      // we MUST NOT re-enter handleRefresh — that would refresh, retry,
      // 401, refresh, retry, … → infinite loop until the browser tab
      // freezes or the network gives up.
      auth.setToken('jwt-abc');
      let captured: HttpErrorResponse | null = null;

      http.get('/api/customers', { headers: { 'X-Auth0-Retry': '1' } }).subscribe({
        next: () => undefined,
        error: (e: HttpErrorResponse) => (captured = e),
      });

      const req = httpMock.expectOne('/api/customers');
      expect(req.request.headers.get('X-Auth0-Retry')).toBe('1');
      req.flush({}, { status: 401, statusText: 'Unauthorized' });

      expect(captured).not.toBeNull();
      expect(captured!.status).toBe(401);
      // No second request fires — we propagated instead of retrying.
      httpMock.verify();
    });
  });

  describe('built-in refresh flow (non-Auth0 session)', () => {
    it('on 401 with no Auth0 + no refreshToken → logout + navigate /login', () => {
      // Auth0 stub returns isAuthenticated=false (default), AuthService
      // has no token + no refresh token. Refresh path immediately gives up.
      auth.setToken('jwt-abc');
      // refreshToken intentionally NOT set
      const navSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
      const logoutSpy = vi.spyOn(auth, 'logout');

      http.get('/api/customers').subscribe({
        next: () => undefined,
        error: () => undefined, // EMPTY = no error emitted; subscribe completes
      });

      const req = httpMock.expectOne('/api/customers');
      req.flush({}, { status: 401, statusText: 'Unauthorized' });

      expect(logoutSpy).toHaveBeenCalled();
      expect(navSpy).toHaveBeenCalledWith('/login');
    });

    it('on 401 with refresh token → POST /auth/refresh + replay original with new token', () => {
      // Pinned: the happy path of the built-in refresh — the original
      // request gets replayed with both the new Bearer AND the X-Auth0-Retry
      // header so a second 401 doesn't re-enter the refresh loop.
      auth.setTokens('jwt-stale', 'refresh-xyz');

      let result: unknown = null;
      http.get('/api/customers').subscribe({ next: (v) => (result = v) });

      // First call: 401 with the stale token attached
      const first = httpMock.expectOne('/api/customers');
      expect(first.request.headers.get('Authorization')).toBe('Bearer jwt-stale');
      first.flush({}, { status: 401, statusText: 'Unauthorized' });

      // Refresh call goes out to /auth/refresh
      const refresh = httpMock.expectOne((r) => r.url.includes('/auth/refresh'));
      refresh.flush({ accessToken: 'jwt-fresh', refreshToken: 'refresh-new' });

      // Original request replays with the fresh token + retry header
      const replay = httpMock.expectOne('/api/customers');
      expect(replay.request.headers.get('Authorization')).toBe('Bearer jwt-fresh');
      expect(replay.request.headers.get('X-Auth0-Retry')).toBe('1');
      replay.flush({ ok: true });

      expect(result).toEqual({ ok: true });
      // Token state was updated
      expect(auth.token()).toBe('jwt-fresh');
      expect(auth.refreshToken()).toBe('refresh-new');
    });

    it('on /auth/refresh failure → logout + navigate /login + EMPTY (no error to caller)', () => {
      auth.setTokens('jwt-stale', 'refresh-bad');
      const navSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
      const logoutSpy = vi.spyOn(auth, 'logout');

      let errorEmitted = false;
      http.get('/api/customers').subscribe({
        next: () => undefined,
        error: () => (errorEmitted = true),
      });

      const first = httpMock.expectOne('/api/customers');
      first.flush({}, { status: 401, statusText: 'Unauthorized' });

      const refresh = httpMock.expectOne((r) => r.url.includes('/auth/refresh'));
      refresh.flush({}, { status: 401, statusText: 'Unauthorized' });

      // EMPTY swallows the error — caller's component doesn't show a
      // stale "401" toast on top of the /login redirect.
      expect(errorEmitted).toBe(false);
      expect(logoutSpy).toHaveBeenCalled();
      expect(navSpy).toHaveBeenCalledWith('/login');
    });
  });

  describe('Auth0 silent refresh flow', () => {
    it('on 401 with Auth0 authenticated → getAccessTokenSilently + replay with fresh token', () => {
      // Pinned: when Auth0 owns the session, prefer its silent refresh
      // over the built-in /auth/refresh — Auth0 holds the SSO state and
      // can rotate the access token without re-prompting.
      auth.setToken('jwt-stale-auth0');
      isAuthenticated$.next(true);
      const silentSpy = vi.fn(() => of('jwt-auth0-fresh'));
      (auth0Stub.getAccessTokenSilently as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        silentSpy,
      );

      let result: unknown = null;
      http.get('/api/customers').subscribe({ next: (v) => (result = v) });

      const first = httpMock.expectOne('/api/customers');
      expect(first.request.headers.get('Authorization')).toBe('Bearer jwt-stale-auth0');
      first.flush({}, { status: 401, statusText: 'Unauthorized' });

      // Auth0 path takes over — getAccessTokenSilently is called
      expect(silentSpy).toHaveBeenCalled();

      // No /auth/refresh call (Auth0 path bypasses it)
      httpMock.expectNone((r) => r.url.includes('/auth/refresh'));

      // Replay with fresh Auth0 token + retry header
      const replay = httpMock.expectOne('/api/customers');
      expect(replay.request.headers.get('Authorization')).toBe('Bearer jwt-auth0-fresh');
      expect(replay.request.headers.get('X-Auth0-Retry')).toBe('1');
      replay.flush({ ok: 'auth0' });

      expect(result).toEqual({ ok: 'auth0' });
      expect(auth.token()).toBe('jwt-auth0-fresh');
    });

    it('falls back to built-in refresh when Auth0 silent refresh fails', () => {
      // Pinned: Auth0 might be authenticated but the silent token call
      // can fail (network, expired SSO session, …). Don't logout — try
      // the built-in refresh as a second chance, only logout if BOTH fail.
      auth.setTokens('jwt-stale', 'refresh-fallback');
      isAuthenticated$.next(true);
      (auth0Stub.getAccessTokenSilently as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
        throwError(() => new Error('auth0 down')),
      );

      let result: unknown = null;
      http.get('/api/customers').subscribe({ next: (v) => (result = v) });

      const first = httpMock.expectOne('/api/customers');
      first.flush({}, { status: 401, statusText: 'Unauthorized' });

      // Built-in refresh kicks in
      const refresh = httpMock.expectOne((r) => r.url.includes('/auth/refresh'));
      refresh.flush({ accessToken: 'jwt-builtin-fresh', refreshToken: 'refresh-builtin-new' });

      const replay = httpMock.expectOne('/api/customers');
      expect(replay.request.headers.get('Authorization')).toBe('Bearer jwt-builtin-fresh');
      replay.flush({ ok: 'fallback' });

      expect(result).toEqual({ ok: 'fallback' });
    });
  });
});
