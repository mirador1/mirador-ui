/**
 * Unit specs for OrdersComponent — covers the pure signal/computed gating
 * (canCreate, totalPages, statusClass) without exercising the HTTP path.
 *
 * The HTTP path (load list, create, delete) is covered end-to-end via the
 * Playwright spec at e2e/orders-products-crud.spec.ts ; duplicating it
 * here would only add maintenance overhead.
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { OrdersComponent } from './orders.component';

describe('OrdersComponent — signal logic', () => {
  let cmp: OrdersComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrdersComponent],
      providers: [provideHttpClient(), provideRouter([])],
    }).compileComponents();
    cmp = TestBed.createComponent(OrdersComponent).componentInstance;
  });

  it('starts empty, no orders, no customer id, create disabled', () => {
    expect(cmp.orders()).toEqual([]);
    expect(cmp.total()).toBe(0);
    expect(cmp.page()).toBe(0);
    expect(cmp.newCustomerId()).toBe('');
    expect(cmp.canCreate()).toBe(false);
  });

  it('canCreate: empty / NaN / 0 / negative ⇒ false', () => {
    cmp.newCustomerId.set('');
    expect(cmp.canCreate()).toBe(false);
    cmp.newCustomerId.set('abc');
    expect(cmp.canCreate()).toBe(false);
    cmp.newCustomerId.set('0');
    expect(cmp.canCreate()).toBe(false);
    cmp.newCustomerId.set('-3');
    expect(cmp.canCreate()).toBe(false);
  });

  it('canCreate: positive integer string ⇒ true', () => {
    cmp.newCustomerId.set('1');
    expect(cmp.canCreate()).toBe(true);
    cmp.newCustomerId.set('42');
    expect(cmp.canCreate()).toBe(true);
  });

  it('totalPages: at least 1 even when total=0 (avoids "Page 1/0" UX)', () => {
    cmp.total.set(0);
    expect(cmp.totalPages()).toBe(1);
  });

  it('totalPages: ceil division of total / size', () => {
    cmp.size.set(20);
    cmp.total.set(45);
    expect(cmp.totalPages()).toBe(3); // 45/20 = 2.25 → 3
    cmp.total.set(20);
    expect(cmp.totalPages()).toBe(1);
    cmp.total.set(21);
    expect(cmp.totalPages()).toBe(2);
  });

  it('statusClass: lowercases and prefixes', () => {
    expect(cmp.statusClass('PENDING')).toBe('status-pending');
    expect(cmp.statusClass('CONFIRMED')).toBe('status-confirmed');
    expect(cmp.statusClass('SHIPPED')).toBe('status-shipped');
    expect(cmp.statusClass('CANCELLED')).toBe('status-cancelled');
  });
});
