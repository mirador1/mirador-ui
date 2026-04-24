/**
 * CustomerImportExportService — Isolates the file I/O concerns from
 * CustomersComponent (bulk CSV/JSON import + export).
 *
 * Self-contained : owns its own progress signals (importLoading /
 * importProgress / importTotal / importResults) and runs HTTP batches
 * via ApiService. Parent component delegates the file input change
 * event + passes the current customer list for export operations.
 *
 * Extracted from customers.component.ts per B-7-2c Step 1, 2026-04-24 —
 * cleanest boundary out of the 30+ methods in the parent (zero overlap
 * with list / detail / selection state).
 */
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiService, Customer, CustomerSummary } from '../../../core/api/api.service';
import { ActivityService } from '../../../core/activity/activity.service';
import { ToastService } from '../../../core/toast/toast.service';

@Injectable({ providedIn: 'root' })
export class CustomerImportExportService {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly activity = inject(ActivityService);
  private readonly destroyRef = inject(DestroyRef);

  /** True while a bulk POST /customers batch is in flight. */
  readonly importLoading = signal(false);

  /** Number of records successfully POSTed so far (for progress display). */
  readonly importProgress = signal(0);

  /** Total records in the current import batch. */
  readonly importTotal = signal(0);

  /** Summary of the last completed import (ok vs errors). Null until first run. */
  readonly importResults = signal<{ ok: number; errors: number } | null>(null);

  /**
   * Handles a file input <input type="file"> change event. Parses JSON or
   * CSV, then runs a bulk POST /customers batch. On completion, fires
   * `onComplete()` so the parent can refresh its list view.
   */
  handleFileSelected(event: Event, onComplete: () => void): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result as string;
      // Declared without initialiser — every branch below assigns `records`
      // before the first read (the dead initial `[]` tripped
      // `no-useless-assignment`).
      let records: { name: string; email: string }[];

      if (file.name.endsWith('.json')) {
        try {
          records = JSON.parse(content);
          if (!Array.isArray(records)) records = [records];
        } catch {
          this.toast.show('Invalid JSON file', 'error');
          return;
        }
      } else if (file.name.endsWith('.csv')) {
        const lines = content.split('\n').filter((l) => l.trim());
        const header = lines[0].toLowerCase();
        const hasHeader = header.includes('name') && header.includes('email');
        const dataLines = hasHeader ? lines.slice(1) : lines;
        records = dataLines
          .map((line) => {
            const parts = line.split(',').map((s) => s.trim().replace(/^"|"$/g, ''));
            return { name: parts[0] || '', email: parts[1] || '' };
          })
          .filter((r) => r.name && r.email);
      } else {
        this.toast.show('Unsupported file type. Use .json or .csv', 'error');
        return;
      }

      if (!records.length) {
        this.toast.show('No valid records found in file', 'warn');
        return;
      }

      this.executeBulkImport(records, onComplete);
    };
    reader.readAsText(file);
    input.value = ''; // reset so same file can be re-selected
  }

  /**
   * Download the current customer list (full or summary) as formatted JSON.
   * Parent passes the live array — service doesn't store a reference to
   * the parent's signal, keeping the boundary one-way.
   */
  exportJson(data: Customer[] | CustomerSummary[] | undefined | null): void {
    if (!data?.length) return;
    this.downloadFile(JSON.stringify(data, null, 2), 'customers.json', 'application/json');
  }

  /**
   * Download full customer list as CSV. Columns depend on `apiVersion` :
   * v2 adds a `createdAt` column (v1 schema).
   */
  exportCsv(data: Customer[] | undefined | null, apiVersion: '1.0' | '2.0'): void {
    if (!data?.length) return;
    const headers = ['id', 'name', 'email'];
    if (apiVersion === '2.0') headers.push('createdAt');

    const rows = data.map((c) =>
      headers
        .map((h) => {
          const val = (c as unknown as Record<string, unknown>)[h] ?? '';
          return `"${String(val).replace(/"/g, '""')}"`;
        })
        .join(','),
    );
    this.downloadFile([headers.join(','), ...rows].join('\n'), 'customers.csv', 'text/csv');
  }

  private executeBulkImport(
    records: { name: string; email: string }[],
    onComplete: () => void,
  ): void {
    this.importLoading.set(true);
    this.importProgress.set(0);
    this.importTotal.set(records.length);
    this.importResults.set(null);

    let ok = 0;
    let errors = 0;
    let done = 0;

    for (const record of records) {
      this.api
        .createCustomer(record)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            ok++;
            done++;
            this.importProgress.set(done);
            this.checkImportDone(done, records.length, ok, errors, onComplete);
          },
          error: () => {
            errors++;
            done++;
            this.importProgress.set(done);
            this.checkImportDone(done, records.length, ok, errors, onComplete);
          },
        });
    }
  }

  private checkImportDone(
    done: number,
    total: number,
    ok: number,
    errors: number,
    onComplete: () => void,
  ): void {
    if (done < total) return;
    this.importLoading.set(false);
    this.importResults.set({ ok, errors });
    this.toast.show(
      `Import complete: ${ok} created, ${errors} failed`,
      errors > 0 ? 'warn' : 'success',
    );
    this.activity.log(
      'bulk-import',
      `Imported ${ok} customers (${errors} errors)`,
      `Total: ${total} records`,
    );
    onComplete();
  }

  private downloadFile(content: string, filename: string, mime: string): void {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
