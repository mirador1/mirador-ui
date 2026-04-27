import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
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
 * Search and filter are client-side over the current page results. The
 * backend product list endpoint has no `search` param yet, so we filter
 * the in-memory page slice. When `/products?search=` lands, swap the
 * `filteredProducts` computation for a server-side query (300ms debounce
 * pattern in `OrderCreateComponent#onCustomerInput` is the model).
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

  readonly products = signal<Product[]>([]);
  readonly total = signal<number>(0);
  readonly page = signal<number>(0);
  readonly size = signal<number>(20);
  readonly loading = signal<boolean>(false);

  // ── Filters ──────────────────────────────────────────────────────────────
  readonly searchQuery = signal<string>('');
  readonly stockFilter = signal<StockFilter>('all');

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
   * Live-derived list shown in the table. Composed of two filters :
   *   1. `searchQuery` — case-insensitive substring on name + description.
   *   2. `stockFilter` — bucket matching the row badge thresholds.
   * Both are client-side ; see component-level note for the migration path.
   */
  readonly filteredProducts = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const bucket = this.stockFilter();
    return this.products().filter((p) => {
      if (q) {
        const hay = `${p.name} ${p.description ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (bucket === 'out' && p.stockQuantity !== 0) return false;
      if (bucket === 'low' && (p.stockQuantity === 0 || p.stockQuantity >= 10)) return false;
      if (bucket === 'ok' && p.stockQuantity < 10) return false;
      return true;
    });
  });

  ngOnInit(): void {
    this.loadPage();
  }

  loadPage(): void {
    this.loading.set(true);
    this.api.listProducts(this.page(), this.size()).subscribe({
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

  /** Set search query — bound to the search input via (input). */
  onSearchInput(value: string): void {
    this.searchQuery.set(value);
  }

  /** Set stock filter — bound to the segmented button group. */
  setStockFilter(value: StockFilter): void {
    this.stockFilter.set(value);
  }

  /** Reset both filters. Useful when the filtered set is empty. */
  clearFilters(): void {
    this.searchQuery.set('');
    this.stockFilter.set('all');
  }

  stockClass(stock: number): string {
    if (stock === 0) return 'stock-out';
    if (stock < 10) return 'stock-low';
    return 'stock-ok';
  }
}
