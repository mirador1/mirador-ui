import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ApiService, Order, OrderLine, Page, Product } from '../../../core/api/api.service';
import { ToastService } from '../../../core/toast/toast.service';

/**
 * Pairing of an Order header and the line(s) that reference the current
 * product. Surfaced in the "Consumer orders" section so the user can
 * navigate from the catalogue entry to the orders that snapshotted it.
 */
interface ConsumerOrder {
  /** Order header (id, customer, status, total). */
  order: Order;
  /** Lines on `order` whose productId matches the current product. */
  lines: OrderLine[];
}

/**
 * Product detail page — read-only view + delete + link to consumer Orders.
 *
 * Per shared ADR-0059, the price displayed here is the CURRENT price.
 * Existing OrderLines that snapshotted this product hold their own
 * snapshot value — they do NOT update when the catalogue price changes.
 *
 * Consumer-orders lookup : since 2026-04-27 the backend ships
 * `GET /products/{id}/orders` (Java MR !241 + Python MR !45 — same
 * wire shape on both). The component does ONE network call to get the
 * order headers, then a parallel fan-out for line details (forkJoin).
 * The previous client-side fan-out over the first 50 orders was an
 * O(catalogue) approximation ; this version is O(orders-of-this-product)
 * and bounded by the backend's pagination.
 */

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-detail.component.html',
  styleUrl: './product-detail.component.scss',
})
export class ProductDetailComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly product = signal<Product | null>(null);
  readonly loading = signal<boolean>(false);

  // ── Consumer orders state ────────────────────────────────────────────────
  readonly consumerOrders = signal<ConsumerOrder[] | null>(null);
  readonly consumerLoading = signal<boolean>(false);
  readonly consumerScannedCount = signal<number>(0);

  readonly productId = computed(() => {
    const idStr = this.route.snapshot.paramMap.get('id');
    return idStr ? Number(idStr) : null;
  });

  readonly stockClass = computed(() => {
    const p = this.product();
    if (!p) return 'stock-ok';
    if (p.stockQuantity === 0) return 'stock-out';
    if (p.stockQuantity < 10) return 'stock-low';
    return 'stock-ok';
  });

  ngOnInit(): void {
    const id = this.productId();
    if (id !== null) {
      this.reload(id);
    }
  }

  reload(id: number): void {
    this.loading.set(true);
    this.api.getProduct(id).subscribe({
      next: (p) => {
        this.product.set(p);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        if (err?.status === 404) {
          this.toast.show(`Product #${id} not found`, 'error');
          this.router.navigate(['/products']);
        } else {
          this.toast.show(`Failed to load: ${err?.message ?? 'unknown'}`, 'error');
        }
      },
    });
  }

  /**
   * Fetch the orders that reference this product via the dedicated backend
   * endpoint, then parallel-fan-out for each order's line details so the UI
   * can render line-level data (qty, snapshot price). The headers come
   * pre-filtered by the backend ; the line fan-out is bounded by the order
   * count for THIS product (typically ≤ page size).
   */
  findConsumerOrders(): void {
    const productId = this.productId();
    if (productId === null) return;
    this.consumerLoading.set(true);
    this.consumerOrders.set(null);
    this.api.listOrdersByProduct(productId).subscribe({
      next: (page: Page<Order>) => {
        this.consumerScannedCount.set(page.content.length);
        if (page.content.length === 0) {
          this.consumerOrders.set([]);
          this.consumerLoading.set(false);
          return;
        }
        // Backend already filtered to orders referencing this product ;
        // we just need each order's line details for display. catchError
        // per-inner so a single 404 doesn't sink the whole fan-out.
        const linesByOrder$ = page.content.map((o) =>
          o.id == null
            ? of<{ order: Order; lines: OrderLine[] }>({ order: o, lines: [] })
            : this.api.listOrderLines(o.id).pipe(
                map((lines) => ({ order: o, lines })),
                catchError(() => of({ order: o, lines: [] as OrderLine[] })),
              ),
        );
        forkJoin(linesByOrder$).subscribe({
          next: (pairs) => {
            // Keep only the lines that match this product — an order MAY
            // contain other products in the same basket.
            const matches = pairs
              .map((pair) => ({
                order: pair.order,
                lines: pair.lines.filter((l) => l.productId === productId),
              }))
              .filter((pair) => pair.lines.length > 0);
            this.consumerOrders.set(matches);
            this.consumerLoading.set(false);
          },
          error: (err) => {
            this.consumerLoading.set(false);
            this.toast.show(`Consumer-orders lookup failed: ${err?.message ?? 'unknown'}`, 'error');
          },
        });
      },
      error: (err) => {
        this.consumerLoading.set(false);
        this.toast.show(`Failed to list consumer orders: ${err?.message ?? 'unknown'}`, 'error');
      },
    });
  }

  deleteProduct(): void {
    const p = this.product();
    if (!p?.id) return;
    if (
      !confirm(
        `Delete product "${p.name}" ? Existing OrderLines keep their snapshot price (ADR-0059).`,
      )
    )
      return;
    this.loading.set(true);
    this.api.deleteProduct(p.id).subscribe({
      next: () => {
        this.toast.show(`Deleted product #${p.id}`);
        this.router.navigate(['/products']);
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

  /** Subtotal helper for the consumer-orders table. */
  lineSubtotal(line: OrderLine): number {
    return line.quantity * line.unitPriceAtOrder;
  }
}
