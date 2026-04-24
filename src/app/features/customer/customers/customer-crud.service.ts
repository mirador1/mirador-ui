/**
 * CustomerCrudService — Single-customer CRUD (edit + delete + random
 * create) extracted from CustomersComponent.
 *
 * Step 3 of B-7-2c after ImportExport (step 1) + Selection (step 2).
 * Owns the modal state (editingCustomer / deletingCustomer) + their
 * loading flags + the actual HTTP round-trips through ApiService.
 *
 * Parent delegates via thin wrappers + passes an `onAfterChange()`
 * callback to reload the list after any successful mutation.
 *
 * Extracted 2026-04-24.
 */
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiService, Customer } from '../../../core/api/api.service';
import { ActivityService } from '../../../core/activity/activity.service';
import { ToastService } from '../../../core/toast/toast.service';
import { httpError, randomCustomer } from './customers-helpers';

@Injectable({ providedIn: 'root' })
export class CustomerCrudService {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly activity = inject(ActivityService);
  private readonly destroyRef = inject(DestroyRef);

  // ── Edit modal ────────────────────────────────────────────────────────

  /** Customer currently being edited (null = modal closed). */
  readonly editingCustomer = signal<Customer | null>(null);

  /** Edit modal input bindings (non-signal — bound via ngModel). */
  editName = '';
  editEmail = '';

  /** True while PUT /customers/{id} is in flight. */
  readonly editLoading = signal(false);

  /** Error message from the last failed edit attempt. */
  readonly editError = signal('');

  // ── Single delete modal ───────────────────────────────────────────────

  /** Customer shown in the delete confirmation (null = no dialog). */
  readonly deletingCustomer = signal<Customer | null>(null);

  /** True while DELETE /customers/{id} is in flight. */
  readonly deleteLoading = signal(false);

  // ── Random create ─────────────────────────────────────────────────────

  /** True while POST /customers with random data is in flight. */
  readonly randomCreateLoading = signal(false);

  /** Error from last random-create attempt. */
  readonly randomCreateError = signal('');

  /** Result of last successful random-create. */
  readonly randomCreateSuccess = signal<Customer | null>(null);

  // ── Edit actions ──────────────────────────────────────────────────────

  openEdit(c: Customer): void {
    this.editingCustomer.set(c);
    this.editName = c.name;
    this.editEmail = c.email;
    this.editError.set('');
  }

  cancelEdit(): void {
    this.editingCustomer.set(null);
  }

  saveEdit(onAfterChange: () => void): void {
    const c = this.editingCustomer();
    if (!c?.id || !this.editName.trim() || !this.editEmail.trim()) return;
    this.editLoading.set(true);
    this.editError.set('');

    this.api
      .updateCustomer(c.id, { name: this.editName.trim(), email: this.editEmail.trim() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.editingCustomer.set(null);
          this.editLoading.set(false);
          this.toast.show(`Customer "${updated.name}" updated`, 'success');
          this.activity.log('customer-update', `Updated "${updated.name}" (ID ${updated.id})`);
          onAfterChange();
        },
        error: (err) => {
          this.editError.set(httpError(err));
          this.editLoading.set(false);
        },
      });
  }

  // ── Single delete actions ─────────────────────────────────────────────

  openDelete(c: Customer): void {
    this.deletingCustomer.set(c);
  }

  cancelDelete(): void {
    this.deletingCustomer.set(null);
  }

  confirmDelete(onAfterChange: () => void): void {
    const c = this.deletingCustomer();
    if (!c?.id) return;
    this.deleteLoading.set(true);

    this.api
      .deleteCustomer(c.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.deletingCustomer.set(null);
          this.deleteLoading.set(false);
          this.toast.show(`Customer "${c.name}" deleted`, 'success');
          this.activity.log('customer-delete', `Deleted "${c.name}" (ID ${c.id})`);
          onAfterChange();
        },
        error: (err) => {
          this.deleteLoading.set(false);
          this.toast.show(httpError(err), 'error');
          this.deletingCustomer.set(null);
        },
      });
  }

  // ── Random create ─────────────────────────────────────────────────────

  /**
   * Create a customer with random name + email in one POST. Used by the
   * "🎲 Add random customer" button on the create form widget. Emits
   * activity event + triggers list reload via `onAfterChange()`.
   */
  addRandomCustomer(onAfterChange: () => void): void {
    const { name, email } = randomCustomer();
    this.randomCreateLoading.set(true);
    this.randomCreateError.set('');
    this.randomCreateSuccess.set(null);

    this.api
      .createCustomer({ name, email })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (c) => {
          this.randomCreateSuccess.set(c);
          this.randomCreateLoading.set(false);
          this.toast.show(`Random customer "${c.name}" created (ID ${c.id})`, 'success');
          this.activity.log('customer-create', `Random-created "${c.name}" (ID ${c.id})`);
          onAfterChange();
        },
        error: (err) => {
          this.randomCreateError.set(httpError(err));
          this.randomCreateLoading.set(false);
        },
      });
  }
}
