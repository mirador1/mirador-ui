/**
 * TimelineComponent — Live Feeds with two tabs.
 *
 * Tab 1 — SSE (Customer Events):
 *   Connects to GET /customers/stream (Server-Sent Events).
 *   New customers slide in at the top; keeps last 50 in memory.
 *   "NEW" badge fades after 5 seconds per entry.
 *
 * Tab 2 — Endpoint Activity:
 *   Polls /actuator/prometheus every 2s and extracts HTTP request
 *   metrics to display a scrolling feed of method/URI/status entries.
 */
import { Component, inject, signal, OnDestroy } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { catchError, of } from 'rxjs';
import { EnvService } from '../../core/env/env.service';
import { ToastService } from '../../core/toast/toast.service';

/**
 * A customer event received from the SSE stream at `/customers/stream`.
 * `isNew` is added client-side and fades after `NEW_BADGE_DURATION_MS`.
 */
interface LiveCustomer {
  id: number;
  name: string;
  email: string;
  /** ISO-8601 creation timestamp from the server. */
  createdAt: string;
  /** Client-side flag: true for `NEW_BADGE_DURATION_MS` after arrival, then set to false. */
  isNew: boolean;
}

/** SSE connection lifecycle states, mapped to status badge colors in the template. */
type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

/** Maximum number of SSE events to keep in memory (oldest are discarded). */
const MAX_EVENTS = 50;

/** Duration in milliseconds for which the NEW badge is shown on a fresh event. */
const NEW_BADGE_DURATION_MS = 5_000;

/** Delay in milliseconds before reconnecting after an SSE error. */
const RECONNECT_DELAY_MS = 3_000;

@Component({
  selector: 'app-timeline',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './timeline.component.html',
  styleUrl: './timeline.component.scss',
})
export class TimelineComponent implements OnDestroy {
  private readonly env = inject(EnvService);
  private readonly http = inject(HttpClient);
  private readonly toast = inject(ToastService);

  /** Signal: currently active tab — `'sse'` for live customer events, `'activity'` for endpoint feed. */
  activeTab = signal<'sse' | 'activity'>('sse');

  // ── SSE tab ───────────────────────────────────────────────────────────────

  /** Signal: list of the last `MAX_EVENTS` customers received via SSE, newest first. */
  events = signal<LiveCustomer[]>([]);

  /** Signal: current SSE connection state, displayed as a status badge. */
  status = signal<ConnectionStatus>('connecting');

  /** Signal: true while the SSE traffic generator is running. */
  sseTrafficRunning = signal(false);

  /** The active `EventSource` connection. Null when disconnected. */
  private _es: EventSource | null = null;

  /** Timer handle for the SSE reconnect delay. Cleared when reconnect fires. */
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  /** Map of customer ID → badge fade timer. Ensures each NEW badge fades independently. */
  private _badgeTimers = new Map<number, ReturnType<typeof setTimeout>>();

  // ── Activity tab (Prometheus polling) ────────────────────────────────────

  /**
   * Signal: scrolling feed of HTTP endpoint activity entries.
   * Capped at 100 entries, prepended with each poll's new entries (max 5 per poll).
   */
  liveFeed = signal<
    Array<{ time: string; method: string; uri: string; status: string; duration: string }>
  >([]);

  /** Signal: true while the endpoint activity Prometheus polling is running. */
  livePolling = signal(false);

  /** Signal: true while the activity tab traffic generator is running. */
  liveTrafficRunning = signal(false);

  /** Handle for the 2-second Prometheus polling interval. Null when stopped. */
  private _liveTimer: ReturnType<typeof setInterval> | null = null;

  /** Last seen HTTP request count — used to detect new requests between polls. */
  private _lastRequestCount = 0;

  constructor() {
    this.connect();
  }

  ngOnDestroy(): void {
    this.cleanup();
    this.stopLiveFeed();
  }

  // ── SSE ───────────────────────────────────────────────────────────────────
  private connect(): void {
    this.cleanup();
    this.status.set('connecting');

    const base = this.env.baseUrl();
    // Use the Angular proxy path so we stay on the same origin
    const url = `${base}/customers/stream`;

    try {
      this._es = new EventSource(url);

      this._es.addEventListener('customer', (e: MessageEvent) => {
        this.status.set('connected');
        try {
          const customer = JSON.parse(e.data) as LiveCustomer;
          customer.isNew = true;
          this.events.update((prev) => {
            const next = [customer, ...prev].slice(0, MAX_EVENTS);
            return next;
          });

          // Fade the NEW badge after 5 s
          const t = setTimeout(() => {
            this.events.update((prev) =>
              prev.map((ev) => (ev.id === customer.id ? { ...ev, isNew: false } : ev)),
            );
            this._badgeTimers.delete(customer.id);
          }, NEW_BADGE_DURATION_MS);
          this._badgeTimers.set(customer.id, t);
        } catch {
          // ignore parse errors
        }
      });

      this._es.addEventListener('ping', () => {
        this.status.set('connected');
      });

      this._es.onopen = () => this.status.set('connected');

      this._es.onerror = () => {
        this.status.set('reconnecting');
        this._es?.close();
        this._es = null;
        this._reconnectTimer = setTimeout(() => this.connect(), RECONNECT_DELAY_MS);
      };
    } catch {
      this.status.set('disconnected');
    }
  }

  reconnect(): void {
    this.connect();
  }

  /** Create N random customers to trigger SSE events */
  generateSseTraffic(count = 3): void {
    this.sseTrafficRunning.set(true);
    const firstNames = ['Alice', 'Bob', 'Carlos', 'Diana', 'Eve', 'Frank', 'Grace', 'Hiro'];
    const lastNames = ['Smith', 'Jones', 'Tanaka', 'Müller', 'Dupont', 'Kim', 'Rossi', 'Patel'];
    const rand = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
    const base = this.env.baseUrl();
    let done = 0;
    for (let i = 0; i < count; i++) {
      const first = rand(firstNames);
      const last = rand(lastNames);
      const suffix = Math.floor(Math.random() * 9000 + 1000);
      const body = {
        firstName: first,
        lastName: last,
        email: `${first.toLowerCase()}.${last.toLowerCase()}${suffix}@demo.dev`,
      };
      this.http
        .post(`${base}/customers`, body)
        .pipe(catchError(() => of(null)))
        .subscribe(() => {
          done++;
          if (done === count) {
            this.sseTrafficRunning.set(false);
            this.toast.show(`${count} customer(s) created — SSE event(s) incoming`, 'success');
          }
        });
    }
  }

  private cleanup(): void {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    this._badgeTimers.forEach((t) => clearTimeout(t));
    this._badgeTimers.clear();
    if (this._es) {
      this._es.close();
      this._es = null;
    }
  }

  statusLabel(s: ConnectionStatus): string {
    switch (s) {
      case 'connected':
        return '● Connected';
      case 'connecting':
        return '◌ Connecting…';
      case 'reconnecting':
        return '⟳ Reconnecting…';
      case 'disconnected':
        return '○ Disconnected';
    }
  }

  statusClass(s: ConnectionStatus): string {
    switch (s) {
      case 'connected':
        return 'status-connected';
      case 'connecting':
        return 'status-connecting';
      case 'reconnecting':
        return 'status-reconnecting';
      case 'disconnected':
        return 'status-disconnected';
    }
  }

  // ── Activity feed (Prometheus polling) ───────────────────────────────────
  /** Send a burst of varied requests to animate the live feed */
  generateTrafficForFeed(): void {
    this.liveTrafficRunning.set(true);
    const base = this.env.baseUrl();
    const endpoints = [
      { method: 'GET', url: `${base}/customers?page=0&size=10` },
      { method: 'GET', url: `${base}/customers?page=0&size=10` },
      { method: 'GET', url: `${base}/actuator/health` },
      { method: 'GET', url: `${base}/customers/recent` },
      { method: 'GET', url: `${base}/customers/summary?page=0&size=5` },
      { method: 'GET', url: `${base}/customers/aggregate` },
      { method: 'GET', url: `${base}/customers/1/todos` },
      { method: 'GET', url: `${base}/customers/1/enrich` },
      { method: 'GET', url: `${base}/customers?page=999&size=1` },
      { method: 'GET', url: `${base}/actuator/info` },
    ];
    let done = 0;
    for (const ep of endpoints) {
      this.http
        .get(ep.url)
        .pipe(catchError(() => of(null)))
        .subscribe(() => {
          done++;
          if (done === endpoints.length) this.liveTrafficRunning.set(false);
        });
    }
  }

  toggleLiveFeed(): void {
    if (this.livePolling()) {
      this.stopLiveFeed();
    } else {
      this.livePolling.set(true);
      this.pollMetricsForFeed();
      this._liveTimer = setInterval(() => this.pollMetricsForFeed(), 2000);
    }
  }

  private stopLiveFeed(): void {
    this.livePolling.set(false);
    if (this._liveTimer) {
      clearInterval(this._liveTimer);
      this._liveTimer = null;
    }
  }

  private pollMetricsForFeed(): void {
    this.http.get(`${this.env.baseUrl()}/actuator/prometheus`, { responseType: 'text' }).subscribe({
      next: (text) => {
        const entries: Array<{
          time: string;
          method: string;
          uri: string;
          status: string;
          duration: string;
        }> = [];
        const regex =
          /http_server_requests_seconds_count\{[^}]*method="(\w+)"[^}]*status="(\d+)"[^}]*uri="([^"]+)"[^}]*\}\s+(\d+\.?\d*)/g;
        let m;
        while ((m = regex.exec(text)) !== null) {
          entries.push({
            time: new Date().toISOString().slice(11, 23),
            method: m[1],
            uri: m[3],
            status: m[2],
            duration: '-',
          });
        }
        // Only add new entries based on count changes
        if (entries.length > 0) {
          this.liveFeed.update((f) => [...entries.slice(0, 5), ...f].slice(0, 100));
        }
      },
      error: () => {},
    });
  }
}
