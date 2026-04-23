/**
 * Smoke + behavioural tests for DashboardHealthProbesComponent.
 *
 * Uses TestBed for instantiation (Angular 21's `input()` API needs the
 * DI context even on components with no injected services) ; focuses
 * tests on the 2 helper methods (statusClass + statusLabel) which hold
 * the entire business logic of this presentational widget.
 *
 * Widget extracted in Phase B-6b (2026-04-23).
 */
import { TestBed } from '@angular/core/testing';
import { DashboardHealthProbesComponent } from './dashboard-health-probes.component';

// eslint-disable-next-line max-lines-per-function
describe('DashboardHealthProbesComponent', () => {
  let component: DashboardHealthProbesComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    component = TestBed.createComponent(DashboardHealthProbesComponent).componentInstance;
  });

  it('exports the component class', () => {
    expect(DashboardHealthProbesComponent).toBeDefined();
  });

  it('instantiates cleanly', () => {
    expect(component).toBeTruthy();
  });

  describe('statusClass()', () => {
    it("returns 'badge-unknown' for null/undefined payload (probe not polled)", () => {
      expect(component.statusClass(null)).toBe('badge-unknown');
      expect(component.statusClass(undefined)).toBe('badge-unknown');
    });

    it("returns 'badge-up' when status === 'UP'", () => {
      expect(component.statusClass({ status: 'UP' })).toBe('badge-up');
    });

    it("returns 'badge-down' for any non-UP status", () => {
      expect(component.statusClass({ status: 'DOWN' })).toBe('badge-down');
      expect(component.statusClass({ status: 'OUT_OF_SERVICE' })).toBe('badge-down');
      expect(component.statusClass({ status: 'unknown' })).toBe('badge-down');
    });

    it("returns 'badge-down' for non-null payload missing status field", () => {
      // Matches Spring Actuator behaviour when a malformed /health response
      // lands on the probe poll — falls through to DOWN rather than
      // pretending the probe hasn't polled yet (which would be
      // 'badge-unknown' on null).
      expect(component.statusClass({})).toBe('badge-down');
    });
  });

  describe('statusLabel()', () => {
    it("returns '...' for null/undefined payload (still loading)", () => {
      expect(component.statusLabel(null)).toBe('...');
      expect(component.statusLabel(undefined)).toBe('...');
    });

    it('returns the literal status value when present', () => {
      expect(component.statusLabel({ status: 'UP' })).toBe('UP');
      expect(component.statusLabel({ status: 'DOWN' })).toBe('DOWN');
      expect(component.statusLabel({ status: 'OUT_OF_SERVICE' })).toBe('OUT_OF_SERVICE');
    });

    it("returns '?' when payload defined but status field missing", () => {
      expect(component.statusLabel({})).toBe('?');
      expect(component.statusLabel({ components: {} })).toBe('?');
    });
  });
});
