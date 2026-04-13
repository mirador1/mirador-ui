import { Injectable, inject, signal, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { EnvService } from '../env/env.service';

export interface MetricsSample {
  time: Date;
  requestsTotal: number;
  rps: number;
}

export interface ParsedMetrics {
  httpRequestsTotal: number;
  httpLatencyP50: number;
  httpLatencyP95: number;
  httpLatencyP99: number;
}

@Injectable({ providedIn: 'root' })
export class MetricsService {
  private readonly http = inject(HttpClient);
  private readonly env = inject(EnvService);

  readonly samples = signal<MetricsSample[]>([]);
  readonly running = signal(false);
  private _timer: ReturnType<typeof setInterval> | null = null;

  start(): void {
    if (this.running()) return;
    this.running.set(true);
    this.poll();
    this._timer = setInterval(() => this.poll(), 3000);
  }

  stop(): void {
    this.running.set(false);
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
  }

  toggle(): void {
    if (this.running()) this.stop(); else this.start();
  }

  private poll(): void {
    this.http.get(`${this.env.baseUrl()}/actuator/prometheus`, { responseType: 'text' }).subscribe({
      next: text => {
        const parsed = this.parsePrometheus(text);
        const current = this.samples();
        const prevTotal = current.length > 0 ? current[current.length - 1].requestsTotal : parsed.httpRequestsTotal;
        const rps = Math.max(0, (parsed.httpRequestsTotal - prevTotal) / 3);
        this.samples.update(s => [...s.slice(-39), {
          time: new Date(),
          requestsTotal: parsed.httpRequestsTotal,
          rps
        }]);
      },
      error: () => {}
    });
  }

  parsePrometheus(raw: string): ParsedMetrics {
    const getCounter = (name: string): number => {
      const match = raw.match(new RegExp(`^${name}\\b.*?\\s+(\\d+\\.?\\d*)`, 'm'));
      return match ? parseFloat(match[1]) : 0;
    };
    const getQuantile = (name: string, q: string): number => {
      const match = raw.match(new RegExp(`^${name}\\{.*quantile="${q}".*\\}\\s+(\\d+\\.?\\d*(?:E[+-]?\\d+)?)`, 'm'));
      return match ? parseFloat(match[1]) * 1000 : 0;
    };
    return {
      httpRequestsTotal: getCounter('http_server_requests_seconds_count'),
      httpLatencyP50: getQuantile('http_server_requests_seconds', '0.5'),
      httpLatencyP95: getQuantile('http_server_requests_seconds', '0.95'),
      httpLatencyP99: getQuantile('http_server_requests_seconds', '0.99')
    };
  }
}
