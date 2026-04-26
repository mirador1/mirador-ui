import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService, Product } from '../../../core/api/api.service';
import { ToastService } from '../../../core/toast/toast.service';

/**
 * Product edit page — full replace via PUT /products/{id}.
 *
 * Loads the existing product into the form, lets the user edit, submits
 * via PUT. Per shared ADR-0059, mutating `unitPrice` here does NOT
 * propagate to existing OrderLine snapshots — surfaced via a hint block.
 *
 * Mirrors the Products list create-form pattern (signals, no ngModel,
 * mobile-responsive, 44px tap targets).
 */
@Component({
  selector: 'app-product-edit',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-edit.component.html',
  styleUrl: './product-edit.component.scss',
})
export class ProductEditComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly loading = signal<boolean>(false);
  readonly originalUnitPrice = signal<number | null>(null);

  readonly editName = signal<string>('');
  readonly editDescription = signal<string>('');
  readonly editUnitPrice = signal<string>('');
  readonly editStockQuantity = signal<string>('');

  readonly canSave = computed(() => {
    const name = this.editName().trim();
    const price = Number(this.editUnitPrice());
    const stock = Number(this.editStockQuantity());
    return (
      name.length > 0 &&
      Number.isFinite(price) &&
      price > 0 &&
      Number.isFinite(stock) &&
      stock >= 0
    );
  });

  readonly priceChanged = computed(() => {
    const original = this.originalUnitPrice();
    const current = Number(this.editUnitPrice());
    return original !== null && Number.isFinite(current) && Math.abs(original - current) > 0.001;
  });

  readonly productId = computed(() => {
    const idStr = this.route.snapshot.paramMap.get('id');
    return idStr ? Number(idStr) : null;
  });

  ngOnInit(): void {
    const id = this.productId();
    if (id !== null) {
      this.loadProduct(id);
    }
  }

  loadProduct(id: number): void {
    this.loading.set(true);
    this.api.getProduct(id).subscribe({
      next: (p: Product) => {
        this.editName.set(p.name);
        this.editDescription.set(p.description ?? '');
        this.editUnitPrice.set(String(p.unitPrice));
        this.editStockQuantity.set(String(p.stockQuantity));
        this.originalUnitPrice.set(p.unitPrice);
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

  save(): void {
    const id = this.productId();
    if (id === null || !this.canSave()) return;
    this.loading.set(true);
    this.api.updateProduct(id, {
      name: this.editName().trim(),
      description: this.editDescription().trim() || undefined,
      unitPrice: Number(this.editUnitPrice()),
      stockQuantity: Number(this.editStockQuantity()),
    }).subscribe({
      next: (saved: Product) => {
        this.toast.show(`✓ Saved product #${saved.id}`);
        this.router.navigate(['/products', id]);
      },
      error: (err) => {
        this.loading.set(false);
        if (err?.status === 404) {
          this.toast.show(`Product #${id} not found`, 'error');
        } else {
          this.toast.show(`Save failed: ${err?.message ?? 'unknown'}`, 'error');
        }
      },
    });
  }

  cancel(): void {
    const id = this.productId();
    if (id === null) return;
    this.router.navigate(['/products', id]);
  }
}
