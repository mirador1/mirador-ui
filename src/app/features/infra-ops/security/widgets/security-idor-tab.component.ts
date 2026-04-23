/**
 * SecurityIdorTabComponent — Insecure Direct Object Reference demo (OWASP A01).
 *
 * Form field `id` two-way bound via `model<>()`. Two action buttons
 * (Vulnerable / Safe) emit events ; parent does the HTTP fetch.
 *
 * Extracted from security.component.html per Phase B-7-4 batch, 2026-04-24.
 */
import { Component, input, model, output } from '@angular/core';
import { JsonPipe } from '@angular/common';
import type { IdorResult } from '../security-types';

@Component({
  selector: 'app-security-idor-tab',
  standalone: true,
  imports: [JsonPipe],
  styleUrl: '../security.component.scss',
  template: `
    <div class="tab-content">
      <div class="explanation-card warn">
        <strong>⚠️ IDOR / BOLA (OWASP A01)</strong> — Insecure Direct Object Reference. An endpoint
        that retrieves a resource by ID without checking whether the caller owns or has permission
        to access that specific object. An attacker simply increments the ID to enumerate all
        records.
        <br />
        This is the <strong>#1 OWASP API vulnerability</strong> (Broken Object Level Authorization).
        <br />
        The vulnerable endpoint at <code>/demo/security/idor-vulnerable?id=N</code> returns any
        customer record with no ownership check. The safe response shows the query pattern and
        Spring annotation that would prevent this.
      </div>

      <div class="input-row">
        <label class="input-label">Customer ID</label>
        <input
          type="number"
          class="demo-input"
          style="max-width: 140px"
          [value]="id()"
          (input)="id.set(+$any($event.target).value)"
          min="1"
        />
        <div class="preset-row">
          <span class="preset-label">Try enumerating:</span>
          @for (n of [1, 2, 3, 4, 5]; track n) {
            <button class="preset-btn" (click)="id.set(n)">id={{ n }}</button>
          }
        </div>
      </div>

      <div class="action-row">
        <button class="btn btn-danger" [disabled]="loading()" (click)="runVulnerable.emit()">
          🔓 Vulnerable — no auth check
        </button>
        <button class="btn btn-success" [disabled]="loading()" (click)="runSafe.emit()">
          🛡️ Safe — ownership pattern
        </button>
      </div>

      @if (errorMsg()) {
        <div class="error-banner">{{ errorMsg() }}</div>
      }

      <div class="results-grid">
        @if (vulnResult(); as r) {
          <div class="result-card danger">
            <h3>Vulnerable — No ownership check</h3>
            @if (r.owaspCategory) {
              <div class="label-row">
                <span class="label label-red">OWASP</span> {{ r.owaspCategory }}
              </div>
            }
            @if (r.vulnerability) {
              <div class="label-row">
                <span class="label label-red">Issue</span> {{ r.vulnerability }}
              </div>
            }
            @if (r.exploit) {
              <div class="label-row">
                <span class="label label-red">Exploit</span> {{ r.exploit }}
              </div>
            }
            <h4>Data returned for id={{ r.requestedId }} ({{ (r.results ?? []).length }} rows)</h4>
            <pre class="code-block small">{{ r.results | json }}</pre>
          </div>
        }
        @if (safeResult(); as r) {
          <div class="result-card safe">
            <h3>Safe — Ownership check pattern</h3>
            @if (r.fix) {
              <div class="label-row"><span class="label label-green">Fix</span> {{ r.fix }}</div>
            }
            @if (r.pattern) {
              <div class="label-row">
                <span class="label label-green">Pattern</span> {{ r.pattern }}
              </div>
            }
            @if (r.safeQuery) {
              <h4>Safe SQL query</h4>
              <pre class="code-block">{{ r.safeQuery }}</pre>
            }
            @if (r.springAnnotation) {
              <h4>Spring Security annotation</h4>
              <pre class="code-block">{{ r.springAnnotation }}</pre>
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class SecurityIdorTabComponent {
  readonly id = model<number>(1);
  readonly loading = input<boolean>(false);
  readonly errorMsg = input<string>('');
  readonly vulnResult = input<IdorResult | null>(null);
  readonly safeResult = input<IdorResult | null>(null);

  readonly runVulnerable = output<void>();
  readonly runSafe = output<void>();
}
