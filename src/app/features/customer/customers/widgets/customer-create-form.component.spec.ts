/**
 * Tests for CustomerCreateFormComponent — exercises the self-managed
 * form state + helpers (resetKey, clearForm, submitCreate validation).
 *
 * Widget extracted in Phase B-7-2b follow-up (2026-04-23). Keeps its
 * own newName / newEmail / useIdempotencyKey / idempotencyKey signals
 * and viewChild refs (zoneless DOM-fallback) — these tests verify the
 * form state lifecycle without booting a full template render.
 */
import { TestBed } from '@angular/core/testing';
import { CustomerCreateFormComponent } from './customer-create-form.component';

// eslint-disable-next-line max-lines-per-function
describe('CustomerCreateFormComponent', () => {
  let component: CustomerCreateFormComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    component = TestBed.createComponent(CustomerCreateFormComponent).componentInstance;
  });

  it('exports the component class', () => {
    expect(CustomerCreateFormComponent).toBeDefined();
  });

  it('instantiates with empty form state + a fresh idempotency key', () => {
    expect(component.newName()).toBe('');
    expect(component.newEmail()).toBe('');
    expect(component.useIdempotencyKey()).toBe(false);
    // UUID v4-ish format : 8-4-4-4-12 hex chars (not strict — accept any
    // non-empty string from the uuid() helper).
    expect(component.idempotencyKey()).toMatch(/^[a-f0-9-]{20,}$/i);
  });

  it('resetKey() generates a new idempotency-key UUID different from the previous', () => {
    const before = component.idempotencyKey();
    component.resetKey();
    const after = component.idempotencyKey();
    expect(after).not.toBe(before);
    expect(after).toMatch(/^[a-f0-9-]{20,}$/i);
  });

  it('clearForm() resets newName + newEmail to empty strings', () => {
    component.newName.set('Alice');
    component.newEmail.set('alice@example.com');
    expect(component.newName()).toBe('Alice');
    expect(component.newEmail()).toBe('alice@example.com');
    component.clearForm();
    expect(component.newName()).toBe('');
    expect(component.newEmail()).toBe('');
  });

  describe('submitCreate()', () => {
    it('does NOT emit createRequested when both name + email are empty', () => {
      let emitted = false;
      component.createRequested.subscribe(() => {
        emitted = true;
      });
      component.submitCreate();
      expect(emitted).toBe(false);
    });

    it('does NOT emit when only name is filled (email required)', () => {
      let emitted = false;
      component.createRequested.subscribe(() => {
        emitted = true;
      });
      component.newName.set('Alice');
      component.submitCreate();
      expect(emitted).toBe(false);
    });

    // NB : the "happy path" emit tests (with full name+email + optional
    // key) require a rendered template + fixture.detectChanges() so that
    // the viewChild signals (`nameInput`, `emailInput`) are populated.
    // Without it the widget's `nameEl?.value ?? this.newName()` fallback
    // works in production but the empty signal initial state combined
    // with TestBed's lack of render cycle makes the assertion brittle.
    // The full happy-path is covered at the integration level by the
    // parent customers.component.spec.ts smoke test.
  });
});
