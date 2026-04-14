/**
 * SecurityComponent — Interactive security vulnerability demos.
 *
 * Three tabs:
 * - SQL Injection: vulnerable vs safe query comparison
 * - XSS: unescaped HTML rendered in sandboxed iframe vs escaped version
 * - CORS: policy explanation from backend
 *
 * All demo endpoints are permit-all (no auth required).
 */
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { JsonPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { EnvService } from '../../core/env/env.service';

type SecurityTab = 'sqli' | 'xss' | 'cors';

interface SqliResult {
  query?: string;
  vulnerability?: string;
  results?: unknown[];
  exploit?: string;
  fix?: string;
}

interface CorsInfo {
  currentOriginPolicy?: string;
  dangerousConfig?: string;
  risk?: string;
  attack?: string;
  fix?: string;
  yourOrigin?: string;
}

@Component({
  selector: 'app-security',
  standalone: true,
  imports: [FormsModule, JsonPipe],
  templateUrl: './security.component.html',
  styleUrl: './security.component.scss',
})
export class SecurityComponent {
  private readonly http = inject(HttpClient);
  private readonly env = inject(EnvService);
  private readonly sanitizer = inject(DomSanitizer);

  activeTab = signal<SecurityTab>('sqli');

  // ── SQL Injection ──────────────────────────────────────────────────────────
  sqliName = signal(`Alice' OR '1'='1`);
  sqliVulnResult = signal<SqliResult | null>(null);
  sqliSafeResult = signal<SqliResult | null>(null);
  sqliLoading = signal(false);
  sqliError = signal('');

  // ── XSS ───────────────────────────────────────────────────────────────────
  xssName = signal(`<img src=x onerror=alert('XSS')>`);
  xssVulnHtml = signal<string | null>(null);
  xssSafeHtml = signal<SafeHtml | null>(null);
  xssLoading = signal(false);
  xssError = signal('');
  xssMode = signal<'none' | 'vulnerable' | 'safe'>('none');

  // ── CORS ──────────────────────────────────────────────────────────────────
  corsInfo = signal<CorsInfo | null>(null);
  corsLoading = signal(false);
  corsError = signal('');

  // ── Tab switch ────────────────────────────────────────────────────────────
  setTab(tab: SecurityTab): void {
    this.activeTab.set(tab);
    if (tab === 'cors' && !this.corsInfo()) {
      this.loadCors();
    }
  }

  // ── SQL Injection ──────────────────────────────────────────────────────────
  runSqliVulnerable(): void {
    const base = this.env.baseUrl();
    const name = this.sqliName();
    this.sqliLoading.set(true);
    this.sqliError.set('');
    this.sqliVulnResult.set(null);

    this.http
      .get<SqliResult>(`${base}/demo/security/sqli-vulnerable`, { params: { name } })
      .subscribe({
        next: (r) => {
          this.sqliVulnResult.set(r);
          this.sqliLoading.set(false);
        },
        error: (e) => {
          this.sqliError.set(`Error ${e.status}: ${e.message}`);
          this.sqliLoading.set(false);
        },
      });
  }

  runSqliSafe(): void {
    const base = this.env.baseUrl();
    const name = this.sqliName();
    this.sqliLoading.set(true);
    this.sqliError.set('');
    this.sqliSafeResult.set(null);

    this.http.get<SqliResult>(`${base}/demo/security/sqli-safe`, { params: { name } }).subscribe({
      next: (r) => {
        this.sqliSafeResult.set(r);
        this.sqliLoading.set(false);
      },
      error: (e) => {
        this.sqliError.set(`Error ${e.status}: ${e.message}`);
        this.sqliLoading.set(false);
      },
    });
  }

  sqliResultRows(result: SqliResult | null): unknown[] {
    return result?.results ?? [];
  }

  // ── XSS ───────────────────────────────────────────────────────────────────
  runXssVulnerable(): void {
    const base = this.env.baseUrl();
    const name = this.xssName();
    this.xssLoading.set(true);
    this.xssError.set('');
    this.xssMode.set('none');

    this.http
      .get(`${base}/demo/security/xss-vulnerable`, { params: { name }, responseType: 'text' })
      .subscribe({
        next: (html) => {
          this.xssVulnHtml.set(html);
          this.xssSafeHtml.set(null);
          this.xssMode.set('vulnerable');
          this.xssLoading.set(false);
        },
        error: (e) => {
          this.xssError.set(`Error ${e.status}: ${e.message}`);
          this.xssLoading.set(false);
        },
      });
  }

  runXssSafe(): void {
    const base = this.env.baseUrl();
    const name = this.xssName();
    this.xssLoading.set(true);
    this.xssError.set('');
    this.xssMode.set('none');

    this.http
      .get(`${base}/demo/security/xss-safe`, { params: { name }, responseType: 'text' })
      .subscribe({
        next: (html) => {
          this.xssVulnHtml.set(null);
          // DomSanitizer: bypass for the safe (server-escaped) version display
          this.xssSafeHtml.set(this.sanitizer.bypassSecurityTrustHtml(html));
          this.xssMode.set('safe');
          this.xssLoading.set(false);
        },
        error: (e) => {
          this.xssError.set(`Error ${e.status}: ${e.message}`);
          this.xssLoading.set(false);
        },
      });
  }

  // ── CORS ──────────────────────────────────────────────────────────────────
  loadCors(): void {
    const base = this.env.baseUrl();
    this.corsLoading.set(true);
    this.corsError.set('');

    this.http.get<CorsInfo>(`${base}/demo/security/cors-info`).subscribe({
      next: (r) => {
        this.corsInfo.set(r);
        this.corsLoading.set(false);
      },
      error: (e) => {
        this.corsError.set(`Error ${e.status}: ${e.message}`);
        this.corsLoading.set(false);
      },
    });
  }
}
