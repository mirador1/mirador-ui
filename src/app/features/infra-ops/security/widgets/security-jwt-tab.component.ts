/**
 * SecurityJwtTabComponent — JWT decode + claim inspector.
 *
 * Reads parent's auth state to gate the decode button (must be signed in).
 * Decode button emits `decodeRequested` ; parent owns auth + decode logic.
 *
 * Extracted from security.component.html per Phase B-7-4 batch, 2026-04-24.
 */
import { Component, input, output } from '@angular/core';
import { JsonPipe, KeyValuePipe } from '@angular/common';
import type { JwtClaims } from '../security-types';

@Component({
  selector: 'app-security-jwt-tab',
  standalone: true,
  imports: [JsonPipe, KeyValuePipe],
  styleUrl: '../security.component.scss',
  template: `
    <div class="tab-content">
      <div class="explanation-card info">
        <strong>ℹ️ JWT Structure</strong> — A JSON Web Token has three Base64URL-encoded parts
        separated by dots: <code>header.payload.signature</code>. The header declares the algorithm.
        The payload carries claims (sub, role, iat, exp). The signature is computed server-side —
        only the backend can produce a valid signature, but anyone can decode the header and
        payload.
        <strong>Never put secrets in a JWT payload.</strong>
      </div>

      @if (!isAuthenticated()) {
        <div class="explanation-card warn">
          ⚠️ You are not signed in. <a href="/login">Sign in</a> to inspect your JWT token.
        </div>
      } @else {
        <div class="action-row">
          <button class="btn btn-ghost" (click)="decodeRequested.emit()">
            ↻ Decode current token
          </button>
        </div>

        @if (errorMsg()) {
          <div class="error-banner">{{ errorMsg() }}</div>
        }

        @if (payload(); as p) {
          <div class="jwt-grid">
            <div class="jwt-section">
              <div class="jwt-section-title">Header</div>
              <pre class="code-block">{{ header() | json }}</pre>
            </div>

            <div class="jwt-section">
              <div class="jwt-section-title">Payload (Claims)</div>
              <div class="jwt-claims">
                <div class="jwt-claim">
                  <span class="jwt-claim-key">sub</span>
                  <span class="jwt-claim-value">{{ p['sub'] ?? '—' }}</span>
                  <span class="jwt-claim-desc">Subject — username of the authenticated user</span>
                </div>
                <div class="jwt-claim">
                  <span class="jwt-claim-key">role</span>
                  <span class="jwt-claim-value">{{ p['role'] ?? '—' }}</span>
                  <span class="jwt-claim-desc">Role — ROLE_USER or ROLE_ADMIN, used for RBAC</span>
                </div>
                <div class="jwt-claim">
                  <span class="jwt-claim-key">iat</span>
                  <span class="jwt-claim-value">{{ formatTs($any(p['iat'])) }}</span>
                  <span class="jwt-claim-desc">Issued At — when this token was created</span>
                </div>
                <div class="jwt-claim" [class.jwt-claim-expired]="expired()">
                  <span class="jwt-claim-key">exp</span>
                  <span class="jwt-claim-value">{{ formatTs($any(p['exp'])) }}</span>
                  <span class="jwt-claim-desc">{{ expiryLabel() }}</span>
                </div>
                @for (entry of p | keyvalue; track entry.key) {
                  @if (!['sub', 'role', 'iat', 'exp'].includes(entry.key)) {
                    <div class="jwt-claim">
                      <span class="jwt-claim-key">{{ entry.key }}</span>
                      <span class="jwt-claim-value">{{ entry.value }}</span>
                      <span class="jwt-claim-desc">Custom claim</span>
                    </div>
                  }
                }
              </div>
            </div>

            <div class="jwt-section jwt-section-full">
              <div class="jwt-section-title">Signature</div>
              <div class="explanation-card info" style="margin: 0">
                The third part of the JWT is the HMAC-SHA256 signature computed over
                <code>base64(header) + "." + base64(payload)</code> using the server's
                <code>jwt.secret</code>. It cannot be decoded or verified client-side without the
                secret. Any tampering with header or payload invalidates the signature → 401.
              </div>
            </div>
          </div>
        }
      }
    </div>
  `,
})
export class SecurityJwtTabComponent {
  readonly isAuthenticated = input<boolean>(false);
  readonly errorMsg = input<string>('');
  readonly payload = input<JwtClaims | null>(null);
  readonly header = input<Record<string, unknown> | null>(null);
  readonly expired = input<boolean>(false);
  readonly expiryLabel = input<string>('');

  readonly decodeRequested = output<void>();

  /** Format a Unix timestamp (sec) as `YYYY-MM-DD HH:mm:ss UTC`. */
  formatTs(ts: number | undefined): string {
    if (!ts) return '—';
    return new Date(ts * 1000).toISOString().replace('T', ' ').replace('.000Z', ' UTC');
  }
}
