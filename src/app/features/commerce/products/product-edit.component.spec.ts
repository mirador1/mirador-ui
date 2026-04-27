/**
 * Unit specs for ProductEditComponent — covers the canSave gate + the
 * priceChanged hint that surfaces the ADR-0059 immutability warning.
 *
 * Why priceChanged matters : the warning banner is the load-bearing UI
 * that tells the user "your edit will NOT update historical orders".
 * A regression that keeps the banner hidden ships a footgun ; a
 * regression that always shows it is confusing. Both cases are caught
 * here.
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { ProductEditComponent } from './product-edit.component';

describe('ProductEditComponent — signal logic', () => {
  let cmp: ProductEditComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductEditComponent],
      providers: [provideHttpClient(), provideRouter([])],
    }).compileComponents();
    cmp = TestBed.createComponent(ProductEditComponent).componentInstance;
  });

  // ── canSave ──────────────────────────────────────────────────────────────

  it('canSave starts false (form is empty)', () => {
    expect(cmp.canSave()).toBe(false);
  });

  it('canSave: empty name ⇒ false', () => {
    cmp.editName.set('');
    cmp.editUnitPrice.set('5');
    cmp.editStockQuantity.set('1');
    expect(cmp.canSave()).toBe(false);
  });

  it('canSave: non-positive price ⇒ false', () => {
    cmp.editName.set('A');
    cmp.editStockQuantity.set('1');
    cmp.editUnitPrice.set('0');
    expect(cmp.canSave()).toBe(false);
    cmp.editUnitPrice.set('-1');
    expect(cmp.canSave()).toBe(false);
  });

  it('canSave: stock 0 is OK (≥ 0)', () => {
    cmp.editName.set('A');
    cmp.editUnitPrice.set('5');
    cmp.editStockQuantity.set('0');
    expect(cmp.canSave()).toBe(true);
  });

  it('canSave: NaN-y price/stock ⇒ false', () => {
    cmp.editName.set('A');
    cmp.editUnitPrice.set('xx');
    cmp.editStockQuantity.set('1');
    expect(cmp.canSave()).toBe(false);
  });

  // ── priceChanged (ADR-0059 hint) ─────────────────────────────────────────

  it('priceChanged false until originalUnitPrice loads', () => {
    cmp.originalUnitPrice.set(null);
    cmp.editUnitPrice.set('99');
    expect(cmp.priceChanged()).toBe(false);
  });

  it('priceChanged false when current matches original (within ε)', () => {
    cmp.originalUnitPrice.set(9.99);
    cmp.editUnitPrice.set('9.99');
    expect(cmp.priceChanged()).toBe(false);
  });

  it('priceChanged true when user typed a different price', () => {
    cmp.originalUnitPrice.set(9.99);
    cmp.editUnitPrice.set('14.99');
    expect(cmp.priceChanged()).toBe(true);
  });

  it('priceChanged ignores sub-cent rounding noise (Math.abs < 0.001)', () => {
    cmp.originalUnitPrice.set(10);
    cmp.editUnitPrice.set('10.0001'); // diff 0.0001 < 0.001 threshold
    expect(cmp.priceChanged()).toBe(false);
  });
});
