/**
 * Unit tests for TourOverlayComponent — covers the pure / synchronous
 * surface (no template rendering, no effect flushing in zoneless):
 *   - onKey() KeyboardEvent handler (Escape / ArrowRight / Enter / ArrowLeft)
 *   - computePlacement() coordinate math for the 4 anchored positions
 *
 * NOT covered here (would require effect/RAF flushing not viable in
 * zoneless): the constructor effect that recomputes placement on step
 * change, and the window:resize re-compute path.
 *
 * Implementation note: we instantiate via `runInInjectionContext` rather
 * than `TestBed.createComponent` because the latter mounts the template
 * — and across many tests in zoneless mode, accumulates host elements
 * that eventually fail with NG05104. We don't need template rendering
 * here, only the class methods.
 */
import { TestBed } from '@angular/core/testing';
import { EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { TourOverlayComponent } from './tour-overlay.component';
import { TourService } from './tour.service';

interface PlacementInternals {
  computePlacement(): unknown;
}

// eslint-disable-next-line max-lines-per-function
describe('TourOverlayComponent', () => {
  let component: TourOverlayComponent;
  let service: TourService;

  beforeEach(() => {
    try {
      localStorage.removeItem('mirador:tour:seen');
    } catch {
      // Non-jsdom env — service degrades to in-memory. Fine for tests.
    }
    TestBed.configureTestingModule({});
    component = runInInjectionContext(
      TestBed.inject(EnvironmentInjector),
      () => new TourOverlayComponent(),
    );
    service = TestBed.inject(TourService);
  });

  describe('onKey() — keyboard navigation', () => {
    it('no-ops when tour is NOT active (any key)', () => {
      // Pinned: the global `document:keydown` HostListener must not
      // hijack arrow keys / Esc when the tour is dormant — otherwise
      // the user's normal keyboard navigation gets eaten silently.
      const nextSpy = vi.spyOn(service, 'next');
      const prevSpy = vi.spyOn(service, 'prev');
      const endSpy = vi.spyOn(service, 'end');

      const evt = new KeyboardEvent('keydown', { key: 'Escape' });
      component.onKey(evt);

      expect(nextSpy).not.toHaveBeenCalled();
      expect(prevSpy).not.toHaveBeenCalled();
      expect(endSpy).not.toHaveBeenCalled();
    });

    it('Escape calls service.end() and preventDefault', () => {
      service.start();
      const endSpy = vi.spyOn(service, 'end');
      const evt = new KeyboardEvent('keydown', { key: 'Escape' });
      const preventSpy = vi.spyOn(evt, 'preventDefault');

      component.onKey(evt);

      expect(endSpy).toHaveBeenCalledTimes(1);
      expect(preventSpy).toHaveBeenCalledTimes(1);
    });

    it('ArrowRight calls service.next() and preventDefault', () => {
      service.start();
      const nextSpy = vi.spyOn(service, 'next');
      const evt = new KeyboardEvent('keydown', { key: 'ArrowRight' });
      const preventSpy = vi.spyOn(evt, 'preventDefault');

      component.onKey(evt);

      expect(nextSpy).toHaveBeenCalledTimes(1);
      expect(preventSpy).toHaveBeenCalledTimes(1);
    });

    it('Enter is treated as Next (alias for ArrowRight)', () => {
      // Pinned: Enter triggers Next so the user can advance with their
      // most-natural confirm key — an aliased shortcut, not a regression.
      service.start();
      const nextSpy = vi.spyOn(service, 'next');

      component.onKey(new KeyboardEvent('keydown', { key: 'Enter' }));

      expect(nextSpy).toHaveBeenCalledTimes(1);
    });

    it('ArrowLeft calls service.prev() and preventDefault', () => {
      service.start();
      service.next(); // step 1 so prev has somewhere to go
      const prevSpy = vi.spyOn(service, 'prev');
      const evt = new KeyboardEvent('keydown', { key: 'ArrowLeft' });
      const preventSpy = vi.spyOn(evt, 'preventDefault');

      component.onKey(evt);

      expect(prevSpy).toHaveBeenCalledTimes(1);
      expect(preventSpy).toHaveBeenCalledTimes(1);
    });

    it('unknown keys are no-ops (lets Ctrl+K / D / R keep working)', () => {
      // Pinned: the comment in onKey() explicitly says "no-op — let other
      // shortcuts keep working while the tour is up so the user can explore
      // what the step describes". A regression that consumes all keys
      // would block Ctrl+K (search) and D (theme toggle) during the tour.
      service.start();
      const nextSpy = vi.spyOn(service, 'next');
      const prevSpy = vi.spyOn(service, 'prev');
      const endSpy = vi.spyOn(service, 'end');

      component.onKey(new KeyboardEvent('keydown', { key: 'k' }));
      component.onKey(new KeyboardEvent('keydown', { key: 'D' }));
      component.onKey(new KeyboardEvent('keydown', { key: 'Tab' }));

      expect(nextSpy).not.toHaveBeenCalled();
      expect(prevSpy).not.toHaveBeenCalled();
      expect(endSpy).not.toHaveBeenCalled();
    });
  });

  describe('computePlacement() — coordinate math', () => {
    // computePlacement is private; reach via type cast for unit testing
    // the pure logic. We mock document.querySelector to return a
    // deterministic rect, removing the need to mount the template.
    const mockTargetWithRect = (rect: Partial<DOMRect>) => {
      const el = document.createElement('div');
      el.getBoundingClientRect = () => ({
        top: 100,
        left: 200,
        width: 80,
        height: 40,
        right: 280,
        bottom: 140,
        x: 200,
        y: 100,
        toJSON: () => '',
        ...rect,
      });
      vi.spyOn(document, 'querySelector').mockReturnValue(el);
    };

    it('returns null when current step has no targetSelector (centred mode)', () => {
      // Pinned: welcome / closing steps render centred — no ring, no
      // anchored tooltip. A regression that returns coordinates for a
      // null selector would draw a 0-by-0 ring at the viewport origin.
      service.start(); // step 0 has no targetSelector (welcome step)

      const result = (component as unknown as PlacementInternals).computePlacement();

      expect(result).toBeNull();
    });

    it('returns null when target element is not in the DOM (graceful fallback)', () => {
      // Pinned: if the user navigates to a route where the target doesn't
      // exist (e.g. step targets a Customers page button but user is on
      // Dashboard), placement falls back to null → centred render. NOT
      // a crash — the tour stays usable across route changes.
      service.start();
      service.next(); // advance to a step that HAS a targetSelector
      vi.spyOn(document, 'querySelector').mockReturnValue(null);

      const result = (component as unknown as PlacementInternals).computePlacement();

      expect(result).toBeNull();
    });

    it('returns null when current step itself is null (defensive)', () => {
      // Service not started → currentStep() is null. Should not throw.
      const result = (component as unknown as PlacementInternals).computePlacement();

      expect(result).toBeNull();
    });

    it('computes ring with 6px padding around target rect', () => {
      // Pinned: 6px breathing room between the highlight and the target.
      // A regression to 0px would make the ring touch the target edge,
      // visually merging with it.
      service.start();
      service.next(); // need a step with a targetSelector
      mockTargetWithRect({ top: 100, left: 200, width: 80, height: 40 });

      const p = (component as unknown as PlacementInternals).computePlacement() as {
        ringTop: number;
        ringLeft: number;
        ringWidth: number;
        ringHeight: number;
      };

      expect(p.ringTop).toBe(100 - 6);
      expect(p.ringLeft).toBe(200 - 6);
      expect(p.ringWidth).toBe(80 + 12);
      expect(p.ringHeight).toBe(40 + 12);
    });

    it('returned placement object contains all 7 documented keys', () => {
      // Pinned: the StepPlacement interface declares ringTop/Left/Width/Height,
      // tooltipTop/Left, and arrow. Missing any key would crash the template
      // bindings (e.g. [style.top.px]="p.ringTop") with NaN.
      service.start();
      service.next();
      mockTargetWithRect({});

      const p = (component as unknown as PlacementInternals).computePlacement() as Record<
        string,
        unknown
      >;

      expect(p).not.toBeNull();
      expect(Object.keys(p).sort()).toEqual(
        [
          'arrow',
          'ringHeight',
          'ringLeft',
          'ringTop',
          'ringWidth',
          'tooltipLeft',
          'tooltipTop',
        ].sort(),
      );
    });

    it('arrow matches the step\'s declared position (or "bottom" by default)', () => {
      // We don't control the step's position (read-only steps array), so
      // we just pin: the resolved arrow MUST match what the step declared,
      // or default to 'bottom' when undefined.
      service.start();
      service.next();
      mockTargetWithRect({});
      const step = service.currentStep();
      const expectedPosition = step?.position ?? 'bottom';

      const p = (component as unknown as PlacementInternals).computePlacement() as {
        arrow: string;
      };

      expect(p.arrow).toBe(expectedPosition);
    });
  });

  describe('initial state', () => {
    it('placement signal starts as null (no compute before first step)', () => {
      expect(component.placement()).toBeNull();
    });

    it('exposes the TourService via the readonly public field', () => {
      // Pinned: the template binds directly to `service.isActive()` etc.
      // Renaming the field to `_service` (or making it private) would
      // silently break every template binding. The compiler catches that
      // for production templates, but a unit test here pins the contract
      // separately and fails fast.
      expect(component.service).toBe(service);
    });
  });
});
