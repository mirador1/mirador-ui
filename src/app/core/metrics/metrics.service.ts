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
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  toggle(): void {
    if (this.running()) this.stop();
    else this.start();
  }

  private poll(): void {
    this.http.get(`${this.env.baseUrl()}/actuator/prometheus`, { responseType: 'text' }).subscribe({
      next: (text) => {
        const parsed = this.parsePrometheus(text);
        const current = this.samples();
        const prevTotal =
          current.length > 0 ? current[current.length - 1].requestsTotal : parsed.httpRequestsTotal;
        const rps = Math.max(0, (parsed.httpRequestsTotal - prevTotal) / 3);
        this.samples.update((s) => [
          ...s.slice(-39),
          {
            time: new Date(),
            requestsTotal: parsed.httpRequestsTotal,
            rps,
          },
        ]);
      },
      error: () => {},
    });
  }

  parsePrometheus(raw: string): ParsedMetrics {
    // Total request count (sum across all URIs)
    let totalCount = 0;
    const countRegex = /^http_server_requests_seconds_count\{[^}]*\}\s+(\d+\.?\d*)/gm;
    let cm;
    while ((cm = countRegex.exec(raw)) !== null) {
      totalCount += parseFloat(cm[1]);
    }

    // Parse histogram buckets to compute percentiles
    // Aggregate all buckets across URIs/methods/status
    const bucketMap = new Map<number, number>();
    const bucketRegex = /^http_server_requests_seconds_bucket\{[^}]*le="([^"]+)"[^}]*\}\s+(\d+\.?\d*)/gm;
    let bm;
    while ((bm = bucketRegex.exec(raw)) !== null) {
      const le = parseFloat(bm[1]);
      if (isFinite(le)) {
        bucketMap.set(le, (bucketMap.get(le) || 0) + parseFloat(bm[2]));
      }
    }

    // Sort buckets by le value
    const buckets = [...bucketMap.entries()].sort((a, b) => a[0] - b[0]);

    // Compute percentile from histogram buckets
    const percentile = (p: number): number => {
      if (buckets.length === 0 || totalCount === 0) return 0;
      const target = totalCount * p;
      for (let i = 0; i < buckets.length; i++) {
        if (buckets[i][1] >= target) {
          // Linear interpolation within the bucket
          const prevCount = i > 0 ? buckets[i - 1][1] : 0;
          const prevLe = i > 0 ? buckets[i - 1][0] : 0;
          const fraction = (target - prevCount) / Math.max(1, buckets[i][1] - prevCount);
          return (prevLe + fraction * (buckets[i][0] - prevLe)) * 1000; // to ms
        }
      }
      return buckets[buckets.length - 1][0] * 1000;
    };

    return {
      httpRequestsTotal: totalCount,
      httpLatencyP50: Math.round(percentile(0.5) * 10) / 10,
      httpLatencyP95: Math.round(percentile(0.95) * 10) / 10,
      httpLatencyP99: Math.round(percentile(0.99) * 10) / 10,
    };
  }
}
