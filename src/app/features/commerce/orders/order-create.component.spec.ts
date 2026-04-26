/**
 * Unit specs for OrderCreateComponent — focuses on the pure signal/computed
 * behaviour (line addition, total, canSubmit gating) without exercising the
 * HTTP submit path. The submit path is end-to-end + better covered by
 * Playwright once the e2e/orders flow ships.
 *
 * Why this matters : the live total is a computed signal and a regression
 * here ships an "Order say €0" form silently. Cheap to test ; high value.
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { OrderCreateComponent } from './order-create.component';
import { Customer, Product } from '../../../core/api/api.service';

describe('OrderCreateComponent — pure signal logic', () => {
  let cmp: OrderCreateComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrderCreateComponent],
      providers: [provideHttpClient(), provideRouter([])],
    }).compileComponents();
    cmp = TestBed.createComponent(OrderCreateComponent).componentInstance;
  });

  it('starts with no customer, no lines, total 0, submit disabled', () => {
    expect(cmp.selectedCustomer()).toBeNull();
    expect(cmp.lines()).toEqual([]);
    expect(cmp.total()).toBe(0);
    expect(cmp.canSubmit()).toBe(false);
  });

  it('picking a customer alone keeps submit disabled (lines required)', () => {
    const c: Customer = { id: 1, name: 'Alice', email: 'alice@example.com' };
    cmp.pickCustomer(c);
    expect(cmp.selectedCustomer()).toEqual(c);
    expect(cmp.customerQuery()).toBe('Alice');
    expect(cmp.canSubmit()).toBe(false);
  });

  it('adds a line via pickProduct, computes subtotal, enables submit when both set', () => {
    const c: Customer = { id: 1, name: 'Alice', email: 'alice@example.com' };
    const p: Product = { id: 7, name: 'Widget', unitPrice: 9.99, stockQuantity: 5 };
    cmp.pickCustomer(c);
    cmp.pickProduct(p);
    expect(cmp.lines()).toHaveLength(1);
    const line = cmp.lines()[0];
    expect(line.productId).toBe(7);
    expect(line.productName).toBe('Widget');
    expect(line.quantity).toBe(1);
    expect(line.unitPriceSnapshot).toBe(9.99);
    expect(cmp.total()).toBeCloseTo(9.99, 2);
    expect(cmp.canSubmit()).toBe(true);
  });

  it('updating quantity recomputes total live', () => {
    const c: Customer = { id: 2, name: 'Bob', email: 'b@e.com' };
    const p: Product = { id: 1, name: 'A', unitPrice: 10, stockQuantity: 99 };
    cmp.pickCustomer(c);
    cmp.pickProduct(p);
    const draftId = cmp.lines()[0].draftId;
    cmp.setLineQuantity(draftId, '3');
    expect(cmp.lines()[0].quantity).toBe(3);
    expect(cmp.total()).toBe(30);
  });

  it('rejects non-positive or non-numeric quantity updates', () => {
    const c: Customer = { id: 2, name: 'Bob', email: 'b@e.com' };
    const p: Product = { id: 1, name: 'A', unitPrice: 10, stockQuantity: 99 };
    cmp.pickCustomer(c);
    cmp.pickProduct(p);
    const draftId = cmp.lines()[0].draftId;
    cmp.setLineQuantity(draftId, '0');
    expect(cmp.lines()[0].quantity).toBe(1);
    cmp.setLineQuantity(draftId, 'abc');
    expect(cmp.lines()[0].quantity).toBe(1);
    cmp.setLineQuantity(draftId, '-2');
    expect(cmp.lines()[0].quantity).toBe(1);
  });

  it('removeLine drops the matching draft and re-disables submit if empty', () => {
    const c: Customer = { id: 1, name: 'Alice', email: 'a@e.com' };
    const p: Product = { id: 1, name: 'A', unitPrice: 5, stockQuantity: 9 };
    cmp.pickCustomer(c);
    cmp.pickProduct(p);
    const draftId = cmp.lines()[0].draftId;
    cmp.removeLine(draftId);
    expect(cmp.lines()).toEqual([]);
    expect(cmp.total()).toBe(0);
    expect(cmp.canSubmit()).toBe(false);
  });

  it('total sums multiple lines correctly', () => {
    const c: Customer = { id: 1, name: 'Alice', email: 'a@e.com' };
    cmp.pickCustomer(c);
    cmp.pickProduct({ id: 1, name: 'A', unitPrice: 10, stockQuantity: 9 });
    cmp.pickProduct({ id: 2, name: 'B', unitPrice: 2.5, stockQuantity: 9 });
    // Update second line qty to 4 → 4 × 2.5 = 10
    const draftIdB = cmp.lines()[1].draftId;
    cmp.setLineQuantity(draftIdB, '4');
    expect(cmp.total()).toBe(20); // 10 + 10
  });

  it('clearCustomer wipes the picked customer and the query', () => {
    cmp.pickCustomer({ id: 1, name: 'Alice', email: 'a@e.com' });
    cmp.clearCustomer();
    expect(cmp.selectedCustomer()).toBeNull();
    expect(cmp.customerQuery()).toBe('');
    expect(cmp.customerResults()).toEqual([]);
  });

  it('product picker open/close toggles signal', () => {
    expect(cmp.productPickerOpen()).toBe(false);
    cmp.openProductPicker();
    expect(cmp.productPickerOpen()).toBe(true);
    cmp.closeProductPicker();
    expect(cmp.productPickerOpen()).toBe(false);
  });

  it('pickProduct without id is a no-op (defensive)', () => {
    const p: Product = { name: 'Phantom', unitPrice: 1, stockQuantity: 1 };
    cmp.pickProduct(p);
    expect(cmp.lines()).toEqual([]);
  });
});
