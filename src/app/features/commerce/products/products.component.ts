import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, Product } from '../../../core/api/api.service';
import { ToastService } from '../../../core/toast/toast.service';

/**
 * Products list page — list + create + delete (foundation MR).
 *
 * Mirrors the OrdersComponent pattern (signals, no ngModel, @if/@for,
 * mobile-responsive, 44px tap targets). Edit endpoint missing on
 * backend ; will land in a follow-up MR.
 *
 * Per shared ADR-0059 : a Product price change must NOT propagate to
 * existing OrderLines (they hold a snapshot). UI MUST surface this
 * hint when an Edit screen ships.
 */
@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule, FormsModule],
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

  readonly newName = signal<string>('');
  readonly newDescription = signal<string>('');
  readonly newUnitPrice = signal<string>('');
  readonly newStockQuantity = signal<string>('0');

  readonly canCreate = computed(() => {
    const name = this.newName().trim();
    const price = Number(this.newUnitPrice());
    const stock = Number(this.newStockQuantity());
    return (
      name.length > 0 &&
      Number.isFinite(price) &&
      price > 0 &&
      Number.isFinite(stock) &&
      stock >= 0
    );
  });

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.size())));

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
    this.api.createProduct({
      name: this.newName().trim(),
      description: this.newDescription().trim() || undefined,
      unitPrice: Number(this.newUnitPrice()),
      stockQuantity: Number(this.newStockQuantity()),
    }).subscribe({
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
    if (!confirm(`Delete product #${p.id} "${p.name}" ? Existing OrderLines keep their snapshot price unchanged (ADR-0059).`)) return;
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

  stockClass(stock: number): string {
    if (stock === 0) return 'stock-out';
    if (stock < 10) return 'stock-low';
    return 'stock-ok';
  }
}
