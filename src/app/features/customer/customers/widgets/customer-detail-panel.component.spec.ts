/**
 * Smoke test for CustomerDetailPanelComponent — pure presentational
 * widget with 8 signal inputs and 2 outputs, no business logic.
 *
 * Template rendering is integration-tested via the parent
 * customers.component.spec.ts ; this smoke test catches broken imports
 * + verifies inputs default correctly.
 *
 * Widget extracted in Phase B-7-2b follow-up (2026-04-23).
 */
import { TestBed } from '@angular/core/testing';
import { CustomerDetailPanelComponent } from './customer-detail-panel.component';

describe('CustomerDetailPanelComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('exports the component class', () => {
    expect(CustomerDetailPanelComponent).toBeDefined();
  });

  it('instantiates with sensible defaults', () => {
    const fixture = TestBed.createComponent(CustomerDetailPanelComponent);
    const c = fixture.componentInstance;
    expect(c.selectedCustomer()).toBeNull();
    expect(c.activeTab()).toBe('bio');
    expect(c.bioEnabled()).toBe(true);
    expect(c.detailLoading()).toBe(false);
    expect(c.detailError()).toBe('');
    expect(c.bio()).toBeNull();
    expect(c.todos()).toBeNull();
    expect(c.enriched()).toBeNull();
  });
});
