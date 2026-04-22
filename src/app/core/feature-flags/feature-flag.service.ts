/**
 * FeatureFlagService — reads feature flags from `unleash-proxy`.
 *
 * Architecture:
 *   Browser → unleash-proxy (:14243 kind / :24243 prod) → Unleash server
 * No Spring Boot in the path (ADR-0026 in mirador-service). The proxy
 * authenticates the browser with a pre-shared front-end token; it in
 * turn authenticates to the Unleash admin API with a server-side token.
 *
 * Polling model: on service construction, if an `unleashProxyUrl` is
 * available for the current environment (kind / prod), fetch the toggle
 * map. Re-poll every 30 s. The `toggles` signal updates on every fetch.
 *
 * In Local (compose) the UI has no Unleash backend — `unleashProxyUrl`
 * is `null` and the service stays in the "unavailable" state. Callers
 * gate their feature-flag-specific behaviour on `isAvailable()`.
 */
import { Injectable, computed, DestroyRef, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { EnvService } from '../env/env.service';

/** Shape returned by `unleash-proxy`'s `GET /proxy` endpoint. */
interface UnleashProxyResponse {
  toggles: {
    name: string;
    enabled: boolean;
    /** Optional payload for variant toggles — ignored for now. */
    variant?: { name: string; enabled: boolean };
  }[];
}

/**
 * Pre-shared secret the browser sends in `Authorization:` when calling
 * `unleash-proxy`. Matches `UNLEASH_PROXY_SECRETS` in the K8s
 * Deployment. Not a security boundary by itself (the proxy is
 * port-forward-only — ADR-0025); the secret's role is to distinguish
 * UI traffic from other callers, not to gate access.
 */
const FRONTEND_TOKEN = 'mirador-ui-proxy-secret';

@Injectable({ providedIn: 'root' })
export class FeatureFlagService {
  private readonly http = inject(HttpClient);
  private readonly env = inject(EnvService);
  /**
   * DestroyRef for `takeUntilDestroyed()` on every refresh subscribe.
   * Singleton service (`providedIn: 'root'`) so destroy fires only on app
   * teardown, but the pattern is uniform with components for review
   * consistency (Phase 4.1, 2026-04-22).
   */
  private readonly destroyRef = inject(DestroyRef);

  /** Toggle map, keyed by flag name. Empty until the first successful fetch. */
  private readonly _flags = signal<Record<string, boolean>>({});

  /** Has at least one fetch succeeded on the current environment? */
  private readonly _loaded = signal(false);

  /** Last error from the proxy — null after a successful refresh. */
  private readonly _error = signal<string | null>(null);

  readonly flags = this._flags.asReadonly();
  readonly loaded = this._loaded.asReadonly();
  readonly error = this._error.asReadonly();

  /**
   * True when the current environment exposes an `unleashProxyUrl`. Use
   * this to gate flag-driven UI blocks:
   * `@if (flagSvc.isAvailable() && flagSvc.isOn('mirador.bio.enabled'))`.
   */
  readonly isAvailable = computed(() => this.env.unleashProxyUrl() !== null);

  private pollHandle: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // React to env changes (dropdown in the topbar). Stop polling and
    // wipe the cached flags when the user switches to an env without a
    // proxy — otherwise stale kind flags leak into prod views.
    effect(() => {
      const url = this.env.unleashProxyUrl();
      this.cancelPolling();
      this._flags.set({});
      this._loaded.set(false);
      this._error.set(null);
      if (url) this.startPolling(url);
    });
  }

  /**
   * Convenience accessor — returns false when the flag is unknown so the
   * "new feature hidden by default" contract holds even when the proxy
   * is unreachable.
   */
  isOn(flagName: string): boolean {
    return this._flags()[flagName] === true;
  }

  private startPolling(url: string): void {
    const fetch = () => this.refresh(url);
    fetch();
    // 30 s matches unleash-proxy's default server-side poll interval;
    // shorter intervals just thrash the browser without fresher data.
    this.pollHandle = setInterval(fetch, 30_000);
  }

  private cancelPolling(): void {
    if (this.pollHandle !== null) {
      clearInterval(this.pollHandle);
      this.pollHandle = null;
    }
  }

  private refresh(url: string): void {
    // appName + environment are standard Unleash query params identifying
    // which Unleash project/env to evaluate against. Match the
    // INIT_FRONTEND_API_TOKENS config on the unleash server.
    const endpoint = `${url}/proxy?appName=mirador-ui&environment=development`;
    this.http
      .get<UnleashProxyResponse>(endpoint, { headers: { Authorization: FRONTEND_TOKEN } })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const map: Record<string, boolean> = {};
          for (const t of res.toggles ?? []) map[t.name] = t.enabled;
          this._flags.set(map);
          this._loaded.set(true);
          this._error.set(null);
        },
        error: (e) => {
          this._error.set(`unleash-proxy unreachable (${e.status || 'network error'})`);
        },
      });
  }
}
