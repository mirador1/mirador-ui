/**
 * SecurityHeadersTabComponent — live HTTP security-header verification.
 *
 * Renders a comparison table of expected vs actual security headers
 * (X-Content-Type-Options, X-Frame-Options, Content-Security-Policy,
 * Permissions-Policy, etc) on a sample response from the backend.
 * "Check live headers" button emits `loadRequested` ; parent owns the
 * HTTP fetch.
 *
 * Extracted from security.component.html (~42 LOC) per Phase B-7-4
 * follow-up, 2026-04-24. Same pattern as MechanismsTab + CorsTab.
 */
import { Component, input, output } from '@angular/core';
import type { HeaderMeta } from '../security-types';

@Component({
  selector: 'app-security-headers-tab',
  standalone: true,
  styleUrl: '../security.component.scss',
  template: `
    <div class="tab-content">
      <div class="explanation-card info">
        <strong>ℹ️ Security Headers</strong> — HTTP response headers that instruct the browser on
        security policies. Set by <code>SecurityHeadersFilter</code> on every response from this
        backend. The table below shows the expected value, the actual value from a live request, and
        an explanation of what each header does.
      </div>

      <div class="action-row">
        <button class="btn btn-ghost" [disabled]="loading()" (click)="loadRequested.emit()">
          {{ loading() ? '⟳ Loading…' : '↻ Check live headers' }}
        </button>
      </div>

      @if (errorMsg()) {
        <div class="error-banner">{{ errorMsg() }}</div>
      }

      @if (results().length) {
        <div class="headers-table">
          <div class="headers-row headers-header">
            <span>Header</span>
            <span>Expected</span>
            <span>Actual (live)</span>
            <span>Status</span>
            <span>Purpose</span>
          </div>
          @for (h of results(); track h.name) {
            <div class="headers-row" [class.headers-ok]="h.ok" [class.headers-missing]="!h.ok">
              <code class="header-name">{{ h.name }}</code>
              <code class="header-expected">{{ h.expected }}</code>
              <code class="header-actual">{{ h.actual }}</code>
              <span class="header-status">{{ h.ok ? '✅' : '⚠️' }}</span>
              <span class="header-explanation">{{ h.explanation }}</span>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class SecurityHeadersTabComponent {
  /** True while parent's HEAD /v3/api-docs (or similar) is in flight. */
  readonly loading = input<boolean>(false);
  /** Non-empty = show the red error banner. */
  readonly errorMsg = input<string>('');
  /** Header-comparison results from the parent's check. Empty = no data yet. */
  readonly results = input<HeaderMeta[]>([]);

  /** Emitted when user clicks ↻ Check live headers ; parent calls loadHeaders(). */
  readonly loadRequested = output<void>();
}
