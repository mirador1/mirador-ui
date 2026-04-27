import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService, Order, OrderLine, OrderStatus } from '../../../core/api/api.service';
import { ToastService } from '../../../core/toast/toast.service';

/**
 * Order edit page — line management + status update.
 *
 * Route : `/orders/:id/edit`. Foundation follow-up MR — the existing
 * `/orders/:id` page is a static read-only view ; this page lets the
 * user mutate the line set (add / cancel) AND change the order status
 * (since 2026-04-27, paired with PUT /orders/{id}/status backend MRs).
 *
 * Status select is now functional :
 * - `statusDraft` mirrors the user's choice in the dropdown.
 * - `isStatusDirty` (computed) tells whether draft ≠ persisted.
 * - "Save status" button is enabled iff dirty + the selection isn't a
 *   forbidden transition (state-machine check pre-rejects locally for
 *   instant feedback ; backend re-validates and 409s on edge cases).
 * - On 409 from the backend, the toast surfaces currentStatus +
 *   targetStatus from the ProblemDetail body so the user sees why.
 *
 * Per shared ADR-0059 : "cancel" of a line means DELETE the line, which
 * triggers backend total recompute. Per-line refund state machine
 * (PENDING → SHIPPED → REFUNDED, ADR-0063) is a separate follow-up.
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
  // The Save Status button is gated on isStatusDirty.
  readonly statusDraft = signal<OrderStatus>('PENDING');
  readonly statusSaving = signal<boolean>(false);

  // Persisted status mirror (set on every reload) — drives the dirty check.
  readonly persistedStatus = computed<OrderStatus | null>(() => this.order()?.status ?? null);

  /**
   * Dirty when the dropdown choice differs from the persisted status.
   * The Save button is enabled iff dirty AND the local state-machine
   * check accepts the transition (pre-rejection for snappier feedback ;
   * backend re-validates and 409s on edge cases).
   */
  readonly isStatusDirty = computed(() => {
    const persisted = this.persistedStatus();
    return persisted !== null && this.statusDraft() !== persisted;
  });

  /** Local state-machine check — mirrors OrderStatus#canTransitionTo. */
  readonly canSaveStatus = computed(() => {
    const persisted = this.persistedStatus();
    if (persisted === null || !this.isStatusDirty() || this.statusSaving()) return false;
    const target = this.statusDraft();
    return OrderEditComponent.isAllowedTransition(persisted, target);
  });

  static isAllowedTransition(current: OrderStatus, target: OrderStatus): boolean {
    if (current === target) return true;
    switch (current) {
      case 'PENDING':
        return target === 'CONFIRMED' || target === 'CANCELLED';
      case 'CONFIRMED':
        return target === 'SHIPPED' || target === 'CANCELLED';
      case 'SHIPPED':
      case 'CANCELLED':
        return false;
    }
  }

  // All allowed transitions surfaced ; backend gates invalid ones via
  // 409 on PUT /orders/{id}/status with currentStatus + targetStatus
  // in the ProblemDetail body.
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

  /** Status-select change handler — pushes into the dirty-tracked draft. */
  onStatusChange(value: string): void {
    // Cast is safe : the <select> options are populated from `statusOptions`
    // which is `OrderStatus[]`. canSaveStatus + isStatusDirty pick up the
    // mutation through the signal; no extra wiring needed.
    this.statusDraft.set(value as OrderStatus);
  }

  /**
   * Persist the draft status via PUT /orders/{id}/status.
   *
   * - 200 → toast success, refresh the persisted state.
   * - 409 → backend's state-machine rejected the transition. Surface
   *   currentStatus + targetStatus from the ProblemDetail body so the
   *   user sees exactly why.
   * - 422 → unknown enum value (shouldn't happen since the dropdown is
   *   typed, but defensive).
   * - 404 → another tab deleted the order ; bounce to the list.
   */
  saveStatus(): void {
    const id = this.orderId();
    if (id === null || !this.canSaveStatus()) return;
    const target = this.statusDraft();
    this.statusSaving.set(true);
    this.api.updateOrderStatus(id, target).subscribe({
      next: (updated) => {
        this.statusSaving.set(false);
        this.order.set(updated);
        this.statusDraft.set(updated.status);
        this.toast.show(`Status updated to ${updated.status}`);
      },
      error: (err: {
        status?: number;
        error?: { currentStatus?: string; targetStatus?: string };
        message?: string;
      }) => {
        this.statusSaving.set(false);
        if (err?.status === 409 && err.error?.currentStatus && err.error?.targetStatus) {
          this.toast.show(
            `Cannot transition from ${err.error.currentStatus} to ${err.error.targetStatus}`,
            'error',
          );
        } else if (err?.status === 404) {
          this.toast.show(`Order #${id} not found`, 'error');
          this.router.navigate(['/orders']);
        } else {
          this.toast.show(`Save status failed: ${err?.message ?? 'unknown'}`, 'error');
        }
      },
    });
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
