/**
 * TimelineComponent — Live customer creation feed via SSE.
 *
 * Connects to GET /customers/stream (Server-Sent Events).
 * New customers slide in at the top; keeps last 50 in memory.
 * "NEW" badge fades after 5 seconds per entry.
 */
import { Component, inject, signal, OnDestroy } from '@angular/core';
import { DatePipe } from '@angular/common';
import { EnvService } from '../../core/env/env.service';

interface LiveCustomer {
  id: number;
  name: string;
  email: string;
  createdAt: string;
  isNew: boolean;
}

type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

const MAX_EVENTS = 50;
const NEW_BADGE_DURATION_MS = 5_000;
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

  events = signal<LiveCustomer[]>([]);
  status = signal<ConnectionStatus>('connecting');

  private _es: EventSource | null = null;
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _badgeTimers = new Map<number, ReturnType<typeof setTimeout>>();

  constructor() {
    this.connect();
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

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
}
