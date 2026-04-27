/**
 * Unit specs for OrderEditComponent — focuses on the live total computed
 * signal + the canAddLine gate + status draft tracking.
 *
 * The live total is the load-bearing UX bit : a regression silently ships
 * an "edit order says €0" page that hides the real backend value. Cheap
 * to test in isolation ; high signal/noise.
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { OrderEditComponent } from './order-edit.component';
import { OrderLine } from '../../../core/api/api.service';

describe('OrderEditComponent — signal logic', () => {
  let cmp: OrderEditComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrderEditComponent],
      providers: [provideHttpClient(), provideRouter([])],
    }).compileComponents();
    cmp = TestBed.createComponent(OrderEditComponent).componentInstance;
  });

  it('starts empty: no order, no lines, statusDraft=PENDING (default), liveTotal=0', () => {
    expect(cmp.order()).toBeNull();
    expect(cmp.lines()).toEqual([]);
    expect(cmp.statusDraft()).toBe('PENDING');
    expect(cmp.liveTotal()).toBe(0);
  });

  it('statusOptions exposes the four backend states', () => {
    expect(cmp.statusOptions).toEqual(['PENDING', 'CONFIRMED', 'SHIPPED', 'CANCELLED']);
  });

  it('canAddLine gating mirrors order-detail (positive product id + positive qty)', () => {
    expect(cmp.canAddLine()).toBe(false);
    cmp.newProductId.set('5');
    cmp.newQuantity.set('2');
    expect(cmp.canAddLine()).toBe(true);
    cmp.newQuantity.set('-1');
    expect(cmp.canAddLine()).toBe(false);
  });

  it('liveTotal = sum of qty × unitPriceAtOrder for every line', () => {
    const lineA: OrderLine = {
      id: 1,
      orderId: 99,
      productId: 1,
      quantity: 3,
      unitPriceAtOrder: 9.99,
      status: 'PENDING',
    };
    const lineB: OrderLine = {
      id: 2,
      orderId: 99,
      productId: 2,
      quantity: 5,
      unitPriceAtOrder: 2,
      status: 'SHIPPED',
    };
    cmp.lines.set([lineA, lineB]);
    expect(cmp.liveTotal()).toBeCloseTo(3 * 9.99 + 5 * 2, 4);
  });

  it('liveTotal recomputes when lines() changes (signal-reactive)', () => {
    cmp.lines.set([
      {
        id: 1,
        orderId: 1,
        productId: 1,
        quantity: 1,
        unitPriceAtOrder: 10,
        status: 'PENDING',
      },
    ]);
    expect(cmp.liveTotal()).toBe(10);
    cmp.lines.update((arr) => [
      ...arr,
      {
        id: 2,
        orderId: 1,
        productId: 2,
        quantity: 4,
        unitPriceAtOrder: 5,
        status: 'PENDING',
      },
    ]);
    expect(cmp.liveTotal()).toBe(30); // 10 + 4×5
  });

  it('onStatusChange writes to statusDraft (used once backend write endpoint ships)', () => {
    cmp.onStatusChange('SHIPPED');
    expect(cmp.statusDraft()).toBe('SHIPPED');
    cmp.onStatusChange('CANCELLED');
    expect(cmp.statusDraft()).toBe('CANCELLED');
  });

  it('statusClass + lineStatusClass produce stable selectors', () => {
    expect(cmp.statusClass('PENDING')).toBe('status-pending');
    expect(cmp.lineStatusClass('REFUNDED')).toBe('line-status-refunded');
  });
});
