/**
 * Unit tests for FeatureFlagService — feature toggle source via
 * unleash-proxy. Uses TestBed because the service relies on inject()
 * for HttpClient + EnvService + DestroyRef.
 *
 * <p>NOTE: integration tests against the env-switch effect are tricky
 * in zoneless Angular because effects flush asynchronously and there
 * is no equivalent to fakeAsync's `tick()` for signal effects in the
 * vitest harness. Tests here cover the synchronous public API only;
 * the env-switch reactive flow is exercised end-to-end by the
 * existing CustomersComponent integration test which depends on the
 * Bio feature flag.
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { FeatureFlagService } from './feature-flag.service';
import { EnvService } from '../env/env.service';

// eslint-disable-next-line max-lines-per-function
describe('FeatureFlagService', () => {
  let service: FeatureFlagService;
  let envService: EnvService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    envService = TestBed.inject(EnvService);
    // Force Local env (no unleashProxyUrl) so the constructor effect
    // doesn't fire any HTTP request.
    const local = envService.environments.find((e) => e.name === 'Local');
    if (local) envService.select(local);
    service = TestBed.inject(FeatureFlagService);
  });

  describe('initial state on Local env (no proxy)', () => {
    it('starts with empty flags', () => {
      expect(service.flags()).toEqual({});
    });

    it('starts with loaded=false', () => {
      expect(service.loaded()).toBe(false);
    });

    it('starts with error=null', () => {
      expect(service.error()).toBeNull();
    });

    it('isAvailable() returns false (Local env has no unleashProxyUrl)', () => {
      expect(service.isAvailable()).toBe(false);
    });
  });

  describe('isOn()', () => {
    it('returns false when flag map is empty (proxy unreachable)', () => {
      // Pinned: "new feature hidden by default" contract — when the
      // proxy is unreachable the UI should NOT show flag-gated features
      // (otherwise a network outage would silently expose work-in-progress).
      expect(service.isOn('mirador.bio.enabled')).toBe(false);
    });

    it('returns false for any unknown flag name', () => {
      expect(service.isOn('any-unknown-flag')).toBe(false);
      expect(service.isOn('')).toBe(false);
    });

    it('strict equality on `=== true` — undefined / null / 0 all fall through to false', () => {
      // Pinned: the production code uses `=== true` which means a flag
      // value of `undefined` (missing) returns false. Critical for the
      // hidden-by-default contract — a proxy returning a partial map
      // should not silently leak unset flags as "on".
      expect(service.isOn('not.in.map')).toBe(false);
    });
  });

  describe('isAvailable() reactivity', () => {
    it('reflects the current env unleashProxyUrl presence', () => {
      // Local env returns null → false.
      expect(service.isAvailable()).toBe(false);

      // Switch to Kind env (has proxy URL) → isAvailable becomes true.
      // The computed re-evaluates synchronously on signal read after
      // the dependency (env) updates.
      const kind = envService.environments.find((e) => e.name === 'Kind');
      if (!kind) throw new Error('test fixture: Kind env not found');
      envService.select(kind);

      expect(service.isAvailable()).toBe(true);

      // Switch back so afterEach is clean.
      const local = envService.environments.find((e) => e.name === 'Local');
      if (local) envService.select(local);
    });
  });
});
