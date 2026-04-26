import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService, Product } from '../../../core/api/api.service';
import { ToastService } from '../../../core/toast/toast.service';

/**
 * Product detail page — read-only view of a single Product.
 *
 * Foundation MR : displays the product header (name, description, price,
 * stock, timestamps). Edit form is a separate MR once backend ships
 * PUT /products/{id}.
 *
 * Per shared ADR-0059, the price displayed here is the CURRENT price.
 * Existing OrderLines that snapshotted this product hold their own
 * snapshot value — they do NOT update when the catalogue price changes.
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
}
