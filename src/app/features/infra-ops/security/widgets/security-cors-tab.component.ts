/**
 * SecurityCorsTabComponent — CORS policy explanation + live config.
 *
 * Renders the current CORS configuration from the backend (currentOriginPolicy,
 * dangerousConfig, yourOrigin, risk, attack vector, fix) in a 6-card grid.
 * Refresh button emits `refreshRequested` ; parent owns the HTTP call.
 *
 * Extracted from security.component.html (~54 LOC) per Phase B-7-4
 * follow-up, 2026-04-24. Same pattern as SecurityMechanismsTab (ADR-0056).
 */
import { Component, input, output } from '@angular/core';
import type { CorsInfo } from '../security-types';

@Component({
  selector: 'app-security-cors-tab',
  standalone: true,
  styleUrl: '../security.component.scss',
  template: `
    <div class="tab-content">
      <div class="explanation-card info">
        <strong>ℹ️ Cross-Origin Resource Sharing (CORS)</strong> — Browsers enforce the same-origin
        policy. CORS headers tell the browser which origins are allowed to make cross-origin
        requests. A misconfigured CORS policy (e.g. <code>Access-Control-Allow-Origin: *</code> with
        credentials) can let an attacker steal authenticated data.
        <br />
        This project's CORS is <strong>correctly restricted</strong> to
        <code>http://localhost:4200</code> only.
      </div>

      @if (loading()) {
        <div class="loading-row">⟳ Loading CORS info…</div>
      }

      @if (errorMsg()) {
        <div class="error-banner">{{ errorMsg() }}</div>
      }

      @if (info(); as c) {
        <div class="cors-grid">
          <div class="cors-card">
            <div class="cors-label">Current Origin Policy</div>
            <code class="cors-value">{{ c.currentOriginPolicy }}</code>
          </div>
          <div class="cors-card cors-danger">
            <div class="cors-label">Dangerous Config</div>
            <code class="cors-value">{{ c.dangerousConfig }}</code>
          </div>
          <div class="cors-card">
            <div class="cors-label">Your Origin</div>
            <code class="cors-value">{{ c.yourOrigin }}</code>
          </div>
          <div class="cors-card cors-danger">
            <div class="cors-label">Risk</div>
            <span class="cors-value text">{{ c.risk }}</span>
          </div>
          <div class="cors-card cors-full">
            <div class="cors-label">Attack Vector</div>
            <span class="cors-value text">{{ c.attack }}</span>
          </div>
          <div class="cors-card cors-full cors-safe">
            <div class="cors-label">Fix</div>
            <span class="cors-value text">{{ c.fix }}</span>
          </div>
        </div>

        <button class="btn btn-ghost mt-1" (click)="refreshRequested.emit()">↻ Refresh</button>
      }
    </div>
  `,
})
export class SecurityCorsTabComponent {
  /** True while parent's GET /security/cors-info is in flight. */
  readonly loading = input<boolean>(false);
  /** Non-empty = show the red error banner. */
  readonly errorMsg = input<string>('');
  /** CORS info payload from backend. Null while loading. */
  readonly info = input<CorsInfo | null>(null);

  /** Emitted when user clicks ↻ Refresh ; parent calls loadCors(). */
  readonly refreshRequested = output<void>();
}
