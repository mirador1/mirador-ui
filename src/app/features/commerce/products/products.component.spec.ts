/**
 * Unit specs for ProductsComponent — covers the create-form gate
 * (canCreate) + the filteredProducts computed pipeline (search by
 * name/description + stock-bucket filter).
 *
 * filteredProducts is the screen's load-bearing computation : a
 * regression here silently ships a list that always shows everything,
 * defeating the filter UI. Cheap to test in isolation.
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

describe('ProductsComponent — signal logic', () => {
  let cmp: ProductsComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductsComponent],
      providers: [provideHttpClient(), provideRouter([])],
    }).compileComponents();
    cmp = TestBed.createComponent(ProductsComponent).componentInstance;
  });

  // ── canCreate ─────────────────────────────────────────────────────────────

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

  // ── filteredProducts (search + stock filter) ─────────────────────────────

  it('default filter "all" returns the unfiltered list', () => {
    const a = mkProduct({ id: 1, name: 'A' });
    const b = mkProduct({ id: 2, name: 'B' });
    cmp.products.set([a, b]);
    expect(cmp.filteredProducts()).toEqual([a, b]);
  });

  it('search by name (case-insensitive)', () => {
    // Use empty descriptions so "widget" matches name only — keeps the
    // assertion focused on the name-substring path. The description path
    // has its own dedicated spec below.
    cmp.products.set([
      mkProduct({ id: 1, name: 'Alpha widget', description: '' }),
      mkProduct({ id: 2, name: 'Beta widget', description: '' }),
      mkProduct({ id: 3, name: 'Gamma', description: '' }),
    ]);
    cmp.searchQuery.set('alpha');
    expect(cmp.filteredProducts().map((p) => p.id)).toEqual([1]);
    cmp.searchQuery.set('WIDGET');
    expect(cmp.filteredProducts().map((p) => p.id)).toEqual([1, 2]);
    cmp.searchQuery.set('zz');
    expect(cmp.filteredProducts()).toEqual([]);
  });

  it('search also matches the description text', () => {
    cmp.products.set([
      mkProduct({ id: 1, name: 'A', description: 'Bluetooth speaker' }),
      mkProduct({ id: 2, name: 'B', description: 'Wired headset' }),
    ]);
    cmp.searchQuery.set('blue');
    expect(cmp.filteredProducts().map((p) => p.id)).toEqual([1]);
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

  it('search + stock filter are AND-combined', () => {
    cmp.products.set([
      mkProduct({ id: 1, name: 'Premium hub', stockQuantity: 0 }),
      mkProduct({ id: 2, name: 'Premium drive', stockQuantity: 5 }),
      mkProduct({ id: 3, name: 'Basic cable', stockQuantity: 5 }),
    ]);
    cmp.searchQuery.set('premium');
    cmp.setStockFilter('low');
    expect(cmp.filteredProducts().map((p) => p.id)).toEqual([2]);
  });

  it('clearFilters resets both search and stock filter', () => {
    cmp.searchQuery.set('foo');
    cmp.setStockFilter('out');
    cmp.clearFilters();
    expect(cmp.searchQuery()).toBe('');
    expect(cmp.stockFilter()).toBe('all');
  });

  // ── stockClass + totalPages ──────────────────────────────────────────────

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
