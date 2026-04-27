/**
 * Unit specs for OrderDetailComponent — pure signal/computed gating only.
 *
 * The HTTP read/write path (reload, addLine, cancelLine, cancelOrder) is
 * covered end-to-end via the Playwright spec ; duplicating it here would
 * fight the orderId computed signal that derives from ActivatedRoute.
 *
 * Why this matters : `canAddLine` is the gate that disables the Add
 * button — a regression here ships a form with always-disabled or
 * always-enabled submit, both bad UX. Cheap to test ; high value.
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { OrderDetailComponent } from './order-detail.component';

describe('OrderDetailComponent — signal logic', () => {
  let cmp: OrderDetailComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrderDetailComponent],
      providers: [provideHttpClient(), provideRouter([])],
    }).compileComponents();
    cmp = TestBed.createComponent(OrderDetailComponent).componentInstance;
  });

  it('starts with no order, no lines, add-line disabled', () => {
    expect(cmp.order()).toBeNull();
    expect(cmp.lines()).toEqual([]);
    expect(cmp.newProductId()).toBe('');
    expect(cmp.newQuantity()).toBe('1');
    expect(cmp.canAddLine()).toBe(false);
  });

  it('canAddLine: requires positive product id AND positive qty', () => {
    cmp.newProductId.set('1');
    cmp.newQuantity.set('1');
    expect(cmp.canAddLine()).toBe(true);

    cmp.newProductId.set('0');
    expect(cmp.canAddLine()).toBe(false);

    cmp.newProductId.set('1');
    cmp.newQuantity.set('0');
    expect(cmp.canAddLine()).toBe(false);

    cmp.newProductId.set('abc');
    cmp.newQuantity.set('1');
    expect(cmp.canAddLine()).toBe(false);

    cmp.newProductId.set('-1');
    cmp.newQuantity.set('1');
    expect(cmp.canAddLine()).toBe(false);
  });

  it('statusClass: lowercases and prefixes order status', () => {
    expect(cmp.statusClass('PENDING')).toBe('status-pending');
    expect(cmp.statusClass('CANCELLED')).toBe('status-cancelled');
  });

  it('lineStatusClass: lowercases and prefixes line status', () => {
    expect(cmp.lineStatusClass('PENDING')).toBe('line-status-pending');
    expect(cmp.lineStatusClass('SHIPPED')).toBe('line-status-shipped');
    expect(cmp.lineStatusClass('REFUNDED')).toBe('line-status-refunded');
  });
});
