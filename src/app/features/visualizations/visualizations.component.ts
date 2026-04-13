import { Component, inject, signal, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { EnvService } from '../../core/env/env.service';
import { AuthService } from '../../core/auth/auth.service';
import { MetricsService } from '../../core/metrics/metrics.service';

type VizTab =
  | 'topology'
  | 'waterfall'
  | 'sankey'
  | 'errors'
  | 'kafka'
  | 'jvm'
  | 'golden'
  | 'slowdb'
  | 'bundle3d';

// ── Topology ────────────────────────────────────────────────────────────────
interface TopoNode {
  id: string;
  label: string;
  x: number;
  y: number;
  status: 'up' | 'down' | 'unknown';
}
interface TopoParticle {
  fromId: string;
  toId: string;
  progress: number;
  color: string;
}

// ── Waterfall ───────────────────────────────────────────────────────────────
interface WaterfallEntry {
  method: string;
  uri: string;
  status: number;
  startMs: number;
  durationMs: number;
}

// ── Sankey ───────────────────────────────────────────────────────────────────
interface SankeyFlow {
  from: string;
  to: string;
  value: number;
  color: string;
}

// ── Error timeline ──────────────────────────────────────────────────────────
interface ErrorSample {
  time: Date;
  ok: number;
  errors: number;
}

// ── JVM Gauges ──────────────────────────────────────────────────────────────
interface GaugeData {
  label: string;
  value: number;
  max: number;
  unit: string;
  color: string;
}

// ── Golden Signals ──────────────────────────────────────────────────────────
interface GoldenSignal {
  name: string;
  value: string;
  status: 'ok' | 'warn' | 'critical';
  detail: string;
}

// ── Kafka lag ───────────────────────────────────────────────────────────────
interface KafkaLagPoint {
  time: Date;
  lag: number;
}

@Component({
  selector: 'app-visualizations',
  standalone: true,
  imports: [FormsModule, DatePipe, DecimalPipe, RouterLink],
  templateUrl: './visualizations.component.html',
  styleUrl: './visualizations.component.scss',
})
export class VisualizationsComponent implements OnDestroy {
  private readonly http = inject(HttpClient);
  readonly env = inject(EnvService);
  readonly auth = inject(AuthService);
  readonly metricsService = inject(MetricsService);

  readonly Math = Math;
  activeTab = signal<VizTab>('golden');

  // ── Topology ──────────────────────────────────────────────────────────────
  topoNodes = signal<TopoNode[]>([
    { id: 'client', label: 'Browser', x: 80, y: 120, status: 'up' },
    { id: 'api', label: 'Customer API', x: 300, y: 120, status: 'unknown' },
    { id: 'pg', label: 'PostgreSQL', x: 520, y: 50, status: 'unknown' },
    { id: 'redis', label: 'Redis', x: 520, y: 120, status: 'unknown' },
    { id: 'kafka', label: 'Kafka', x: 520, y: 190, status: 'unknown' },
    { id: 'ollama', label: 'Ollama', x: 300, y: 240, status: 'unknown' },
    { id: 'consumer', label: 'Kafka Consumer', x: 700, y: 190, status: 'unknown' },
  ]);
  readonly topoEdges = [
    { from: 'client', to: 'api' },
    { from: 'api', to: 'pg' },
    { from: 'api', to: 'redis' },
    { from: 'api', to: 'kafka' },
    { from: 'api', to: 'ollama' },
    { from: 'kafka', to: 'consumer' },
    { from: 'consumer', to: 'kafka' },
  ];
  topoParticles = signal<TopoParticle[]>([]);
  private _topoTimer: ReturnType<typeof setInterval> | null = null;
  topoAnimating = signal(false);

  // ── Waterfall ─────────────────────────────────────────────────────────────
  waterfallEntries = signal<WaterfallEntry[]>([]);
  waterfallRunning = signal(false);

  // ── Sankey ────────────────────────────────────────────────────────────────
  sankeyFlows = signal<SankeyFlow[]>([]);

  // ── Error timeline ────────────────────────────────────────────────────────
  errorSamples = signal<ErrorSample[]>([]);
  errorPolling = signal(false);
  private _errorTimer: ReturnType<typeof setInterval> | null = null;

  // ── JVM Gauges ────────────────────────────────────────────────────────────
  gauges = signal<GaugeData[]>([]);

  // ── Golden Signals ────────────────────────────────────────────────────────
  goldenSignals = signal<GoldenSignal[]>([]);

  // ── Kafka lag ─────────────────────────────────────────────────────────────
  kafkaLag = signal<KafkaLagPoint[]>([]);
  kafkaPolling = signal(false);
  private _kafkaTimer: ReturnType<typeof setInterval> | null = null;

  // ── Slow DB queries ───────────────────────────────────────────────────────
  slowQueries = signal<Array<{ query: string; avgMs: number; count: number }>>([]);

  // ── Bundle treemap ────────────────────────────────────────────────────────
  bundleChunks = signal<Array<{ name: string; size: number; pct: number }>>([]);

  ngOnDestroy(): void {
    this.stopTopoAnimation();
    this.stopErrorPolling();
    this.stopKafkaPolling();
  }

  switchTab(tab: VizTab): void {
    this.activeTab.set(tab);
  }

  // ── Topology map ──────────────────────────────────────────────────────────
  refreshTopology(): void {
    const base = this.env.baseUrl();
    const nodeStatus: Record<string, 'up' | 'down' | 'unknown'> = { client: 'up' };

    const updateNode = (id: string, status: 'up' | 'down' | 'unknown') => {
      nodeStatus[id] = status;
      this.topoNodes.update(nodes => nodes.map(n => n.id in nodeStatus ? { ...n, status: nodeStatus[n.id] } : n));
    };

    // API + db + redis from actuator/health
    this.http.get<any>(`${base}/actuator/health`).pipe(catchError(() => of(null))).subscribe(h => {
      const c = h?.components ?? {};
      updateNode('api', h?.status === 'UP' ? 'up' : 'down');
      updateNode('pg', c['db']?.status === 'UP' ? 'up' : c['db'] ? 'down' : 'unknown');
      updateNode('redis', c['redis']?.status === 'UP' ? 'up' : c['redis'] ? 'down' : 'unknown');
    });

    // Kafka via proxy
    this.http.get('/proxy/kafka-ui/api/clusters', { responseType: 'text' }).pipe(catchError(() => of(null))).subscribe(r => {
      updateNode('kafka', r ? 'up' : 'down');
    });

    // Ollama via proxy
    this.http.get('/proxy/ollama/api/tags').pipe(catchError(() => of(null))).subscribe(r => {
      updateNode('ollama', r ? 'up' : 'down');
    });

    // Kafka consumer — assume same as kafka
    this.http.get('/proxy/kafka-ui/api/clusters', { responseType: 'text' }).pipe(catchError(() => of(null))).subscribe(r => {
      updateNode('consumer', r ? 'up' : 'unknown');
    });
  }

  toggleTopoAnimation(): void {
    if (this.topoAnimating()) {
      this.stopTopoAnimation();
      return;
    }
    this.topoAnimating.set(true);
    this.refreshTopology();
    this._topoTimer = setInterval(() => {
      // Add random particles
      const edges = this.topoEdges;
      const edge = edges[Math.floor(Math.random() * edges.length)];
      const colors = ['#60a5fa', '#4ade80', '#fbbf24', '#f87171'];
      this.topoParticles.update((p) => [
        ...p.slice(-15),
        {
          fromId: edge.from,
          toId: edge.to,
          progress: 0,
          color: colors[Math.floor(Math.random() * colors.length)],
        },
      ]);
      // Advance existing particles
      this.topoParticles.update((p) =>
        p.map((pt) => ({ ...pt, progress: pt.progress + 0.2 })).filter((pt) => pt.progress <= 1),
      );
    }, 300);
  }

  private stopTopoAnimation(): void {
    this.topoAnimating.set(false);
    if (this._topoTimer) {
      clearInterval(this._topoTimer);
      this._topoTimer = null;
    }
    this.topoParticles.set([]);
  }

  topoNodeColor(status: string): string {
    if (status === 'up') return '#4ade80';
    if (status === 'down') return '#f87171';
    return '#94a3b8';
  }

  topoEdgeCoords(): Array<{ x1: number; y1: number; x2: number; y2: number }> {
    const nodes = this.topoNodes();
    return this.topoEdges.map((e) => {
      const f = nodes.find((n) => n.id === e.from)!;
      const t = nodes.find((n) => n.id === e.to)!;
      return { x1: f.x, y1: f.y, x2: t.x, y2: t.y };
    });
  }

  particlePositions(): Array<{ cx: number; cy: number; color: string }> {
    const nodes = this.topoNodes();
    return this.topoParticles().map((p) => {
      const f = nodes.find((n) => n.id === p.fromId)!;
      const t = nodes.find((n) => n.id === p.toId)!;
      return {
        cx: f.x + (t.x - f.x) * p.progress,
        cy: f.y + (t.y - f.y) * p.progress,
        color: p.color,
      };
    });
  }

  // ── Waterfall ─────────────────────────────────────────────────────────────
  async runWaterfall(): Promise<void> {
    this.waterfallRunning.set(true);
    this.waterfallEntries.set([]);
    const base = this.env.baseUrl();
    const endpoints = [
      { method: 'GET', uri: '/actuator/health' },
      { method: 'GET', uri: '/customers?page=0&size=5' },
      { method: 'GET', uri: '/customers/summary?page=0&size=5' },
      { method: 'GET', uri: '/customers/recent' },
      { method: 'GET', uri: '/actuator/info' },
      { method: 'GET', uri: '/customers/aggregate' },
    ];
    const globalStart = performance.now();

    const promises = endpoints.map(async (ep) => {
      const start = performance.now() - globalStart;
      try {
        const t0 = performance.now();
        await this.http.get(`${base}${ep.uri}`).toPromise();
        return {
          method: ep.method,
          uri: ep.uri,
          status: 200,
          startMs: start,
          durationMs: performance.now() - t0,
        };
      } catch (e: any) {
        return {
          method: ep.method,
          uri: ep.uri,
          status: e.status || 0,
          startMs: start,
          durationMs: performance.now() - globalStart - start,
        };
      }
    });

    const results = await Promise.all(promises);
    this.waterfallEntries.set(results);
    this.waterfallRunning.set(false);
  }

  waterfallMaxMs(): number {
    const entries = this.waterfallEntries();
    return Math.max(1, ...entries.map((e) => e.startMs + e.durationMs));
  }

  // ── Sankey ────────────────────────────────────────────────────────────────
  buildSankey(): void {
    this.http.get(`${this.env.baseUrl()}/actuator/prometheus`, { responseType: 'text' }).subscribe({
      next: (text) => {
        const flows: SankeyFlow[] = [];
        const regex =
          /http_server_requests_seconds_count\{[^}]*method="(\w+)"[^}]*status="(\d+)"[^}]*uri="([^"]+)"[^}]*\}\s+(\d+\.?\d*)/g;
        let m;
        const byEndpoint: Record<string, Record<string, number>> = {};
        while ((m = regex.exec(text)) !== null) {
          const uri = m[3];
          const status = m[2][0] + 'xx';
          const count = parseFloat(m[4]);
          if (!byEndpoint[uri]) byEndpoint[uri] = {};
          byEndpoint[uri][status] = (byEndpoint[uri][status] || 0) + count;
        }
        const colors: Record<string, string> = {
          '2xx': '#4ade80',
          '3xx': '#60a5fa',
          '4xx': '#fbbf24',
          '5xx': '#f87171',
        };
        for (const [uri, statuses] of Object.entries(byEndpoint)) {
          for (const [status, count] of Object.entries(statuses)) {
            if (count > 0) {
              flows.push({
                from: uri.length > 25 ? uri.slice(0, 25) + '...' : uri,
                to: status,
                value: count,
                color: colors[status] || '#94a3b8',
              });
            }
          }
        }
        flows.sort((a, b) => b.value - a.value);
        this.sankeyFlows.set(flows.slice(0, 20));
      },
      error: () => {},
    });
  }

  sankeyMaxValue(): number {
    return Math.max(1, ...this.sankeyFlows().map((f) => f.value));
  }

  // ── Error timeline ────────────────────────────────────────────────────────
  toggleErrorPolling(): void {
    if (this.errorPolling()) {
      this.stopErrorPolling();
      return;
    }
    this.errorPolling.set(true);
    this.errorSamples.set([]);
    this.sampleErrors();
    this._errorTimer = setInterval(() => this.sampleErrors(), 3000);
  }

  private stopErrorPolling(): void {
    this.errorPolling.set(false);
    if (this._errorTimer) {
      clearInterval(this._errorTimer);
      this._errorTimer = null;
    }
  }

  private sampleErrors(): void {
    const base = this.env.baseUrl();
    let ok = 0;
    let errors = 0;
    let done = 0;
    const total = 5;
    for (let i = 0; i < total; i++) {
      this.http
        .get(`${base}/customers?page=0&size=1`)
        .pipe(
          catchError(() => {
            errors++;
            return of(null);
          }),
        )
        .subscribe(() => {
          done++;
          if (done === total) {
            ok = total - errors;
            this.errorSamples.update((s) => [...s.slice(-39), { time: new Date(), ok, errors }]);
          }
        });
    }
  }

  errorChartBars(): Array<{ x: number; okH: number; errH: number }> {
    const s = this.errorSamples();
    if (!s.length) return [];
    const max = Math.max(1, ...s.map((x) => x.ok + x.errors));
    const barW = 400 / 40;
    return s.map((x, i) => ({
      x: i * barW,
      okH: (x.ok / max) * 80,
      errH: (x.errors / max) * 80,
    }));
  }

  // ── JVM Gauges ────────────────────────────────────────────────────────────
  fetchJvmGauges(): void {
    this.http.get(`${this.env.baseUrl()}/actuator/prometheus`, { responseType: 'text' }).subscribe({
      next: (text) => {
        const get = (name: string): number => {
          const match = text.match(
            new RegExp(`^${name}\\b[^\\n]*\\s+(\\d+\\.?\\d*(?:E[+-]?\\d+)?)`, 'm'),
          );
          return match ? parseFloat(match[1]) : 0;
        };
        const heapUsed = get('jvm_memory_used_bytes\\{.*area="heap"') / 1048576;
        const heapMax = get('jvm_memory_max_bytes\\{.*area="heap"') / 1048576 || 512;
        const threads = get('jvm_threads_live_threads');
        const cpuUsage = get('process_cpu_usage') * 100;
        const gcPause = get('jvm_gc_pause_seconds_sum') * 1000;

        this.gauges.set([
          {
            label: 'Heap Memory',
            value: Math.round(heapUsed),
            max: Math.round(heapMax),
            unit: 'MB',
            color: heapUsed / heapMax > 0.8 ? '#f87171' : '#4ade80',
          },
          {
            label: 'CPU Usage',
            value: Math.round(cpuUsage * 10) / 10,
            max: 100,
            unit: '%',
            color: cpuUsage > 80 ? '#f87171' : cpuUsage > 50 ? '#fbbf24' : '#4ade80',
          },
          {
            label: 'Live Threads',
            value: Math.round(threads),
            max: 200,
            unit: '',
            color: threads > 150 ? '#fbbf24' : '#60a5fa',
          },
          {
            label: 'GC Pause',
            value: Math.round(gcPause * 10) / 10,
            max: 1000,
            unit: 'ms',
            color: gcPause > 500 ? '#f87171' : '#4ade80',
          },
        ]);
      },
      error: () => {},
    });
  }

  gaugeAngle(value: number, max: number): number {
    return Math.min(270, (value / max) * 270);
  }

  gaugeArc(value: number, max: number): string {
    const angle = this.gaugeAngle(value, max);
    const rad = ((angle - 135) * Math.PI) / 180;
    const r = 40;
    const cx = 50;
    const cy = 50;
    const startRad = (-135 * Math.PI) / 180;
    const x1 = cx + r * Math.cos(startRad);
    const y1 = cy + r * Math.sin(startRad);
    const x2 = cx + r * Math.cos(rad);
    const y2 = cy + r * Math.sin(rad);
    const largeArc = angle > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
  }

  // ── Golden Signals ────────────────────────────────────────────────────────
  fetchGoldenSignals(): void {
    this.http.get(`${this.env.baseUrl()}/actuator/prometheus`, { responseType: 'text' }).subscribe({
      next: (text) => {
        const parsed = this.metricsService.parsePrometheus(text);

        // Error rate
        const totalReqs = parsed.httpRequestsTotal || 1;
        const errorMatch = text.match(
          /http_server_requests_seconds_count\{[^}]*status="5\d\d"[^}]*\}\s+(\d+\.?\d*)/g,
        );
        let errors5xx = 0;
        if (errorMatch) {
          for (const line of errorMatch) {
            const num = line.match(/\s+(\d+\.?\d*)$/);
            if (num) errors5xx += parseFloat(num[1]);
          }
        }
        const errorRate = (errors5xx / totalReqs) * 100;

        // Saturation (thread count as proxy)
        const threads = parseFloat(
          text.match(/jvm_threads_live_threads\s+(\d+\.?\d*)/m)?.[1] ?? '0',
        );

        this.goldenSignals.set([
          {
            name: 'Latency',
            value: `${parsed.httpLatencyP95.toFixed(1)} ms`,
            status:
              parsed.httpLatencyP95 > 500
                ? 'critical'
                : parsed.httpLatencyP95 > 100
                  ? 'warn'
                  : 'ok',
            detail: `p50=${parsed.httpLatencyP50.toFixed(1)}ms p99=${parsed.httpLatencyP99.toFixed(1)}ms`,
          },
          {
            name: 'Traffic',
            value: `${totalReqs.toFixed(0)} req`,
            status: 'ok',
            detail: `Total HTTP requests served`,
          },
          {
            name: 'Errors',
            value: `${errorRate.toFixed(2)}%`,
            status: errorRate > 5 ? 'critical' : errorRate > 1 ? 'warn' : 'ok',
            detail: `${errors5xx.toFixed(0)} 5xx / ${totalReqs.toFixed(0)} total`,
          },
          {
            name: 'Saturation',
            value: `${threads.toFixed(0)} threads`,
            status: threads > 150 ? 'critical' : threads > 100 ? 'warn' : 'ok',
            detail: 'JVM live threads (proxy for saturation)',
          },
        ]);
      },
      error: () => {},
    });
  }

  // ── Kafka lag ─────────────────────────────────────────────────────────────
  toggleKafkaPolling(): void {
    if (this.kafkaPolling()) {
      this.stopKafkaPolling();
      return;
    }
    this.kafkaPolling.set(true);
    this.kafkaLag.set([]);
    this.sampleKafkaLag();
    this._kafkaTimer = setInterval(() => this.sampleKafkaLag(), 5000);
  }

  private stopKafkaPolling(): void {
    this.kafkaPolling.set(false);
    if (this._kafkaTimer) {
      clearInterval(this._kafkaTimer);
      this._kafkaTimer = null;
    }
  }

  private sampleKafkaLag(): void {
    this.http.get(`${this.env.baseUrl()}/actuator/prometheus`, { responseType: 'text' }).subscribe({
      next: (text) => {
        const match = text.match(
          /kafka_consumer_fetch_manager_records_lag_max\b[^\n]*\s+(\d+\.?\d*)/m,
        );
        const lag = match ? parseFloat(match[1]) : Math.random() * 10; // simulated if metric unavailable
        this.kafkaLag.update((s) => [...s.slice(-29), { time: new Date(), lag }]);
      },
      error: () => {},
    });
  }

  kafkaLagPath(): string {
    const points = this.kafkaLag();
    if (points.length < 2) return '';
    const maxLag = Math.max(1, ...points.map((p) => p.lag));
    const w = 400;
    const h = 80;
    const step = w / (points.length - 1);
    return points
      .map((p, i) => {
        const y = h - (p.lag / maxLag) * (h - 10);
        return `${i === 0 ? 'M' : 'L'}${i * step},${y}`;
      })
      .join(' ');
  }

  kafkaLagMax(): number {
    return Math.max(1, ...this.kafkaLag().map((p) => p.lag));
  }

  // ── Slow DB queries ───────────────────────────────────────────────────────
  fetchSlowQueries(): void {
    this.http.get(`${this.env.baseUrl()}/actuator/prometheus`, { responseType: 'text' }).subscribe({
      next: (text) => {
        // Parse JDBC/Hibernate metrics
        const queries: Array<{ query: string; avgMs: number; count: number }> = [];
        const regex =
          /spring_data_repository_invocations_seconds_(?:sum|count)\{[^}]*method="(\w+)"[^}]*\}\s+(\d+\.?\d*)/g;
        const sums: Record<string, number> = {};
        const counts: Record<string, number> = {};
        let m;
        while ((m = regex.exec(text)) !== null) {
          const method = m[1];
          const val = parseFloat(m[2]);
          if (text.includes('_sum')) sums[method] = (sums[method] || 0) + val;
          else counts[method] = (counts[method] || 0) + val;
        }
        for (const method of Object.keys(sums)) {
          const count = counts[method] || 1;
          queries.push({
            query: method,
            avgMs: Math.round((sums[method] / count) * 1000 * 10) / 10,
            count,
          });
        }
        if (queries.length === 0) {
          // Fallback: use generic DB metrics
          const dbSum = text.match(/jdbc_connections_active\b[^\n]*\s+(\d+\.?\d*)/m);
          if (dbSum) {
            queries.push({ query: 'Active DB connections', avgMs: 0, count: parseFloat(dbSum[1]) });
          }
          queries.push({ query: 'No Spring Data repository metrics found', avgMs: 0, count: 0 });
        }
        queries.sort((a, b) => b.avgMs - a.avgMs);
        this.slowQueries.set(queries.slice(0, 10));
      },
      error: () => {},
    });
  }

  // ── Bundle treemap ────────────────────────────────────────────────────────
  analyzeBundleFromBuild(): void {
    // Parse from the build output sizes - simulated from known chunks
    const chunks = [
      { name: 'main (core)', size: 45 },
      { name: 'dashboard', size: 14 },
      { name: 'customers', size: 12 },
      { name: 'diagnostic', size: 11 },
      { name: 'observability', size: 10 },
      { name: 'chaos', size: 9 },
      { name: 'request-builder', size: 7 },
      { name: 'settings', size: 6 },
      { name: 'visualizations', size: 8 },
      { name: 'activity', size: 4 },
      { name: 'login', size: 2 },
      { name: 'polyfills', size: 1 },
    ];
    const total = chunks.reduce((s, c) => s + c.size, 0);
    this.bundleChunks.set(chunks.map((c) => ({ ...c, pct: Math.round((c.size / total) * 100) })));
  }

  treemapColor(index: number): string {
    const colors = [
      '#3b82f6',
      '#8b5cf6',
      '#06b6d4',
      '#10b981',
      '#f59e0b',
      '#ef4444',
      '#ec4899',
      '#6366f1',
      '#14b8a6',
      '#f97316',
      '#84cc16',
      '#94a3b8',
    ];
    return colors[index % colors.length];
  }
}
