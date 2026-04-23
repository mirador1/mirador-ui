/**
 * SecuritySqliTabComponent — SQL Injection vulnerable-vs-safe demo (OWASP A03).
 *
 * Form field `name` uses Angular's `model<>()` API for two-way binding
 * — parent and widget share the same WritableSignal. Two action buttons
 * emit `runVulnerable` / `runSafe` events ; parent owns the HTTP fetch.
 *
 * Extracted from security.component.html per Phase B-7-4 batch, 2026-04-24.
 */
import { Component, computed, input, model, output } from '@angular/core';
import { JsonPipe } from '@angular/common';
import type { SqliResult } from '../security-types';

@Component({
  selector: 'app-security-sqli-tab',
  standalone: true,
  imports: [JsonPipe],
  styleUrl: '../security.component.scss',
  template: `
    <div class="tab-content">
      <div class="explanation-card warn">
        <strong>⚠️ SQL Injection (OWASP A03)</strong> — Unsanitised user input is concatenated
        directly into a SQL query, allowing an attacker to manipulate the query logic (e.g. bypass
        authentication or extract all rows). The backend endpoint at
        <code>/demo/security/sqli-vulnerable</code> builds the query as a string. The safe endpoint
        uses a JDBC <code>?</code> placeholder — the driver sends value and query separately, making
        injection structurally impossible.
      </div>

      <div class="input-row">
        <label class="input-label">Name parameter</label>
        <input
          type="text"
          class="demo-input"
          [value]="name()"
          (input)="name.set($any($event.target).value)"
        />
        <div class="preset-row">
          <span class="preset-label">Presets:</span>
          <button class="preset-btn" (click)="name.set(\`Alice' OR '1'='1\`)">Dump all rows</button>
          <button class="preset-btn" (click)="name.set(\`Alice'; DROP TABLE customer; --\`)">
            DROP TABLE (blocked by driver)
          </button>
          <button class="preset-btn" (click)="name.set('Alice')">Normal name</button>
        </div>
      </div>

      <div class="action-row">
        <button class="btn btn-danger" [disabled]="loading()" (click)="runVulnerable.emit()">
          💉 Vulnerable
        </button>
        <button class="btn btn-success" [disabled]="loading()" (click)="runSafe.emit()">
          🛡️ Safe
        </button>
      </div>

      @if (errorMsg()) {
        <div class="error-banner">{{ errorMsg() }}</div>
      }

      <div class="results-grid">
        @if (vulnResult(); as r) {
          <div class="result-card danger">
            <h3>Vulnerable Query</h3>
            <pre class="code-block">{{ r.query }}</pre>
            @if (r.vulnerability) {
              <div class="label-row">
                <span class="label label-red">Vulnerability</span> {{ r.vulnerability }}
              </div>
            }
            @if (r.exploit) {
              <div class="label-row">
                <span class="label label-red">Exploit</span> {{ r.exploit }}
              </div>
            }
            <h4>Results ({{ vulnResultRows().length }} rows)</h4>
            <pre class="code-block small">{{ vulnResultRows() | json }}</pre>
          </div>
        }
        @if (safeResult(); as r) {
          <div class="result-card safe">
            <h3>Safe Query</h3>
            <pre class="code-block">{{ r.query }}</pre>
            @if (r.fix) {
              <div class="label-row"><span class="label label-green">Fix</span> {{ r.fix }}</div>
            }
            <h4>Results ({{ safeResultRows().length }} rows)</h4>
            <pre class="code-block small">{{ safeResultRows() | json }}</pre>
          </div>
        }
      </div>
    </div>
  `,
})
export class SecuritySqliTabComponent {
  /** Two-way bound name field. Parent's writable signal. */
  readonly name = model<string>('Alice');
  readonly loading = input<boolean>(false);
  readonly errorMsg = input<string>('');
  readonly vulnResult = input<SqliResult | null>(null);
  readonly safeResult = input<SqliResult | null>(null);

  readonly runVulnerable = output<void>();
  readonly runSafe = output<void>();

  /** Helper : extract `results` rows from a SqliResult, or empty array. */
  readonly vulnResultRows = computed(() => this.vulnResult()?.results ?? []);
  readonly safeResultRows = computed(() => this.safeResult()?.results ?? []);
}
