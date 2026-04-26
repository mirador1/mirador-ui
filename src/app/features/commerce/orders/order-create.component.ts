import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ApiService, Customer, OrderLine, Product } from '../../../core/api/api.service';
import { ToastService } from '../../../core/toast/toast.service';

/**
 * Order create form v2 — autocomplete customer + dynamic lines + live total.
 *
 * Pattern (per shared ADR-0059):
 *   The unit price snapshot displayed inline is the LIVE Product.unitPrice
 *   AT THE TIME of selection. The actual snapshot is taken server-side when
 *   POST /orders/{id}/lines runs — so a price update between picking and
 *   submitting may produce a slightly different total than the UI showed.
 *   We surface this with an info hint near the total. The backend remains
 *   the source of truth ; UI total is a best-effort preview.
 *
 * Flow on submit :
 *   1. POST /orders {customerId} → server-assigned id
 *   2. For each draft line, POST /orders/{id}/lines {productId, quantity}
 *      sequentially (so a 422 stops the chain + the partial order remains
 *      so the user can fix + resume on the detail page).
 *   3. Navigate to /orders/{id}
 *
 * Standalone, OnPush, signals only — no ngModel. Mobile-responsive with
 * 44 px tap targets matching the foundation Orders / Products pages.
 */

/**
 * In-memory draft of an OrderLine before the order even exists.
 * `unitPriceSnapshot` is purely for UI total preview ; the backend
 * re-snapshots authoritatively on POST.
 */
interface OrderLineDraft {
  /** Auto-incremented client-side ID (used as @for trackBy key). */
  draftId: number;
  /** FK to Product. */
  productId: number;
  /** Display name kept locally so the list re-renders without re-fetching. */
  productName: string;
  /** Strictly positive quantity. */
  quantity: number;
  /** Snapshot of Product.unitPrice at picking time — UI preview only. */
  unitPriceSnapshot: number;
}

@Component({
  selector: 'app-order-create',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './order-create.component.html',
  styleUrl: './order-create.component.scss',
})
export class OrderCreateComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  // ── Customer autocomplete ────────────────────────────────────────────────
  readonly customerQuery = signal<string>('');
  readonly customerResults = signal<Customer[]>([]);
  readonly customerLoading = signal<boolean>(false);
  readonly selectedCustomer = signal<Customer | null>(null);
  readonly customerDropdownOpen = signal<boolean>(false);

  private customerSearchTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Product picker (for adding lines) ────────────────────────────────────
  readonly productPickerOpen = signal<boolean>(false);
  readonly productQuery = signal<string>('');
  readonly productResults = signal<Product[]>([]);
  readonly productLoading = signal<boolean>(false);

  private productSearchTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Draft lines ──────────────────────────────────────────────────────────
  readonly lines = signal<OrderLineDraft[]>([]);
  private nextDraftId = 1;

  // ── Submit state ─────────────────────────────────────────────────────────
  readonly submitting = signal<boolean>(false);

  // ── Computed ─────────────────────────────────────────────────────────────
  readonly total = computed(() =>
    this.lines().reduce((acc, l) => acc + l.quantity * l.unitPriceSnapshot, 0),
  );

  readonly canSubmit = computed(
    () => !!this.selectedCustomer() && this.lines().length > 0 && !this.submitting(),
  );

  // ── Customer search ──────────────────────────────────────────────────────

  onCustomerInput(value: string): void {
    this.customerQuery.set(value);
    this.selectedCustomer.set(null); // clearing the picked customer if user re-types
    this.customerDropdownOpen.set(true);
    if (this.customerSearchTimer) clearTimeout(this.customerSearchTimer);
    if (!value.trim()) {
      this.customerResults.set([]);
      return;
    }
    this.customerSearchTimer = setTimeout(() => this.runCustomerSearch(value), 300);
  }

  private runCustomerSearch(query: string): void {
    this.customerLoading.set(true);
    // getCustomers supports a `search` parameter — first 10 results suffice
    // for an autocomplete dropdown ; deeper paging would clutter the UI.
    this.api
      .getCustomers(0, 10, '1.0', query.trim())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.customerResults.set(page.content);
          this.customerLoading.set(false);
        },
        error: (err) => {
          this.customerLoading.set(false);
          this.toast.show(`Customer search failed: ${err?.message ?? 'unknown'}`, 'error');
        },
      });
  }

  pickCustomer(c: Customer): void {
    this.selectedCustomer.set(c);
    this.customerQuery.set(c.name);
    this.customerDropdownOpen.set(false);
  }

  clearCustomer(): void {
    this.selectedCustomer.set(null);
    this.customerQuery.set('');
    this.customerResults.set([]);
    this.customerDropdownOpen.set(false);
  }

  // ── Product picker (line addition) ───────────────────────────────────────

  openProductPicker(): void {
    this.productPickerOpen.set(true);
    this.productQuery.set('');
    this.productResults.set([]);
    // Pre-load first page so the picker isn't empty before any keystroke.
    this.runProductSearch('');
  }

  closeProductPicker(): void {
    this.productPickerOpen.set(false);
  }

  onProductInput(value: string): void {
    this.productQuery.set(value);
    if (this.productSearchTimer) clearTimeout(this.productSearchTimer);
    this.productSearchTimer = setTimeout(() => this.runProductSearch(value), 300);
  }

  private runProductSearch(query: string): void {
    this.productLoading.set(true);
    // Backend product list endpoint has no `search` param yet — we filter
    // client-side on the first 50 to keep the dropdown responsive without
    // adding a backend dependency for this MR. Replace with server-side
    // search once /products?search= ships.
    this.api
      .listProducts(0, 50)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          const q = query.trim().toLowerCase();
          const filtered = q
            ? page.content.filter((p) => p.name.toLowerCase().includes(q))
            : page.content;
          this.productResults.set(filtered);
          this.productLoading.set(false);
        },
        error: (err) => {
          this.productLoading.set(false);
          this.toast.show(`Product search failed: ${err?.message ?? 'unknown'}`, 'error');
        },
      });
  }

  pickProduct(p: Product): void {
    if (p.id == null) return;
    this.lines.update((arr) => [
      ...arr,
      {
        draftId: this.nextDraftId++,
        productId: p.id as number,
        productName: p.name,
        quantity: 1,
        unitPriceSnapshot: p.unitPrice,
      },
    ]);
    this.closeProductPicker();
  }

  // ── Line edit ────────────────────────────────────────────────────────────

  setLineQuantity(draftId: number, value: string): void {
    const qty = Number(value);
    if (!Number.isFinite(qty) || qty < 1) return;
    this.lines.update((arr) =>
      arr.map((l) => (l.draftId === draftId ? { ...l, quantity: Math.floor(qty) } : l)),
    );
  }

  removeLine(draftId: number): void {
    this.lines.update((arr) => arr.filter((l) => l.draftId !== draftId));
  }

  // ── Submit ───────────────────────────────────────────────────────────────

  submit(): void {
    const customer = this.selectedCustomer();
    if (!customer || customer.id == null || this.lines().length === 0) return;
    this.submitting.set(true);
    this.api
      .createOrder({ customerId: customer.id })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (order) => {
          if (order.id == null) {
            this.submitting.set(false);
            this.toast.show('Order created but no id returned', 'error');
            return;
          }
          this.toast.show(`✓ Order #${order.id} created — adding ${this.lines().length} line(s)…`);
          this.addLinesSequentially(order.id, [...this.lines()]);
        },
        error: (err) => {
          this.submitting.set(false);
          if (err?.status === 422) {
            this.toast.show(`Customer #${customer.id} not found`, 'error');
          } else {
            this.toast.show(`Order create failed: ${err?.message ?? 'unknown'}`, 'error');
          }
        },
      });
  }

  /**
   * Sequentially POST each line. Sequential (not parallel) so the backend
   * sees a deterministic order and the running Order.totalAmount stays
   * monotonic — also makes a 422 on line N stop at line N (partial order
   * persists, the user lands on the detail page with the lines that did
   * succeed + can fix the rest).
   */
  private addLinesSequentially(orderId: number, queue: OrderLineDraft[]): void {
    if (queue.length === 0) {
      this.submitting.set(false);
      this.toast.show(`✓ Order #${orderId} ready`);
      void this.router.navigate(['/orders', orderId]);
      return;
    }
    const [head, ...tail] = queue;
    this.api
      .addOrderLine(orderId, { productId: head.productId, quantity: head.quantity })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (line: OrderLine) => {
          this.toast.show(`+ Line for "${head.productName}" added (line #${line.id})`, 'success');
          this.addLinesSequentially(orderId, tail);
        },
        error: (err) => {
          this.submitting.set(false);
          this.toast.show(
            `Line for "${head.productName}" failed (${err?.status ?? '?'}): ${err?.message ?? 'unknown'}. Order #${orderId} kept — fix on detail page.`,
            'error',
          );
          // Even on failure, we navigate to the detail page so the user
          // sees what landed + can resume manually. The created order is
          // never silently lost.
          void this.router.navigate(['/orders', orderId]);
        },
      });
  }

  cancel(): void {
    void this.router.navigate(['/orders']);
  }
}
