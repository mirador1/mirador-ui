/**
 * CustomerSelectionService — Batch selection + batch-delete concern
 * extracted from CustomersComponent.
 *
 * Bounded scope : owns selectedIds (Set<number>) + selectAll state +
 * the batch-delete dialog state + loading flag. Parent provides the
 * current page content (for select-all) and an onAfterDelete callback
 * to reload the list after a successful bulk delete.
 *
 * Self-contained : injects ApiService + ToastService + DestroyRef.
 *
 * Extracted per B-7-2c Step 2, 2026-04-24 — same idiom as
 * CustomerImportExportService (Step 1). No overlap with list
 * pagination, detail view, or CRUD edit/single-delete state.
 */
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiService, Customer } from '../../../core/api/api.service';
import { ToastService } from '../../../core/toast/toast.service';

@Injectable({ providedIn: 'root' })
export class CustomerSelectionService {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  /** IDs of customers currently selected for batch operations. */
  readonly selectedIds = signal<Set<number>>(new Set());

  /** True when every row on the current page is selected. */
  readonly selectAll = signal(false);

  /** Convenience : any selection active. */
  readonly hasSelection = computed(() => this.selectedIds().size > 0);

  /** Gate for the "Confirm batch delete" modal. */
  readonly confirmBatchDelete = signal(false);

  /** True while parallel DELETE /customers/{id} requests are in flight. */
  readonly batchDeleteLoading = signal(false);

  /**
   * Toggle all-or-none selection for the current page. Parent passes
   * the page content (it's the only side with access to the paginated
   * customers signal) ; service updates the Set accordingly.
   */
  toggleSelectAll(pageContent: Customer[]): void {
    if (this.selectAll()) {
      this.selectedIds.set(new Set());
      this.selectAll.set(false);
    } else {
      this.selectedIds.set(new Set(pageContent.map((c) => c.id!)));
      this.selectAll.set(true);
    }
  }

  /** Toggle a single customer's membership in the selection set. */
  toggleSelectOne(id: number): void {
    this.selectedIds.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /** Open the confirm dialog for batch delete. */
  openBatchDelete(): void {
    this.confirmBatchDelete.set(true);
  }

  /** Close the confirm dialog without deleting. */
  cancelBatchDelete(): void {
    this.confirmBatchDelete.set(false);
  }

  /** Reset all selection state (used on explicit clear or after delete). */
  clearSelection(): void {
    this.selectedIds.set(new Set());
    this.selectAll.set(false);
  }

  /**
   * Execute parallel DELETEs for every selected ID. On completion,
   * fires `onAfterDelete()` so the parent can reload the paginated
   * list. Clears the selection + closes the modal in all cases.
   */
  executeBatchDelete(onAfterDelete: () => void): void {
    const ids = [...this.selectedIds()];
    if (!ids.length) return;
    this.batchDeleteLoading.set(true);

    let completed = 0;
    let errors = 0;
    for (const id of ids) {
      this.api
        .deleteCustomer(id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            completed++;
            if (completed + errors === ids.length) {
              this.finishBatchDelete(completed, errors, onAfterDelete);
            }
          },
          error: () => {
            errors++;
            if (completed + errors === ids.length) {
              this.finishBatchDelete(completed, errors, onAfterDelete);
            }
          },
        });
    }
  }

  private finishBatchDelete(ok: number, err: number, onAfterDelete: () => void): void {
    this.batchDeleteLoading.set(false);
    this.confirmBatchDelete.set(false);
    this.clearSelection();
    if (err > 0) {
      this.toast.show(`Deleted ${ok} customers, ${err} failed`, 'warn');
    } else {
      this.toast.show(`Deleted ${ok} customers`, 'success');
    }
    onAfterDelete();
  }
}
