import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService, Order, OrderLine } from '../../../core/api/api.service';
import { ToastService } from '../../../core/toast/toast.service';

/**
 * Order detail page — header (customer, status, total) + OrderLine table
 * with add/cancel actions. Foundation MR : displays + add/delete lines.
 *
 * Mirror of the foundation Order list page pattern (signals, no ngModel,
 * @if/@for, mobile-responsive, 44px tap targets).
 *
 * Per shared ADR-0059, "cancel" of a foundation-grade line means DELETE
 * the line (recomputes total). True per-line refund state machine
 * (PENDING → SHIPPED → REFUNDED) is a follow-up.
 */
@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './order-detail.component.html',
  styleUrl: './order-detail.component.scss',
})
export class OrderDetailComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly order = signal<Order | null>(null);
  readonly lines = signal<OrderLine[]>([]);
  readonly loading = signal<boolean>(false);

  readonly newProductId = signal<string>('');
  readonly newQuantity = signal<string>('1');

  readonly canAddLine = computed(() => {
    const pid = Number(this.newProductId());
    const qty = Number(this.newQuantity());
    return Number.isFinite(pid) && pid > 0 && Number.isFinite(qty) && qty > 0;
  });

  readonly orderId = computed(() => {
    const idStr = this.route.snapshot.paramMap.get('id');
    return idStr ? Number(idStr) : null;
  });

  ngOnInit(): void {
    const id = this.orderId();
    if (id !== null) {
      this.reload();
    }
  }

  reload(): void {
    const id = this.orderId();
    if (id === null) return;
    this.loading.set(true);
    this.api.getOrder(id).subscribe({
      next: (o) => this.order.set(o),
      error: (err) => {
        this.loading.set(false);
        if (err?.status === 404) {
          this.toast.show(`Order #${id} not found`, 'error');
          this.router.navigate(['/orders']);
        } else {
          this.toast.show(`Failed to load order: ${err?.message ?? 'unknown'}`, 'error');
        }
      },
    });
    this.api.listOrderLines(id).subscribe({
      next: (ls) => {
        this.lines.set(ls);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.show(`Failed to load lines: ${err?.message ?? 'unknown'}`, 'error');
      },
    });
  }

  addLine(): void {
    const id = this.orderId();
    if (id === null || !this.canAddLine()) return;
    this.loading.set(true);
    this.api
      .addOrderLine(id, {
        productId: Number(this.newProductId()),
        quantity: Number(this.newQuantity()),
      })
      .subscribe({
        next: () => {
          this.toast.show(`✓ Line added`);
          this.newProductId.set('');
          this.newQuantity.set('1');
          this.reload();
        },
        error: (err) => {
          this.loading.set(false);
          if (err?.status === 422 || err?.status === 400) {
            this.toast.show(
              `Product ${this.newProductId()} not found or invalid quantity`,
              'error',
            );
          } else {
            this.toast.show(`Add line failed: ${err?.message ?? 'unknown'}`, 'error');
          }
        },
      });
  }

  cancelLine(line: OrderLine): void {
    const id = this.orderId();
    if (id === null) return;
    if (!confirm(`Cancel line #${line.id} (qty ${line.quantity}) ? Total will be recomputed.`))
      return;
    this.loading.set(true);
    this.api.deleteOrderLine(id, line.id).subscribe({
      next: () => {
        this.toast.show(`Line #${line.id} cancelled`);
        this.reload();
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.show(`Cancel failed: ${err?.message ?? 'unknown'}`, 'error');
      },
    });
  }

  cancelOrder(): void {
    const id = this.orderId();
    if (id === null) return;
    if (!confirm(`Delete order #${id} ? All lines will cascade.`)) return;
    this.loading.set(true);
    this.api.deleteOrder(id).subscribe({
      next: () => {
        this.toast.show(`Order #${id} cancelled`);
        this.router.navigate(['/orders']);
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.show(`Cancel failed: ${err?.message ?? 'unknown'}`, 'error');
      },
    });
  }

  statusClass(status: Order['status']): string {
    return `status-${status.toLowerCase()}`;
  }

  lineStatusClass(status: OrderLine['status']): string {
    return `line-status-${status.toLowerCase()}`;
  }
}
