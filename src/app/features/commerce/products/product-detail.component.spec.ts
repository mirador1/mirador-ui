/**
 * Unit specs for ProductDetailComponent — covers the stockClass computed
 * (driven by the loaded product signal) + the lineSubtotal helper used
 * by the consumer-orders table.
 *
 * The HTTP fan-out (`findConsumerOrders`) is covered end-to-end via the
 * Playwright spec ; testing it here would mostly mock forkJoin and add
 * brittle scaffolding without much new signal.
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { ProductDetailComponent } from './product-detail.component';
import { OrderLine, Product } from '../../../core/api/api.service';

describe('ProductDetailComponent — signal logic', () => {
  let cmp: ProductDetailComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductDetailComponent],
      providers: [provideHttpClient(), provideRouter([])],
    }).compileComponents();
    cmp = TestBed.createComponent(ProductDetailComponent).componentInstance;
  });

  it('starts with no product, consumerOrders null (not yet scanned)', () => {
    expect(cmp.product()).toBeNull();
    expect(cmp.consumerOrders()).toBeNull();
    expect(cmp.consumerLoading()).toBe(false);
  });

  it('stockClass defaults to "stock-ok" when product is null (avoids flicker)', () => {
    expect(cmp.stockClass()).toBe('stock-ok');
  });

  it('stockClass reflects product.stockQuantity bucket', () => {
    const setProduct = (over: Partial<Product>): void =>
      cmp.product.set({
        id: 1,
        name: 'A',
        unitPrice: 1,
        stockQuantity: 0,
        ...over,
      });

    setProduct({ stockQuantity: 0 });
    expect(cmp.stockClass()).toBe('stock-out');
    setProduct({ stockQuantity: 5 });
    expect(cmp.stockClass()).toBe('stock-low');
    setProduct({ stockQuantity: 9 });
    expect(cmp.stockClass()).toBe('stock-low');
    setProduct({ stockQuantity: 10 });
    expect(cmp.stockClass()).toBe('stock-ok');
    setProduct({ stockQuantity: 200 });
    expect(cmp.stockClass()).toBe('stock-ok');
  });

  it('lineSubtotal returns qty × unitPriceAtOrder', () => {
    const line: OrderLine = {
      id: 1,
      orderId: 1,
      productId: 1,
      quantity: 4,
      unitPriceAtOrder: 12.5,
      status: 'PENDING',
    };
    expect(cmp.lineSubtotal(line)).toBe(50);
  });
});
