/**
 * TelemetryService — Structured browser telemetry (ADR-0009 Phase A).
 *
 * Replaces scattered `console.log` / `console.error` calls with a single
 * sink so (a) a custom `ErrorHandler` can capture exceptions, (b) a later
 * Phase B can turn each log into a Tempo span event without touching
 * call sites, and (c) a dev opening the Activity page sees what actually
 * happened instead of a blank DevTools console.
 *
 * In Phase A the sink is local-only: a bounded signal history + the
 * existing `ActivityService` timeline. In Phase B (mirador-service
 * CORS proxy :4319) each `error()` / `warn()` call also emits a span
 * event to Tempo. Call sites don't change.
 */
import { Injectable, effect, inject, isDevMode, signal } from '@angular/core';
import { ActivityService } from '../activity/activity.service';
import { EnvService } from '../env/env.service';
import { trace, type Tracer } from '@opentelemetry/api';
import { WebTracerProvider, BatchSpanProcessor } from '@opentelemetry/sdk-trace-web';
import { ZoneContextManager } from '@opentelemetry/context-zone';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { XMLHttpRequestInstrumentation } from '@opentelemetry/instrumentation-xml-http-request';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

/** Severity level for a single telemetry entry. Maps 1:1 to OTel log severity. */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** A single recorded log line plus its structured context. */
export interface LogEntry {
  /** Wall-clock time of the entry — used for DevTools display and OTel span timestamp. */
  readonly time: Date;
  /** Severity level. */
  readonly level: LogLevel;
  /** Human-readable message (no stack trace — use `error` for that). */
  readonly message: string;
  /** Optional free-form context — goes into `span.attributes` in Phase B. */
  readonly context?: Record<string, unknown>;
  /** The original Error, if any — its stack is used for grouping and span events. */
  readonly error?: Error;
}

/** Max entries kept in the in-session history signal. Above this we drop the oldest. */
const HISTORY_CAP = 500;

@Injectable({ providedIn: 'root' })
export class TelemetryService {
  private readonly activity = inject(ActivityService);
  private readonly env = inject(EnvService);

  /**
   * Bounded in-memory history. Consumers (Activity page, future debug panel)
   * read this as a signal so they get zoneless updates for free.
   */
  readonly history = signal<LogEntry[]>([]);

  /** Dev mode short-circuit — we still mirror to the real console then. */
  private readonly dev = isDevMode();

  /**
   * OpenTelemetry tracer for manual spans + error events. Null until
   * {@link initOtel} is called from `bootstrapApplication`. Manual code
   * paths that would log a span event when available can null-check this.
   */
  private tracer: Tracer | null = null;

  /**
   * The OTel provider (retained so we can call `shutdown()` if the app
   * ever needs to drain spans on teardown — not wired today).
   */
  private provider: WebTracerProvider | null = null;
  /** Remember the last-initialised OTLP URL for the idempotency check. */
  private lastOtlpUrl: string | null = null;

  constructor() {
    // Re-init the exporter when the user flips env — each env has its own
    // `otlpUrl` and we don't want spans emitted from "Prod tunnel" landing
    // in the local LGTM. Effects run in the injection context.
    effect(() => {
      const url = this.env.otlpUrl();
      if (url) this.ensureOtel(url);
    });
  }

  /**
   * Initialise the OpenTelemetry Web SDK and wire auto-instrumentations
   * for `fetch` + `XMLHttpRequest`. Idempotent — safe to call multiple
   * times (each call replaces the previous provider).
   *
   * @param otlpUrl base URL of the CORS-proxied OTLP HTTP receiver
   *                (e.g. `http://localhost:4319`). The exporter appends
   *                `/v1/traces` itself.
   */
  private ensureOtel(otlpUrl: string): void {
    // Dev-mode opt-out: OTel spans in every fetch blow up the DevTools
    // network tab and slow HMR. Skip until we genuinely need them locally.
    if (this.dev) return;
    // Cheap guard — repeat calls with the same URL are no-ops.
    if (this.lastOtlpUrl === otlpUrl) return;

    // Tear down any previous provider so we don't double-emit when the
    // env selector toggles. `shutdown()` flushes the batch before
    // disposing — Promises not awaited, rejects ignored (best-effort).
    this.provider?.shutdown().catch(() => undefined);

    const resource = resourceFromAttributes({
      [ATTR_SERVICE_NAME]: 'mirador-ui',
      [ATTR_SERVICE_VERSION]: '0.0.0',
      'deployment.environment': this.env.current().name.toLowerCase(),
      // Informational — helps diff spans across env switches in one session.
      'otlp.url': otlpUrl,
    });

    const exporter = new OTLPTraceExporter({ url: `${otlpUrl}/v1/traces` });

    const provider = new WebTracerProvider({
      resource,
      spanProcessors: [new BatchSpanProcessor(exporter)],
    });

    // ZoneContextManager is still the recommended manager for the browser
    // even under zoneless Angular — it isolates span context across async
    // boundaries (timers, promises) without requiring Zone.js to be present.
    provider.register({ contextManager: new ZoneContextManager() });

    registerInstrumentations({
      tracerProvider: provider,
      instrumentations: [
        new FetchInstrumentation({
          // Scope trace-context propagation to our own backends so we don't
          // leak traceparent to Sonar, Auth0, Grafana plugin CDNs, etc.
          propagateTraceHeaderCorsUrls: [
            /^http:\/\/localhost:(8080|18080|28080)/,
            /^http:\/\/localhost:(3000|13000|23000)/,
          ],
        }),
        new XMLHttpRequestInstrumentation({
          propagateTraceHeaderCorsUrls: [/^http:\/\/localhost:(8080|18080|28080)/],
        }),
      ],
    });

    this.provider = provider;
    this.lastOtlpUrl = otlpUrl;
    this.tracer = trace.getTracer('mirador-ui');
    this.info('otel.init', { otlpUrl, env: this.env.current().name });
  }

  /** Debug — dropped in production builds. Use for verbose traces only. */
  debug(message: string, context?: Record<string, unknown>): void {
    this.push({ time: new Date(), level: 'debug', message, context });
  }

  /** Info — normal operational event, kept in history, not sent to Tempo in Phase A. */
  info(message: string, context?: Record<string, unknown>): void {
    this.push({ time: new Date(), level: 'info', message, context });
  }

  /** Warn — recoverable anomaly. In Phase B this will emit a span event. */
  warn(message: string, context?: Record<string, unknown>): void {
    this.push({ time: new Date(), level: 'warn', message, context });
  }

  /**
   * Error — unexpected failure. Always mirrored to `console.error` so it
   * surfaces in the browser DevTools, recorded in the Activity timeline
   * so users viewing /activity see the failure, and queued for Tempo
   * (Phase B).
   */
  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.push({ time: new Date(), level: 'error', message, error, context });
    // Activity page renders a red badge for errors — gives the user a
    // breadcrumb trail without opening DevTools. Only logs the message
    // (not the stack) to keep the list compact.
    this.activity.log('diagnostic-run', `⚠ ${message}`);
  }

  /** Clears the history signal. Used by the Activity page's "Clear" button. */
  clear(): void {
    this.history.set([]);
  }

  private push(entry: LogEntry): void {
    this.history.update((h) => {
      const next = h.length >= HISTORY_CAP ? h.slice(h.length - HISTORY_CAP + 1) : h;
      return [...next, entry];
    });

    if (this.dev) {
      const logger =
        entry.level === 'error'
          ? console.error
          : entry.level === 'warn'
            ? console.warn
            : entry.level === 'debug'
              ? console.debug
              : console.info;
      logger.call(
        console,
        `[telemetry:${entry.level}]`,
        entry.message,
        entry.context ?? '',
        entry.error ?? '',
      );
    } else if (entry.level === 'error') {
      // Even in prod, surface raw errors to DevTools — don't swallow.
      console.error(entry.message, entry.error ?? entry.context ?? '');
    }

    // Phase B: emit a span event for warn / error so a dev can jump from
    // a Loki log line into the browser-side trace in Grafana Explore.
    // Info / debug stay in-memory to avoid flooding Tempo with noise.
    if (this.tracer && (entry.level === 'error' || entry.level === 'warn')) {
      const span = this.tracer.startSpan(`log.${entry.level}`);
      span.setAttribute('log.severity', entry.level);
      span.setAttribute('log.message', entry.message);
      if (entry.error) {
        span.recordException(entry.error);
        span.setAttribute('exception.type', entry.error.name);
      }
      if (entry.context) {
        for (const [k, v] of Object.entries(entry.context)) {
          if (v === null || v === undefined) continue;
          span.setAttribute(
            `app.${k}`,
            typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
              ? v
              : JSON.stringify(v),
          );
        }
      }
      span.end();
    }
  }
}
