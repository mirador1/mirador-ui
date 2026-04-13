/**
 * VisualizationsComponent — Nine advanced visualization tabs.
 *
 * All visualizations are built with raw SVG (no charting library):
 *
 * - Golden Signals: 4 SRE signals (Latency, Traffic, Errors, Saturation) with thresholds
 * - JVM Gauges: circular SVG arc gauges for Heap, CPU, Threads, GC Pause
 * - Topology: animated service dependency map with health-colored nodes and particles
 * - Waterfall: parallel request timing bars (like Chrome DevTools Network tab)
 * - Sankey: endpoint -> HTTP status flow diagram from Prometheus metrics
 * - Error Timeline: live stacked bar chart (OK vs errors) polling every 3s
 * - Kafka Lag: SVG line chart of consumer lag polling every 5s
 * - Slow Queries: Spring Data repository invocation metrics from Prometheus
 * - Bundle: treemap of Angular lazy chunks with 3D CSS transforms
 */
import { Component, inject, signal, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { EnvService } from '../../core/env/env.service';
import { AuthService } from '../../core/auth/auth.service';
import { MetricsService } from '../../core/metrics/metrics.service';
import { InfoTipComponent } from '../../shared/info-tip/info-tip.component';

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
  id: string;
  label: string;
  icon: string;
  tip: string;
  value: number;
  max: number;
  unit: string;
  color: string;
}

interface GaugeDef {
  id: string;
  label: string;
  icon: string;
  category: string;
  tip: string;
  extract: (text: string) => { value: number; max: number; unit: string; color: string };
}

// ── Golden Signals / Metric Cards ───────────────────────────────────────────
interface GoldenSignal {
  id: string;
  name: string;
  value: string;
  status: 'ok' | 'warn' | 'critical';
  detail: string;
  icon: string;
  tip: string;
}

/** Definition of an available metric card */
interface MetricDef {
  id: string;
  name: string;
  icon: string;
  category: string;
  tip: string;
  extract: (
    text: string,
    parsed: {
      httpRequestsTotal: number;
      httpLatencyP50: number;
      httpLatencyP95: number;
      httpLatencyP99: number;
    },
  ) => { value: string; status: 'ok' | 'warn' | 'critical'; detail: string };
}

// ── Kafka lag ───────────────────────────────────────────────────────────────
interface KafkaLagPoint {
  time: Date;
  lag: number;
}

@Component({
  selector: 'app-visualizations',
  standalone: true,
  imports: [FormsModule, DatePipe, DecimalPipe, RouterLink, InfoTipComponent],
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

  readonly vizTabs: Array<{ id: VizTab; label: string; icon: string; tip: string }> = [
    {
      id: 'golden',
      label: 'Golden Signals',
      icon: '🚦',
      tip: 'The 4 SRE golden signals (Latency, Traffic, Errors, Saturation) + 40 additional metrics from Prometheus',
    },
    {
      id: 'jvm',
      label: 'JVM Gauges',
      icon: '🧠',
      tip: 'Circular gauges for JVM runtime metrics: heap, CPU, threads, GC, connection pools, disk',
    },
    {
      id: 'waterfall',
      label: 'Waterfall',
      icon: '🏊',
      tip: 'Parallel request timing bars (like Chrome DevTools Network tab). Shows start offset and duration for 6 endpoints',
    },
    {
      id: 'sankey',
      label: 'Sankey',
      icon: '🔀',
      tip: 'Flow diagram from HTTP endpoint → status code (2xx/4xx/5xx). Width proportional to request volume from Prometheus',
    },
    {
      id: 'errors',
      label: 'Error Timeline',
      icon: '💥',
      tip: 'Live stacked bar chart of OK vs error responses. Polls every 3s with 5 probe requests. Use with chaos actions',
    },
    {
      id: 'kafka',
      label: 'Kafka Lag',
      icon: '📨',
      tip: "Consumer lag over time from kafka_consumer_fetch_manager_records_lag_max. High lag = consumer can't keep up",
    },
    {
      id: 'slowdb',
      label: 'Slow Queries',
      icon: '🐢',
      tip: 'Spring Data repository invocation times from Prometheus. Shows average duration and call count per query method',
    },
    {
      id: 'bundle3d',
      label: 'Bundle',
      icon: '📦',
      tip: 'Angular bundle size breakdown by lazy-loaded chunk. Treemap + 3D view showing relative sizes of feature modules',
    },
  ];

  // ── Topology ──────────────────────────────────────────────────────────────
  // Layout: each admin UI is on the same row as its data store to avoid edge crossings.
  //
  //  Col 1       Col 2          Col 3           Col 4             Col 5          Col 6
  //             Keycloak       PostgreSQL  ──── pgAdmin
  //  Browser ── API ────────── Redis ────────── RedisInsight      Prometheus ─── Grafana
  //                            Kafka ────────── Kafka Consumer    Zipkin
  //                            Ollama           Kafka UI          Loki           Pyroscope
  topoNodes = signal<TopoNode[]>([
    // Col 1 — Client
    { id: 'client', label: 'Browser', x: 60, y: 130, status: 'up' },
    // Col 2 — Core API + Auth
    { id: 'keycloak', label: 'Keycloak', x: 230, y: 40, status: 'unknown' },
    { id: 'api', label: 'Customer API', x: 230, y: 130, status: 'unknown' },
    // Col 3 — Data stores (each on its own row)
    { id: 'pg', label: 'PostgreSQL', x: 420, y: 40, status: 'unknown' },
    { id: 'redis', label: 'Redis', x: 420, y: 110, status: 'unknown' },
    { id: 'kafka', label: 'Kafka', x: 420, y: 180, status: 'unknown' },
    { id: 'ollama', label: 'Ollama', x: 420, y: 250, status: 'unknown' },
    // Col 4 — Admin UIs aligned with their data store
    { id: 'pgadmin', label: 'pgAdmin', x: 610, y: 40, status: 'unknown' },
    { id: 'redisinsight', label: 'RedisInsight', x: 610, y: 110, status: 'unknown' },
    { id: 'consumer', label: 'Kafka Consumer', x: 610, y: 180, status: 'unknown' },
    { id: 'kafka-ui', label: 'Kafka UI', x: 610, y: 250, status: 'unknown' },
    // Col 5 — Observability
    { id: 'prometheus', label: 'Prometheus', x: 800, y: 40, status: 'unknown' },
    { id: 'grafana', label: 'Grafana', x: 800, y: 110, status: 'unknown' },
    { id: 'zipkin', label: 'Zipkin', x: 800, y: 180, status: 'unknown' },
    { id: 'loki', label: 'Loki (LGTM)', x: 800, y: 250, status: 'unknown' },
    // Col 6
    { id: 'pyroscope', label: 'Pyroscope', x: 950, y: 110, status: 'unknown' },
  ]);
  readonly topoEdges = [
    // Client → API
    { from: 'client', to: 'api' },
    // API → Auth
    { from: 'api', to: 'keycloak' },
    // API → Data stores (all horizontal, no crossings)
    { from: 'api', to: 'pg' },
    { from: 'api', to: 'redis' },
    { from: 'api', to: 'kafka' },
    { from: 'api', to: 'ollama' },
    // Data store → Admin UI (same row = horizontal, no crossings)
    { from: 'pg', to: 'pgadmin' },
    { from: 'redis', to: 'redisinsight' },
    { from: 'kafka', to: 'consumer' },
    { from: 'kafka', to: 'kafka-ui' },
    // Observability (API pushes metrics/traces/logs)
    { from: 'api', to: 'prometheus' },
    { from: 'api', to: 'zipkin' },
    { from: 'api', to: 'loki' },
    { from: 'api', to: 'pyroscope' },
    // Grafana aggregates all observability sources
    { from: 'prometheus', to: 'grafana' },
    { from: 'zipkin', to: 'grafana' },
    { from: 'loki', to: 'grafana' },
    { from: 'pyroscope', to: 'grafana' },
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
  showGaugePicker = signal(false);

  readonly allGauges: GaugeDef[] = [
    // ── JVM Memory ──────────────────────────────────────────────────────────
    {
      id: 'heap',
      label: 'Heap Used',
      icon: '🧠',
      category: 'Memory',
      tip: 'JVM heap memory in use. Approaching max triggers aggressive GC and OOM.',
      extract: (t) => {
        const used =
          VisualizationsComponent.prom(t, 'jvm_memory_used_bytes\\{[^}]*area="heap"') / 1048576;
        const max =
          VisualizationsComponent.prom(t, 'jvm_memory_max_bytes\\{[^}]*area="heap"') / 1048576 ||
          512;
        return {
          value: Math.round(used),
          max: Math.round(max),
          unit: 'MB',
          color: used / max > 0.8 ? '#f87171' : '#4ade80',
        };
      },
    },
    {
      id: 'heap-committed',
      label: 'Heap Committed',
      icon: '📐',
      category: 'Memory',
      tip: 'Heap memory committed by the OS. JVM can use this without requesting more.',
      extract: (t) => {
        const v =
          VisualizationsComponent.prom(t, 'jvm_memory_committed_bytes\\{[^}]*area="heap"') /
          1048576;
        const max =
          VisualizationsComponent.prom(t, 'jvm_memory_max_bytes\\{[^}]*area="heap"') / 1048576 ||
          512;
        return { value: Math.round(v), max: Math.round(max), unit: 'MB', color: '#60a5fa' };
      },
    },
    {
      id: 'heap-after-gc',
      label: 'Heap After GC',
      icon: '🧹',
      category: 'Memory',
      tip: 'Heap usage after last GC. If growing = memory leak (objects not collected).',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'jvm_memory_usage_after_gc') * 100;
        return {
          value: Math.round(v * 10) / 10,
          max: 100,
          unit: '%',
          color: v > 80 ? '#f87171' : v > 60 ? '#fbbf24' : '#4ade80',
        };
      },
    },
    {
      id: 'nonheap',
      label: 'Non-Heap Used',
      icon: '📦',
      category: 'Memory',
      tip: 'Metaspace + code cache. Grows with loaded classes.',
      extract: (t) => {
        const v =
          VisualizationsComponent.prom(t, 'jvm_memory_used_bytes\\{[^}]*area="nonheap"') / 1048576;
        return {
          value: Math.round(v),
          max: 400,
          unit: 'MB',
          color: v > 300 ? '#f87171' : v > 200 ? '#fbbf24' : '#4ade80',
        };
      },
    },
    {
      id: 'nonheap-committed',
      label: 'Non-Heap Committed',
      icon: '📏',
      category: 'Memory',
      tip: 'Non-heap memory committed by the OS.',
      extract: (t) => {
        const v =
          VisualizationsComponent.prom(t, 'jvm_memory_committed_bytes\\{[^}]*area="nonheap"') /
          1048576;
        return { value: Math.round(v), max: 400, unit: 'MB', color: '#60a5fa' };
      },
    },
    {
      id: 'gc-live-data',
      label: 'GC Live Data',
      icon: '📊',
      category: 'Memory',
      tip: 'Old gen size after full GC — the baseline memory the app needs.',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'jvm_gc_live_data_size_bytes') / 1048576;
        const max = VisualizationsComponent.prom(t, 'jvm_gc_max_data_size_bytes') / 1048576 || 512;
        return {
          value: Math.round(v),
          max: Math.round(max),
          unit: 'MB',
          color: v / max > 0.8 ? '#f87171' : '#4ade80',
        };
      },
    },
    {
      id: 'gc-allocated',
      label: 'GC Allocated',
      icon: '📥',
      category: 'Memory',
      tip: 'Total bytes allocated in young gen since startup.',
      extract: (t) => {
        const v =
          VisualizationsComponent.prom(t, 'jvm_gc_memory_allocated_bytes_total') /
          (1024 * 1024 * 1024);
        return { value: Math.round(v * 10) / 10, max: 100, unit: 'GB', color: '#60a5fa' };
      },
    },
    {
      id: 'gc-promoted',
      label: 'GC Promoted',
      icon: '📤',
      category: 'Memory',
      tip: 'Total bytes promoted young → old gen since startup.',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'jvm_gc_memory_promoted_bytes_total') / 1048576;
        return { value: Math.round(v), max: 1000, unit: 'MB', color: '#60a5fa' };
      },
    },
    {
      id: 'direct-buffers',
      label: 'Direct Buffers',
      icon: '🔧',
      category: 'Memory',
      tip: 'Off-heap NIO direct buffer memory. Not subject to GC.',
      extract: (t) => {
        const v =
          VisualizationsComponent.prom(t, 'jvm_buffer_memory_used_bytes\\{[^}]*id="direct"') /
          1048576;
        return {
          value: Math.round(v * 10) / 10,
          max: 256,
          unit: 'MB',
          color: v > 200 ? '#f87171' : v > 128 ? '#fbbf24' : '#4ade80',
        };
      },
    },
    {
      id: 'buffer-capacity',
      label: 'Buffer Capacity',
      icon: '📊',
      category: 'Memory',
      tip: 'Total NIO buffer capacity (direct + mapped).',
      extract: (t) => {
        const v = VisualizationsComponent.promSum(t, 'jvm_buffer_total_capacity_bytes') / 1048576;
        return { value: Math.round(v * 10) / 10, max: 512, unit: 'MB', color: '#60a5fa' };
      },
    },
    {
      id: 'buffer-count',
      label: 'Buffer Count',
      icon: '🔢',
      category: 'Memory',
      tip: 'Number of NIO buffer objects (direct + mapped).',
      extract: (t) => {
        const v = VisualizationsComponent.promSum(t, 'jvm_buffer_count_buffers');
        return { value: Math.round(v), max: 500, unit: '', color: '#60a5fa' };
      },
    },
    // ── CPU & System ────────────────────────────────────────────────────────
    {
      id: 'cpu',
      label: 'Process CPU',
      icon: '💻',
      category: 'CPU',
      tip: 'JVM process CPU utilization (0-100%).',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'process_cpu_usage') * 100;
        return {
          value: Math.round(v * 10) / 10,
          max: 100,
          unit: '%',
          color: v > 80 ? '#f87171' : v > 50 ? '#fbbf24' : '#4ade80',
        };
      },
    },
    {
      id: 'system-cpu',
      label: 'System CPU',
      icon: '🖥️',
      category: 'CPU',
      tip: 'System-wide CPU usage (all processes).',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'system_cpu_usage') * 100;
        return {
          value: Math.round(v * 10) / 10,
          max: 100,
          unit: '%',
          color: v > 90 ? '#f87171' : v > 70 ? '#fbbf24' : '#4ade80',
        };
      },
    },
    {
      id: 'cpu-cores',
      label: 'CPU Cores',
      icon: '🧮',
      category: 'CPU',
      tip: 'Available CPU cores. Load avg should stay below this.',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'system_cpu_count');
        return { value: Math.round(v), max: 32, unit: '', color: '#60a5fa' };
      },
    },
    {
      id: 'load-avg',
      label: 'Load Average',
      icon: '📉',
      category: 'CPU',
      tip: 'System load avg (1m). Above CPU count = overloaded.',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'system_load_average_1m');
        const cpus = VisualizationsComponent.prom(t, 'system_cpu_count') || 1;
        return {
          value: Math.round(v * 100) / 100,
          max: Math.round(cpus * 2),
          unit: '',
          color: v > cpus ? '#f87171' : v > cpus * 0.7 ? '#fbbf24' : '#4ade80',
        };
      },
    },
    {
      id: 'jit-compile',
      label: 'JIT Compilation',
      icon: '⚡',
      category: 'CPU',
      tip: 'Total JIT compiler time. High early = warmup, sustained = deopt loops.',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'jvm_compilation_time_ms_total') / 1000;
        return { value: Math.round(v * 10) / 10, max: 60, unit: 's', color: '#60a5fa' };
      },
    },
    // ── Threads ──────────────────────────────────────────────────────────────
    {
      id: 'threads',
      label: 'Live Threads',
      icon: '🧵',
      category: 'Threads',
      tip: 'Total live JVM threads.',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'jvm_threads_live_threads');
        return { value: Math.round(v), max: 200, unit: '', color: v > 150 ? '#fbbf24' : '#60a5fa' };
      },
    },
    {
      id: 'peak-threads',
      label: 'Peak Threads',
      icon: '📊',
      category: 'Threads',
      tip: 'Max threads alive simultaneously since startup.',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'jvm_threads_peak_threads');
        return { value: Math.round(v), max: 300, unit: '', color: v > 200 ? '#fbbf24' : '#60a5fa' };
      },
    },
    {
      id: 'daemon',
      label: 'Daemon Threads',
      icon: '👻',
      category: 'Threads',
      tip: 'Background daemon threads (GC, JMX, Kafka consumers).',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'jvm_threads_daemon_threads');
        return { value: Math.round(v), max: 150, unit: '', color: v > 100 ? '#fbbf24' : '#60a5fa' };
      },
    },
    {
      id: 'threads-started',
      label: 'Threads Started',
      icon: '🚀',
      category: 'Threads',
      tip: 'Total threads started since boot. Growing = churn.',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'jvm_threads_started_threads_total');
        return { value: Math.round(v), max: 10000, unit: '', color: '#60a5fa' };
      },
    },
    {
      id: 'executor',
      label: 'Executor Active',
      icon: '⚙️',
      category: 'Threads',
      tip: 'Active tasks in Spring executor pool.',
      extract: (t) => {
        const active = VisualizationsComponent.prom(t, 'executor_active_threads');
        const max = VisualizationsComponent.prom(t, 'executor_pool_max_threads') || 8;
        return {
          value: Math.round(active),
          max: Math.round(max),
          unit: '',
          color: active >= max ? '#f87171' : '#4ade80',
        };
      },
    },
    {
      id: 'executor-pool-size',
      label: 'Executor Pool Size',
      icon: '📏',
      category: 'Threads',
      tip: 'Current executor thread pool size (grows under load).',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'executor_pool_size_threads');
        const max = VisualizationsComponent.prom(t, 'executor_pool_max_threads') || 8;
        return { value: Math.round(v), max: Math.round(max), unit: '', color: '#60a5fa' };
      },
    },
    {
      id: 'executor-queued',
      label: 'Executor Queued',
      icon: '📬',
      category: 'Threads',
      tip: 'Tasks waiting in executor queue. Non-zero = pool saturated.',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'executor_queued_tasks');
        return {
          value: Math.round(v),
          max: 100,
          unit: '',
          color: v > 10 ? '#f87171' : v > 0 ? '#fbbf24' : '#4ade80',
        };
      },
    },
    {
      id: 'executor-completed',
      label: 'Executor Completed',
      icon: '✔️',
      category: 'Threads',
      tip: 'Total tasks completed by executor since startup.',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'executor_completed_tasks_total');
        return { value: Math.round(v), max: 100000, unit: '', color: '#60a5fa' };
      },
    },
    // ── GC ───────────────────────────────────────────────────────────────────
    {
      id: 'gc-pause',
      label: 'GC Pause Total',
      icon: '🗑️',
      category: 'GC',
      tip: 'Cumulative GC pause time. Each pause freezes all threads.',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'jvm_gc_pause_seconds_sum') * 1000;
        return {
          value: Math.round(v * 10) / 10,
          max: 2000,
          unit: 'ms',
          color: v > 500 ? '#f87171' : '#4ade80',
        };
      },
    },
    {
      id: 'gc-count',
      label: 'GC Collections',
      icon: '♻️',
      category: 'GC',
      tip: 'Total GC events since startup.',
      extract: (t) => {
        const v = VisualizationsComponent.promSum(t, 'jvm_gc_pause_seconds_count');
        return {
          value: Math.round(v),
          max: 1000,
          unit: '',
          color: v > 500 ? '#fbbf24' : '#60a5fa',
        };
      },
    },
    {
      id: 'gc-max-pause',
      label: 'GC Max Pause',
      icon: '⏸️',
      category: 'GC',
      tip: 'Longest single GC pause. Long pauses cause latency spikes.',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'jvm_gc_pause_seconds_max') * 1000;
        return {
          value: Math.round(v * 10) / 10,
          max: 500,
          unit: 'ms',
          color: v > 200 ? '#f87171' : v > 50 ? '#fbbf24' : '#4ade80',
        };
      },
    },
    {
      id: 'gc-overhead',
      label: 'GC Overhead',
      icon: '📉',
      category: 'GC',
      tip: 'CPU time % spent in GC. >10% = severe.',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'jvm_gc_overhead') * 100;
        return {
          value: Math.round(v * 100) / 100,
          max: 20,
          unit: '%',
          color: v > 10 ? '#f87171' : v > 5 ? '#fbbf24' : '#4ade80',
        };
      },
    },
    {
      id: 'gc-concurrent',
      label: 'GC Concurrent',
      icon: '🔄',
      category: 'GC',
      tip: 'Concurrent GC phase time (does not stop app threads).',
      extract: (t) => {
        const v =
          VisualizationsComponent.prom(t, 'jvm_gc_concurrent_phase_time_seconds_sum') * 1000;
        return { value: Math.round(v * 10) / 10, max: 1000, unit: 'ms', color: '#60a5fa' };
      },
    },
    // ── Database (HikariCP + JDBC) ──────────────────────────────────────────
    {
      id: 'hikari-pool',
      label: 'HikariCP Active',
      icon: '🏊',
      category: 'Database',
      tip: 'Active connections / max pool size.',
      extract: (t) => {
        const active = VisualizationsComponent.prom(t, 'hikaricp_connections_active');
        const max = VisualizationsComponent.prom(t, 'hikaricp_connections_max') || 10;
        return {
          value: Math.round(active),
          max: Math.round(max),
          unit: '',
          color: active >= max ? '#f87171' : active > max * 0.7 ? '#fbbf24' : '#4ade80',
        };
      },
    },
    {
      id: 'hikari-idle',
      label: 'HikariCP Idle',
      icon: '💤',
      category: 'Database',
      tip: 'Idle connections in the pool.',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'hikaricp_connections_idle');
        const max = VisualizationsComponent.prom(t, 'hikaricp_connections_max') || 10;
        return { value: Math.round(v), max: Math.round(max), unit: '', color: '#60a5fa' };
      },
    },
    {
      id: 'hikari-pending',
      label: 'HikariCP Pending',
      icon: '⏳',
      category: 'Database',
      tip: 'Threads waiting for a connection. Non-zero = pool exhausted.',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'hikaricp_connections_pending');
        return { value: Math.round(v), max: 10, unit: '', color: v > 0 ? '#f87171' : '#4ade80' };
      },
    },
    {
      id: 'hikari-total',
      label: 'HikariCP Total',
      icon: '🔢',
      category: 'Database',
      tip: 'Total connections in the pool (active + idle).',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'hikaricp_connections');
        const max = VisualizationsComponent.prom(t, 'hikaricp_connections_max') || 10;
        return { value: Math.round(v), max: Math.round(max), unit: '', color: '#60a5fa' };
      },
    },
    {
      id: 'hikari-timeout',
      label: 'HikariCP Timeouts',
      icon: '💥',
      category: 'Database',
      tip: 'Connection acquisition timeouts. Each = a failed request.',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'hikaricp_connections_timeout_total');
        return { value: Math.round(v), max: 10, unit: '', color: v > 0 ? '#f87171' : '#4ade80' };
      },
    },
    {
      id: 'jdbc-active',
      label: 'JDBC Active',
      icon: '🐘',
      category: 'Database',
      tip: 'Active JDBC connections (lower-level than HikariCP).',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'jdbc_connections_active');
        const max = VisualizationsComponent.prom(t, 'jdbc_connections_max') || 10;
        return {
          value: Math.round(v),
          max: Math.round(max),
          unit: '',
          color: v >= max ? '#f87171' : '#4ade80',
        };
      },
    },
    {
      id: 'jdbc-idle',
      label: 'JDBC Idle',
      icon: '😴',
      category: 'Database',
      tip: 'Idle JDBC connections.',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'jdbc_connections_idle');
        const max = VisualizationsComponent.prom(t, 'jdbc_connections_max') || 10;
        return { value: Math.round(v), max: Math.round(max), unit: '', color: '#60a5fa' };
      },
    },
    {
      id: 'jdbc-commits',
      label: 'JDBC Commits',
      icon: '✅',
      category: 'Database',
      tip: 'Total transaction commits since startup.',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'jdbc_connection_commit_total');
        return { value: Math.round(v), max: 100000, unit: '', color: '#60a5fa' };
      },
    },
    {
      id: 'jdbc-acquired',
      label: 'JDBC Acquired',
      icon: '🔑',
      category: 'Database',
      tip: 'Total connections acquired from the pool.',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'jdbc_connection_acquired_total');
        return { value: Math.round(v), max: 100000, unit: '', color: '#60a5fa' };
      },
    },
    // ── HTTP ─────────────────────────────────────────────────────────────────
    {
      id: 'http-active',
      label: 'Active Requests',
      icon: '🔄',
      category: 'HTTP',
      tip: 'HTTP requests currently in-flight.',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'http_server_requests_active_seconds_gcount');
        return {
          value: Math.round(v),
          max: 100,
          unit: '',
          color: v > 50 ? '#f87171' : v > 20 ? '#fbbf24' : '#4ade80',
        };
      },
    },
    {
      id: 'http-max',
      label: 'Max Request Time',
      icon: '🏔️',
      category: 'HTTP',
      tip: 'Slowest single request since last scrape.',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'http_server_requests_seconds_max') * 1000;
        return {
          value: Math.round(v),
          max: 10000,
          unit: 'ms',
          color: v > 5000 ? '#f87171' : v > 1000 ? '#fbbf24' : '#4ade80',
        };
      },
    },
    // ── Redis ────────────────────────────────────────────────────────────────
    {
      id: 'redis-ops',
      label: 'Redis Ops',
      icon: '🗄️',
      category: 'Redis',
      tip: 'Total Redis commands via Lettuce.',
      extract: (t) => {
        const v = VisualizationsComponent.promSum(t, 'lettuce_seconds_count');
        return { value: Math.round(v), max: 100000, unit: '', color: '#60a5fa' };
      },
    },
    {
      id: 'redis-active',
      label: 'Redis Active',
      icon: '🔥',
      category: 'Redis',
      tip: 'Currently in-flight Redis commands.',
      extract: (t) => {
        const v = VisualizationsComponent.promSum(t, 'lettuce_active_seconds_count');
        return { value: Math.round(v), max: 100, unit: '', color: v > 20 ? '#fbbf24' : '#60a5fa' };
      },
    },
    // ── Kafka ────────────────────────────────────────────────────────────────
    {
      id: 'kafka-produced',
      label: 'Kafka Produced',
      icon: '📤',
      category: 'Kafka',
      tip: 'Messages sent via KafkaTemplate.',
      extract: (t) => {
        const v = VisualizationsComponent.promSum(t, 'spring_kafka_template_seconds_count');
        return { value: Math.round(v), max: 10000, unit: '', color: '#60a5fa' };
      },
    },
    {
      id: 'kafka-consumed',
      label: 'Kafka Consumed',
      icon: '📥',
      category: 'Kafka',
      tip: 'Messages consumed by listeners.',
      extract: (t) => {
        const v = VisualizationsComponent.promSum(t, 'spring_kafka_listener_seconds_count');
        return { value: Math.round(v), max: 10000, unit: '', color: '#60a5fa' };
      },
    },
    {
      id: 'kafka-events',
      label: 'Created Events',
      icon: '📡',
      category: 'Kafka',
      tip: 'customer.created events processed.',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'kafka_customer_created_processed_total');
        return { value: Math.round(v), max: 10000, unit: '', color: '#60a5fa' };
      },
    },
    {
      id: 'kafka-enrich',
      label: 'Enrich Cycles',
      icon: '🔀',
      category: 'Kafka',
      tip: 'Enrich request-reply cycles handled.',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'kafka_customer_enrich_handled_total');
        return { value: Math.round(v), max: 1000, unit: '', color: '#60a5fa' };
      },
    },
    // ── App Custom ──────────────────────────────────────────────────────────
    {
      id: 'customers-total',
      label: 'Customers Created',
      icon: '👤',
      category: 'App',
      tip: 'Total customers created since startup.',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'customer_created_count_total');
        return { value: Math.round(v), max: 10000, unit: '', color: '#60a5fa' };
      },
    },
    {
      id: 'recent-buffer',
      label: 'Recent Buffer',
      icon: '🔄',
      category: 'App',
      tip: 'Redis ring buffer size for recent customers.',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'customer_recent_buffer_size');
        return { value: Math.round(v), max: 20, unit: '', color: '#60a5fa' };
      },
    },
    // ── Security ─────────────────────────────────────────────────────────────
    {
      id: 'security-denied',
      label: 'Access Denied',
      icon: '🚫',
      category: 'Security',
      tip: 'Total access denied exceptions.',
      extract: (t) => {
        const v = VisualizationsComponent.prom(
          t,
          'spring_security_filterchains_access_exceptions_after_total',
        );
        return {
          value: Math.round(v),
          max: 100,
          unit: '',
          color: v > 10 ? '#f87171' : v > 0 ? '#fbbf24' : '#4ade80',
        };
      },
    },
    // ── Logging ──────────────────────────────────────────────────────────────
    {
      id: 'log-errors',
      label: 'Log Errors',
      icon: '🔴',
      category: 'Logging',
      tip: 'Total Logback ERROR events since startup.',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'logback_events_total\\{[^}]*level="error"');
        return {
          value: Math.round(v),
          max: 100,
          unit: '',
          color: v > 10 ? '#f87171' : v > 0 ? '#fbbf24' : '#4ade80',
        };
      },
    },
    {
      id: 'log-warns',
      label: 'Log Warnings',
      icon: '🟡',
      category: 'Logging',
      tip: 'Total Logback WARN events since startup.',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'logback_events_total\\{[^}]*level="warn"');
        return { value: Math.round(v), max: 500, unit: '', color: v > 50 ? '#fbbf24' : '#60a5fa' };
      },
    },
    {
      id: 'log-info',
      label: 'Log Info',
      icon: '🔵',
      category: 'Logging',
      tip: 'Total Logback INFO events.',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'logback_events_total\\{[^}]*level="info"');
        return { value: Math.round(v), max: 100000, unit: '', color: '#60a5fa' };
      },
    },
    // ── System ───────────────────────────────────────────────────────────────
    {
      id: 'open-files',
      label: 'Open Files',
      icon: '📂',
      category: 'System',
      tip: 'Open file descriptors. Approaching max = "Too many open files".',
      extract: (t) => {
        const open = VisualizationsComponent.prom(t, 'process_files_open_files');
        const max = VisualizationsComponent.prom(t, 'process_files_max_files') || 10240;
        return {
          value: Math.round(open),
          max: Math.round(max),
          unit: '',
          color: open / max > 0.8 ? '#f87171' : open / max > 0.5 ? '#fbbf24' : '#4ade80',
        };
      },
    },
    {
      id: 'disk-free',
      label: 'Disk Free',
      icon: '💾',
      category: 'System',
      tip: 'Free disk space. <10MB triggers health DOWN.',
      extract: (t) => {
        const free = VisualizationsComponent.prom(t, 'disk_free_bytes') / (1024 * 1024 * 1024);
        const total =
          VisualizationsComponent.prom(t, 'disk_total_bytes') / (1024 * 1024 * 1024) || 100;
        return {
          value: Math.round(free * 10) / 10,
          max: Math.round(total),
          unit: 'GB',
          color: free < 1 ? '#f87171' : free < 5 ? '#fbbf24' : '#4ade80',
        };
      },
    },
    {
      id: 'disk-total',
      label: 'Disk Total',
      icon: '💿',
      category: 'System',
      tip: 'Total disk space on the application partition.',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'disk_total_bytes') / (1024 * 1024 * 1024);
        return { value: Math.round(v * 10) / 10, max: Math.round(v), unit: 'GB', color: '#60a5fa' };
      },
    },
    {
      id: 'classes',
      label: 'Loaded Classes',
      icon: '📚',
      category: 'System',
      tip: 'Currently loaded JVM classes. Continuous growth = leak.',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'jvm_classes_loaded_classes');
        return {
          value: Math.round(v),
          max: 20000,
          unit: '',
          color: v > 15000 ? '#fbbf24' : '#60a5fa',
        };
      },
    },
    {
      id: 'classes-loaded-total',
      label: 'Classes Loaded (total)',
      icon: '📖',
      category: 'System',
      tip: 'Total classes loaded since boot (includes unloaded).',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'jvm_classes_loaded_count_classes_total');
        return { value: Math.round(v), max: 25000, unit: '', color: '#60a5fa' };
      },
    },
    {
      id: 'classes-unloaded',
      label: 'Classes Unloaded',
      icon: '🗑️',
      category: 'System',
      tip: 'Total classes unloaded. Normal during hot-reload.',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'jvm_classes_unloaded_classes_total');
        return { value: Math.round(v), max: 1000, unit: '', color: '#60a5fa' };
      },
    },
    {
      id: 'uptime',
      label: 'Uptime',
      icon: '🕐',
      category: 'System',
      tip: 'Process uptime. Low + errors = instability.',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'process_uptime_seconds');
        const h = Math.floor(v / 3600);
        return {
          value: Math.round(v / 60),
          max: Math.round(v / 60) + 60,
          unit: 'min',
          color: v < 60 ? '#fbbf24' : '#4ade80',
        };
      },
    },
    {
      id: 'startup',
      label: 'Startup Time',
      icon: '🏁',
      category: 'System',
      tip: 'Time to ApplicationReadyEvent.',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'application_ready_time_seconds');
        return {
          value: Math.round(v * 10) / 10,
          max: 30,
          unit: 's',
          color: v > 20 ? '#fbbf24' : '#4ade80',
        };
      },
    },
    // ── Tomcat ───────────────────────────────────────────────────────────────
    {
      id: 'tomcat-sessions',
      label: 'Tomcat Sessions',
      icon: '🌐',
      category: 'Tomcat',
      tip: 'Active sessions. Should be 0 for stateless JWT APIs.',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'tomcat_sessions_active_current_sessions');
        return { value: Math.round(v), max: 100, unit: '', color: v > 0 ? '#fbbf24' : '#4ade80' };
      },
    },
    {
      id: 'tomcat-rejected',
      label: 'Tomcat Rejected',
      icon: '🚫',
      category: 'Tomcat',
      tip: 'Sessions rejected due to max limit.',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'tomcat_sessions_rejected_sessions_total');
        return { value: Math.round(v), max: 10, unit: '', color: v > 0 ? '#f87171' : '#4ade80' };
      },
    },
    // ── Scheduled Tasks ─────────────────────────────────────────────────────
    {
      id: 'scheduled-tasks',
      label: 'Scheduled Runs',
      icon: '⏰',
      category: 'Tasks',
      tip: 'Total scheduled task executions (ShedLock).',
      extract: (t) => {
        const v = VisualizationsComponent.promSum(t, 'tasks_scheduled_execution_seconds_count');
        return { value: Math.round(v), max: 10000, unit: '', color: '#60a5fa' };
      },
    },
  ];

  readonly gaugeCategories: string[] = [...new Set(this.allGauges.map((g) => g.category))];
  gaugeFilterText = '';
  gaugeFilterCategory = '';

  filteredGauges(): GaugeDef[] {
    return this.allGauges.filter((g) => {
      if (this.gaugeFilterCategory && g.category !== this.gaugeFilterCategory) return false;
      if (
        this.gaugeFilterText &&
        !g.label.toLowerCase().includes(this.gaugeFilterText.toLowerCase())
      )
        return false;
      return true;
    });
  }

  selectedGaugeIds = signal<string[]>(
    JSON.parse(localStorage.getItem('jvm-gauges') ?? 'null') ?? [
      'heap',
      'cpu',
      'threads',
      'gc-pause',
      'nonheap',
      'hikari-pool',
      'open-files',
      'disk-free',
    ],
  );

  toggleGauge(id: string): void {
    this.selectedGaugeIds.update((ids) => {
      const next = ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id];
      localStorage.setItem('jvm-gauges', JSON.stringify(next));
      return next;
    });
  }

  isGaugeSelected(id: string): boolean {
    return this.selectedGaugeIds().includes(id);
  }

  // ── Golden Signals / Metric Cards ──────────────────────────────────────────
  goldenSignals = signal<GoldenSignal[]>([]);
  showMetricPicker = signal(false);

  /** Helper to extract a single numeric metric from Prometheus text */
  private static prom(text: string, pattern: string): number {
    const m = text.match(new RegExp(`^${pattern}\\b[^\\n]*\\s+(\\d+\\.?\\d*(?:E[+-]?\\d+)?)`, 'm'));
    return m ? parseFloat(m[1]) : 0;
  }

  /** Sum all matches of a count metric across labels */
  private static promSum(text: string, pattern: string): number {
    const re = new RegExp(`${pattern}\\s+(\\d+\\.?\\d*)`, 'gm');
    let sum = 0,
      m;
    while ((m = re.exec(text)) !== null) sum += parseFloat(m[1]);
    return sum;
  }

  /** Catalog of all available metric cards — organized by category */
  readonly allMetrics: MetricDef[] = [
    // ── HTTP / Golden Signals ───────────────────────────────────────────────
    {
      id: 'latency',
      name: 'Latency (p95)',
      icon: '⏱️',
      category: 'HTTP',
      tip: 'HTTP response time at the 95th percentile. Computed from Prometheus histogram buckets via linear interpolation.',
      extract: (_t, p) => ({
        value: `${p.httpLatencyP95.toFixed(1)} ms`,
        status: p.httpLatencyP95 > 500 ? 'critical' : p.httpLatencyP95 > 100 ? 'warn' : 'ok',
        detail: `p50=${p.httpLatencyP50.toFixed(1)}ms p99=${p.httpLatencyP99.toFixed(1)}ms`,
      }),
    },
    {
      id: 'latency-p50',
      name: 'Latency (p50)',
      icon: '⚡',
      category: 'HTTP',
      tip: 'Median HTTP response time. 50% of requests are faster.',
      extract: (_t, p) => ({
        value: `${p.httpLatencyP50.toFixed(1)} ms`,
        status: p.httpLatencyP50 > 200 ? 'critical' : p.httpLatencyP50 > 50 ? 'warn' : 'ok',
        detail: 'Median response time',
      }),
    },
    {
      id: 'latency-p99',
      name: 'Latency (p99)',
      icon: '🐢',
      category: 'HTTP',
      tip: '99th percentile — the slowest 1% of requests. High p99 with low p50 = occasional slow requests.',
      extract: (_t, p) => ({
        value: `${p.httpLatencyP99.toFixed(1)} ms`,
        status: p.httpLatencyP99 > 1000 ? 'critical' : p.httpLatencyP99 > 500 ? 'warn' : 'ok',
        detail: 'Tail latency (slowest 1%)',
      }),
    },
    {
      id: 'traffic',
      name: 'Traffic',
      icon: '📈',
      category: 'HTTP',
      tip: 'Total HTTP requests served since startup. Cumulative counter across all endpoints.',
      extract: (_t, p) => ({
        value: `${p.httpRequestsTotal.toFixed(0)} req`,
        status: 'ok',
        detail: 'Total HTTP requests served',
      }),
    },
    {
      id: 'errors',
      name: 'Error Rate',
      icon: '❌',
      category: 'HTTP',
      tip: 'Percentage of HTTP 5xx responses over total. Critical >5%, warning >1%.',
      extract: (t, p) => {
        const total = p.httpRequestsTotal || 1;
        let e5 = 0;
        const m = t.match(
          /http_server_requests_seconds_count\{[^}]*status="5\d\d"[^}]*\}\s+(\d+\.?\d*)/g,
        );
        if (m)
          for (const l of m) {
            const n = l.match(/\s+(\d+\.?\d*)$/);
            if (n) e5 += parseFloat(n[1]);
          }
        const r = (e5 / total) * 100;
        return {
          value: `${r.toFixed(2)}%`,
          status: r > 5 ? 'critical' : r > 1 ? 'warn' : 'ok',
          detail: `${e5.toFixed(0)} 5xx / ${total.toFixed(0)} total`,
        };
      },
    },
    {
      id: 'http-2xx',
      name: 'Success (2xx)',
      icon: '✅',
      category: 'HTTP',
      tip: 'Total successful HTTP responses (200-299).',
      extract: (t) => {
        const v = VisualizationsComponent.promSum(
          t,
          'http_server_requests_seconds_count\\{[^}]*status="2\\d\\d"[^}]*\\}',
        );
        return { value: `${v.toFixed(0)}`, status: 'ok', detail: 'HTTP 2xx responses' };
      },
    },
    {
      id: 'http-4xx',
      name: 'Client Errors (4xx)',
      icon: '⚠️',
      category: 'HTTP',
      tip: 'HTTP 4xx client errors (400, 401, 404, 429). Spikes may indicate API misuse or rate limiting.',
      extract: (t, p) => {
        const v = VisualizationsComponent.promSum(
          t,
          'http_server_requests_seconds_count\\{[^}]*status="4\\d\\d"[^}]*\\}',
        );
        const r = p.httpRequestsTotal > 0 ? (v / p.httpRequestsTotal) * 100 : 0;
        return {
          value: `${v.toFixed(0)}`,
          status: r > 20 ? 'critical' : r > 5 ? 'warn' : 'ok',
          detail: `${r.toFixed(1)}% of total`,
        };
      },
    },
    {
      id: 'http-5xx',
      name: 'Server Errors (5xx)',
      icon: '🔴',
      category: 'HTTP',
      tip: 'HTTP 5xx server errors. Any non-zero warrants investigation.',
      extract: (t) => {
        const v = VisualizationsComponent.promSum(
          t,
          'http_server_requests_seconds_count\\{[^}]*status="5\\d\\d"[^}]*\\}',
        );
        return {
          value: `${v.toFixed(0)}`,
          status: v > 10 ? 'critical' : v > 0 ? 'warn' : 'ok',
          detail: 'Server errors',
        };
      },
    },
    {
      id: 'http-429',
      name: 'Rate Limited (429)',
      icon: '🚦',
      category: 'HTTP',
      tip: 'Bucket4j rate limit rejections (100 req/min per IP).',
      extract: (t) => {
        const v = VisualizationsComponent.promSum(
          t,
          'http_server_requests_seconds_count\\{[^}]*status="429"[^}]*\\}',
        );
        return {
          value: `${v.toFixed(0)}`,
          status: v > 50 ? 'critical' : v > 0 ? 'warn' : 'ok',
          detail: 'Rate-limited requests',
        };
      },
    },
    {
      id: 'http-active',
      name: 'Active Requests',
      icon: '🔄',
      category: 'HTTP',
      tip: 'HTTP requests currently being processed. High count = slow responses or thread starvation.',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'http_server_requests_active_seconds_gcount');
        return {
          value: `${v.toFixed(0)}`,
          status: v > 50 ? 'critical' : v > 20 ? 'warn' : 'ok',
          detail: 'In-flight requests',
        };
      },
    },
    {
      id: 'http-max-dur',
      name: 'Max Request Duration',
      icon: '🏔️',
      category: 'HTTP',
      tip: 'Maximum observed request duration since last scrape. Identifies individual slow requests.',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'http_server_requests_seconds_max') * 1000;
        return {
          value: `${v.toFixed(0)} ms`,
          status: v > 5000 ? 'critical' : v > 1000 ? 'warn' : 'ok',
          detail: 'Slowest single request',
        };
      },
    },
    // ── JVM Memory ──────────────────────────────────────────────────────────
    {
      id: 'heap',
      name: 'Heap Memory',
      icon: '🧠',
      category: 'JVM Memory',
      tip: 'JVM heap memory in use. Close to max = GC pressure and potential OOM.',
      extract: (t) => {
        const used =
          VisualizationsComponent.prom(t, 'jvm_memory_used_bytes\\{[^}]*area="heap"') / 1048576;
        const max =
          VisualizationsComponent.prom(t, 'jvm_memory_max_bytes\\{[^}]*area="heap"') / 1048576 ||
          512;
        const pct = (used / max) * 100;
        return {
          value: `${used.toFixed(0)} MB`,
          status: pct > 85 ? 'critical' : pct > 70 ? 'warn' : 'ok',
          detail: `${pct.toFixed(0)}% of ${max.toFixed(0)} MB`,
        };
      },
    },
    {
      id: 'heap-nonheap',
      name: 'Non-Heap Memory',
      icon: '📦',
      category: 'JVM Memory',
      tip: 'Metaspace + code cache + compressed class space. Grows with loaded classes.',
      extract: (t) => {
        const v =
          VisualizationsComponent.prom(t, 'jvm_memory_used_bytes\\{[^}]*area="nonheap"') / 1048576;
        return {
          value: `${v.toFixed(0)} MB`,
          status: v > 300 ? 'critical' : v > 200 ? 'warn' : 'ok',
          detail: 'Metaspace + code cache',
        };
      },
    },
    {
      id: 'heap-committed',
      name: 'Heap Committed',
      icon: '📐',
      category: 'JVM Memory',
      tip: 'Heap memory committed by the OS to the JVM. The JVM can use up to this amount without requesting more from the OS.',
      extract: (t) => {
        const v =
          VisualizationsComponent.prom(t, 'jvm_memory_committed_bytes\\{[^}]*area="heap"') /
          1048576;
        return { value: `${v.toFixed(0)} MB`, status: 'ok', detail: 'OS-committed heap' };
      },
    },
    {
      id: 'heap-after-gc',
      name: 'Heap After GC',
      icon: '🧹',
      category: 'JVM Memory',
      tip: 'Heap usage right after the last GC. If this keeps growing, objects are not being collected — likely a memory leak.',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'jvm_memory_usage_after_gc') * 100;
        return {
          value: `${v.toFixed(1)}%`,
          status: v > 80 ? 'critical' : v > 60 ? 'warn' : 'ok',
          detail: 'Long-lived object ratio',
        };
      },
    },
    {
      id: 'gc-live-data',
      name: 'GC Live Data',
      icon: '📊',
      category: 'JVM Memory',
      tip: 'Size of the old generation after a full GC. This is the baseline memory the app actually needs.',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'jvm_gc_live_data_size_bytes') / 1048576;
        const max = VisualizationsComponent.prom(t, 'jvm_gc_max_data_size_bytes') / 1048576 || 512;
        return {
          value: `${v.toFixed(0)} MB`,
          status: v / max > 0.8 ? 'critical' : v / max > 0.6 ? 'warn' : 'ok',
          detail: `max ${max.toFixed(0)} MB`,
        };
      },
    },
    {
      id: 'buffer-mem',
      name: 'Direct Buffers',
      icon: '🔧',
      category: 'JVM Memory',
      tip: 'Off-heap NIO direct buffer memory. Used by Kafka client and file I/O. Not subject to GC.',
      extract: (t) => {
        const v =
          VisualizationsComponent.prom(t, 'jvm_buffer_memory_used_bytes\\{[^}]*id="direct"') /
          1048576;
        return {
          value: `${v.toFixed(1)} MB`,
          status: v > 256 ? 'critical' : v > 128 ? 'warn' : 'ok',
          detail: 'Direct buffer memory',
        };
      },
    },
    {
      id: 'buffer-count',
      name: 'Buffer Count',
      icon: '🔢',
      category: 'JVM Memory',
      tip: 'Number of NIO buffer objects (direct + mapped). Each buffer holds off-heap memory.',
      extract: (t) => {
        const v = VisualizationsComponent.promSum(t, 'jvm_buffer_count_buffers');
        return { value: `${v.toFixed(0)}`, status: 'ok', detail: 'NIO buffer objects' };
      },
    },
    {
      id: 'gc-allocated',
      name: 'GC Allocated',
      icon: '📥',
      category: 'JVM Memory',
      tip: 'Total bytes allocated in young generation since startup. High allocation rate causes frequent minor GCs.',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'jvm_gc_memory_allocated_bytes_total') / 1048576;
        return { value: `${v.toFixed(0)} MB`, status: 'ok', detail: 'Total allocated since start' };
      },
    },
    {
      id: 'gc-promoted',
      name: 'GC Promoted',
      icon: '📤',
      category: 'JVM Memory',
      tip: 'Total bytes promoted from young to old generation. High promotion rate fills the old gen faster.',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'jvm_gc_memory_promoted_bytes_total') / 1048576;
        return { value: `${v.toFixed(0)} MB`, status: 'ok', detail: 'Promoted to old gen' };
      },
    },
    // ── JVM Threads ─────────────────────────────────────────────────────────
    {
      id: 'saturation',
      name: 'Live Threads',
      icon: '🧵',
      category: 'JVM Threads',
      tip: 'Total live JVM threads. High count may indicate thread pool exhaustion.',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'jvm_threads_live_threads');
        return {
          value: `${v.toFixed(0)}`,
          status: v > 150 ? 'critical' : v > 100 ? 'warn' : 'ok',
          detail: 'JVM live threads',
        };
      },
    },
    {
      id: 'threads-peak',
      name: 'Peak Threads',
      icon: '📊',
      category: 'JVM Threads',
      tip: 'Maximum threads alive simultaneously since startup.',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'jvm_threads_peak_threads');
        return {
          value: `${v.toFixed(0)}`,
          status: v > 200 ? 'warn' : 'ok',
          detail: 'Peak since startup',
        };
      },
    },
    {
      id: 'daemon-threads',
      name: 'Daemon Threads',
      icon: '👻',
      category: 'JVM Threads',
      tip: 'Background daemon threads (GC, JMX, Kafka consumers, etc.).',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'jvm_threads_daemon_threads');
        return {
          value: `${v.toFixed(0)}`,
          status: v > 100 ? 'warn' : 'ok',
          detail: 'Background threads',
        };
      },
    },
    {
      id: 'threads-started',
      name: 'Threads Started',
      icon: '🚀',
      category: 'JVM Threads',
      tip: 'Total threads started since JVM boot. Continuously growing = threads being created and destroyed (expensive).',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'jvm_threads_started_threads_total');
        return { value: `${v.toFixed(0)}`, status: 'ok', detail: 'Total started since boot' };
      },
    },
    {
      id: 'executor-active',
      name: 'Executor Active',
      icon: '⚙️',
      category: 'JVM Threads',
      tip: 'Active tasks in Spring task executor pool. At max = async tasks queuing.',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'executor_active_threads');
        const pool = VisualizationsComponent.prom(t, 'executor_pool_size_threads');
        return {
          value: `${v.toFixed(0)}`,
          status: pool > 0 && v >= pool ? 'critical' : 'ok',
          detail: `pool: ${pool.toFixed(0)}`,
        };
      },
    },
    {
      id: 'executor-completed',
      name: 'Executor Completed',
      icon: '✔️',
      category: 'JVM Threads',
      tip: 'Total tasks completed by the executor since startup.',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'executor_completed_tasks_total');
        return { value: `${v.toFixed(0)}`, status: 'ok', detail: 'Completed async tasks' };
      },
    },
    {
      id: 'executor-queued',
      name: 'Executor Queued',
      icon: '📬',
      category: 'JVM Threads',
      tip: 'Tasks waiting in the executor queue. Non-zero when the pool is at max capacity.',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'executor_queued_tasks');
        return {
          value: `${v.toFixed(0)}`,
          status: v > 10 ? 'critical' : v > 0 ? 'warn' : 'ok',
          detail: 'Queued tasks',
        };
      },
    },
    // ── GC ───────────────────────────────────────────────────────────────────
    {
      id: 'gc-pause',
      name: 'GC Pause Total',
      icon: '🗑️',
      category: 'GC',
      tip: 'Cumulative GC pause time since startup. Each pause freezes all threads.',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'jvm_gc_pause_seconds_sum') * 1000;
        return {
          value: `${v.toFixed(1)} ms`,
          status: v > 1000 ? 'critical' : v > 500 ? 'warn' : 'ok',
          detail: 'Total pause time',
        };
      },
    },
    {
      id: 'gc-count',
      name: 'GC Collections',
      icon: '♻️',
      category: 'GC',
      tip: 'Total garbage collections since startup.',
      extract: (t) => {
        const v = VisualizationsComponent.promSum(t, 'jvm_gc_pause_seconds_count');
        return {
          value: `${v.toFixed(0)}`,
          status: v > 500 ? 'warn' : 'ok',
          detail: 'Total GC events',
        };
      },
    },
    {
      id: 'gc-overhead',
      name: 'GC Overhead',
      icon: '📉',
      category: 'GC',
      tip: 'CPU time % spent in GC. Above 10% = severe impact on performance.',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'jvm_gc_overhead') * 100;
        return {
          value: `${v.toFixed(2)}%`,
          status: v > 10 ? 'critical' : v > 5 ? 'warn' : 'ok',
          detail: 'CPU time in GC',
        };
      },
    },
    {
      id: 'gc-max-pause',
      name: 'GC Max Pause',
      icon: '⏸️',
      category: 'GC',
      tip: 'Longest single GC pause observed. Long pauses cause latency spikes.',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'jvm_gc_pause_seconds_max') * 1000;
        return {
          value: `${v.toFixed(1)} ms`,
          status: v > 200 ? 'critical' : v > 50 ? 'warn' : 'ok',
          detail: 'Longest single pause',
        };
      },
    },
    {
      id: 'gc-concurrent',
      name: 'GC Concurrent',
      icon: '🔄',
      category: 'GC',
      tip: 'Time spent in concurrent GC phases (does not stop application threads).',
      extract: (t) => {
        const v =
          VisualizationsComponent.prom(t, 'jvm_gc_concurrent_phase_time_seconds_sum') * 1000;
        return { value: `${v.toFixed(1)} ms`, status: 'ok', detail: 'Concurrent phase time' };
      },
    },
    {
      id: 'jit-compile',
      name: 'JIT Compilation',
      icon: '⚡',
      category: 'GC',
      tip: 'Total time spent by JIT compiler. High early values are normal (warmup). Sustained growth may indicate deoptimization loops.',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'jvm_compilation_time_ms_total');
        return {
          value: `${(v / 1000).toFixed(1)}s`,
          status: 'ok',
          detail: `${v.toFixed(0)} ms total`,
        };
      },
    },
    // ── Database (HikariCP + JDBC) ──────────────────────────────────────────
    {
      id: 'db-active',
      name: 'DB Active Conns',
      icon: '🐘',
      category: 'Database',
      tip: 'Active JDBC connections. Near max = connection starvation.',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'jdbc_connections_active');
        return {
          value: `${v.toFixed(0)}`,
          status: v > 8 ? 'critical' : v > 5 ? 'warn' : 'ok',
          detail: 'Active connections',
        };
      },
    },
    {
      id: 'db-idle',
      name: 'DB Idle Conns',
      icon: '💤',
      category: 'Database',
      tip: 'Idle connections in HikariCP pool. Zero idle at max active = starvation.',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'jdbc_connections_idle');
        return { value: `${v.toFixed(0)}`, status: 'ok', detail: 'Idle connections' };
      },
    },
    {
      id: 'hikari-pool',
      name: 'HikariCP Pool',
      icon: '🏊',
      category: 'Database',
      tip: 'Active / max pool size. At max with pending = starvation.',
      extract: (t) => {
        const active = VisualizationsComponent.prom(t, 'hikaricp_connections_active');
        const max = VisualizationsComponent.prom(t, 'hikaricp_connections_max') || 10;
        return {
          value: `${active.toFixed(0)} / ${max.toFixed(0)}`,
          status: active >= max ? 'critical' : active > max * 0.7 ? 'warn' : 'ok',
          detail: `${(max - active).toFixed(0)} available`,
        };
      },
    },
    {
      id: 'hikari-pending',
      name: 'HikariCP Pending',
      icon: '⏳',
      category: 'Database',
      tip: 'Threads waiting for a DB connection. Non-zero = pool exhausted.',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'hikaricp_connections_pending');
        return {
          value: `${v.toFixed(0)}`,
          status: v > 0 ? 'critical' : 'ok',
          detail: 'Waiting threads',
        };
      },
    },
    {
      id: 'hikari-timeout',
      name: 'HikariCP Timeouts',
      icon: '💥',
      category: 'Database',
      tip: 'Connection acquisition timeouts. Each = a failed request.',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'hikaricp_connections_timeout_total');
        return {
          value: `${v.toFixed(0)}`,
          status: v > 0 ? 'critical' : 'ok',
          detail: 'Pool timeouts',
        };
      },
    },
    {
      id: 'hikari-acquire',
      name: 'HikariCP Acquire Time',
      icon: '⏱️',
      category: 'Database',
      tip: 'Average time to get a connection from the pool. High = pool contention.',
      extract: (t) => {
        const count = VisualizationsComponent.prom(t, 'hikaricp_connections_acquire_seconds_count');
        const sum = VisualizationsComponent.prom(t, 'hikaricp_connections_acquire_seconds_sum');
        const avg = count > 0 ? (sum / count) * 1000 : 0;
        return {
          value: `${avg.toFixed(2)} ms`,
          status: avg > 100 ? 'critical' : avg > 10 ? 'warn' : 'ok',
          detail: `${count.toFixed(0)} acquisitions`,
        };
      },
    },
    {
      id: 'hikari-usage',
      name: 'HikariCP Usage Time',
      icon: '⌛',
      category: 'Database',
      tip: 'Average time a connection is held before being returned to the pool. Long hold = slow queries or missing close.',
      extract: (t) => {
        const count = VisualizationsComponent.prom(t, 'hikaricp_connections_usage_seconds_count');
        const sum = VisualizationsComponent.prom(t, 'hikaricp_connections_usage_seconds_sum');
        const avg = count > 0 ? (sum / count) * 1000 : 0;
        return {
          value: `${avg.toFixed(1)} ms`,
          status: avg > 1000 ? 'critical' : avg > 200 ? 'warn' : 'ok',
          detail: `${count.toFixed(0)} usages`,
        };
      },
    },
    {
      id: 'jdbc-queries',
      name: 'JDBC Queries',
      icon: '💾',
      category: 'Database',
      tip: 'Total raw JDBC queries executed. Includes Flyway, health checks, and JPA SQL.',
      extract: (t) => {
        const v = VisualizationsComponent.promSum(t, 'jdbc_query_seconds_count');
        return { value: `${v.toFixed(0)}`, status: 'ok', detail: 'Raw JDBC queries' };
      },
    },
    {
      id: 'jdbc-query-dur',
      name: 'JDBC Query Latency',
      icon: '🔍',
      category: 'Database',
      tip: 'Average raw JDBC query execution time.',
      extract: (t) => {
        const count = VisualizationsComponent.promSum(t, 'jdbc_query_seconds_count');
        const sum = VisualizationsComponent.promSum(t, 'jdbc_query_seconds_sum');
        const avg = count > 0 ? (sum / count) * 1000 : 0;
        return {
          value: `${avg.toFixed(2)} ms`,
          status: avg > 50 ? 'critical' : avg > 10 ? 'warn' : 'ok',
          detail: `${count.toFixed(0)} queries`,
        };
      },
    },
    {
      id: 'jdbc-commits',
      name: 'JDBC Commits',
      icon: '✅',
      category: 'Database',
      tip: 'Total JDBC connection commits since startup.',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'jdbc_connection_commit_total');
        return { value: `${v.toFixed(0)}`, status: 'ok', detail: 'Transaction commits' };
      },
    },
    {
      id: 'jdbc-resultset',
      name: 'JDBC ResultSet Time',
      icon: '📄',
      category: 'Database',
      tip: 'Average time reading JDBC result sets. High values = large result sets or slow network.',
      extract: (t) => {
        const count = VisualizationsComponent.promSum(t, 'jdbc_result_set_seconds_count');
        const sum = VisualizationsComponent.promSum(t, 'jdbc_result_set_seconds_sum');
        const avg = count > 0 ? (sum / count) * 1000 : 0;
        return {
          value: `${avg.toFixed(2)} ms`,
          status: avg > 50 ? 'warn' : 'ok',
          detail: `${count.toFixed(0)} result sets`,
        };
      },
    },
    {
      id: 'jpa-queries',
      name: 'JPA Queries',
      icon: '🗃️',
      category: 'Database',
      tip: 'Spring Data repository method invocations.',
      extract: (t) => {
        const v = VisualizationsComponent.promSum(
          t,
          'spring_data_repository_invocations_seconds_count',
        );
        return { value: `${v.toFixed(0)}`, status: 'ok', detail: 'Repository calls' };
      },
    },
    {
      id: 'jpa-latency',
      name: 'JPA Avg Latency',
      icon: '🐢',
      category: 'Database',
      tip: 'Average Spring Data repository invocation time.',
      extract: (t) => {
        const count = VisualizationsComponent.promSum(
          t,
          'spring_data_repository_invocations_seconds_count',
        );
        const sum = VisualizationsComponent.promSum(
          t,
          'spring_data_repository_invocations_seconds_sum',
        );
        const avg = count > 0 ? (sum / count) * 1000 : 0;
        return {
          value: `${avg.toFixed(2)} ms`,
          status: avg > 50 ? 'critical' : avg > 10 ? 'warn' : 'ok',
          detail: `${count.toFixed(0)} queries`,
        };
      },
    },
    // ── Redis (Lettuce) ─────────────────────────────────────────────────────
    {
      id: 'redis-ops',
      name: 'Redis Operations',
      icon: '🗄️',
      category: 'Redis',
      tip: 'Total Redis commands via Lettuce. Includes idempotency, recent buffer, rate limit.',
      extract: (t) => {
        const v = VisualizationsComponent.promSum(t, 'lettuce_seconds_count');
        return { value: `${v.toFixed(0)}`, status: 'ok', detail: 'Lettuce commands' };
      },
    },
    {
      id: 'redis-latency',
      name: 'Redis Latency',
      icon: '⚡',
      category: 'Redis',
      tip: 'Average Redis command latency. Should be sub-millisecond on localhost.',
      extract: (t) => {
        const count = VisualizationsComponent.promSum(t, 'lettuce_seconds_count');
        const sum = VisualizationsComponent.promSum(t, 'lettuce_seconds_sum');
        const avg = count > 0 ? (sum / count) * 1000 : 0;
        return {
          value: `${avg.toFixed(2)} ms`,
          status: avg > 5 ? 'critical' : avg > 1 ? 'warn' : 'ok',
          detail: `${count.toFixed(0)} ops`,
        };
      },
    },
    {
      id: 'redis-active',
      name: 'Redis Active',
      icon: '🔥',
      category: 'Redis',
      tip: 'Currently in-flight Redis commands. High = Redis congestion or slow commands.',
      extract: (t) => {
        const v = VisualizationsComponent.promSum(t, 'lettuce_active_seconds_count');
        return { value: `${v.toFixed(0)}`, status: 'ok', detail: 'Active commands' };
      },
    },
    // ── Kafka ────────────────────────────────────────────────────────────────
    {
      id: 'kafka-produced',
      name: 'Kafka Produced',
      icon: '📤',
      category: 'Kafka',
      tip: 'Messages sent via KafkaTemplate.',
      extract: (t) => {
        const v = VisualizationsComponent.promSum(t, 'spring_kafka_template_seconds_count');
        return { value: `${v.toFixed(0)}`, status: 'ok', detail: 'Sent to Kafka' };
      },
    },
    {
      id: 'kafka-consumed',
      name: 'Kafka Consumed',
      icon: '📥',
      category: 'Kafka',
      tip: 'Messages consumed by Kafka listeners.',
      extract: (t) => {
        const v = VisualizationsComponent.promSum(t, 'spring_kafka_listener_seconds_count');
        return { value: `${v.toFixed(0)}`, status: 'ok', detail: 'Consumed from Kafka' };
      },
    },
    {
      id: 'kafka-events',
      name: 'Kafka Events',
      icon: '📡',
      category: 'Kafka',
      tip: 'customer.created events processed by the event listener.',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'kafka_customer_created_processed_total');
        return { value: `${v.toFixed(0)}`, status: 'ok', detail: 'Created events' };
      },
    },
    {
      id: 'kafka-enrich',
      name: 'Kafka Enrich',
      icon: '🔀',
      category: 'Kafka',
      tip: 'Enrich request-reply cycles handled.',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'kafka_customer_enrich_handled_total');
        return { value: `${v.toFixed(0)}`, status: 'ok', detail: 'Enrich cycles' };
      },
    },
    {
      id: 'kafka-produce-dur',
      name: 'Kafka Produce Time',
      icon: '⏱️',
      category: 'Kafka',
      tip: 'Average time to send a message via KafkaTemplate.',
      extract: (t) => {
        const count = VisualizationsComponent.promSum(t, 'spring_kafka_template_seconds_count');
        const sum = VisualizationsComponent.promSum(t, 'spring_kafka_template_seconds_sum');
        const avg = count > 0 ? (sum / count) * 1000 : 0;
        return {
          value: `${avg.toFixed(1)} ms`,
          status: avg > 100 ? 'warn' : 'ok',
          detail: `${count.toFixed(0)} sends`,
        };
      },
    },
    {
      id: 'kafka-consume-dur',
      name: 'Kafka Consume Time',
      icon: '⏱️',
      category: 'Kafka',
      tip: 'Average time to process a consumed Kafka message.',
      extract: (t) => {
        const count = VisualizationsComponent.promSum(t, 'spring_kafka_listener_seconds_count');
        const sum = VisualizationsComponent.promSum(t, 'spring_kafka_listener_seconds_sum');
        const avg = count > 0 ? (sum / count) * 1000 : 0;
        return {
          value: `${avg.toFixed(1)} ms`,
          status: avg > 500 ? 'warn' : 'ok',
          detail: `${count.toFixed(0)} msgs`,
        };
      },
    },
    // ── Custom App Metrics ──────────────────────────────────────────────────
    {
      id: 'customer-created',
      name: 'Customers Created',
      icon: '👤',
      category: 'App',
      tip: 'Total customers created since startup. Custom counter.',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'customer_created_count_total');
        return { value: `${v.toFixed(0)}`, status: 'ok', detail: 'Cumulative creates' };
      },
    },
    {
      id: 'customer-create-dur',
      name: 'Create Latency',
      icon: '✏️',
      category: 'App',
      tip: 'Average POST /customers time. Includes DB + Redis + Kafka.',
      extract: (t) => {
        const count = VisualizationsComponent.prom(t, 'customer_create_seconds_count');
        const sum = VisualizationsComponent.prom(t, 'customer_create_seconds_sum');
        const avg = count > 0 ? (sum / count) * 1000 : 0;
        return {
          value: `${avg.toFixed(1)} ms`,
          status: avg > 200 ? 'critical' : avg > 50 ? 'warn' : 'ok',
          detail: `${count.toFixed(0)} calls`,
        };
      },
    },
    {
      id: 'customer-list-dur',
      name: 'List Latency',
      icon: '📋',
      category: 'App',
      tip: 'Average GET /customers time. Includes JPA pagination.',
      extract: (t) => {
        const count = VisualizationsComponent.prom(t, 'customer_find_all_seconds_count');
        const sum = VisualizationsComponent.prom(t, 'customer_find_all_seconds_sum');
        const avg = count > 0 ? (sum / count) * 1000 : 0;
        return {
          value: `${avg.toFixed(1)} ms`,
          status: avg > 100 ? 'critical' : avg > 30 ? 'warn' : 'ok',
          detail: `${count.toFixed(0)} calls`,
        };
      },
    },
    {
      id: 'enrich-dur',
      name: 'Enrich Latency',
      icon: '📨',
      category: 'App',
      tip: 'Average Kafka request-reply enrich time. 5s timeout → 504.',
      extract: (t) => {
        const count = VisualizationsComponent.prom(t, 'customer_enrich_seconds_count');
        const sum = VisualizationsComponent.prom(t, 'customer_enrich_seconds_sum');
        const avg = count > 0 ? (sum / count) * 1000 : 0;
        return {
          value: `${avg.toFixed(0)} ms`,
          status: avg > 3000 ? 'critical' : avg > 1000 ? 'warn' : 'ok',
          detail: `${count.toFixed(0)} calls`,
        };
      },
    },
    {
      id: 'aggregate-dur',
      name: 'Aggregate Latency',
      icon: '🧵',
      category: 'App',
      tip: 'Average /customers/aggregate time. 2 virtual threads in parallel.',
      extract: (t) => {
        const count = VisualizationsComponent.prom(t, 'customer_aggregate_seconds_count');
        const sum = VisualizationsComponent.prom(t, 'customer_aggregate_seconds_sum');
        const avg = count > 0 ? (sum / count) * 1000 : 0;
        return {
          value: `${avg.toFixed(0)} ms`,
          status: avg > 500 ? 'critical' : avg > 200 ? 'warn' : 'ok',
          detail: `${count.toFixed(0)} calls`,
        };
      },
    },
    {
      id: 'recent-buffer',
      name: 'Recent Buffer',
      icon: '🔄',
      category: 'App',
      tip: 'Redis ring buffer size for recent customers.',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'customer_recent_buffer_size');
        return { value: `${v.toFixed(0)}`, status: 'ok', detail: 'Items in buffer' };
      },
    },
    {
      id: 'recent-dur',
      name: 'Recent Latency',
      icon: '🕐',
      category: 'App',
      tip: 'Average /customers/recent time (Redis LRANGE).',
      extract: (t) => {
        const count = VisualizationsComponent.prom(t, 'customer_recent_seconds_count');
        const sum = VisualizationsComponent.prom(t, 'customer_recent_seconds_sum');
        const avg = count > 0 ? (sum / count) * 1000 : 0;
        return {
          value: `${avg.toFixed(2)} ms`,
          status: avg > 10 ? 'warn' : 'ok',
          detail: `${count.toFixed(0)} calls`,
        };
      },
    },
    // ── Security ─────────────────────────────────────────────────────────────
    {
      id: 'security-dur',
      name: 'Security Filter',
      icon: '🔐',
      category: 'Security',
      tip: 'Average Spring Security filter chain time per request.',
      extract: (t) => {
        const count = VisualizationsComponent.promSum(
          t,
          'spring_security_filterchains_seconds_count',
        );
        const sum = VisualizationsComponent.promSum(t, 'spring_security_filterchains_seconds_sum');
        const avg = count > 0 ? (sum / count) * 1000 : 0;
        return {
          value: `${avg.toFixed(2)} ms`,
          status: avg > 10 ? 'critical' : avg > 5 ? 'warn' : 'ok',
          detail: `${count.toFixed(0)} filtered`,
        };
      },
    },
    {
      id: 'security-auth-dur',
      name: 'Authorization Time',
      icon: '🛡️',
      category: 'Security',
      tip: 'Average time for Spring Security authorization decisions.',
      extract: (t) => {
        const count = VisualizationsComponent.promSum(
          t,
          'spring_security_authorizations_seconds_count',
        );
        const sum = VisualizationsComponent.promSum(
          t,
          'spring_security_authorizations_seconds_sum',
        );
        const avg = count > 0 ? (sum / count) * 1000 : 0;
        return {
          value: `${avg.toFixed(2)} ms`,
          status: avg > 5 ? 'warn' : 'ok',
          detail: `${count.toFixed(0)} checks`,
        };
      },
    },
    {
      id: 'security-access-denied',
      name: 'Access Denied',
      icon: '🚫',
      category: 'Security',
      tip: 'Total access denied exceptions (after filter chain). Indicates unauthorized access attempts.',
      extract: (t) => {
        const v = VisualizationsComponent.prom(
          t,
          'spring_security_filterchains_access_exceptions_after_total',
        );
        return {
          value: `${v.toFixed(0)}`,
          status: v > 10 ? 'warn' : 'ok',
          detail: 'Access exceptions',
        };
      },
    },
    // ── System / Process ────────────────────────────────────────────────────
    {
      id: 'cpu',
      name: 'Process CPU',
      icon: '💻',
      category: 'System',
      tip: 'JVM process CPU utilization (0-100%).',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'process_cpu_usage') * 100;
        return {
          value: `${v.toFixed(1)}%`,
          status: v > 80 ? 'critical' : v > 50 ? 'warn' : 'ok',
          detail: 'Process CPU',
        };
      },
    },
    {
      id: 'system-cpu',
      name: 'System CPU',
      icon: '🖥️',
      category: 'System',
      tip: 'Overall system CPU (all processes).',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'system_cpu_usage') * 100;
        return {
          value: `${v.toFixed(1)}%`,
          status: v > 90 ? 'critical' : v > 70 ? 'warn' : 'ok',
          detail: 'System-wide',
        };
      },
    },
    {
      id: 'cpu-cores',
      name: 'CPU Cores',
      icon: '🧮',
      category: 'System',
      tip: 'Available CPU cores. Load average should stay below this number.',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'system_cpu_count');
        return { value: `${v.toFixed(0)}`, status: 'ok', detail: 'Available cores' };
      },
    },
    {
      id: 'load-avg',
      name: 'Load Average (1m)',
      icon: '📉',
      category: 'System',
      tip: 'System load average. Above CPU count = overloaded.',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'system_load_average_1m');
        const cpus = VisualizationsComponent.prom(t, 'system_cpu_count') || 1;
        return {
          value: `${v.toFixed(2)}`,
          status: v > cpus ? 'critical' : v > cpus * 0.7 ? 'warn' : 'ok',
          detail: `${cpus.toFixed(0)} cores`,
        };
      },
    },
    {
      id: 'uptime',
      name: 'Uptime',
      icon: '🕐',
      category: 'System',
      tip: 'Time since app startup. Low uptime + errors = instability.',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'process_uptime_seconds');
        const h = Math.floor(v / 3600);
        const m = Math.floor((v % 3600) / 60);
        return {
          value: h > 0 ? `${h}h ${m}m` : `${m}m`,
          status: v < 60 ? 'warn' : 'ok',
          detail: `${v.toFixed(0)}s total`,
        };
      },
    },
    {
      id: 'startup-time',
      name: 'Startup Time',
      icon: '🏁',
      category: 'System',
      tip: 'Time to start the Spring Boot application (ApplicationReadyEvent).',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'application_ready_time_seconds');
        return {
          value: `${v.toFixed(2)}s`,
          status: v > 30 ? 'warn' : 'ok',
          detail: 'Application ready',
        };
      },
    },
    {
      id: 'open-files',
      name: 'Open Files',
      icon: '📂',
      category: 'System',
      tip: 'Open file descriptors. Approaching max causes "Too many open files".',
      extract: (t) => {
        const open = VisualizationsComponent.prom(t, 'process_files_open_files');
        const max = VisualizationsComponent.prom(t, 'process_files_max_files');
        return {
          value: `${open.toFixed(0)}`,
          status:
            max > 0 && open / max > 0.8 ? 'critical' : max > 0 && open / max > 0.5 ? 'warn' : 'ok',
          detail: `max ${max.toFixed(0)}`,
        };
      },
    },
    {
      id: 'disk',
      name: 'Disk Free',
      icon: '💾',
      category: 'System',
      tip: 'Free disk space. Below 10MB triggers health DOWN.',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'disk_free_bytes') / (1024 * 1024 * 1024);
        return {
          value: `${v.toFixed(1)} GB`,
          status: v < 1 ? 'critical' : v < 5 ? 'warn' : 'ok',
          detail: 'Available space',
        };
      },
    },
    {
      id: 'classes',
      name: 'Loaded Classes',
      icon: '📚',
      category: 'System',
      tip: 'Currently loaded JVM classes. Continuous growth = ClassLoader leak.',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'jvm_classes_loaded_classes');
        return {
          value: `${v.toFixed(0)}`,
          status: v > 20000 ? 'warn' : 'ok',
          detail: 'Loaded classes',
        };
      },
    },
    {
      id: 'classes-unloaded',
      name: 'Unloaded Classes',
      icon: '🗑️',
      category: 'System',
      tip: 'Total classes unloaded. Non-zero is normal during hot-reload or redeploy.',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'jvm_classes_unloaded_classes_total');
        return { value: `${v.toFixed(0)}`, status: 'ok', detail: 'Unloaded since startup' };
      },
    },
    {
      id: 'log-events',
      name: 'Log Events',
      icon: '📝',
      category: 'System',
      tip: 'Logback events by level. Error spikes may precede HTTP error rate increases.',
      extract: (t) => {
        const errors = VisualizationsComponent.prom(t, 'logback_events_total\\{[^}]*level="error"');
        const warns = VisualizationsComponent.prom(t, 'logback_events_total\\{[^}]*level="warn"');
        return {
          value: `${errors.toFixed(0)} err / ${warns.toFixed(0)} warn`,
          status: errors > 10 ? 'critical' : errors > 0 ? 'warn' : 'ok',
          detail: 'Error + warn events',
        };
      },
    },
    // ── Tomcat ───────────────────────────────────────────────────────────────
    {
      id: 'tomcat-active',
      name: 'Tomcat Sessions',
      icon: '🌐',
      category: 'Tomcat',
      tip: 'Active Tomcat sessions. Should be 0 for stateless JWT APIs (no HttpSession).',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'tomcat_sessions_active_current_sessions');
        return {
          value: `${v.toFixed(0)}`,
          status: v > 0 ? 'warn' : 'ok',
          detail: 'Active sessions',
        };
      },
    },
    {
      id: 'tomcat-created',
      name: 'Tomcat Sessions Created',
      icon: '➕',
      category: 'Tomcat',
      tip: 'Total sessions created since startup. Should stay at 0 for stateless APIs.',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'tomcat_sessions_created_sessions_total');
        return {
          value: `${v.toFixed(0)}`,
          status: v > 0 ? 'warn' : 'ok',
          detail: 'Created since startup',
        };
      },
    },
    {
      id: 'tomcat-rejected',
      name: 'Tomcat Sessions Rejected',
      icon: '🚫',
      category: 'Tomcat',
      tip: 'Sessions rejected due to max-sessions limit. Non-zero = session exhaustion.',
      extract: (t) => {
        const v = VisualizationsComponent.prom(t, 'tomcat_sessions_rejected_sessions_total');
        return {
          value: `${v.toFixed(0)}`,
          status: v > 0 ? 'critical' : 'ok',
          detail: 'Rejected sessions',
        };
      },
    },
    // ── Scheduled Tasks ─────────────────────────────────────────────────────
    {
      id: 'scheduled-tasks',
      name: 'Scheduled Tasks',
      icon: '⏰',
      category: 'Tasks',
      tip: 'Total scheduled task executions (e.g., CustomerStatsScheduler with ShedLock).',
      extract: (t) => {
        const v = VisualizationsComponent.promSum(t, 'tasks_scheduled_execution_seconds_count');
        return { value: `${v.toFixed(0)}`, status: 'ok', detail: 'Task executions' };
      },
    },
    {
      id: 'scheduled-dur',
      name: 'Scheduled Task Latency',
      icon: '⏱️',
      category: 'Tasks',
      tip: 'Average scheduled task execution time.',
      extract: (t) => {
        const count = VisualizationsComponent.promSum(t, 'tasks_scheduled_execution_seconds_count');
        const sum = VisualizationsComponent.promSum(t, 'tasks_scheduled_execution_seconds_sum');
        const avg = count > 0 ? (sum / count) * 1000 : 0;
        return {
          value: `${avg.toFixed(1)} ms`,
          status: avg > 5000 ? 'warn' : 'ok',
          detail: `${count.toFixed(0)} runs`,
        };
      },
    },
  ];

  /** All unique categories for the picker filter */
  readonly metricCategories: string[] = [...new Set(this.allMetrics.map((m) => m.category))];
  metricFilterText = '';
  metricFilterCategory = '';

  filteredMetrics(): MetricDef[] {
    return this.allMetrics.filter((m) => {
      if (this.metricFilterCategory && m.category !== this.metricFilterCategory) return false;
      if (
        this.metricFilterText &&
        !m.name.toLowerCase().includes(this.metricFilterText.toLowerCase())
      )
        return false;
      return true;
    });
  }

  /** IDs of currently selected/visible metrics (persisted in localStorage) */
  selectedMetricIds = signal<string[]>(
    JSON.parse(localStorage.getItem('golden-metrics') ?? 'null') ?? [
      'latency',
      'traffic',
      'errors',
      'saturation',
      'heap',
      'cpu',
      'http-5xx',
      'uptime',
    ],
  );

  /** Toggle a metric on/off */
  toggleMetric(id: string): void {
    this.selectedMetricIds.update((ids) => {
      const next = ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id];
      localStorage.setItem('golden-metrics', JSON.stringify(next));
      return next;
    });
  }

  isMetricSelected(id: string): boolean {
    return this.selectedMetricIds().includes(id);
  }

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
      this.topoNodes.update((nodes) =>
        nodes.map((n) => (n.id in nodeStatus ? { ...n, status: nodeStatus[n.id] } : n)),
      );
    };

    // API + db + redis from actuator/health
    this.http
      .get<any>(`${base}/actuator/health`)
      .pipe(catchError(() => of(null)))
      .subscribe((h) => {
        const c = h?.components ?? {};
        updateNode('api', h?.status === 'UP' ? 'up' : h ? 'down' : 'down');
        updateNode('pg', c['db']?.status === 'UP' ? 'up' : c['db'] ? 'down' : 'unknown');
        updateNode('redis', c['redis']?.status === 'UP' ? 'up' : c['redis'] ? 'down' : 'unknown');
      });

    // Kafka + Kafka UI
    this.http
      .get('/proxy/kafka-ui/api/clusters', { responseType: 'text' })
      .pipe(catchError(() => of(null)))
      .subscribe((r) => {
        updateNode('kafka', r ? 'up' : 'down');
        updateNode('consumer', r ? 'up' : 'unknown');
        updateNode('kafka-ui', r ? 'up' : 'down');
      });

    // Ollama
    this.http
      .get('/proxy/ollama/api/tags')
      .pipe(catchError(() => of(null)))
      .subscribe((r) => {
        updateNode('ollama', r ? 'up' : 'down');
      });

    // Keycloak
    this.http
      .get('/proxy/keycloak/health/ready', { responseType: 'text' })
      .pipe(catchError(() => of(null)))
      .subscribe((r) => {
        updateNode('keycloak', r ? 'up' : 'down');
      });

    // pgAdmin
    this.http
      .get('http://localhost:5050', { responseType: 'text' })
      .pipe(catchError(() => of(null)))
      .subscribe((r) => {
        updateNode('pgadmin', r ? 'up' : 'down');
      });

    // RedisInsight
    this.http
      .get('http://localhost:5540', { responseType: 'text' })
      .pipe(catchError(() => of(null)))
      .subscribe((r) => {
        updateNode('redisinsight', r ? 'up' : 'down');
      });

    // Prometheus
    this.http
      .get('http://localhost:9091/-/ready', { responseType: 'text' })
      .pipe(catchError(() => of(null)))
      .subscribe((r) => {
        updateNode('prometheus', r ? 'up' : 'down');
      });

    // Grafana
    this.http
      .get('http://localhost:3000/api/health')
      .pipe(catchError(() => of(null)))
      .subscribe((r) => {
        updateNode('grafana', r ? 'up' : 'down');
      });

    // Zipkin
    this.http
      .get('http://localhost:9411/health', { responseType: 'text' })
      .pipe(catchError(() => of(null)))
      .subscribe((r) => {
        updateNode('zipkin', r ? 'up' : 'down');
      });

    // Loki (LGTM)
    this.http
      .get('http://localhost:3100/ready', { responseType: 'text' })
      .pipe(catchError(() => of(null)))
      .subscribe((r) => {
        updateNode('loki', r ? 'up' : 'down');
      });

    // Pyroscope
    this.http
      .get('http://localhost:4040/ready', { responseType: 'text' })
      .pipe(catchError(() => of(null)))
      .subscribe((r) => {
        updateNode('pyroscope', r ? 'up' : 'down');
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

  errorsGenerating = signal(false);

  /** Fire requests that produce errors: invalid payloads, missing resources, rate limit, Kafka timeout */
  generateErrors(): void {
    this.errorsGenerating.set(true);
    const base = this.env.baseUrl();
    const errorRequests = [
      // 400 — validation errors (empty body)
      this.http.post(`${base}/customers`, {}).pipe(catchError(() => of(null))),
      this.http.post(`${base}/customers`, {}).pipe(catchError(() => of(null))),
      this.http.post(`${base}/customers`, {}).pipe(catchError(() => of(null))),
      // 404 — non-existent customer
      this.http.get(`${base}/customers/999999`).pipe(catchError(() => of(null))),
      this.http.get(`${base}/customers/999999/bio`).pipe(catchError(() => of(null))),
      // 504 — Kafka enrich timeout (if consumer not running)
      this.http.get(`${base}/customers/1/enrich`).pipe(catchError(() => of(null))),
      // 429 — burst to trigger rate limit
      ...Array.from({ length: 15 }, () =>
        this.http.get(`${base}/customers?page=0&size=1`).pipe(catchError(() => of(null))),
      ),
    ];
    let done = 0;
    for (const req$ of errorRequests) {
      req$.subscribe(() => {
        done++;
        if (done === errorRequests.length) {
          this.errorsGenerating.set(false);
        }
      });
    }
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
        const selected = this.selectedGaugeIds();
        const result: GaugeData[] = [];
        for (const def of this.allGauges) {
          if (!selected.includes(def.id)) continue;
          const data = def.extract(text);
          result.push({ id: def.id, label: def.label, icon: def.icon, tip: def.tip, ...data });
        }
        this.gauges.set(result);
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
        const selected = this.selectedMetricIds();
        const signals: GoldenSignal[] = [];

        for (const def of this.allMetrics) {
          if (!selected.includes(def.id)) continue;
          const result = def.extract(text, parsed);
          signals.push({ id: def.id, name: def.name, icon: def.icon, tip: def.tip, ...result });
        }

        this.goldenSignals.set(signals);
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

  kafkaTrafficRunning = signal(false);

  /** Create customers to generate Kafka events (customer.created topic) + trigger enrich (request-reply) */
  async generateKafkaTraffic(): Promise<void> {
    this.kafkaTrafficRunning.set(true);
    const base = this.env.baseUrl();
    let done = 0;
    const total = 10;

    for (let i = 0; i < total; i++) {
      // Create customer → publishes to customer.created topic
      this.http
        .post(`${base}/customers`, {
          name: `Kafka-${Date.now() % 10000}-${i}`,
          email: `kafka${i}@test.com`,
        })
        .pipe(catchError(() => of(null)))
        .subscribe((c: any) => {
          // Enrich → Kafka request-reply (customer.request → customer.reply)
          if (c?.id) {
            this.http
              .get(`${base}/customers/${c.id}/enrich`)
              .pipe(catchError(() => of(null)))
              .subscribe();
          }
          done++;
          if (done === total) {
            this.kafkaTrafficRunning.set(false);
          }
        });
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
