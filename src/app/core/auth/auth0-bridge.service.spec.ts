/**
 * Unit tests for Auth0BridgeService — bridges Auth0 SDK's
 * isAuthenticated$ + getAccessTokenSilently() to the project's
 * AuthService.setToken/logout API.
 *
 * <p>Auth0Service is mocked with controlled BehaviorSubjects so we can
 * drive the auth lifecycle (login → token issued, logout → cleared).
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AuthService as Auth0Service } from '@auth0/auth0-angular';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { Auth0BridgeService } from './auth0-bridge.service';
import { AuthService } from './auth.service';

// eslint-disable-next-line max-lines-per-function
describe('Auth0BridgeService', () => {
  let isAuthenticated$: BehaviorSubject<boolean>;
  let auth0Mock: Partial<Auth0Service>;
  let auth: AuthService;

  beforeEach(() => {
    isAuthenticated$ = new BehaviorSubject<boolean>(false);
    auth0Mock = {
      isAuthenticated$: isAuthenticated$.asObservable(),
      getAccessTokenSilently: vi.fn().mockReturnValue(of('jwt-access-token-from-auth0')),
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: Auth0Service, useValue: auth0Mock },
      ],
    });

    auth = TestBed.inject(AuthService);
    // Reset auth state to a known starting point.
    auth.logout();
  });

  describe('login flow', () => {
    it('stores the JWT in AuthService when Auth0 reports authenticated', () => {
      // Instantiate the bridge — its constructor subscribes to isAuthenticated$.
      TestBed.inject(Auth0BridgeService);

      isAuthenticated$.next(true);

      expect(auth0Mock.getAccessTokenSilently).toHaveBeenCalledTimes(1);
      expect(auth.token()).toBe('jwt-access-token-from-auth0');
    });

    it('does NOT request a token while Auth0 reports unauthenticated', () => {
      TestBed.inject(Auth0BridgeService);
      // No emission yet (initial value is false).

      expect(auth0Mock.getAccessTokenSilently).not.toHaveBeenCalled();
      expect(auth.token()).toBeNull();
    });

    it('absorbs getAccessTokenSilently errors silently (user stays unauthenticated)', () => {
      // Pinned: a token refresh failure (network issue, session expiry,
      // Auth0 down) MUST NOT crash the outer stream — otherwise future
      // login events stop firing for the rest of the app session.
      auth0Mock.getAccessTokenSilently = vi
        .fn()
        .mockReturnValue(throwError(() => new Error('refresh failed')));

      TestBed.inject(Auth0BridgeService);
      isAuthenticated$.next(true);

      expect(auth.token()).toBeNull();
      // Critical: the error MUST be absorbed by catchError → EMPTY, NOT
      // propagate up the chain. We verify by emitting again — if the
      // outer stream was killed, this would not call the SDK again.
      isAuthenticated$.next(true);
      expect(auth0Mock.getAccessTokenSilently).toHaveBeenCalledTimes(2);
    });
  });

  describe('logout flow', () => {
    it('clears AuthService when Auth0 reports unauthenticated AFTER being authenticated', () => {
      TestBed.inject(Auth0BridgeService);

      // Login → token stored
      isAuthenticated$.next(true);
      expect(auth.token()).toBe('jwt-access-token-from-auth0');

      // Auth0 reports logout
      isAuthenticated$.next(false);

      expect(auth.token()).toBeNull();
    });

    it('does NOT call AuthService.logout if it was already logged out', () => {
      // Pinned: avoid spurious logout side-effects (audit log noise,
      // localStorage clear) when the user was never logged in.
      const logoutSpy = vi.spyOn(auth, 'logout');

      TestBed.inject(Auth0BridgeService);
      // Already false from BehaviorSubject(false) initial — no further emission needed.

      // The constructor subscribed; the BehaviorSubject's initial value
      // is false → bridge sees `false` immediately. Since auth.isAuthenticated()
      // returns false, logout() must NOT be called.
      expect(logoutSpy).not.toHaveBeenCalled();
    });
  });

  describe('lifecycle', () => {
    it('successive login/logout cycles all fire correctly', () => {
      TestBed.inject(Auth0BridgeService);

      // Cycle 1
      isAuthenticated$.next(true);
      expect(auth.token()).toBe('jwt-access-token-from-auth0');
      isAuthenticated$.next(false);
      expect(auth.token()).toBeNull();

      // Cycle 2 with a different token
      auth0Mock.getAccessTokenSilently = vi.fn().mockReturnValue(of('new-jwt-2'));
      // Replace the mock — already-subscribed switchMap will pick up the
      // new mock on the next emission since switchMap re-evaluates the
      // function each time.
      isAuthenticated$.next(true);
      expect(auth.token()).toBe('new-jwt-2');
    });
  });
});
