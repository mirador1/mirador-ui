import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders, HttpResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { EnvService } from '../../core/env/env.service';
import { AuthService } from '../../core/auth/auth.service';

interface SavedRequest {
  name: string;
  method: string;
  url: string;
  headers: string;
  body: string;
}

@Component({
  selector: 'app-request-builder',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './request-builder.component.html',
  styleUrl: './request-builder.component.scss',
})
export class RequestBuilderComponent {
  private readonly http = inject(HttpClient);
  readonly env = inject(EnvService);
  readonly auth = inject(AuthService);

  method = 'GET';
  url = '';
  headersText = '';
  bodyText = '';

  responseStatus = signal<number | null>(null);
  responseBody = signal<string | null>(null);
  responseHeaders = signal<string | null>(null);
  responseTime = signal<number | null>(null);
  loading = signal(false);

  readonly methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

  readonly presets: SavedRequest[] = [
    { name: 'Health check', method: 'GET', url: '/actuator/health', headers: '', body: '' },
    {
      name: 'List customers (v1)',
      method: 'GET',
      url: '/customers?page=0&size=10',
      headers: 'X-API-Version: 1.0',
      body: '',
    },
    {
      name: 'List customers (v2)',
      method: 'GET',
      url: '/customers?page=0&size=10',
      headers: 'X-API-Version: 2.0',
      body: '',
    },
    {
      name: 'Create customer',
      method: 'POST',
      url: '/customers',
      headers: 'Content-Type: application/json',
      body: '{\n  "name": "Test User",\n  "email": "test@example.com"\n}',
    },
    {
      name: 'Customer summary',
      method: 'GET',
      url: '/customers/summary?page=0&size=20',
      headers: '',
      body: '',
    },
    { name: 'Recent (Redis)', method: 'GET', url: '/customers/recent', headers: '', body: '' },
    { name: 'Aggregate (VT)', method: 'GET', url: '/customers/aggregate', headers: '', body: '' },
    { name: 'Bio (Ollama)', method: 'GET', url: '/customers/1/bio', headers: '', body: '' },
    { name: 'Todos', method: 'GET', url: '/customers/1/todos', headers: '', body: '' },
    { name: 'Enrich (Kafka)', method: 'GET', url: '/customers/1/enrich', headers: '', body: '' },
    {
      name: 'Prometheus metrics',
      method: 'GET',
      url: '/actuator/prometheus',
      headers: '',
      body: '',
    },
    { name: 'Actuator info', method: 'GET', url: '/actuator/info', headers: '', body: '' },
    { name: 'Loggers', method: 'GET', url: '/actuator/loggers', headers: '', body: '' },
  ];

  history = signal<
    Array<{ method: string; url: string; status: number; timeMs: number; timestamp: Date }>
  >([]);

  loadPreset(p: SavedRequest): void {
    this.method = p.method;
    this.url = p.url;
    this.headersText = p.headers;
    this.bodyText = p.body;
  }

  send(): void {
    const fullUrl = this.url.startsWith('http') ? this.url : `${this.env.baseUrl()}${this.url}`;
    this.loading.set(true);
    this.responseStatus.set(null);
    this.responseBody.set(null);
    this.responseHeaders.set(null);

    let headers = new HttpHeaders();
    for (const line of this.headersText.split('\n')) {
      const idx = line.indexOf(':');
      if (idx > 0) {
        headers = headers.set(line.slice(0, idx).trim(), line.slice(idx + 1).trim());
      }
    }

    const t0 = performance.now();
    const options = { headers, observe: 'response' as const, responseType: 'text' as const };

    let req$;
    switch (this.method) {
      case 'POST':
        req$ = this.http.post(fullUrl, this.bodyText || null, options);
        break;
      case 'PUT':
        req$ = this.http.put(fullUrl, this.bodyText || null, options);
        break;
      case 'DELETE':
        req$ = this.http.delete(fullUrl, options);
        break;
      case 'PATCH':
        req$ = this.http.patch(fullUrl, this.bodyText || null, options);
        break;
      default:
        req$ = this.http.get(fullUrl, options);
    }

    req$.subscribe({
      next: (res: HttpResponse<string>) => {
        const elapsed = Math.round(performance.now() - t0);
        this.responseStatus.set(res.status);
        this.responseTime.set(elapsed);
        this.responseHeaders.set(this.formatHeaders(res.headers));
        try {
          this.responseBody.set(JSON.stringify(JSON.parse(res.body ?? ''), null, 2));
        } catch {
          this.responseBody.set(res.body ?? '');
        }
        this.loading.set(false);
        this.recordHistory(this.method, this.url, res.status, elapsed);
      },
      error: (err: any) => {
        const elapsed = Math.round(performance.now() - t0);
        this.responseStatus.set(err.status || 0);
        this.responseTime.set(elapsed);
        this.responseBody.set(err.error || err.message || 'Request failed');
        this.responseHeaders.set(null);
        this.loading.set(false);
        this.recordHistory(this.method, this.url, err.status || 0, elapsed);
      },
    });
  }

  private formatHeaders(headers: any): string {
    const lines: string[] = [];
    headers.keys().forEach((key: string) => {
      lines.push(`${key}: ${headers.get(key)}`);
    });
    return lines.join('\n');
  }

  private recordHistory(method: string, url: string, status: number, timeMs: number): void {
    this.history.update((h) => [
      { method, url, status, timeMs, timestamp: new Date() },
      ...h.slice(0, 19),
    ]);
  }

  statusColorClass(): string {
    const s = this.responseStatus();
    if (!s) return '';
    if (s < 300) return 'status-ok';
    if (s < 400) return 'status-redirect';
    if (s < 500) return 'status-client-err';
    return 'status-server-err';
  }
}
