/**
 * Spec for the generic ConfirmModalComponent.
 *
 * Smoke test : class export + defaults validate. Behavioural tests
 * (cancelled/confirmed event emission) are integration-tested at the
 * caller level (e.g. customers.component.spec.ts).
 *
 * Created 2026-04-23 alongside the widget extraction (B-7-2c).
 */
import { TestBed } from '@angular/core/testing';
import { ConfirmModalComponent } from './confirm-modal.component';

describe('ConfirmModalComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('exports the component class', () => {
    expect(ConfirmModalComponent).toBeDefined();
  });

  it('instantiates with documented input defaults', () => {
    const fixture = TestBed.createComponent(ConfirmModalComponent);
    const c = fixture.componentInstance;
    // title is required ; setting it before reading
    fixture.componentRef.setInput('title', 'Are you sure?');
    expect(c.title()).toBe('Are you sure?');
    expect(c.body()).toBe('');
    expect(c.confirmLabel()).toBe('Confirm');
    expect(c.cancelLabel()).toBe('Cancel');
    expect(c.loadingLabel()).toBe('Working…');
    expect(c.loading()).toBe(false);
    expect(c.variant()).toBe('primary');
  });

  it("variant accepts 'danger' for destructive actions", () => {
    const fixture = TestBed.createComponent(ConfirmModalComponent);
    fixture.componentRef.setInput('title', 'Delete?');
    fixture.componentRef.setInput('variant', 'danger');
    expect(fixture.componentInstance.variant()).toBe('danger');
  });
});
