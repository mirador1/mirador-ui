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
  /** Median HTTP response latency in milliseconds at this sample time. */
  latencyP50: number;
  /** 95th percentile HTTP response latency in milliseconds. */
  latencyP95: number;
  /** 99th percentile HTTP response latency in milliseconds. */
  latencyP99: number;
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
  /** Total 4xx + 5xx request count (cumulative). Used to compute error rate. */
  httpErrorCount: number;
  /** JVM heap memory currently used, in bytes (sum across all heap regions). */
  heapUsedBytes: number;
  /** JVM heap memory max (committed), in bytes. -1 if unavailable. */
  heapMaxBytes: number;
  /** Process CPU usage as a fraction 0..1. */
  cpuProcess: number;
  /** Number of live JVM threads. */
  threads: number;
  /** HikariCP: number of active (in-use) connections in the pool. */
  hikariActive: number;
  /** HikariCP: number of idle (available) connections in the pool. */
  hikariIdle: number;
  /** HikariCP: number of threads waiting for a connection from the pool. */
  hikariPending: number;
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
   * Signal: the full parsed metrics from the most recent Prometheus poll.
   * Contains JVM heap, CPU, thread count, HikariCP pool stats, and HTTP latencies.
   * Used by Dashboard sections that need a single latest snapshot (not a time series).
   */
  readonly latestMetrics = signal<ParsedMetrics | null>(null);

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

  /** Fetch Prometheus metrics, compute RPS and latency, and update both signals. */
  private poll(): void {
    this.http.get(`${this.env.baseUrl()}/actuator/prometheus`, { responseType: 'text' }).subscribe({
      next: (text) => {
        const parsed = this.parsePrometheus(text);
        // Publish full snapshot so Dashboard sections (JVM, HikariCP, etc.) can read it.
        this.latestMetrics.set(parsed);

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
            // Store latency per sample so the Dashboard can render a latency history chart.
            latencyP50: parsed.httpLatencyP50,
            latencyP95: parsed.httpLatencyP95,
            latencyP99: parsed.httpLatencyP99,
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

    // ── 4xx + 5xx error count ─────────────────────────────────────────────────
    // Spring Boot Micrometer labels status codes numerically (status="404", status="500", etc.).
    let errorCount = 0;
    const errorRegex =
      /^http_server_requests_seconds_count\{[^}]*status="[45]\d\d"[^}]*\}\s+(\d+\.?\d*)/gm;
    let err;
    while ((err = errorRegex.exec(raw)) !== null) {
      errorCount += parseFloat(err[1]);
    }

    // ── JVM heap memory ────────────────────────────────────────────────────────
    // jvm_memory_used_bytes and jvm_memory_max_bytes are emitted per region (Eden,
    // Survivor, Old Gen…). Sum only area="heap" entries to get total heap usage.
    let heapUsed = 0;
    let heapMax = 0;
    const heapUsedRegex = /^jvm_memory_used_bytes\{[^}]*area="heap"[^}]*\}\s+(\d+\.?\d*)/gm;
    const heapMaxRegex = /^jvm_memory_max_bytes\{[^}]*area="heap"[^}]*\}\s+(\d+\.?\d*)/gm;
    let hm;
    while ((hm = heapUsedRegex.exec(raw)) !== null) heapUsed += parseFloat(hm[1]);
    while ((hm = heapMaxRegex.exec(raw)) !== null) heapMax += parseFloat(hm[1]);

    // ── CPU usage ──────────────────────────────────────────────────────────────
    // process_cpu_usage is a gauge in range [0, 1] representing the fraction of CPU
    // time used by the JVM process. Published by ProcessorMetrics (Micrometer default).
    const cpuMatch = raw.match(/^process_cpu_usage\s+([\d.]+)/m);
    const cpuProcess = cpuMatch ? parseFloat(cpuMatch[1]) : 0;

    // ── JVM threads ───────────────────────────────────────────────────────────
    const threadsMatch = raw.match(/^jvm_threads_live_threads\s+([\d.]+)/m);
    const threads = threadsMatch ? Math.round(parseFloat(threadsMatch[1])) : 0;

    // ── HikariCP connection pool ───────────────────────────────────────────────
    // hikaricp_connections_{active,idle,pending} are gauges published by HikariCP's
    // Micrometer integration. They reflect the real-time state of the JDBC pool.
    const hikariActiveM = raw.match(/^hikaricp_connections_active\{[^}]*\}\s+([\d.]+)/m);
    const hikariIdleM = raw.match(/^hikaricp_connections_idle\{[^}]*\}\s+([\d.]+)/m);
    const hikariPendingM = raw.match(/^hikaricp_connections_pending\{[^}]*\}\s+([\d.]+)/m);

    return {
      httpRequestsTotal: totalCount,
      httpLatencyP50: Math.round(percentile(0.5) * 10) / 10,
      httpLatencyP95: Math.round(percentile(0.95) * 10) / 10,
      httpLatencyP99: Math.round(percentile(0.99) * 10) / 10,
      httpErrorCount: errorCount,
      heapUsedBytes: heapUsed,
      heapMaxBytes: heapMax,
      cpuProcess,
      threads,
      hikariActive: hikariActiveM ? Math.round(parseFloat(hikariActiveM[1])) : 0,
      hikariIdle: hikariIdleM ? Math.round(parseFloat(hikariIdleM[1])) : 0,
      hikariPending: hikariPendingM ? Math.round(parseFloat(hikariPendingM[1])) : 0,
    };
  }
}
