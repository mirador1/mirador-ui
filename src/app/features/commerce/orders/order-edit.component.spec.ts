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

/**
 * Shared component-spinning helper — extracted so the multiple `describe`
 * blocks below can each get a fresh component without re-typing the
 * TestBed boilerplate.
 */
async function setupComponent(): Promise<OrderEditComponent> {
  await TestBed.configureTestingModule({
    imports: [OrderEditComponent],
    providers: [provideHttpClient(), provideRouter([])],
  }).compileComponents();
  return TestBed.createComponent(OrderEditComponent).componentInstance;
}

describe('OrderEditComponent — signal logic', () => {
  let cmp: OrderEditComponent;

  beforeEach(async () => {
    cmp = await setupComponent();
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

  it('onStatusChange writes to statusDraft', () => {
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

describe('OrderEditComponent — refund dialog (ADR-0063)', () => {
  it('openRefundDialog only opens for SHIPPED lines (defensive vs scripted clicks)', async () => {
    const cmp = await setupComponent();
    cmp.openRefundDialog({
      id: 1,
      orderId: 1,
      productId: 1,
      quantity: 1,
      unitPriceAtOrder: 9.99,
      status: 'PENDING',
    });
    expect(cmp.refundingLine()).toBeNull();

    cmp.openRefundDialog({
      id: 2,
      orderId: 1,
      productId: 1,
      quantity: 1,
      unitPriceAtOrder: 9.99,
      status: 'SHIPPED',
    });
    expect(cmp.refundingLine()?.id).toBe(2);
  });

  it('canSubmitRefund false when no line selected', async () => {
    const cmp = await setupComponent();
    expect(cmp.canSubmitRefund()).toBe(false);
  });

  it('canSubmitRefund true with empty reason (reason is optional)', async () => {
    const cmp = await setupComponent();
    cmp.refundingLine.set({
      id: 1,
      orderId: 1,
      productId: 1,
      quantity: 1,
      unitPriceAtOrder: 9.99,
      status: 'SHIPPED',
    });
    cmp.refundReason.set('');
    expect(cmp.canSubmitRefund()).toBe(true);
  });

  it('canSubmitRefund false when reason exceeds 500 chars (matches backend cap)', async () => {
    const cmp = await setupComponent();
    cmp.refundingLine.set({
      id: 1,
      orderId: 1,
      productId: 1,
      quantity: 1,
      unitPriceAtOrder: 9.99,
      status: 'SHIPPED',
    });
    cmp.refundReason.set('x'.repeat(501));
    expect(cmp.canSubmitRefund()).toBe(false);
  });

  it('closeRefundDialog clears state when not saving', async () => {
    const cmp = await setupComponent();
    cmp.refundingLine.set({
      id: 1,
      orderId: 1,
      productId: 1,
      quantity: 1,
      unitPriceAtOrder: 9.99,
      status: 'SHIPPED',
    });
    cmp.refundReason.set('typing…');
    cmp.closeRefundDialog();
    expect(cmp.refundingLine()).toBeNull();
    expect(cmp.refundReason()).toBe('');
  });
});

describe('OrderEditComponent — status state-machine + dirty tracking', () => {
  // Static helper — no DI, testable in isolation.
  it('isAllowedTransition encodes the state machine', () => {
    // Self-transitions allowed (idempotency for retries).
    expect(OrderEditComponent.isAllowedTransition('PENDING', 'PENDING')).toBe(true);
    // Forward path PENDING → CONFIRMED → SHIPPED.
    expect(OrderEditComponent.isAllowedTransition('PENDING', 'CONFIRMED')).toBe(true);
    expect(OrderEditComponent.isAllowedTransition('CONFIRMED', 'SHIPPED')).toBe(true);
    // CANCELLED reachable from PENDING + CONFIRMED.
    expect(OrderEditComponent.isAllowedTransition('PENDING', 'CANCELLED')).toBe(true);
    expect(OrderEditComponent.isAllowedTransition('CONFIRMED', 'CANCELLED')).toBe(true);
    // Backwards forbidden.
    expect(OrderEditComponent.isAllowedTransition('SHIPPED', 'PENDING')).toBe(false);
    expect(OrderEditComponent.isAllowedTransition('SHIPPED', 'CONFIRMED')).toBe(false);
    expect(OrderEditComponent.isAllowedTransition('CONFIRMED', 'PENDING')).toBe(false);
    // Terminal states cannot leave (except self).
    expect(OrderEditComponent.isAllowedTransition('CANCELLED', 'SHIPPED')).toBe(false);
    expect(OrderEditComponent.isAllowedTransition('CANCELLED', 'PENDING')).toBe(false);
  });

  it('isStatusDirty + canSaveStatus drive the Save button enable state', async () => {
    const cmp = await setupComponent();
    cmp.order.set({
      id: 7,
      customerId: 1,
      status: 'PENDING',
      totalAmount: 0,
      createdAt: '2026-04-27T10:00:00Z',
    });
    cmp.statusDraft.set('PENDING');
    expect(cmp.isStatusDirty()).toBe(false);
    expect(cmp.canSaveStatus()).toBe(false);

    // Valid forward transition → dirty + savable.
    cmp.statusDraft.set('CONFIRMED');
    expect(cmp.isStatusDirty()).toBe(true);
    expect(cmp.canSaveStatus()).toBe(true);
  });

  it('canSaveStatus is false when the local state machine rejects the transition', async () => {
    const cmp = await setupComponent();
    cmp.order.set({
      id: 8,
      customerId: 1,
      status: 'SHIPPED',
      totalAmount: 0,
      createdAt: '2026-04-27T10:00:00Z',
    });
    cmp.statusDraft.set('PENDING'); // SHIPPED → PENDING forbidden
    expect(cmp.isStatusDirty()).toBe(true);
    expect(cmp.canSaveStatus()).toBe(false);
  });
});
