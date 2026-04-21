import { TestBed } from '@angular/core/testing';
import { TourService } from './tour.service';

// Vitest doesn't ship jsdom's `localStorage` in jsdom@29 by default for
// the environment, but the service guards with try/catch so all flows
// below run either way. When localStorage IS available, we also verify
// the "seen" flag round-trips through storage.

describe('TourService', () => {
  let service: TourService;

  beforeEach(() => {
    try {
      localStorage.removeItem('mirador:tour:seen');
    } catch {
      // Non-jsdom env — service falls back to in-memory. Fine for the test.
    }
    TestBed.configureTestingModule({});
    service = TestBed.inject(TourService);
  });

  it('should not be active before start', () => {
    expect(service.isActive()).toBe(false);
    expect(service.currentStep()).toBeNull();
  });

  it('should activate on start() and land on step 0', () => {
    service.start();
    expect(service.isActive()).toBe(true);
    expect(service.stepIndex()).toBe(0);
    expect(service.isFirstStep()).toBe(true);
    expect(service.currentStep()?.title).toMatch(/Welcome/i);
  });

  it('should advance with next() and track last-step state', () => {
    service.start();
    service.next();
    expect(service.stepIndex()).toBe(1);
    expect(service.isFirstStep()).toBe(false);

    // Walk to the end and verify we see the closing step, then auto-close.
    const last = service.steps().length - 1;
    for (let i = service.stepIndex()!; i < last; i++) service.next();
    expect(service.isLastStep()).toBe(true);
    service.next(); // one past the end → end()
    expect(service.isActive()).toBe(false);
  });

  it('prev() should not go below 0', () => {
    service.start();
    service.prev();
    expect(service.stepIndex()).toBe(0);
    service.next();
    service.next();
    expect(service.stepIndex()).toBe(2);
    service.prev();
    expect(service.stepIndex()).toBe(1);
  });

  it('end() should clear the tour state', () => {
    service.start();
    service.next();
    service.end();
    expect(service.isActive()).toBe(false);
    expect(service.currentStep()).toBeNull();
  });

  it('maybeAutoStart() should no-op on the second call', async () => {
    service.maybeAutoStart();
    // Wait one frame (service uses requestAnimationFrame internally).
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    expect(service.isActive()).toBe(true);

    service.end();
    service.maybeAutoStart();
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    // "seen" flag set on the first start() — no auto-restart.
    expect(service.isActive()).toBe(false);
  });
});
