/**
 * Unit specs for ProductsComponent — covers :
 * - canCreate (the create-form gate)
 * - filteredProducts (now stock-bucket only, since 2026-04-27 search
 *   went server-side ; the substring filter is exercised by the
 *   /products?search= backend tests)
 * - clearFilters, stockClass, totalPages
 *
 * Cheap to test in isolation, no http roundtrip.
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { ProductsComponent } from './products.component';
import { Product } from '../../../core/api/api.service';

const mkProduct = (over: Partial<Product> = {}): Product => ({
  id: 1,
  name: 'Widget',
  description: 'Generic widget',
  unitPrice: 9.99,
  stockQuantity: 50,
  ...over,
});

/**
 * Spin up a fresh component instance per spec — extracted so each
 * inner describe stays well below the project's 100-line cap on
 * arrow-function bodies (eslint max-lines-per-function).
 */
async function setupComponent(): Promise<ProductsComponent> {
  await TestBed.configureTestingModule({
    imports: [ProductsComponent],
    providers: [provideHttpClient(), provideRouter([])],
  }).compileComponents();
  return TestBed.createComponent(ProductsComponent).componentInstance;
}

describe('ProductsComponent — canCreate gating', () => {
  let cmp: ProductsComponent;

  beforeEach(async () => {
    cmp = await setupComponent();
  });

  it('canCreate: empty name ⇒ false', () => {
    cmp.newName.set('');
    cmp.newUnitPrice.set('5');
    cmp.newStockQuantity.set('1');
    expect(cmp.canCreate()).toBe(false);
  });

  it('canCreate: non-positive price ⇒ false', () => {
    cmp.newName.set('A');
    cmp.newStockQuantity.set('1');
    cmp.newUnitPrice.set('0');
    expect(cmp.canCreate()).toBe(false);
    cmp.newUnitPrice.set('-1');
    expect(cmp.canCreate()).toBe(false);
  });

  it('canCreate: stock 0 is OK (allowed by spec : stock ≥ 0)', () => {
    cmp.newName.set('A');
    cmp.newUnitPrice.set('5');
    cmp.newStockQuantity.set('0');
    expect(cmp.canCreate()).toBe(true);
  });

  it('canCreate: negative stock ⇒ false', () => {
    cmp.newName.set('A');
    cmp.newUnitPrice.set('5');
    cmp.newStockQuantity.set('-1');
    expect(cmp.canCreate()).toBe(false);
  });

  it('canCreate: NaN-y price/stock ⇒ false', () => {
    cmp.newName.set('A');
    cmp.newUnitPrice.set('abc');
    cmp.newStockQuantity.set('1');
    expect(cmp.canCreate()).toBe(false);
  });
});

describe('ProductsComponent — filteredProducts (stock filter only ; search is server-side)', () => {
  let cmp: ProductsComponent;

  beforeEach(async () => {
    cmp = await setupComponent();
  });

  it('default filter "all" returns the unfiltered list', () => {
    const a = mkProduct({ id: 1, name: 'A' });
    const b = mkProduct({ id: 2, name: 'B' });
    cmp.products.set([a, b]);
    expect(cmp.filteredProducts()).toEqual([a, b]);
  });

  it('search query does NOT filter client-side — it triggers a backend reload', () => {
    // Since 2026-04-27 the search is server-side : the component
    // delegates to /products?search= and stores the filtered result
    // in `products()`. `filteredProducts` only applies the stock
    // bucket on top. So setting `searchQuery` here without reloading
    // must NOT prune the visible list (the API would have returned
    // the pruned set already in production).
    cmp.products.set([mkProduct({ id: 1, name: 'Alpha' }), mkProduct({ id: 2, name: 'Beta' })]);
    cmp.searchQuery.set('alpha');
    expect(cmp.filteredProducts().map((p) => p.id)).toEqual([1, 2]);
  });

  it('stock filter "out" matches stock === 0 only', () => {
    cmp.products.set([
      mkProduct({ id: 1, stockQuantity: 0 }),
      mkProduct({ id: 2, stockQuantity: 5 }),
      mkProduct({ id: 3, stockQuantity: 99 }),
    ]);
    cmp.setStockFilter('out');
    expect(cmp.filteredProducts().map((p) => p.id)).toEqual([1]);
  });

  it('stock filter "low" matches 0 < stock < 10', () => {
    cmp.products.set([
      mkProduct({ id: 1, stockQuantity: 0 }),
      mkProduct({ id: 2, stockQuantity: 5 }),
      mkProduct({ id: 3, stockQuantity: 9 }),
      mkProduct({ id: 4, stockQuantity: 10 }),
    ]);
    cmp.setStockFilter('low');
    expect(cmp.filteredProducts().map((p) => p.id)).toEqual([2, 3]);
  });

  it('stock filter "ok" matches stock ≥ 10', () => {
    cmp.products.set([
      mkProduct({ id: 1, stockQuantity: 9 }),
      mkProduct({ id: 2, stockQuantity: 10 }),
      mkProduct({ id: 3, stockQuantity: 100 }),
    ]);
    cmp.setStockFilter('ok');
    expect(cmp.filteredProducts().map((p) => p.id)).toEqual([2, 3]);
  });

  it('clearFilters resets both search query and stock filter', () => {
    cmp.searchQuery.set('foo');
    cmp.setStockFilter('out');
    cmp.clearFilters();
    expect(cmp.searchQuery()).toBe('');
    expect(cmp.stockFilter()).toBe('all');
  });

  it('onSearchInput updates the bound signal (debounce + reload covered by integration tests)', () => {
    // The signal mutation is what the template binds to ; the
    // debounce → loadPage chain needs http roundtrip + fake timers
    // (forbidden under Angular zoneless) so it's covered by the
    // backend test suite + Playwright e2e elsewhere.
    cmp.onSearchInput('  laptop  ');
    expect(cmp.searchQuery()).toBe('  laptop  ');
  });
});

describe('ProductsComponent — stockClass + totalPages', () => {
  let cmp: ProductsComponent;

  beforeEach(async () => {
    cmp = await setupComponent();
  });

  it('stockClass thresholds match the filter buckets', () => {
    expect(cmp.stockClass(0)).toBe('stock-out');
    expect(cmp.stockClass(5)).toBe('stock-low');
    expect(cmp.stockClass(9)).toBe('stock-low');
    expect(cmp.stockClass(10)).toBe('stock-ok');
    expect(cmp.stockClass(999)).toBe('stock-ok');
  });

  it('totalPages: ≥ 1 even when total = 0', () => {
    cmp.total.set(0);
    expect(cmp.totalPages()).toBe(1);
    cmp.size.set(20);
    cmp.total.set(41);
    expect(cmp.totalPages()).toBe(3);
  });
});
