import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { ApiService, Product } from '../../../core/api/api.service';
import { ToastService } from '../../../core/toast/toast.service';

/**
 * Stock filter buckets — same thresholds as the row badge (out / low / ok).
 * `all` keeps every product visible regardless of stock level. The bucket
 * is applied client-side because the backend list endpoint does not
 * accept a stock filter yet.
 */
type StockFilter = 'all' | 'out' | 'low' | 'ok';

/**
 * Products list page — list + search by name + stock filter + create + delete.
 *
 * SEARCH IS NOW SERVER-SIDE (since 2026-04-27, paired with the backend
 * `/products?search=` filter shipped on Java + Python). Input changes
 * pipe through a 300 ms debounce + `distinctUntilChanged`, then trigger
 * a fresh `loadPage()` on page 0. The pattern mirrors
 * `OrderCreateComponent#onCustomerInput`.
 *
 * STOCK FILTER stays client-side over the current page slice — the
 * backend does NOT yet accept a stock-level filter. Acceptable today
 * because the page is paginated to 20 rows ; a future
 * `/products?stock=low|out|ok` could move it server-side too.
 *
 * Per shared ADR-0059 : a Product price change must NOT propagate to
 * existing OrderLines (they hold a snapshot). The Edit screen surfaces
 * this hint inline ; this list page just routes to it.
 */
@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './products.component.html',
  styleUrl: './products.component.scss',
})
export class ProductsComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly products = signal<Product[]>([]);
  readonly total = signal<number>(0);
  readonly page = signal<number>(0);
  readonly size = signal<number>(20);
  readonly loading = signal<boolean>(false);

  // ── Filters ──────────────────────────────────────────────────────────────
  readonly searchQuery = signal<string>('');
  readonly stockFilter = signal<StockFilter>('all');

  /**
   * Subject driving the 300 ms-debounced search → loadPage pipeline.
   * Mirrors the OrderCreateComponent#onCustomerInput pattern. Each
   * keystroke nexts here ; the rxjs chain drops repeated values + throttles
   * the network requests.
   */
  private readonly searchInput$ = new Subject<string>();

  // ── Create form ──────────────────────────────────────────────────────────
  readonly newName = signal<string>('');
  readonly newDescription = signal<string>('');
  readonly newUnitPrice = signal<string>('');
  readonly newStockQuantity = signal<string>('0');

  readonly canCreate = computed(() => {
    const name = this.newName().trim();
    const price = Number(this.newUnitPrice());
    const stock = Number(this.newStockQuantity());
    return (
      name.length > 0 && Number.isFinite(price) && price > 0 && Number.isFinite(stock) && stock >= 0
    );
  });

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.size())));

  /**
   * Live-derived list shown in the table. ONLY applies the stock-bucket
   * filter (client-side) — the search filter is server-side now and
   * already bakes the substring filter into `products()` via
   * `loadPage()`.
   */
  readonly filteredProducts = computed(() => {
    const bucket = this.stockFilter();
    if (bucket === 'all') return this.products();
    return this.products().filter((p) => {
      if (bucket === 'out') return p.stockQuantity === 0;
      if (bucket === 'low') return p.stockQuantity > 0 && p.stockQuantity < 10;
      return p.stockQuantity >= 10; // 'ok'
    });
  });

  ngOnInit(): void {
    // Wire the 300 ms debounced search → loadPage pipeline. takeUntilDestroyed
    // tears it down when the component leaves the DOM (Angular zoneless idiom).
    this.searchInput$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.page.set(0); // search resets pagination
        this.loadPage();
      });
    this.loadPage();
  }

  loadPage(): void {
    this.loading.set(true);
    const search = this.searchQuery().trim() || undefined;
    this.api.listProducts(this.page(), this.size(), search).subscribe({
      next: (page) => {
        this.products.set(page.content);
        this.total.set(page.totalElements);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.show(`Failed to load products: ${err?.message ?? 'unknown'}`, 'error');
      },
    });
  }

  createProduct(): void {
    if (!this.canCreate()) return;
    this.loading.set(true);
    this.api
      .createProduct({
        name: this.newName().trim(),
        description: this.newDescription().trim() || undefined,
        unitPrice: Number(this.newUnitPrice()),
        stockQuantity: Number(this.newStockQuantity()),
      })
      .subscribe({
        next: (created) => {
          this.toast.show(`✓ Created product #${created.id} ${created.name}`);
          this.newName.set('');
          this.newDescription.set('');
          this.newUnitPrice.set('');
          this.newStockQuantity.set('0');
          this.loadPage();
        },
        error: (err) => {
          this.loading.set(false);
          this.toast.show(`Create failed: ${err?.message ?? 'unknown'}`, 'error');
        },
      });
  }

  deleteProduct(p: Product): void {
    if (!p.id) return;
    if (
      !confirm(
        `Delete product #${p.id} "${p.name}" ? Existing OrderLines keep their snapshot price unchanged (ADR-0059).`,
      )
    )
      return;
    this.loading.set(true);
    this.api.deleteProduct(p.id).subscribe({
      next: () => {
        this.toast.show(`Deleted product #${p.id}`);
        this.loadPage();
      },
      error: (err) => {
        this.loading.set(false);
        if (err?.status === 409) {
          this.toast.show(
            `Cannot delete : product is referenced by an order line (FK RESTRICT)`,
            'error',
          );
        } else {
          this.toast.show(`Delete failed: ${err?.message ?? 'unknown'}`, 'error');
        }
      },
    });
  }

  prevPage(): void {
    if (this.page() > 0) {
      this.page.update((n) => n - 1);
      this.loadPage();
    }
  }

  nextPage(): void {
    const maxPage = Math.ceil(this.total() / this.size()) - 1;
    if (this.page() < maxPage) {
      this.page.update((n) => n + 1);
      this.loadPage();
    }
  }

  /**
   * Set search query — bound to the search input via (input).
   * Pushes into the debounced subject so the actual network request
   * fires 300 ms after the user stops typing (and only when the
   * trimmed value differs from the previous one).
   */
  onSearchInput(value: string): void {
    this.searchQuery.set(value);
    this.searchInput$.next(value.trim());
  }

  /** Set stock filter — bound to the segmented button group. Client-side, no network. */
  setStockFilter(value: StockFilter): void {
    this.stockFilter.set(value);
  }

  /** Reset both filters. Useful when the filtered set is empty. */
  clearFilters(): void {
    this.searchQuery.set('');
    this.stockFilter.set('all');
    this.page.set(0);
    this.loadPage();
  }

  stockClass(stock: number): string {
    if (stock === 0) return 'stock-out';
    if (stock < 10) return 'stock-low';
    return 'stock-ok';
  }
}
