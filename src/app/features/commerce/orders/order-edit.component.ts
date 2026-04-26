import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService, Order, OrderLine, OrderStatus } from '../../../core/api/api.service';
import { ToastService } from '../../../core/toast/toast.service';

/**
 * Order edit page — line management + read-only status display.
 *
 * Route : `/orders/:id/edit`. Foundation follow-up MR — the existing
 * `/orders/:id` page is a static read-only view ; this page lets the
 * user mutate the line set (add / cancel) without leaving the
 * order context.
 *
 * Status field is rendered as a `<select>` for symmetry with future
 * write support, but the `PUT /orders/{id}/status` endpoint does not
 * exist yet on backend (Spring + Python). Until that lands, the
 * select is decorative — a hint banner above it says so explicitly,
 * and there is no Save button to gate the (non-existent) call. Once
 * the backend endpoint ships, we'll add `updateOrderStatus()` to
 * `ApiService` + a Save button + dirty-tracking signal here.
 *
 * Per shared ADR-0059 [docs/adr/0059-customer-order-product-data-model.md
 * in mirador-service-shared] : "cancel" of a line means DELETE the line,
 * which triggers backend total recompute. Per-line refund state machine
 * (PENDING → SHIPPED → REFUNDED) is a separate follow-up.
 *
 * Patterns inherited from OrderDetailComponent : signals + computed,
 * no ngModel, @if/@for, mobile-responsive at < 600 px, 44 px tap targets.
 */
@Component({
  selector: 'app-order-edit',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './order-edit.component.html',
  styleUrl: './order-edit.component.scss',
})
export class OrderEditComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly order = signal<Order | null>(null);
  readonly lines = signal<OrderLine[]>([]);
  readonly loading = signal<boolean>(false);

  // Status select — bound to a signal mirror of the persisted value.
  // No Save button : when the backend PUT /orders/{id}/status endpoint
  // ships, we'll wire dirty-tracking + a save action against this signal.
  readonly statusDraft = signal<OrderStatus>('PENDING');

  // All allowed transitions surfaced ; backend will gate invalid ones
  // (e.g. CANCELLED → SHIPPED) once the write endpoint exists.
  readonly statusOptions: readonly OrderStatus[] = [
    'PENDING',
    'CONFIRMED',
    'SHIPPED',
    'CANCELLED',
  ] as const;

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

  /**
   * Live total recomputed from the in-memory line set after each
   * add / cancel. Mirrors backend computation (sum of quantity ×
   * unitPriceAtOrder) so the displayed amount matches even before
   * the next reload completes.
   */
  readonly liveTotal = computed(() =>
    this.lines().reduce((sum, l) => sum + l.quantity * l.unitPriceAtOrder, 0),
  );

  ngOnInit(): void {
    if (this.orderId() !== null) {
      this.reload();
    } else {
      this.toast.show('Invalid order ID in URL', 'error');
      this.router.navigate(['/orders']);
    }
  }

  reload(): void {
    const id = this.orderId();
    if (id === null) return;
    this.loading.set(true);
    this.api.getOrder(id).subscribe({
      next: (o) => {
        this.order.set(o);
        this.statusDraft.set(o.status);
      },
      error: (err: { status?: number; message?: string }) => {
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
      error: (err: { message?: string }) => {
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
          this.toast.show('Line added');
          this.newProductId.set('');
          this.newQuantity.set('1');
          this.reload();
        },
        error: (err: { status?: number; message?: string }) => {
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
      error: (err: { message?: string }) => {
        this.loading.set(false);
        this.toast.show(`Cancel failed: ${err?.message ?? 'unknown'}`, 'error');
      },
    });
  }

  /** Status-select change handler. No-op until backend write endpoint lands. */
  onStatusChange(value: string): void {
    // Cast is safe : the <select> options are populated from `statusOptions`
    // which is `OrderStatus[]`. Storing the draft signals intent for the
    // future Save action without making a (non-existent) backend call.
    this.statusDraft.set(value as OrderStatus);
  }

  goBack(): void {
    const id = this.orderId();
    if (id !== null) {
      this.router.navigate(['/orders', id]);
    } else {
      this.router.navigate(['/orders']);
    }
  }

  statusClass(status: OrderStatus): string {
    return `status-${status.toLowerCase()}`;
  }

  lineStatusClass(status: OrderLine['status']): string {
    return `line-status-${status.toLowerCase()}`;
  }
}
