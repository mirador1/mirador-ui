/**
 * MetricsService — Persistent Prometheus metrics polling.
 *
 * Polls `/actuator/prometheus` every 3 seconds and computes:
 * - Requests per second (RPS) from total request count deltas
 * - Latency percentiles (p50/p95/p99) from HTTP histogram buckets
 *
 * Key design: this is a singleton service whose polling state **persists
 * across page navigation**. The live throughput chart on the Dashboard
 * continues collecting data even when the user navigates to other pages.
 *
 * The `parsePrometheus()` method handles raw Prometheus text format,
 * aggregating histogram buckets across all URIs/methods/statuses and
 * using linear interpolation within buckets for percentile estimation.
 */
import { Injectable, inject, signal, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { EnvService } from '../env/env.service';

/**
 * A single data point collected during Prometheus polling.
 * Stored in the `samples` signal array (capped at 40 entries = ~2 minutes of data).
 */
export interface MetricsSample {
  /** Wall-clock time when this sample was collected. */
  time: Date;
  /** Cumulative total HTTP request count across all URIs at this sample time. */
  requestsTotal: number;
  /**
   * Requests per second computed as the delta in `requestsTotal` since the previous sample
   * divided by the 3-second polling interval.
   */
  rps: number;
}

/**
 * Structured metrics derived from a single Prometheus text scrape.
 * Used by the Dashboard stats cards and the Metrics page.
 */
export interface ParsedMetrics {
  /** Total cumulative HTTP request count (sum across all URIs, methods, and statuses). */
  httpRequestsTotal: number;
  /** Median HTTP response latency in milliseconds, computed from histogram buckets. */
  httpLatencyP50: number;
  /** 95th percentile HTTP response latency in milliseconds. */
  httpLatencyP95: number;
  /** 99th percentile HTTP response latency in milliseconds. */
  httpLatencyP99: number;
}

@Injectable({ providedIn: 'root' })
export class MetricsService {
  private readonly http = inject(HttpClient);
  private readonly env = inject(EnvService);

  /**
   * Signal array of the last 40 polling samples (~2 minutes of throughput history).
   * The Dashboard live throughput chart renders these as a bar chart.
   * Because this is a singleton service, the array accumulates across page navigations.
   */
  readonly samples = signal<MetricsSample[]>([]);

  /**
   * Signal: true when the polling interval is active.
   * Used by the Dashboard to render start/stop toggle state.
   */
  readonly running = signal(false);

  /** Handle for the `setInterval` polling timer. Null when polling is stopped. */
  private _timer: ReturnType<typeof setInterval> | null = null;

  /**
   * Start Prometheus polling every 3 seconds.
   * No-op if already running. Immediately fires one poll before the first interval fires.
   */
  start(): void {
    if (this.running()) return;
    this.running.set(true);
    this.poll();
    this._timer = setInterval(() => this.poll(), 3000);
  }

  /**
   * Stop the polling interval and clear the timer.
   * Does not clear the `samples` array — history remains visible after stopping.
   */
  stop(): void {
    this.running.set(false);
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  /**
   * Toggle polling on/off.
   * Called by the Dashboard "Start/Stop Chart" button.
   */
  toggle(): void {
    if (this.running()) this.stop();
    else this.start();
  }

  /** Fetch Prometheus metrics and compute RPS from request count delta */
  private poll(): void {
    this.http.get(`${this.env.baseUrl()}/actuator/prometheus`, { responseType: 'text' }).subscribe({
      next: (text) => {
        const parsed = this.parsePrometheus(text);
        const current = this.samples();
        // RPS = (current total - previous total) / polling interval (3s)
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

  /**
   * Parse raw Prometheus text format into structured metrics.
   *
   * Extracts HTTP request counts and computes latency percentiles from
   * histogram buckets using linear interpolation within bucket boundaries.
   */
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
    const bucketRegex =
      /^http_server_requests_seconds_bucket\{[^}]*le="([^"]+)"[^}]*\}\s+(\d+\.?\d*)/gm;
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
