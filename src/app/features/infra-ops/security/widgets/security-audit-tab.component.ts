/**
 * SecurityAuditTabComponent — paginated audit-event table with filters.
 *
 * Filter fields (action + user) two-way bound via `model<>()`. Pagination
 * + apply emit events ; parent owns the HTTP fetch + filter state.
 *
 * Extracted from security.component.html per Phase B-7-4 batch, 2026-04-24.
 */
import { Component, input, model, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import type { AuditPage } from '../security-types';

@Component({
  selector: 'app-security-audit-tab',
  standalone: true,
  imports: [DatePipe],
  styleUrl: '../security.component.scss',
  template: `
    <div class="tab-pane">
      <p class="tab-intro">
        Trace of all security events and data mutations recorded by the backend. Auto-refreshes
        every 30 s.
      </p>

      <!-- Legend -->
      <div class="event-legend">
        <span class="legend-item"><span class="badge badge-blue">LOGIN_SUCCESS</span></span>
        <span class="legend-item"><span class="badge badge-blue">LOGIN_FAILED</span></span>
        <span class="legend-item"><span class="badge badge-red">LOGIN_BLOCKED</span></span>
        <span class="legend-item"><span class="badge badge-blue">TOKEN_REFRESH</span></span>
        <span class="legend-item"><span class="badge badge-green">CUSTOMER_*</span></span>
      </div>

      <!-- Filters -->
      <div class="filter-bar">
        <select
          class="filter-select"
          [value]="filterAction()"
          (change)="filterAction.set($any($event.target).value); applyRequested.emit()"
        >
          <option value="">All actions</option>
          @for (a of actions(); track a) {
            <option [value]="a">{{ a }}</option>
          }
        </select>
        <input
          type="text"
          class="filter-input"
          placeholder="Filter by user…"
          [value]="filterUser()"
          (input)="filterUser.set($any($event.target).value)"
          (keydown.enter)="applyRequested.emit()"
        />
        <button class="run-btn" (click)="applyRequested.emit()">Apply</button>
        <button
          class="run-btn"
          (click)="filterAction.set(''); filterUser.set(''); applyRequested.emit()"
        >
          Clear
        </button>
        @if (loading()) {
          <span class="muted">⟳ Loading…</span>
        }
        @if (totalElements()) {
          <span class="muted">{{ totalElements() }} events</span>
        }
      </div>

      @if (errorMsg()) {
        <div class="alert-error">{{ errorMsg() }}</div>
      }

      <div class="table-wrapper">
        <table class="audit-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Action</th>
              <th>User</th>
              <th>Detail</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            @for (event of data()?.content ?? []; track event.id) {
              <tr>
                <td class="ts">{{ event.createdAt | date: 'yyyy-MM-dd HH:mm:ss' }}</td>
                <td>
                  <span class="badge" [class]="badgeClass(event.action)">{{ event.action }}</span>
                </td>
                <td class="user">{{ event.userName }}</td>
                <td class="detail">{{ event.detail }}</td>
                <td class="ip">{{ event.ipAddress }}</td>
              </tr>
            }
            @if (data() && data()!.content.length === 0) {
              <tr>
                <td colspan="5" class="muted">No audit events found.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <div class="pagination">
        <button class="run-btn" [disabled]="page() === 0" (click)="prevRequested.emit()">
          ← Prev
        </button>
        <span class="muted">Page {{ page() + 1 }} / {{ totalPages() }}</span>
        <button
          class="run-btn"
          [disabled]="page() >= totalPages() - 1"
          (click)="nextRequested.emit()"
        >
          Next →
        </button>
      </div>
    </div>
  `,
})
export class SecurityAuditTabComponent {
  readonly filterAction = model<string>('');
  readonly filterUser = model<string>('');
  readonly actions = input<readonly string[]>([]);
  readonly loading = input<boolean>(false);
  readonly errorMsg = input<string>('');
  readonly data = input<AuditPage | null>(null);
  readonly totalElements = input<number>(0);
  readonly totalPages = input<number>(0);
  readonly page = input<number>(0);

  readonly applyRequested = output<void>();
  readonly prevRequested = output<void>();
  readonly nextRequested = output<void>();

  /**
   * Maps an audit action to a badge colour. Logic moved from parent's
   * `auditBadgeClass()` ; matches the legend's colour scheme.
   */
  badgeClass(action: string): string {
    if (action === 'LOGIN_BLOCKED') return 'badge-red';
    if (action.startsWith('LOGIN') || action === 'TOKEN_REFRESH' || action === 'API_KEY_AUTH')
      return 'badge-blue';
    if (action.startsWith('CUSTOMER')) return 'badge-green';
    return 'badge-gray';
  }
}
