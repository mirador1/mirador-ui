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
import { Injectable, inject, isDevMode, signal } from '@angular/core';
import { ActivityService } from '../activity/activity.service';

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

  /**
   * Bounded in-memory history. Consumers (Activity page, future debug panel)
   * read this as a signal so they get zoneless updates for free.
   */
  readonly history = signal<LogEntry[]>([]);

  /** Dev mode short-circuit — we still mirror to the real console then. */
  private readonly dev = isDevMode();

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

    // Phase B hook — when OTLP wiring lands, this is where we'll emit a
    // span event via `tracer.startSpan(...).addEvent(...).end()`.
  }
}
