import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService, Order } from '../../../core/api/api.service';
import { ToastService } from '../../../core/toast/toast.service';

/**
 * Order list page — list + create (empty) + delete.
 *
 * Foundation MR : minimal CRUD UI. OrderLine inline + status transitions
 * + customer-scoped filter come in follow-up MRs.
 *
 * Mirrors the ProductsComponent pattern (signals, no ngModel, @if/@for,
 * mobile-responsive, 44px tap targets).
 */
@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './orders.component.html',
  styleUrl: './orders.component.scss',
})
export class OrdersComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  readonly orders = signal<Order[]>([]);
  readonly total = signal<number>(0);
  readonly page = signal<number>(0);
  readonly size = signal<number>(20);
  readonly loading = signal<boolean>(false);

  readonly newCustomerId = signal<string>('');

  readonly canCreate = computed(() => {
    const id = Number(this.newCustomerId());
    return Number.isFinite(id) && id > 0;
  });

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.size())));

  ngOnInit(): void {
    this.loadPage();
  }

  loadPage(): void {
    this.loading.set(true);
    this.api.listOrders(this.page(), this.size()).subscribe({
      next: (page) => {
        this.orders.set(page.content);
        this.total.set(page.totalElements);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.toastError(`Failed to load orders: ${err?.message ?? 'unknown'}`);
      },
    });
  }

  createOrder(): void {
    if (!this.canCreate()) return;
    this.loading.set(true);
    this.api.createOrder({ customerId: Number(this.newCustomerId()) }).subscribe({
      next: (created) => {
        this.toast.show(`✓ Created order #${created.id} for customer ${created.customerId}`);
        this.newCustomerId.set('');
        this.loadPage();
      },
      error: (err) => {
        this.loading.set(false);
        if (err?.status === 422) {
          this.toastError(`Customer ${this.newCustomerId()} not found`);
        } else {
          this.toastError(`Create failed: ${err?.message ?? 'unknown'}`);
        }
      },
    });
  }

  deleteOrder(o: Order): void {
    if (!o.id) return;
    if (!confirm(`Delete order #${o.id} ? Lines will cascade.`)) return;
    this.loading.set(true);
    this.api.deleteOrder(o.id).subscribe({
      next: () => {
        this.toast.show(`Deleted order #${o.id}`);
        this.loadPage();
      },
      error: (err) => {
        this.loading.set(false);
        this.toastError(`Delete failed: ${err?.message ?? 'unknown'}`);
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

  statusClass(status: Order['status']): string {
    return `status-${status.toLowerCase()}`;
  }

  private toastError(msg: string): void {
    this.toast.show(msg, 'error');
  }
}
