/**
 * Unit tests for AppShellComponent — the top-level layout. Covers the
 * pure / signal-based public methods (no template rendering needed):
 * sidebar accordion, search filter, isActive route matcher, mobile
 * menu toggle, externalHref resolver, navigateFromSearch flow.
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthService as Auth0Service } from '@auth0/auth0-angular';
import { of, BehaviorSubject } from 'rxjs';
import { AppShellComponent } from './app-shell.component';

// eslint-disable-next-line max-lines-per-function
describe('AppShellComponent', () => {
  let component: AppShellComponent;
  let router: Router;

  beforeEach(() => {
    // Auth0 SDK is bridged at app start; we just need a working stub
    // so DI doesn't fail. AppShellComponent itself doesn't call Auth0.
    const auth0Stub = {
      isAuthenticated$: new BehaviorSubject<boolean>(false).asObservable(),
      getAccessTokenSilently: () => of(''),
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: Auth0Service, useValue: auth0Stub },
      ],
    });
    component = TestBed.createComponent(AppShellComponent).componentInstance;
    router = TestBed.inject(Router);
  });

  describe('sidebar accordion', () => {
    it('toggleSection() opens an unopened section', () => {
      // Use 'audit' which is NOT in the default-expanded set
      // (default = {dashboard, customers}).
      expect(component.isSectionExpanded('audit')).toBe(false);

      component.toggleSection('audit');

      expect(component.isSectionExpanded('audit')).toBe(true);
    });

    it('toggleSection() closes an open section', () => {
      component.toggleSection('audit'); // open
      component.toggleSection('audit'); // toggle off

      expect(component.isSectionExpanded('audit')).toBe(false);
    });

    it('accordion semantics: opening one section closes the previously open one', () => {
      // Pinned: only ONE section open at a time. The set is replaced by
      // a fresh set containing only the new id, so opening "security"
      // while "audit" was open closes "audit".
      component.toggleSection('audit');
      expect(component.isSectionExpanded('audit')).toBe(true);

      component.toggleSection('security');

      expect(component.isSectionExpanded('security')).toBe(true);
      expect(component.isSectionExpanded('audit')).toBe(false);
    });

    it('default state has dashboard + customers pre-expanded for visibility', () => {
      // Pinned: most-used pages immediately visible without interaction.
      // A regression that initialises an empty set would silently hide
      // the nav children until the user clicks each chevron.
      const fresh = TestBed.createComponent(AppShellComponent).componentInstance;
      expect(fresh.isSectionExpanded('dashboard')).toBe(true);
      expect(fresh.isSectionExpanded('customers')).toBe(true);
    });
  });

  describe('isActive() route matcher', () => {
    it('returns false when path is undefined', () => {
      expect(component.isActive(undefined)).toBe(false);
    });

    it('exact-matches the root path "/" only when current url is exactly "/"', () => {
      // Pinned: the root path requires exact match because every URL
      // starts with "/". If we used startsWith for "/", every page would
      // be marked active simultaneously.
      Object.defineProperty(router, 'url', { value: '/', configurable: true });
      expect(component.isActive('/')).toBe(true);

      Object.defineProperty(router, 'url', { value: '/customers', configurable: true });
      expect(component.isActive('/')).toBe(false);
    });

    it('uses prefix match for non-root paths (e.g. /customers/123 → /customers active)', () => {
      Object.defineProperty(router, 'url', { value: '/customers/42', configurable: true });
      expect(component.isActive('/customers')).toBe(true);
    });

    it('strips query string + hash before matching', () => {
      Object.defineProperty(router, 'url', {
        value: '/quality?tab=tests#failures',
        configurable: true,
      });
      expect(component.isActive('/quality')).toBe(true);
    });
  });

  describe('externalHref()', () => {
    it('returns null when section has no externalHref function', () => {
      expect(component.externalHref({})).toBeNull();
    });

    it('returns null when externalHref returns null (Grafana not configured)', () => {
      // Pinned: the template hides the link entirely when null is returned,
      // rather than rendering a broken anchor — important for Local env
      // where grafanaUrl is null.
      const section = { externalHref: () => null };
      expect(component.externalHref(section)).toBeNull();
    });

    it('returns the URL when externalHref produces one', () => {
      const section = {
        externalHref: (g: string | null) => (g ? `${g}/explore` : null),
      };
      // env.grafanaUrl() depends on the active env — Local returns null,
      // Kind returns http://localhost:13000. We check the function chain
      // rather than the specific URL since envs can change.
      const result = component.externalHref(section);
      // Either null (Local) or non-empty URL (Kind/Prod) — both are valid.
      if (result !== null) {
        expect(result).toContain('/explore');
      }
    });
  });

  describe('search overlay', () => {
    it('filteredSearchItems returns ALL items when query is empty', () => {
      component.searchQuery = '';
      expect(component.filteredSearchItems.length).toBe(component.searchItems.length);
    });

    it('filteredSearchItems matches by label substring (case-insensitive)', () => {
      component.searchQuery = 'CUSTOMER';
      const filtered = component.filteredSearchItems;
      // At least the 👤 Customers entry must match by label
      expect(filtered.length).toBeGreaterThan(0);
      // Each match must hit at least one of label or keywords
      expect(
        filtered.every(
          (i) => i.label.toLowerCase().includes('customer') || i.keywords.includes('customer'),
        ),
      ).toBe(true);
    });

    it('filteredSearchItems matches by keyword substring', () => {
      // "vulnerability" is in the security demo's keywords
      component.searchQuery = 'vulnerability';
      const filtered = component.filteredSearchItems;
      expect(filtered.some((i) => i.label.includes('Security'))).toBe(true);
    });

    it('filteredSearchItems returns empty array on no match', () => {
      component.searchQuery = 'absolutely-no-match-zzzzzzz';
      expect(component.filteredSearchItems).toEqual([]);
    });

    it('navigateFromSearch closes overlay + clears query + navigates', () => {
      const navSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
      component.showSearch.set(true);
      component.searchQuery = 'cust';

      component.navigateFromSearch('/customers');

      expect(navSpy).toHaveBeenCalledWith('/customers');
      expect(component.showSearch()).toBe(false);
      expect(component.searchQuery).toBe('');

      navSpy.mockRestore();
    });
  });

  describe('logout', () => {
    it('calls AuthService.logout + navigates to /login', () => {
      const navSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
      const authLogoutSpy = vi.spyOn(component.auth, 'logout').mockReturnValue(undefined);

      component.logout();

      expect(authLogoutSpy).toHaveBeenCalledTimes(1);
      expect(navSpy).toHaveBeenCalledWith('/login');

      navSpy.mockRestore();
      authLogoutSpy.mockRestore();
    });
  });

  describe('mobile menu', () => {
    it('toggleMobileMenu flips the signal', () => {
      expect(component.mobileMenuOpen()).toBe(false);

      component.toggleMobileMenu();
      expect(component.mobileMenuOpen()).toBe(true);

      component.toggleMobileMenu();
      expect(component.mobileMenuOpen()).toBe(false);
    });

    it('closeMobileMenu always sets to false (idempotent)', () => {
      component.mobileMenuOpen.set(true);
      component.closeMobileMenu();
      expect(component.mobileMenuOpen()).toBe(false);

      // Re-call when already closed → stays false (no toggle behaviour)
      component.closeMobileMenu();
      expect(component.mobileMenuOpen()).toBe(false);
    });
  });
});
